import type {
  ApiKeyFilters,
  ApiKeyRecord,
  CreateApiKeyDto,
  CreateApiKeyResult,
  ExternalApiAccessLog,
  ExternalLogFilters,
} from '@/types/apiKey'
import type { ApiKeyRepository } from '../apiKeys/ApiKeyRepository'

const SEED_KEYS: ApiKeyRecord[] = [
  {
    id: 1,
    usuario_id: 6,
    nome_parceiro: 'Secretaria Estadual de Meio Ambiente',
    prefixo_chave: 'bf_live_8a92c1f0',
    hash_chave_sha256: 'a'.repeat(64),
    escopos: ['CATALOGO_CONSULTAR', 'MAPA_CONSULTAR', 'DOMINIO_CONSULTAR'],
    status: 'ATIVA',
    data_criacao: '2026-10-01T10:15:00Z',
    data_expiracao: '2027-10-01T23:59:59Z',
    data_revogacao: null,
    usuario_revogacao_id: null,
    ultimo_uso_em: '2026-11-15T14:20:00Z',
  },
  {
    id: 2,
    usuario_id: 5,
    nome_parceiro: 'Observatório Territorial Nacional',
    prefixo_chave: 'bf_live_3f71d0e4',
    hash_chave_sha256: 'b'.repeat(64),
    escopos: ['CATALOGO_CONSULTAR', 'PUBLICACAO_CONSULTAR', 'LINHAGEM_CONSULTAR'],
    status: 'ATIVA',
    data_criacao: '2026-10-20T09:00:00Z',
    data_expiracao: null,
    data_revogacao: null,
    usuario_revogacao_id: null,
    ultimo_uso_em: '2026-11-14T18:45:00Z',
  },
  {
    id: 3,
    usuario_id: 1,
    nome_parceiro: 'Consultoria GeoAgro Legado',
    prefixo_chave: 'bf_live_1c49b2a8',
    hash_chave_sha256: 'c'.repeat(64),
    escopos: ['CATALOGO_CONSULTAR'],
    status: 'REVOGADA',
    data_criacao: '2026-08-12T11:30:00Z',
    data_expiracao: '2027-08-12T23:59:59Z',
    data_revogacao: '2026-11-02T16:10:00Z',
    usuario_revogacao_id: 1,
    ultimo_uso_em: '2026-11-01T20:05:00Z',
  },
  {
    id: 4,
    usuario_id: 5,
    nome_parceiro: 'Parceiro Piloto Safra 2025',
    prefixo_chave: 'bf_live_9e04a7d1',
    hash_chave_sha256: 'd'.repeat(64),
    escopos: ['CATALOGO_CONSULTAR', 'MAPA_CONSULTAR'],
    status: 'EXPIRADA',
    data_criacao: '2025-11-01T08:00:00Z',
    data_expiracao: '2026-11-01T23:59:59Z',
    data_revogacao: null,
    usuario_revogacao_id: null,
    ultimo_uso_em: '2026-10-30T13:12:00Z',
  },
]

const SEED_LOGS: ExternalApiAccessLog[] = [
  {
    id: 101,
    chave_api_id: 1,
    rota_acessada: '/api/v1/externo/catalogo/bases',
    status_http: 200,
    ip_origem: '187.45.112.18',
    data_acesso: '2026-11-15T14:20:00Z',
  },
  {
    id: 102,
    chave_api_id: 1,
    rota_acessada: '/api/v1/externo/mapa/camadas',
    status_http: 200,
    ip_origem: '187.45.112.18',
    data_acesso: '2026-11-15T14:18:10Z',
  },
  {
    id: 103,
    chave_api_id: 1,
    rota_acessada: '/api/v1/externo/analises/executar',
    status_http: 403,
    ip_origem: '187.45.112.18',
    data_acesso: '2026-11-15T13:55:42Z',
  },
  {
    id: 104,
    chave_api_id: 2,
    rota_acessada: '/api/v1/externo/linhagem/1042',
    status_http: 200,
    ip_origem: '200.144.22.91',
    data_acesso: '2026-11-14T18:45:00Z',
  },
  {
    id: 105,
    chave_api_id: 3,
    rota_acessada: '/api/v1/externo/catalogo/bases',
    status_http: 401,
    ip_origem: '177.82.10.44',
    data_acesso: '2026-11-03T09:12:00Z',
  },
  {
    id: 106,
    chave_api_id: 4,
    rota_acessada: '/api/v1/externo/mapa/camadas',
    status_http: 401,
    ip_origem: '191.33.54.10',
    data_acesso: '2026-11-02T10:00:00Z',
  },
]

function generateRandomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function computeSha256Hex(value: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const encoded = new TextEncoder().encode(value)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Fallback determinístico de 64 hex chars quando WebCrypto subtle não estiver disponível
  let acc = ''
  for (let i = 0; i < 64; i++) {
    const charCode = value.charCodeAt(i % value.length) || 0
    acc += ((charCode + i * 17) % 16).toString(16)
  }
  return acc
}

export class MockApiKeyRepository implements ApiKeyRepository {
  private keys: ApiKeyRecord[] = []
  private logs: ExternalApiAccessLog[] = []
  private nextId = 10

  constructor() {
    this.reset()
  }

  reset(): void {
    this.keys = SEED_KEYS.map((item) => ({ ...item, escopos: [...item.escopos] }))
    this.logs = SEED_LOGS.map((log) => ({ ...log }))
    this.nextId = 10
  }

  async listKeys(filters?: ApiKeyFilters): Promise<ApiKeyRecord[]> {
    const q = (filters?.search || '').trim().toLowerCase()
    const status = filters?.status || ''

    return this.keys
      .filter((item) => {
        const matchesQuery =
          !q ||
          item.nome_parceiro.toLowerCase().includes(q) ||
          item.prefixo_chave.toLowerCase().includes(q)
        const matchesStatus = !status || item.status === status
        return matchesQuery && matchesStatus
      })
      .map((item) => ({ ...item, escopos: [...item.escopos] }))
  }

  async createKey(dto: CreateApiKeyDto): Promise<CreateApiKeyResult> {
    const rawSecret = `bf_live_${generateRandomHex(16)}`
    const prefix = rawSecret.slice(0, 16)
    const hash = await computeSha256Hex(rawSecret)
    const nowIso = new Date().toISOString()

    const created: ApiKeyRecord = {
      id: this.nextId++,
      usuario_id: dto.usuario_id ?? 1,
      nome_parceiro: dto.nome_parceiro.trim(),
      prefixo_chave: prefix,
      hash_chave_sha256: hash,
      escopos: [...dto.escopos],
      status: 'ATIVA',
      data_criacao: nowIso,
      data_expiracao: dto.data_expiracao || null,
      data_revogacao: null,
      usuario_revogacao_id: null,
      ultimo_uso_em: null,
    }

    this.keys.unshift(created)

    return {
      key: { ...created, escopos: [...created.escopos] },
      rawSecret,
    }
  }

  async revokeKey(id: number, revokerUserId?: number): Promise<ApiKeyRecord | null> {
    const target = this.keys.find((item) => item.id === id)
    if (!target) return null

    target.status = 'REVOGADA'
    target.data_revogacao = new Date().toISOString()
    target.usuario_revogacao_id = revokerUserId ?? null

    return { ...target, escopos: [...target.escopos] }
  }

  async listExternalLogs(keyId: number, filters?: ExternalLogFilters): Promise<ExternalApiAccessLog[]> {
    const q = (filters?.search || '').trim().toLowerCase()
    const group = filters?.statusGroup || ''

    return this.logs
      .filter((log) => {
        if (log.chave_api_id !== keyId) return false
        const matchesSearch =
          !q ||
          log.rota_acessada.toLowerCase().includes(q) ||
          log.ip_origem.toLowerCase().includes(q)
        const matchesStatus =
          !group ||
          (group === '2xx' && log.status_http >= 200 && log.status_http < 300) ||
          (group === '4xx' && log.status_http >= 400 && log.status_http < 500) ||
          (group === '5xx' && log.status_http >= 500)
        return matchesSearch && matchesStatus
      })
      .map((log) => ({ ...log }))
  }
}
