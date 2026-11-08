/**
 * Serviço de Gerenciamento do Usuário, Sessão e Controle de Acessos (RBAC).
 * Centraliza as regras de negócio de usuários, papéis e permissões do GeoRural.
 */

import { ref } from 'vue'
import {
  MOCK_AVAILABLE_ROLES,
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  type UserItem,
  type SystemRole,
  type StandardRole,
  type RoleDef,
  type PermissionDefinition,
  type RoleOption,
  type SecurityEvent,
} from '../mocks/user.mock'
import { roleService } from './roles'
import {
  can as checkCan,
  canAny as checkCanAny,
  normalizeRoleKey,
  type SessionUser,
} from '@/utils/rbac'
import type {
  CreateUserDto,
  UpdateUserDto,
  RecordSecurityEventDto,
} from './access/AccessRepository'
import {
  authStorage,
  DEFAULT_SESSION_TTL_MS,
  type StoredAuthSession,
} from './storage/authStorage'
import { geojsonCache } from './storage/geojsonCache'
import { uiPreferencesStorage } from './storage/uiPreferencesStorage'

export type { UserItem, SystemRole, StandardRole, RoleDef, PermissionDefinition, RoleOption, SecurityEvent }
export type UserRole = 'Operador' | 'Auditor' | 'Analista' | 'Administrador' | 'Gestor' | string

export type UserSession = SessionUser & {
  email?: string
  token?: string
}

const DEMO_USERS: Record<string, UserSession> = {
  Operador: {
    id: 3,
    name: 'João Silva',
    email: 'operador@georural.com.br',
    role: 'Operador',
    roleId: 'OPERADOR_DADOS',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.OPERADOR_DADOS || [])],
  },
  OPERADOR_DADOS: {
    id: 3,
    name: 'João Silva',
    email: 'operador@georural.com.br',
    role: 'Operador',
    roleId: 'OPERADOR_DADOS',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.OPERADOR_DADOS || [])],
  },
  Auditor: {
    id: 4,
    name: 'Daniel Natan',
    email: 'auditor@georural.com.br',
    role: 'Auditor',
    roleId: 'AUDITOR',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.AUDITOR || [])],
  },
  AUDITOR: {
    id: 4,
    name: 'Daniel Natan',
    email: 'auditor@georural.com.br',
    role: 'Auditor',
    roleId: 'AUDITOR',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.AUDITOR || [])],
  },
  Analista: {
    id: 2,
    name: 'Mariana Duarte',
    email: 'analista@georural.com.br',
    role: 'Analista',
    roleId: 'ANALISTA',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.ANALISTA || [])],
  },
  ANALISTA: {
    id: 2,
    name: 'Mariana Duarte',
    email: 'analista@georural.com.br',
    role: 'Analista',
    roleId: 'ANALISTA',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.ANALISTA || [])],
  },
  Administrador: {
    id: 1,
    name: 'Carlos Mendes',
    email: 'admin@georural.com.br',
    role: 'Administrador',
    roleId: 'ADMIN',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.ADMIN || [])],
  },
  ADMIN: {
    id: 1,
    name: 'Carlos Mendes',
    email: 'admin@georural.com.br',
    role: 'Administrador',
    roleId: 'ADMIN',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.ADMIN || [])],
  },
  Gestor: {
    id: 5,
    name: 'Fernando Rocha',
    email: 'gestor@georural.com.br',
    role: 'Gestor',
    roleId: 'GESTOR',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.GESTOR || [])],
  },
  GESTOR: {
    id: 5,
    name: 'Fernando Rocha',
    email: 'gestor@georural.com.br',
    role: 'Gestor',
    roleId: 'GESTOR',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.GESTOR || [])],
  },
}

// Sessão padrão inicial
const defaultSession: UserSession = { ...DEMO_USERS.Operador! }

function resolveInitialSession(): UserSession {
  const stored = authStorage.getSession()
  if (stored) {
    return {
      id: stored.userId,
      name: stored.name,
      email: stored.email,
      role: stored.role,
      roleId: stored.roleId,
      permissions: [...stored.permissions],
    }
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const legacyRole = window.localStorage.getItem('api4-demo-role')
      if (legacyRole && DEMO_USERS[legacyRole]) {
        return { ...DEMO_USERS[legacyRole] }
      }
    }
  } catch {}

  return { ...defaultSession }
}

const currentUser = ref<UserSession>(resolveInitialSession())

if (typeof window !== 'undefined') {
  authStorage.subscribeToStorageChanges((newSession) => {
    if (newSession) {
      currentUser.value = {
        id: newSession.userId,
        name: newSession.name,
        email: newSession.email,
        role: newSession.role,
        roleId: newSession.roleId,
        permissions: [...newSession.permissions],
      }
    } else {
      currentUser.value = {
        ...defaultSession,
        permissions: [...defaultSession.permissions],
      }
    }
  })
}

