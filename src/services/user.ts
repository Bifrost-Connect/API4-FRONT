/**
 * Serviço de Gerenciamento do Usuário, Sessão JWT e Controle de Acessos (RBAC).
 * Centraliza as regras de negócio de usuários, papéis e permissões do GeoRural.
 */

import { ref } from 'vue'
import {
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  DuplicateEmailError,
  type UserItem,
  type SystemRole,
  type StandardRole,
  type RoleDef,
  type PermissionDefinition,
  type RoleOption,
  type SecurityEvent,
  type UserSession,
} from '@/types/access'
import { roleService } from './roles'
import {
  can as checkCan,
  canAny as checkCanAny,
  normalizeRoleKey,
} from '@/utils/rbac'
import type {
  CreateUserDto,
  UpdateUserDto,
  RecordSecurityEventDto,
  UserListFilters,
  SecurityEventFilters,
  PaginatedResult,
} from './access/AccessRepository'
import {
  authStorage,
  DEFAULT_SESSION_TTL_MS,
  type StoredAuthSession,
  type TokenPair,
} from './storage/authStorage'
import { geojsonCache } from './storage/geojsonCache'
import { uiPreferencesStorage } from './storage/uiPreferencesStorage'
import api from './api'
import {
  mapBackendPermissionsToFront,
  mapBackendRoleToFront,
  mapCustomUserPermissionsToFront,
} from '@/utils/rbacAdapter'

export { DuplicateEmailError }
export type { UserItem, SystemRole, StandardRole, RoleDef, PermissionDefinition, RoleOption, SecurityEvent, UserSession }
export type UserRole = 'Operador' | 'Auditor' | 'Analista' | 'Administrador' | 'Gestor' | 'Integrador' | string

const defaultSession: UserSession = {
  id: undefined,
  name: '',
  email: '',
  role: '',
  roleId: '',
  permissions: [],
}

