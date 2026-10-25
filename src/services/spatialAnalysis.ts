import api, { mockactive } from './api'
import { mockSpatialAnalysisResponse, mockSpatialDocuments } from './mocks/spatial-analysis.mock'
import { catalogoService } from './catalogo'

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

export const CAMADAS_REFERENCIA_OFICIAIS: SpatialAnalysisDocument[] = [
  {
    id: 'ref-app',
    name: 'Área de Preservação Permanente (APP)',
    category: 'APP',
    source: 'PostGIS / Novo Código Florestal',
    year: '',
    zone: 'REFERENCIA',
    status: 'DISPONIVEL',
    featureCount: 1,
  },
  {
    id: 'ref-reserva-legal',
    name: 'Reserva Legal (RL)',
    category: 'RESERVA_LEGAL',
    source: 'PostGIS / SICAR',
    year: '',
    zone: 'REFERENCIA',
    status: 'DISPONIVEL',
    featureCount: 1,
  },
  {
    id: 'ref-alerta',
    name: 'Alertas de Desmatamento e Embargos',
    category: 'ALERTA',
    source: 'PostGIS / DETER & IBAMA',
    year: '',
    zone: 'REFERENCIA',
    status: 'DISPONIVEL',
    featureCount: 1,
  },
]

const findMockDocument = (id: string) => mockSpatialDocuments.find((document) => document.id === id)

