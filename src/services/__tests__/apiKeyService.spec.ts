import { describe, it, expect, beforeEach, vi } from 'vitest'
import api, { ApiError } from '@/services/api'
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

describe('apiKeyService (exclusivamente HttpApiKeyRepository)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delega listKeys diretamente para HttpApiKeyRepository', async () => {
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
  })

  it('propaga erros HTTP e de rede sem fallback silencioso', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network Error'))
    await expect(apiKeyService.listKeys()).rejects.toThrow('Network Error')

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
