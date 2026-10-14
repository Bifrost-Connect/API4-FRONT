<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { FiSearch } from 'vue-icons-plus/fi'
import {
  mockAuditCargas,
  type AuditProcessCarga,
} from '@/services/mocks/auditoria.mock'

const router = useRouter()
const searchQuery = ref('')

// Todas as cargas disponíveis, priorizando ou filtrando as concluídas para a auditoria
const cargas = ref<AuditProcessCarga[]>(mockAuditCargas)

const filteredCargas = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return cargas.value.filter((c) => {
    // Foco em cargas concluídas ou com versões finalizadas
    const matchesQuery =
      !q ||
      c.id.toLowerCase().includes(q) ||
      c.dataset.toLowerCase().includes(q) ||
      c.source.toLowerCase().includes(q) ||
      c.layerName.toLowerCase().includes(q)
    return matchesQuery
  })
})

const navigateToProcess = (cargaId: string) => {
  router.push(`/processo/${encodeURIComponent(cargaId)}`)
}

const handleSearch = () => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return
  const found = filteredCargas.value.find(
    (c) =>
      c.id.toLowerCase() === q ||
      c.id.toLowerCase().includes(q) ||
      c.dataset.toLowerCase().includes(q),
  )
  if (found) {
    navigateToProcess(found.id)
  }
}

const getStatusClass = (status: string) => {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '-')
  if (normalized.includes('conclu')) return 'status-concluida'
  if (normalized.includes('andamento')) return 'status-em-andamento'
  if (normalized.includes('aguardando') || normalized.includes('valida'))
    return 'status-aguardando-validacao'
  if (normalized.includes('falh')) return 'status-falhou'
  return ''
}
</script>

<template>
  <div class="view-wrapper">
    <div class="view-container">
      <div class="header-section">
        <h1 class="page-title">Auditoria de Cargas</h1>
        <p class="page-subtitle">
          Pesquise e consulte o histórico de rastreabilidade, versões e logs das cargas geoespaciais finalizadas.
        </p>
      </div>

      <!-- Barra de Busca -->
      <div class="card-box mb-8 border-brand-left">
        <h3 class="mb-4 mt-0 text-lg">Buscar Carga Concluída</h3>
        <div class="flex items-center gap-4">
          <div class="search-wrapper w-full">
            <FiSearch class="search-icon" size="20" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Digite o ID da carga (ex: CARG-2026-9001), dataset ou fonte..."
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
        <div v-if="filteredCargas.length === 0" class="empty-state">
          <p>Nenhuma carga concluída encontrada para o termo pesquisado.</p>
        </div>

        <div v-else class="processes-grid">
          <div
            v-for="carga in filteredCargas"
            :key="carga.id"
            class="process-card card-box"
            @click="navigateToProcess(carga.id)"
          >
            <div class="process-header">
              <strong class="carga-id">{{ carga.id }}</strong>
              <span class="version-count-badge">
                {{ carga.versions.length }} {{ carga.versions.length === 1 ? 'versão' : 'versões' }}
              </span>
            </div>

            <h4 class="process-dataset">{{ carga.dataset }}</h4>
            <p class="process-layer">{{ carga.layerName }} &bull; {{ carga.source }}</p>

            <div class="process-footer">
              <div class="status-indicator">
                <span class="location-dot" :class="getStatusClass(carga.currentStatus)"></span>
                <span class="status-text">{{ carga.currentStatus }}</span>
              </div>
              <span class="process-date">{{ carga.lastUpdate }}</span>
            </div>

            <div class="action-hint">
              <span>Auditar processo &rarr;</span>
            </div>
          </div>
        </div>
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
