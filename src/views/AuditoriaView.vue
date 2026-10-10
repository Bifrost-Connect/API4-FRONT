<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { FiSearch } from 'vue-icons-plus/fi'
import { processService } from '@/services/process'
import { dashboardService } from '@/services/dashboard'

const searchQuery = ref('')
const isSearching = ref(false)
const auditData = ref<any>(null)
const processData = ref<any>(null)
const recentProcesses = ref<any[]>([])
const isLoadingProcesses = ref(false)

const loadRecentProcesses = async () => {
  isLoadingProcesses.value = true
  try {
    const page = await dashboardService.getDashboardProcesses()
    recentProcesses.value = page.content.filter((proc: any) => {
      const statusLower = (proc.status || '').toLowerCase()
      return statusLower.includes('concluíd') || proc.stage === 'Publicação'
    })
  } catch (error) {
    console.error('Failed to load processes', error)
  } finally {
    isLoadingProcesses.value = false
  }
}

onMounted(() => {
  loadRecentProcesses()
})

const auditProcess = (id: string) => {
  searchQuery.value = id
  handleSearch()
}

const handleSearch = async () => {
  if (!searchQuery.value) return
  isSearching.value = true
  auditData.value = null
  processData.value = null

  try {
    const data = await processService.getProcessDetails(searchQuery.value)

    const statusLower = (data.status || '').toLowerCase()
    if (!statusLower.includes('concluíd') && data.stage !== 'Publicação') {
      alert('Apenas indicadores finalizados (completos) podem ser auditados.')
      isSearching.value = false
      return
    }

    const linhagem = await processService.getTraceability(searchQuery.value)

    processData.value = data
    auditData.value = linhagem

    console.log("Dados do Processo:", processData.value)
    console.log("Dados da Linhagem:", auditData.value)

  } catch (error: any) {
    console.error('Erro ao buscar rastreabilidade:', error)
    alert('Indicador não encontrado ou erro na API.')
  } finally {
    isSearching.value = false
  }
}
</script>

<template>
  <div class="view-container">
    <div class="header-section">
      <h1 class="page-title">Auditoria de Indicador</h1>
      <p class="page-subtitle">Consulte a rastreabilidade e dados originais consumindo estritamente a API.</p>
    </div>

    <!-- Barra de Busca -->
    <div class="card-box mb-8 border-brand-left">
      <h3 class="mb-4 mt-0 text-lg">Buscar Indicador</h3>
      <div class="flex items-center gap-4">
        <div class="search-wrapper w-full">
          <FiSearch class="search-icon" size="20" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Digite o ID do processo/indicador (ex: 9002)..."
            class="input pl-10"
            @keyup.enter="handleSearch"
          />
        </div>
        <button class="btn" @click="handleSearch" :disabled="isSearching">
          {{ isSearching ? 'Buscando...' : 'Pesquisar' }}
        </button>
      </div>
    </div>

    <!-- Area de Processos Concluídos -->
    <div class="recent-list">
      <div v-if="isLoadingProcesses" class="empty-state">
        <div class="spinner mb-4" style="margin: 0 auto;"></div>
        <p>Carregando processos...</p>
      </div>

      <div v-else-if="recentProcesses.length === 0" class="empty-state">
        <p>Nenhum processo encontrado para auditar.</p>
      </div>

      <div v-else class="processes-grid">
        <div
          v-for="proc in recentProcesses"
          :key="proc.id"
          class="process-card card-box"
          @click="auditProcess(proc.id)"
        >
          <div class="process-header">
            <strong>ID: {{ proc.id }}</strong>
          </div>
          <p class="process-dataset">{{ proc.dataset || 'Processo' }}</p>
          <p class="process-date">{{ proc.dateTime }}</p>
        </div>
      </div>
    </div>

    <!-- TODO: O restante da visualização (resultados) será construído aqui futuramente -->

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
.mt-6 { margin-top: 1.5rem; }
.mt-8 { margin-top: 2rem; }
.w-full { width: 100%; }

/* Flex & Grid */
.flex { display: flex; }
.items-center { align-items: center; }
.gap-4 { gap: 1rem; }

/* Typography */
.text-lg { font-size: 1.125rem; }

/* Components */
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

.search-wrapper { position: relative; }
.search-icon {
  position: absolute;
  top: 10px;
  left: 12px;
  color: rgba(30, 41, 59, 0.4);
}
.pl-10 { padding-left: 2.5rem !important; }

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
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.process-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  padding: 1rem;
}
.process-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--vis-brand-primary);
}
.process-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.process-dataset {
  font-weight: 500;
  color: var(--color-heading);
  margin-bottom: 0.5rem;
}
.process-date {
  font-size: 0.85rem;
  color: var(--vis-c-text-dark-2);
}
</style>
