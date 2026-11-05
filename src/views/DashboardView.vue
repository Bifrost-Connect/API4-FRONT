<script setup lang="ts">
/**
 * View principal unificada do Dashboard Operacional.
 * Exibe métricas consolidadas, abas de categoria rápida, filtros de busca,
 * tabela de processos recentes com expansão de detalhes e alocação de especialista.
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import CardContainer from '../components/CardContainer.vue'
import DataTable from '../components/DataTable.vue'
import type { Column } from '../components/DataTable.vue'
import ProcessFilterBar, {
  type StandardFilters,
  type FilterOptionsData,
} from '../components/ProcessFilterBar.vue'
import Stepper from '../components/Stepper.vue'
import {
  dashboardService,
  type DashboardSummary,
  type ProcessLog,
} from '../services/dashboard'
import { processService } from '../services/process'
import {
  PROCESS_STEPS,
  type ProcessCategory,
  isErrorOrQuarantined,
  matchesCategory,
  matchesStandardFilters,
  getStepIndex,
  getProgressStep,
  getWarningStep,
  getStatusBadgeClass,
} from '../utils/processUtils'
import {
  FiPlus,
  FiMinus,
  FiAlertTriangle,
  FiUserPlus,
  FiUserCheck,
  FiCheckCircle,
} from 'vue-icons-plus/fi'

const router = useRouter()

// Estados dos dados do dashboard
const summaryData = ref<DashboardSummary[]>([])
const recentProcesses = ref<ProcessLog[]>([])
const filterOptions = ref<FilterOptionsData>({
  conjuntos: [],
  etapas: [],
  situacoes: [],
})

const isInitialLoading = ref(true)
const isTableLoading = ref(false)
const auditorStatus = ref<Record<string, 'loading' | 'requested' | 'error'>>({})

// Filtro rápido por categoria em abas
const selectedCategory = ref<ProcessCategory>('TODAS')

// Filtros tradicionais padronizados
const filters = ref<StandardFilters>({
  dateBeggin: '',
  dateEnd: '',
  conjunto: '',
  etapa: '',
  situacao: '',
})

// Modal de alocação de especialista para correção de carga
const showAssignModal = ref(false)
const selectedProcessForEditor = ref<ProcessLog | null>(null)
const selectedEditorId = ref<number | ''>('')
const availableEditors = ref<{ id: number; name: string }[]>([])
const isAssigning = ref(false)
const notificationMessage = ref<string | null>(null)

// Colunas da tabela DataTable
const tableColumns: Column[] = [
  { key: 'id', label: 'ID CARGA' },
  { key: 'dateTime', label: 'DATA/HORA' },
  { key: 'dataset', label: 'CONJUNTO' },
  { key: 'stage', label: 'ETAPA' },
  { key: 'status', label: 'SITUAÇÃO' },
  { key: 'actions', label: 'AÇÕES' },
]

/**
 * Filtra a lista de processos de acordo com a aba de categoria selecionada
 * e os filtros de formulário preenchidos.
 */
const displayedProcesses = computed(() => {
  return recentProcesses.value.filter((item) => {
    if (!matchesCategory(item, selectedCategory.value)) {
      return false
    }
    return matchesStandardFilters(item, filters.value, filterOptions.value)
  })
})

/**
 * Resumo dos cards de indicadores (usa os dados retornados pela API com fallback operacional).
 */
const displayedSummary = computed<DashboardSummary[]>(() => {
  if (summaryData.value.length > 0) {
    return summaryData.value
  }

  return [
    {
      title: 'Total de Cargas',
      value: recentProcesses.value.length,
      type: 'info',
      iconType: 'down',
    },
    {
      title: 'Cargas Concluídas',
      value: recentProcesses.value.filter((p) => (p.status || '').toLowerCase().includes('conclu')).length,
      type: 'success',
      iconType: 'check',
    },
    {
      title: 'Inconsistências / Falhas',
      value: recentProcesses.value.filter(isErrorOrQuarantined).length,
      type: 'danger',
      iconType: 'error',
    },
    {
      title: 'Em Andamento',
      value: recentProcesses.value.filter((p) => (p.status || '').toLowerCase().includes('andamento')).length,
      type: 'warning',
      iconType: 'warning',
    },
  ]
})

