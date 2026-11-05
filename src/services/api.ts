/**
 * Configuração de cliente HTTP (Axios) para comunicação com a API REST.
 */
import axios from 'axios'

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

// Interceptor para manter a URL atualizada e anexar tokens/headers quando o login real for conectado
api.interceptors.request.use((config) => {
  try {
    const currentBase = getApiBaseUrl().replace(/\/+$/, '')
    config.baseURL = currentBase + '/api'
    api.defaults.baseURL = currentBase + '/api'
  } catch {
    // Fallback silencioso
  }
  return config
})

export default api
