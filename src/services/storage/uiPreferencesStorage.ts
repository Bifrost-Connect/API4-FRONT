/**
 * Camada de persistência para preferências de interface (localStorage)
 * e contexto temporário de filtros durante a navegação entre telas (sessionStorage).
 */

export const UI_STORAGE_KEYS = {
  CATALOG_VIEW_MODE: 'api4_ui_catalog_view_mode',
  CATALOG_PAGE_SIZE: 'api4_ui_catalog_page_size',
  MAP_CAMERA: 'api4_ui_map_camera',
  SESSION_CATALOG_FILTERS: 'api4_session_catalog_filters',
} as const

export interface MapCameraState {
  lat: number
  lng: number
  zoom: number
  baseLayer?: 'streets' | 'satellite' | 'topographic'
}

export interface CatalogFilterSessionState {
  selectedCategory: string
  showOnlyProntas: boolean
  searchQuery: string
  selectedSource: string
  selectedYear: string
  selectedAccess: string
  selectedCoverage: string
  selectedStatus: string
  sortBy: string
  clientCurrentPage: number
  standardFilters: {
    dateBeggin: string
    dateEnd: string
    conjunto: string | number
    etapa: string
    situacao: string
  }
}

const safeLocal = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key)
      }
    } catch {}
    return null
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value)
      }
    } catch {}
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key)
      }
    } catch {}
  },
}

const safeSession = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(key)
      }
    } catch {}
    return null
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value)
      }
    } catch {}
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key)
      }
    } catch {}
  },
}

export const uiPreferencesStorage = {
  // -------------------------------------------------------------
  // Preferências Persistentes (localStorage)
  // -------------------------------------------------------------

  getCatalogViewMode(defaultMode: 'grid' | 'table' = 'grid'): 'grid' | 'table' {
    const val = safeLocal.getItem(UI_STORAGE_KEYS.CATALOG_VIEW_MODE)
    if (val === 'grid' || val === 'table') return val
    return defaultMode
  },

  setCatalogViewMode(mode: 'grid' | 'table'): void {
    safeLocal.setItem(UI_STORAGE_KEYS.CATALOG_VIEW_MODE, mode)
  },

  getCatalogPageSize(defaultSize: number = 12): number {
    const val = safeLocal.getItem(UI_STORAGE_KEYS.CATALOG_PAGE_SIZE)
    if (val) {
      const num = Number(val)
      if (!Number.isNaN(num) && num > 0) return num
    }
    return defaultSize
  },

  setCatalogPageSize(size: number): void {
    safeLocal.setItem(UI_STORAGE_KEYS.CATALOG_PAGE_SIZE, String(size))
  },

  getMapCamera(): MapCameraState | null {
    const raw = safeLocal.getItem(UI_STORAGE_KEYS.MAP_CAMERA)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && typeof parsed.zoom === 'number') {
        return parsed
      }
    } catch {}
    return null
  },

  setMapCamera(camera: MapCameraState): void {
    try {
      safeLocal.setItem(UI_STORAGE_KEYS.MAP_CAMERA, JSON.stringify(camera))
    } catch {}
  },

  // -------------------------------------------------------------
  // Contexto de Sessão da Aba (sessionStorage)
  // -------------------------------------------------------------

  getCatalogFilters(): CatalogFilterSessionState | null {
    const raw = safeSession.getItem(UI_STORAGE_KEYS.SESSION_CATALOG_FILTERS)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },

  setCatalogFilters(state: CatalogFilterSessionState): void {
    try {
      safeSession.setItem(UI_STORAGE_KEYS.SESSION_CATALOG_FILTERS, JSON.stringify(state))
    } catch {}
  },

  clearCatalogFilters(): void {
    safeSession.removeItem(UI_STORAGE_KEYS.SESSION_CATALOG_FILTERS)
  },
}