function normalizeSessionId(userId: number | string | undefined): number | undefined {
  if (typeof userId === 'number' && Number.isFinite(userId)) return userId
  if (typeof userId === 'string') {
    const parsed = Number(userId)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function resolveInitialSession(): UserSession {
  const stored = authStorage.getSession()
  const token = authStorage.getAccessToken()
  if (stored && token && !authStorage.isSessionExpired(stored)) {
    return {
      id: normalizeSessionId(stored.userId),
      name: stored.name,
      email: stored.email,
      role: stored.role,
      roleId: stored.roleId,
      permissions: [...stored.permissions],
      token,
    }
  }

  return {
    ...defaultSession,
    permissions: [],
  }
}

const currentUser = ref<UserSession>(resolveInitialSession())

if (typeof window !== 'undefined') {
  authStorage.subscribeToStorageChanges((newSession) => {
    const token = authStorage.getAccessToken()
    if (newSession && token && !authStorage.isSessionExpired(newSession)) {
      currentUser.value = {
        id: normalizeSessionId(newSession.userId),
        name: newSession.name,
        email: newSession.email,
        role: newSession.role,
        roleId: newSession.roleId,
        permissions: [...newSession.permissions],
        token,
      }
    } else {
      currentUser.value = {
        ...defaultSession,
        permissions: [],
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
   * Indica se existe uma sessão JWT válida e não expirada.
   */
  isAuthenticated(): boolean {
    const session = authStorage.getSession()
    const token = authStorage.getAccessToken()
    return Boolean(session && token && !authStorage.isSessionExpired(session))
  },

  /**
   * Autentica o usuário no endpoint real POST /auth/login e persiste a sessão JWT.
   */
  async loginWithCredentials(email: string, senha: string): Promise<UserSession> {
    interface LoginResponse {
      token: string
      tipo?: string
      expira_em?: string
      usuario: {
        id: number
        nome: string
        email: string
        perfil: string
        permissoes: string[]
        permissoes_customizadas?: string[] | null
      }
    }

    const res = await api.post<LoginResponse>('/auth/login', {
      email: email.trim(),
      senha,
    })

    const { token, expira_em, usuario } = res.data
    const frontRole = mapBackendRoleToFront(usuario.perfil)
    const frontPerms = Array.isArray(usuario.permissoes_customizadas)
      ? mapCustomUserPermissionsToFront(usuario.permissoes_customizadas, usuario.perfil)
      : mapBackendPermissionsToFront(usuario.permissoes, usuario.perfil)
    const parsedExp = expira_em ? Date.parse(expira_em) : Number.NaN
    const expiresAt = Number.isFinite(parsedExp) ? parsedExp : Date.now() + DEFAULT_SESSION_TTL_MS

    const session: UserSession = {
      id: usuario.id,
      name: usuario.nome,
      email: usuario.email,
      role: frontRole,
      roleId: frontRole,
      permissions: frontPerms,
      token,
    }

    currentUser.value = session

    const storedSession: StoredAuthSession = {
      userId: usuario.id,
      name: usuario.nome,
      email: usuario.email,
      role: frontRole,
      roleId: frontRole,
      permissions: [...frontPerms],
      loggedAt: Date.now(),
      expiresAt,
    }

    authStorage.saveSession(storedSession, { accessToken: token })
    return session
  },

  /**
   * Atualiza os dados da sessão reativa e sincroniza authStorage quando um token é fornecido.
   */
  setCurrentUser(user: UserSession, tokens?: Partial<TokenPair>) {
    const accessToken = tokens?.accessToken ?? user.token
    currentUser.value = {
      ...user,
      permissions: Array.isArray(user.permissions) ? [...user.permissions] : [],
      token: accessToken,
    }

    if (accessToken) {
      authStorage.saveSession(
        {
          userId: user.id ?? 0,
          name: user.name,
          email: user.email || '',
          role: user.role,
          roleId: user.roleId || normalizeRoleKey(user.role),
          permissions: [...currentUser.value.permissions],
          loggedAt: Date.now(),
          expiresAt: tokens?.expiresAt || Date.now() + DEFAULT_SESSION_TTL_MS,
        },
        {
          accessToken,
          refreshToken: tokens?.refreshToken,
        },
      )
    }
  },

  /**
   * Limpa a sessão para o estado não autenticado.
   */
  clearCurrentUser() {
    currentUser.value = {
      ...defaultSession,
      permissions: [],
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
    return normalizeRoleKey(currentUser.value.role) === 'ADMIN'
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
   * Valida permissão de acesso baseada em lista de papéis autorizados.
   */
  canAccess(allowedRoles?: UserRole[] | string[]): boolean {
    if (!allowedRoles || allowedRoles.length === 0) return true
    if (this.isAdmin()) return true

    const cur = currentUser.value.role
    if (!cur) return false
    const curKey = normalizeRoleKey(cur)

    return allowedRoles.some((r) => {
      return r === cur || normalizeRoleKey(r) === curKey
    })
  },

  // -------------------------------------------------------------
  // Regras de Gestão de Usuários e Permissões (RBAC)
  // -------------------------------------------------------------

  async getUsersAsync(filters?: UserListFilters): Promise<UserItem[]> {
    return roleService.getRepo().listUsers(filters)
  },

  async createUserAsync(dto: CreateUserDto): Promise<UserItem> {
    return roleService.getRepo().createUser(dto)
  },

  async updateUserAsync(id: number, dto: UpdateUserDto): Promise<UserItem | null> {
    return roleService.getRepo().updateUser(id, dto)
  },

  async toggleUserStatusAsync(id: number, currentStatus?: 'Ativo' | 'Inativo', userEmail?: string): Promise<UserItem | null> {
    if (
      userEmail &&
      currentUser.value.email &&
      userEmail.toLowerCase() === currentUser.value.email.toLowerCase()
    ) {
      throw new Error('Você não pode inativar seu próprio acesso de Administrador.')
    }
    const targetAtivo = currentStatus ? currentStatus !== 'Ativo' : undefined
    return roleService.getRepo().toggleUserStatus(id, targetAtivo)
  },

  async resetPasswordAsync(id: number, novaSenha: string): Promise<void> {
    return roleService.getRepo().resetPassword(id, novaSenha)
  },

  async updateUserPermissionsAsync(
    id: number,
    permissions: string[],
    sod?: { sodException?: boolean; sodJustification?: string },
  ): Promise<UserItem | null> {
    const updated = await roleService.getRepo().updateUserPermissions(id, permissions, sod)
    if (updated && currentUser.value.id === id) {
      currentUser.value.permissions = [...updated.permissions]
      authStorage.updateSessionPermissions(updated.permissions)
    }
    return updated
  },

  async resetPermissionsToRoleAsync(id: number): Promise<string[]> {
    const defaults = await roleService.getRepo().resetUserPermissions(id)
    if (currentUser.value.id === id) {
      currentUser.value.permissions = [...defaults]
      authStorage.updateSessionPermissions(defaults)
    }
    return defaults
  },

  getAllPermissions(): PermissionDefinition[] {
    return ALL_PERMISSIONS
  },

  getRoleDefaultPermissions(role: SystemRole): string[] {
    return (ROLE_DEFAULT_PERMISSIONS as Record<string, string[]>)[role] || []
  },

  // -------------------------------------------------------------
  // Trilha de Auditoria de Segurança
  // -------------------------------------------------------------

  async getSecurityEvents(filters?: SecurityEventFilters): Promise<SecurityEvent[]> {
    return roleService.getRepo().listSecurityEvents(filters)
  },

  async getSecurityEventsPagedAsync(
    filters?: SecurityEventFilters,
  ): Promise<PaginatedResult<SecurityEvent>> {
    return roleService.getRepo().listSecurityEventsPaged(filters)
  },

  async recordSecurityEvent(dto: RecordSecurityEventDto): Promise<SecurityEvent> {
    return roleService.getRepo().recordSecurityEvent({
      ...dto,
      actorEmail: dto.actorEmail || currentUser.value.email,
      actorName: dto.actorName || currentUser.value.name,
    })
  },
}
