import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ApiKeysTab from '../ApiKeysTab.vue'
import { apiKeyService } from '@/services/apiKeyService'
import { userService } from '@/services/user'
import { setTestUserRole } from '@/__tests__/mocks/testAuthHelper'
import type { ApiKeyRecord, ExternalApiAccessLog } from '@/types/apiKey'

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

const seedKeys: ApiKeyRecord[] = [
  {
    id: 1,
    usuario_id: 1,
    nome_parceiro: 'Cooperativa Agro',
    prefixo_chave: 'bf_live_11112222',
    escopos: ['CATALOGO_CONSULTAR', 'MAPA_CONSULTAR'],
    status: 'ATIVA',
    data_criacao: '2026-10-01T10:00:00Z',
    data_expiracao: '2027-10-01T10:00:00Z',
    data_revogacao: null,
    ultimo_uso_em: '2026-11-10T08:00:00Z',
  },
  {
    id: 2,
    usuario_id: 1,
    nome_parceiro: 'Parceiro Revogado',
    prefixo_chave: 'bf_live_33334444',
    escopos: ['CATALOGO_CONSULTAR'],
    status: 'REVOGADA',
    data_criacao: '2026-09-01T10:00:00Z',
    data_expiracao: null,
    data_revogacao: '2026-10-15T12:00:00Z',
    ultimo_uso_em: null,
  },
  {
    id: 3,
    usuario_id: 1,
    nome_parceiro: 'Parceiro Expirado',
    prefixo_chave: 'bf_live_55556666',
    escopos: ['MAPA_CONSULTAR'],
    status: 'EXPIRADA',
    data_criacao: '2025-01-01T10:00:00Z',
    data_expiracao: '2025-12-31T23:59:59Z',
    data_revogacao: null,
    ultimo_uso_em: null,
  },
]

const seedLogs: ExternalApiAccessLog[] = [
  {
    id: 101,
    chave_api_id: 1,
    rota_acessada: '/api/v1/catalogo',
    status_http: 200,
    ip_origem: '177.10.20.30',
    data_acesso: '2026-11-10T08:00:00Z',
  },
  {
    id: 102,
    chave_api_id: 1,
    rota_acessada: '/api/v1/restrito',
    status_http: 403,
    ip_origem: '177.10.20.31',
    data_acesso: '2026-11-10T08:05:00Z',
  },
]

