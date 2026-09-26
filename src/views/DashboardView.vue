<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CardContainer from '../components/CardContainer.vue'
import DataTable from '../components/DataTable.vue'
import type { Column } from '../components/DataTable.vue'
import {
  dashboardService,
  type DashboardSummary,
  type ProcessLog,
} from '../services/dashboard'
import {
  FiPlus,
  FiMinus,
  FiAlertTriangle,
  FiUserPlus,
  FiUserCheck,
  FiCheckCircle,
} from 'vue-icons-plus/fi'

const summaryData = ref<DashboardSummary[]>([])
const recentProcesses = ref<ProcessLog[]>([])
const filterOptions = ref<{ conjuntos: any[]; etapas: any[]; situacoes: any[] }>({
  conjuntos: [],
  etapas: [],
  situacoes: [],
})
const isInitialLoading = ref(true)
const isTableLoading = ref(false)
const auditorStatus = ref<Record<string, 'loading' | 'requested' | 'error'>>({})
const router = useRouter()

// Modal de alocação de editor
const showAssignModal = ref(false)
const selectedProcessForEditor = ref<ProcessLog | null>(null)
const selectedEditorName = ref('')
const availableEditors = ref<string[]>([])
const isAssigning = ref(false)
const notificationMessage = ref<string | null>(null)

const goToLog = (id: string) => {
  router.push({ name: 'process-log', params: { id } })
}

const filters = ref({
  dateBeggin: '',
  dateEnd: '',
  conjunto: '',
  etapa: '',
  situacao: '',
})

const tableColumns: Column[] = [
  { key: 'id', label: 'ID CARGA' },
  { key: 'dateTime', label: 'DATA/HORA' },
  { key: 'dataset', label: 'CONJUNTO' },
  { key: 'stage', label: 'ETAPA' },
  { key: 'status', label: 'SITUAÇÃO' },
  { key: 'actions', label: 'AÇÕES' },
]

const loadData = async (currentFilters?: any) => {
  if (!isInitialLoading.value) {
    isTableLoading.value = true
  }
  try {
    const page = await dashboardService.getDashboardProcesses(currentFilters)
    recentProcesses.value = page.content
  } catch (error) {
    console.error('Failed to fetch dashboard processes', error)
  } finally {
    isInitialLoading.value = false
    isTableLoading.value = false
  }
}

const loadSummary = async () => {
  try {
    const summary = await dashboardService.getDashboardSummary()
    summaryData.value = summary
  } catch (error) {
    console.error('Failed to fetch dashboard summary', error)
  }
}

onMounted(async () => {
  dashboardService.getFilterOptions().then((options) => {
    filterOptions.value = options
  })
  availableEditors.value = await dashboardService.getAvailableEditors()
  await Promise.all([loadSummary(), loadData()])
})

const applyFilters = async () => {
  await loadData(filters.value)
}

/**
 * Erro acontece APENAS quando validação ou tratamento dá errado.
 * O botão de adicionar editor só aparece se houver esse erro e ainda não houver editor alocado.
 */
const hasErrorAwaitingEditor = (item: ProcessLog) => {
  const isErrorStage = item.stage === 'Validação' || item.stage === 'Tratamento'
  const isErrorStatus = item.status === 'Falhou' || item.status === 'Aguardando validação'
  return isErrorStage && isErrorStatus && !item.assignedEditor
}

const openAssignModal = (item: ProcessLog) => {
  selectedProcessForEditor.value = item
  if (availableEditors.value.length > 0 && !selectedEditorName.value) {
    const firstEditor = availableEditors.value[0]
    if (firstEditor) selectedEditorName.value = firstEditor
  }
  showAssignModal.value = true
}

const confirmAssignEditor = async () => {
  if (!selectedProcessForEditor.value) return
  isAssigning.value = true
  try {
    const updated = await dashboardService.assignEditor(
      selectedProcessForEditor.value.id,
      selectedEditorName.value,
    )
    if (updated) {
      selectedProcessForEditor.value.assignedEditor = selectedEditorName.value
      selectedProcessForEditor.value.status = 'Em andamento'
      selectedProcessForEditor.value.pauseReason = `Editor ${selectedEditorName.value} alocado para correção do erro na etapa de ${selectedProcessForEditor.value.stage}.`

      // Atualiza os cards puxando as métricas do servidor
      await loadSummary()

      notificationMessage.value = `Editor ${selectedEditorName.value} alocado para a carga ${selectedProcessForEditor.value.id}! Processo agora em andamento.`
      setTimeout(() => {
        notificationMessage.value = null
      }, 5000)
    }
  } catch (err) {
    console.error('Falha ao alocar editor', err)
  } finally {
    isAssigning.value = false
    showAssignModal.value = false
    selectedProcessForEditor.value = null
  }
}

