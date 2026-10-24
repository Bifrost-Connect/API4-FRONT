import api, { mockactive } from './api'
import { mockLocations, mockTerritories } from './mocks/map.mock'

export interface MapFilters {
  conjuntoId?: number | string
  anoSafra?: string
  bbox?: string
  page?: number
  size?: number
  busca?: string
}

export interface PaginatedGeoJson {
  type: 'FeatureCollection'
  features: any[]
  page?: number
  size?: number
  totalElements?: number
  totalPages?: number
}

export const mapService = {
  async getPublishedLocations() {
    try {
      const response = await api.get('/mapa/camadas-legado')
      if (Array.isArray(response.data)) {
        if (response.data.length > 0 || !mockactive) {
          return response.data
        }
      }
      return mockactive ? mockLocations : []
    } catch (error: any) {
      if (!mockactive) throw error
      console.warn('Falha ao buscar locais do mapa. Usando dados simulados.', error)
      return mockLocations
    }
  },

  async getTerritories(filters?: MapFilters): Promise<PaginatedGeoJson> {
    try {
      const response = await api.get('/mapa/camadas', { params: filters })
      if (response.data && response.data.type === 'FeatureCollection') {
        if (response.data.features?.length > 0 || !mockactive) {
          return response.data
        }
      }
      return mockactive
        ? (mockTerritories as PaginatedGeoJson)
        : { type: 'FeatureCollection', features: [] }
    } catch (error: any) {
      if (!mockactive) throw error
      console.warn('Falha ao buscar camadas territoriais. Usando dados simulados.', error)
      return mockTerritories as PaginatedGeoJson
    }
  },

  async getFeatureDetails(idPoligono: number | string) {
    const response = await api.get(`/mapa/feicoes/${idPoligono}`)
    return response.data
  },

  async getRevisaoPublicacao(idCarga: number | string) {
    try {
      const response = await api.get(`/publicacao/${idCarga}/revisao`)
      return response.data
    } catch {
      const fallback = await api.get(`/mapa/publicacao/${idCarga}/revisao`)
      return fallback.data
    }
  },

  async aprovarTratamento(
    idCarga: number | string,
    gestorId: number = 1,
    parecer: string = '',
  ) {
    const response = await api.post(`/publicacao/${idCarga}/aprovar-tratamento`, {
      gestorId,
      parecer,
    })
    return response.data
  },
}
