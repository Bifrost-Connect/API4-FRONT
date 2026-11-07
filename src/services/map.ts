/**
 * Serviço de Camadas e Delimitações Territoriais do Mapa.
 * Todas as requisições utilizam a API REST do backend (/mapa/*, /publicacao/*).
 */
import api from './api'

export interface MapFilters {
  conjuntoId?: number | string
  anoSafra?: string
  bbox?: string
  page?: number
  size?: number
  busca?: string
  processoId?: number | string
}

export interface PaginatedGeoJson {
  type: 'FeatureCollection'
  features: any[]
  page?: number
  size?: number
  totalElements?: number
  totalPages?: number
}

export const DEFAULT_MAP_PALETTE = [
  '#10b981', // Verde Esmeralda
  '#3b82f6', // Azul Royal
  '#8b5cf6', // Roxo Violeta
  '#f59e0b', // Âmbar / Laranja
  '#ec4899', // Rosa
  '#06b6d4', // Ciano
  '#ef4444', // Vermelho
  '#14b8a6', // Verde Água
  '#84cc16', // Lima
  '#6366f1', // Índigo
]

export const mapService = {
  /**
   * Obtém as localizações das bases publicadas via API.
   */
  async getPublishedLocations() {
    try {
      const response = await api.get('/mapa/camadas-legado')
      if (Array.isArray(response.data)) {
        return response.data
      }
      return []
    } catch (error: any) {
      console.warn('Falha ao buscar locais do mapa via API:', error)
      return []
    }
  },

  /**
   * Obtém as feições vetoriais (GeoJSON) das camadas publicadas ou filtradas.
   */
  async getTerritories(filters?: MapFilters): Promise<PaginatedGeoJson> {
    try {
      const response = await api.get('/mapa/camadas', { params: filters })
      if (response.data && response.data.type === 'FeatureCollection') {
        if (response.data.features && response.data.features.length > 0) {
          return response.data
        }
      }

      // Se filtrou por processoId específico e ainda não constou em /mapa/camadas, tenta a revisão da carga
      if (filters?.processoId) {
        try {
          const rev = await api.get(`/publicacao/${filters.processoId}/revisao`)
          if (rev.data?.feicoesGeoJson?.features && rev.data.feicoesGeoJson.features.length > 0) {
            return rev.data.feicoesGeoJson
          }
        } catch {
          // Continua
        }
      }

      if (response.data && response.data.type === 'FeatureCollection') {
        return response.data
      }

      return { type: 'FeatureCollection', features: [] }
    } catch (error: any) {
      if (filters?.processoId) {
        try {
          const rev = await api.get(`/publicacao/${filters.processoId}/revisao`)
          if (rev.data?.feicoesGeoJson?.features && rev.data.feicoesGeoJson.features.length > 0) {
            return rev.data.feicoesGeoJson
          }
        } catch {
          // Continua
        }
      }
      throw error
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

  /**
   * Obtém a geometria de pré-visualização de um processo de carga.
   * Tenta rota de revisão de publicação, rota de carga e fallback para /mapa/camadas.
   */
  async getProcessPreviewGeometry(processoId: string | number): Promise<any | null> {
    if (!processoId) return null

    // 1. Tenta carregar da revisão de publicação
    try {
      const res = await api.get(`/publicacao/${processoId}/revisao`)
      const geojson = res.data?.feicoesGeoJson
      if (geojson && geojson.features && geojson.features.length > 0) {
        return geojson
      }
    } catch {
      // Tenta rota alternativa
    }

    // 2. Tenta carregar via /carga/{id}/revisao-publicacao
    try {
      const res = await api.get(`/carga/${processoId}/revisao-publicacao`)
      const geojson = res.data?.feicoesGeoJson
      if (geojson && geojson.features && geojson.features.length > 0) {
        return geojson
      }
    } catch {
      // Segue para fallback
    }

    // 3. Fallback para /mapa/camadas?processoId=
    try {
      const fallbackRes = await api.get('/mapa/camadas', {
        params: { processoId },
      })
      if (fallbackRes.data && fallbackRes.data.features && fallbackRes.data.features.length > 0) {
        return fallbackRes.data
      }
    } catch {
      // Não foi possível carregar do backend
    }

    return null
  },
}
