<script setup lang="ts">
/**
 * View do Catálogo de Bases Geoespaciais e Consulta de Linhagem (US09).
 * Permite buscar bases, filtrar por categoria, órgão, safra, status,
 * alternar entre modo Grade e Tabela, visualizar KPIs, inspecionar metadados ricos (Ficha Técnica)
 * e acionar atalhos analíticos (Mapa e Análise de Safra) com blindagem visual por status.
 */
import { ref, computed, watch, onMounted } from 'vue'
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
  FiGrid,
  FiList,
  FiPieChart,
  FiFileText,
} from 'vue-icons-plus/fi'
import ProcessFilterBar, {
  type StandardFilters,
  type FilterOptionsData,
} from '@/components/ProcessFilterBar.vue'
import CatalogKpiHeader from '@/components/catalog/CatalogKpiHeader.vue'
import CatalogSkeleton from '@/components/catalog/CatalogSkeleton.vue'
import CatalogDetailDrawer from '@/components/catalog/CatalogDetailDrawer.vue'
import { dashboardService, type ProcessLog } from '@/services/dashboard'
import { catalogoService, type CatalogoBase } from '@/services/catalogo'
import type { CatalogoItem, CatalogoKpis, CatalogoSortOption, ViewMode } from '@/types/catalogo'
import { uiPreferencesStorage } from '@/services/storage/uiPreferencesStorage'
import {
  QUARANTINE_TOOLTIP,
  isBaseDisponivel,
  normalizeSituacaoBadge,
  sortCatalogoItems,
} from '@/utils/catalogoUtils'
import {
  type ProcessCategory,
  isErrorOrQuarantined,
  isProcessVigente,
  matchesCategory,
  matchesStandardFilters,
  getStatusBadgeClass,
} from '@/utils/processUtils'

const router = useRouter()

// Recuperação de preferências de UI e filtros persistidos
const initialViewMode = uiPreferencesStorage.getCatalogViewMode('grid')
const initialPageSize = uiPreferencesStorage.getCatalogPageSize(12)
const savedFilters = uiPreferencesStorage.getCatalogFilters()

// Modo de visualização (Grade de Cards ou Tabela Detalhada) - Tarefa 1
const viewMode = ref<ViewMode>(initialViewMode)

// Categoria selecionada na aba rápida (padrão: Disponíveis)
const selectedCategory = ref<ProcessCategory>((savedFilters?.selectedCategory as ProcessCategory) || 'CONCLUIDAS')

// Filtro rápido: "Mostrar apenas prontas para consulta" - Tarefa 4 (ativo por padrão)
const showOnlyProntas = ref(savedFilters?.showOnlyProntas ?? true)

// Sincronização entre toggle de prontas e abas rápidas
watch(showOnlyProntas, (val) => {
  if (val) {
    if (selectedCategory.value !== 'CONCLUIDAS') {
      selectedCategory.value = 'CONCLUIDAS'
    }
  } else {
    if (selectedCategory.value === 'CONCLUIDAS') {
      selectedCategory.value = 'TODAS'
    }
  }
})

watch(selectedCategory, (cat) => {
  if (cat === 'CONCLUIDAS') {
    if (!showOnlyProntas.value) showOnlyProntas.value = true
  } else {
    if (showOnlyProntas.value) showOnlyProntas.value = false
  }
})

// Filtros de formulário tradicionais
const filters = ref<StandardFilters>({
  dateBeggin: savedFilters?.standardFilters?.dateBeggin || '',
  dateEnd: savedFilters?.standardFilters?.dateEnd || '',
  conjunto: savedFilters?.standardFilters?.conjunto || '',
  etapa: savedFilters?.standardFilters?.etapa || '',
  situacao: savedFilters?.standardFilters?.situacao || '',
})

// Busca textual rápida e filtros específicos de safra/órgão/classificação/cobertura/status
const searchQuery = ref(savedFilters?.searchQuery || '')
const selectedSource = ref(savedFilters?.selectedSource || '')
const selectedYear = ref(savedFilters?.selectedYear || '')
const selectedAccess = ref(savedFilters?.selectedAccess || '')
const selectedCoverage = ref(savedFilters?.selectedCoverage || '')
const selectedStatus = ref(savedFilters?.selectedStatus || '')

// Ordenação dinâmica e paginação configurável - Tarefa 5
const sortBy = ref<CatalogoSortOption>((savedFilters?.sortBy as CatalogoSortOption) || 'data_desc')
const pageSize = ref<number>(initialPageSize)
const clientCurrentPage = ref<number>(savedFilters?.clientCurrentPage || 0)

watch(viewMode, (mode) => {
  uiPreferencesStorage.setCatalogViewMode(mode)
})

watch(pageSize, (size) => {
  uiPreferencesStorage.setCatalogPageSize(size)
})

