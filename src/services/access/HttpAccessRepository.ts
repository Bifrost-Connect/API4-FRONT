/**
 * Implementação HTTP da camada de Controle de Acesso (RBAC) integrada ao API4-BACK.
 */

import type {
  AccessRepository,
  PaginatedResult,
  UserListFilters,
  SecurityEventFilters,
  CreateUserDto,
  UpdateUserDto,
  CreateRoleDto,
  UpdateRoleDto,
  RecordSecurityEventDto,
} from './AccessRepository'
import {
  ALL_PERMISSIONS,
  DuplicateEmailError,
  type UserItem,
  type RoleDef,
  type PermissionDefinition,
  type SecurityEvent,
} from '@/types/access'
import api, { ApiError } from '@/services/api'
import {
  extractPerfilIdMap,
  mapBackendAuditLogToSecurityEvent,
  mapBackendMatrixToRoles,
  mapBackendRoleToFront,
  mapBackendUserToUserItem,
  mapFrontRoleToBackend,
  type BackendAuditLogRow,
  type BackendRolePermissionRow,
  type BackendUserRow,
} from '@/utils/rbacAdapter'

interface BackendPageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export class HttpAccessRepository implements AccessRepository {
  private perfilIdMap: Record<string, number> = {}
  private rolesCache: RoleDef[] = []
  private usersCache = new Map<number, UserItem>()

  async fetchPerfilIds(): Promise<Record<string, number>> {
    const res = await api.get<BackendRolePermissionRow[]>('/admin/perfis-permissoes')
    const rows = Array.isArray(res.data) ? res.data : []
    this.perfilIdMap = extractPerfilIdMap(rows)
    this.rolesCache = mapBackendMatrixToRoles(rows)
    return this.perfilIdMap
  }

  private async resolvePerfilId(roleId: string): Promise<number> {
    const upper = roleId.trim().toUpperCase()
    const front = mapBackendRoleToFront(upper)
    const backend = mapFrontRoleToBackend(upper)

    let found = this.perfilIdMap[upper] ?? this.perfilIdMap[front] ?? this.perfilIdMap[backend]
    if (found === undefined) {
      await this.fetchPerfilIds()
      found = this.perfilIdMap[upper] ?? this.perfilIdMap[front] ?? this.perfilIdMap[backend]
    }

    if (found === undefined) {
      throw new Error(`Perfil "${roleId}" não encontrado na matriz do servidor.`)
    }
    return found
  }

  async listUsers(filters?: UserListFilters): Promise<UserItem[]> {
    const paged = await this.listUsersPaged({
      ...filters,
      size: filters?.size ?? 100,
    })
    return paged.items
  }

  async listUsersPaged(filters?: UserListFilters): Promise<PaginatedResult<UserItem>> {
    const params: Record<string, unknown> = {}
    if (filters?.nome) params.nome = filters.nome
    if (filters?.email) params.email = filters.email
    if (filters?.perfilId !== undefined) params.perfilId = filters.perfilId
    if (filters?.ativo !== undefined) params.ativo = filters.ativo
    if (filters?.page !== undefined) params.page = filters.page
    if (filters?.size !== undefined) params.size = filters.size

    const res = await api.get<BackendPageResponse<BackendUserRow>>('/admin/usuarios', { params })
    const data = res.data
    const content = Array.isArray(data?.content) ? data.content : []
    const items = content.map((row) => {
      const rolePerms = this.rolesCache.find((r) => r.id === mapBackendRoleToFront(row.perfil))?.permissions
      const item = mapBackendUserToUserItem(row, rolePerms)
      this.usersCache.set(item.id, item)
      return item
    })

    return {
      items,
      page: data?.page ?? 0,
      size: data?.size ?? items.length,
      totalElements: data?.totalElements ?? items.length,
      totalPages: Math.max(1, data?.totalPages ?? 1),
    }
  }

  async getUserById(id: number): Promise<UserItem | undefined> {
    const cached = this.usersCache.get(id)
    if (cached) return cached
    const all = await this.listUsers()
    return all.find((u) => u.id === id)
  }

