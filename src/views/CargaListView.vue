<script setup lang="ts">
/**
 * View do Catálogo de Bases Geoespaciais e Consulta de Linhagem.
 * Permite buscar bases, filtrar por categoria, órgão ou safra,
 * visualizar geometrias no mapa ou auditar linhagem completa.
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  FiSearch,
  FiMapPin,
  FiShield,
  FiAlertTriangle,
  FiDatabase,
  FiCalendar,
  FiCheckCircle,
  FiRefreshCw,
} from 'vue-icons-plus/fi'
import ProcessFilterBar, {
  type StandardFilters,
  type FilterOptionsData,
} from '@/components/ProcessFilterBar.vue'
import { dashboardService, type ProcessLog } from '@/services/dashboard'
import {
  type ProcessCategory,
  isErrorOrQuarantined,
  isProcessVigente,
  matchesCategory,
  matchesStandardFilters,
  getStatusBadgeClass,
} from '@/utils/processUtils'

const router = useRouter()

// Categoria selecionada na aba rápida (padrão: Concluídas / Vigentes)
const selectedCategory = ref<ProcessCategory>('CONCLUIDAS')

// Filtros de formulário tradicionais
const filters = ref<StandardFilters>({
  dateBeggin: '',
  dateEnd: '',
  conjunto: '',
  etapa: '',
  situacao: '',
})

// Busca textual rápida e filtros específicos de safra/órgão do Catálogo
const searchQuery = ref('')
const selectedSource = ref('')
const selectedYear = ref('')

// Dados e paginação
const processos = ref<ProcessLog[]>([])
const filterOptions = ref<FilterOptionsData>({
  conjuntos: [],
  etapas: [],
  situacoes: [],
})
const isLoading = ref(true)
const loadError = ref(false)
const toastErrorMessage = ref<string | null>(null)
const dataSource = ref<'API' | 'DEMONSTRACAO' | ''>('')
const currentPage = ref(0)
const totalPages = ref(1)

/**
 * Extrai o ano da safra com fallback para data ou ano corrente.
 */
const resolveYear = (process: ProcessLog): string => {
  if (process.year && String(process.year).trim()) {
    return String(process.year).trim()
  }
  const match = String(process.dateTime || '').match(/\b(20\d{2}|19\d{2})\b/)
  return match?.[1] || '2026'
}

/**
 * Resolve o órgão ou fonte da base.
 */
const resolveSource = (process: ProcessLog): string => {
  if (process.source && String(process.source).trim()) {
    return String(process.source).trim()
  }
  const ds = (process.dataset || '').toLowerCase()
  if (
    ds.includes('car') ||
    ds.includes('imóveis') ||
    ds.includes('imoveis') ||
    ds.includes('reserva')
  ) {
    return 'SICAR / SFB'
  }
  if (ds.includes('app') || ds.includes('hidro') || ds.includes('preserva')) {
    return 'IBAMA / ANA'
  }
  return 'INCRA / GeoRural'
}

/**
 * Lista consolidada de opções de conjuntos disponíveis.
 */
const availableConjuntos = computed(() => {
  const map = new Map<string, { id: string; label: string }>()
  for (const opt of filterOptions.value.conjuntos || []) {
    map.set(opt.label, { id: String(opt.id), label: opt.label })
  }
  for (const p of processos.value) {
    if (p.dataset && !map.has(p.dataset)) {
      map.set(p.dataset, { id: p.dataset, label: p.dataset })
    }
  }
  return Array.from(map.values())
})

/**
 * Lista consolidada de opções de órgãos disponíveis.
 */
const availableSources = computed(() => {
  const set = new Set<string>()
  for (const p of processos.value) {
    set.add(resolveSource(p))
  }
  return Array.from(set).sort()
})

/**
 * Lista consolidada de opções de anos de safra.
 */
const availableYears = computed(() => {
  const set = new Set<string>()
  for (const p of processos.value) {
    set.add(resolveYear(p))
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a))
})