const getBadgeClass = (status: string) => {
  switch (status) {
    case 'Concluída':
      return 'badge badge_success'
    case 'Em andamento':
      return 'badge badge_info'
    case 'Aguardando validação':
      return 'badge badge_warning'
    case 'Falhou':
    case 'Em quarentena':
      return 'badge badge_danger'
    default:
      return 'badge badge_primary'
  }
}

const getProcessLogs = (item: ProcessLog): string[] => {
  if (item.logs?.length) return item.logs
  return item.pauseReason ? [item.pauseReason] : []
}

const requestAuditor = async (item: ProcessLog) => {
  auditorStatus.value[item.id] = 'loading'
  try {
    await dashboardService.requestAuditor(item.id)
    item.auditorRequested = true
    auditorStatus.value[item.id] = 'requested'
  } catch (error) {
    console.error('Failed to request auditor', error)
    auditorStatus.value[item.id] = 'error'
  }
}
</script>

<template>
  <main class="dashboard">

    <div v-if="isInitialLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Carregando dados do dashboard...</p>
    </div>

    <template v-else>
      <!-- Notificação de Alocação de Editor -->
      <Transition name="fade">
        <div v-if="notificationMessage" class="alert alert-success-notification mb-3">
          <FiCheckCircle size="18" />
          <span>{{ notificationMessage }}</span>
        </div>
      </Transition>

      <div class="card-grid">
        <CardContainer
          v-for="(item, index) in summaryData"
          :key="index"
          :title="item.title"
          :value="item.value"
          :variant="item.type"
          :iconType="item.iconType"
        />
      </div>

      <div class="card card-filters mt-4">
        <div class="card-content filters-container">
          <div class="filter-item filter-dates">
            <div class="date-row">
              <label for="dateBeggin">Início:</label>
              <input
                type="date"
                id="dateBeggin"
                name="dateBeggin"
                class="input-inline"
                v-model="filters.dateBeggin"
              />
            </div>
            <div class="date-row">
              <label for="dateEnd">Fim:</label>
              <input
                type="date"
                id="dateEnd"
                name="dateEnd"
                class="input-inline"
                v-model="filters.dateEnd"
              />
            </div>
          </div>

          <div class="filter-item">
            <label>Conjunto:</label>
            <select class="input-inline" v-model="filters.conjunto">
              <option value="">Todos</option>
              <option v-for="opt in filterOptions.conjuntos" :key="opt.id" :value="opt.id">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="filter-item">
            <label>Etapa:</label>
            <select class="input-inline" v-model="filters.etapa">
              <option value="">Todas</option>
              <option v-for="opt in filterOptions.etapas" :key="opt.id" :value="opt.id">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="filter-item">
            <label>Situação:</label>
            <select class="input-inline" v-model="filters.situacao">
              <option value="">Todas</option>
              <option v-for="opt in filterOptions.situacoes" :key="opt.id" :value="opt.id">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="filter-actions">
            <button class="btn" @click="applyFilters">Buscar</button>
          </div>
        </div>
      </div>

      <div class="mt-4">
        <div v-if="isTableLoading" class="loading-state" style="padding: 2rem">
          <div class="spinner"></div>
          <p>Atualizando tabela...</p>
        </div>
        <DataTable v-else :columns="tableColumns" :data="recentProcesses" rowKey="id">
          <template #cell-status="{ item, value }">
            <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap">
              <span :class="getBadgeClass(value)">{{ value }}</span>
              <span
                v-if="item.assignedEditor"
                class="badge badge-editor-assigned"
                title="Auditor/Editor alocado para correção"
              >
                <FiUserCheck size="11" /> Em Correção
              </span>
            </div>
          </template>

          <template #cell-actions="{ isExpanded }">
            <div class="table-actions">
              <span class="action-icon">
                <FiMinus v-if="isExpanded" size="18" />
                <FiPlus v-else size="18" />
              </span>
            </div>
          </template>

          <template #expanded-row="{ item }">
            <div class="expanded-details">
              <p v-if="item.source">
                <strong>Fonte:</strong> {{ item.source }} | <strong>Ano:</strong> {{ item.year }} |
                <strong>EPSG:</strong> {{ item.epsg }}
              </p>

              <section v-if="getProcessLogs(item).length" class="system-log mt-3" aria-label="Log do sistema">
                <h3>Log do sistema</h3>
                <ul>
                  <li v-for="(entry, index) in getProcessLogs(item)" :key="index">{{ entry }}</li>
                </ul>
              </section>

              <div v-if="item.pauseReason && !item.logs?.length" class="alert alert-warning mt-2">
                <span class="alert-icon">⚠️</span>
                <strong>Motivo da Pausa:</strong> {{ item.pauseReason }}
              </div>

              <div v-if="item.assignedEditor" class="alert alert-info mt-2">
                <FiUserCheck size="16" style="flex-shrink: 0" />
                <span>
                  <strong>Editor Responsável:</strong> {{ item.assignedEditor }} (Corrigindo o processo)
                </span>
              </div>

              <div v-if="item.quarantined" class="expanded-actions mt-3">
                <button
                  class="btn btn_danger"
                  type="button"
                  :disabled="auditorStatus[item.id] === 'loading' || item.auditorRequested"
                  @click="requestAuditor(item)"
                >
                  {{
                    auditorStatus[item.id] === 'loading'
                      ? 'Acionando...'
                      : item.auditorRequested || auditorStatus[item.id] === 'requested'
                        ? 'Auditor acionado'
                        : 'Acionar Auditor'
                  }}
                </button>
                <p v-if="auditorStatus[item.id] === 'error'" class="auditor-error" role="alert">
                  Não foi possível acionar o auditor. Tente novamente.
                </p>
              </div>

              <div class="expanded-actions mt-3">
                <button class="btn btn_outline" @click="goToLog(item.id)">Ver Log Completo</button>

                <button
                  v-if="hasErrorAwaitingEditor(item)"
                  class="btn btn_danger ml-2"
                  @click="openAssignModal(item)"
                >
                  <FiUserPlus size="14" style="margin-right: 4px" />
                  Adicionar Editor
                </button>
              </div>
            </div>
          </template>
        </DataTable>
      </div>

      <!-- Modal de Alocação de Editor -->
      <div
        v-if="showAssignModal && selectedProcessForEditor"
        class="modal-backdrop"
        @click.self="showAssignModal = false"
      >
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>Alocar Editor para Correção</h3>
            <button class="modal-close" @click="showAssignModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <p>
              A carga <strong>{{ selectedProcessForEditor.id }}</strong> ({{
                selectedProcessForEditor.dataset
              }}) apresentou erro na etapa de <strong>{{ selectedProcessForEditor.stage }}</strong
              >.
            </p>
            <div v-if="selectedProcessForEditor.pauseReason" class="alert alert-warning mb-3">
              <FiAlertTriangle size="15" style="flex-shrink: 0" />
              <small>{{ selectedProcessForEditor.pauseReason }}</small>
            </div>
            <div class="form-group">
              <label class="label">Selecione o Editor Especialista:</label>
              <select class="input" v-model="selectedEditorName">
                <option v-for="editor in availableEditors" :key="editor" :value="editor">
                  {{ editor }}
                </option>
              </select>
            </div>
            <p class="modal-hint">
              Ao alocar um editor, o status da carga passará imediatamente para
              <strong>"Em andamento"</strong> para a execução das correções manuais.
            </p>
          </div>
          <div class="modal-footer">
            <button
              class="btn btn_outline"
              @click="showAssignModal = false"
              :disabled="isAssigning"
            >
              Cancelar
            </button>
            <button class="btn btn_primary" @click="confirmAssignEditor" :disabled="isAssigning">
              <span v-if="!isAssigning">Confirmar Alocação</span>
              <span v-else>Alocando...</span>
            </button>
          </div>
        </div>
      </div>

      <div class="bottom-action mt-5 text-center">
        <router-link to="/upload" class="btn btn-upload"
          >+ NOVA CARGA DE DADOS (Upload)</router-link
        >
      </div>
    </template>
  </main>
