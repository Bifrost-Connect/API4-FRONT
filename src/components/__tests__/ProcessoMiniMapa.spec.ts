import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ProcessoMiniMapa from '../ProcessoMiniMapa.vue'
import { mapService } from '@/services/map'

const {
  mapFactorySpy,
  mapRemoveSpy,
  mapInvalidateSizeSpy,
  mapFitBoundsSpy,
  tileLayerAddToSpy,
  geoJsonAddToSpy,
} = vi.hoisted(() => ({
  mapFactorySpy: vi.fn<(...args: unknown[]) => void>(),
  mapRemoveSpy: vi.fn<() => void>(),
  mapInvalidateSizeSpy: vi.fn<() => void>(),
  mapFitBoundsSpy: vi.fn<(...args: unknown[]) => void>(),
  tileLayerAddToSpy: vi.fn<(targetMap: unknown) => void>(),
  geoJsonAddToSpy: vi.fn<(targetMap: unknown) => void>(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn<(path: string) => void>() }),
}))

vi.mock('leaflet', () => {
  const createMapInstance = () => {
    const mapInstance = {
      setView: () => mapInstance,
      invalidateSize: mapInvalidateSizeSpy,
      removeLayer: () => undefined,
      remove: mapRemoveSpy,
      fitBounds: mapFitBoundsSpy,
    }
    return mapInstance
  }

  const leafletMock = {
    map: (...args: unknown[]) => {
      mapFactorySpy(...args)
      return createMapInstance()
    },
    tileLayer: () => {
      const tileLayer = {
        addTo: (targetMap: unknown) => {
          tileLayerAddToSpy(targetMap)
          return tileLayer
        },
      }
      return tileLayer
    },
    geoJSON: () => {
      const bounds = {
        isValid: () => true,
        pad: () => bounds,
      }
      const layer = {
        addTo: (targetMap: unknown) => {
          geoJsonAddToSpy(targetMap)
          return layer
        },
        getLayers: () => [{}],
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

const sampleFeatureCollection: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 1, codigoImovel: 'IMV-001', areaHectares: 12.5 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-47.9, -15.7],
            [-47.8, -15.7],
            [-47.8, -15.8],
            [-47.9, -15.8],
            [-47.9, -15.7],
          ],
        ],
      },
    },
  ],
}

describe('ProcessoMiniMapa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not initialize leaflet map or throw when unmounted before geometry request resolves', async () => {
    let resolveGeometry!: (value: GeoJSON.FeatureCollection) => void
    const pendingPromise = new Promise<GeoJSON.FeatureCollection>((resolve) => {
      resolveGeometry = resolve
    })

    vi.spyOn(mapService, 'getProcessPreviewGeometry').mockReturnValue(pendingPromise)

    const wrapper = mount(ProcessoMiniMapa, {
      props: { processoId: 42 },
    })

    wrapper.unmount()

    resolveGeometry(sampleFeatureCollection)
    await flushPromises()
    await nextTick()

    expect(mapFactorySpy).not.toHaveBeenCalled()
    expect(tileLayerAddToSpy).not.toHaveBeenCalled()
    expect(geoJsonAddToSpy).not.toHaveBeenCalled()
  })

  it('renders map layers, clears pending fitBounds timer, and removes map on unmount', async () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    vi.spyOn(mapService, 'getProcessPreviewGeometry').mockResolvedValue(sampleFeatureCollection)

    const wrapper = mount(ProcessoMiniMapa, {
      props: { processoId: 99 },
    })

    await flushPromises()
    await nextTick()

    expect(mapFactorySpy).toHaveBeenCalledTimes(1)
    expect(tileLayerAddToSpy).toHaveBeenCalledTimes(1)
    expect(geoJsonAddToSpy).toHaveBeenCalledTimes(1)
    expect(mapFitBoundsSpy).not.toHaveBeenCalled()

    wrapper.unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    expect(mapRemoveSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(200)
    expect(mapFitBoundsSpy).not.toHaveBeenCalled()
    expect(mapInvalidateSizeSpy).toHaveBeenCalledTimes(1)
  })

  it('ignores stale geometry responses when processoId changes before an earlier request resolves', async () => {
    let resolveFirst!: (value: GeoJSON.FeatureCollection) => void
    const firstPromise = new Promise<GeoJSON.FeatureCollection>((resolve) => {
      resolveFirst = resolve
    })

    const secondFeatureCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          ...sampleFeatureCollection.features[0]!,
          properties: { id: 2, codigoImovel: 'IMV-NEW', areaHectares: 5 },
        },
        {
          ...sampleFeatureCollection.features[0]!,
          properties: { id: 3, codigoImovel: 'IMV-NEW-2', areaHectares: 5 },
        },
      ],
    }

    vi.spyOn(mapService, 'getProcessPreviewGeometry')
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(secondFeatureCollection)

    const wrapper = mount(ProcessoMiniMapa, {
      props: { processoId: 1 },
    })

    await wrapper.setProps({ processoId: 2 })
    await flushPromises()
    await nextTick()

    expect(geoJsonAddToSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.badge-count').text()).toContain('2 feição(ões)')

    resolveFirst(sampleFeatureCollection)
    await flushPromises()
    await nextTick()

    expect(geoJsonAddToSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.badge-count').text()).toContain('2 feição(ões)')
  })
})