/**
 * Carrega a página de processos do catálogo via API.
 */
const loadPage = async (pageNumber: number, currentFilters?: any) => {
  isLoading.value = true
  loadError.value = false
  toastErrorMessage.value = null

  try {
    const f = currentFilters || filters.value
    const isNumericConjunto = /^\d+$/.test(f.conjunto)
    const page = await dashboardService.getDashboardProcesses({
      page: pageNumber,
      size: 12,
      dateBegin: f.dateBeggin || undefined,
      dateEnd: f.dateEnd || undefined,
      conjunto: isNumericConjunto ? f.conjunto : undefined,
      etapa: f.etapa || undefined,
      situacao: f.situacao || undefined,
    })
    processos.value = page.content || []
    dataSource.value = page.source ?? 'API'
    currentPage.value = page.number ?? 0
    totalPages.value = Math.max(1, page.totalPages ?? 1)

    // Se nenhuma carga for vigente mas existirem outras, chaveia para TODAS
    if (
      processos.value.length > 0 &&
      processos.value.filter(isProcessVigente).length === 0 &&
      selectedCategory.value === 'CONCLUIDAS'
    ) {
      selectedCategory.value = 'TODAS'
    }
  } catch (error: any) {
    console.error('Falha ao carregar catálogo de bases:', error)
    loadError.value = true
    const isTimeout =
      error?.code === 'ECONNABORTED' ||
      String(error?.message || '')
        .toLowerCase()
        .includes('timeout')
    toastErrorMessage.value = isTimeout
      ? 'Tempo limite excedido (timeout) ao carregar o catálogo de bases. Tente novamente.'
      : 'Erro ao carregar o catálogo de bases. Verifique a conexão com o servidor.'
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  try {
    const opts = await dashboardService.getFilterOptions()
    if (opts) {
      filterOptions.value.conjuntos = opts.conjuntos || []
      filterOptions.value.etapas = opts.etapas || []
      filterOptions.value.situacoes = opts.situacoes || []
    }
  } catch {
    // Segue com opções derivadas
  }
  await loadPage(0)
})

const applyFilters = async () => {
  await loadPage(0, filters.value)
}

/**
 * Filtra as bases combinando abas rápidas, filtros tradicionais e busca textual/órgão/safra.
 */
const filteredProcessos = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()

  return processos.value.filter((process) => {
    // 1. Abas rápidas
    if (!matchesCategory(process, selectedCategory.value)) {
      return false
    }

    // 2. Filtros de formulário padrão
    if (!matchesStandardFilters(process, filters.value, filterOptions.value)) {
      return false
    }

    // 3. Filtros específicos do Catálogo (Órgão e Ano da Safra)
    const itemSource = resolveSource(process)
    const itemYear = resolveYear(process)

    if (selectedSource.value && itemSource.toLowerCase() !== selectedSource.value.toLowerCase()) {
      return false
    }

    if (selectedYear.value && itemYear !== selectedYear.value) {
      return false
    }

    // 4. Busca textual rápida
    if (q) {
      const searchable = [
        process.id,
        process.dataset,
        itemSource,
        itemYear,
        process.stage,
        process.status,
        isProcessVigente(process) ? 'vigente' : '',
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())

      if (!searchable.some((val) => val.includes(q))) {
        return false
      }
    }

    return true
  })
})

const handleConjuntoChange = async () => {
  await loadPage(0, filters.value)
}

const clearFilters = async () => {
  const hadServerFilter =
    /^\d+$/.test(filters.value.conjunto) ||
    filters.value.etapa ||
    filters.value.situacao ||
    filters.value.dateBeggin ||
    filters.value.dateEnd

  searchQuery.value = ''
  selectedCategory.value = 'CONCLUIDAS'
  selectedSource.value = ''
  selectedYear.value = ''
  filters.value = {
    dateBeggin: '',
    dateEnd: '',
    conjunto: '',
    etapa: '',
    situacao: '',
  }
  if (hadServerFilter) {
    await loadPage(0)
  }
}