export const userService = {
  /**
   * Retorna os dados da sessão do usuário atual.
   */
  getCurrentUser(): UserSession {
    return currentUser.value
  },

  /**
   * Define manualmente o papel de acesso da sessão com preenchimento
   * automático de permissões e sincronização em localStorage.
   */
  setCurrentUserRole(role: string) {
    const demo = DEMO_USERS[role]
    if (demo) {
      currentUser.value = {
        ...demo,
        permissions: [...demo.permissions],
      }
    } else {
      const key = normalizeRoleKey(role)
      const perms = (ROLE_DEFAULT_PERMISSIONS as Record<string, string[]>)[key] || []
      currentUser.value = {
        id: Date.now(),
        name: `Usuário (${role})`,
        email: `${role.toLowerCase()}@georural.com.br`,
        role,
        roleId: key,
        permissions: [...perms],
      }
    }

    const cur = currentUser.value
    authStorage.saveSession({
      userId: cur.id,
      name: cur.name,
      email: cur.email || `${role.toLowerCase()}@georural.com.br`,
      role: cur.role,
      roleId: cur.roleId || normalizeRoleKey(role),
      permissions: [...cur.permissions],
      loggedAt: Date.now(),
      expiresAt: Date.now() + DEFAULT_SESSION_TTL_MS,
      isSimulated: true,
    })
  },

  /**
   * Atualiza os dados completos da sessão autenticada.
   */
  setCurrentUser(user: UserSession) {
    currentUser.value = {
      ...user,
      permissions: Array.isArray(user.permissions) ? [...user.permissions] : [],
    }

    authStorage.saveSession({
      userId: user.id,
      name: user.name,
      email: user.email || `${user.role.toLowerCase()}@georural.com.br`,
      role: user.role,
      roleId: user.roleId || normalizeRoleKey(user.role),
      permissions: [...currentUser.value.permissions],
      loggedAt: Date.now(),
      expiresAt: Date.now() + DEFAULT_SESSION_TTL_MS,
      isSimulated: true,
    })
  },

  /**
   * Restaura a sessão para o estado padrão neutro.
   */
  clearCurrentUser() {
    currentUser.value = {
      ...defaultSession,
      permissions: [...defaultSession.permissions],
    }
    authStorage.clearSession()
  },

  /**
   * Executa logout limpo: revoga credenciais, limpa filtros de sessão e
   * descarta camadas GeoJSON restritas no cache local.
   */
  async logout() {
    this.clearCurrentUser()
    uiPreferencesStorage.clearCatalogFilters()
    try {
      await geojsonCache.clearRestricted()
    } catch {}
  },

  /**
   * Verifica se o usuário autenticado possui perfil de Administrador.
   */
  isAdmin(): boolean {
    const r = currentUser.value.role
    return r === 'Administrador' || r === 'ADMIN'
  },

  /**
   * Verifica se a sessão atual possui uma permissão específica.
   */
  can(permission: string): boolean {
    return checkCan(currentUser.value, permission)
  },

  /**
   * Verifica se a sessão atual possui pelo menos uma das permissões informadas.
   */
  canAny(permissions: string[]): boolean {
    return checkCanAny(currentUser.value, permissions)
  },

  /**
   * Valida permissão de acesso legada baseada em lista de papéis autorizados.
   */
  canAccess(allowedRoles?: UserRole[] | string[]): boolean {
    if (!allowedRoles || allowedRoles.length === 0) return true
    if (this.isAdmin()) return true

    const cur = currentUser.value.role
    const curKey = normalizeRoleKey(cur)

    return allowedRoles.some((r) => {
      return r === cur || normalizeRoleKey(r) === curKey
    })
  },

  /**
   * Catálogo de usuários padrão de demonstração para testes e login rápido.
   */
  getDemoUsers(): Record<string, UserSession> {
    return {
      Operador: { ...DEMO_USERS.Operador! },
      Auditor: { ...DEMO_USERS.Auditor! },
      Analista: { ...DEMO_USERS.Analista! },
      Administrador: { ...DEMO_USERS.Administrador! },
      Gestor: { ...DEMO_USERS.Gestor! },
    }
  },

  // -------------------------------------------------------------
  // Regras de Gestão de Usuários e Permissões (RBAC)
  // -------------------------------------------------------------

  getUsers(): UserItem[] {
    const repo = roleService.getRepo() as any
    return repo.users
  },

  async getUsersAsync(): Promise<UserItem[]> {
    return roleService.getRepo().listUsers()
  },

  getUserById(id: number): UserItem | undefined {
    return this.getUsers().find((u) => u.id === id)
  },

  async createUserAsync(dto: CreateUserDto): Promise<UserItem> {
    return roleService.getRepo().createUser(dto)
  },

  createUser(data: {
    name: string
    email: string
    role: SystemRole
    department?: string
    status?: 'Ativo' | 'Inativo'
    sodException?: boolean
    sodJustification?: string
  }): UserItem {
    const repo = roleService.getRepo() as any
    const roleDef = repo.roles.find((r: any) => r.id === data.role)
    const permissions = roleDef ? [...roleDef.permissions] : []

    const newUser: UserItem = {
      id: Date.now(),
      name: data.name.trim(),
      email: data.email.trim(),
      role: data.role,
      permissions,
      department: data.department || 'Geral',
      status: data.status || 'Ativo',
      lastLogin: 'Nunca',
      sodException: Boolean(data.sodException),
      sodJustification: data.sodJustification,
    }
    repo.users.unshift(newUser)

    repo.recordSecurityEvent({
      action: 'Criação de Conta',
      details: `Cadastrou o usuário ${newUser.name} com papel ${newUser.role}.${
        newUser.sodException ? ` Exceção SoD: "${newUser.sodJustification}"` : ''
      }`,
      severity: newUser.sodException ? 'DANGER' : 'INFO',
    })

    return newUser
  },

  async updateUserAsync(id: number, dto: UpdateUserDto): Promise<UserItem | null> {
    return roleService.getRepo().updateUser(id, dto)
  },

  updateUser(
    id: number,
    data: {
      name: string
      email: string
      role: SystemRole
      department: string
      status: 'Ativo' | 'Inativo'
      sodException?: boolean
      sodJustification?: string
    },
  ): UserItem | null {
    const users = this.getUsers()
    const idx = users.findIndex((u) => u.id === id)
    if (idx === -1) return null

    const existing = users[idx]!
    const roleChanged = existing.role !== data.role
    let permissions = [...existing.permissions]
    if (roleChanged) {
      const repo = roleService.getRepo() as any
      const roleDef = repo.roles.find((r: any) => r.id === data.role)
      permissions = roleDef ? [...roleDef.permissions] : []
    }

    users[idx] = {
      ...existing,
      name: data.name.trim(),
      email: data.email.trim(),
      role: data.role,
      permissions,
      department: data.department,
      status: data.status,
      sodException: data.sodException !== undefined ? data.sodException : existing.sodException,
      sodJustification: data.sodJustification || existing.sodJustification,
    }

    if (roleChanged) {
      const repo = roleService.getRepo() as any
      repo.recordSecurityEvent({
        action: 'Troca de Cargo',
        details: `Alterou o papel do usuário ${users[idx]!.name} de ${existing.role} para ${data.role}.`,
        severity: 'INFO',
      })
    }

    return users[idx]!
  },

  toggleUserStatus(id: number): UserItem | null {
    const user = this.getUserById(id)
    if (!user) return null

    // Trava de Auto-Exclusão / Auto-Inativação (Tarefa 8)
    if (currentUser.value.email && user.email.toLowerCase() === currentUser.value.email.toLowerCase()) {
      throw new Error('Você não pode inativar seu próprio acesso de Administrador.')
    }

    user.status = user.status === 'Ativo' ? 'Inativo' : 'Ativo'

    const repo = roleService.getRepo() as any
    repo.recordSecurityEvent({
      action: user.status === 'Ativo' ? 'Ativação de Conta' : 'Inativação de Conta',
      details: `${user.status === 'Ativo' ? 'Ativou' : 'Inativou'} o acesso do usuário ${user.name}.`,
      severity: user.status === 'Inativo' ? 'WARNING' : 'INFO',
    })

    return user
  },

  updateUserPermissions(id: number, permissions: string[]): UserItem | null {
    const user = this.getUserById(id)
    if (!user) return null
    user.permissions = [...permissions]

    const repo = roleService.getRepo() as any
    if (typeof repo.persist === 'function') repo.persist()

    if (currentUser.value.id === id) {
      currentUser.value.permissions = [...permissions]
      authStorage.updateSessionPermissions(permissions)
    }

    return user
  },

  resetPermissionsToRole(id: number): string[] {
    const user = this.getUserById(id)
    if (!user) return []
    const repo = roleService.getRepo() as any
    const roleDef = repo.roles.find((r: any) => r.id === user.role)
    const defaults = roleDef?.permissions || []
    user.permissions = [...defaults]

    if (typeof repo.persist === 'function') repo.persist()

    if (currentUser.value.id === id) {
      currentUser.value.permissions = [...defaults]
      authStorage.updateSessionPermissions(defaults)
    }

    return user.permissions
  },

  getAllPermissions(): PermissionDefinition[] {
    return ALL_PERMISSIONS
  },

  getAvailableRoles(): RoleOption[] {
    return MOCK_AVAILABLE_ROLES
  },

  getRoleDefaultPermissions(role: SystemRole): string[] {
    const repo = roleService.getRepo() as any
    const found = repo.roles.find((r: any) => r.id === role)
    if (found) return found.permissions
    return (ROLE_DEFAULT_PERMISSIONS as Record<string, string[]>)[role] || []
  },

  // -------------------------------------------------------------
  // Trilha de Auditoria de Segurança
  // -------------------------------------------------------------

  async getSecurityEvents(): Promise<SecurityEvent[]> {
    return roleService.getRepo().listSecurityEvents()
  },

  async recordSecurityEvent(dto: RecordSecurityEventDto): Promise<SecurityEvent> {
    return roleService.getRepo().recordSecurityEvent({
      ...dto,
      actorEmail: dto.actorEmail || currentUser.value.email,
      actorName: dto.actorName || currentUser.value.name,
    })
  },
}
