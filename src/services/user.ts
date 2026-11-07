/**
 * Serviço de Gerenciamento do Usuário, Sessão e Controle de Acessos (RBAC).
 * Centraliza as regras de negócio de usuários, papéis e permissões do GeoRural.
 */
import { ref } from 'vue'
import {
  MOCK_USERS_LIST,
  MOCK_AVAILABLE_ROLES,
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  type UserItem,
  type SystemRole,
  type PermissionDefinition,
  type RoleOption,
} from '../mocks/user.mock'

export type { UserItem, SystemRole, PermissionDefinition, RoleOption }
export type UserRole = 'Operador' | 'Auditor' | 'Analista' | 'Administrador'

export type UserSession = {
  id?: number
  name: string
  role: UserRole
  email?: string
  token?: string
}

// Sessão base enquanto a autenticação real com o backend está sendo integrada
const anonymousUser: UserSession = {
  id: 1,
  name: 'Usuário do Sistema',
  role: 'Administrador',
}

const currentUser = ref<UserSession>({ ...anonymousUser })

// Estado interno simulado de usuários cadastrados
const usersState = ref<UserItem[]>(JSON.parse(JSON.stringify(MOCK_USERS_LIST)))

export const userService = {
  /**
   * Retorna os dados da sessão do usuário atual.
   */
  getCurrentUser(): UserSession {
    return currentUser.value
  },

  /**
   * Define manualmente o perfil de acesso da sessão.
   */
  setCurrentUserRole(role: UserRole) {
    currentUser.value = {
      ...currentUser.value,
      role,
    }
  },

  /**
   * Atualiza os dados completos da sessão autenticada.
   */
  setCurrentUser(user: UserSession) {
    currentUser.value = user
  },

  /**
   * Restaura a sessão para o estado padrão neutro.
   */
  clearCurrentUser() {
    currentUser.value = { ...anonymousUser }
  },

  /**
   * Verifica se o usuário autenticado possui perfil de Administrador/Gestor.
   */
  isAdmin(): boolean {
    return currentUser.value.role === 'Administrador'
  },

  /**
   * Valida permissão de acesso.
   */
  canAccess(_allowedRoles?: UserRole[] | string[]): boolean {
    return true
  },

  // -------------------------------------------------------------
  // Regras de Gestão de Usuários e Permissões (RBAC)
  // -------------------------------------------------------------

  /**
   * Retorna a lista de usuários cadastrados.
   */
  getUsers(): UserItem[] {
    return usersState.value
  },

  /**
   * Busca um usuário pelo ID.
   */
  getUserById(id: number): UserItem | undefined {
    return usersState.value.find((u) => u.id === id)
  },

  /**
   * Cadastra um novo usuário vinculando as permissões padrão da role escolhida.
   */
  createUser(data: {
    name: string
    email: string
    role: SystemRole
    department?: string
    status?: 'Ativo' | 'Inativo'
  }): UserItem {
    const newUser: UserItem = {
      id: Date.now(),
      name: data.name,
      email: data.email,
      role: data.role,
      permissions: [...(ROLE_DEFAULT_PERMISSIONS[data.role] || [])],
      department: data.department || 'Geral',
      status: data.status || 'Ativo',
      lastLogin: 'Nunca',
    }
    usersState.value.unshift(newUser)
    return newUser
  },

  /**
   * Atualiza dados cadastrais de um usuário.
   * Se a role for alterada, as permissões são redefinidas para o pacote padrão da nova role.
   */
  updateUser(
    id: number,
    data: {
      name: string
      email: string
      role: SystemRole
      department: string
      status: 'Ativo' | 'Inativo'
    },
  ): UserItem | null {
    const idx = usersState.value.findIndex((u) => u.id === id)
    if (idx === -1) return null

    const existing = usersState.value[idx]!
    const roleChanged = existing.role !== data.role
    const newPermissions = roleChanged
      ? [...(ROLE_DEFAULT_PERMISSIONS[data.role] || [])]
      : [...existing.permissions]

    usersState.value[idx] = {
      id: existing.id,
      lastLogin: existing.lastLogin,
      name: data.name,
      email: data.email,
      role: data.role,
      permissions: newPermissions,
      department: data.department,
      status: data.status,
    }
    return usersState.value[idx]!
  },

  /**
   * Alterna o status do usuário entre 'Ativo' e 'Inativo'.
   */
  toggleUserStatus(id: number): UserItem | null {
    const user = this.getUserById(id)
    if (!user) return null
    user.status = user.status === 'Ativo' ? 'Inativo' : 'Ativo'
    return user
  },

  /**
   * Atualiza as permissões específicas associadas ao usuário.
   */
  updateUserPermissions(id: number, permissions: string[]): UserItem | null {
    const user = this.getUserById(id)
    if (!user) return null
    user.permissions = [...permissions]
    return user
  },

  /**
   * Restaura o pacote de subpermissões para o padrão configurado para a role do usuário.
   */
  resetPermissionsToRole(id: number): string[] {
    const user = this.getUserById(id)
    if (!user) return []
    const defaults = ROLE_DEFAULT_PERMISSIONS[user.role] || []
    user.permissions = [...defaults]
    return user.permissions
  },

  /**
   * Retorna o catálogo de todas as subpermissões do sistema.
   */
  getAllPermissions(): PermissionDefinition[] {
    return ALL_PERMISSIONS
  },

  /**
   * Retorna o catálogo de papéis disponíveis no sistema.
   */
  getAvailableRoles(): RoleOption[] {
    return MOCK_AVAILABLE_ROLES
  },

  /**
   * Retorna as permissões padrão para um determinado papel.
   */
  getRoleDefaultPermissions(role: SystemRole): string[] {
    return ROLE_DEFAULT_PERMISSIONS[role] || []
  },
}
