/**
 * Serviço de integração com o Catálogo de Bases Geoespaciais (US09 - Tarefas 7 e 8).
 */
import api, { mockactive } from './api'

export interface CatalogoFilters {
  conjuntoId?: number | string
  anoSafra?: string
}

export interface CatalogoBase {
  id: number
  ano_safra: string
  versao_oficial: string
  data_publicacao: string
  epsg_destino?: string
  conjunto_id?: number
  conjunto?: string
  orgao_id?: number
  orgao?: string
  orgao_sigla?: string
  total_feicoes: number
}

export const catalogoService = {
  /**
   * Consulta o catálogo de bases disponíveis/publicadas (US09 - Tarefa 7 e 8)
   */
  async listarBases(filters?: CatalogoFilters): Promise<CatalogoBase[]> {
    try {
      const response = await api.get('/catalogo/bases', { params: filters })
      if (response.status === 204 || !response.data) {
        return []
      }
      return Array.isArray(response.data) ? response.data : []
    } catch (error: any) {
      if (!mockactive) throw error
      console.warn('Falha ao buscar catálogo de bases da API.', error)
      return []
    }
  },

  /**
   * Obtém detalhes de uma base publicada pelo ID
   */
  async buscarDetalhesBase(idBase: number | string): Promise<CatalogoBase | null> {
    try {
      const response = await api.get(`/catalogo/bases/${idBase}`)
      return response.data
    } catch (error: any) {
      if (!mockactive) throw error
      console.warn(`Falha ao buscar detalhes da base ${idBase}.`, error)
      return null
    }
  },

  /**
   * Busca dados de linhagem e integridade (Hash de origem) se disponível
   */
  async buscarLinhagemBase(idBase: number | string): Promise<any | null> {
    try {
      const response = await api.get(`/indicadores/${idBase}/linhagem`)
      return response.data
    } catch {
      // Endpoint opcional ou base sem linhagem calculada
      return null
    }
  },

  /**
   * Tenta buscar prévia da tabela de atributos se o endpoint existir futuramente
   */
  async buscarPreviaAtributos(idBase: number | string): Promise<Record<string, any>[]> {
    try {
      const response = await api.get(`/catalogo/bases/${idBase}/previa`)
      if (response.status === 200 && Array.isArray(response.data)) {
        return response.data
      }
      return []
    } catch {
      // Fallback gracioso: backend ainda não expõe rota dedicada de prévia
      return []
    }
  },
}
