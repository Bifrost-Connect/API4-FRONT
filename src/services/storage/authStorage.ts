/**
 * Camada de armazenamento e persistência de credenciais, tokens JWT e sessão de autenticação.
 * Opera sobre o localStorage com TTL padrão de 8 horas e suporte a sincronização entre abas.
 */

export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'api4_access_token',
  REFRESH_TOKEN: 'api4_refresh_token',
  AUTH_SESSION: 'api4_auth_session',
  LEGACY_DEMO_ROLE: 'api4-demo-role',
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
  isSimulated: boolean
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
 * Codifica objeto em formato Base64Url simulando um token JWT estruturado.
 */
function base64UrlEncode(str: string): string {
  try {
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    }
  } catch {
    // Fallback manual simples
  }
  return Buffer.from(str, 'utf-8').toString('base64url')
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
   * Mantém também a chave legada 'api4-demo-role' sincronizada para compatibilidade.
   */
  saveSession(session: StoredAuthSession, tokens?: Partial<TokenPair>): void {
    const now = Date.now()
    const sessionWithTtl: StoredAuthSession = {
      ...session,
      loggedAt: session.loggedAt || now,
      expiresAt: session.expiresAt || now + DEFAULT_SESSION_TTL_MS,
    }

    safeStorage.setItem(AUTH_STORAGE_KEYS.AUTH_SESSION, JSON.stringify(sessionWithTtl))

    // Gera token simulado caso não seja passado um par real
    const accessToken =
      tokens?.accessToken ||
      this.generateMockJwt({
        sub: sessionWithTtl.userId,
        email: sessionWithTtl.email,
        roleId: sessionWithTtl.roleId,
        exp: Math.floor(sessionWithTtl.expiresAt / 1000),
      })

    const refreshToken = tokens?.refreshToken || `refresh_${sessionWithTtl.userId}_${Date.now()}`

    safeStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, accessToken)
    safeStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken)

    // Sincroniza chave legada para compatibilidade com asserções de testes existentes
    safeStorage.setItem(AUTH_STORAGE_KEYS.LEGACY_DEMO_ROLE, sessionWithTtl.role)
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
    if (role) {
      safeStorage.setItem(AUTH_STORAGE_KEYS.LEGACY_DEMO_ROLE, role)
    }
  },

  /**
   * Limpa integralmente as credenciais e tokens da sessão.
   */
  clearSession(): void {
    safeStorage.removeItem(AUTH_STORAGE_KEYS.AUTH_SESSION)
    safeStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
    safeStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN)
    safeStorage.removeItem(AUTH_STORAGE_KEYS.LEGACY_DEMO_ROLE)
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
        event.key === AUTH_STORAGE_KEYS.ACCESS_TOKEN ||
        event.key === AUTH_STORAGE_KEYS.LEGACY_DEMO_ROLE
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
