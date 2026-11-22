import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import TemporalComparisonView from '../TemporalComparisonView.vue'
import { comparisonService } from '@/services/comparacao'

vi.mock('vue-router', () => ({ useRoute: () => ({ query: { baseA: '1' } }) }))
vi.mock('@/services/comparacao', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/comparacao')>()),
  comparisonService: {
    listPublishedSeasons:
      vi.fn<typeof import('@/services/comparacao').comparisonService.listPublishedSeasons>(),
    getPairedLayers:
      vi.fn<typeof import('@/services/comparacao').comparisonService.getPairedLayers>(),
    getEvolution: vi.fn<typeof import('@/services/comparacao').comparisonService.getEvolution>(),
  },
}))
const maps = defineComponent({
  name: 'TemporalComparisonMaps',
  props: ['layersA', 'layersB', 'loadingA', 'loadingB'],
  emits: ['rendered', 'viewport'],
  methods: {
    useViewport() {
      this.$emit('viewport', '-50,-20,-40,-10')
    },
  },
  watch: {
    layersA() {
      this.$emit('rendered', 'a')
    },
    layersB() {
      this.$emit('rendered', 'b')
    },
  },
  template:
    '<button type="button" @click="$emit(\'viewport\', \'-50,-20,-40,-10\')">Usar recorte</button>',
})
const seasons = [
  { id: '1', year: '2023', version: 'v1', datasetId: '2', dataset: 'Alertas' },
  { id: '2', year: '2025', version: 'v2', datasetId: '2', dataset: 'Alertas' },
  { id: '3', year: '2025', version: 'v1', datasetId: '3', dataset: 'Reserva Legal' },
]
const collection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-45, -15] },
      properties: { codigoImovel: 'CAR1' },
    },
  ],
}
const metrics = {
  areaSafraAHectares: 40,
  areaSafraBHectares: 70,
  saldoVariacaoHectares: 30,
  areaAumentoHectares: 35,
  areaReducaoHectares: 5,
  areaMantidaHectares: 35,
  geoJsonClassificado: { type: 'FeatureCollection', features: [] },
}
type Wrapper = ReturnType<typeof mount>
let wrapper: Wrapper
async function setup() {
  wrapper = mount(TemporalComparisonView, { global: { stubs: { TemporalComparisonMaps: maps } } })
  await flushPromises()
  return wrapper
}
async function choosePair() {
  await wrapper.get('[aria-label="Safra comparada / Base B"]').setValue('2')
  await wrapper.getComponent(maps).vm.$emit('viewport', '-50,-20,-40,-10')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(comparisonService.listPublishedSeasons).mockResolvedValue(seasons)
  vi.mocked(comparisonService.getPairedLayers).mockResolvedValue({
    cargaA: collection,
    cargaB: collection,
  } as never)
  vi.mocked(comparisonService.getEvolution).mockResolvedValue(metrics as never)
})
afterEach(() => wrapper?.unmount())

