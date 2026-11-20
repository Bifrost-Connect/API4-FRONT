<script setup lang="ts">
/**
 * Aba de Gestão de Chaves de API e Logs de Acesso Externo (US12).
 * Baseada nas migrations V39 (chaves_api) e V40 (log_acessos_api_externa) do API4-BACK.
 */
import { ref, computed, onMounted } from 'vue'
import {
  FiKey,
  FiPlus,
  FiSearch,
  FiFilter,
  FiActivity,
  FiSlash,
  FiCopy,
  FiCheck,
  FiAlertTriangle,
  FiAlertCircle,
  FiX,
  FiShield,
  FiClock,
} from 'vue-icons-plus/fi'
import { apiKeyService } from '@/services/apiKeyService'
import { userService } from '@/services/user'
import { extractApiErrorMessage } from '@/services/api'
import type { ApiKeyRecord, ApiKeyStatus, ExternalApiAccessLog } from '@/types/apiKey'
import DataTable, { type Column } from '../DataTable.vue'

const apiKeyColumns: Column[] = [
  { key: 'partner', label: 'Parceiro / Sistema' },
  { key: 'prefix', label: 'Prefixo' },
  { key: 'scopes', label: 'Escopos' },
  { key: 'status', label: 'Status' },
  { key: 'dates', label: 'Criação / Expiração' },
  { key: 'lastUsed', label: 'Último Uso' },
  { key: 'actions', label: 'Ações' },
]

const AVAILABLE_SCOPES = apiKeyService.getAvailableScopes()

const canCreateKey = computed(() => userService.can('API:GERAR_CHAVE'))
const canRevokeKey = computed(() => userService.can('API:REVOGAR_CHAVE'))

const apiKeys = ref<ApiKeyRecord[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const statusFilter = ref<'' | ApiKeyStatus>('')

// Modal de Criação
const isCreateModalOpen = ref(false)
const createPartnerName = ref('')
const createExpirationDate = ref('')
const createSelectedScopes = ref<string[]>(['CATALOGO_CONSULTAR', 'MAPA_CONSULTAR'])
const createError = ref('')
const isCreating = ref(false)

// Modal de Segredo Único
const isSecretModalOpen = ref(false)
const generatedSecretData = ref<{
  nome_parceiro: string
  prefixo_chave: string
  escopos: string[]
  rawKey: string
} | null>(null)
const secretCopied = ref(false)

// Modal de Revogação
const isRevokeModalOpen = ref(false)
const revokeTargetKey = ref<ApiKeyRecord | null>(null)
const isRevoking = ref(false)

// Modal de Logs Externos (V40)
const isLogsModalOpen = ref(false)
const logsTargetKey = ref<ApiKeyRecord | null>(null)
const externalLogs = ref<ExternalApiAccessLog[]>([])
const isLoadingLogs = ref(false)
const logRouteSearch = ref('')
const logStatusGroup = ref<'' | '2xx' | '4xx' | '5xx'>('')

const loadKeys = async () => {
  isLoading.value = true
  try {
    apiKeys.value = await apiKeyService.listKeys()
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadKeys()
})

const filteredKeys = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return apiKeys.value.filter((item) => {
    const matchesQuery =
      !q ||
      item.nome_parceiro.toLowerCase().includes(q) ||
      item.prefixo_chave.toLowerCase().includes(q)
    const matchesStatus = !statusFilter.value || item.status === statusFilter.value
    return matchesQuery && matchesStatus
  })
})

const filteredExternalLogs = computed(() => {
  const q = logRouteSearch.value.trim().toLowerCase()
  return externalLogs.value.filter((log) => {
    const matchesRoute =
      !q ||
      log.rota_acessada.toLowerCase().includes(q) ||
      log.ip_origem.toLowerCase().includes(q)
    const matchesStatus =
      !logStatusGroup.value ||
      (logStatusGroup.value === '2xx' && log.status_http >= 200 && log.status_http < 300) ||
      (logStatusGroup.value === '4xx' && log.status_http >= 400 && log.status_http < 500) ||
      (logStatusGroup.value === '5xx' && log.status_http >= 500)
    return matchesRoute && matchesStatus
  })
})