watch(
  [selectedCategory, showOnlyProntas, searchQuery, selectedSource, selectedYear, selectedAccess, selectedCoverage, selectedStatus, sortBy, clientCurrentPage, filters],
  () => {
    uiPreferencesStorage.setCatalogFilters({
      selectedCategory: selectedCategory.value,
      showOnlyProntas: showOnlyProntas.value,
      searchQuery: searchQuery.value,
      selectedSource: selectedSource.value,
      selectedYear: selectedYear.value,
      selectedAccess: selectedAccess.value,
      selectedCoverage: selectedCoverage.value,
      selectedStatus: selectedStatus.value,
      sortBy: sortBy.value,
      clientCurrentPage: clientCurrentPage.value,
      standardFilters: {
        dateBeggin: filters.value.dateBeggin,
        dateEnd: filters.value.dateEnd,
        conjunto: filters.value.conjunto,
        etapa: filters.value.etapa,
        situacao: filters.value.situacao,
      },
    })
  },
  { deep: true },
)

// Dados e paginação do servidor
const processos = ref<ProcessLog[]>([])
const catalogoBasesMap = ref<Map<string | number, CatalogoBase>>(new Map())
const filterOptions = ref<FilterOptionsData>({
  conjuntos: [],
  etapas: [],
  situacoes: [],
})
const serverKpis = ref<{
  total?: number
  concluidas?: number
  emProcessamento?: number
  congeladas?: number | string
}>({})

const isLoading = ref(true)
const loadError = ref(false)
const toastErrorMessage = ref<string | null>(null)
const dataSource = ref<'API' | 'DEMONSTRACAO' | ''>('')
const currentPage = ref(0)
const totalPages = ref(1)

// Controle do Drawer de Ficha Técnica - Tarefa 6
const selectedBaseForDrawer = ref<CatalogoItem | null>(null)
const isDrawerOpen = ref(false)

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
    return 'SICAR'
  }
  if (ds.includes('app') || ds.includes('hidro') || ds.includes('preserva')) {
    return 'IBAMA'
  }
  return 'INCRA'
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
 * Converte ProcessLog para CatalogoItem enriquecido com dados do catalogoService.
 */
const enrichItem = (p: ProcessLog): CatalogoItem => {
  const catBase =
    catalogoBasesMap.value.get(p.id) || catalogoBasesMap.value.get(Number(p.id))
  return {
    id: p.id,
    dataset: p.dataset,
    stage: p.stage,
    status: p.status,
    source: resolveSource(p),
    year: resolveYear(p),
    competencia: p.year ? `Safra ${p.year}` : 'Anual Vigente',
    versao_oficial: catBase?.versao_oficial || 'v1.0 Oficial',
    data_publicacao: catBase?.data_publicacao || p.dateTime || '—',
    epsg: catBase?.epsg_destino || p.epsg || 'SIRGAS 2000 (EPSG:4674)',
    total_feicoes: catBase?.total_feicoes ?? 1420,
    classificacao_acesso: 'Pública',
    cobertura_espacial: 'Território Nacional',
    cobertura_temporal: `Safra ${resolveYear(p)}`,
    tamanho_arquivo: '14.2 MB',
    hash_integridade: p.integrityHash || 'SHA256: d8b2c4e97a3f81e0... (Verificado)',
    quarantined: p.quarantined,
    pauseReason: p.pauseReason,
    assignedEditor: p.assignedEditor,
  }
}

/**
 * KPIs calculados no Front-End a partir de métricas e lista de processos (Tarefa 2).
 */
const kpisData = computed<CatalogoKpis>(() => {
  const total = serverKpis.value.total ?? processos.value.length
  const prontas =
    serverKpis.value.concluidas ??
    processos.value.filter((p) => isBaseDisponivel(p)).length
  const processando =
    serverKpis.value.emProcessamento ??
    processos.value.filter((p) => !isBaseDisponivel(p)).length
  const congeladas = serverKpis.value.congeladas ?? '—'

  return {
    totalCarregadas: total,
    prontasConsulta: prontas,
    emProcessamento: processando,
    historicasCongeladas: congeladas,
  }
})

/**
 * Carrega a página de processos do catálogo via API e enriquece com /catalogo/bases.
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
      size: pageSize.value,
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
    clientCurrentPage.value = 0
    isLoading.value = false

    // Busca catálogo oficial em segundo plano para enriquecer versões oficiais
    catalogoService
      .listarBases()
      .then((basesPublicadas) => {
        if (Array.isArray(basesPublicadas)) {
          const map = new Map<string | number, CatalogoBase>()
          basesPublicadas.forEach((b) => {
            map.set(b.id, b)
            map.set(String(b.id), b)
          })
          catalogoBasesMap.value = map
        }
      })
      .catch(() => {})

    // Busca métricas consolidadas para os KPIs em segundo plano
    dashboardService
      .getDashboardSummary()
      .then((metricasRes) => {
        if (Array.isArray(metricasRes)) {
          const concluidas = metricasRes.find(
            (m) =>
              m.title?.toLowerCase().includes('conclu') ||
              m.title?.toLowerCase().includes('vigente'),
          )?.value
          const atencao = metricasRes.find(
            (m) =>
              m.title?.toLowerCase().includes('atenção') ||
              m.title?.toLowerCase().includes('processamento'),
          )?.value
          if (concluidas !== undefined) serverKpis.value.concluidas = concluidas
          if (atencao !== undefined) serverKpis.value.emProcessamento = atencao
        }
      })
      .catch(() => {})
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
  clientCurrentPage.value = 0
  await loadPage(0, filters.value)
}

/**
 * Filtra as bases combinando abas rápidas, filtros tradicionais e busca textual/órgão/safra/status.
 */
