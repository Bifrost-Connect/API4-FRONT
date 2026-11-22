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

function normalizeLongitude(lng: number): number {
  if (lng >= -180 && lng <= 180) return lng === 0 ? 0 : lng
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180
  return wrapped === 0 ? 0 : wrapped
}

function clampLatitude(lat: number): number {
  const clamped = Math.max(-90, Math.min(90, lat))
  return clamped === 0 ? 0 : clamped
}

/** Normalizes bbox corners into [-180, 180] x [-90, 90] ordered [west, south, east, north] with 6 decimals. */
export function normalizeBbox(
  rawWest: number,
  rawSouth: number,
  rawEast: number,
  rawNorth: number,
  rawLngSpan = rawEast - rawWest,
): [string, string, string, string] | null {
  if (![rawWest, rawSouth, rawEast, rawNorth, rawLngSpan].every(Number.isFinite)) return null

  const south = Math.min(clampLatitude(rawSouth), clampLatitude(rawNorth))
  const north = Math.max(clampLatitude(rawSouth), clampLatitude(rawNorth))
  if (south >= north) return null

  let west: number
  let east: number
  if (Math.abs(rawLngSpan) >= 360) {
    west = -180
    east = 180
  } else {
    west = normalizeLongitude(rawWest)
    east = normalizeLongitude(rawEast)
    if (west > east) {
      if (east === -180) east = 180
      else if (west === 180) west = -180
      else if (180 - west >= east + 180) east = 180
      else west = -180
    }
  }

  if (west >= east) return null
  return [west.toFixed(6), south.toFixed(6), east.toFixed(6), north.toFixed(6)]
}

export function featureIdentifier(feature: GeoJSON.Feature): string {
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