  async createUser(dto: CreateUserDto): Promise<UserItem> {
    const perfilId = await this.resolvePerfilId(dto.role)
    try {
      const res = await api.post<BackendUserRow>('/admin/usuarios', {
        nome: dto.name.trim(),
        email: dto.email.trim(),
        senha: dto.temporaryPassword || '',
        perfilId,
      })
      const item = mapBackendUserToUserItem(res.data)
      this.usersCache.set(item.id, item)
      return item
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        throw new DuplicateEmailError(dto.email)
      }
      throw new ApiError(err)
    }
  }

  async updateUser(id: number, dto: UpdateUserDto): Promise<UserItem | null> {
    const perfilId = await this.resolvePerfilId(dto.role)
    const cached = this.usersCache.get(id)

    try {
      const permRes = await api.put<BackendUserRow>(`/admin/usuarios/${id}/permissoes`, {
        perfilId,
        excecaoSoD: Boolean(dto.sodException),
        justificativa: dto.sodJustification?.trim() || '',
      })

      let latestRow = permRes.data

      if (dto.status && cached && cached.status !== dto.status) {
        const statusRes = await api.patch<BackendUserRow>(`/admin/usuarios/${id}/status`, {
          ativo: dto.status === 'Ativo',
        })
        if (statusRes.data) {
          latestRow = statusRes.data
        }
      }

      const item = mapBackendUserToUserItem(latestRow)
      this.usersCache.set(item.id, item)
      return item
    } catch (err: unknown) {
      throw new ApiError(err)
    }
  }

  async toggleUserStatus(id: number, targetAtivo?: boolean): Promise<UserItem | null> {
    let nextAtivo = targetAtivo
    let current = this.usersCache.get(id)
    if (!current && nextAtivo === undefined) {
      current = await this.getUserById(id)
    }
    if (nextAtivo === undefined) {
      if (!current) return null
      nextAtivo = current.status !== 'Ativo'
    }

    try {
      const res = await api.patch<BackendUserRow>(`/admin/usuarios/${id}/status`, {
        ativo: nextAtivo,
      })
      if (res.data) {
        const mapped = mapBackendUserToUserItem(res.data)
        this.usersCache.set(mapped.id, mapped)
        return mapped
      }
      if (current) {
        const updated: UserItem = { ...current, status: nextAtivo ? 'Ativo' : 'Inativo' }
        this.usersCache.set(updated.id, updated)
        return updated
      }
      return null
    } catch (err: unknown) {
      throw new ApiError(err)
    }
  }

  async resetPassword(id: number, novaSenha: string): Promise<void> {
    if (!novaSenha || novaSenha.length < 8) {
      throw new Error('A nova senha deve ter no mínimo 8 caracteres.')
    }
    try {
      await api.post(`/admin/usuarios/${id}/redefinir-senha`, { novaSenha })
    } catch (err: unknown) {
      throw new ApiError(err)
    }
  }

  // TODO: Aguardando endpoint no API4-BACK (permissões individuais fora do perfil)
  async updateUserPermissions(_id: number, _permissions: string[]): Promise<UserItem | null> {
    throw new Error('Alteração granular de permissões por usuário ainda não disponível no servidor.')
  }

  // TODO: Aguardando endpoint no API4-BACK (permissões individuais fora do perfil)
  async resetUserPermissions(_id: number): Promise<string[]> {
    throw new Error('Restauração granular de permissões ainda não disponível no servidor.')
  }

  async listRoles(): Promise<RoleDef[]> {
    await this.fetchPerfilIds()
    return this.rolesCache
  }

  async getRoleById(id: string): Promise<RoleDef | undefined> {
    if (this.rolesCache.length === 0) {
      await this.listRoles()
    }
    const norm = mapBackendRoleToFront(id)
    return this.rolesCache.find((r) => r.id === norm || r.id === id.toUpperCase())
  }

  // TODO: Aguardando endpoint no API4-BACK (CRUD de cargos customizados)
  async createRole(_dto: CreateRoleDto): Promise<RoleDef> {
    throw new Error('Criação de cargos customizados ainda não disponível no servidor.')
  }

  // TODO: Aguardando endpoint no API4-BACK (CRUD de cargos customizados)
  async updateRole(_id: string, _dto: UpdateRoleDto): Promise<RoleDef | null> {
    throw new Error('Edição de cargos customizados ainda não disponível no servidor.')
  }

  // TODO: Aguardando endpoint no API4-BACK (CRUD de cargos customizados)
  async deleteRole(_id: string): Promise<boolean> {
    throw new Error('Exclusão de cargos customizados ainda não disponível no servidor.')
  }

  async listPermissions(): Promise<PermissionDefinition[]> {
    return ALL_PERMISSIONS
  }

  async listSecurityEvents(filters?: SecurityEventFilters): Promise<SecurityEvent[]> {
    const paged = await this.listSecurityEventsPaged({
      ...filters,
      size: filters?.size ?? 50,
    })
    return paged.items
  }

  async listSecurityEventsPaged(
    filters?: SecurityEventFilters,
  ): Promise<PaginatedResult<SecurityEvent>> {
    const params: Record<string, unknown> = {}
    if (filters?.usuarioId !== undefined) params.usuarioId = filters.usuarioId
    if (filters?.acao) params.acao = filters.acao
    if (filters?.de) params.de = filters.de
    if (filters?.ate) params.ate = filters.ate
    if (filters?.page !== undefined) params.page = filters.page
    if (filters?.size !== undefined) params.size = filters.size

    const res = await api.get<BackendPageResponse<BackendAuditLogRow>>('/admin/logs-seguranca', {
      params,
    })
    const data = res.data
    const content = Array.isArray(data?.content) ? data.content : []
    const items = content.map(mapBackendAuditLogToSecurityEvent)

    return {
      items,
      page: data?.page ?? 0,
      size: data?.size ?? items.length,
      totalElements: data?.totalElements ?? items.length,
      totalPages: Math.max(1, data?.totalPages ?? 1),
    }
  }

  // TODO: Aguardando endpoint no API4-BACK (logs de segurança são gravados automaticamente pelo servidor)
  async recordSecurityEvent(dto: RecordSecurityEventDto): Promise<SecurityEvent> {
    return {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      actorEmail: dto.actorEmail || '',
      actorName: dto.actorName || '',
      action: dto.action,
      details: dto.details,
      severity: dto.severity || 'INFO',
    }
  }
}