describe('ApiKeysTab (US12)', () => {
  let keysStore: ApiKeyRecord[]

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    keysStore = seedKeys.map((k) => ({ ...k, escopos: [...k.escopos] }))
    setTestUserRole('ADMIN')

    vi.spyOn(apiKeyService, 'listKeys').mockImplementation(async () =>
      keysStore.map((k) => ({ ...k, escopos: [...k.escopos] })),
    )
    vi.spyOn(apiKeyService, 'createKey').mockImplementation(async (dto) => {
      const created: ApiKeyRecord = {
        id: 99,
        usuario_id: 1,
        nome_parceiro: dto.nome_parceiro,
        prefixo_chave: 'bf_live_99990000',
        escopos: [...dto.escopos],
        status: 'ATIVA',
        data_criacao: '2026-11-18T10:00:00Z',
        data_expiracao: dto.data_expiracao ?? null,
        data_revogacao: null,
        ultimo_uso_em: null,
      }
      keysStore.unshift(created)
      return { key: created, rawSecret: 'bf_live_99990000abcdef1234567890' }
    })
    vi.spyOn(apiKeyService, 'revokeKey').mockImplementation(async (id) => {
      const found = keysStore.find((k) => k.id === id)
      if (!found) return null
      found.status = 'REVOGADA'
      found.data_revogacao = '2026-11-18T11:00:00Z'
      return { ...found }
    })
    vi.spyOn(apiKeyService, 'listExternalLogs').mockImplementation(async () =>
      seedLogs.map((l) => ({ ...l })),
    )
  })

  it('carrega e exibe a lista de chaves sem badge de modo simulado', async () => {
    const wrapper = mount(ApiKeysTab)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="api-key-row"]')
    expect(rows.length).toBeGreaterThanOrEqual(3)
    expect(wrapper.find('[data-testid="apikey-fallback-badge"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('ATIVA')
    expect(wrapper.text()).toContain('REVOGADA')
    expect(wrapper.text()).toContain('EXPIRADA')
  })

  it('filtra chaves por nome do parceiro/prefixo e por status', async () => {
    const wrapper = mount(ApiKeysTab)
    await flushPromises()

    await wrapper.find('[data-testid="apikey-status-filter"]').setValue('REVOGADA')
    const revokedRows = wrapper.findAll('[data-testid="api-key-row"]')
    expect(revokedRows.length).toBeGreaterThanOrEqual(1)
    expect(revokedRows.every((r) => r.text().includes('REVOGADA'))).toBe(true)

    await wrapper.find('[data-testid="apikey-status-filter"]').setValue('')
    await wrapper.find('[data-testid="apikey-search-input"]').setValue('TermoInexistenteXYZ')
    expect(wrapper.findAll('[data-testid="api-key-row"]')).toHaveLength(0)
  })

  it('cria nova chave, exibe modal de segredo único uma vez, copia para clipboard e atualiza a tabela', async () => {
    const writeTextMock = vi.fn<() => Promise<void>>().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })

    const wrapper = mount(ApiKeysTab)
    await flushPromises()

    const initialCount = wrapper.findAll('[data-testid="api-key-row"]').length

    await wrapper.find('[data-testid="btn-new-api-key"]').trigger('click')
    expect(wrapper.find('[data-testid="create-api-key-modal"]').exists()).toBe(true)

    await wrapper.find('[data-testid="input-apikey-partner"]').setValue('Parceiro Geo Teste')
    await wrapper.find('[data-testid="input-apikey-expiration"]').setValue('2027-12-31')
    await wrapper.find('[data-testid="scope-checkbox-LINHAGEM_CONSULTAR"]').setValue(true)

    await wrapper.find('[data-testid="create-api-key-modal"] form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[data-testid="create-api-key-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="secret-api-key-modal"]').exists()).toBe(true)

    const rawSecret = wrapper.find('[data-testid="generated-raw-secret"]').text()
    expect(rawSecret).toMatch(/^bf_live_/)

    await wrapper.find('[data-testid="btn-copy-secret"]').trigger('click')
    await flushPromises()
    expect(writeTextMock).toHaveBeenCalledWith(rawSecret)
    expect(wrapper.find('[data-testid="btn-copy-secret"]').text()).toContain('Copiada!')

    await wrapper.find('[data-testid="btn-close-secret-modal"]').trigger('click')
    expect(wrapper.find('[data-testid="secret-api-key-modal"]').exists()).toBe(false)

    const updatedRows = wrapper.findAll('[data-testid="api-key-row"]')
    expect(updatedRows).toHaveLength(initialCount + 1)
    expect(wrapper.text()).toContain('Parceiro Geo Teste')
  })

  it('revoga chave ativa pelo modal de confirmação e atualiza o status na tabela', async () => {
    const wrapper = mount(ApiKeysTab)
    await flushPromises()

    const activeRevokeBtn = wrapper
      .findAll('[data-testid="btn-revoke-api-key"]')
      .find((btn) => btn.attributes('disabled') === undefined)!

    await activeRevokeBtn.trigger('click')
    expect(wrapper.find('[data-testid="revoke-api-key-modal"]').exists()).toBe(true)

    await wrapper.find('[data-testid="btn-confirm-revoke-apikey"]').trigger('click')
    await flushPromises()

    expect(apiKeyService.revokeKey).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="revoke-api-key-modal"]').exists()).toBe(false)
  })

  it('carrega e filtra logs de acessos externos (V40) no modal de logs', async () => {
    const wrapper = mount(ApiKeysTab)
    await flushPromises()

    await wrapper.findAll('[data-testid="btn-view-key-logs"]')[0]!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="external-logs-modal"]').exists()).toBe(true)
    const allLogRows = wrapper.findAll('[data-testid="external-log-row"]')
    expect(allLogRows.length).toBeGreaterThan(0)

    await wrapper.find('[data-testid="external-log-status-filter"]').setValue('4xx')
    const filtered4xx = wrapper.findAll('[data-testid="external-log-row"]')
    expect(filtered4xx.every((row) => /4\d{2}/.test(row.text()))).toBe(true)
  })

  it('oculta botões de emissão e revogação quando o usuário possui apenas API:VISUALIZAR_CHAVES', async () => {
    userService.setCurrentUser(
      {
        id: 77,
        name: 'Leitor API',
        email: 'leitor@georural.com.br',
        role: 'INTEGRADOR_LEITURA',
        permissions: ['API:VISUALIZAR_CHAVES'],
      },
      { accessToken: 'test-jwt-leitor' },
    )

    const wrapper = mount(ApiKeysTab)
    await flushPromises()

    expect(wrapper.find('[data-testid="btn-new-api-key"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="btn-revoke-api-key"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="btn-view-key-logs"]').exists()).toBe(true)
  })
})
