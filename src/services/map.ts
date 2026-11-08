/**
 * Serviço de Camadas e Delimitações Territoriais do Mapa.
 * Todas as requisições utilizam a API REST do backend (/mapa/*, /publicacao/*)
 * com suporte a cache local IndexedDB para carregamento instantâneo.
 */
import api from './api'
import { geojsonCache } from './storage/geojsonCache'

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
  async getTerritories(
    filters?: MapFilters,
    options?: { forceRefresh?: boolean; versao?: string; safra?: string },
  ): Promise<PaginatedGeoJson & { fromCache?: boolean }> {
    const baseId = filters?.processoId
      ? String(filters.processoId)
      : filters?.conjuntoId
        ? `conjunto_${filters.conjuntoId}`
        : filters?.busca
          ? `search_${filters.busca.toLowerCase().trim()}`
          : 'all_territories'

    // 1. Tenta recuperar do cache local se não for forçada a atualização
    if (!options?.forceRefresh) {
      try {
        const cached = await geojsonCache.get({
          baseId,
          versao: options?.versao,
          safra: options?.safra || filters?.anoSafra,
          bbox: filters?.bbox,
        })
        if (cached?.geojsonData && cached.geojsonData.type === 'FeatureCollection' && cached.geojsonData.features?.length > 0) {
          return {
            ...cached.geojsonData,
            fromCache: true,
          }
        }
      } catch {}
    }

    try {
      const response = await api.get('/mapa/camadas', { params: filters })
      let resultData: PaginatedGeoJson | null = null

      if (response.data && response.data.type === 'FeatureCollection') {
        if (response.data.features && response.data.features.length > 0) {
          resultData = response.data
        }
      }

      // Se filtrou por processoId específico e ainda não constou em /mapa/camadas, tenta a revisão da carga
      if (!resultData && filters?.processoId) {
        try {
          const rev = await api.get(`/publicacao/${filters.processoId}/revisao`)
          if (rev.data?.feicoesGeoJson?.features && rev.data.feicoesGeoJson.features.length > 0) {
            resultData = rev.data.feicoesGeoJson
          }
        } catch {
          // Continua
        }
      }

      if (!resultData && response.data && response.data.type === 'FeatureCollection') {
        resultData = response.data
      }

      const finalResult: PaginatedGeoJson & { fromCache?: boolean } = resultData || {
        type: 'FeatureCollection',
        features: [],
      }

      // Salva no cache local se houver feições válidas
      if (finalResult.features && finalResult.features.length > 0) {
        try {
          await geojsonCache.set({
            baseId,
            versao: options?.versao || 'oficial',
            safra: options?.safra || filters?.anoSafra || 'any',
            bbox: filters?.bbox,
            classificacaoAcesso: 'Pública',
            geojsonData: finalResult,
          })
        } catch {}
      }

      return { ...finalResult, fromCache: false }
    } catch (error: any) {
      if (filters?.processoId) {
        try {
          const rev = await api.get(`/publicacao/${filters.processoId}/revisao`)
          if (rev.data?.feicoesGeoJson?.features && rev.data.feicoesGeoJson.features.length > 0) {
            return { ...rev.data.feicoesGeoJson, fromCache: false }
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
   * Tenta rota de revisão de publicação, rota de carga e fallback para /mapa/camadas,
   * consultando o cache local para carregamento instantâneo.
   */
  async getProcessPreviewGeometry(
    processoId: string | number,
    options?: { forceRefresh?: boolean; versao?: string },
  ): Promise<any | null> {
    if (!processoId) return null

    const baseId = `preview_${processoId}`

    if (!options?.forceRefresh) {
      try {
        const cached = await geojsonCache.get({
          baseId,
          versao: options?.versao,
        })
        if (cached?.geojsonData && cached.geojsonData.features?.length > 0) {
          return cached.geojsonData
        }
      } catch {}
    }

    // 1. Tenta carregar da revisão de publicação
    try {
      const res = await api.get(`/publicacao/${processoId}/revisao`)
      const geojson = res.data?.feicoesGeoJson
      if (geojson && geojson.features && geojson.features.length > 0) {
        try {
          await geojsonCache.set({
            baseId,
            versao: options?.versao || 'oficial',
            safra: 'any',
            classificacaoAcesso: 'Pública',
            geojsonData: geojson,
          })
        } catch {}
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
        try {
          await geojsonCache.set({
            baseId,
            versao: options?.versao || 'oficial',
            safra: 'any',
            classificacaoAcesso: 'Pública',
            geojsonData: geojson,
          })
        } catch {}
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
        try {
          await geojsonCache.set({
            baseId,
            versao: options?.versao || 'oficial',
            safra: 'any',
            classificacaoAcesso: 'Pública',
            geojsonData: fallbackRes.data,
          })
        } catch {}
        return fallbackRes.data
      }
    } catch {
      // Não foi possível carregar do backend
    }

    return null
  },
}
