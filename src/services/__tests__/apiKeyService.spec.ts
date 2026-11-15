import { describe, it, expect, beforeEach, vi } from 'vitest'
import api, { ApiError } from '@/services/api'
import { authStorage } from '@/services/storage/authStorage'
import { MockApiKeyRepository } from '@/services/mocks/MockApiKeyRepository'
import { HttpApiKeyRepository } from '@/services/apiKeys/HttpApiKeyRepository'
import { apiKeyService } from '@/services/apiKeyService'
import { API_KEY_AVAILABLE_SCOPES } from '@/types/apiKey'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return {
    ...actual,
    default: {
      get: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
      post: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
      put: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
      patch: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
      delete: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
      interceptors: {
        request: { use: vi.fn<() => number>() },
        response: { use: vi.fn<() => number>() },
      },
    },
  }
})

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

function setSimulatedSession() {
  authStorage.saveSession({
    userId: 1,
    name: 'Admin Simulado',
    email: 'admin@georural.com.br',
    role: 'ADMIN',
    roleId: 'ADMIN',
    permissions: ['API:VISUALIZAR_CHAVES', 'API:GERAR_CHAVE', 'API:REVOGAR_CHAVE'],
    loggedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    isSimulated: true,
  })
}

function setRealJwtSession() {
  authStorage.saveSession(
    {
      userId: 5,
      name: 'Gestor JWT',
      email: 'gestor@georural.com.br',
      role: 'GESTOR',
      roleId: 'GESTOR',
      permissions: ['API:VISUALIZAR_CHAVES', 'API:GERAR_CHAVE', 'API:REVOGAR_CHAVE'],
      loggedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      isSimulated: false,
    },
    { accessToken: 'jwt-real-token' },
  )
}

describe('MockApiKeyRepository (V39 / V40)', () => {
  let repo: MockApiKeyRepository

  beforeEach(() => {
    repo = new MockApiKeyRepository()
  })

  it('semeia chaves nos status ATIVA, REVOGADA e EXPIRADA e logs externos associados', async () => {
    const keys = await repo.listKeys()
    const statuses = keys.map((k) => k.status)

    expect(statuses).toContain('ATIVA')
    expect(statuses).toContain('REVOGADA')
    expect(statuses).toContain('EXPIRADA')

    const activeKey = keys.find((k) => k.status === 'ATIVA')!
    const logs = await repo.listExternalLogs(activeKey.id)
    expect(logs.length).toBeGreaterThan(0)
    expect(logs[0]!.chave_api_id).toBe(activeKey.id)
  })

  it('gera rawSecret único (bf_live_*), extrai prefixo_chave <= 16 chars e hash SHA-256 de 64 hex chars', async () => {
    const result = await repo.createKey({
      nome_parceiro: 'Instituto Ambiental Estadual',
      escopos: ['CATALOGO_CONSULTAR', 'MAPA_CONSULTAR'],
      data_expiracao: '2027-12-31T23:59:59Z',
      usuario_id: 5,
    })

    expect(result.rawSecret).toMatch(/^bf_live_[a-f0-9]{16,}$/i)
    expect(result.key.prefixo_chave.length).toBeLessThanOrEqual(16)
    expect(result.rawSecret.startsWith(result.key.prefixo_chave)).toBe(true)
    expect(result.key.hash_chave_sha256).toMatch(/^[a-f0-9]{64}$/i)
    expect(result.key.status).toBe('ATIVA')
    expect(result.key.escopos).toEqual(['CATALOGO_CONSULTAR', 'MAPA_CONSULTAR'])

    const listed = await repo.listKeys()
    expect(listed.some((k) => k.id === result.key.id)).toBe(true)
  })

  it('revoga chave alterando status para REVOGADA e preservando todos os logs externos (V40)', async () => {
    const keys = await repo.listKeys()
    const activeKey = keys.find((k) => k.status === 'ATIVA')!
    const logsBefore = await repo.listExternalLogs(activeKey.id)
    expect(logsBefore.length).toBeGreaterThan(0)

    const revoked = await repo.revokeKey(activeKey.id, 1)
    expect(revoked).not.toBeNull()
    expect(revoked!.status).toBe('REVOGADA')
    expect(revoked!.data_revogacao).toBeTruthy()
    expect(revoked!.usuario_revogacao_id).toBe(1)

    // V40: logs permanecem íntegros após revogação (nunca deletados)
    const logsAfter = await repo.listExternalLogs(activeKey.id)
    expect(logsAfter).toHaveLength(logsBefore.length)
  })

  it('não expõe método de exclusão física no repositório', () => {
    expect('deleteKey' in repo).toBe(false)
    expect('removeKey' in repo).toBe(false)
  })

  it('filtra logs externos por rota/IP e faixa HTTP (2xx, 4xx, 5xx)', async () => {
    const keys = await repo.listKeys()
    const target = keys.find((k) => k.status === 'ATIVA')!

    const allLogs = await repo.listExternalLogs(target.id)
    expect(allLogs.length).toBeGreaterThan(0)

    const errors4xx = await repo.listExternalLogs(target.id, { statusGroup: '4xx' })
    expect(errors4xx.every((l) => l.status_http >= 400 && l.status_http < 500)).toBe(true)

    const firstRoute = allLogs[0]!.rota_acessada
    const byRoute = await repo.listExternalLogs(target.id, { search: firstRoute })
    expect(byRoute.length).toBeGreaterThan(0)
    expect(byRoute.every((l) => l.rota_acessada.includes(firstRoute))).toBe(true)
  })
})

