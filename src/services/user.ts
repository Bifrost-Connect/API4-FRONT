import { ref, computed } from 'vue'
import { mockCurrentUser } from './mocks/user.mock'

export type UserRole = 'Operador' | 'Auditor' | 'Analista' | 'Administrador' | 'Gestor'
export type DemoUser = { id: number; name: string; role: UserRole }

const demoUsers: Record<UserRole, DemoUser> = {
  Operador: { id: 1, name: 'João Silva', role: 'Operador' },
  Auditor: { id: 2, name: 'Daniel Natan', role: 'Auditor' },
  Analista: { id: 3, name: 'Maria Oliveira', role: 'Analista' },
  Administrador: { id: 4, name: 'Admin API4', role: 'Administrador' },
  Gestor: { id: 5, name: 'Carlos Gestor', role: 'Gestor' },
}

const readStoredUser = (): DemoUser => {
  if (typeof localStorage === 'undefined') return mockCurrentUser as DemoUser

  const storedRole = localStorage.getItem('api4-demo-role') as UserRole | null
  return storedRole && demoUsers[storedRole] ? demoUsers[storedRole] : (mockCurrentUser as DemoUser)
}

const currentUser = ref<DemoUser>(readStoredUser())

export const userService = {
  getCurrentUser(): DemoUser {
    return currentUser.value
  },

  setCurrentUserRole(role: UserRole) {
    currentUser.value = demoUsers[role]
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('api4-demo-role', role)
    }
  },

  clearCurrentUser() {
    currentUser.value = mockCurrentUser as DemoUser
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('api4-demo-role')
    }
  },

  /**
   * Verifica se o usuário atual tem perfil de Administrador.
   */
  isAdmin(): boolean {
    return currentUser.value.role === 'Administrador'
  },

  /**
   * Verifica se o usuário atual tem perfil de Gestor.
   */
  isGestor(): boolean {
    return currentUser.value.role === 'Gestor'
  },

  /**
   * Verifica se o usuário atual possui permissão para acessar determinado recurso/rota.
   * Administrador possui acesso irrestrito a todas as funcionalidades do sistema.
   */
  canAccess(allowedRoles?: UserRole[] | string[]): boolean {
    if (this.isAdmin()) return true
    if (!allowedRoles || allowedRoles.length === 0) return true
    return (allowedRoles as string[]).includes(currentUser.value.role)
  },

  /**
   * Retorna os usuários de demonstração disponíveis para troca rápida de perfil.
   */
  getDemoUsers(): Record<UserRole, DemoUser> {
    return demoUsers
  },
}
