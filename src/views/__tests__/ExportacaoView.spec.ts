import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosResponse } from 'axios'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import api from '@/services/api'
import { exportacaoService } from '@/services/exportacao'
import { processService } from '@/services/process'
import { userService } from '@/services/user'
import { setTestUserRole } from '@/__tests__/mocks/testAuthHelper'
import ExportacaoView from '../ExportacaoView.vue'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRoute: () => ({ query: {} }) }
})

const publishedBase = {
  id: 42,
  conjunto: 'CAR',
  conjunto_id: 3,
  ano_safra: '2025',
  versao_oficial: 'v2',
  data_publicacao: '2026-10-01T10:00:00',
  epsg_destino: '4674',
  pronta_para_consulta: true,
  total_feicoes: 15,
}

const sample = {
  codigo_imovel: 'CAR-MS-0001',
  conjunto: 'CAR',
  orgao_sigla: 'SICAR',
  ano_safra: 2025,
  versao_oficial: 'v2',
  hectares_sobrepostos_total: 4.5,
  qtd_sobreposicoes: 1,
}

const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 280))
  await flushPromises()
}

enableAutoUnmount(afterEach)

describe('ExportacaoView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setTestUserRole('Gestor')
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (String(url).includes('/catalogo/bases')) {
        return { data: { items: [publishedBase] } } as unknown as AxiosResponse<unknown>
      }
      return { data: {} } as unknown as AxiosResponse<unknown>
    })
    vi.spyOn(processService, 'getTraceability').mockResolvedValue({
      indicadorId: 42,
      processoId: 42,
      arquivoOriginalId: 7,
      nomeArquivoOriginal: 'carga.geojson',
      hashSha256: 'sha256:abc123',
      parametrosProcessamento: '',
      dataCarga: '2026-09-30T10:00:00',
    })
    vi.spyOn(exportacaoService, 'preview').mockResolvedValue({
      processo_id: 42,
      versao_oficial: 'v2',
      filtros: {},
      total_registros: 1,
      tamanho_amostra: 1,
      amostra: [sample],
    })
    vi.spyOn(exportacaoService, 'historico').mockResolvedValue({
      items: [],
      page: 0,
      size: 20,
      total_items: 0,
      total_pages: 0,
    })
    vi.spyOn(exportacaoService, 'baixar').mockResolvedValue({
      blob: new Blob(['file']),
      filename: 'relatorio_georural.csv',
      contentType: 'text/csv',
    })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn<() => string>(() => 'blob:test'),
      revokeObjectURL: vi.fn<() => void>(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    userService.clearCurrentUser()
    vi.unstubAllGlobals()
  })

  it('atualiza a amostra quando os filtros mudam', async () => {
    const previewSpy = vi.mocked(exportacaoService.preview)
    const wrapper = mount(ExportacaoView)
    await flushPromises()
    await tick()

    await wrapper.get('[data-testid="export-property-filter"]').setValue('CAR-MS-0002')
    await tick()

    expect(previewSpy).toHaveBeenCalledWith({ processo_id: 42, codigo_imovel: 'CAR-MS-0002' })
    expect(wrapper.get('[data-testid="export-result-count"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="export-traceability"]').text()).toContain('sha256:abc123')
  })

  it('baixa CSV e GeoJSON com seus tipos e consulta o histórico após a exportação', async () => {
    const downloadSpy = vi.mocked(exportacaoService.baixar)
    const historySpy = vi.mocked(exportacaoService.historico)
    const wrapper = mount(ExportacaoView)
    await flushPromises()
    await tick()

    await wrapper.get('[data-testid="export-download-csv"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="export-download-geojson"]').trigger('click')
    await flushPromises()

    expect(downloadSpy).toHaveBeenNthCalledWith(1, { processo_id: 42 }, 'csv', expect.any(Function))
    expect(downloadSpy).toHaveBeenNthCalledWith(2, { processo_id: 42 }, 'geojson', expect.any(Function))
    expect(historySpy).toHaveBeenCalled()
  })

  it('não mostra ações de download para o perfil Auditor', async () => {
    setTestUserRole('Auditor')
    const wrapper = mount(ExportacaoView)
    await flushPromises()

    expect(wrapper.find('[data-testid="export-download-csv"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-download-geojson"]').exists()).toBe(false)
    expect(exportacaoService.preview).not.toHaveBeenCalled()
  })

  it('alterar formato para geojson atualiza a estimativa de tamanho sem chamar preview novamente', async () => {
    const previewSpy = vi.mocked(exportacaoService.preview).mockResolvedValue({
      processo_id: 42,
      versao_oficial: 'v2',
      filtros: {},
      total_registros: 10000,
      tamanho_amostra: 1,
      amostra: [sample],
    })
    const wrapper = mount(ExportacaoView)
    await flushPromises()
    await tick()

    expect(previewSpy).toHaveBeenCalledTimes(1)
    const csvEstimate = wrapper.get('[data-testid="export-size-estimate"]').text()

    await wrapper.get('[data-testid="export-format-select"]').setValue('geojson')
    await tick()

    expect(previewSpy).toHaveBeenCalledTimes(1)
    const geojsonEstimate = wrapper.get('[data-testid="export-size-estimate"]').text()
    expect(geojsonEstimate).not.toBe(csvEstimate)
  })

  it('reutiliza o previewCache em memória ao retornar para filtros já consultados', async () => {
    const previewSpy = vi.mocked(exportacaoService.preview).mockImplementation(async (filters) => ({
      processo_id: filters.processo_id,
      versao_oficial: 'v2',
      filtros: { ...filters },
      total_registros: filters.codigo_imovel ? 3 : 15,
      tamanho_amostra: 1,
      amostra: [
        {
          ...sample,
          codigo_imovel: filters.codigo_imovel || sample.codigo_imovel,
        },
      ],
    }))

    const wrapper = mount(ExportacaoView)
    await flushPromises()
    await tick()

    expect(previewSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="export-result-count"]').text()).toBe('15')

    await wrapper.get('[data-testid="export-property-filter"]').setValue('CAR-MS-0002')
    await tick()

    expect(previewSpy).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-testid="export-result-count"]').text()).toBe('3')

    await wrapper.get('[data-testid="export-property-filter"]').setValue('')
    await tick()

    expect(previewSpy).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-testid="export-result-count"]').text()).toBe('15')

    await wrapper.get('[data-testid="export-property-filter"]').setValue('CAR-MS-0002')
    await tick()

    expect(previewSpy).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-testid="export-result-count"]').text()).toBe('3')
  })
})