const formatDateTime = (iso: string | null) => {
  if (!iso) return '—'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const getStatusBadgeClass = (status: ApiKeyStatus) => {
  if (status === 'ATIVA') return 'badge-active'
  if (status === 'REVOGADA') return 'badge-revoked'
  return 'badge-expired'
}

const getHttpStatusClass = (status: number) => {
  if (status >= 500) return 'http-5xx'
  if (status >= 400) return 'http-4xx'
  return 'http-2xx'
}

const openCreateModal = () => {
  createPartnerName.value = ''
  createExpirationDate.value = ''
  createSelectedScopes.value = ['CATALOGO_CONSULTAR', 'MAPA_CONSULTAR']
  createError.value = ''
  isCreateModalOpen.value = true
}

const closeCreateModal = () => {
  isCreateModalOpen.value = false
}

const handleCreateKey = async () => {
  createError.value = ''
  if (!canCreateKey.value) {
    createError.value = 'Você não possui permissão para gerar chaves de API.'
    return
  }
  if (!createPartnerName.value.trim()) {
    createError.value = 'Informe o nome do parceiro ou sistema integrador.'
    return
  }
  if (createSelectedScopes.value.length === 0) {
    createError.value = 'Selecione ao menos um escopo de acesso.'
    return
  }

  isCreating.value = true
  try {
    const expirationIso = createExpirationDate.value
      ? `${createExpirationDate.value}T23:59:59Z`
      : null
    const result = await apiKeyService.createKey({
      nome_parceiro: createPartnerName.value.trim(),
      escopos: [...createSelectedScopes.value],
      data_expiracao: expirationIso,
      usuario_id: userService.getCurrentUser().id,
    })

    isCreateModalOpen.value = false
    generatedSecretData.value = {
      nome_parceiro: result.key.nome_parceiro,
      prefixo_chave: result.key.prefixo_chave,
      escopos: [...result.key.escopos],
      rawKey: result.rawSecret,
    }
    secretCopied.value = false
    isSecretModalOpen.value = true
    await loadKeys()
  } catch (err: unknown) {
    createError.value = extractApiErrorMessage(err, 'Falha ao gerar nova chave de API.')
  } finally {
    isCreating.value = false
  }
}

const copyGeneratedSecret = async () => {
  if (!generatedSecretData.value) return
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(generatedSecretData.value.rawKey)
  }
  secretCopied.value = true
}

const closeSecretModal = () => {
  isSecretModalOpen.value = false
  generatedSecretData.value = null
  secretCopied.value = false
}

const openRevokeModal = (keyItem: ApiKeyRecord) => {
  revokeTargetKey.value = keyItem
  isRevokeModalOpen.value = true
}

const closeRevokeModal = () => {
  isRevokeModalOpen.value = false
  revokeTargetKey.value = null
}

const handleConfirmRevoke = async () => {
  if (!revokeTargetKey.value || !canRevokeKey.value) return
  isRevoking.value = true
  try {
    await apiKeyService.revokeKey(revokeTargetKey.value.id, userService.getCurrentUser().id)
    isRevokeModalOpen.value = false
    revokeTargetKey.value = null
    await loadKeys()
  } finally {
    isRevoking.value = false
  }
}

const openLogsModal = async (keyItem: ApiKeyRecord) => {
  logsTargetKey.value = keyItem
  logRouteSearch.value = ''
  logStatusGroup.value = ''
  externalLogs.value = []
  isLogsModalOpen.value = true
  isLoadingLogs.value = true
  try {
    externalLogs.value = await apiKeyService.listExternalLogs(keyItem.id)
  } finally {
    isLoadingLogs.value = false
  }
}

const closeLogsModal = () => {
  isLogsModalOpen.value = false
  logsTargetKey.value = null
}
</script>