const dismissToast = () => {
  toastErrorMessage.value = null
}

const navigateToProcess = (processId: string) => {
  router.push({ name: 'process-log', params: { id: processId } })
}

const viewOnMap = (process: ProcessLog) => {
  router.push({
    name: 'mapa',
    query: {
      base: process.dataset,
      id: process.id,
      source: resolveSource(process),
      year: resolveYear(process),
    },
  })
}
</script>

<template>
  <main class="catalog-view">
    <!-- Alerta de Erro / Timeout -->
    <Transition name="fade">
      <div
        v-if="toastErrorMessage"
        class="toast-error"
        role="alert"
        data-testid="catalog-error-toast"
      >
        <div class="toast-error-content">
          <FiAlertTriangle size="18" />
          <span>{{ toastErrorMessage }}</span>
        </div>
        <div class="toast-error-actions">
          <button type="button" class="btn-toast-retry" @click="loadPage(currentPage)">
            <FiRefreshCw size="14" /> Tentar novamente
          </button>
          <button
            type="button"
            class="btn-toast-close"
            aria-label="Fechar alerta"
            @click="dismissToast"
          >
            &times;
          </button>
        </div>
      </div>
    </Transition>

    <!-- Cabeçalho da Página -->
    <header class="page-heading">
      <div>
        <p class="eyebrow">Catálogo Territorial & Auditoria</p>
        <h1 class="page-title">Catálogo de Bases Geoespaciais</h1>
        <p class="page-subtitle">
          Consulte os conjuntos disponíveis (Imóveis Rurais, Reserva Legal, APP), filtre por etapa,
          situação, órgão ou safra, visualize no mapa ou audite a linhagem completa.
        </p>
      </div>
      <span v-if="dataSource === 'DEMONSTRACAO'" class="demo-label">Base demonstrativa</span>
    </header>

    <!-- Barra de Filtros e Categorias Compartilhada -->
    <ProcessFilterBar
      class="mt-4"
      v-model="filters"
      v-model:selectedCategory="selectedCategory"
      :items="processos"
      :filterOptions="filterOptions"
      :showConcluidasTab="true"
      @filter="applyFilters"
      @conjunto-change="handleConjuntoChange"
    >
      <template #extra-filters>
        <!-- Linha de Busca Textual -->
        <div class="search-row">
          <div class="search-input-wrapper">
            <FiSearch class="search-icon" size="18" />
            <input
              v-model="searchQuery"
              type="search"
              data-testid="search-input"
              placeholder="Pesquisar por nome da base, ID, órgão emissor ou ano..."
              class="search-input"
            />
          </div>
          <button
            v-if="
              searchQuery ||
              filters.conjunto ||
              filters.etapa ||
              filters.situacao ||
              filters.dateBeggin ||
              filters.dateEnd ||
              selectedSource ||
              selectedYear ||
              selectedCategory !== 'CONCLUIDAS'
            "
            type="button"
            class="btn btn_outline btn-clear"
            data-testid="clear-filters"
            @click="clearFilters"
          >
            Limpar filtros
          </button>
        </div>

        <!-- Seletores de Órgão de Origem e Ano da Safra -->
        <div class="selectors-row">
          <div class="filter-field">
            <label for="filter-source">Órgão de Origem:</label>
            <select
              id="filter-source"
              v-model="selectedSource"
              data-testid="filter-source"
              class="filter-select"
            >
              <option value="">Todos os órgãos</option>
              <option v-for="src in availableSources" :key="src" :value="src">
                {{ src }}
              </option>
            </select>
          </div>

          <div class="filter-field">
            <label for="filter-year">Ano da Safra:</label>
            <select
              id="filter-year"
              v-model="selectedYear"
              data-testid="filter-year"
              class="filter-select"
            >
              <option value="">Todos os anos</option>
              <option v-for="yr in availableYears" :key="yr" :value="yr">
                {{ yr }}
              </option>
            </select>
          </div>
        </div>
      </template>
    </ProcessFilterBar>

    <!-- Estado de Carregamento -->
    <div v-if="isLoading" class="state-card mt-4" role="status" data-testid="loading-state">
      <div class="spinner"></div>
      <p>Carregando catálogo de bases...</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredProcessos.length === 0"
      class="state-card empty-state mt-4"
      data-testid="empty-state"
    >
      <FiDatabase size="40" class="empty-icon" />
      <h3>Nenhuma base de dados encontrada com estes filtros</h3>
      <p>
        Tente ajustar os termos pesquisados, selecionar a aba "Todas as Cargas" ou limpar os filtros
        de data, conjunto e órgão.
      </p>
      <button
        v-if="
          searchQuery ||
          filters.conjunto ||
          filters.etapa ||
          filters.situacao ||
          filters.dateBeggin ||
          filters.dateEnd ||
          selectedSource ||
          selectedYear ||
          selectedCategory !== 'CONCLUIDAS'
        "
        type="button"
        class="btn btn_outline mt-3"
        @click="clearFilters"
      >
        Restaurar todos os conjuntos
      </button>
    </div>

    <!-- Grid de Cards de Bases -->
    <section v-else class="catalog-section mt-4" aria-label="Lista de bases disponíveis">
      <div class="catalog-grid" data-testid="catalog-grid">
        <article
          v-for="process in filteredProcessos"
          :key="process.id"
          class="catalog-card"
          data-testid="catalog-card"
        >
          <!-- Topo do Card: ID e Tag Vigente -->
          <div class="card-top">
            <span class="carga-id">Base #{{ process.id }}</span>
            <div class="card-badges">
              <span v-if="isProcessVigente(process)" class="badge-vigente" data-testid="badge-vigente">
                <FiCheckCircle size="12" /> Vigente
              </span>
              <span :class="getStatusBadgeClass(process.status, 'status-badge')">
                {{ process.status }}
              </span>
            </div>
          </div>

          <!-- Nome do Conjunto -->
          <h2 class="card-dataset">{{ process.dataset }}</h2>
          <p class="card-stage">
            Etapa atual: <strong>{{ process.stage }}</strong>
          </p>

          <!-- Metadados da Base -->
          <dl class="card-metadata">
            <div class="meta-item">
              <dt>Fonte / Órgão</dt>
              <dd data-testid="meta-source">{{ resolveSource(process) }}</dd>
            </div>
            <div class="meta-item">
              <dt>Ano da Safra</dt>
              <dd data-testid="meta-year">{{ resolveYear(process) }}</dd>
            </div>
            <div class="meta-item">
              <dt>Data de Publicação</dt>
              <dd data-testid="meta-date">
                <FiCalendar size="12" style="margin-right: 4px" />
                {{ process.dateTime || '—' }}
              </dd>
            </div>
            <div class="meta-item">
              <dt>Sistema (EPSG)</dt>
              <dd>{{ process.epsg || 'EPSG:4674' }}</dd>
            </div>
          </dl>

          <!-- Ações do Card -->
          <div class="card-actions">
            <button
              type="button"
              class="btn-card-map"
              data-testid="btn-view-map"
              @click="viewOnMap(process)"
            >
              <FiMapPin size="14" />
              Visualizar no Mapa
            </button>

            <button
              type="button"
              class="btn-card-audit"
              data-testid="btn-audit-process"
              @click="navigateToProcess(process.id)"
            >
              <FiShield size="14" />
              Auditar Linhagem
            </button>
          </div>
        </article>
      </div>

      <!-- Paginação -->
      <nav
        v-if="!isLoading && !loadError && totalPages > 1"
        class="page-controls"
        aria-label="Paginação do catálogo"
      >
        <button
          class="btn btn_outline"
          type="button"
          :disabled="currentPage === 0"
          @click="loadPage(currentPage - 1)"
        >
          Anterior
        </button>
        <span>Página {{ currentPage + 1 }} de {{ totalPages }}</span>
        <button
          class="btn btn_outline"
          type="button"
          :disabled="currentPage + 1 >= totalPages"
          @click="loadPage(currentPage + 1)"
        >
          Próxima
        </button>
      </nav>
    </section>
  </main>
