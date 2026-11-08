/**
 * Serviço assíncrono de cache local para camadas e geometrias GeoJSON via IndexedDB.
 * Proporciona carregamento instantâneo (5-20ms) para mapas, com controle de versão,
 * TTL (7 dias), evicção LRU (máx 30 camadas) e fallback em memória para ambientes de teste (jsdom).
 */

export type AccessClassification = 'Pública' | 'Restrita' | string

export interface GeoJsonCacheEntry {
  cacheKey: string
  baseId: string
  versao: string
  safra: string
  bbox?: string
  hash?: string
  classificacaoAcesso: AccessClassification
  timestamp: number
  ttl: number
  featureCount: number
  geojsonData: GeoJSON.FeatureCollection | any
}

export interface GeoJsonCacheQuery {
  baseId: string | number
  versao?: string
  safra?: string
  bbox?: string
  hash?: string
}

const DB_NAME = 'api4_geoespacial_db'
const DB_VERSION = 1
const STORE_NAME = 'geojson_layers'
export const DEFAULT_GEOJSON_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias
export const MAX_CACHED_LAYERS = 30 // Política LRU

// Fallback em memória quando IndexedDB não estiver disponível (ex: jsdom no Vitest)
const memoryCache = new Map<string, GeoJsonCacheEntry>()

/**
 * Abre conexão com o IndexedDB do navegador.
 */
