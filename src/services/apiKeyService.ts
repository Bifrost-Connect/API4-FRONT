import {
  API_KEY_AVAILABLE_SCOPES,
  type ApiKeyFilters,
  type ApiKeyRecord,
  type ApiKeyScopeOption,
  type CreateApiKeyDto,
  type CreateApiKeyResult,
  type ExternalApiAccessLog,
  type ExternalLogFilters,
} from '@/types/apiKey'
import { HttpApiKeyRepository } from './apiKeys/HttpApiKeyRepository'

const httpRepo = new HttpApiKeyRepository()

export const apiKeyService = {
  getAvailableScopes(): ApiKeyScopeOption[] {
    return API_KEY_AVAILABLE_SCOPES.map((scope) => ({ ...scope }))
  },

  async listKeys(filters?: ApiKeyFilters): Promise<ApiKeyRecord[]> {
    return httpRepo.listKeys(filters)
  },

  async createKey(dto: CreateApiKeyDto): Promise<CreateApiKeyResult> {
    return httpRepo.createKey(dto)
  },

  async revokeKey(id: number, revokerUserId?: number): Promise<ApiKeyRecord | null> {
    return httpRepo.revokeKey(id, revokerUserId)
  },

  async listExternalLogs(keyId: number, filters?: ExternalLogFilters): Promise<ExternalApiAccessLog[]> {
    return httpRepo.listExternalLogs(keyId, filters)
  },
}