/**
 * Carrega a lista paginada de processos da API.
 */
const loadData = async (currentFilters?: any) => {
  if (!isInitialLoading.value) {
    isTableLoading.value = true
  }
  try {
    const page = await dashboardService.getDashboardProcesses(currentFilters)
    recentProcesses.value = page.content || []
  } catch (error) {
    console.error('Falha ao buscar processos do dashboard:', error)
  } finally {
    isInitialLoading.value = false
    isTableLoading.value = false
  }
}

/**
 * Carrega as métricas consolidadas dos cards.
 */
const loadSummary = async () => {
  try {
    const summary = await dashboardService.getDashboardSummary()
    summaryData.value = summary
  } catch (error) {
    console.error('Falha ao buscar resumo de métricas do dashboard:', error)
  }
}

onMounted(async () => {
  dashboardService.getFilterOptions().then((options) => {
    if (options) {
      filterOptions.value = options
    }
  })
  availableEditors.value = await dashboardService.getAvailableEditors()
  await Promise.all([loadSummary(), loadData()])
})

/**
 * Aplica os filtros na busca do servidor.
 */
const applyFilters = async () => {
  await loadData(filters.value)
}

/**
 * Navega para a tela de linhagem e acompanhamento detalhado da carga.
 */
const goToLog = (id: string) => {
  router.push({ name: 'process-log', params: { id } })
}

/**
 * Verifica se a carga possui retenção/erro e ainda aguarda especialista.
 */
const hasErrorAwaitingEditor = (item: ProcessLog) => {
  if (item.assignedEditor) return false
  const status = (item.status || '').toLowerCase()
  if (status.includes('conclu')) return false
  const stage = (item.stage || '').toLowerCase()
  return (
    status.includes('falh') ||
    status.includes('quarentena') ||
    status.includes('ressalva') ||
    status.includes('valida') ||
    stage.includes('valida') ||
    stage.includes('trata')
  )
}

const openAssignModal = (item: ProcessLog) => {
  selectedProcessForEditor.value = item
  if (availableEditors.value.length > 0 && selectedEditorId.value === '') {
    const firstEditor = availableEditors.value[0]
    if (firstEditor) selectedEditorId.value = firstEditor.id
  }
  showAssignModal.value = true
}

const confirmAssignEditor = async () => {
  if (!selectedProcessForEditor.value || selectedEditorId.value === '') return
  isAssigning.value = true
  try {
    const editorObj = availableEditors.value.find((e) => e.id === selectedEditorId.value)
    const editorName = editorObj ? editorObj.name : 'Especialista'

    const updated = await dashboardService.assignEditor(
      selectedProcessForEditor.value.id,
      Number(selectedEditorId.value),
      editorName,
    )

    if (/^\d+$/.test(String(selectedProcessForEditor.value.id))) {
      try {
        await processService.alocarAuditor(
          selectedProcessForEditor.value.id,
          Number(selectedEditorId.value),
          1,
        )
      } catch (err) {
        console.warn('Aviso ao registrar alocação no backend:', err)
      }
    }

    if (updated) {
      selectedProcessForEditor.value.assignedEditor = editorName
      selectedProcessForEditor.value.status = 'Em andamento'
      selectedProcessForEditor.value.pauseReason = `Especialista ${editorName} alocado para correção na etapa de ${selectedProcessForEditor.value.stage}.`

      await loadSummary()

      notificationMessage.value = `Especialista ${editorName} alocado para a carga ${selectedProcessForEditor.value.id}!`
      setTimeout(() => {
        notificationMessage.value = null
      }, 5000)
    }
  } catch (err) {
    console.error('Falha ao alocar especialista:', err)
  } finally {
    isAssigning.value = false
    showAssignModal.value = false
    selectedProcessForEditor.value = null
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
    console.error('Falha ao sinalizar operador:', error)
    auditorStatus.value[item.id] = 'error'
  }
}
</script>

