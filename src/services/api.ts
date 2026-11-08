/**
 * Configuração de cliente HTTP (Axios) para comunicação com a API REST.
 * Integração automática com authStorage para injeção do header Authorization: Bearer
 * e tratamento global de expiração de token (401 Unauthorized).
 */
import axios from 'axios'
import { authStorage } from './storage/authStorage'

// Flag legada mantida como false para compatibilidade com asserções de testes existentes.
export const mockactive = false

/**
 * Resolve dinamicamente a URL base da API.
 * Prioriza a injeção em tempo de execução via window.__ENV__ (carregada do .env pelo executável),
 * com fallback para import.meta.env em tempo de build/desenvolvimento.
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const runtimeUrl = (window as any).__ENV__?.VITE_API_BASE_URL || (window as any).__ENV__?.API_BASE_URL
    if (runtimeUrl && typeof runtimeUrl === 'string' && runtimeUrl.trim() !== '') {
      return runtimeUrl.trim()
    }
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
}

const api = axios.create({
  baseURL: getApiBaseUrl().replace(/\/+$/, '') + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request Interceptor: Atualiza baseURL dinâmica e injeta token de autenticação
api.interceptors.request.use((config) => {
  try {
    const currentBase = getApiBaseUrl().replace(/\/+$/, '')
    config.baseURL = currentBase + '/api'
    api.defaults.baseURL = currentBase + '/api'
  } catch {
    // Fallback silencioso
  }

  // Anexa o token de acesso (Bearer token) apenas para sessões reais não-simuladas
  // Evita que o backend real rejeite requisições com 401 por assinatura inválida de mock token
  try {
    const session = authStorage.getSession()
    const token = authStorage.getAccessToken()
    if (token && session && !session.isSimulated && config.headers && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // Fallback silencioso
  }

  return config
})

// Response Interceptor: Trata erro 401 Unauthorized com limpeza de credenciais e redirecionamento
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const session = authStorage.getSession()

      // Se a sessão for simulada, não desloga o usuário local por 401 da API remota
      if (session?.isSimulated) {
        return Promise.reject(error)
      }

      authStorage.clearSession()

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('api4:unauthorized', { detail: error }))

        const rawBase = import.meta.env?.BASE_URL || '/'
        const baseUrl = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase
        const currentPath = window.location.pathname

        // Remove o baseUrl do início para salvar apenas o caminho relativo interno do Vue Router
        const cleanPath =
          baseUrl && currentPath.startsWith(baseUrl)
            ? currentPath.slice(baseUrl.length) || '/'
            : currentPath

        if (cleanPath !== '/login' && !cleanPath.includes('/login')) {
          const redirect = encodeURIComponent(cleanPath + window.location.search)
          window.location.href = `${baseUrl}/login?redirect=${redirect}`
        }
      }
    }

    return Promise.reject(error)
  },
)

export default api
