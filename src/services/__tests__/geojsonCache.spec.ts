import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  geojsonCache,
  MAX_CACHED_LAYERS,
} from '../storage/geojsonCache'
import { mapService } from '../map'
import api from '../api'

describe('Cache Local de Camadas e Geometrias GeoJSON (geojsonCache)', () => {
  beforeEach(async () => {
    await geojsonCache.clearAll()
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    await geojsonCache.clearAll()
  })

  const mockGeoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-47.93, -15.78],
              [-47.90, -15.78],
              [-47.90, -15.80],
              [-47.93, -15.80],
              [-47.93, -15.78],
            ],
          ],
        },
        properties: { id: 101, codigoImovel: 'CAR-DF-001', areaHectares: 120 },
      },
    ],
  }

  describe('Armazenamento, Consulta e Agilidade (Cache Hit)', () => {
    it('armazena e recupera a coleção GeoJSON corretamente', async () => {
      await geojsonCache.set({
        baseId: 'base-101',
        versao: 'v1.0',
        safra: '2026',
        classificacaoAcesso: 'Pública',
        geojsonData: mockGeoJson,
      })

      const cached = await geojsonCache.get({
        baseId: 'base-101',
        versao: 'v1.0',
        safra: '2026',
      })

      expect(cached).not.toBeNull()
      expect(cached?.baseId).toBe('base-101')
      expect(cached?.featureCount).toBe(1)
      expect(cached?.geojsonData.features[0].properties.codigoImovel).toBe('CAR-DF-001')
    })

    it('retorna null (Cache Miss) para chaves inexistentes', async () => {
      const result = await geojsonCache.get({ baseId: 'nao_existe' })
      expect(result).toBeNull()
    })
  })

  describe('Invalidação por Versão, Safra, Hash e Expiração (TTL)', () => {
    it('invalida o cache anterior quando a versão oficial for diferente', async () => {
      await geojsonCache.set({
        baseId: 'base-200',
        versao: 'v1.0',
        safra: '2025',
        classificacaoAcesso: 'Pública',
        geojsonData: mockGeoJson,
      })

      // Consulta solicitando versão v2.0 mais recente
      const queryResult = await geojsonCache.get({
        baseId: 'base-200',
        versao: 'v2.0',
      })

      expect(queryResult).toBeNull()

      // Confirma que a versão antiga foi removida do cache daquela base
      const stats = await geojsonCache.getStats()
      expect(stats.keys.some((k) => k.includes('base-200'))).toBe(false)
    })

    it('invalida o cache quando o hash de integridade divergir', async () => {
      await geojsonCache.set({
        baseId: 'base-300',
        versao: 'v1.0',
        safra: '2026',
        hash: 'hash_original_abc',
        classificacaoAcesso: 'Pública',
        geojsonData: mockGeoJson,
      })

      const queryResult = await geojsonCache.get({
        baseId: 'base-300',
        hash: 'hash_modificado_xyz',
      })

      expect(queryResult).toBeNull()
    })

    it('descarta automaticamente camadas com TTL expirado', async () => {
      const pastTime = 1700000000000
      vi.spyOn(Date, 'now').mockReturnValue(pastTime)

      await geojsonCache.set({
        baseId: 'base-expirada',
        versao: 'v1',
        safra: '2026',
        ttl: 5000, // 5 segundos
        classificacaoAcesso: 'Pública',
        geojsonData: mockGeoJson,
      })

      // Avança 10 segundos no tempo
      vi.spyOn(Date, 'now').mockReturnValue(pastTime + 10000)

      const cached = await geojsonCache.get({ baseId: 'base-expirada' })
      expect(cached).toBeNull()
    })
  })

  describe('Segurança e Limpeza Seletiva no Logout', () => {
    it('remove exclusivamente camadas com classificação Restrita e preserva as Públicas', async () => {
      await geojsonCache.set({
        baseId: 'base-publica-car',
        versao: 'v1',
        safra: '2026',
        classificacaoAcesso: 'Pública',
        geojsonData: mockGeoJson,
      })

      await geojsonCache.set({
        baseId: 'base-sigilosa-embargos',
        versao: 'v1',
        safra: '2026',
        classificacaoAcesso: 'Restrita',
        geojsonData: mockGeoJson,
      })

      const removedCount = await geojsonCache.clearRestricted()
      expect(removedCount).toBe(1)

      const publica = await geojsonCache.get({ baseId: 'base-publica-car' })
      const restrita = await geojsonCache.get({ baseId: 'base-sigilosa-embargos' })

      expect(publica).not.toBeNull()
      expect(restrita).toBeNull()
    })
  })

  describe('Política de Capacidade e Evicção LRU', () => {
    it('elimina a camada mais antiga quando o limite máximo de 30 for excedido', async () => {
      let simulatedTime = 1700000000000

      // Popula 30 camadas
      for (let i = 1; i <= MAX_CACHED_LAYERS; i++) {
        vi.spyOn(Date, 'now').mockReturnValue(simulatedTime)
        await geojsonCache.set({
          baseId: `base-lru-${i}`,
          versao: 'v1',
          safra: '2026',
          classificacaoAcesso: 'Pública',
          geojsonData: mockGeoJson,
        })
        simulatedTime += 1000
      }

      const initialStats = await geojsonCache.getStats()
      expect(initialStats.count).toBe(MAX_CACHED_LAYERS)

      // Adiciona a 31ª camada
      vi.spyOn(Date, 'now').mockReturnValue(simulatedTime + 5000)
      await geojsonCache.set({
        baseId: 'base-lru-31',
        versao: 'v1',
        safra: '2026',
        classificacaoAcesso: 'Pública',
        geojsonData: mockGeoJson,
      })

      // A mais antiga (base-lru-1) deve ter sido eliminada
      const oldest = await geojsonCache.get({ baseId: 'base-lru-1' })
      const newest = await geojsonCache.get({ baseId: 'base-lru-31' })

      expect(oldest).toBeNull()
      expect(newest).not.toBeNull()
    })
  })

  describe('Integração com mapService e Carregamento Rápido', () => {
    it('retorna feições com indicador fromCache: true na segunda requisição sem chamar a API', async () => {
      const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
        status: 200,
        data: mockGeoJson,
      })

      // Primeira chamada: busca na API e preenche o cache
      const firstCall = await mapService.getTerritories({ processoId: 99 })
      expect(getSpy).toHaveBeenCalledTimes(1)
      expect(firstCall.features.length).toBe(1)
      expect(firstCall.fromCache).toBe(false)

      // Segunda chamada: deve responder direto do cache local
      const secondCall = await mapService.getTerritories({ processoId: 99 })
      expect(getSpy).toHaveBeenCalledTimes(1) // Continua sendo 1!
      expect(secondCall.fromCache).toBe(true)
      expect(secondCall.features.length).toBe(1)
    })

    it('força atualização da API ao acionar forceRefresh: true mesmo havendo cache', async () => {
      const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
        status: 200,
        data: mockGeoJson,
      })

      await mapService.getTerritories({ processoId: 88 })
      expect(getSpy).toHaveBeenCalledTimes(1)

      // Chamada forçada: ignora o cache e busca na API novamente
      const refreshed = await mapService.getTerritories({ processoId: 88 }, { forceRefresh: true })
      expect(getSpy).toHaveBeenCalledTimes(2)
      expect(refreshed.fromCache).toBe(false)
    })
  })
})