function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' })
          store.createIndex('baseId', 'baseId', { unique: false })
          store.createIndex('classificacaoAcesso', 'classificacaoAcesso', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export const geojsonCache = {
  /**
   * Constrói a chave única para indexação da camada no cache.
   * Chaveada por baseId e delimitação Bbox (para suportar partições espaciais).
   */
  buildCacheKey(query: GeoJsonCacheQuery): string {
    const bId = String(query.baseId || 'generic').trim()
    const bb = query.bbox ? query.bbox.replace(/[^a-zA-Z0-9_-]/g, '') : 'all'
    return `geojson_${bId}_${bb}`
  },

  /**
   * Consulta uma camada GeoJSON no cache local.
   * Valida automaticamente expiração de TTL e divergência de versão/hash/safra.
   */
  async get(query: GeoJsonCacheQuery): Promise<GeoJsonCacheEntry | null> {
    const key = this.buildCacheKey(query)
    const db = await openDatabase()

    let entry: GeoJsonCacheEntry | null = null

    if (db) {
      entry = await new Promise<GeoJsonCacheEntry | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly')
          const store = tx.objectStore(STORE_NAME)
          const req = store.get(key)
          req.onsuccess = () => resolve(req.result || null)
          req.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      })
    } else {
      entry = memoryCache.get(key) || null
    }

    if (!entry) return null

    // 1. Verificação de expiração (TTL)
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      await this.deleteByKey(key)
      return null
    }

    // 2. Verificação de invalidação por versão ou hash
    if (query.versao && entry.versao && query.versao !== entry.versao) {
      await this.invalidateByBase(entry.baseId)
      return null
    }

    if (query.hash && entry.hash && query.hash !== entry.hash) {
      await this.invalidateByBase(entry.baseId)
      return null
    }

    if (
      query.safra &&
      entry.safra &&
      query.safra !== 'any' &&
      entry.safra !== 'any' &&
      query.safra !== entry.safra
    ) {
      return null
    }

    // 3. Atualiza timestamp para preservar na política LRU (Least Recently Used)
    entry.timestamp = now
    await this.touch(entry)

    return entry
  },

  /**
   * Armazena uma camada GeoJSON no cache.
   * Aplica limite LRU descartando a entrada mais antiga se ultrapassar 30 camadas.
   */
  async set(
    payload: Omit<GeoJsonCacheEntry, 'cacheKey' | 'timestamp' | 'featureCount'> & {
      ttl?: number
    },
  ): Promise<GeoJsonCacheEntry> {
    const key = this.buildCacheKey({
      baseId: payload.baseId,
      bbox: payload.bbox,
    })

    const features = Array.isArray(payload.geojsonData?.features) ? payload.geojsonData.features : []

    const entry: GeoJsonCacheEntry = {
      ...payload,
      cacheKey: key,
      timestamp: Date.now(),
      ttl: payload.ttl || DEFAULT_GEOJSON_TTL_MS,
      featureCount: features.length,
      classificacaoAcesso: payload.classificacaoAcesso || 'Pública',
    }

    // Controle de capacidade LRU
    await this.ensureCapacity()

    const db = await openDatabase()
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          store.put(entry)
          tx.oncomplete = () => resolve()
          tx.onerror = () => resolve()
        } catch {
          resolve()
        }
      })
    }

    // Mantém sincronizado no fallback
    memoryCache.set(key, entry)
    return entry
  },

  /**
   * Remove uma entrada individual pela chave.
   */
  async deleteByKey(key: string): Promise<void> {
    memoryCache.delete(key)
    const db = await openDatabase()
    if (!db) return

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        store.delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  },

  /**
   * Invalida e remove todas as variações em cache de uma base específica.
   */
  async invalidateByBase(baseId: string | number): Promise<void> {
    const targetId = String(baseId)

    // Remove do fallback em memória
    for (const [k, v] of memoryCache.entries()) {
      if (String(v.baseId) === targetId) {
        memoryCache.delete(k)
      }
    }

    const db = await openDatabase()
    if (!db) return

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const index = store.index('baseId')
        const req = index.openCursor(IDBKeyRange.only(targetId))

        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            cursor.delete()
            cursor.continue()
          }
        }

        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  },

  /**
   * Limpa seletivamente todas as camadas restritas no logout, preservando bases públicas.
   */
  async clearRestricted(): Promise<number> {
    let count = 0
    const isPublic = (cls?: string) => {
      const norm = String(cls || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return norm === 'publica'
    }

    // Remove do fallback em memória
    for (const [k, v] of memoryCache.entries()) {
      if (!isPublic(v.classificacaoAcesso)) {
        memoryCache.delete(k)
        count++
      }
    }

    const db = await openDatabase()
    if (!db) return count

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const req = store.openCursor()

        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            const entry = cursor.value as GeoJsonCacheEntry
            if (!isPublic(entry.classificacaoAcesso)) {
              cursor.delete()
              count++
            }
            cursor.continue()
          }
        }

        tx.oncomplete = () => resolve(count)
        tx.onerror = () => resolve(count)
      } catch {
        resolve(count)
      }
    })
  },

  /**
   * Limpa integralmente todas as camadas armazenadas em cache.
   */
  async clearAll(): Promise<void> {
    memoryCache.clear()
    const db = await openDatabase()
    if (!db) return

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        store.clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  },

  /**
   * Varre e remove todas as camadas cujo TTL expirou.
   */
  async pruneExpired(): Promise<number> {
    let pruned = 0
    const now = Date.now()

    for (const [k, v] of memoryCache.entries()) {
      if (now - v.timestamp > v.ttl) {
        memoryCache.delete(k)
        pruned++
      }
    }

    const db = await openDatabase()
    if (!db) return pruned

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const req = store.openCursor()

        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            const entry = cursor.value as GeoJsonCacheEntry
            if (now - entry.timestamp > entry.ttl) {
              cursor.delete()
              pruned++
            }
            cursor.continue()
          }
        }

        tx.oncomplete = () => resolve(pruned)
        tx.onerror = () => resolve(pruned)
      } catch {
        resolve(pruned)
      }
    })
  },

  /**
   * Estatísticas de uso do cache para diagnóstico e testes.
   */
  async getStats(): Promise<{ count: number; keys: string[] }> {
    const db = await openDatabase()
    if (!db) {
      return {
        count: memoryCache.size,
        keys: Array.from(memoryCache.keys()),
      }
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.getAllKeys()

        req.onsuccess = () => {
          const keys = (req.result as string[]) || []
          resolve({ count: keys.length, keys })
        }
        req.onerror = () => resolve({ count: memoryCache.size, keys: Array.from(memoryCache.keys()) })
      } catch {
        resolve({ count: memoryCache.size, keys: Array.from(memoryCache.keys()) })
      }
    })
  },

  /**
   * Atualiza o timestamp de um registro para evitar evicção LRU prematura.
   */
  async touch(entry: GeoJsonCacheEntry): Promise<void> {
    memoryCache.set(entry.cacheKey, entry)
    const db = await openDatabase()
    if (!db) return

    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(entry)
    } catch {}
  },

  /**
   * Garante que o número de camadas não exceda o limite LRU configurado (30 camadas).
   */
  async ensureCapacity(): Promise<void> {
    const stats = await this.getStats()
    if (stats.count < MAX_CACHED_LAYERS) return

    const db = await openDatabase()
    if (!db) {
      // Evicção no fallback em memória
      let oldestKey: string | null = null
      let oldestTime = Infinity

      for (const [k, v] of memoryCache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp
          oldestKey = k
        }
      }

      if (oldestKey) memoryCache.delete(oldestKey)
      return
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const index = store.index('timestamp')
        const req = index.openCursor() // Ordenado do mais antigo para o mais recente

        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            cursor.delete() // Remove o mais antigo
          }
        }

        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  },
}
