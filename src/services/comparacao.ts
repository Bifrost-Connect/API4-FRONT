import axios from 'axios'
import api from './api'

type FeatureCollection = GeoJSON.FeatureCollection

export interface PublishedSeason {
  id: string
  year: string
  version: string
  datasetId: string
  dataset: string
}

export interface ComparisonParameters {
  seasonA: string
  seasonB: string
  bbox: string
}

export interface PairedLayers {
  cargaA: FeatureCollection
  cargaB: FeatureCollection
  simplificada?: boolean
}

export interface EvolutionMetrics {
  areaSafraAHectares: number
  areaSafraBHectares: number
  saldoVariacaoHectares: number
  areaAumentoHectares: number
  areaReducaoHectares: number
  areaMantidaHectares: number
  simplificada?: boolean
  geoJsonClassificado: FeatureCollection
}

type CatalogRow = Record<string, unknown>
const timeout = 30_000

export function normalizeBbox(bbox: string): string {
  const trimmed = bbox.trim()
  if (!trimmed) return ''
  const parts = trimmed.split(',').map((p) => p.trim())
  if (parts.length !== 4 || parts.some((p) => p === '')) {
    return trimmed
  }
  const nums = parts.map(Number)
  if (nums.some((n) => !Number.isFinite(n))) {
    return trimmed
  }
  return nums.map((n) => String(Number(n.toFixed(4)))).join(',')
}

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

function withAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(createAbortError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

async function runCachedRequest<T>(
  cache: Map<string, T>,
  inFlight: Map<string, Promise<T>>,
  cacheKey: string,
  fetcher: () => Promise<T>,
  signal?: AbortSignal,
  options?: { forceRefresh?: boolean },
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError())
  }
  if (!options?.forceRefresh && cache.has(cacheKey)) {
    return cache.get(cacheKey)!
  }
  if (!options?.forceRefresh && inFlight.has(cacheKey)) {
    return withAbortSignal(inFlight.get(cacheKey)!, signal)
  }

  const request = fetcher()
    .then((result) => {
      if (inFlight.get(cacheKey) === request) {
        cache.set(cacheKey, result)
      }
      return result
    })
    .finally(() => {
      if (inFlight.get(cacheKey) === request) {
        inFlight.delete(cacheKey)
      }
    })

  inFlight.set(cacheKey, request)
  return request
}

const normalizeStatus = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s_-]/g, '')

// pronta_para_consulta is the official catalogue's publication/approval predicate.
// Explicit negative flags and incompatible stage/status always take precedence.
export function isPublishedSeason(row: CatalogRow): boolean {
  if (row.versao_fechada === false || row.pronta_para_consulta === false) return false
  if (row.versao_fechada !== true && row.pronta_para_consulta !== true) return false
  const stage = normalizeStatus(row.etapa_atual)
  const status = normalizeStatus(row.situacao)
  return (!stage || stage === 'PUBLICACAO') && (!status || status === 'CONCLUIDA')
}

export function normalizePublishedSeasons(rows: CatalogRow[]): PublishedSeason[] {
  return rows.filter(isPublishedSeason).flatMap((row) => {
    if (row.id == null || row.conjunto_id == null || !row.ano_safra) return []
    return [
      {
        id: String(row.id),
        year: String(row.ano_safra),
        version: String(row.versao_oficial ?? `Carga ${row.id}`),
        datasetId: String(row.conjunto_id),
        dataset: String(row.conjunto ?? `Conjunto ${row.conjunto_id}`),
      },
    ]
  })
}

export function readFeatureCollection(value: unknown): FeatureCollection {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('type' in parsed) ||
    parsed.type !== 'FeatureCollection' ||
    !('features' in parsed) ||
    !Array.isArray(parsed.features) ||
    parsed.features.some(
      (feature: unknown) =>
        !feature ||
        typeof feature !== 'object' ||
        !('type' in feature) ||
        feature.type !== 'Feature' ||
        !('geometry' in feature),
    )
  ) {
    throw new Error('O servidor retornou uma camada geográfica inválida. Tente novamente.')
  }
  return parsed as FeatureCollection
}

export function comparisonErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'A comparação demorou mais que o esperado. Tente novamente ou selecione uma área menor.'
    }
    const messages: Record<number, string> = {
      400: 'Escolha versões diferentes de um mesmo conjunto e confira o recorte geográfico.',
      401: 'Sua sessão expirou. Entre novamente para comparar as safras.',
      403: 'A comparação exige acesso de Analista e duas versões oficialmente publicadas.',
      404: 'Os dados ou o serviço de comparação não estão disponíveis neste servidor.',
      413: 'A área selecionada é muito extensa. Aproxime o mapa e use um recorte menor.',
      422: 'Uma das safras não possui cobertura compatível com a outra na região escolhida. Selecione outra área ou outra safra.',
    }
    return (
      messages[error.response?.status ?? 0] ??
      'Não foi possível comunicar com o servidor. Tente novamente.'
    )
  }
  return error instanceof Error ? error.message : 'Não foi possível executar a comparação.'
}

