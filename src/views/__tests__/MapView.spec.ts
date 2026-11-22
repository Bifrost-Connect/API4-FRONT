import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import MapView from '../MapView.vue'
import { mapService, type PaginatedGeoJson, type PublishedLocation } from '@/services/map'
import { geojsonCache } from '@/services/storage/geojsonCache'

enableAutoUnmount(afterEach)

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
if (typeof window !== 'undefined' && window !== globalThis) {
  Object.defineProperty(window, 'localStorage', {
    value: storageMock,
    writable: true,
  })
}

const {
  mockRoute,
  mockRouterPush,
  mapRemoveLayerSpy,
  mapFitBoundsSpy,
  mapFlyToSpy,
  geoJsonAddToSpy,
  geoJsonSetStyleSpy,
} = vi.hoisted(() => ({
  mockRoute: { query: {} as Record<string, string | undefined> },
  mockRouterPush: vi.fn<(to: unknown) => void>(),
  mapRemoveLayerSpy: vi.fn<(layer: unknown) => void>(),
  mapFitBoundsSpy: vi.fn<(...args: unknown[]) => void>(),
  mapFlyToSpy: vi.fn<(...args: unknown[]) => void>(),
  geoJsonAddToSpy: vi.fn<(targetMap: unknown, layer: unknown) => void>(),
  geoJsonSetStyleSpy: vi.fn<(style: unknown) => void>(),
}))

const reactiveRoute = reactive(mockRoute)

vi.mock('vue-router', () => ({
  useRoute: () => reactiveRoute,
  useRouter: () => ({ push: mockRouterPush }),
}))

vi.mock('leaflet', () => {
  const createMapInstance = () => {
    const activeLayers = new Set<unknown>()
    const mapInstance = {
      setView: () => mapInstance,
      on: () => mapInstance,
      getCenter: () => ({ lat: -15.78, lng: -47.93 }),
      getZoom: () => 4,
      flyTo: mapFlyToSpy,
      fitBounds: mapFitBoundsSpy,
      hasLayer: (layer: unknown) => activeLayers.has(layer),
      addLayer: (layer: unknown) => {
        activeLayers.add(layer)
        return mapInstance
      },
      removeLayer: (layer: unknown) => {
        activeLayers.delete(layer)
        mapRemoveLayerSpy(layer)
        return mapInstance
      },
      remove: () => undefined,
    }
    return mapInstance
  }

  const leafletMock = {
    divIcon: () => ({}),
    map: () => createMapInstance(),
    control: {
      zoom: () => ({ addTo: () => undefined }),
      layers: () => ({ addTo: () => undefined }),
    },
    tileLayer: () => {
      const tileLayer = {
        addTo: () => tileLayer,
      }
      return tileLayer
    },
    layerGroup: () => {
      const group = {
        addTo: () => group,
        clearLayers: () => undefined,
      }
      return group
    },
    marker: () => {
      const marker = {
        bindTooltip: () => marker,
        on: () => marker,
        addTo: () => marker,
      }
      return marker
    },
    geoJSON: () => {
      const bounds = {
        isValid: () => true,
        pad: () => bounds,
        extend: () => bounds,
      }
      const layer = {
        addTo: (targetMap: { addLayer: (l: unknown) => void }) => {
          targetMap.addLayer(layer)
          geoJsonAddToSpy(targetMap, layer)
          return layer
        },
        setStyle: geoJsonSetStyleSpy,
        getBounds: () => bounds,
      }
      return layer
    },
  }

  return {
    default: leafletMock,
    ...leafletMock,
  }
})

const createMockLocations = (count = 14): PublishedLocation[] =>
  Array.from({ length: count }, (_, idx) => {
    const idNum = idx + 1
    return {
      id: String(idNum),
      name: `Base Oficial ${idNum}`,
      type: `CAR (${2020 + (idx % 6)})`,
      latitude: -15.78 - idx * 0.1,
      longitude: -47.93 - idx * 0.1,
      status: 'Concluída',
      total_feicoes: idNum * 10,
    }
  })

const createGeoJsonForBase = (baseId: number | string): PaginatedGeoJson & { fromCache?: boolean } => ({
  type: 'FeatureCollection',
  fromCache: false,
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-47.95, -15.75],
            [-47.9, -15.75],
            [-47.9, -15.8],
            [-47.95, -15.8],
            [-47.95, -15.75],
          ],
        ],
      },
      properties: {
        id: 1000 + Number(baseId),
        processoId: baseId,
        codigoImovel: `IMV-${baseId}`,
        areaHectares: 50,
      },
    },
  ],
})

