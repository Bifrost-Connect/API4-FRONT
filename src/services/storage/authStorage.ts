/**
 * Camada de armazenamento e persistência de credenciais, tokens JWT e sessão de autenticação.
 * Opera sobre o localStorage com TTL padrão de 8 horas e suporte a sincronização entre abas.
 */

export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'api4_access_token',
  REFRESH_TOKEN: 'api4_refresh_token',
  AUTH_SESSION: 'api4_auth_session',
} as const

export const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 horas

export interface StoredAuthSession {
  userId: number | string
  name: string
  email: string
  role: string
  roleId: string
  permissions: string[]
  loggedAt: number
  expiresAt: number
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key)
      }
    } catch {
      // Fallback silencioso em ambientes sem storage
    }
    return null
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value)
      }
    } catch {
      // Fallback silencioso
    }
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key)
      }
    } catch {
      // Fallback silencioso
    }
  },
}

/**
 * Codifica string UTF-8 em formato Base64Url sem depender de APIs Node-only (Buffer).
 */
function base64UrlEncode(str: string): string {
  if (typeof TextEncoder !== 'undefined' && typeof btoa !== 'undefined') {
    const bytes = new TextEncoder().encode(str)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!)
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Decodifica string Base64Url para UTF-8 usando atob + Uint8Array/TextDecoder.
 */
export function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes)
  }
  return decodeURIComponent(escape(binary))
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2 || !parts[1]) return null
    return JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>
  } catch {
    return null
  }
}

export const authStorage = {
  /**
   * Gera um token JWT simulado no padrão header.payload.signature para testes e demonstrações.
   */
  generateMockJwt(payload: { sub: string | number; email: string; roleId: string; exp?: number }): string {
    const header = { alg: 'HS256', typ: 'JWT' }
    const nowSec = Math.floor(Date.now() / 1000)
    const fullPayload = {
      ...payload,
      iat: nowSec,
      exp: payload.exp || nowSec + 8 * 3600,
      iss: 'api4-georural-auth',
    }

    const encodedHeader = base64UrlEncode(JSON.stringify(header))
    const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))
    const mockSignature = base64UrlEncode(`mock_sig_${payload.sub}_${Date.now()}`)

    return `${encodedHeader}.${encodedPayload}.${mockSignature}`
  },

  /**
   * Salva a sessão ativa e os tokens associados.
   */
  saveSession(session: StoredAuthSession, tokens?: Partial<TokenPair>): void {
    const now = Date.now()
    const sessionWithTtl: StoredAuthSession = {
      ...session,
      loggedAt: session.loggedAt || now,
      expiresAt: session.expiresAt || now + DEFAULT_SESSION_TTL_MS,
    }

    safeStorage.setItem(AUTH_STORAGE_KEYS.AUTH_SESSION, JSON.stringify(sessionWithTtl))

    if (tokens?.accessToken) {
      safeStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken)
    }

    if (tokens?.refreshToken) {
      safeStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken)
    }
  },

  /**
   * Recupera a sessão ativa do armazenamento.
   * Caso a sessão esteja expirada, limpa automaticamente os dados e retorna null.
   */
  getSession(): StoredAuthSession | null {
    const raw = safeStorage.getItem(AUTH_STORAGE_KEYS.AUTH_SESSION)
    if (!raw) return null

    try {
      const session: StoredAuthSession = JSON.parse(raw)
      if (this.isSessionExpired(session)) {
        this.clearSession()
        return null
      }
      return session
    } catch {
      this.clearSession()
      return null
    }
  },

  /**
   * Obtém o token de acesso (Bearer token).
   */
  getAccessToken(): string | null {
    const session = this.getSession()
    if (!session) return null
    return safeStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
  },

  /**
   * Obtém o token de renovação.
   */
  getRefreshToken(): string | null {
    const session = this.getSession()
    if (!session) return null
    return safeStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN)
  },

  /**
   * Verifica se uma sessão atingiu o tempo limite (TTL).
   */
  isSessionExpired(session?: StoredAuthSession | null): boolean {
    if (!session || !session.expiresAt) return true
    return Date.now() >= session.expiresAt
  },

  /**
   * Atualiza as permissões da sessão em armazenamento sem alterar tokens ou prazos.
   */
  updateSessionPermissions(permissions: string[], role?: string, roleId?: string): void {
    const current = this.getSession()
    if (!current) return

    const updated: StoredAuthSession = {
      ...current,
      permissions: [...permissions],
      role: role || current.role,
      roleId: roleId || current.roleId,
    }

    safeStorage.setItem(AUTH_STORAGE_KEYS.AUTH_SESSION, JSON.stringify(updated))
  },

  /**
   * Limpa integralmente as credenciais e tokens da sessão.
   */
  clearSession(): void {
    safeStorage.removeItem(AUTH_STORAGE_KEYS.AUTH_SESSION)
    safeStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
    safeStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN)
  },

  /**
   * Escuta mudanças disparadas por outras abas do navegador via evento 'storage'.
   */
  subscribeToStorageChanges(callback: (newSession: StoredAuthSession | null) => void): () => void {
    if (typeof window === 'undefined' || !window.addEventListener) {
      return () => {}
    }

    const handler = (event: StorageEvent) => {
      if (
        event.key === AUTH_STORAGE_KEYS.AUTH_SESSION ||
        event.key === AUTH_STORAGE_KEYS.ACCESS_TOKEN
      ) {
        callback(this.getSession())
      }
    }

    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('storage', handler)
    }
  },
}
