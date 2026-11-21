import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import UploadView from '../UploadView.vue'
import { uploadService } from '@/services/upload'

const mockRouteQuery = ref<Record<string, string>>({})

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => ({ query: mockRouteQuery.value }),
  }
})

enableAutoUnmount(afterEach)

describe('UploadView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockRouteQuery.value = {}
    vi.spyOn(uploadService, 'getUploadOptions').mockResolvedValue({
      anos: ['2025', '2026'],
      epsgs: [{ id: '4674', label: 'EPSG:4674' }],
      orgaos: [{ id: 1, label: 'SICAR' }],
      conjuntos: [{ id: 1, label: 'Imóveis Rurais' }],
    })
    vi.spyOn(uploadService, 'listarTemplatesConectores').mockResolvedValue([])
    vi.spyOn(uploadService, 'listarConectores').mockResolvedValue([])
    vi.spyOn(uploadService, 'listarExecucoesIngestao').mockResolvedValue([])
  })

  it('inicia na aba de Upload Manual preservando o stepper e formulário original', async () => {
    const wrapper = mount(UploadView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="tab-upload-manual"]').classes()).toContain('active')
    expect(wrapper.get('[data-testid="tab-upload-automatizada"]').classes()).not.toContain('active')
    expect(wrapper.find('#upload-nome').exists()).toBe(true)
    expect(wrapper.find('#upload-orgao').exists()).toBe(true)
    expect(wrapper.find('#upload-conjunto').exists()).toBe(true)
    expect(wrapper.find('[data-testid="automated-ingestion-tab"]').exists()).toBe(false)
  })

  it('alterna para a aba de Fontes Externas & Ingestão Automatizada ao clicar na aba', async () => {
    const wrapper = mount(UploadView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })
    await flushPromises()

    await wrapper.get('[data-testid="tab-upload-automatizada"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="tab-upload-automatizada"]').classes()).toContain('active')
    expect(wrapper.find('#upload-nome').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automated-ingestion-tab"]').exists()).toBe(true)
    expect(wrapper.get('main.upload-view').classes()).toContain('upload-view--wide')
  })

  it('abre diretamente a aba automatizada quando ?tab=automatizada ou ?tab=conectores está na URL', async () => {
    mockRouteQuery.value = { tab: 'automatizada' }
    const wrapper1 = mount(UploadView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })
    await flushPromises()
    expect(wrapper1.get('[data-testid="tab-upload-automatizada"]').classes()).toContain('active')
    expect(wrapper1.find('[data-testid="automated-ingestion-tab"]').exists()).toBe(true)

    mockRouteQuery.value = { tab: 'conectores' }
    const wrapper2 = mount(UploadView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })
    await flushPromises()
    expect(wrapper2.get('[data-testid="tab-upload-automatizada"]').classes()).toContain('active')
    expect(wrapper2.find('[data-testid="automated-ingestion-tab"]').exists()).toBe(true)
  })
})
