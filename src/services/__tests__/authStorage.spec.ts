import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  authStorage,
  AUTH_STORAGE_KEYS,
  DEFAULT_SESSION_TTL_MS,
  type StoredAuthSession,
} from '../storage/authStorage'
import { rbacStorage, CURRENT_RBAC_SEED_VERSION } from '../storage/rbacStorage'
import { MockAccessRepository } from '../access/MockAccessRepository'
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
        isSimulated: true,
      }

      authStorage.saveSession(session)

      const storedRaw = localStorage.getItem(AUTH_STORAGE_KEYS.AUTH_SESSION)
      expect(storedRaw).toBeTruthy()

      const parsed = JSON.parse(storedRaw!)
      expect(parsed.email).toBe('admin@georural.com.br')
      expect(parsed.expiresAt).toBe(now + 8 * 3600 * 1000)

      // Verifica sincronização com token e chave legada
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN)).toBeTruthy()
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN)).toBeTruthy()
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.LEGACY_DEMO_ROLE)).toBe('Administrador')
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
        isSimulated: true,
      }

      authStorage.saveSession(session)
      const retrieved = authStorage.getSession()

      expect(retrieved).not.toBeNull()
      expect(retrieved?.email).toBe('analista@georural.com.br')
      expect(retrieved?.roleId).toBe('ANALISTA')
      expect(authStorage.getAccessToken()).toBeTruthy()
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
        isSimulated: true,
      }

      authStorage.saveSession(session)

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
        isSimulated: true,
      }

      authStorage.saveSession(session)
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
    it('gera tokens simulados no formato válido header.payload.signature', () => {
      const token = authStorage.generateMockJwt({
        sub: 10,
        email: 'gestor@georural.com.br',
        roleId: 'GESTOR',
      })

      expect(typeof token).toBe('string')
      const parts = token.split('.')
      expect(parts.length).toBe(3)
    })

    it('injeta automaticamente o header Authorization com Bearer token no Axios para sessão real', async () => {
      const session: StoredAuthSession = {
        userId: 1,
        name: 'Carlos Mendes',
        email: 'admin@georural.com.br',
        role: 'Administrador',
        roleId: 'ADMIN',
        permissions: ['USUARIOS:VISUALIZAR'],
        loggedAt: Date.now(),
        expiresAt: Date.now() + DEFAULT_SESSION_TTL_MS,
        isSimulated: false,
      }

      authStorage.saveSession(session, { accessToken: 'token_teste_bearer_123' })

      // Simula execução do request interceptor
      const interceptors = (api.interceptors.request as any).handlers
      const requestHandler = interceptors[interceptors.length - 1].fulfilled

      const config = { headers: {} as Record<string, string> }
      const updatedConfig = await requestHandler(config)

      expect(updatedConfig.headers.Authorization).toBe('Bearer token_teste_bearer_123')
    })

    it('não anexa Bearer token em requisições de sessão simulada para não bloquear a API pública', async () => {
      const session: StoredAuthSession = {
        userId: 1,
        name: 'Carlos Mendes',
        email: 'admin@georural.com.br',
        role: 'Administrador',
        roleId: 'ADMIN',
        permissions: ['USUARIOS:VISUALIZAR'],
        loggedAt: Date.now(),
        expiresAt: Date.now() + DEFAULT_SESSION_TTL_MS,
        isSimulated: true,
      }

      authStorage.saveSession(session)

      const interceptors = (api.interceptors.request as any).handlers
      const requestHandler = interceptors[interceptors.length - 1].fulfilled

      const config = { headers: {} as Record<string, string> }
      const updatedConfig = await requestHandler(config)

      expect(updatedConfig.headers.Authorization).toBeUndefined()
    })

    it('limpa a sessão e credenciais quando a resposta da API retornar 401 Unauthorized para sessão real', async () => {
      const session: StoredAuthSession = {
        userId: 1,
        name: 'Carlos Mendes',
        email: 'admin@georural.com.br',
        role: 'Administrador',
        roleId: 'ADMIN',
        permissions: ['USUARIOS:VISUALIZAR'],
        loggedAt: Date.now(),
        expiresAt: Date.now() + DEFAULT_SESSION_TTL_MS,
        isSimulated: false,
      }

      authStorage.saveSession(session)
      expect(authStorage.getSession()).toBeTruthy()

      const interceptors = (api.interceptors.response as any).handlers
      const responseErrorHandler = interceptors[interceptors.length - 1].rejected

      const unauthorizedError = {
        response: { status: 401, data: { message: 'Token expirado' } },
      }

      await expect(responseErrorHandler(unauthorizedError)).rejects.toEqual(unauthorizedError)
      expect(authStorage.getSession()).toBeNull()
      expect(authStorage.getAccessToken()).toBeNull()
    })

    it('mantém a sessão ativa quando a sessão for simulada mesmo recebendo 401 da API remota', async () => {
      const session: StoredAuthSession = {
        userId: 2,
        name: 'Mariana Duarte',
        email: 'analista@georural.com.br',
        role: 'Analista',
        roleId: 'ANALISTA',
        permissions: ['MAPA:VISUALIZAR'],
        loggedAt: Date.now(),
        expiresAt: Date.now() + DEFAULT_SESSION_TTL_MS,
        isSimulated: true,
      }

      authStorage.saveSession(session)
      expect(authStorage.getSession()).toBeTruthy()

      const interceptors = (api.interceptors.response as any).handlers
      const responseErrorHandler = interceptors[interceptors.length - 1].rejected

      const unauthorizedError = {
        response: { status: 401, data: { message: 'Unauthorized' } },
      }

      await expect(responseErrorHandler(unauthorizedError)).rejects.toEqual(unauthorizedError)
      expect(authStorage.getSession()).toBeTruthy()
      expect(authStorage.getSession()?.role).toBe('Analista')
    })
  })

  describe('Persistência e Versionamento do Mock RBAC', () => {
    it('persiste novos usuários cadastrados e mantém após recriação do repositório', async () => {
      const repo = new MockAccessRepository()
      repo.resetToSeed()

      const initialCount = (await repo.listUsers()).length

      await repo.createUser({
        name: 'Novo Colaborador Persistido',
        email: 'persistido@georural.com.br',
        role: 'ANALISTA',
      })

      // Simula recarregamento da página (nova instância do repositório)
      const freshRepo = new MockAccessRepository()
      const reloadedUsers = await freshRepo.listUsers()

      expect(reloadedUsers.length).toBe(initialCount + 1)
      expect(reloadedUsers.some((u) => u.email === 'persistido@georural.com.br')).toBe(true)
    })

    it('persiste novos papéis customizados e registros na trilha de auditoria', async () => {
      const repo = new MockAccessRepository()
      repo.resetToSeed()

      await repo.createRole({
        id: 'GESTOR_JUNIOR',
        nome: 'Gestor Júnior',
        descricao: 'Acesso inicial de gestão',
        permissions: ['BASES:VISUALIZAR', 'MAPA:VISUALIZAR'],
      })

      // Nova instância (simulando reload)
      const freshRepo = new MockAccessRepository()
      const roles = await freshRepo.listRoles()
      const events = await freshRepo.listSecurityEvents()

      expect(roles.some((r) => r.id === 'GESTOR_JUNIOR')).toBe(true)
      expect(events.some((e) => e.action === 'Criação de Papel')).toBe(true)
    })

    it('re-inicializa a partir do seed padrão caso a versão de armazenamento seja incompatível', async () => {
      localStorage.setItem('api4_rbac_seed_version', '0.0.1_antiga')
      localStorage.setItem('api4_rbac_users', JSON.stringify([{ id: 999, name: 'Dado Obsoleto' }]))

      expect(rbacStorage.isSeedOutdated()).toBe(true)

      const repo = new MockAccessRepository()
      const found = await repo.getUserById(999)
      expect(found).toBeUndefined()
      expect(localStorage.getItem('api4_rbac_seed_version')).toBe(CURRENT_RBAC_SEED_VERSION)
    })
  })
})
