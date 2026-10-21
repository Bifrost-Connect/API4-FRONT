import api, { mockactive } from './api'
import { mockSpatialAnalysisResponse, mockSpatialDocuments } from './mocks/spatial-analysis.mock'

export type SpatialLayerCategory = 'CAR' | 'ALERTA' | 'APP' | 'RESERVA_LEGAL' | 'TERRA_INDIGENA'

export interface SpatialAnalysisDocument {
  id: string
  name: string
  category: SpatialLayerCategory
  source: string
  year: string
  zone: string
  status: string
  featureCount: number
  geojson?: GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>
  localOnly?: boolean
}

export interface SpatialAnalysisRequest {
  carDocumentId: string
  restrictionDocumentIds: string[]
  safra: string
}

export interface SpatialAnalysisResult {
  id: string
  codigoCar: string
  safra: string
  areaImovelHa: number
  areaSobrepostaHa: number
  percentualSobreposicao: number
  status: 'PROCESSADO' | 'FALHA_ANALITICA'
  message?: string
  geometry?: GeoJSON.Geometry
}

export interface SpatialAnalysisResponse {
  id: string
  status: string
  createdAt: string
  results: SpatialAnalysisResult[]
  source?: 'API' | 'DEMONSTRACAO'
}

const findMockDocument = (id: string) => mockSpatialDocuments.find((document) => document.id === id)

export const spatialAnalysisService = {
  async listDocuments(): Promise<SpatialAnalysisDocument[]> {
    try {
      const response = await api.get('/analises-espaciais/documentos', {
        params: { zone: 'TRATADA', status: 'DISPONIVEL' },
      })
      return Array.isArray(response.data) ? response.data : response.data.content ?? []
    } catch (error: any) {
      if (mockactive) throw error
      if (error.response && error.response.status !== 404) throw error.response.data || error
      return mockSpatialDocuments
    }
  },

  async getDocumentGeoJSON(
    documentId: string,
    bbox?: string,
  ): Promise<GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>> {
    const localDocument = mockSpatialDocuments.find((document) => document.id === documentId)
    if (documentId.startsWith('local-')) {
      const localGeometry = this.localDocuments.get(documentId)
      if (localGeometry) return localGeometry
    }

    try {
      const response = await api.get(`/analises-espaciais/documentos/${encodeURIComponent(documentId)}/geojson`, {
        params: bbox ? { bbox } : undefined,
      })
      return response.data
    } catch (error: any) {
      if (mockactive) throw error
      if (error.response && error.response.status !== 404) throw error.response.data || error
      if (localDocument?.geojson) return localDocument.geojson
      const document = findMockDocument(documentId)
      if (document?.geojson) return document.geojson
      throw new Error('A geometria deste documento ainda não está disponível.')
    }
  },

  async calculate(request: SpatialAnalysisRequest): Promise<SpatialAnalysisResponse> {
    if (request.carDocumentId.startsWith('local-') || request.restrictionDocumentIds.some((id) => id.startsWith('local-'))) {
      throw new Error('Arquivos importados nesta sessão servem para pré-visualização. Cadastre e processe o documento para calcular a sobreposição.')
    }

    try {
      const response = await api.post('/analises-espaciais/sobreposicoes', request)
      return { ...response.data, source: 'API' }
    } catch (error: any) {
      if (mockactive) throw error
      if (error.response && error.response.status !== 404) throw error.response.data || error
      return { ...mockSpatialAnalysisResponse, source: 'DEMONSTRACAO' }
    }
  },

  localDocuments: new Map<string, GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>>(),

  registerLocalDocument(
    document: Omit<SpatialAnalysisDocument, 'localOnly'>,
    geometry: GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>,
  ): SpatialAnalysisDocument {
    this.localDocuments.set(document.id, geometry)
    return { ...document, localOnly: true }
  },
}
