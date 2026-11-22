import { describe, it, expect, vi, beforeEach } from 'vitest'
import { spatialAnalysisService } from '../spatialAnalysis'
import { catalogoService } from '../catalogo'
import { geojsonCache } from '../storage/geojsonCache'
import api from '../api'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    default: {
      get: vi.fn<() => Promise<unknown>>(),
      post: vi.fn<() => Promise<unknown>>(),
    },
    mockactive: false,
  }
})

vi.mock('../catalogo', () => ({
  catalogoService: {
    listarBases: vi.fn<() => Promise<unknown>>(),
    buscarDetalhesBase: vi.fn<() => Promise<unknown>>(),
  },
}))

describe('Spatial Analysis Service', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    spatialAnalysisService.localDocuments.clear()
    spatialAnalysisService.clearCache()
    await geojsonCache.clearAll()
  })

  it('deve listar documentos territoriais com categorias mapeadas do catálogo', async () => {
    vi.mocked(catalogoService.listarBases).mockResolvedValueOnce([
      {
        id: 1,
        ano_safra: '2026',
        versao_oficial: 'v1.0',
        data_publicacao: '2026-10-20',
        total_feicoes: 50,
        conjunto: 'Imóveis Rurais CAR',
        orgao: 'INCRA',
      },
      {
        id: 2,
        ano_safra: '2026',
        versao_oficial: 'v1.0',
        data_publicacao: '2026-10-20',
        total_feicoes: 12,
        conjunto: 'Áreas de Preservação Permanente (APP)',
        orgao: 'INPE',
      },
    ])

    const docs = await spatialAnalysisService.listDocuments()
    expect(catalogoService.listarBases).toHaveBeenCalledWith({
      apenas_disponiveis: true,
      page: 0,
      size: 100,
      sort: 'data_publicacao',
      direcao: 'desc',
    })
    expect(docs.length).toBe(5)
    expect(docs[0]!.id).toBe('1')
    expect(docs[0]!.category).toBe('CAR')
    expect(docs[1]!.id).toBe('2')
    expect(docs[1]!.category).toBe('APP')
    expect(docs.some((d) => d.id === 'ref-app')).toBe(true)
    expect(docs.some((d) => d.id === 'ref-reserva-legal')).toBe(true)
    expect(docs.some((d) => d.id === 'ref-alerta')).toBe(true)
  })

  it('deve filtrar bases com pronta_para_consulta=false, cachear em memória e deduplicar chamadas concorrentes', async () => {
    let resolveBases!: (value: any[]) => void
    const pendingPromise = new Promise<any[]>((resolve) => {
      resolveBases = resolve
    })
    vi.mocked(catalogoService.listarBases).mockReturnValueOnce(pendingPromise)

    const p1 = spatialAnalysisService.listDocuments()
    const p2 = spatialAnalysisService.listDocuments()

    resolveBases([
      {
        id: 1,
        ano_safra: '2026',
        versao_oficial: 'v1.0',
        data_publicacao: '2026-10-20',
        total_feicoes: 50,
        conjunto: 'Imóveis Rurais CAR',
        orgao: 'INCRA',
        pronta_para_consulta: true,
      },
      {
        id: 2,
        ano_safra: '2026',
        versao_oficial: 'v1.0',
        data_publicacao: '2026-10-20',
        total_feicoes: 10,
        conjunto: 'Áreas de Preservação Permanente (APP)',
        orgao: 'INPE',
        pronta_para_consulta: false,
      },
    ])

    const [docs1, docs2] = await Promise.all([p1, p2])
    expect(catalogoService.listarBases).toHaveBeenCalledTimes(1)
    expect(docs1.map((d) => d.id)).toEqual(['1', 'ref-app', 'ref-reserva-legal', 'ref-alerta'])
    expect(docs2).toEqual(docs1)

    const docs3 = await spatialAnalysisService.listDocuments()
    expect(catalogoService.listarBases).toHaveBeenCalledTimes(1)
    expect(docs3).toEqual(docs1)

    vi.mocked(catalogoService.listarBases).mockResolvedValueOnce([])
    const docsRefreshed = await spatialAnalysisService.listDocuments({ forceRefresh: true })
    expect(catalogoService.listarBases).toHaveBeenCalledTimes(2)
    expect(docsRefreshed.map((d) => d.id)).toEqual(['ref-app', 'ref-reserva-legal', 'ref-alerta'])
  })

  it('deve retornar as camadas de referência quando o catálogo for vazio e mockactive for false', async () => {
    vi.mocked(catalogoService.listarBases).mockResolvedValueOnce([])

    const docs = await spatialAnalysisService.listDocuments()
    expect(docs.length).toBe(3)
    expect(docs.map((d) => d.id)).toEqual(['ref-app', 'ref-reserva-legal', 'ref-alerta'])
  })

  it('deve registrar e recuperar documento local pré-carregado na sessão', async () => {
    const geojson: GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-47.88, -15.79],
                [-47.80, -15.79],
                [-47.80, -15.85],
                [-47.88, -15.85],
                [-47.88, -15.79],
              ],
            ],
          },
          properties: { id: 'local-1' },
        },
      ],
    }

    const doc = spatialAnalysisService.registerLocalDocument(
      {
        id: 'local-teste-1',
        name: 'Camada Local Teste',
        category: 'CAR',
        source: 'Upload Local',
        year: '2026',
        zone: 'SESSAO',
        status: 'CARREGADO',
        featureCount: 1,
      },
      geojson,
    )

    expect(doc.localOnly).toBe(true)
    const retrievedGeoJson = await spatialAnalysisService.getDocumentGeoJSON('local-teste-1')
    expect(retrievedGeoJson).toEqual(geojson)
  })

  it('deve normalizar bbox, passar size=250 e processoId, cachear GeoJSON (inclusive vazio) e deduplicar chamadas concorrentes sem fallback global', async () => {
    const featureCollection: GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-50.1, -20.1] },
          properties: { id: 1 },
        },
      ],
    }

    let resolveApi!: (value: any) => void
    const pendingApi = new Promise((resolve) => {
      resolveApi = resolve
    })
    vi.mocked(api.get).mockReturnValueOnce(pendingApi as any)

    const g1 = spatialAnalysisService.getDocumentGeoJSON('10', '-50.123456,-20.1,-40,-10')
    const g2 = spatialAnalysisService.getDocumentGeoJSON('10', '-50.123111,-20.1004,-40.0001,-10.0002')
    resolveApi({ data: featureCollection })

    const [res1, res2] = await Promise.all([g1, g2])
    expect(res1).toEqual(featureCollection)
    expect(res2).toEqual(featureCollection)
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.get).toHaveBeenCalledWith('/mapa/camadas', {
      params: {
        processoId: 10,
        bbox: '-50.123,-20.1,-40,-10',
        size: 250,
      },
    })

    const res3 = await spatialAnalysisService.getDocumentGeoJSON('10', '-50.123,-20.1,-40,-10')
    expect(res3).toEqual(featureCollection)
    expect(api.get).toHaveBeenCalledTimes(1)

    // Empty FeatureCollection for numeric ID: must cache in memory and NOT fall back to global /mapa/camadas
    const emptyCollection: GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>> = {
      type: 'FeatureCollection',
      features: [],
    }
    vi.mocked(api.get).mockResolvedValueOnce({ data: emptyCollection } as any)

    const emptyRes1 = await spatialAnalysisService.getDocumentGeoJSON('11', '-50,-20,-40,-10')
    expect(emptyRes1).toEqual(emptyCollection)
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(api.get).toHaveBeenLastCalledWith('/mapa/camadas', {
      params: {
        processoId: 11,
        bbox: '-50,-20,-40,-10',
        size: 250,
      },
    })

    const emptyRes2 = await spatialAnalysisService.getDocumentGeoJSON('11', '-50,-20,-40,-10')
    expect(emptyRes2).toEqual(emptyCollection)
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('deve calcular cruzamento territorial chamando POST /analise/cruzamento com apenas CAR em processoIds', async () => {
    const apiResponse = {
      propriedades: [
        {
          processoId: 10,
          codigoImovel: 'CAR-MS-001',
          anoSafra: '2026',
          areaImovelHectares: 200,
          hectaresAfetados: 50,
          sobreposicoes: [
            {
              categoria: 'APP',
              fonte: 'INCAR_APP',
              alerta: 'APP Hídrica',
              hectares: 50,
            },
          ],
        },
      ],
    }

    vi.mocked(api.post).mockResolvedValueOnce({
      data: apiResponse,
    } as any)

    const result = await spatialAnalysisService.calculate({
      carDocumentId: '10',
      restrictionDocumentIds: ['20'],
      safra: '2026',
    })

    expect(api.post).toHaveBeenCalledWith('/analise/cruzamento', {
      processoIds: [10],
      anoSafra: '2026',
      categorias: ['ALERTA', 'APP', 'RESERVA_LEGAL'],
    })
    expect(result.status).toBe('CONCLUIDO')
    expect(result.results.length).toBe(1)
    expect(result.results[0]!.codigoCar).toBe('CAR-MS-001')
    expect(result.results[0]!.percentualSobreposicao).toBe(25) // (50/200)*100
  })

  it('deve resolver categorias pelo cache do catálogo e cachear a resposta do cálculo', async () => {
    vi.mocked(catalogoService.listarBases).mockResolvedValueOnce([
      {
        id: 10,
        ano_safra: '2026',
        versao_oficial: 'v1.0',
        data_publicacao: '2026-10-20',
        total_feicoes: 50,
        conjunto: 'Imóveis Rurais CAR',
      },
      {
        id: 20,
        ano_safra: '2026',
        versao_oficial: 'v1.0',
        data_publicacao: '2026-10-20',
        total_feicoes: 15,
        conjunto: 'Terras Indígenas',
      },
      {
        id: 21,
        ano_safra: '2026',
        versao_oficial: 'v1.0',
        data_publicacao: '2026-10-20',
        total_feicoes: 20,
        conjunto: 'Reserva Legal',
      },
    ])

    await spatialAnalysisService.listDocuments()

    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        propriedades: [
          {
            processoId: 10,
            codigoImovel: 'CAR-MS-002',
            anoSafra: '2026',
            areaImovelHectares: 100,
            hectaresAfetados: 10,
            sobreposicoes: [],
          },
        ],
      },
    } as any)

    const calc1 = await spatialAnalysisService.calculate({
      carDocumentId: '10',
      restrictionDocumentIds: ['21', '20'],
      safra: '2026',
    })

    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/analise/cruzamento', {
      processoIds: [10],
      anoSafra: '2026',
      categorias: ['ALERTA', 'RESERVA_LEGAL'],
    })

    const calc2 = await spatialAnalysisService.calculate({
      carDocumentId: '10',
      restrictionDocumentIds: ['20', '21'],
      safra: '2026',
    })

    expect(api.post).toHaveBeenCalledTimes(1)
    expect(calc2).toEqual(calc1)
  })

  it('deve bloquear cálculo de sobreposição com arquivos locais não persistidos', async () => {
    await expect(
      spatialAnalysisService.calculate({
        carDocumentId: 'local-1',
        restrictionDocumentIds: ['2'],
        safra: '2026',
      }),
    ).rejects.toThrow('Arquivos importados nesta sessão servem para pré-visualização')
  })
})

