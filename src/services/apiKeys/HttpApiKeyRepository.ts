import api, { ApiError } from '@/services/api'
import type {
  ApiKeyFilters,
  ApiKeyRecord,
  ApiKeyStatus,
  CreateApiKeyDto,
  CreateApiKeyResult,
  ExternalApiAccessLog,
  ExternalLogFilters,
} from '@/types/apiKey'
import type { ApiKeyRepository } from './ApiKeyRepository'

function normalizeEscopos(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean)
      }
      if (parsed && typeof parsed === 'object') {
        return normalizeEscopos(parsed)
      }
    } catch {
      return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    return normalizeEscopos(obj.escopos ?? obj.scopes ?? obj.items)
  }
  return []
}

function normalizeStatus(raw: unknown): ApiKeyStatus {
  const upper = String(raw ?? 'ATIVA').trim().toUpperCase()
  if (upper === 'REVOGADA' || upper === 'EXPIRADA') return upper
  return 'ATIVA'
}

function normalizeKeyRecord(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: Number(row.id ?? 0),
    usuario_id: Number(row.usuario_id ?? row.usuarioId ?? 0),
    nome_parceiro: String(row.nome_parceiro ?? row.nomeParceiro ?? ''),
    prefixo_chave: String(row.prefixo_chave ?? row.prefixoChave ?? ''),
    hash_chave_sha256:
      row.hash_chave_sha256 !== undefined
        ? String(row.hash_chave_sha256)
        : row.hashChaveSha256 !== undefined
          ? String(row.hashChaveSha256)
          : undefined,
    escopos: normalizeEscopos(row.escopos ?? row.scopes),
    status: normalizeStatus(row.status),
    data_criacao: String(row.data_criacao ?? row.dataCriacao ?? ''),
    data_expiracao: (row.data_expiracao ?? row.dataExpiracao ?? null) as string | null,
    data_revogacao: (row.data_revogacao ?? row.dataRevogacao ?? null) as string | null,
    usuario_revogacao_id: (row.usuario_revogacao_id ?? row.usuarioRevogacaoId ?? null) as number | null,
    ultimo_uso_em: (row.ultimo_uso_em ?? row.ultimoUsoEm ?? null) as string | null,
  }
}

function normalizeLogRecord(row: Record<string, unknown>): ExternalApiAccessLog {
  return {
    id: Number(row.id ?? 0),
    chave_api_id: Number(row.chave_api_id ?? row.chaveApiId ?? 0),
    rota_acessada: String(row.rota_acessada ?? row.rotaAcessada ?? ''),
    status_http: Number(row.status_http ?? row.statusHttp ?? 0),
    ip_origem: String(row.ip_origem ?? row.ipOrigem ?? ''),
    data_acesso: String(row.data_acesso ?? row.dataAcesso ?? ''),
  }
}

function extractArrayPayload(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const list = obj.content ?? obj.items ?? obj.data
    if (Array.isArray(list)) return list as Record<string, unknown>[]
  }
  return []
}

function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(err)
}

export class HttpApiKeyRepository implements ApiKeyRepository {
  async listKeys(filters?: ApiKeyFilters): Promise<ApiKeyRecord[]> {
    const params: Record<string, unknown> = {}
    if (filters?.search) params.search = filters.search
    if (filters?.status) params.status = filters.status

    try {
      const res = await api.get('/admin/chaves-api', { params })
      return extractArrayPayload(res.data).map(normalizeKeyRecord)
    } catch (err: unknown) {
      throw toApiError(err)
    }
  }

  async createKey(dto: CreateApiKeyDto): Promise<CreateApiKeyResult> {
    try {
      const res = await api.post('/admin/chaves-api', {
        nome_parceiro: dto.nome_parceiro.trim(),
        escopos: dto.escopos,
        data_expiracao: dto.data_expiracao ?? null,
      })

      const data = (res.data ?? {}) as Record<string, unknown>
      const keySource =
        data.key && typeof data.key === 'object'
          ? (data.key as Record<string, unknown>)
          : data.chave && typeof data.chave === 'object'
            ? (data.chave as Record<string, unknown>)
            : data

      const rawSecretCandidate =
        data.rawSecret ??
        data.raw_secret ??
        data.segredo ??
        data.secret ??
        data.rawKey ??
        (typeof data.chave === 'string' ? data.chave : '')

      return {
        key: normalizeKeyRecord(keySource),
        rawSecret: String(rawSecretCandidate ?? ''),
      }
    } catch (err: unknown) {
      throw toApiError(err)
    }
  }

  async revokeKey(id: number, revokerUserId?: number): Promise<ApiKeyRecord | null> {
    try {
      const payload = revokerUserId !== undefined ? { usuario_revogacao_id: revokerUserId } : {}
      const res = await api.patch(`/admin/chaves-api/${id}/revogar`, payload)
      if (res.data && typeof res.data === 'object') {
        return normalizeKeyRecord(res.data as Record<string, unknown>)
      }
      return null
    } catch (err: unknown) {
      throw toApiError(err)
    }
  }

  async listExternalLogs(keyId: number, filters?: ExternalLogFilters): Promise<ExternalApiAccessLog[]> {
    const params: Record<string, unknown> = {}
    if (filters?.search) params.search = filters.search
    if (filters?.statusGroup) params.statusGroup = filters.statusGroup

    try {
      const res = await api.get(`/admin/chaves-api/${keyId}/logs`, { params })
      return extractArrayPayload(res.data).map(normalizeLogRecord)
    } catch (err: unknown) {
      throw toApiError(err)
    }
  }
}
