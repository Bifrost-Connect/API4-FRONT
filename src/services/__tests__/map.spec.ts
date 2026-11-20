import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { mapService, type PublishedLocation } from '../map'
import api from '../api'
import { geojsonCache } from '../storage/geojsonCache'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    default: {
      get: vi.fn<(...args: unknown[]) => Promise<AxiosResponse>>(),
      post: vi.fn<(...args: unknown[]) => Promise<AxiosResponse>>(),
    },
    mockactive: false,
  }
})

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as InternalAxiosRequestConfig,
})

describe('Map Service', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await geojsonCache.clearAll()
  })

  it('deve buscar locais publicados do mapa via /mapa/camadas-legado com total_feicoes', async () => {
    const mockLocationsData: PublishedLocation[] = [
      {
        id: '1',
        name: 'Ponto A',
        type: 'CAR (2026)',
        latitude: -15.793,
        longitude: -47.882,
        status: 'Concluída',
        total_feicoes: 42,
      },
    ]

    vi.mocked(api.get).mockResolvedValueOnce(createAxiosResponse(mockLocationsData))

    const result = await mapService.getPublishedLocations()
    expect(api.get).toHaveBeenCalledWith('/mapa/camadas-legado')
    expect(result).toEqual(mockLocationsData)
    expect(result[0]?.total_feicoes).toBe(42)
  })

  it('deve retornar lista vazia quando /mapa/camadas-legado estiver vazio e mockactive for false', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(createAxiosResponse([]))

    const result = await mapService.getPublishedLocations()
    expect(result).toEqual([])
  })

  it('deve buscar camadas territoriais em formato GeoJSON FeatureCollection', async () => {
    const geojsonData = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-47.882, -15.793] },
          properties: { id: 1, nome: 'Área 1' },
        },
      ],
      totalElements: 1,
    }

    vi.mocked(api.get).mockResolvedValueOnce(createAxiosResponse(geojsonData))

    const result = await mapService.getTerritories({ conjuntoId: 1, anoSafra: '2026' })
    expect(api.get).toHaveBeenCalledWith('/mapa/camadas', {
      params: { conjuntoId: 1, anoSafra: '2026' },
    })
    expect(result.type).toBe('FeatureCollection')
    expect(result.features.length).toBe(1)
  })

  it('deve encaminhar baseId e processoId e reutilizar cache chaveado por targetBaseId', async () => {
    const geojsonData = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-47.882, -15.793] },
          properties: { id: 10, processoId: 42 },
        },
      ],
    }

    vi.mocked(api.get).mockResolvedValueOnce(createAxiosResponse(geojsonData))

    const first = await mapService.getTerritories({ baseId: 42 })
    expect(api.get).toHaveBeenCalledWith('/mapa/camadas', {
      params: { baseId: 42, processoId: 42 },
    })
    expect(first.fromCache).toBe(false)

    // Deve recuperar do cache local usando o mesmo targetBaseId sem chamar a API
    const second = await mapService.getTerritories({ processoId: 42 })
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(second.fromCache).toBe(true)
    expect(second.features.length).toBe(1)
  })

  it('deve recorrer a /publicacao/{targetBaseId}/revisao quando filtrado por baseId e /mapa/camadas retornar vazio', async () => {
    const emptyGeoJson = {
      type: 'FeatureCollection',
      features: [],
    }
    const revisionGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-47.9, -15.8] },
          properties: { id: 99 },
        },
      ],
    }

    vi.mocked(api.get)
      .mockResolvedValueOnce(createAxiosResponse(emptyGeoJson))
      .mockResolvedValueOnce(createAxiosResponse({ feicoesGeoJson: revisionGeoJson }))

    const result = await mapService.getTerritories({ baseId: 77 })
    expect(api.get).toHaveBeenNthCalledWith(1, '/mapa/camadas', {
      params: { baseId: 77, processoId: 77 },
    })
    expect(api.get).toHaveBeenNthCalledWith(2, '/publicacao/77/revisao')
    expect(result.features.length).toBe(1)
  })

  it('deve propagar erro de falha ao buscar camadas territoriais quando mockactive for false', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Erro de conexão com mapa'))

    await expect(mapService.getTerritories()).rejects.toThrow('Erro de conexão com mapa')
  })

  it('deve buscar detalhes da feição por id do polígono', async () => {
    const feicaoData = {
      idPoligono: 10,
      areaHectares: 154.5,
      codigoImovel: 'MS-54321',
    }

    vi.mocked(api.get).mockResolvedValueOnce(createAxiosResponse(feicaoData))

    const result = await mapService.getFeatureDetails(10)
    expect(api.get).toHaveBeenCalledWith('/mapa/feicoes/10')
    expect(result).toEqual(feicaoData)
  })

  it('deve aprovar tratamento da carga chamando a API de publicação', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(
      createAxiosResponse({ sucesso: true, mensagem: 'Carga aprovada para publicação' }),
    )

    const result = await mapService.aprovarTratamento(7, 1, 'Parecer favorável')
    expect(api.post).toHaveBeenCalledWith('/publicacao/7/aprovar-tratamento', {
      gestorId: 1,
      parecer: 'Parecer favorável',
    })
    expect(result.sucesso).toBe(true)
  })
})
