import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import TerritorialAnalysisView from '../TerritorialAnalysisView.vue'
import {
  spatialAnalysisService,
  type SpatialAnalysisDocument,
  type SpatialAnalysisRequest,
  type SpatialAnalysisResponse,
} from '@/services/spatialAnalysis'

const addToSpy = vi.fn<(targetMap: unknown) => void>()
const fitBoundsSpy = vi.fn<(...args: unknown[]) => void>()
const mapEventHandlers = new Map<string, Array<(event?: { type?: string }) => void>>()
let geoJsonBoundsValid = false

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
}))

vi.mock('leaflet', () => {
  const createMapMock = () => {
    const mapInstance = {
      setView: () => mapInstance,
      on: (events: string, handler: (event?: { type?: string }) => void) => {
        for (const eventName of events.split(/\s+/)) {
          const handlers = mapEventHandlers.get(eventName) ?? []
          handlers.push(handler)
          mapEventHandlers.set(eventName, handlers)
        }
        return mapInstance
      },
      getBounds: () => ({
        toBBoxString: () => '-50,-20,-40,-10',
        isValid: () => true,
        pad: () => mapInstance.getBounds(),
      }),
      fitBounds: (...args: unknown[]) => {
        fitBoundsSpy(...args)
        for (const handler of mapEventHandlers.get('zoomend') ?? []) handler({ type: 'zoomend' })
        for (const handler of mapEventHandlers.get('moveend') ?? []) handler({ type: 'moveend' })
        return mapInstance
      },
      invalidateSize: () => mapInstance,
      remove: () => mapInstance,
      addLayer: () => mapInstance,
      getPanes: () => ({
        overlayPane: {
          querySelector: () => null,
        },
      }),
    }
    return mapInstance
  }

  class MockGeoJSON {}
  class MockPath {}

  const leafletMock = {
    map: () => createMapMock(),
    control: {
      zoom: () => ({
        addTo: () => undefined,
      }),
    },
    tileLayer: () => {
      const tileLayer = {
        addTo: () => tileLayer,
        removeFrom: () => tileLayer,
      }
      return tileLayer
    },
    geoJSON: () => {
      const layer = {
        addTo(targetMap: { addLayer: (l: unknown) => void }) {
          addToSpy(targetMap)
          targetMap.addLayer(layer)
          return layer
        },
        removeFrom: () => layer,
        eachLayer: () => undefined,
        getBounds: () => ({
          isValid: () => geoJsonBoundsValid,
          pad: () => layer.getBounds(),
        }),
      }
      return layer
    },
    GeoJSON: MockGeoJSON,
    Path: MockPath,
  }

  return {
    default: leafletMock,
    ...leafletMock,
  }
})

type GeoJsonCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>

vi.mock('@/services/spatialAnalysis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/spatialAnalysis')>()),
  spatialAnalysisService: {
    listDocuments: vi.fn<() => Promise<SpatialAnalysisDocument[]>>(),
    getDocumentGeoJSON: vi.fn<(documentId: string, bbox?: string) => Promise<GeoJsonCollection>>(),
    calculate: vi.fn<(request: SpatialAnalysisRequest) => Promise<SpatialAnalysisResponse>>(),
    registerLocalDocument: vi.fn<
      (
        metadata: Omit<SpatialAnalysisDocument, 'geojson' | 'localOnly'>,
        geojson: GeoJsonCollection,
      ) => SpatialAnalysisDocument
    >(),
  },
}))

const mockDocuments: SpatialAnalysisDocument[] = [
  {
    id: '1',
    name: 'Imóveis CAR 2024',
    category: 'CAR',
    source: 'SICAR',
    year: '2024',
    zone: 'PUBLICADA',
    status: 'HOMOLOGADA',
    featureCount: 3,
  },
  {
    id: 'ref-app',
    name: 'APP Oficial',
    category: 'APP',
    source: 'PostGIS',
    year: '2024',
    zone: 'REFERENCIA',
    status: 'DISPONIVEL',
    featureCount: 2,
  },
]

const emptyCollection: GeoJsonCollection = {
  type: 'FeatureCollection',
  features: [],
}