describe('MapView', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    reactiveRoute.query = {}
    window.localStorage.clear()
    await geojsonCache.clearAll()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exibe todas as 14 bases cadastradas na abertura sem disparar lote genérico de feições', async () => {
    const locations14 = createMockLocations(14)
    vi.spyOn(mapService, 'getPublishedLocations').mockResolvedValue(locations14)
    const getTerritoriesSpy = vi.spyOn(mapService, 'getTerritories').mockResolvedValue(createGeoJsonForBase(1))

    const wrapper = mount(MapView)
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.location-count').text()).toBe('14')
    const cards = wrapper.findAll('.base-layer-card')
    expect(cards).toHaveLength(14)

    locations14.forEach((loc, idx) => {
      const card = cards[idx]
      expect(card).toBeDefined()
      expect(card!.text()).toContain(loc.name)
      expect(card!.text()).toContain(`${loc.total_feicoes} polígonos`)
    })

    expect(getTerritoriesSpy).not.toHaveBeenCalled()
    expect(geoJsonAddToSpy).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('mantém todas as 14 bases visíveis ao carregar vetores de 1 base sob demanda e exibe indicador de loading', async () => {
    const locations14 = createMockLocations(14)
    vi.spyOn(mapService, 'getPublishedLocations').mockResolvedValue(locations14)

    let resolveTerritories!: (value: PaginatedGeoJson & { fromCache?: boolean }) => void
    const pendingPromise = new Promise<PaginatedGeoJson & { fromCache?: boolean }>((resolve) => {
      resolveTerritories = resolve
    })
    const getTerritoriesSpy = vi.spyOn(mapService, 'getTerritories').mockReturnValueOnce(pendingPromise)

    const wrapper = mount(MapView)
    await flushPromises()
    await nextTick()

    const firstCard = wrapper.findAll('.base-layer-card')[0]!
    const checkbox = firstCard.find<HTMLInputElement>('.base-checkbox')
    const zoomBtn = firstCard.find<HTMLButtonElement>('.btn-zoom-target')

    expect(checkbox.element.checked).toBe(false)

    await checkbox.trigger('change')
    await nextTick()

    expect(firstCard.find('.base-loading-indicator').exists()).toBe(true)
    expect(firstCard.find('.base-loading-indicator').text()).toContain('Carregando polígonos...')
    expect(checkbox.element.disabled).toBe(true)
    expect(zoomBtn.element.disabled).toBe(true)
    expect(getTerritoriesSpy).toHaveBeenCalledTimes(1)
    expect(getTerritoriesSpy).toHaveBeenCalledWith(
      { processoId: 1, baseId: 1 },
      { forceRefresh: undefined },
    )

    resolveTerritories(createGeoJsonForBase(1))
    await flushPromises()
    await nextTick()

    expect(firstCard.find('.base-loading-indicator').exists()).toBe(false)
    expect(checkbox.element.disabled).toBe(false)
    expect(checkbox.element.checked).toBe(true)
    expect(geoJsonAddToSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.base-layer-card')).toHaveLength(14)
    expect(wrapper.find('.location-count').text()).toBe('14')

    wrapper.unmount()
  })

  it('reutiliza cache em memória ao desligar e religar uma camada já carregada sem repetir chamadas HTTP', async () => {
    const locations14 = createMockLocations(14)
    vi.spyOn(mapService, 'getPublishedLocations').mockResolvedValue(locations14)
    const getTerritoriesSpy = vi
      .spyOn(mapService, 'getTerritories')
      .mockResolvedValueOnce(createGeoJsonForBase(1))

    const wrapper = mount(MapView)
    await flushPromises()
    await nextTick()

    const firstCard = wrapper.findAll('.base-layer-card')[0]!
    const checkbox = firstCard.find<HTMLInputElement>('.base-checkbox')

    // 1º clique: carrega da API / serviço e adiciona ao mapa
    await checkbox.trigger('change')
    await flushPromises()
    await nextTick()

    expect(getTerritoriesSpy).toHaveBeenCalledTimes(1)
    expect(geoJsonAddToSpy).toHaveBeenCalledTimes(1)
    expect(checkbox.element.checked).toBe(true)

    // 2º clique: oculta camada usando estado em memória
    await checkbox.trigger('change')
    await nextTick()

    expect(mapRemoveLayerSpy).toHaveBeenCalledTimes(1)
    expect(checkbox.element.checked).toBe(false)
    expect(getTerritoriesSpy).toHaveBeenCalledTimes(1)

    // 3º clique: reexibe camada direto da memória sem chamar a API
    await checkbox.trigger('change')
    await nextTick()

    expect(geoJsonAddToSpy).toHaveBeenCalledTimes(2)
    expect(checkbox.element.checked).toBe(true)
    expect(getTerritoriesSpy).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('carrega apenas a base do query param processoId mantendo todas as 14 bases na barra lateral', async () => {
    reactiveRoute.query = { processoId: '3' }
    const locations14 = createMockLocations(14)
    vi.spyOn(mapService, 'getPublishedLocations').mockResolvedValue(locations14)
    const getTerritoriesSpy = vi
      .spyOn(mapService, 'getTerritories')
      .mockResolvedValueOnce(createGeoJsonForBase(3))

    const wrapper = mount(MapView)
    await flushPromises()
    await nextTick()

    expect(getTerritoriesSpy).toHaveBeenCalledTimes(1)
    expect(getTerritoriesSpy).toHaveBeenCalledWith(
      { processoId: 3, baseId: 3 },
      { forceRefresh: false },
    )
    expect(wrapper.findAll('.base-layer-card')).toHaveLength(14)
    expect(wrapper.find('.location-count').text()).toBe('14')

    const thirdCardCheckbox = wrapper.findAll('.base-layer-card')[2]!.find<HTMLInputElement>('.base-checkbox')
    expect(thirdCardCheckbox.element.checked).toBe(true)

    wrapper.unmount()
  })

  it('foca e carrega base sob demanda via onFocusBase e aplica cor personalizada via onColorInput', async () => {
    const locations14 = createMockLocations(14)
    vi.spyOn(mapService, 'getPublishedLocations').mockResolvedValue(locations14)
    const getTerritoriesSpy = vi
      .spyOn(mapService, 'getTerritories')
      .mockResolvedValueOnce(createGeoJsonForBase(2))

    const wrapper = mount(MapView)
    await flushPromises()
    await nextTick()

    const secondCard = wrapper.findAll('.base-layer-card')[1]!
    const colorInput = secondCard.find<HTMLInputElement>('.native-color-picker')
    colorInput.element.value = '#ff0055'
    await colorInput.trigger('input')
    await nextTick()

    // Foca na 2ª base (carrega sob demanda e dá zoom)
    await secondCard.find('.btn-zoom-target').trigger('click')
    await flushPromises()
    await nextTick()

    expect(getTerritoriesSpy).toHaveBeenCalledTimes(1)
    expect(getTerritoriesSpy).toHaveBeenCalledWith(
      { processoId: 2, baseId: 2 },
      { forceRefresh: undefined },
    )
    expect(mapFitBoundsSpy).toHaveBeenCalled()
    expect(wrapper.find('.coordinates-card').text()).toContain('Base Oficial 2')

    // Atualiza cor após camada carregada -> deve chamar setStyle no Leaflet
    colorInput.element.value = '#00aa88'
    await colorInput.trigger('input')
    await nextTick()
    expect(geoJsonSetStyleSpy).toHaveBeenCalledWith({
      color: '#00aa88',
      fillColor: '#00aa88',
    })

    // Foca novamente -> zero chamadas HTTP extras
    await secondCard.find('.base-layer-info').trigger('click')
    await nextTick()
    expect(getTerritoriesSpy).toHaveBeenCalledTimes(1)
  })

  it('limpa cache e camadas ao clicar em Atualizar camadas sem disparar lote genérico', async () => {
    const locations14 = createMockLocations(14)
    vi.spyOn(mapService, 'getPublishedLocations').mockResolvedValue(locations14)
    const getTerritoriesSpy = vi
      .spyOn(mapService, 'getTerritories')
      .mockResolvedValueOnce(createGeoJsonForBase(1))
    const clearCacheSpy = vi.spyOn(geojsonCache, 'clearAll')

    const wrapper = mount(MapView)
    await flushPromises()
    await nextTick()

    const firstCard = wrapper.findAll('.base-layer-card')[0]!
    await firstCard.find('.base-checkbox').trigger('change')
    await flushPromises()
    expect(getTerritoriesSpy).toHaveBeenCalledTimes(1)

    await wrapper.find('.btn-refresh-cache').trigger('click')
    await flushPromises()
    await nextTick()

    expect(clearCacheSpy).toHaveBeenCalled()
    expect(mapRemoveLayerSpy).toHaveBeenCalledTimes(1)
    expect(getTerritoriesSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.base-layer-card')).toHaveLength(14)
  })

  it('busca por nome carrega base sob demanda e busca sem correspondência exibe erro mantendo as 14 bases', async () => {
    const locations14 = createMockLocations(14)
    vi.spyOn(mapService, 'getPublishedLocations').mockResolvedValue(locations14)
    const getTerritoriesSpy = vi
      .spyOn(mapService, 'getTerritories')
      .mockResolvedValueOnce(createGeoJsonForBase(5))
      .mockResolvedValueOnce({ type: 'FeatureCollection', features: [], fromCache: false })

    const wrapper = mount(MapView)
    await flushPromises()
    await nextTick()

    const searchInput = wrapper.find<HTMLInputElement>('#map-search')
    await searchInput.setValue('Base Oficial 5')
    await wrapper.find('.search-form').trigger('submit')
    await flushPromises()
    await nextTick()

    expect(getTerritoriesSpy).toHaveBeenCalledWith(
      { processoId: 5, baseId: 5 },
      { forceRefresh: undefined },
    )
    expect(wrapper.findAll('.base-layer-card')).toHaveLength(14)

    await searchInput.setValue('termo-inexistente')
    await wrapper.find('.search-form').trigger('submit')
    await flushPromises()
    await nextTick()

    expect(getTerritoriesSpy).toHaveBeenLastCalledWith({ busca: 'termo-inexistente' })
    expect(wrapper.find('.map-error').exists()).toBe(true)
    expect(wrapper.findAll('.base-layer-card')).toHaveLength(14)
    expect(wrapper.find('.location-count').text()).toBe('14')
  })
})