</template>

<style scoped>
.dashboard-header {
  padding: 2rem 2rem 0;
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.dashboard-header h1 {
  margin: 0;
  color: var(--color-heading);
  font-size: 1.5rem;
}

.dashboard-header .subtitle {
  font-size: 1.1rem;
  color: var(--color-text);
  opacity: 0.8;
  font-weight: normal;
}

.dashboard {
  display: flex;
  flex-direction: column;
  padding: 2rem;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
}

.mt-4 {
  margin-top: 1.5rem;
}
.mt-5 {
  margin-top: 2rem;
}
.mt-2 {
  margin-top: 0.5rem;
}
.mt-3 {
  margin-top: 1rem;
}
.ml-2 {
  margin-left: 0.5rem;
}
.text-center {
  text-align: center;
}

.card-filters {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.filters-container {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
}

.filter-item {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--color-text);
  background-color: var(--color-background);
  min-height: 100%;
}

.filter-item label {
  font-weight: 600;
  white-space: nowrap;
  color: var(--color-heading);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.filter-dates {
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0.25rem;
}

.date-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 0.35rem;
}

.input-inline {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  color: var(--color-text);
  padding: 0;
  margin: 0;
  cursor: pointer;
}

.filter-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.btn-upload {
  background-color: var(--vis-brand-orange, #f26522);
  color: white;
  border: none;
  border-radius: 9999px;
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    opacity 0.2s,
    transform 0.1s;
  box-shadow: 0 4px 6px rgba(242, 101, 34, 0.3);
  animation: uploadPulse 2.8s ease-in-out infinite;
}

.btn-upload:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  animation-play-state: paused;
}

@keyframes uploadPulse {
  0%,
  100% {
    box-shadow: 0 4px 6px rgba(242, 101, 34, 0.3);
  }
  50% {
    box-shadow: 0 7px 20px rgba(242, 101, 34, 0.48);
  }
}

.action-icon {
  font-weight: bold;
  color: var(--color-text);
  opacity: 0.6;
  font-family: monospace;
  font-size: 1rem;
}

.expanded-details {
  background-color: #fefdf5;
  border-left: 4px solid var(--vis-c-warning, #eab308);
  padding: 1rem;
  border-radius: 0 8px 8px 0;
}

@media (prefers-color-scheme: dark) {
  .expanded-details {
    background-color: rgba(234, 179, 8, 0.05);
  }
}

.expanded-details p {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
}

.system-log {
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
}

.system-log h3 {
  margin-bottom: 0.5rem;
  color: var(--color-heading);
  font-size: 0.9rem;
  font-weight: 700;
}

.system-log ul {
  display: grid;
  gap: 0.35rem;
  padding-left: 1.25rem;
  color: var(--color-text);
  font-family: monospace;
  font-size: 0.82rem;
}

.expanded-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.auditor-error {
  color: var(--vis-c-danger, #ef4444);
}

.alert-warning {
  background-color: rgba(234, 179, 8, 0.15);
  color: var(--color-text);
  padding: 0.75rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.alert-warning strong {
  color: #b45309;
}

:root[data-theme='dark'] .alert-warning strong {
  color: #fef08a;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  gap: 1rem;
  color: var(--color-text);
}

.alert-success-notification {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background-color: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.95rem;
}

.badge-editor-assigned {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background-color: rgba(242, 101, 34, 0.12);
  color: var(--vis-brand-orange, #f26522);
  border: 1px solid rgba(242, 101, 34, 0.3);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
}

.alert-info {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--color-text);
  border-left: 3px solid #3b82f6;
  padding: 0.65rem 0.85rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  box-sizing: border-box;
}

.modal-dialog {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  animation: modalScale 0.25s ease-out;
}

@keyframes modalScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  color: var(--color-heading);
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--color-text);
  cursor: pointer;
  opacity: 0.6;
}

.modal-close:hover {
  opacity: 1;
}

.modal-body {
  padding: 1.5rem;
}

.modal-body p {
  margin: 0 0 1rem 0;
  color: var(--color-text);
  font-size: 0.95rem;
  line-height: 1.5;
}

.modal-hint {
  font-size: 0.8rem !important;
  color: var(--color-text);
  opacity: 0.75;
  background-color: var(--color-background);
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  border: 1px dashed var(--color-border);
  margin-top: 1rem !important;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background-color: var(--color-background);
  border-top: 1px solid var(--color-border);
}
</style>