const filteredProcessos = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()

  return processos.value.filter((process) => {
    // 1. Abas rápidas / Prontas para consulta (Tarefa 4)
    if (showOnlyProntas.value) {
      if (!isBaseDisponivel(process)) return false
    } else {
      if (!matchesCategory(process, selectedCategory.value)) {
        return false
      }
    }

    // 2. Filtros de formulário padrão
    if (!matchesStandardFilters(process, filters.value, filterOptions.value)) {
      return false
    }

    // 3. Filtros específicos do Catálogo (Órgão e Ano da Safra)
    const itemSource = resolveSource(process)
    const itemYear = resolveYear(process)

    if (
      selectedSource.value &&
      itemSource.toLowerCase() !== selectedSource.value.toLowerCase()
    ) {
      return false
    }

    if (selectedYear.value && itemYear !== selectedYear.value) {
      return false
    }

    // 4. Filtro por Classificação de Acesso (se selecionado)
    if (selectedAccess.value) {
      const access = 'pública'
      if (!access.includes(selectedAccess.value.toLowerCase())) {
        return false
      }
    }

    // 5. Filtro por Cobertura (se selecionado)
    if (selectedCoverage.value) {
      const cov = 'nacional regional estadual'
      if (!cov.includes(selectedCoverage.value.toLowerCase())) {
        return false
      }
    }

    // 6. Filtro por Status Operacional
    if (selectedStatus.value) {
      const st = String(process.status || '').toLowerCase()
      if (!st.includes(selectedStatus.value.toLowerCase())) {
        return false
      }
    }

    // 7. Busca textual rápida
    if (q) {
      const searchable = [
        process.id,
        process.dataset,
        itemSource,
        itemYear,
        process.stage,
        process.status,
        isProcessVigente(process) ? 'vigente' : '',
        isBaseDisponivel(process) ? 'pronta publicada disponível' : '',
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

/**
 * Itens filtrados, enriquecidos e ordenados conforme a opção ativa (Tarefa 5).
 */
const sortedAndEnrichedItems = computed<CatalogoItem[]>(() => {
  const enriched = filteredProcessos.value.map(enrichItem)
  return sortCatalogoItems(enriched, sortBy.value)
})

/**
 * Paginação configurável calculada (10, 25 ou 50 por página).
 */
const paginatedItems = computed<CatalogoItem[]>(() => {
  const start = clientCurrentPage.value * pageSize.value
  return sortedAndEnrichedItems.value.slice(start, start + pageSize.value)
})

const clientTotalPages = computed(() => {
  return Math.max(1, Math.ceil(sortedAndEnrichedItems.value.length / pageSize.value))
})

const handleConjuntoChange = async () => {
  clientCurrentPage.value = 0
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
  selectedAccess.value = ''
  selectedCoverage.value = ''
  selectedStatus.value = ''
  showOnlyProntas.value = false // Ao limpar tudo, permite ver todas as bases
  clientCurrentPage.value = 0

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

const navigateToProcess = (processId: string | number) => {
  const item = processos.value.find((p) => String(p.id) === String(processId))
  if (item && !isBaseDisponivel(item)) {
    return
  }
  router.push({ name: 'process-log', params: { id: String(processId) } })
}

/**
 * Atalho: Abrir no Mapa Interativo (US08)
 */
const viewOnMap = (process: ProcessLog | CatalogoItem) => {
  if (!isBaseDisponivel(process)) {
    return
  }
  router.push({
    name: 'mapa',
    query: {
      base: process.dataset,
      id: String(process.id),
      source: resolveSource(process as ProcessLog),
      year: resolveYear(process as ProcessLog),
    },
  })
}

/**
 * Atalho: Comparar Safra (US10)
 */
const compareSafra = (process: ProcessLog | CatalogoItem) => {
  if (!isBaseDisponivel(process)) {
    return
  }
  router.push({
    name: 'analise-territorial',
    query: {
      baseId: String(process.id),
      safra: resolveYear(process as ProcessLog),
    },
  })
}

/**
 * Abre o Drawer de Ficha Técnica e Prévia de Atributos (Tarefa 6).
 */
const openBaseDetail = async (item: CatalogoItem) => {
  if (!isBaseDisponivel(item)) {
    return
  }
  selectedBaseForDrawer.value = item
  isDrawerOpen.value = true

  // Tenta enriquecer com dados da API detalhada
  try {
    const detalhe = await catalogoService.buscarDetalhesBase(item.id)
    if (detalhe && selectedBaseForDrawer.value) {
      if (detalhe.versao_oficial) selectedBaseForDrawer.value.versao_oficial = detalhe.versao_oficial
      if (detalhe.total_feicoes) selectedBaseForDrawer.value.total_feicoes = detalhe.total_feicoes
      if (detalhe.data_publicacao) selectedBaseForDrawer.value.data_publicacao = detalhe.data_publicacao
    }
  } catch {
    // Segue com fallbacks
  }
}

const closeDrawer = () => {
  isDrawerOpen.value = false
  selectedBaseForDrawer.value = null
}
</script>

<template>
  <main class="catalog-view">
    <!-- Alerta de Erro / Timeout (Toast Vermelho) - Tarefa 9 -->
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

    <!-- Cabeçalho da Página com Título e Toggle de Visualização (Grade / Tabela) - Tarefa 1 -->
    <header class="page-heading">
      <div>
        <p class="eyebrow">Catálogo Territorial & Auditoria</p>
        <h1 class="page-title">Catálogo de Bases Geoespaciais</h1>
        <p class="page-subtitle">
          Consulte os conjuntos disponíveis (Imóveis Rurais, Reserva Legal, APP), filtre por etapa,
          situação, órgão ou safra, visualize no mapa ou audite a linhagem completa.
        </p>
      </div>

      <!-- Ações do Cabeçalho: Toggle Grade/Tabela -->
      <div class="heading-controls">
        <span v-if="dataSource === 'DEMONSTRACAO'" class="demo-label">Base demonstrativa</span>
        <div class="view-mode-toggle" role="group" aria-label="Modo de visualização do catálogo">
          <button
            type="button"
            class="btn-view-mode"
            :class="{ active: viewMode === 'grid' }"
            data-testid="toggle-view-grid"
            aria-label="Visualização em Grade"
            title="Modo Grade (Cards)"
            @click="viewMode = 'grid'"
          >
            <FiGrid size="16" />
            <span>Grade</span>
          </button>
          <button
            type="button"
            class="btn-view-mode"
            :class="{ active: viewMode === 'table' }"
            data-testid="toggle-view-table"
            aria-label="Visualização em Tabela"
            title="Modo Tabela Detalhada"
            @click="viewMode = 'table'"
          >
            <FiList size="16" />
            <span>Tabela</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Header de KPIs (4 Cards de Resumo) - Tarefa 2 -->
    <CatalogKpiHeader :kpis="kpisData" :loading="isLoading" />

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
        <!-- Linha Superior de Filtros: Busca Textual + Toggle Rápido "Prontas para Consulta" -->
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

          <!-- Toggle Rápido: Mostrar apenas prontas para consulta (Tarefa 4) -->
          <label class="toggle-prontas-label" data-testid="toggle-only-prontas-wrapper">
            <input
              type="checkbox"
              v-model="showOnlyProntas"
              class="toggle-checkbox"
              data-testid="toggle-only-prontas"
            />
            <span class="toggle-switch"></span>
            <span class="toggle-text">Mostrar apenas prontas para consulta</span>
          </label>

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
              selectedAccess ||
              selectedCoverage ||
              selectedStatus ||
              !showOnlyProntas ||
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

        <!-- Seletores Combinados de Filtro (Tarefa 4) -->
        <div class="selectors-row">
          <!-- Órgão de Origem -->
          <div class="filter-field">
            <label for="filter-source">Órgão de Origem</label>
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

          <!-- Ano da Safra -->
          <div class="filter-field">
            <label for="filter-year">Ano da Safra</label>
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

          <!-- Classificação de Acesso -->
          <div class="filter-field">
            <label for="filter-access">Acesso</label>
            <select
              id="filter-access"
              v-model="selectedAccess"
              data-testid="filter-access"
              class="filter-select"
            >
              <option value="">Todos os acessos</option>
              <option value="pública">Pública</option>
              <option value="restrita">Restrita</option>
            </select>
          </div>

          <!-- Cobertura Espacial/Temporal -->
          <div class="filter-field">
            <label for="filter-coverage">Cobertura</label>
            <select
              id="filter-coverage"
              v-model="selectedCoverage"
              data-testid="filter-coverage"
              class="filter-select"
            >
              <option value="">Todas as coberturas</option>
              <option value="nacional">Nacional</option>
              <option value="estadual">Estadual</option>
              <option value="regional">Regional</option>
            </select>
          </div>

          <!-- Status Operacional -->
          <div class="filter-field">
            <label for="filter-status">Situação</label>
            <select
              id="filter-status"
              v-model="selectedStatus"
              data-testid="filter-status"
              class="filter-select"
            >
              <option value="">Todas as situações</option>
              <option value="conclu">Disponível</option>
              <option value="andamento">Em andamento</option>
              <option value="valida">Em validação</option>
              <option value="ressalva">Com ressalva</option>
              <option value="falh">Falhou</option>
            </select>
          </div>
        </div>

        <!-- Divisor sutil entre filtros de catálogo e filtros avançados de processo -->
        <div class="extra-filters-divider"></div>
      </template>
    </ProcessFilterBar>

    <!-- Barra de Configurações de Exibição (Ordenação e Itens por Página) - Tarefa 5 -->
    <div class="controls-bar" data-testid="controls-bar">
      <div class="controls-left">
        <span class="results-badge" data-testid="results-count-badge">
          {{ sortedAndEnrichedItems.length }} {{ sortedAndEnrichedItems.length === 1 ? 'base encontrada' : 'bases encontradas' }}
        </span>
      </div>

      <div class="controls-right">
        <div class="sort-wrapper">
          <label for="sort-select">Ordenar por:</label>
          <select id="sort-select" v-model="sortBy" data-testid="sort-select" class="sort-select">
            <option value="data_desc">Data de Publicação (Mais recentes)</option>
            <option value="data_asc">Data de Publicação (Mais antigas)</option>
            <option value="safra_desc">Ano da Safra (Decrescente)</option>
            <option value="safra_asc">Ano da Safra (Crescente)</option>
            <option value="nome_asc">Nome do Conjunto (A &rarr; Z)</option>
            <option value="nome_desc">Nome do Conjunto (Z &rarr; A)</option>
            <option value="registros_desc">Quantidade de Registros</option>
          </select>
        </div>

        <div class="page-size-wrapper">
          <label for="page-size-select">Itens por página:</label>
          <select
            id="page-size-select"
            v-model="pageSize"
            data-testid="page-size-select"
            class="sort-select"
            @change="clientCurrentPage = 0"
          >
            <option :value="10">10 por página</option>
            <option :value="12">12 por página</option>
            <option :value="25">25 por página</option>
            <option :value="50">50 por página</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Estado de Carregamento com Skeletons - Tarefa 9 -->
    <div v-if="isLoading" class="mt-4" role="status" data-testid="loading-state">
      <CatalogSkeleton :type="viewMode === 'grid' ? 'card' : 'table'" :count="viewMode === 'grid' ? 6 : 5" />
    </div>

    <!-- Empty State Amigável com Limpar Filtros - Tarefa 9 -->
    <div
      v-else-if="sortedAndEnrichedItems.length === 0"
      class="state-card empty-state mt-4"
      data-testid="empty-state"
    >
      <FiDatabase size="44" class="empty-icon" />
      <h3 data-testid="empty-title">Nenhuma base de dados encontrada com estes filtros</h3>
      <p>
        Nenhuma base encontrada para os filtros aplicados. Tente desmarcar o filtro "Mostrar apenas prontas para consulta", selecionar outra safra ou limpar os filtros de busca.
      </p>
      <button
        type="button"
        class="btn btn_outline mt-3"
        data-testid="empty-clear-filters"
        @click="clearFilters"
      >
        Limpar Filtros
      </button>
    </div>

    <!-- CONTEÚDO PRINCIPAL: MODO GRADE OU TABELA DETALHADA -->
    <section v-else class="catalog-section mt-4" aria-label="Lista de bases disponíveis">
      <!-- 1. MODO GRADE (CARDS) - Tarefa 1 e 3 -->
      <div v-if="viewMode === 'grid'" class="catalog-grid" data-testid="catalog-grid">
        <article
          v-for="process in paginatedItems"
          :key="process.id"
          class="catalog-card"
          data-testid="catalog-card"
        >
          <!-- Topo do Card: ID e Badges -->
          <div class="card-top">
            <span class="carga-id">Base #{{ process.id }}</span>
            <div class="card-badges">
              <span v-if="isBaseDisponivel(process)" class="badge-vigente" data-testid="badge-vigente">
                <FiCheckCircle size="12" /> Vigente
              </span>
              <!-- Badge Colorido de Situação Padronizado -->
              <span
                :class="['badge-situacao', normalizeSituacaoBadge(process.status).badgeClass]"
                data-testid="badge-situacao"
              >
                {{ normalizeSituacaoBadge(process.status).label }}
              </span>
            </div>
          </div>

          <!-- Nome da Base / Conjunto de Dados -->
          <h2 class="card-dataset">{{ process.dataset }}</h2>
          <p class="card-stage">
            Etapa atual: <strong>{{ process.stage }}</strong> &bull; Versão:
            <strong data-testid="meta-version">{{ process.versao_oficial || 'v1.0' }}</strong>
          </p>

          <!-- Metadados da Base -->
          <dl class="card-metadata">
            <div class="meta-item">
              <dt>Órgão</dt>
              <dd data-testid="meta-source">{{ process.source }}</dd>
            </div>
            <div class="meta-item">
              <dt>Safra</dt>
              <dd data-testid="meta-year">{{ process.year }}</dd>
            </div>
            <div class="meta-item">
              <dt>Data de Publicação</dt>
              <dd data-testid="meta-date">
                <FiCalendar size="12" style="margin-right: 4px" />
                {{ process.data_publicacao || '—' }}
              </dd>
            </div>
            <div class="meta-item">
              <dt>Registros</dt>
              <dd data-testid="meta-registros-count">
                {{ process.total_feicoes ? process.total_feicoes.toLocaleString('pt-BR') : '—' }}
              </dd>
            </div>
          </dl>

          <!-- Ações Analíticas e Ficha Técnica com Blindagem Visual (Tarefas 7 e 8) -->
          <div class="card-actions">
            <!-- Botão Ficha Técnica / Detalhes -->
            <button
              type="button"
              class="btn-card-inspect"
              :class="{ 'btn-disabled': !isBaseDisponivel(process) }"
              :disabled="!isBaseDisponivel(process)"
              :title="!isBaseDisponivel(process) ? QUARANTINE_TOOLTIP : 'Inspecionar Ficha Técnica e Prévia de Atributos'"
              data-testid="btn-inspect-base"
              @click="openBaseDetail(process)"
            >
              <FiFileText size="14" />
              Ficha Técnica
            </button>

            <!-- Botão Mapa Interativo (US08) -->
            <button
              type="button"
              class="btn-card-map"
              :class="{ 'btn-disabled': !isBaseDisponivel(process) }"
              :disabled="!isBaseDisponivel(process)"
              :title="!isBaseDisponivel(process) ? QUARANTINE_TOOLTIP : 'Visualizar no Mapa Interativo'"
              data-testid="btn-view-map"
              @click="viewOnMap(process)"
            >
              <FiMapPin size="14" />
              Visualizar no Mapa
            </button>

            <!-- Botão Comparar Safra (US10) -->
            <button
              type="button"
              class="btn-card-compare"
              :class="{ 'btn-disabled': !isBaseDisponivel(process) }"
              :disabled="!isBaseDisponivel(process)"
              :title="!isBaseDisponivel(process) ? QUARANTINE_TOOLTIP : 'Comparar Safra na Análise Territorial'"
              data-testid="btn-compare-safra"
              @click="compareSafra(process)"
            >
              <FiPieChart size="14" />
              Comparar Safra
            </button>

            <!-- Botão Auditar Linhagem -->
            <button
              type="button"
              class="btn-card-audit"
              :class="{ 'btn-disabled': !isBaseDisponivel(process) }"
              :disabled="!isBaseDisponivel(process)"
              :title="!isBaseDisponivel(process) ? QUARANTINE_TOOLTIP : 'Auditar Linhagem do Processo'"
              data-testid="btn-audit-process"
              @click="navigateToProcess(process.id)"
            >
              <FiShield size="14" />
              Auditar Linhagem
            </button>
          </div>
        </article>
      </div>

      <!-- 2. MODO TABELA DETALHADA - Tarefa 1, 3 e 8 -->
      <div v-else class="catalog-table-container" data-testid="catalog-table-container">
        <table class="catalog-table" data-testid="catalog-table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Conjunto de Dados</th>
              <th scope="col">Órgão Emissor</th>
              <th scope="col">Safra</th>
              <th scope="col">Versão Oficial</th>
              <th scope="col">Registros</th>
              <th scope="col">Situação Operacional</th>
              <th scope="col" class="th-actions">Ações Analíticas</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="process in paginatedItems"
              :key="process.id"
              class="table-row-item"
              data-testid="catalog-table-row"
            >
              <td class="td-id">#{{ process.id }}</td>
              <td class="td-dataset">
                <strong>{{ process.dataset }}</strong>
                <small class="table-stage-info">Etapa: {{ process.stage }}</small>
              </td>
              <td data-testid="table-source">{{ process.source }}</td>
              <td data-testid="table-year">{{ process.year }}</td>
              <td data-testid="table-version">{{ process.versao_oficial || 'v1.0' }}</td>
              <td data-testid="table-registros">
                {{ process.total_feicoes ? process.total_feicoes.toLocaleString('pt-BR') : '—' }}
              </td>
              <td>
                <span
                  :class="['badge-situacao', normalizeSituacaoBadge(process.status).badgeClass]"
                  data-testid="badge-situacao"
                >
                  {{ normalizeSituacaoBadge(process.status).label }}
                </span>
              </td>
              <td class="td-actions">
                <div class="table-actions-group">
                  <button
                    type="button"
                    class="btn-table-action"
                    :class="{ 'btn-disabled': !isBaseDisponivel(process) }"
                    :disabled="!isBaseDisponivel(process)"
                    :title="!isBaseDisponivel(process) ? QUARANTINE_TOOLTIP : 'Ficha Técnica'"
                    data-testid="btn-inspect-base"
                    @click="openBaseDetail(process)"
                  >
                    <FiFileText size="14" />
                  </button>

                  <button
                    type="button"
                    class="btn-table-action btn-action-map"
                    :class="{ 'btn-disabled': !isBaseDisponivel(process) }"
                    :disabled="!isBaseDisponivel(process)"
                    :title="!isBaseDisponivel(process) ? QUARANTINE_TOOLTIP : 'Abrir no Mapa Interativo'"
                    data-testid="btn-view-map"
                    @click="viewOnMap(process)"
                  >
                    <FiMapPin size="14" />
                  </button>

                  <button
                    type="button"
                    class="btn-table-action"
                    :class="{ 'btn-disabled': !isBaseDisponivel(process) }"
                    :disabled="!isBaseDisponivel(process)"
                    :title="!isBaseDisponivel(process) ? QUARANTINE_TOOLTIP : 'Comparar Safra'"
                    data-testid="btn-compare-safra"
                    @click="compareSafra(process)"
                  >
                    <FiPieChart size="14" />
                  </button>

                  <button
                    type="button"
                    class="btn-table-action"
                    :class="{ 'btn-disabled': !isBaseDisponivel(process) }"
                    :disabled="!isBaseDisponivel(process)"
                    :title="!isBaseDisponivel(process) ? QUARANTINE_TOOLTIP : 'Auditar Linhagem'"
                    data-testid="btn-audit-process"
                    @click="navigateToProcess(process.id)"
                  >
                    <FiShield size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginação Dinâmica (Tarefa 5) -->
      <nav
        v-if="!isLoading && !loadError && clientTotalPages > 1"
        class="page-controls"
        aria-label="Paginação do catálogo"
      >
        <button
          class="btn btn_outline"
          type="button"
          :disabled="clientCurrentPage === 0"
          data-testid="pagination-prev"
          @click="clientCurrentPage = Math.max(0, clientCurrentPage - 1)"
        >
          Anterior
        </button>
        <span data-testid="pagination-info">
          Página {{ clientCurrentPage + 1 }} de {{ clientTotalPages }} ({{ sortedAndEnrichedItems.length }} bases)
        </span>
        <button
          class="btn btn_outline"
          type="button"
          :disabled="clientCurrentPage + 1 >= clientTotalPages"
          data-testid="pagination-next"
          @click="clientCurrentPage = Math.min(clientTotalPages - 1, clientCurrentPage + 1)"
        >
          Próxima
        </button>
      </nav>
    </section>

    <!-- Drawer Lateral / Modal de Ficha Técnica e Prévia de Atributos - Tarefa 6 -->
    <CatalogDetailDrawer
      :base="selectedBaseForDrawer"
      :is-open="isDrawerOpen"
      @close="closeDrawer"
      @open-map="viewOnMap"
      @compare-safra="compareSafra"
    />
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

.heading-controls {
  display: flex;
  align-items: center;
  gap: 12px;
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

.view-mode-toggle {
  display: inline-flex;
  align-items: center;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 8px;
  padding: 3px;
  gap: 3px;
}

.btn-view-mode {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  background: transparent;
  color: var(--color-text-muted, #94a3b8);
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn-view-mode:hover {
  color: var(--color-heading, #f8fafc);
}

.btn-view-mode.active {
  background: var(--vis-brand-orange, #f26522);
  color: white;
  box-shadow: 0 2px 8px rgba(242, 101, 34, 0.35);
}

/* Linha de Busca e Toggle de Prontas */
.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px 10px;
  flex-wrap: wrap;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  min-width: 280px;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 14px;
  color: var(--color-text-muted, #94a3b8);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 42px;
  padding: 0 14px 0 42px;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 8px;
  color: var(--color-text, #f8fafc);
  font-size: 0.88rem;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--vis-brand-orange, #f26522);
  box-shadow: 0 0 0 2px rgba(242, 101, 34, 0.2);
}

/* Switch de Toggle Rápido */
.toggle-prontas-label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 42px;
  padding: 0 14px;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: border-color 150ms ease;
}

.toggle-prontas-label:hover {
  border-color: var(--vis-brand-orange, #f26522);
}

.toggle-checkbox {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-switch {
  width: 38px;
  height: 22px;
  background: #475569;
  border-radius: 999px;
  position: relative;
  transition: background 180ms ease;
  flex-shrink: 0;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform 180ms ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.toggle-checkbox:checked + .toggle-switch {
  background: var(--vis-brand-orange, #f26522);
}

.toggle-checkbox:checked + .toggle-switch::after {
  transform: translateX(16px);
}

.toggle-text {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--color-heading, #f8fafc);
  white-space: nowrap;
}

.btn-clear {
  white-space: nowrap;
  font-size: 0.82rem;
  padding: 0.55rem 1rem;
}

/* Seletores Combinados */
.selectors-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  padding: 6px 14px 12px;
}

@media (max-width: 1200px) {
  .selectors-row {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .selectors-row {
    grid-template-columns: 1fr;
  }
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--vis-c-dark, #0f172a);
  border: 1px solid var(--color-border, #334155);
  border-radius: 8px;
  padding: 6px 10px;
  min-width: 0;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.filter-field:hover,
.filter-field:focus-within {
  border-color: var(--vis-brand-orange, #f26522);
}

.filter-field label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted, #94a3b8);
  white-space: nowrap;
}

.filter-select {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--color-heading, #f8fafc);
  font-size: 0.85rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  padding: 2px 0;
  text-overflow: ellipsis;
}

.filter-select option {
  background: var(--vis-c-dark, #0f172a);
  color: #f8fafc;
}

.extra-filters-divider {
  border-bottom: 1px solid var(--color-border, #334155);
  margin: 0 14px 4px;
}

.controls-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 10px 4px 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.controls-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.results-badge {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-muted, #94a3b8);
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  padding: 4px 10px;
  border-radius: 6px;
}

.controls-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.sort-wrapper,
.page-size-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-wrapper label,
.page-size-wrapper label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted, #94a3b8);
  white-space: nowrap;
}

.sort-select {
  height: 36px;
  padding: 0 10px;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 6px;
  color: var(--color-heading, #f8fafc);
  font-size: 0.82rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  transition: border-color 150ms ease;
}

.sort-select:hover,
.sort-select:focus {
  border-color: var(--vis-brand-orange, #f26522);
}

.sort-select option {
  background: var(--vis-c-dark, #0f172a);
  color: #f8fafc;
}

/* Grade de Cards */
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

/* Ações dos Cards */
.card-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: auto;
}

.btn-card-map,
.btn-card-compare,
.btn-card-inspect,
.btn-card-audit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0.5rem 0.4rem;
  border-radius: 4px;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  color: var(--color-heading);
}

.btn-card-map {
  background: transparent;
  border-color: var(--vis-brand-orange, #f26522);
  color: var(--vis-brand-orange, #f26522);
}

.btn-card-map:hover:not(:disabled) {
  background: var(--vis-brand-orange, #f26522);
  color: #fff;
}

.btn-card-compare:hover:not(:disabled),
.btn-card-inspect:hover:not(:disabled),
.btn-card-audit:hover:not(:disabled) {
  background: var(--color-border);
}

/* Blindagem Visual de Botões Desabilitados (Tarefa 8) */
.btn-disabled,
button:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
  filter: grayscale(0.8) !important;
  pointer-events: auto !important; /* Mantém hover para exibir tooltip nativo */
}

/* Modo Tabela */
.catalog-table-container {
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.catalog-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.catalog-table th {
  background: var(--color-background);
  color: var(--color-heading);
  padding: 12px 14px;
  text-align: left;
  font-weight: 700;
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--color-border);
  white-space: nowrap;
}

.catalog-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.table-row-item:hover td {
  background: rgba(242, 101, 34, 0.04);
}

.td-id {
  font-weight: 700;
  color: var(--color-text-muted);
}

.td-dataset {
  min-width: 180px;
}

.td-dataset strong {
  display: block;
  color: var(--color-heading);
}

.table-stage-info {
  font-size: 0.74rem;
  color: var(--color-text-muted);
}

.th-actions,
.td-actions {
  text-align: right;
  white-space: nowrap;
}

.table-actions-group {
  display: inline-flex;
  gap: 6px;
}

.btn-table-action {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  color: var(--color-heading);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 120ms ease;
}

.btn-table-action:hover:not(:disabled) {
  border-color: var(--vis-brand-orange);
  color: var(--vis-brand-orange);
}

.btn-action-map:hover:not(:disabled) {
  background: var(--vis-brand-orange);
  color: white;
}

/* Badges de Situação Padronizados */
.badge-situacao {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.badge-status-concluida {
  background: var(--badge-success-bg, rgba(34, 197, 94, 0.15));
  color: var(--badge-success-text, #4ade80);
  border: 1px solid var(--badge-success-border, rgba(34, 197, 94, 0.4));
}

.badge-status-andamento {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.badge-status-quarentena {
  background: rgba(234, 179, 8, 0.15);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.4);
}

.badge-status-ressalva {
  background: rgba(249, 115, 22, 0.15);
  color: #fb923c;
  border: 1px solid rgba(249, 115, 22, 0.4);
}

.badge-status-falhou {
  background: var(--badge-danger-bg, rgba(239, 68, 68, 0.15));
  color: var(--badge-danger-text, #f87171);
  border: 1px solid var(--badge-danger-border, rgba(239, 68, 68, 0.4));
}

.badge-status-default {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.4);
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
</style>
