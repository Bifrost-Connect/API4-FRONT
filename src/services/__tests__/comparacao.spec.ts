import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import api from '../api'
import {
  comparisonService,
  comparisonErrorMessage,
  normalizePublishedSeasons,
  readFeatureCollection,
} from '../comparacao'

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
const published = {
  id: 1,
  conjunto_id: 2,
  conjunto: 'Alertas',
  ano_safra: '2023',
  versao_oficial: 'v1',
  pronta_para_consulta: true,
  etapa_atual: 'PUBLICACAO',
  situacao: 'CONCLUIDA',
}
const collection = { type: 'FeatureCollection', features: [] }
const parameters = { seasonA: '1', seasonB: '2', bbox: '-50,-20,-40,-10' }

beforeEach(() => vi.clearAllMocks())

describe('contrato de comparação existente', () => {
  it('exclui versões abertas, reprovadas, não prontas ou com metadados incompletos', () => {
    expect(
      normalizePublishedSeasons([
        published,
        { ...published, id: 2, versao_fechada: false },
        { ...published, id: 3, pronta_para_consulta: false, versao_fechada: true },
        { ...published, id: 4, situacao: 'REPROVADA' },
        { ...published, id: 5, etapa_atual: 'TRATAMENTO' },
        { ...published, id: 6, pronta_para_consulta: undefined },
        { ...published, id: 7, conjunto_id: null },
      ]),
    ).toEqual([{ id: '1', year: '2023', version: 'v1', datasetId: '2', dataset: 'Alertas' }])
  })

  it('percorre todas as páginas de versões publicadas do catálogo', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { items: [published], total_pages: 2 } })
      .mockResolvedValueOnce({
        data: { items: [{ ...published, id: 2, ano_safra: '2025' }], total_pages: 2 },
      })
    const controller = new AbortController()
    expect(
      (await comparisonService.listPublishedSeasons(controller.signal)).map((s) => s.id),
    ).toEqual(['2', '1'])
    expect(api.get).toHaveBeenLastCalledWith(
      '/catalogo/bases',
      expect.objectContaining({
        params: { apenas_disponiveis: true, page: 1, size: 100 },
        signal: controller.signal,
      }),
    )
  })

  it('aceita catálogo vazio e rejeita formato ou paginação incompatíveis', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ status: 204 })
    expect(await comparisonService.listPublishedSeasons()).toEqual([])
    vi.mocked(api.get).mockResolvedValueOnce({ data: { content: [published] } })
    await expect(comparisonService.listPublishedSeasons()).rejects.toThrow('safras publicadas')
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [], total_pages: NaN } })
    await expect(comparisonService.listPublishedSeasons()).rejects.toThrow('paginação inválida')
  })

  it('envia os mesmos IDs e recorte nas camadas pareadas e no cálculo regional', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { cargaA: collection, cargaB: collection, simplificada: true },
    })
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        areaSafraAHectares: 40,
        areaSafraBHectares: 70,
        saldoVariacaoHectares: 30,
        areaAumentoHectares: 35,
        areaReducaoHectares: 5,
        areaMantidaHectares: 35,
        geoJsonClassificado: JSON.stringify(collection),
      },
    })
    expect((await comparisonService.getPairedLayers(parameters)).simplificada).toBe(true)
    expect((await comparisonService.getEvolution(parameters)).geoJsonClassificado).toEqual(
      collection,
    )
    expect(api.get).toHaveBeenCalledWith(
      '/analise/comparacao/camadas',
      expect.objectContaining({
        params: { id_carga_a: '1', id_carga_b: '2', bbox: parameters.bbox },
      }),
    )
    expect(api.post).toHaveBeenCalledWith(
      '/analise/comparacao/evolucao',
      {
        safraAId: 1,
        safraBId: 2,
        bbox: parameters.bbox,
      },
      expect.any(Object),
    )
  })

  it('recusa métricas incompletas e camadas inválidas', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { areaSafraAHectares: 40 } })
    await expect(comparisonService.getEvolution(parameters)).rejects.toThrow('métricas incompletas')
    expect(() => readFeatureCollection({ type: 'FeatureCollection', features: [null] })).toThrow(
      'inválida',
    )
    expect(() => readFeatureCollection({ type: 'Polygon' })).toThrow('inválida')
  })

  it.each([400, 401, 403, 404, 413, 422])('explica falhas HTTP %s', (status) => {
    const error = new AxiosError('failure')
    error.response = { status } as AxiosError['response']
    expect(comparisonErrorMessage(error)).not.toContain('comunicar')
  })

  it('orienta reduzir o recorte e tentar novamente em um timeout', () => {
    expect(comparisonErrorMessage(new AxiosError('timeout', 'ECONNABORTED'))).toContain(
      'área menor',
    )
  })
})