<template>
  <main class="dashboard">
    <!-- Cabeçalho Principal do Dashboard -->
    <header class="page-heading">
      <div>
        <p class="eyebrow">Monitoramento do Sistema</p>
        <h1>Dashboard Operacional</h1>
        <p class="page-description">
          Acompanhamento em tempo real da esteira de ingestão, validação, tratamento e publicação de cargas.
        </p>
      </div>
    </header>

    <!-- Estado de Carregamento Inicial -->
    <div v-if="isInitialLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Carregando dados do sistema...</p>
    </div>

    <template v-else>
      <!-- Notificação de Alocação de Especialista -->
      <Transition name="fade">
        <div v-if="notificationMessage" class="alert alert-success-notification mb-3">
          <FiCheckCircle size="18" />
          <span>{{ notificationMessage }}</span>
        </div>
      </Transition>

      <!-- Cards de Resumo das Cargas -->
      <div class="card-grid">
        <CardContainer
          v-for="(item, index) in displayedSummary"
          :key="index"
          :title="item.title"
          :value="item.value"
          :variant="item.type"
          :iconType="item.iconType"
        />
      </div>

      <!-- Barra de Filtros Compartilhada (Abas de Categoria + Filtros Tradicionais) -->
      <ProcessFilterBar
        class="mt-4"
        v-model="filters"
        v-model:selectedCategory="selectedCategory"
        :items="recentProcesses"
        :filterOptions="filterOptions"
        @filter="applyFilters"
      />

      <!-- Tabela com DataTable -->
      <div class="mt-4">
        <div v-if="isTableLoading" class="loading-state" style="padding: 2rem">
          <div class="spinner"></div>
          <p>Atualizando tabela...</p>
        </div>

        <div v-else-if="displayedProcesses.length === 0" class="empty-state card card-content">
          <FiCheckCircle size="42" class="text-success mb-2" />
          <h3>Nenhuma carga encontrada nesta categoria</h3>
          <p class="text-muted">Não há registros atendendo aos filtros selecionados.</p>
        </div>

        <DataTable v-else :columns="tableColumns" :data="displayedProcesses" rowKey="id">
          <!-- Coluna Situação com Badge Semântico -->
          <template #cell-status="{ item, value }">
            <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap">
              <span :class="getStatusBadgeClass(value)">{{ value }}</span>
              <span
                v-if="item.assignedEditor"
                class="badge badge-editor-assigned"
                title="Especialista alocado para resolução"
              >
                <FiUserCheck size="11" /> {{ item.assignedEditor }}
              </span>
            </div>
          </template>

          <!-- Coluna Ações de Expansão -->
          <template #cell-actions="{ isExpanded }">
            <div class="table-actions">
              <span class="action-icon">
                <FiMinus v-if="isExpanded" size="18" />
                <FiPlus v-else size="18" />
              </span>
            </div>
          </template>

          <!-- Linha Expandida com Detalhes, Stepper e Ações -->
          <template #expanded-row="{ item }">
            <div class="expanded-details">
              <p v-if="item.source">
                <strong>Fonte:</strong> {{ item.source }} | <strong>Ano:</strong> {{ item.year }} |
                <strong>EPSG:</strong> {{ item.epsg }}
              </p>

              <!-- Stepper com a etapa da esteira -->
              <div class="expanded-stepper">
                <Stepper
                  :currentStep="getStepIndex(item)"
                  :progressStep="getProgressStep(item)"
                  :warningStep="getWarningStep(item)"
                  :steps="PROCESS_STEPS"
                />
              </div>

              <!-- Motivo da Inconsistência -->
              <div v-if="item.pauseReason" class="alert alert-warning mt-2">
                <span class="alert-icon">⚠️</span>
                <div>
                  <strong>Motivo da Inconsistência:</strong>
                  <p style="margin: 0.25rem 0 0;">{{ item.pauseReason }}</p>
                </div>
              </div>

              <!-- Especialista Alocado -->
              <div v-if="item.assignedEditor" class="alert alert-info mt-2">
                <FiUserCheck size="16" style="flex-shrink: 0" />
                <span>
                  <strong>Especialista Designado:</strong> {{ item.assignedEditor }} (atuando na correção)
                </span>
              </div>

              <!-- Logs do Sistema -->
              <section v-if="getProcessLogs(item).length" class="system-log mt-3" aria-label="Log do sistema">
                <h3>Logs e Trilha de Execução</h3>
                <ul>
                  <li v-for="(entry, index) in getProcessLogs(item)" :key="index">{{ entry }}</li>
                </ul>
              </section>

              <!-- Ações da Linha Expandida -->
              <div class="expanded-actions mt-3">
                <button
                  type="button"
                  class="btn btn_outline btn_action_audit"
                  @click="goToLog(item.id)"
                >
                  AUDITAR CARGA / VER LINHAGEM
                </button>

                <button
                  v-if="hasErrorAwaitingEditor(item)"
                  type="button"
                  class="btn btn_action_editor"
                  @click="openAssignModal(item)"
                >
                  <FiUserPlus size="14" />
                  ALOCAR ESPECIALISTA
                </button>

                <button
                  v-if="item.quarantined || (item.status && item.status.toLowerCase().includes('quarentena'))"
                  class="btn btn_action_notify"
                  type="button"
                  :disabled="auditorStatus[item.id] === 'loading' || item.auditorRequested"
                  @click="requestAuditor(item)"
                >
                  <FiAlertTriangle size="14" />
                  {{
                    auditorStatus[item.id] === 'loading'
                      ? 'SINALIZANDO...'
                      : item.auditorRequested || auditorStatus[item.id] === 'requested'
                        ? 'OPERADOR SINALIZADO'
                        : 'SINALIZAR AO OPERADOR'
                  }}
                </button>
              </div>

              <p v-if="auditorStatus[item.id] === 'error'" class="auditor-error mt-2" role="alert">
                Não foi possível sinalizar ao operador. Tente novamente.
              </p>
            </div>
          </template>
        </DataTable>
      </div>

      <!-- Modal de Alocação de Especialista -->
      <div
        v-if="showAssignModal && selectedProcessForEditor"
        class="modal-backdrop"
        @click.self="showAssignModal = false"
      >
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>Alocar Especialista para Correção</h3>
            <button class="modal-close" @click="showAssignModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <p>
              A carga <strong>{{ selectedProcessForEditor.id }}</strong> ({{
                selectedProcessForEditor.dataset
              }}) apresentou inconsistência na etapa de <strong>{{ selectedProcessForEditor.stage }}</strong
              >.
            </p>
            <div v-if="selectedProcessForEditor.pauseReason" class="alert alert-warning mb-3">
              <FiAlertTriangle size="15" style="flex-shrink: 0" />
              <small>{{ selectedProcessForEditor.pauseReason }}</small>
            </div>
            <div class="form-group">
              <label class="label">Selecione o Especialista:</label>
              <select class="input" v-model="selectedEditorId">
                <option v-for="editor in availableEditors" :key="editor.id" :value="editor.id">
                  {{ editor.name }}
                </option>
              </select>
            </div>
            <p class="modal-hint">
              Ao alocar um especialista, o status da carga passará para
              <strong>"Em andamento"</strong> para a execução das correções.
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

      <!-- Atalho de Upload de Carga -->
      <div class="bottom-action">
        <RouterLink to="/upload" class="btn-upload">
          + NOVA CARGA DE DADOS (Upload)
        </RouterLink>
      </div>
    </template>
  </main>