</template>

<style scoped>
.catalog-view {
  max-width: 1240px;
  margin: 0 auto;
  color: var(--color-text);
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--vis-brand-orange);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.page-title {
  margin: 0;
  color: var(--color-heading);
  font-size: 1.8rem;
}

.page-subtitle {
  margin: 8px 0 0;
  color: var(--color-text-muted);
}

.demo-label {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
  border: 1px solid var(--badge-warning-border);
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

/* Linhas de Filtros Extras */
.search-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.75rem 0.5rem;
  flex-wrap: wrap;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  min-width: 260px;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--color-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.6rem 0.75rem 0.6rem 2.4rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 0.88rem;
}

.search-input:focus {
  outline: none;
  border-color: var(--vis-brand-orange);
}

.btn-clear {
  white-space: nowrap;
  font-size: 0.82rem;
  padding: 0.55rem 1rem;
}

.selectors-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  padding: 0 0.75rem 0.5rem;
}

@media (min-width: 768px) {
  .selectors-row {
    grid-template-columns: 1fr 1fr;
  }
}

.filter-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
}

.filter-field label {
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
  color: var(--color-heading);
}

.filter-select {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 0.82rem;
  outline: none;
  cursor: pointer;
}

/* Cards do Catálogo */
.catalog-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .catalog-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1100px) {
  .catalog-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.catalog-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.catalog-card:hover {
  border-color: var(--vis-brand-orange);
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 0.75rem;
}

.carga-id {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.card-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge-vigente {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
  border: 1px solid var(--badge-success-border);
  font-size: 0.72rem;
  font-weight: 700;
}

.card-dataset {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
  color: var(--color-heading);
}

.card-stage {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.card-metadata {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin: 0 0 1.25rem;
  padding: 0.75rem;
  background: var(--color-background);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.meta-item dt {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--color-text-muted);
  font-weight: 700;
  margin-bottom: 2px;
}

.meta-item dd {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-heading);
  display: flex;
  align-items: center;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}

.btn-card-map,
.btn-card-audit {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0.55rem 0.5rem;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-card-map {
  background: transparent;
  border: 1px solid var(--vis-brand-orange, #f26522);
  color: var(--vis-brand-orange, #f26522);
}

.btn-card-map:hover {
  background: var(--vis-brand-orange, #f26522);
  color: #fff;
}

.btn-card-audit {
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
  color: var(--color-heading);
}

.btn-card-audit:hover {
  background: var(--color-border);
}

/* Estados */
.state-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 3rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  color: var(--color-text-muted);
  margin-bottom: 0.75rem;
}

.page-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  font-size: 0.88rem;
}

.toast-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  background: var(--badge-danger-bg);
  border: 1px solid var(--badge-danger-border);
  border-left: 4px solid var(--badge-danger-text);
  color: var(--badge-danger-text);
  margin-bottom: 1.5rem;
}

.toast-error-content {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.toast-error-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-toast-retry {
  background: transparent;
  border: 1px solid var(--badge-danger-border);
  color: var(--badge-danger-text);
  border-radius: 4px;
  padding: 0.3rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn-toast-close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1.2rem;
  cursor: pointer;
}

/* Badges de Status do Catálogo */
.status-badge {
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-concluida {
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
  border: 1px solid var(--badge-success-border);
}

.status-andamento {
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
  border: 1px solid var(--badge-warning-border);
}

.status-validacao {
  background: var(--badge-info-bg);
  color: var(--badge-info-text);
  border: 1px solid var(--badge-info-border);
}

.status-falhou {
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
  border: 1px solid var(--badge-danger-border);
}
</style>
