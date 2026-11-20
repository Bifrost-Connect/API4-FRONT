import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  authStorage,
  AUTH_STORAGE_KEYS,
  DEFAULT_SESSION_TTL_MS,
  type StoredAuthSession,
} from '../storage/authStorage'
import api from '../api'

const storageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
})
Object.defineProperty(globalThis, 'sessionStorage', {
  value: storageMock,
  writable: true,
})

describe('Camada de Armazenamento de Autenticação e Sessão (authStorage)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('Ciclo de Vida da Sessão e Expiração (TTL)', () => {
    it('salva a sessão ativa e tokens gerando TTL de 8 horas por padrão', () => {
      const now = 1700000000000
      vi.spyOn(Date, 'now').mockReturnValue(now)

      const session: StoredAuthSession = {
        userId: 1,
        name: 'Carlos Mendes',
        email: 'admin@georural.com.br',
        role: 'Administrador',
        roleId: 'ADMIN',
        permissions: ['USUARIOS:VISUALIZAR', 'ROLES:VISUALIZAR'],
        loggedAt: now,
        expiresAt: now + DEFAULT_SESSION_TTL_MS,
      }

      authStorage.saveSession(session, {
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
      })

      const storedRaw = localStorage.getItem(AUTH_STORAGE_KEYS.AUTH_SESSION)
      expect(storedRaw).toBeTruthy()

      const parsed = JSON.parse(storedRaw!)
      expect(parsed.email).toBe('admin@georural.com.br')
      expect(parsed.expiresAt).toBe(now + 8 * 3600 * 1000)

      expect(localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN)).toBe('jwt-access-token')
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN)).toBe('jwt-refresh-token')
    })

    it('recupera a sessão íntegra quando o tempo limite não foi atingido', () => {
      const now = 1700000000000
      vi.spyOn(Date, 'now').mockReturnValue(now)

      const session: StoredAuthSession = {
        userId: 2,
        name: 'Mariana Duarte',
        email: 'analista@georural.com.br',
        role: 'Analista',
        roleId: 'ANALISTA',
        permissions: ['MAPA:VISUALIZAR'],
        loggedAt: now,
        expiresAt: now + 3600 * 1000,
      }

      authStorage.saveSession(session, { accessToken: 'jwt-valid-token' })
      const retrieved = authStorage.getSession()

      expect(retrieved).not.toBeNull()
      expect(retrieved?.email).toBe('analista@georural.com.br')
      expect(retrieved?.roleId).toBe('ANALISTA')
      expect(authStorage.getAccessToken()).toBe('jwt-valid-token')
    })

    it('identifica e descarta automaticamente a sessão quando expirada', () => {
      const loginTime = 1700000000000
      vi.spyOn(Date, 'now').mockReturnValue(loginTime)

      const session: StoredAuthSession = {
        userId: 3,
        name: 'João Silva',
        email: 'operador@georural.com.br',
        role: 'Operador',
        roleId: 'OPERADOR_DADOS',
        permissions: ['INGESTAO:UPLOAD'],
        loggedAt: loginTime,
        expiresAt: loginTime + 1000, // 1 segundo
      }

      authStorage.saveSession(session, { accessToken: 'jwt-short-lived' })

      // Simula passagem de tempo (2 segundos depois)
      vi.spyOn(Date, 'now').mockReturnValue(loginTime + 2000)

      const retrieved = authStorage.getSession()
      expect(retrieved).toBeNull()
      expect(authStorage.getAccessToken()).toBeNull()
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.AUTH_SESSION)).toBeNull()
    })

    it('atualiza as permissões da sessão sem alterar tokens ou horário de login', () => {
      const now = 1700000000000
      vi.spyOn(Date, 'now').mockReturnValue(now)

      const session: StoredAuthSession = {
        userId: 4,
        name: 'Daniel Natan',
        email: 'auditor@georural.com.br',
        role: 'Auditor',
        roleId: 'AUDITOR',
        permissions: ['AUDITORIA:VISUALIZAR'],
        loggedAt: now,
        expiresAt: now + DEFAULT_SESSION_TTL_MS,
      }

      authStorage.saveSession(session, { accessToken: 'jwt-auditor-token' })
      const tokenBefore = authStorage.getAccessToken()

      authStorage.updateSessionPermissions(
        ['AUDITORIA:VISUALIZAR', 'AUDITORIA:RASTREAR_ORIGEM'],
        'Auditor',
        'AUDITOR',
      )

      const updated = authStorage.getSession()
      expect(updated?.permissions).toEqual(['AUDITORIA:VISUALIZAR', 'AUDITORIA:RASTREAR_ORIGEM'])
      expect(authStorage.getAccessToken()).toBe(tokenBefore)
    })
  })

  describe('Integração com Tokens JWT e Axios', () => {
    it('injeta automaticamente o header Authorization com Bearer token no Axios sempre que presente', async () => {
      const session: StoredAuthSession = {
        userId: 1,
        name: 'Carlos Mendes',
        email: 'admin@georural.com.br',
        role: 'Administrador',
        roleId: 'ADMIN',
        permissions: ['USUARIOS:VISUALIZAR'],
        loggedAt: Date.now(),
        expiresAt: Date.now() + DEFAULT_SESSION_TTL_MS,
      }

      authStorage.saveSession(session, { accessToken: 'token_teste_bearer_123' })

      const interceptors = (api.interceptors.request as any).handlers
      const requestHandler = interceptors[interceptors.length - 1].fulfilled

      const config = { headers: {} as Record<string, string> }
      const updatedConfig = await requestHandler(config)

      expect(updatedConfig.headers.Authorization).toBe('Bearer token_teste_bearer_123')
    })

    it('limpa a sessão e credenciais quando a resposta da API retornar 401 Unauthorized', async () => {
      const session: StoredAuthSession = {
        userId: 1,
        name: 'Carlos Mendes',
        email: 'admin@georural.com.br',
        role: 'Administrador',
        roleId: 'ADMIN',
        permissions: ['USUARIOS:VISUALIZAR'],
        loggedAt: Date.now(),
        expiresAt: Date.now() + DEFAULT_SESSION_TTL_MS,
      }

      authStorage.saveSession(session, { accessToken: 'token_teste_bearer_123' })
      expect(authStorage.getSession()).toBeTruthy()

      const interceptors = (api.interceptors.response as any).handlers
      const responseErrorHandler = interceptors[interceptors.length - 1].rejected

      const unauthorizedError = {
        config: { url: '/processos' },
        response: { status: 401, data: { message: 'Token expirado' } },
      }

      await expect(responseErrorHandler(unauthorizedError)).rejects.toEqual(unauthorizedError)
      expect(authStorage.getSession()).toBeNull()
      expect(authStorage.getAccessToken()).toBeNull()
    })

    it('não limpa sessão nem redireciona quando 401 ocorre no próprio endpoint /auth/login', async () => {
      const session: StoredAuthSession = {
        userId: 1,
        name: 'Carlos Mendes',
        email: 'admin@georural.com.br',
        role: 'Administrador',
        roleId: 'ADMIN',
        permissions: ['USUARIOS:VISUALIZAR'],
        loggedAt: Date.now(),
        expiresAt: Date.now() + DEFAULT_SESSION_TTL_MS,
      }

      authStorage.saveSession(session, { accessToken: 'token_existente' })

      const interceptors = (api.interceptors.response as any).handlers
      const responseErrorHandler = interceptors[interceptors.length - 1].rejected

      const loginUnauthorizedError = {
        config: { url: '/auth/login' },
        response: { status: 401, data: { erro: 'Credenciais inválidas' } },
      }

      await expect(responseErrorHandler(loginUnauthorizedError)).rejects.toEqual(loginUnauthorizedError)
      expect(authStorage.getSession()).toBeTruthy()
    })
  })
})
