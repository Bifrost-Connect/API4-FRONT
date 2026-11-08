/**
 * Implementação Mock da camada de Controle de Acesso (RBAC).
 * Armazena o estado simulado em memória enquanto os endpoints do Back-End estão em desenvolvimento.
 */

import type {
  AccessRepository,
  CreateUserDto,
  UpdateUserDto,
  CreateRoleDto,
  UpdateRoleDto,
  RecordSecurityEventDto,
} from './AccessRepository'
import {
  MOCK_USERS_LIST,
  MOCK_ROLES,
  ALL_PERMISSIONS,
  MOCK_SECURITY_EVENTS,
  type UserItem,
  type RoleDef,
  type PermissionDefinition,
  type SecurityEvent,
} from '@/mocks/user.mock'

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`O e-mail "${email}" já está cadastrado no sistema.`)
    this.name = 'DuplicateEmailError'
  }
}

export class StandardRoleProtectedError extends Error {
  constructor(roleId: string) {
    super(`O papel padrão "${roleId}" não pode ser removido do sistema.`)
    this.name = 'StandardRoleProtectedError'
  }
}

export class RoleInUseError extends Error {
  constructor(roleId: string, count: number) {
    super(`O papel "${roleId}" está vinculado a ${count} usuário(s) e não pode ser excluído.`)
    this.name = 'RoleInUseError'
  }
}

export class MockAccessRepository implements AccessRepository {
  private users: UserItem[] = JSON.parse(JSON.stringify(MOCK_USERS_LIST))
  private roles: RoleDef[] = JSON.parse(JSON.stringify(MOCK_ROLES))
  private securityEvents: SecurityEvent[] = JSON.parse(JSON.stringify(MOCK_SECURITY_EVENTS))

  // -------------------------------------------------------------
  // Usuários
  // -------------------------------------------------------------

  async listUsers(): Promise<UserItem[]> {
    return this.users
  }

  async getUserById(id: number): Promise<UserItem | undefined> {
    return this.users.find((u) => u.id === id)
  }

  async createUser(dto: CreateUserDto): Promise<UserItem> {
    const emailNorm = dto.email.trim().toLowerCase()
    const duplicate = this.users.some((u) => u.email.trim().toLowerCase() === emailNorm)
    if (duplicate) {
      throw new DuplicateEmailError(dto.email)
    }

    const roleDef = this.roles.find((r) => r.id === dto.role)
    const permissions = roleDef ? [...roleDef.permissions] : []

    const newUser: UserItem = {
      id: Date.now(),
      name: dto.name.trim(),
      email: dto.email.trim(),
      role: dto.role,
      permissions,
      department: dto.department || 'Geral',
      status: dto.status || 'Ativo',
      lastLogin: 'Nunca',
      sodException: Boolean(dto.sodException),
      sodJustification: dto.sodJustification?.trim() || undefined,
    }

    this.users.unshift(newUser)

    await this.recordSecurityEvent({
      action: 'Criação de Conta',
      details: `Cadastrou o usuário ${newUser.name} com papel ${newUser.role}.${
        newUser.sodException ? ` Exceção SoD concedida: "${newUser.sodJustification}"` : ''
      }`,
      severity: newUser.sodException ? 'DANGER' : 'INFO',
    })

    return newUser
  }

  async updateUser(id: number, dto: UpdateUserDto): Promise<UserItem | null> {
    const idx = this.users.findIndex((u) => u.id === id)
    if (idx === -1) return null

    const existing = this.users[idx]!
    const emailNorm = dto.email.trim().toLowerCase()
    const duplicate = this.users.some(
      (u) => u.id !== id && u.email.trim().toLowerCase() === emailNorm,
    )
    if (duplicate) {
      throw new DuplicateEmailError(dto.email)
    }

    const roleChanged = existing.role !== dto.role
    let permissions = [...existing.permissions]
    if (roleChanged) {
      const newRole = this.roles.find((r) => r.id === dto.role)
      permissions = newRole ? [...newRole.permissions] : []
    }

    const updated: UserItem = {
      ...existing,
      name: dto.name.trim(),
      email: dto.email.trim(),
      role: dto.role,
      permissions,
      department: dto.department || existing.department,
      status: dto.status || existing.status,
      sodException: dto.sodException !== undefined ? dto.sodException : existing.sodException,
      sodJustification: dto.sodJustification || existing.sodJustification,
    }

    this.users[idx] = updated

    if (roleChanged) {
      await this.recordSecurityEvent({
        action: 'Troca de Cargo',
        details: `Alterou o papel do usuário ${updated.name} de ${existing.role} para ${updated.role}.`,
        severity: 'INFO',
      })
    }

    return updated
  }

