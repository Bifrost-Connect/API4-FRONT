/**
 * Implementação HTTP da camada de Controle de Acesso (RBAC).
 * Estrutura pronta para conexão com o Back-End quando os endpoints forem disponibilizados.
 */

import type {
  AccessRepository,
  CreateUserDto,
  UpdateUserDto,
  CreateRoleDto,
  UpdateRoleDto,
  RecordSecurityEventDto,
} from './AccessRepository'
import type {
  UserItem,
  RoleDef,
  PermissionDefinition,
  SecurityEvent,
} from '@/mocks/user.mock'
import api from '@/services/api'

export class HttpAccessRepository implements AccessRepository {
  async listUsers(): Promise<UserItem[]> {
    const res = await api.get('/usuarios')
    return res.data
  }

  async getUserById(id: number): Promise<UserItem | undefined> {
    const res = await api.get(`/usuarios/${id}`)
    return res.data
  }

  async createUser(dto: CreateUserDto): Promise<UserItem> {
    const res = await api.post('/usuarios', dto)
    return res.data
  }

  async updateUser(id: number, dto: UpdateUserDto): Promise<UserItem | null> {
    const res = await api.put(`/usuarios/${id}`, dto)
    return res.data
  }

  async toggleUserStatus(id: number): Promise<UserItem | null> {
    const res = await api.patch(`/usuarios/${id}/status`)
    return res.data
  }

  async updateUserPermissions(id: number, permissions: string[]): Promise<UserItem | null> {
    const res = await api.put(`/usuarios/${id}/permissoes`, { permissions })
    return res.data
  }

  async resetUserPermissions(id: number): Promise<string[]> {
    const res = await api.post(`/usuarios/${id}/permissoes/reset`)
    return res.data
  }

  async listRoles(): Promise<RoleDef[]> {
    const res = await api.get('/roles')
    return res.data
  }

  async getRoleById(id: string): Promise<RoleDef | undefined> {
    const res = await api.get(`/roles/${id}`)
    return res.data
  }

  async createRole(dto: CreateRoleDto): Promise<RoleDef> {
    const res = await api.post('/roles', dto)
    return res.data
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleDef | null> {
    const res = await api.put(`/roles/${id}`, dto)
    return res.data
  }

  async deleteRole(id: string): Promise<boolean> {
    await api.delete(`/roles/${id}`)
    return true
  }

  async listPermissions(): Promise<PermissionDefinition[]> {
    const res = await api.get('/permissoes')
    return res.data
  }

  async listSecurityEvents(): Promise<SecurityEvent[]> {
    const res = await api.get('/auditoria-seguranca')
    return res.data
  }

  async recordSecurityEvent(dto: RecordSecurityEventDto): Promise<SecurityEvent> {
    const res = await api.post('/auditoria-seguranca', dto)
    return res.data
  }
}