describe('HttpApiKeyRepository', () => {
  let repo: HttpApiKeyRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new HttpApiKeyRepository()
  })

  it('normaliza listagem paginada ou array e escopos JSONB de GET /admin/chaves-api', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        content: [
          {
            id: 10,
            usuario_id: 5,
            nome_parceiro: 'Parceiro Paginado',
            prefixo_chave: 'bf_live_11223344',
            escopos: JSON.stringify(['CATALOGO_CONSULTAR']),
            status: 'ATIVA',
            data_criacao: '2026-11-01T10:00:00Z',
            data_expiracao: null,
            data_revogacao: null,
            ultimo_uso_em: null,
          },
        ],
      },
    })

    const keys = await repo.listKeys()
    expect(api.get).toHaveBeenCalledWith('/admin/chaves-api', expect.any(Object))
    expect(keys).toHaveLength(1)
    expect(keys[0]!.escopos).toEqual(['CATALOGO_CONSULTAR'])
    expect(keys[0]!.nome_parceiro).toBe('Parceiro Paginado')
  })

  it('envia POST /admin/chaves-api e normaliza segredo único da resposta', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        chave: {
          id: 25,
          usuario_id: 1,
          nome_parceiro: 'Parceiro Novo',
          prefixo_chave: 'bf_live_aabbccdd',
          escopos: { escopos: ['MAPA_CONSULTAR'] },
          status: 'ATIVA',
          data_criacao: '2026-11-15T12:00:00Z',
          data_expiracao: null,
          data_revogacao: null,
          ultimo_uso_em: null,
        },
        segredo: 'bf_live_aabbccddeeff001122334455',
      },
    })

    const result = await repo.createKey({
      nome_parceiro: 'Parceiro Novo',
      escopos: ['MAPA_CONSULTAR'],
    })

    expect(api.post).toHaveBeenCalledWith(
      '/admin/chaves-api',
      expect.objectContaining({
        nome_parceiro: 'Parceiro Novo',
        escopos: ['MAPA_CONSULTAR'],
      }),
    )
    expect(result.rawSecret).toBe('bf_live_aabbccddeeff001122334455')
    expect(result.key.escopos).toEqual(['MAPA_CONSULTAR'])
  })

  it('chama PATCH /admin/chaves-api/{id}/revogar e GET /admin/chaves-api/{id}/logs', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: {
        id: 25,
        usuario_id: 1,
        nome_parceiro: 'Parceiro Novo',
        prefixo_chave: 'bf_live_aabbccdd',
        escopos: ['MAPA_CONSULTAR'],
        status: 'REVOGADA',
        data_criacao: '2026-11-15T12:00:00Z',
        data_expiracao: null,
        data_revogacao: '2026-11-15T13:00:00Z',
        usuario_revogacao_id: 1,
        ultimo_uso_em: null,
      },
    })

    const revoked = await repo.revokeKey(25, 1)
    expect(api.patch).toHaveBeenCalledWith('/admin/chaves-api/25/revogar', {
      usuario_revogacao_id: 1,
    })
    expect(revoked?.status).toBe('REVOGADA')

    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        {
          id: 90,
          chave_api_id: 25,
          rota_acessada: '/api/v1/catalogo',
          status_http: 200,
          ip_origem: '200.10.20.30',
          data_acesso: '2026-11-15T12:30:00Z',
        },
      ],
    })

    const logs = await repo.listExternalLogs(25)
    expect(api.get).toHaveBeenCalledWith('/admin/chaves-api/25/logs', expect.any(Object))
    expect(logs).toHaveLength(1)
    expect(logs[0]!.status_http).toBe(200)
  })
})

