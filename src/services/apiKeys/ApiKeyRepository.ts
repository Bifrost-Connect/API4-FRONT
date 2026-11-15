import type {
  ApiKeyFilters,
  ApiKeyRecord,
  CreateApiKeyDto,
  CreateApiKeyResult,
  ExternalApiAccessLog,
  ExternalLogFilters,
} from '@/types/apiKey'

/**
 * Contrato de repositório para Chaves de API (V39) e Logs de Acessos Externos (V40).
 * Por conformidade com a trigger V40 (trg_bloquear_delete_chave_com_log), não expõe
 * exclusão física — o ciclo de vida termina estritamente por revogação (status = 'REVOGADA').
 */
export interface ApiKeyRepository {
  listKeys(filters?: ApiKeyFilters): Promise<ApiKeyRecord[]>
  createKey(dto: CreateApiKeyDto): Promise<CreateApiKeyResult>
  revokeKey(id: number, revokerUserId?: number): Promise<ApiKeyRecord | null>
  listExternalLogs(keyId: number, filters?: ExternalLogFilters): Promise<ExternalApiAccessLog[]>
}
