import { ref } from 'vue'
import { authStorage } from '@/services/storage/authStorage'
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
import { MockApiKeyRepository } from './mocks/MockApiKeyRepository'
import { HttpApiKeyRepository } from './apiKeys/HttpApiKeyRepository'

const mockRepo = new MockApiKeyRepository()
const httpRepo = new HttpApiKeyRepository()

const isFallbackMode = ref(true)

function isSimulatedSession(): boolean {
  const session = authStorage.getSession()
  return session?.isSimulated !== false
}

function isFallbackError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const errObj = err as {
    status?: number
    response?: { status?: number }
    cause?: { status?: number; response?: { status?: number } }
  }
  const status =
    errObj.status ??
    errObj.response?.status ??
    errObj.cause?.status ??
    errObj.cause?.response?.status

  if (status === 404 || status === 405 || status === 501) {
    return true
  }
  if (status !== undefined) {
    return false
  }
  if (errObj.cause && typeof errObj.cause === 'object') {
    return errObj.cause.response === undefined
  }
  return errObj.response === undefined
}

async function withRepositoryFallback<T>(
  runHttp: () => Promise<T>,
  runMock: () => Promise<T>,
): Promise<T> {
  if (isSimulatedSession()) {
    isFallbackMode.value = true
    return runMock()
  }

  try {
    const result = await runHttp()
    isFallbackMode.value = false
    return result
  } catch (err: unknown) {
    if (isFallbackError(err)) {
      isFallbackMode.value = true
      return runMock()
    }
    throw err
  }
}

export const apiKeyService = {
  isFallbackMode,

  getAvailableScopes(): ApiKeyScopeOption[] {
    return API_KEY_AVAILABLE_SCOPES.map((scope) => ({ ...scope }))
  },

  resetMockData(): void {
    mockRepo.reset()
  },

  async listKeys(filters?: ApiKeyFilters): Promise<ApiKeyRecord[]> {
    return withRepositoryFallback(
      () => httpRepo.listKeys(filters),
      () => mockRepo.listKeys(filters),
    )
  },

  async createKey(dto: CreateApiKeyDto): Promise<CreateApiKeyResult> {
    return withRepositoryFallback(
      () => httpRepo.createKey(dto),
      () => mockRepo.createKey(dto),
    )
  },

  async revokeKey(id: number, revokerUserId?: number): Promise<ApiKeyRecord | null> {
    return withRepositoryFallback(
      () => httpRepo.revokeKey(id, revokerUserId),
      () => mockRepo.revokeKey(id, revokerUserId),
    )
  },

  async listExternalLogs(keyId: number, filters?: ExternalLogFilters): Promise<ExternalApiAccessLog[]> {
    return withRepositoryFallback(
      () => httpRepo.listExternalLogs(keyId, filters),
      () => mockRepo.listExternalLogs(keyId, filters),
    )
  },
}