describe('apiKeyService (roteamento Mock vs HTTP e fallback automático)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    apiKeyService.resetMockData()
  })

  it('usa MockApiKeyRepository diretamente em sessão simulada sem chamar HTTP', async () => {
    setSimulatedSession()

    const keys = await apiKeyService.listKeys()
    expect(keys.length).toBeGreaterThan(0)
    expect(api.get).not.toHaveBeenCalled()
    expect(apiKeyService.isFallbackMode.value).toBe(true)
  })

  it('usa HttpApiKeyRepository em sessão JWT real e desativa isFallbackMode quando endpoint responde', async () => {
    setRealJwtSession()
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        {
          id: 101,
          usuario_id: 5,
          nome_parceiro: 'Parceiro Real Backend',
          prefixo_chave: 'bf_live_real1234',
          escopos: ['CATALOGO_CONSULTAR'],
          status: 'ATIVA',
          data_criacao: '2026-11-15T10:00:00Z',
          data_expiracao: null,
          data_revogacao: null,
          ultimo_uso_em: null,
        },
      ],
    })

    const keys = await apiKeyService.listKeys()
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(keys[0]!.nome_parceiro).toBe('Parceiro Real Backend')
    expect(apiKeyService.isFallbackMode.value).toBe(false)
  })

  it('ativa fallback para MockApiKeyRepository em erro 404, 405, 501 ou rede indisponível', async () => {
    setRealJwtSession()

    for (const status of [404, 405, 501]) {
      vi.mocked(api.get).mockRejectedValueOnce({ response: { status } })
      const keys = await apiKeyService.listKeys()
      expect(keys.length).toBeGreaterThan(0)
      expect(apiKeyService.isFallbackMode.value).toBe(true)
    }

    // Erro de rede sem response
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network Error'))
    const keysAfterNetworkErr = await apiKeyService.listKeys()
    expect(keysAfterNetworkErr.length).toBeGreaterThan(0)
    expect(apiKeyService.isFallbackMode.value).toBe(true)
  })

  it('propaga erros de validação (400) e permissão (403) sem acionar fallback silencioso', async () => {
    setRealJwtSession()

    vi.mocked(api.post).mockRejectedValueOnce(
      new ApiError({ response: { status: 400, data: { erro: 'Escopo inválido' } } }),
    )
    await expect(
      apiKeyService.createKey({ nome_parceiro: 'X', escopos: ['INVALIDO'] }),
    ).rejects.toThrow('Escopo inválido')

    vi.mocked(api.patch).mockRejectedValueOnce(
      new ApiError({ response: { status: 403, data: { erro: 'Acesso negado' } } }),
    )
    await expect(apiKeyService.revokeKey(1)).rejects.toThrow('Acesso negado')
  })

  it('expõe o catálogo de escopos disponíveis via getAvailableScopes', () => {
    const scopes = apiKeyService.getAvailableScopes()
    expect(scopes).toEqual(API_KEY_AVAILABLE_SCOPES)
    expect(scopes.some((s) => s.code === 'CATALOGO_CONSULTAR')).toBe(true)
  })
})