<template>
  <section class="api-keys-tab" data-testid="api-keys-tab" aria-label="Gestão de Chaves de API">
    <!-- Banner informativo e botão de ação -->
    <div class="card header-card">
      <div class="header-main">
        <div class="header-title-row">
          <FiKey size="20" class="header-icon" />
          <div>
            <h2>Chaves de API e Acessos Externos</h2>
            <p class="header-subtitle">
              Emita credenciais para parceiros externos com escopo restrito, validade e trilha imutável de chamadas.
            </p>
          </div>
        </div>

        <div class="header-actions">
          <button
            v-if="canCreateKey"
            type="button"
            class="btn-primary"
            data-testid="btn-new-api-key"
            @click="openCreateModal"
          >
            <FiPlus size="16" />
            <span>Nova Chave de API</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Barra de Filtros -->
    <div class="card filter-card">
      <div class="filter-bar">
        <div class="search-box">
          <FiSearch size="16" class="search-icon" />
          <label for="apikey-search-input" class="sr-only">Buscar chave de API</label>
          <input
            id="apikey-search-input"
            v-model="searchQuery"
            type="text"
            class="input search-input"
            placeholder="Buscar por nome do parceiro ou prefixo..."
            data-testid="apikey-search-input"
          />
        </div>

        <div class="select-group">
          <FiFilter size="14" class="select-icon" />
          <label for="apikey-status-filter" class="sr-only">Filtrar por status</label>
          <select
            id="apikey-status-filter"
            v-model="statusFilter"
            class="select"
            data-testid="apikey-status-filter"
          >
            <option value="">Todos os Status</option>
            <option value="ATIVA">Ativa</option>
            <option value="REVOGADA">Revogada</option>
            <option value="EXPIRADA">Expirada</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Tabela de Chaves de API (V39: chaves_api) -->
    <div class="card table-card">
      <div
        tabindex="0"
        role="region"
        aria-label="Tabela de chaves de API cadastradas"
        class="table-responsive"
      >
        <DataTable
          :columns="apiKeyColumns"
          :data="filteredKeys"
          row-key="id"
          :disable-expand="true"
          :loading="isLoading"
          loading-message="Carregando chaves de API..."
          table-test-id="api-keys-table"
          row-test-id="api-key-row"
        >
          <template #cell-partner="{ item }">
            <div class="partner-cell">
              <strong class="partner-name">{{ item.nome_parceiro }}</strong>
              <span class="partner-meta">ID #{{ item.id }}</span>
            </div>
          </template>

          <template #cell-prefix="{ item }">
            <code class="prefix-code">{{ item.prefixo_chave }}...</code>
          </template>

          <template #cell-scopes="{ item }">
            <div class="scopes-list">
              <span v-for="scope in item.escopos" :key="scope" class="scope-pill">
                {{ scope }}
              </span>
            </div>
          </template>

          <template #cell-status="{ item }">
            <span class="status-badge" :class="getStatusBadgeClass(item.status)">
              {{ item.status }}
            </span>
          </template>

          <template #cell-dates="{ item }">
            <div class="dates-cell">
              <span>Criada: {{ formatDateTime(item.data_criacao) }}</span>
              <span class="date-muted">
                Expira: {{ item.data_expiracao ? formatDateTime(item.data_expiracao) : 'Sem expiração' }}
              </span>
            </div>
          </template>

          <template #cell-lastUsed="{ item }">
            <span class="last-used-text">
              <FiClock size="12" />
              {{ item.ultimo_uso_em ? formatDateTime(item.ultimo_uso_em) : 'Nunca utilizada' }}
            </span>
          </template>

          <template #cell-actions="{ item }">
            <div class="table-actions action-buttons">
              <button
                type="button"
                class="btn-action btn-logs"
                data-testid="btn-view-key-logs"
                title="Consultar logs de acessos externos"
                @click="openLogsModal(item)"
              >
                <FiActivity size="14" />
                <span>Logs</span>
              </button>

              <button
                v-if="canRevokeKey"
                type="button"
                class="btn-action btn-revoke"
                data-testid="btn-revoke-api-key"
                :disabled="item.status !== 'ATIVA'"
                :title="item.status === 'ATIVA' ? 'Revogar chave de API' : 'Chave já inativa'"
                @click="openRevokeModal(item)"
              >
                <FiSlash size="14" />
                <span>Revogar</span>
              </button>
            </div>
          </template>

          <template #empty>
            Nenhuma chave de API encontrada para os filtros aplicados.
          </template>
        </DataTable>
      </div>
    </div>

    <!-- Modal 1: Criação de Nova Chave de API -->
    <div
      v-if="isCreateModalOpen"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-apikey-title"
      data-testid="create-api-key-modal"
      @click.self="closeCreateModal"
      @keydown.esc="closeCreateModal"
    >
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title-group">
            <FiKey size="20" class="header-icon" />
            <div>
              <h3 id="create-apikey-title">Emitir Nova Chave de API</h3>
              <p class="modal-subtitle">
                O segredo completo será exibido apenas uma vez após a geração.
              </p>
            </div>
          </div>
          <button type="button" class="btn-close" aria-label="Fechar" @click="closeCreateModal">
            <FiX size="18" />
          </button>
        </div>

        <form @submit.prevent="handleCreateKey">
          <div class="modal-body">
            <div v-if="createError" class="alert-danger-box" role="alert" data-testid="create-apikey-error">
              <FiAlertCircle size="16" />
              <span>{{ createError }}</span>
            </div>

            <div class="form-group">
              <label for="apikey-partner-name">Nome do Parceiro / Integração</label>
              <input
                id="apikey-partner-name"
                v-model="createPartnerName"
                type="text"
                class="input"
                maxlength="120"
                required
                placeholder="Ex.: Portal GeoParceiro Estadual"
                data-testid="input-apikey-partner"
              />
            </div>

            <div class="form-group">
              <label for="apikey-expires-at">Data de Expiração (Opcional)</label>
              <input
                id="apikey-expires-at"
                v-model="createExpirationDate"
                type="date"
                class="input"
                data-testid="input-apikey-expiration"
              />
              <small class="field-hint">Deixe em branco caso a chave não possua validade pré-definida.</small>
            </div>

            <fieldset class="scopes-fieldset">
              <legend>Escopos Autorizados</legend>
              <div class="scopes-checkbox-grid">
                <label
                  v-for="scope in AVAILABLE_SCOPES"
                  :key="scope.code"
                  class="scope-checkbox-card"
                >
                  <input
                    v-model="createSelectedScopes"
                    type="checkbox"
                    :value="scope.code"
                    :data-testid="`scope-checkbox-${scope.code}`"
                  />
                  <span class="scope-checkbox-text">
                    <strong>{{ scope.code }}</strong>
                    <small>{{ scope.label }}</small>
                  </span>
                </label>
              </div>
            </fieldset>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="closeCreateModal">Cancelar</button>
            <button
              type="submit"
              class="btn-primary"
              :disabled="isCreating"
              data-testid="btn-submit-create-apikey"
            >
              <FiCheck size="16" />
              <span>{{ isCreating ? 'Gerando...' : 'Gerar Chave de API' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal 2: Exibição Única da Chave Gerada -->
    <div
      v-if="isSecretModalOpen && generatedSecretData"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="secret-apikey-title"
      data-testid="secret-api-key-modal"
      @keydown.esc="closeSecretModal"
    >
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title-group">
            <FiShield size="20" class="header-icon" />
            <div>
              <h3 id="secret-apikey-title">Chave de API Gerada com Sucesso</h3>
              <p class="modal-subtitle">Parceiro: {{ generatedSecretData.nome_parceiro }}</p>
            </div>
          </div>
          <button type="button" class="btn-close" aria-label="Fechar" @click="closeSecretModal">
            <FiX size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="warning-box" role="status">
            <FiAlertTriangle size="18" />
            <div>
              <strong>Atenção: exibição única</strong>
              <p>
                Por segurança, apenas o hash SHA-256 é armazenado no servidor. Copie e guarde esta chave agora — não será possível recuperá-la depois.
              </p>
            </div>
          </div>

          <div class="secret-display-box">
            <code class="secret-value" data-testid="generated-raw-secret">{{ generatedSecretData.rawKey }}</code>
            <button
              type="button"
              class="btn-secondary btn-copy"
              data-testid="btn-copy-secret"
              @click="copyGeneratedSecret"
            >
              <FiCheck v-if="secretCopied" size="15" />
              <FiCopy v-else size="15" />
              <span>{{ secretCopied ? 'Copiada!' : 'Copiar' }}</span>
            </button>
          </div>

          <div class="secret-meta">
            <span><strong>Prefixo:</strong> <code>{{ generatedSecretData.prefixo_chave }}</code></span>
            <span><strong>Escopos:</strong> {{ generatedSecretData.escopos.join(', ') }}</span>
          </div>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn-primary"
            data-testid="btn-close-secret-modal"
            @click="closeSecretModal"
          >
            Já copiei a chave com segurança
          </button>
        </div>
      </div>
    </div>

    <!-- Modal 3: Confirmação de Revogação -->
    <div
      v-if="isRevokeModalOpen && revokeTargetKey"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-apikey-title"
      data-testid="revoke-api-key-modal"
      @click.self="closeRevokeModal"
      @keydown.esc="closeRevokeModal"
    >
      <div class="modal-dialog modal-dialog-sm">
        <div class="modal-header">
          <div class="modal-title-group">
            <FiAlertTriangle size="20" class="danger-icon" />
            <div>
              <h3 id="revoke-apikey-title">Revogar Chave de API</h3>
              <p class="modal-subtitle">{{ revokeTargetKey.nome_parceiro }}</p>
            </div>
          </div>
          <button type="button" class="btn-close" aria-label="Fechar" @click="closeRevokeModal">
            <FiX size="18" />
          </button>
        </div>

        <div class="modal-body">
          <p class="confirm-text">
            Deseja revogar imediatamente a chave <code>{{ revokeTargetKey.prefixo_chave }}...</code>?
          </p>
          <p class="confirm-note">
            O histórico de acessos em <code>log_acessos_api_externa</code> é preservado para auditoria e a chave passará permanentemente para o status <strong>REVOGADA</strong>.
          </p>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" @click="closeRevokeModal">Cancelar</button>
          <button
            type="button"
            class="btn-danger"
            :disabled="isRevoking"
            data-testid="btn-confirm-revoke-apikey"
            @click="handleConfirmRevoke"
          >
            <FiSlash size="15" />
            <span>{{ isRevoking ? 'Revogando...' : 'Confirmar Revogação' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal 4: Logs de Acessos Externos (V40: log_acessos_api_externa) -->
    <div
      v-if="isLogsModalOpen && logsTargetKey"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logs-apikey-title"
      data-testid="external-logs-modal"
      @click.self="closeLogsModal"
      @keydown.esc="closeLogsModal"
    >
      <div class="modal-dialog modal-dialog-lg">
        <div class="modal-header">
          <div class="modal-title-group">
            <FiActivity size="20" class="header-icon" />
            <div>
              <h3 id="logs-apikey-title">Logs de Acessos Externos</h3>
              <p class="modal-subtitle">
                {{ logsTargetKey.nome_parceiro }} &bull; <code>{{ logsTargetKey.prefixo_chave }}...</code>
              </p>
            </div>
          </div>
          <button type="button" class="btn-close" aria-label="Fechar" @click="closeLogsModal">
            <FiX size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="logs-filter-row">
            <div class="search-box">
              <FiSearch size="15" class="search-icon" />
              <label for="external-log-route-search" class="sr-only">Filtrar rota ou IP</label>
              <input
                id="external-log-route-search"
                v-model="logRouteSearch"
                type="text"
                class="input search-input"
                placeholder="Filtrar por rota acessada ou IP de origem..."
                data-testid="external-log-search-input"
              />
            </div>

            <div class="select-group">
              <FiFilter size="14" class="select-icon" />
              <label for="external-log-status-filter" class="sr-only">Filtrar faixa HTTP</label>
              <select
                id="external-log-status-filter"
                v-model="logStatusGroup"
                class="select"
                data-testid="external-log-status-filter"
              >
                <option value="">Todos Status HTTP</option>
                <option value="2xx">Sucesso (2xx)</option>
                <option value="4xx">Erro Cliente / Bloqueio (4xx)</option>
                <option value="5xx">Erro Servidor (5xx)</option>
              </select>
            </div>
          </div>

          <div
            tabindex="0"
            role="region"
            aria-label="Histórico de acessos externos da chave de API"
            class="table-responsive"
          >
            <table class="logs-table" data-testid="external-logs-table">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Rota Acessada</th>
                  <th>Status HTTP</th>
                  <th>IP de Origem</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isLoadingLogs">
                  <td colspan="4" class="empty-state">Carregando registros de acesso...</td>
                </tr>
                <tr
                  v-for="log in filteredExternalLogs"
                  v-else
                  :key="log.id"
                  data-testid="external-log-row"
                >
                  <td>{{ formatDateTime(log.data_acesso) }}</td>
                  <td><code class="route-code">{{ log.rota_acessada }}</code></td>
                  <td>
                    <span class="http-badge" :class="getHttpStatusClass(log.status_http)">
                      {{ log.status_http }}
                    </span>
                  </td>
                  <td><code>{{ log.ip_origem }}</code></td>
                </tr>
                <tr v-if="!isLoadingLogs && filteredExternalLogs.length === 0">
                  <td colspan="4" class="empty-state">
                    Nenhum registro de acesso encontrado para esta chave.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn-secondary"
            data-testid="btn-close-logs-modal"
            @click="closeLogsModal"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.api-keys-tab {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.header-card {
  padding: 1.25rem 1.5rem;
}

.header-main {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.header-title-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.header-icon {
  color: var(--color-brand);
  flex-shrink: 0;
  margin-top: 2px;
}

.danger-icon {
  color: var(--color-danger);
  flex-shrink: 0;
}

.header-title-row h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-heading);
}

.header-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.mode-pill-fallback {
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
  border: 1px solid var(--badge-warning-border);
}

.filter-card {
  padding: 1rem 1.25rem;
}

.filter-bar,
.logs-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.logs-filter-row {
  margin-bottom: 1rem;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 240px;
}

.search-icon {
  position: absolute;
  left: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.input,
.select {
  width: 100%;
  padding: 0.575rem 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--color-text);
  background: var(--color-background);
}

.input:focus,
.select:focus {
  outline: none;
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-ring);
}

.search-input {
  padding-left: 2.35rem;
}

.select-group {
  position: relative;
  min-width: 190px;
}

.select-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.select {
  padding-left: 2.15rem;
}

.table-card {
  overflow: hidden;
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.logs-table th {
  background: var(--color-surface-soft);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.logs-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  vertical-align: middle;
}

.partner-cell {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.partner-name {
  color: var(--color-heading);
  font-weight: 600;
}

.partner-meta,
.date-muted {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.dates-cell {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.prefix-code,
.route-code {
  background: var(--color-code-bg);
  color: var(--color-code-text);
  border: 1px solid var(--color-border);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  font-size: 0.8125rem;
}

.scopes-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  max-width: 300px;
}

.scope-pill {
  display: inline-block;
  padding: 0.18rem 0.5rem;
  border-radius: 9999px;
  background: var(--badge-primary-bg);
  color: var(--badge-primary-text);
  border: 1px solid var(--badge-primary-border);
  font-size: 0.7rem;
  font-weight: 600;
}

.status-badge,
.http-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge-active,
.http-2xx {
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
  border: 1px solid var(--badge-success-border);
}

.badge-revoked,
.http-5xx {
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
  border: 1px solid var(--badge-danger-border);
}

.badge-expired,
.http-4xx {
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
  border: 1px solid var(--badge-warning-border);
}

.last-used-text {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  white-space: nowrap;
}

.action-buttons {
  display: inline-flex;
  gap: 0.5rem;
}

.btn-primary,
.btn-secondary,
.btn-danger,
.btn-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.btn-primary {
  background: var(--color-brand);
  color: var(--color-brand-contrast);
  border: 1px solid var(--color-brand);
  padding: 0.575rem 1rem;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-brand-hover);
  border-color: var(--color-brand-hover);
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  padding: 0.575rem 1rem;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-surface-soft);
  border-color: var(--color-border-hover);
}

.btn-danger {
  background: var(--color-danger);
  color: var(--color-brand-contrast);
  border: 1px solid var(--color-danger);
  padding: 0.575rem 1rem;
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
}

.btn-action {
  padding: 0.375rem 0.65rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.78rem;
}

.btn-logs:hover:not(:disabled) {
  border-color: var(--color-brand);
  color: var(--color-brand);
  background: var(--color-brand-soft);
}

.btn-revoke {
  color: var(--badge-danger-text);
  border-color: var(--badge-danger-border);
}

.btn-revoke:hover:not(:disabled) {
  background: var(--badge-danger-bg);
  border-color: var(--color-danger);
}

.btn-action:disabled,
.btn-primary:disabled,
.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 60;
}

.modal-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal-dialog-sm {
  max-width: 460px;
}

.modal-dialog-lg {
  max-width: 820px;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-title-group {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.modal-title-group h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-heading);
}

.modal-subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
}

.btn-close:hover {
  background: var(--color-surface-soft);
  color: var(--color-heading);
}

.modal-body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-soft);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-heading);
}

.field-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.scopes-fieldset {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.875rem 1rem;
  margin: 0;
}

.scopes-fieldset legend {
  padding: 0 0.4rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-heading);
}

.scopes-checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.625rem;
  margin-top: 0.5rem;
}

.scope-checkbox-card {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
}

.scope-checkbox-card:hover {
  background: var(--color-surface-soft);
}

.scope-checkbox-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.scope-checkbox-text strong {
  font-size: 0.78rem;
  color: var(--color-heading);
}

.scope-checkbox-text small {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.alert-danger-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
  border: 1px solid var(--badge-danger-border);
  font-size: 0.85rem;
}

.warning-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: var(--badge-warning-bg);
  border: 1px solid var(--badge-warning-border);
  color: var(--badge-warning-text);
  font-size: 0.85rem;
}

.warning-box p {
  margin: 0.25rem 0 0;
}

.secret-display-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: var(--color-code-bg);
  color: var(--color-code-text);
  border: 1px solid var(--color-border);
}

.secret-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  word-break: break-all;
}

.btn-copy {
  flex-shrink: 0;
}

.secret-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.confirm-text {
  margin: 0;
  color: var(--color-heading);
  font-size: 0.925rem;
}

.confirm-note {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
