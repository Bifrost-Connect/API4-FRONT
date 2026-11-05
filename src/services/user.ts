/**
 * Serviço de Gerenciamento do Usuário e Sessão de Acesso.
 * Estrutura neutra para futura integração com autenticação real do backend.
 */
import { ref } from 'vue'

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
   * Enquanto a autenticação real está sendo integrada, libera as ações no sistema.
   */
  canAccess(_allowedRoles?: UserRole[] | string[]): boolean {
    return true
  },
}