export const comparisonService = {
  seasonsCache: null as PublishedSeason[] | null,
  seasonsInFlight: null as Promise<PublishedSeason[]> | null,
  pairedLayersCache: new Map<string, PairedLayers>(),
  pairedLayersInFlight: new Map<string, Promise<PairedLayers>>(),
  evolutionCache: new Map<string, EvolutionMetrics>(),
  evolutionInFlight: new Map<string, Promise<EvolutionMetrics>>(),

  clearCache(): void {
    this.seasonsCache = null
    this.seasonsInFlight = null
    this.pairedLayersCache.clear()
    this.pairedLayersInFlight.clear()
    this.evolutionCache.clear()
    this.evolutionInFlight.clear()
  },

  async listPublishedSeasons(
    signal?: AbortSignal,
    options?: { forceRefresh?: boolean },
  ): Promise<PublishedSeason[]> {
    if (signal?.aborted) {
      return Promise.reject(createAbortError())
    }
    if (!options?.forceRefresh && this.seasonsCache) {
      return [...this.seasonsCache]
    }
    if (!options?.forceRefresh && this.seasonsInFlight) {
      return withAbortSignal(
        this.seasonsInFlight.then((items) => [...items]),
        signal,
      )
    }

    const request = (async (): Promise<PublishedSeason[]> => {
      const seasons = new Map<string, PublishedSeason>()
      let page = 0
      let totalPages = 1
      do {
        const response = await api.get('/catalogo/bases', {
          params: { apenas_disponiveis: true, page, size: 100 },
          signal,
          timeout,
        })
        if (response.status === 204) break
        const data = response.data
        const rows = Array.isArray(data) ? data : data?.items
        if (!Array.isArray(rows))
          throw new Error('Não foi possível ler as safras publicadas do catálogo.')
        for (const season of normalizePublishedSeasons(rows)) seasons.set(season.id, season)
        totalPages = Array.isArray(data) ? 1 : Number(data.total_pages ?? 1)
        if (!Number.isInteger(totalPages) || totalPages < 0) {
          throw new Error('O catálogo retornou uma paginação inválida.')
        }
        page++
      } while (page < totalPages)
      const result = [...seasons.values()].sort(
        (a, b) =>
          b.year.localeCompare(a.year) || b.id.localeCompare(a.id, undefined, { numeric: true }),
      )
      return result
    })()
      .then((result) => {
        if (result.length > 0 && this.seasonsInFlight === request) {
          this.seasonsCache = result
        }
        return result
      })
      .finally(() => {
        if (this.seasonsInFlight === request) {
          this.seasonsInFlight = null
        }
      })

    this.seasonsInFlight = request
    return request.then((items) => [...items])
  },

  async getPairedLayers(
    parameters: ComparisonParameters,
    signal?: AbortSignal,
    options?: { forceRefresh?: boolean },
  ): Promise<PairedLayers> {
    const normalizedBbox = normalizeBbox(parameters.bbox)
    const cacheKey = `${parameters.seasonA}::${parameters.seasonB}::${normalizedBbox}`
    return runCachedRequest(
      this.pairedLayersCache,
      this.pairedLayersInFlight,
      cacheKey,
      async () => {
        const response = await api.get('/analise/comparacao/camadas', {
          params: {
            id_carga_a: parameters.seasonA,
            id_carga_b: parameters.seasonB,
            bbox: normalizedBbox,
          },
          signal,
          timeout,
        })
        return {
          cargaA: readFeatureCollection(response.data?.cargaA),
          cargaB: readFeatureCollection(response.data?.cargaB),
          simplificada: response.data?.simplificada === true,
        }
      },
      signal,
      options,
    )
  },

  async getEvolution(
    parameters: ComparisonParameters,
    signal?: AbortSignal,
    options?: { forceRefresh?: boolean },
  ): Promise<EvolutionMetrics> {
    const normalizedBbox = normalizeBbox(parameters.bbox)
    const cacheKey = `${parameters.seasonA}::${parameters.seasonB}::${normalizedBbox}`
    return runCachedRequest(
      this.evolutionCache,
      this.evolutionInFlight,
      cacheKey,
      async () => {
        const response = await api.post(
          '/analise/comparacao/evolucao',
          {
            safraAId: Number(parameters.seasonA),
            safraBId: Number(parameters.seasonB),
            bbox: normalizedBbox,
          },
          { signal, timeout },
        )
        const data = response.data
        const fields = [
          'areaSafraAHectares',
          'areaSafraBHectares',
          'saldoVariacaoHectares',
          'areaAumentoHectares',
          'areaReducaoHectares',
          'areaMantidaHectares',
        ] as const
        for (const field of fields) {
          if (typeof data?.[field] !== 'number' || !Number.isFinite(data[field])) {
            throw new Error('O servidor retornou métricas incompletas. Tente novamente.')
          }
        }
        return { ...data, geoJsonClassificado: readFeatureCollection(data.geoJsonClassificado) }
      },
      signal,
      options,
    )
  },
}
