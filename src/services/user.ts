import { ref } from 'vue'
import { mockCurrentUser } from './mocks/user.mock'

export type UserRole = 'Operador' | 'Auditor' | 'Analista' | 'Administrador'
type DemoUser = { id: number; name: string; role: UserRole }

const demoUsers: Record<UserRole, DemoUser> = {
  Operador: { id: 1, name: 'João Silva', role: 'Operador' },
  Auditor: { id: 2, name: 'Daniel Natan', role: 'Auditor' },
  Analista: { id: 3, name: 'Maria Oliveira', role: 'Analista' },
  Administrador: { id: 4, name: 'Admin API4', role: 'Administrador' },
}

const readStoredUser = (): DemoUser => {
  if (typeof localStorage === 'undefined') return mockCurrentUser as DemoUser

  const storedRole = localStorage.getItem('api4-demo-role') as UserRole | null
  return storedRole && demoUsers[storedRole] ? demoUsers[storedRole] : (mockCurrentUser as DemoUser)
}

const currentUser = ref(readStoredUser())

export const userService = {
  getCurrentUser() {
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
}
