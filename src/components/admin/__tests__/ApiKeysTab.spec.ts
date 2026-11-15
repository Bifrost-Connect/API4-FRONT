import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ApiKeysTab from '../ApiKeysTab.vue'
import { apiKeyService } from '@/services/apiKeyService'
import { userService } from '@/services/user'

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

describe('ApiKeysTab (US12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    apiKeyService.resetMockData()
    userService.setCurrentUserRole('ADMIN')
  })

  it('carrega e exibe a lista de chaves e o indicador de modo simulado', async () => {
    const wrapper = mount(ApiKeysTab)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="api-key-row"]')
    expect(rows.length).toBeGreaterThanOrEqual(3)
    expect(wrapper.find('[data-testid="apikey-fallback-badge"]').exists()).toBe(true)
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

    const revokeSpy = vi.spyOn(apiKeyService, 'revokeKey')
    const activeRevokeBtn = wrapper
      .findAll('[data-testid="btn-revoke-api-key"]')
      .find((btn) => btn.attributes('disabled') === undefined)!

    await activeRevokeBtn.trigger('click')
    expect(wrapper.find('[data-testid="revoke-api-key-modal"]').exists()).toBe(true)

    await wrapper.find('[data-testid="btn-confirm-revoke-apikey"]').trigger('click')
    await flushPromises()

    expect(revokeSpy).toHaveBeenCalledTimes(1)
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
    userService.setCurrentUser({
      id: 77,
      name: 'Leitor API',
      email: 'leitor@georural.com.br',
      role: 'INTEGRADOR_LEITURA',
      permissions: ['API:VISUALIZAR_CHAVES'],
    })

    const wrapper = mount(ApiKeysTab)
    await flushPromises()

    expect(wrapper.find('[data-testid="btn-new-api-key"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="btn-revoke-api-key"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="btn-view-key-logs"]').exists()).toBe(true)
  })
})