</template>

<style scoped>
.dashboard {
  max-width: 1240px;
  margin: 0 auto;
  color: var(--color-text);
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--vis-brand-orange);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.page-heading h1 {
  margin: 0;
  color: var(--color-heading);
  font-size: 1.8rem;
}

.page-description {
  margin: 8px 0 0;
  color: var(--color-text-muted);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.bottom-action {
  display: flex;
  justify-content: center;
  margin: 2rem 0 1rem;
}

.btn-upload {
  display: inline-block;
  text-decoration: none;
  letter-spacing: 0.03em;
  background-color: var(--vis-brand-orange, #f26522);
  color: white;
  border: none;
  border-radius: 9999px;
  padding: 0.85rem 2rem;
  font-size: 0.95rem;
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

/* Badges e Tabela */
.badge {
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.badge_success { background: var(--badge-success-bg); color: var(--badge-success-text); border: 1px solid var(--badge-success-border); }
.badge_info { background: var(--badge-info-bg); color: var(--badge-info-text); border: 1px solid var(--badge-info-border); }
.badge_warning { background: var(--badge-warning-bg); color: var(--badge-warning-text); border: 1px solid var(--badge-warning-border); }
.badge_danger { background: var(--badge-danger-bg); color: var(--badge-danger-text); border: 1px solid var(--badge-danger-border); }
.badge_primary { background: var(--badge-neutral-bg); color: var(--badge-neutral-text); border: 1px solid var(--badge-neutral-border); }

.badge-editor-assigned {
  background: var(--badge-editor-bg);
  color: var(--badge-editor-text);
  border: 1px solid var(--badge-editor-border);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.table-actions {
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon {
  cursor: pointer;
  color: var(--vis-brand-orange);
}

/* Linha expandida */
.expanded-details {
  background: transparent;
  padding: 0;
}

.expanded-stepper {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--vis-brand-orange, #f26522);
  border-radius: 8px;
  padding: 1rem 1rem 0.25rem;
  margin: 0.5rem 0 0.75rem;
}

.expanded-stepper :deep(.stepper) {
  margin-bottom: 0.75rem;
}

.expanded-details p {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
}

.system-log {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.75rem 1rem;
}

.system-log h3 {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: var(--color-heading);
}

.system-log ul {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.expanded-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.btn_action_audit {
  border: 1px solid var(--vis-brand-orange, #f26522);
  color: var(--vis-brand-orange, #f26522);
  background: transparent;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.6rem 1.25rem;
  font-size: 0.82rem;
  text-transform: uppercase;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.btn_action_audit:hover {
  background: var(--vis-brand-orange, #f26522);
  color: #fff;
}

.btn_action_editor {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--badge-editor-border);
  color: var(--badge-editor-text);
  background: var(--badge-editor-bg);
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.6rem 1.25rem;
  font-size: 0.82rem;
  text-transform: uppercase;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.btn_action_editor:hover {
  background: var(--badge-editor-text);
  color: #fff;
}

.btn_action_notify {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--badge-danger-border);
  color: var(--badge-danger-text);
  background: var(--badge-danger-bg);
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.6rem 1.25rem;
  font-size: 0.82rem;
  text-transform: uppercase;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.btn_action_notify:hover:not(:disabled) {
  background: var(--vis-c-danger, #ef4444);
  color: #fff;
}

.btn_action_notify:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auditor-error {
  color: var(--vis-c-danger, #ef4444);
}

.alert-warning {
  background-color: var(--badge-warning-bg);
  border: 1px solid var(--badge-warning-border);
  color: var(--color-text);
  padding: 0.75rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.alert-warning strong {
  color: var(--badge-warning-text);
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
}

.text-success { color: var(--vis-c-success); }
.text-muted { color: var(--color-text-muted); }

.alert-success-notification {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background-color: var(--badge-success-bg);
  border: 1px solid var(--badge-success-border);
  color: var(--badge-success-text);
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.95rem;
}

.alert-info {
  background-color: var(--badge-info-bg);
  border: 1px solid var(--badge-info-border);
  border-left: 3px solid var(--vis-c-info);
  color: var(--color-text);
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
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--color-text);
  opacity: 0.5;
  cursor: pointer;
  line-height: 1;
}

.modal-close:hover {
  opacity: 1;
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-top: 1rem;
}

.modal-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 0.75rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border);
  background-color: var(--color-background);
}
</style>
