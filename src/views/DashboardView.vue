<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CardContainer from '../components/CardContainer.vue'
import DataTable from '../components/DataTable.vue'
import type { Column } from '../components/DataTable.vue'
import { dashboardService, type DashboardSummary, type ProcessLog } from '../services/dashboard'
import { FiPlus, FiMinus, FiAlertTriangle } from 'vue-icons-plus/fi'

const summaryData = ref<DashboardSummary[]>([])
const recentProcesses = ref<ProcessLog[]>([])
const filterOptions = ref<{ conjuntos: any[]; etapas: any[]; situacoes: any[] }>({
  conjuntos: [],
  etapas: [],
  situacoes: [],
})
const isInitialLoading = ref(true)
const isTableLoading = ref(false)
const router = useRouter()

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
    const processes = await dashboardService.getDashboardProcesses(currentFilters)
    recentProcesses.value = processes
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
  await Promise.all([loadSummary(), loadData()])
})

const applyFilters = async () => {
  await loadData(filters.value)
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
      return 'badge badge_danger'
    default:
      return 'badge badge_primary'
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
          <template #cell-status="{ value }">
            <span :class="getBadgeClass(value)">{{ value }}</span>
          </template>

          <template #cell-actions="{ item, isExpanded }">
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
              <div v-if="item.pauseReason" class="alert alert-warning mt-2">
                <FiAlertTriangle size="16" style="flex-shrink:0" />
                <strong>Motivo da Pausa:</strong> {{ item.pauseReason }}
              </div>

              <div class="expanded-actions mt-3">
                <button 
                  class="btn btn_outline" 
                  @click="goToLog(item.id)"
                >
                  Ver Log Completo
                </button>
                <button 
                  v-if="item.status === 'Falhou' || item.status === 'Aguardando validação'"
                  class="btn btn_danger ml-2"
                >
                  Acionar Auditor
                </button>
              </div>
            </div>
          </template>
        </DataTable>
      </div>

      <div class="bottom-action mt-5 text-center">
        <router-link to="/upload" class="btn btn-upload">+ NOVA CARGA DE DADOS (Upload)</router-link>
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
</style>
