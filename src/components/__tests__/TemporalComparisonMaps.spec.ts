import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TemporalComparisonMaps from '../TemporalComparisonMaps.vue'

const { mapFactorySpy, getBoundsSpy } = vi.hoisted(() => ({
  mapFactorySpy: vi.fn<(...args: unknown[]) => void>(),
  getBoundsSpy: vi.fn<() => unknown>(),
}))

vi.mock('leaflet', () => {
  const createLatLng = (lat: number, lng: number) => ({
    lat,
    lng,
    wrap: () => ({
      lat,
      lng: ((((lng + 180) % 360) + 360) % 360) - 180,
    }),
  })

  const createMapInstance = () => {
    const mapInstance = {
      setView: () => mapInstance,
      invalidateSize: () => undefined,
      remove: () => undefined,
      closePopup: () => undefined,
      fitBounds: () => undefined,
      getCenter: () => ({ lat: -15, lng: -47 }),
      getZoom: () => 4,
      getBounds: () => {
        const custom = getBoundsSpy() as { sw: [number, number]; ne: [number, number] }
        const sw = createLatLng(custom.sw[0], custom.sw[1])
        const ne = createLatLng(custom.ne[0], custom.ne[1])
        return {
          getSouthWest: () => sw,
          getNorthEast: () => ne,
          getWest: () => sw.lng,
          getEast: () => ne.lng,
        }
      },
      on: () => mapInstance,
      off: () => mapInstance,
    }
    return mapInstance
  }

  const leafletMock = {
    map: (...args: unknown[]) => {
      mapFactorySpy(...args)
      return createMapInstance()
    },
    control: {
      zoom: () => ({ addTo: () => undefined }),
    },
    tileLayer: () => {
      const tile = {
        on: () => tile,
        addTo: () => tile,
      }
      return tile
    },
    geoJSON: () => {
      const layer = {
        addTo: () => layer,
        clearLayers: () => undefined,
        addData: () => undefined,
        setStyle: () => undefined,
        remove: () => undefined,
        getBounds: () => ({ isValid: () => false }),
      }
      return layer
    },
    latLngBounds: () => ({
      isValid: () => false,
      extend: () => undefined,
    }),
  }

  return {
    default: leafletMock,
    ...leafletMock,
  }
})

describe('TemporalComparisonMaps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBoundsSpy.mockReturnValue({
      sw: [-12.000704, 310.977287],
      ne: [-11.840135, 311.140022],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('configura worldCopyJump e maxBounds nos mapas e normaliza viewport com wrap', () => {
    const wrapper = mount(TemporalComparisonMaps, {
      props: {
        layersA: null,
        layersB: null,
        delta: null,
        showDelta: false,
        loadingA: false,
        loadingB: false,
        mode: 'split',
        labelA: '2023 · v1',
        labelB: '2025 · v2',
        selectedId: '',
      },
    })

    expect(mapFactorySpy).toHaveBeenCalledTimes(2)
    for (const call of mapFactorySpy.mock.calls) {
      expect(call[1]).toMatchObject({
        worldCopyJump: true,
        maxBounds: [
          [-90, -180],
          [90, 180],
        ],
        maxBoundsViscosity: 0.8,
      })
    }

    ;(wrapper.vm as unknown as { useViewport: () => void }).useViewport()

    expect(wrapper.emitted('viewport')).toEqual([
      ['-49.022713,-12.000704,-48.859978,-11.840135'],
    ])

    wrapper.unmount()
  })
})