describe('tela de comparação temporal', () => {
  it('preenche Base A pelo catálogo e impede comparar sem parâmetros ou versões distintas', async () => {
    await setup()
    expect(
      (wrapper.get('[aria-label="Safra inicial / Base A"]').element as HTMLSelectElement).value,
    ).toBe('1')
    expect(
      wrapper
        .findAll('[aria-label="Safra comparada / Base B"] option')
        .map((o) => o.attributes('value')),
    ).toEqual(['', '1', '2'])
    expect(
      wrapper
        .get('[aria-label="Safra comparada / Base B"] option[value="1"]')
        .attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await choosePair()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('exibe as métricas oficiais e invalida resultados ao trocar o recorte', async () => {
    await setup()
    await choosePair()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="percentage-change"]').text()).toBe('+75,00%')
    expect(wrapper.get('[data-testid="absolute-change"]').text()).toContain('+30,00')
    await wrapper.get('[aria-label="Longitude oeste"]').setValue('-49')
    expect(wrapper.find('[data-testid="percentage-change"]').exists()).toBe(false)
  })

  it('cancela requisições ao editar filtros e descarta respostas atrasadas', async () => {
    let resolve!: (value: never) => void
    vi.mocked(comparisonService.getEvolution).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    await setup()
    await choosePair()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const signal = vi.mocked(comparisonService.getEvolution).mock.calls[0]?.[1]
    expect(signal?.aborted).toBe(false)
    await wrapper.get('[aria-label="Safra comparada / Base B"]').setValue('')
    expect(signal?.aborted).toBe(true)
    resolve(metrics as never)
    await flushPromises()
    expect(wrapper.find('[data-testid="percentage-change"]').exists()).toBe(false)
  })

  it('oferece nova tentativa depois de uma falha e trata cobertura vazia', async () => {
    vi.mocked(comparisonService.getPairedLayers).mockRejectedValueOnce(
      new Error('Tempo limite excedido'),
    )
    await setup()
    await choosePair()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Tempo limite')
    vi.mocked(comparisonService.getPairedLayers).mockResolvedValueOnce({
      cargaA: { type: 'FeatureCollection', features: [] },
      cargaB: collection,
    } as never)
    const retry = wrapper.findAll('button').find((button) => button.text() === 'Tentar novamente')!
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('não possui cobertura')
  })

  it('não mostra Infinity quando a área inicial é zero', async () => {
    vi.mocked(comparisonService.getEvolution).mockResolvedValueOnce({
      ...metrics,
      areaSafraAHectares: 0,
    } as never)
    await setup()
    await choosePair()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="percentage-change"]').text()).toBe('Não aplicável')
  })

  it('preenche coordenadas pela ação de captura de viewport no formulário e habilita submit', async () => {
    await setup()
    await wrapper.get('[aria-label="Safra comparada / Base B"]').setValue('2')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()

    const captureBtn = wrapper.get('[data-testid="btn-capture-viewport"]')
    expect(captureBtn.text()).toBe('Usar área visível do mapa')
    await captureBtn.trigger('click')
    await flushPromises()

    expect(
      (wrapper.get('[aria-label="Longitude oeste"]').element as HTMLInputElement).value,
    ).toBe('-50.000000')
    expect(
      (wrapper.get('[aria-label="Latitude sul"]').element as HTMLInputElement).value,
    ).toBe('-20.000000')
    expect(
      (wrapper.get('[aria-label="Longitude leste"]').element as HTMLInputElement).value,
    ).toBe('-40.000000')
    expect(
      (wrapper.get('[aria-label="Latitude norte"]').element as HTMLInputElement).value,
    ).toBe('-10.000000')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('inspeciona feição selecionada exibindo presença correta nas Safras A e B', async () => {
    vi.mocked(comparisonService.getPairedLayers).mockResolvedValueOnce({
      cargaA: collection,
      cargaB: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-46, -16] },
            properties: { codigoImovel: 'CAR2' },
          },
        ],
      },
    } as never)
    await setup()
    await choosePair()
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const inspectSelect = wrapper.get('[aria-label="Inspecionar imóvel / feição"]')
    await inspectSelect.setValue('CAR1')
    await flushPromises()

    const details = wrapper.get('.inspection-details').text()
    expect(details).toContain('CAR1')
    expect(details).toContain('Safra A · 2023 · v1: presente no recorte.')
    expect(details).toContain('Safra B · 2025 · v2: sem correspondente no recorte.')
  })

  it('normaliza viewport com longitudes fora de [-180, 180] mantendo bbox válido e habilitando comparação', async () => {
    await setup()
    await wrapper.get('[aria-label="Safra comparada / Base B"]').setValue('2')
    await wrapper
      .getComponent(maps)
      .vm.$emit('viewport', '310.977287,-12.000704,311.140022,-11.840135')
    await flushPromises()

    expect(
      (wrapper.get('[aria-label="Longitude oeste"]').element as HTMLInputElement).value,
    ).toBe('-49.022713')
    expect(
      (wrapper.get('[aria-label="Latitude sul"]').element as HTMLInputElement).value,
    ).toBe('-12.000704')
    expect(
      (wrapper.get('[aria-label="Longitude leste"]').element as HTMLInputElement).value,
    ).toBe('-48.859978')
    expect(
      (wrapper.get('[aria-label="Latitude norte"]').element as HTMLInputElement).value,
    ).toBe('-11.840135')
    expect(wrapper.find('.validation-message').exists()).toBe(false)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(comparisonService.getPairedLayers).toHaveBeenCalledWith(
      expect.objectContaining({
        bbox: '-49.022713,-12.000704,-48.859978,-11.840135',
      }),
      expect.any(AbortSignal),
    )
  })
})