  async toggleUserStatus(id: number): Promise<UserItem | null> {
    const user = await this.getUserById(id)
    if (!user) return null

    const prev = user.status
    user.status = prev === 'Ativo' ? 'Inativo' : 'Ativo'

    await this.recordSecurityEvent({
      action: user.status === 'Ativo' ? 'Ativação de Conta' : 'Inativação de Conta',
      details: `${user.status === 'Ativo' ? 'Ativou' : 'Inativou'} o acesso do usuário ${user.name}.`,
      severity: user.status === 'Inativo' ? 'WARNING' : 'INFO',
    })

    return user
  }

  async updateUserPermissions(id: number, permissions: string[]): Promise<UserItem | null> {
    const user = await this.getUserById(id)
    if (!user) return null
    user.permissions = [...permissions]
    return user
  }

  async resetUserPermissions(id: number): Promise<string[]> {
    const user = await this.getUserById(id)
    if (!user) return []
    const roleDef = this.roles.find((r) => r.id === user.role)
    user.permissions = roleDef ? [...roleDef.permissions] : []
    return user.permissions
  }

  // -------------------------------------------------------------
  // Roles
  // -------------------------------------------------------------

  async listRoles(): Promise<RoleDef[]> {
    return this.roles
  }

  async getRoleById(id: string): Promise<RoleDef | undefined> {
    return this.roles.find((r) => r.id === id)
  }

  async createRole(dto: CreateRoleDto): Promise<RoleDef> {
    const roleId = dto.id.trim().toUpperCase()
    const exists = this.roles.some((r) => r.id === roleId)
    if (exists) {
      throw new Error(`Já existe um papel com o identificador "${roleId}".`)
    }

    const newRole: RoleDef = {
      id: roleId,
      nome: dto.nome.trim(),
      descricao: dto.descricao.trim(),
      padrao: false,
      permissions: [...dto.permissions],
    }

    this.roles.push(newRole)

    await this.recordSecurityEvent({
      action: 'Criação de Papel',
      details: `Criou o papel customizado "${newRole.nome}" (${newRole.id}) com ${newRole.permissions.length} permissões.`,
      severity: 'INFO',
    })

    return newRole
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleDef | null> {
    const idx = this.roles.findIndex((r) => r.id === id)
    if (idx === -1) return null

    const existing = this.roles[idx]!
    const updated: RoleDef = {
      ...existing,
      nome: dto.nome.trim(),
      descricao: dto.descricao.trim(),
      permissions: [...dto.permissions],
    }

    this.roles[idx] = updated

    await this.recordSecurityEvent({
      action: 'Atualização de Papel',
      details: `Atualizou as permissões do papel "${updated.nome}" (${updated.id}).`,
      severity: 'INFO',
    })

    return updated
  }

  async deleteRole(id: string): Promise<boolean> {
    const role = await this.getRoleById(id)
    if (!role) return false

    if (role.padrao) {
      throw new StandardRoleProtectedError(id)
    }

    const countUsers = this.users.filter((u) => u.role === id).length
    if (countUsers > 0) {
      throw new RoleInUseError(id, countUsers)
    }

    this.roles = this.roles.filter((r) => r.id !== id)

    await this.recordSecurityEvent({
      action: 'Exclusão de Papel',
      details: `Removeu o papel customizado "${role.nome}" (${role.id}).`,
      severity: 'WARNING',
    })

    return true
  }

  // -------------------------------------------------------------
  // Permissões
  // -------------------------------------------------------------

  async listPermissions(): Promise<PermissionDefinition[]> {
    return ALL_PERMISSIONS
  }

  // -------------------------------------------------------------
  // Auditoria de Segurança
  // -------------------------------------------------------------

  async listSecurityEvents(): Promise<SecurityEvent[]> {
    return this.securityEvents
  }

  async recordSecurityEvent(dto: RecordSecurityEventDto): Promise<SecurityEvent> {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(
      now.getHours(),
    )}:${pad(now.getMinutes())}`

    const newEvent: SecurityEvent = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      timestamp,
      actorEmail: dto.actorEmail || 'carlos.mendes@georural.com.br',
      actorName: dto.actorName || 'Carlos Mendes',
      action: dto.action,
      details: dto.details,
      severity: dto.severity || 'INFO',
    }

    this.securityEvents.unshift(newEvent)
    return newEvent
  }
}
