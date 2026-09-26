import { mockCurrentUser } from './mocks/user.mock'

export const userService = {
  getCurrentUser() {
    // No futuro, isso pode buscar do localStorage, de um contexto de autenticação ou da API
    return mockCurrentUser
  }
}
