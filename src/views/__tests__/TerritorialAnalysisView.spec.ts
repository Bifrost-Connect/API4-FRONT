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

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
}))

vi.mock('leaflet', () => {
  const createMapMock = () => {
    const mapInstance = {
      setView: () => mapInstance,
      on: () => mapInstance,
      getBounds: () => ({
        toBBoxString: () => '-50,-20,-40,-10',
        isValid: () => true,
        pad: () => mapInstance.getBounds(),
      }),
      fitBounds: () => mapInstance,
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
          isValid: () => false,
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
    vi.mocked(spatialAnalysisService.listDocuments).mockResolvedValue(mockDocuments)
  })

  afterEach(() => {
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
})
