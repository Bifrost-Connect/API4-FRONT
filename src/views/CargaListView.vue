<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { FiSearch } from 'vue-icons-plus/fi'
import { dashboardService, type ProcessLog } from '@/services/dashboard'

const router = useRouter()
const searchQuery = ref('')
const processos = ref<ProcessLog[]>([])
const isLoading = ref(true)
const loadError = ref(false)
const dataSource = ref<'API' | 'DEMONSTRACAO' | ''>('')
const currentPage = ref(0)
const totalPages = ref(1)

const loadPage = async (pageNumber: number) => {
  isLoading.value = true
  loadError.value = false
  try {
    const page = await dashboardService.getDashboardProcesses({ page: pageNumber, size: 10 })
    processos.value = page.content
    dataSource.value = page.source ?? 'API'
    currentPage.value = page.number
    totalPages.value = Math.max(1, page.totalPages)
  } catch (error) {
    console.error('Não foi possível carregar as cargas para auditoria:', error)
    loadError.value = true
  } finally {
    isLoading.value = false
  }
}

onMounted(() => void loadPage(0))

const filteredProcessos = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return processos.value
  return processos.value.filter((process) =>
    [process.id, process.dataset, process.source, process.stage, process.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)),
  )
})

const navigateToProcess = (processId: string) => {
  router.push({ name: 'process-log', params: { id: processId } })
}

const handleSearch = () => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return
  const found = filteredProcessos.value[0]
  if (found) navigateToProcess(found.id)
}

const getStatusClass = (status: string) => {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '-')
  if (normalized.includes('conclu')) return 'status-concluida'
  if (normalized.includes('andamento')) return 'status-em-andamento'
  if (normalized.includes('aguardando') || normalized.includes('valida'))
    return 'status-aguardando-validacao'
  if (normalized.includes('falh')) return 'status-falhou'
  if (normalized.includes('fechad')) return 'status-concluida'
  return ''
}
</script>

<template>
  <div class="view-wrapper">
    <div class="view-container">
      <div class="header-section">
        <h1 class="page-title">Auditoria de Cargas</h1>
        <p class="page-subtitle">
          Pesquise cargas e consulte os detalhes, a linhagem do arquivo e os logs disponíveis.
        </p>
        <span v-if="dataSource === 'DEMONSTRACAO'" class="demo-label">Lista demonstrativa</span>
      </div>

      <!-- Barra de Busca -->
      <div class="card-box mb-8 border-brand-left">
          <h3 class="mb-4 mt-0 text-lg">Buscar carga</h3>
        <div class="flex items-center gap-4">
          <div class="search-wrapper w-full">
            <FiSearch class="search-icon" size="20" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Digite o ID da carga, conjunto de dados ou etapa..."
              class="input pl-10"
              @keyup.enter="handleSearch"
            />
          </div>
          <button class="btn" @click="handleSearch">
            Pesquisar
          </button>
        </div>
      </div>

      <!-- Grid de Cargas Prontas para Auditoria -->
      <div class="recent-list">
        <div v-if="isLoading" class="empty-state" role="status">
          Carregando cargas...
        </div>
        <div v-else-if="loadError" class="empty-state" role="alert">
          Não foi possível carregar as cargas. Tente novamente mais tarde.
        </div>
        <div v-else-if="filteredProcessos.length === 0" class="empty-state">
          <p>Nenhuma carga encontrada para a pesquisa.</p>
        </div>

        <div v-else class="processes-grid">
          <div
            v-for="process in filteredProcessos"
            :key="process.id"
            class="process-card card-box"
            role="button"
            tabindex="0"
            @click="navigateToProcess(process.id)"
            @keydown.enter="navigateToProcess(process.id)"
            @keydown.space.prevent="navigateToProcess(process.id)"
          >
            <div class="process-header">
              <strong class="carga-id">{{ process.id }}</strong>
              <span class="version-count-badge">Linhagem e logs</span>
            </div>

            <h4 class="process-dataset">{{ process.dataset }}</h4>
            <p class="process-layer">{{ process.stage }}<template v-if="process.source"> &bull; {{ process.source }}</template></p>

            <div class="process-footer">
              <div class="status-indicator">
                <span class="location-dot" :class="getStatusClass(process.status)"></span>
                <span class="status-text">{{ process.status }}</span>
              </div>
              <span class="process-date">{{ process.dateTime }}</span>
            </div>

            <div class="action-hint">
              <span>Auditar processo &rarr;</span>
            </div>
          </div>
        </div>
        <nav v-if="!isLoading && !loadError && totalPages > 1" class="page-controls" aria-label="Paginação das cargas">
          <button class="btn btn_outline" type="button" :disabled="currentPage === 0" @click="loadPage(currentPage - 1)">
            Anterior
          </button>
          <span>Página {{ currentPage + 1 }} de {{ totalPages }}</span>
          <button class="btn btn_outline" type="button" :disabled="currentPage + 1 >= totalPages" @click="loadPage(currentPage + 1)">
            Próxima
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Reset and Base */
.m-0 { margin: 0; }
.p-0 { padding: 0; }
.mb-4 { margin-bottom: 1rem; }
.mb-6 { margin-bottom: 1.5rem; }
.mb-8 { margin-bottom: 2rem; }
.mt-0 { margin-top: 0; }
.w-full { width: 100%; }

/* Flex & Grid */
.flex { display: flex; }
.items-center { align-items: center; }
.gap-4 { gap: 1rem; }
.text-lg { font-size: 1.125rem; }

.view-wrapper {
  min-height: 100vh;
  background-color: var(--color-background);
}

.view-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 0.5rem;
  margin-top: 0;
}

.page-subtitle {
  color: var(--vis-c-text-dark-2);
  margin-bottom: 2rem;
}

.card-box {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.border-brand-left {
  border-left: 4px solid var(--vis-brand-orange);
}

.page-controls { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 20px 0 8px; color: var(--vis-c-text-dark-2); font-size: .82rem; }
.page-controls button:disabled { opacity: .5; cursor: not-allowed; }

.search-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  top: 10px;
  left: 12px;
  color: rgba(30, 41, 59, 0.4);
}

.pl-10 {
  padding-left: 2.5rem !important;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--vis-c-text-dark-2);
  background-color: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: 8px;
}

/* Process Cards */
.processes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 1.25rem;
}

.process-card {
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    border-color 0.2s;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
}

.process-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  border-color: var(--vis-brand-primary);
}

.process-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.carga-id {
  font-size: 0.88rem;
  color: var(--color-heading);
  font-family: monospace;
}

.version-count-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  background: var(--color-surface-soft);
  color: var(--vis-brand-orange);
  border: 1px solid var(--color-border);
}

.process-dataset {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0 0.35rem 0;
}

.process-layer {
  font-size: 0.85rem;
  color: var(--vis-c-text-dark-2);
  margin: 0 0 1rem 0;
}

.process-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.location-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--vis-c-success);
}

.status-concluida {
  background: var(--vis-c-success);
}

.status-em-andamento {
  background: var(--vis-c-warning);
}

.status-aguardando-validacao {
  background: var(--vis-c-info);
}

.status-falhou {
  background: var(--vis-c-danger);
}

.status-text {
  font-size: 0.82rem;
  color: var(--color-text);
}

.process-date {
  font-size: 0.8rem;
  color: var(--vis-c-text-dark-2);
}

.action-hint {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--vis-brand-primary);
  text-align: right;
}
</style>
