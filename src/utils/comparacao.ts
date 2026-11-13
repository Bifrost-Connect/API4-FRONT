import type { Feature } from 'geojson'

export function percentageVariation(areaA: number, areaB: number): number | null {
  if (!Number.isFinite(areaA) || !Number.isFinite(areaB) || areaA < 0 || areaB < 0) return null
  if (areaA === 0) return areaB === 0 ? 0 : null
  return ((areaB - areaA) / areaA) * 100
}

export function parseBbox(values: readonly (string | number)[]): string | null {
  if (values.length !== 4 || values.some((value) => !String(value).trim())) return null
  const [west, south, east, north] = values.map(Number)
  if (
    west === undefined ||
    south === undefined ||
    east === undefined ||
    north === undefined ||
    ![west, south, east, north].every(Number.isFinite) ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west >= east ||
    south >= north
  )
    return null
  return [west, south, east, north].join(',')
}

export function featureIdentifier(feature: Feature): string {
  const p = feature.properties ?? {}
  return String(p.codigoImovel ?? p.codigo_imovel ?? p.identificadorCar ?? feature.id ?? p.id ?? '')
}

export interface CameraMap {
  getCenter(): { lat: number; lng: number }
  getZoom(): number
  setView(
    center: { lat: number; lng: number },
    zoom: number,
    options: { animate: boolean },
  ): unknown
  on(events: string, handler: () => void): unknown
  off(events: string, handler: () => void): unknown
}

export function synchronizeCameras(a: CameraMap, b: CameraMap): () => void {
  let synchronizing = false
  function copy(source: CameraMap, target: CameraMap) {
    if (synchronizing) return
    const from = source.getCenter()
    const to = target.getCenter()
    if (
      Math.abs(from.lat - to.lat) < 1e-9 &&
      Math.abs(from.lng - to.lng) < 1e-9 &&
      source.getZoom() === target.getZoom()
    )
      return
    synchronizing = true
    try {
      target.setView(from, source.getZoom(), { animate: false })
    } finally {
      synchronizing = false
    }
  }
  const fromA = () => copy(a, b)
  const fromB = () => copy(b, a)
  a.on('move zoom', fromA)
  b.on('move zoom', fromB)
  return () => {
    a.off('move zoom', fromA)
    b.off('move zoom', fromB)
  }
}
