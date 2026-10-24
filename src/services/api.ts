import axios from 'axios'
import { userService } from './user'

export const mockactive = false // Quando false, desativa todos os mocks, exibe o erro real da API e deixa vazio se o banco não retornar dados. Só usa mock se mockactive === true.

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080') + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Adiciona credenciais Basic Auth de acordo com o perfil autenticado no sistema
api.interceptors.request.use((config) => {
  try {
    const user = userService.getCurrentUser()
    const roleCredentials: Record<string, string> = {
      Operador: 'operador:Troca123',
      Auditor: 'auditor:Troca123',
      Analista: 'analista:Troca123',
      Administrador: 'admin:Troca123',
    }
    const cred = roleCredentials[user?.role] || 'admin:Troca123'
    if (typeof btoa === 'function') {
      config.headers.Authorization = `Basic ${btoa(cred)}`
    }
  } catch {
    // Fallback silencioso caso userService não esteja disponível
  }
  return config
})

export default api