export const spatialAnalysisService = {
  /**
   * Lista documentos/camadas disponíveis para análise territorial.
   * Integra com o Catálogo de Bases (/catalogo/bases) da US09 e inclui
   * as camadas de referência oficiais do PostGIS (APP, Reserva Legal e Alertas).
   */
  async listDocuments(): Promise<SpatialAnalysisDocument[]> {
    try {
      const bases = await catalogoService.listarBases()
      let catalogDocs: SpatialAnalysisDocument[] = []

      if (bases && bases.length > 0) {
        catalogDocs = bases.map((b) => {
          const nomeConjunto = (b.conjunto || '').toUpperCase()
          const cat: SpatialLayerCategory = nomeConjunto.includes('ALERTA')
            ? 'ALERTA'
            : nomeConjunto.includes('APP')
              ? 'APP'
              : nomeConjunto.includes('RESERVA')
                ? 'RESERVA_LEGAL'
                : nomeConjunto.includes('INDIGENA')
                  ? 'TERRA_INDIGENA'
                  : 'CAR'

          return {
            id: String(b.id),
            name: `${b.conjunto || 'Base Territorial'} (${b.versao_oficial || 'Oficial'})`,
            category: cat,
            source: b.orgao || b.orgao_sigla || 'Órgão Oficial',
            year: b.ano_safra || '2026',
            zone: 'PUBLICADA',
            status: 'DISPONIVEL',
            featureCount: b.total_feicoes || 0,
          }
        })
      }

      // Garante que haja opções padrão do mock apenas se mockactive for true
      if (mockactive) {
        const hasCar = catalogDocs.some((d) => d.category === 'CAR')
        const mockCars = hasCar ? [] : mockSpatialDocuments.filter((d) => d.category === 'CAR')
        return [...catalogDocs, ...mockCars, ...mockSpatialDocuments.filter((d) => d.category !== 'CAR')]
      }

      // Inclui sempre as camadas de referência oficiais do PostGIS (APP, RESERVA_LEGAL, ALERTA)
      const referenciasPostGIS = CAMADAS_REFERENCIA_OFICIAIS.filter(
        (ref) => !catalogDocs.some((cd) => cd.id === ref.id),
      )

      return [...catalogDocs, ...referenciasPostGIS]
    } catch (error: any) {
      if (!mockactive) throw error
      console.warn('Usando bases demonstrativas para análise espacial:', error)
      return mockSpatialDocuments
    }
  },

  /**
   * Obtém as geometrias em GeoJSON da camada/documento selecionado.
   * Prioriza arquivos locais, depois a API /mapa/camadas (filtrada por BBox) e fallback nos mocks.
   */
  async getDocumentGeoJSON(
    documentId: string,
    bbox?: string,
  ): Promise<GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>> {
    if (documentId.startsWith('local-')) {
      const localGeometry = this.localDocuments.get(documentId)
      if (localGeometry) return localGeometry
    }

    // Se for ID numérico (base do catálogo), busca da API real /mapa/camadas
    if (/^\d+$/.test(documentId)) {
      try {
        const response = await api.get('/mapa/camadas', {
          params: {
            processoId: Number(documentId),
            bbox: bbox || undefined,
          },
        })
        if (response.data && response.data.type === 'FeatureCollection' && response.data.features?.length > 0) {
          return response.data
        }
      } catch {
        // Fallback silencioso
      }
    }

    // Se for camada de referência oficial (APP, RESERVA_LEGAL, ALERTA)
    if (documentId.startsWith('ref-')) {
      const mockDoc = mockSpatialDocuments.find((d) => {
        if (documentId.includes('app')) return d.category === 'APP'
        if (documentId.includes('reserva') || documentId.includes('rl')) return d.category === 'RESERVA_LEGAL'
        return d.category === 'ALERTA'
      })
      if (mockDoc?.geojson) return mockDoc.geojson
    }

    // Se não encontrou no banco e mockactive for false, retorna vazio
    if (!mockactive) {
      return { type: 'FeatureCollection', features: [] }
    }

    // Fallback para geometria pré-carregada do mock (quando mockactive for true)
    const localDocument = mockSpatialDocuments.find((document) => document.id === documentId)
    if (localDocument?.geojson) return localDocument.geojson
    const document = findMockDocument(documentId)
    if (document?.geojson) return document.geojson

    // Tenta /mapa/camadas com bbox
    try {
      const fallbackResponse = await api.get('/mapa/camadas', {
        params: bbox ? { bbox } : undefined,
      })
      if (fallbackResponse.data && fallbackResponse.data.type === 'FeatureCollection') {
        return fallbackResponse.data
      }
    } catch {
      // Retorna coleção vazia sem disparar erro 404 no console
    }

    return { type: 'FeatureCollection', features: [] }
  },

  /**
   * Executa o cruzamento espacial e cálculo de sobreposições.
   * Conecta com o endpoint real do backend: POST /analise/cruzamento (US06).
   */
  async calculate(request: SpatialAnalysisRequest): Promise<SpatialAnalysisResponse> {
    if (
      request.carDocumentId.startsWith('local-') ||
      request.restrictionDocumentIds.some((id) => id.startsWith('local-'))
    ) {
      throw new Error(
        'Arquivos importados nesta sessão servem para pré-visualização. Cadastre e processe o documento para calcular a sobreposição.',
      )
    }

    try {
      const processoIds: number[] = []
      if (/^\d+$/.test(request.carDocumentId)) {
        processoIds.push(Number(request.carDocumentId))
      }
      request.restrictionDocumentIds.forEach((id) => {
        if (/^\d+$/.test(id)) processoIds.push(Number(id))
      })

      // Mapeia restrições selecionadas para categorias correspondentes ['APP', 'RESERVA_LEGAL', 'ALERTA']
      const categoriasSet = new Set<string>()
      request.restrictionDocumentIds.forEach((id) => {
        const lower = id.toLowerCase()
        if (lower.includes('app')) {
          categoriasSet.add('APP')
        } else if (lower.includes('reserva') || lower.includes('rl')) {
          categoriasSet.add('RESERVA_LEGAL')
        } else if (lower.includes('alerta') || lower.includes('alert')) {
          categoriasSet.add('ALERTA')
        } else {
          const doc = mockSpatialDocuments.find((d) => d.id === id)
          if (doc && (doc.category === 'APP' || doc.category === 'RESERVA_LEGAL' || doc.category === 'ALERTA')) {
            categoriasSet.add(doc.category)
          }
        }
      })

      const categorias =
        categoriasSet.size > 0
          ? Array.from(categoriasSet).sort()
          : ['ALERTA', 'APP', 'RESERVA_LEGAL']

      const payload = {
        processoIds: processoIds.length > 0 ? processoIds : undefined,
        anoSafra: request.safra || undefined,
        categorias,
      }

      const response = await api.post('/analise/cruzamento', payload)
      const data = response.data

      if (data && Array.isArray(data.propriedades) && data.propriedades.length > 0) {
        const results: SpatialAnalysisResult[] = data.propriedades.map((p: any, idx: number) => {
          const areaHa = Number(p.areaImovelHectares) || 100
          const sobrepostaHa = Number(p.hectaresAfetados) || 0
          const percentual = areaHa > 0 ? Math.min(100, (sobrepostaHa / areaHa) * 100) : 0

          return {
            id: `res-${p.processoId || idx}-${p.codigoImovel || idx}`,
            codigoCar: p.codigoImovel || `CAR-${p.processoId || idx}`,
            safra: p.anoSafra || request.safra || '2026',
            areaImovelHa: areaHa,
            areaSobrepostaHa: sobrepostaHa,
            percentualSobreposicao: Number(percentual.toFixed(2)),
            status: 'PROCESSADO',
            message: p.sobreposicoes?.length
              ? `${p.sobreposicoes.length} sobreposição(ões) com áreas restritas detectada(s).`
              : 'Nenhuma sobreposição crítica detectada.',
          }
        })

        return {
          id: `analise-${Date.now()}`,
          status: 'CONCLUIDO',
          createdAt: new Date().toISOString(),
          results,
          source: 'API',
        }
      }

      if (!mockactive) {
        return {
          id: `analise-${Date.now()}`,
          status: 'CONCLUIDO',
          createdAt: new Date().toISOString(),
          results: [],
          source: 'API',
        }
      }

      return { ...mockSpatialAnalysisResponse, source: 'API' }
    } catch (error: any) {
      if (!mockactive) throw error
      console.warn('API /analise/cruzamento indisponível ou sem bases publicadas para o filtro. Usando dados demonstrativos:', error)
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