describe('TerritorialAnalysisView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mapEventHandlers.clear()
    geoJsonBoundsValid = false
    vi.mocked(spatialAnalysisService.listDocuments).mockResolvedValue(mockDocuments)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not add layers or log errors when unmounted while CAR GeoJSON fetch is in flight', async () => {
    const carResolvers: Array<(value: GeoJsonCollection) => void> = []
    vi.mocked(spatialAnalysisService.getDocumentGeoJSON).mockImplementation(
      () =>
        new Promise((resolve) => {
          carResolvers.push(resolve)
        }),
    )
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(TerritorialAnalysisView)
    await flushPromises()

    expect(carResolvers.length).toBeGreaterThan(0)
    wrapper.unmount()

    for (const resolve of carResolvers) {
      resolve(emptyCollection)
    }
    await flushPromises()

    expect(addToSpy).not.toHaveBeenCalledWith(null)
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      'Falha ao carregar geometrias territoriais:',
      expect.anything(),
    )
  })

  it('does not access map bounds or add layers when unmounted while restriction GeoJSON fetch is in flight', async () => {
    const restrictionResolvers: Array<(value: GeoJsonCollection) => void> = []
    vi.mocked(spatialAnalysisService.getDocumentGeoJSON).mockImplementation((documentId) => {
      if (documentId === '1') return Promise.resolve(emptyCollection)
      return new Promise((resolve) => {
        restrictionResolvers.push(resolve)
      })
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(TerritorialAnalysisView)
    await flushPromises()

    expect(restrictionResolvers.length).toBeGreaterThan(0)
    wrapper.unmount()

    for (const resolve of restrictionResolvers) {
      resolve(emptyCollection)
    }
    await flushPromises()

    expect(addToSpy).not.toHaveBeenCalledWith(null)
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      'Falha ao carregar geometrias territoriais:',
      expect.anything(),
    )
  })

  it('does not fire duplicate getDocumentGeoJSON calls on mount and selects at most 1 compatible restriction (preferring ref-*)', async () => {
    const manyDocuments: SpatialAnalysisDocument[] = [
      mockDocuments[0]!,
      {
        id: 'alerta-1',
        name: 'Alerta 2024',
        category: 'ALERTA',
        source: 'DETER',
        year: '2024',
        zone: 'PUBLICADA',
        status: 'HOMOLOGADA',
        featureCount: 5,
      },
      mockDocuments[1]!, // id: 'ref-app'
      {
        id: 'ref-rl',
        name: 'Reserva Legal Oficial',
        category: 'RESERVA_LEGAL',
        source: 'PostGIS',
        year: '2024',
        zone: 'REFERENCIA',
        status: 'DISPONIVEL',
        featureCount: 4,
      },
      {
        id: 'ti-1',
        name: 'Terra Indígena',
        category: 'TERRA_INDIGENA',
        source: 'FUNAI',
        year: '2024',
        zone: 'PUBLICADA',
        status: 'HOMOLOGADA',
        featureCount: 1,
      },
    ]
    vi.mocked(spatialAnalysisService.listDocuments).mockResolvedValue(manyDocuments)
    vi.mocked(spatialAnalysisService.getDocumentGeoJSON).mockResolvedValue(emptyCollection)

    const wrapper = mount(TerritorialAnalysisView)
    await flushPromises()
    await nextTick()
    await flushPromises()

    const calledIds = vi.mocked(spatialAnalysisService.getDocumentGeoJSON).mock.calls.map(([id]) => id)
    expect(calledIds).toEqual(['1', 'ref-app'])

    const checkedInputs = wrapper
      .findAll('.restriction-field input[type="checkbox"]')
      .filter((input) => (input.element as HTMLInputElement).checked)
    expect(checkedInputs).toHaveLength(1)
    wrapper.unmount()
  })

  it('falls back to selecting only the first compatible restriction when no ref-* layer exists', async () => {
    const nonRefDocs: SpatialAnalysisDocument[] = [
      mockDocuments[0]!,
      {
        id: 'alerta-1',
        name: 'Alerta 2024',
        category: 'ALERTA',
        source: 'DETER',
        year: '2024',
        zone: 'PUBLICADA',
        status: 'HOMOLOGADA',
        featureCount: 5,
      },
      {
        id: 'app-2',
        name: 'APP Secundária',
        category: 'APP',
        source: 'SICAR',
        year: '2024',
        zone: 'PUBLICADA',
        status: 'HOMOLOGADA',
        featureCount: 2,
      },
    ]
    vi.mocked(spatialAnalysisService.listDocuments).mockResolvedValue(nonRefDocs)
    vi.mocked(spatialAnalysisService.getDocumentGeoJSON).mockResolvedValue(emptyCollection)

    const wrapper = mount(TerritorialAnalysisView)
    await flushPromises()
    await nextTick()
    await flushPromises()

    const calledIds = vi.mocked(spatialAnalysisService.getDocumentGeoJSON).mock.calls.map(([id]) => id)
    expect(calledIds).toEqual(['1', 'alerta-1'])
    wrapper.unmount()
  })

  it('fetches CAR and restriction GeoJSON layers in parallel', async () => {
    const deferred = new Map<string, (value: GeoJsonCollection) => void>()
    vi.mocked(spatialAnalysisService.getDocumentGeoJSON).mockImplementation(
      (documentId) =>
        new Promise((resolve) => {
          deferred.set(documentId, resolve)
        }),
    )

    const wrapper = mount(TerritorialAnalysisView)
    await flushPromises()

    expect(deferred.has('1')).toBe(true)
    expect(deferred.has('ref-app')).toBe(true)

    deferred.get('1')?.(emptyCollection)
    deferred.get('ref-app')?.(emptyCollection)
    await flushPromises()
    wrapper.unmount()
  })

  it('does not call fitBounds repeatedly on subsequent layer refreshes for the same selectedCarId', async () => {
    vi.useFakeTimers()
    geoJsonBoundsValid = true
    const multiRestrictionDocs: SpatialAnalysisDocument[] = [
      mockDocuments[0]!,
      mockDocuments[1]!,
      {
        id: 'alerta-2',
        name: 'Alerta Extra',
        category: 'ALERTA',
        source: 'PRODES',
        year: '2024',
        zone: 'PUBLICADA',
        status: 'HOMOLOGADA',
        featureCount: 2,
      },
    ]
    vi.mocked(spatialAnalysisService.listDocuments).mockResolvedValue(multiRestrictionDocs)
    vi.mocked(spatialAnalysisService.getDocumentGeoJSON).mockResolvedValue(emptyCollection)

    const wrapper = mount(TerritorialAnalysisView)
    await flushPromises()
    vi.advanceTimersByTime(500)
    await flushPromises()

    expect(fitBoundsSpy).toHaveBeenCalledTimes(1)
    expect(spatialAnalysisService.getDocumentGeoJSON).toHaveBeenCalledTimes(2)

    const checkboxes = wrapper.findAll('.restriction-field input[type="checkbox"]')
    expect(checkboxes).toHaveLength(2)
    await checkboxes[1]!.trigger('change')
    await flushPromises()
    vi.advanceTimersByTime(500)
    await flushPromises()

    expect(fitBoundsSpy).toHaveBeenCalledTimes(1)
    expect(spatialAnalysisService.getDocumentGeoJSON).toHaveBeenCalledTimes(5)
    wrapper.unmount()
  })

  it('renders .restriction-options scrollable container and .car-meta-card when multiple restrictions are present', async () => {
    const manyDocuments: SpatialAnalysisDocument[] = [
      mockDocuments[0]!,
      mockDocuments[1]!,
      {
        id: 'r-2',
        name: 'Alerta 2',
        category: 'ALERTA',
        source: 'DETER',
        year: '2024',
        zone: 'PUBLICADA',
        status: 'HOMOLOGADA',
        featureCount: 2,
      },
      {
        id: 'r-3',
        name: 'Reserva 3',
        category: 'RESERVA_LEGAL',
        source: 'SICAR',
        year: '2024',
        zone: 'PUBLICADA',
        status: 'HOMOLOGADA',
        featureCount: 3,
      },
      {
        id: 'r-4',
        name: 'Terra Indígena 4',
        category: 'TERRA_INDIGENA',
        source: 'FUNAI',
        year: '2024',
        zone: 'PUBLICADA',
        status: 'HOMOLOGADA',
        featureCount: 1,
      },
    ]
    vi.mocked(spatialAnalysisService.listDocuments).mockResolvedValue(manyDocuments)
    vi.mocked(spatialAnalysisService.getDocumentGeoJSON).mockResolvedValue(emptyCollection)

    const wrapper = mount(TerritorialAnalysisView)
    await flushPromises()

    expect(wrapper.find('.restriction-options').exists()).toBe(true)
    expect(wrapper.findAll('.restriction-options .document-option')).toHaveLength(4)
    expect(wrapper.find('.car-meta-card').exists()).toBe(true)
    wrapper.unmount()
  })
})
