<script setup lang="ts">
/**
 * Componente unificado de abas de categorias rápidas e barra de filtros padrão.
 * Utilizado pelo Dashboard e pelo Catálogo de Bases para evitar duplicação
 * de lógica de contagem, inputs de filtro e estilo.
 */
import { computed } from 'vue'
import type { ProcessLog } from '../services/dashboard'
import type { ProcessCategory } from '../utils/processUtils'
import { isErrorOrQuarantined, isProcessVigente } from '../utils/processUtils'

export interface StandardFilters {
  dateBeggin: string
  dateEnd: string
  conjunto: string
  etapa: string
  situacao: string
}

export interface FilterOptionsData {
  conjuntos: Array<{ id: number | string; label: string }>
  etapas: Array<{ id: number | string; label: string }>
  situacoes: Array<{ id: number | string; label: string }>
}

const props = withDefaults(
  defineProps<{
    modelValue: StandardFilters
    selectedCategory: ProcessCategory
    items?: ProcessLog[]
    filterOptions?: FilterOptionsData
    showConcluidasTab?: boolean
  }>(),
  {
    items: () => [],
    filterOptions: () => ({ conjuntos: [], etapas: [], situacoes: [] }),
    showConcluidasTab: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: StandardFilters): void
  (e: 'update:selectedCategory', value: ProcessCategory): void
  (e: 'filter'): void
  (e: 'conjunto-change'): void
}>()

// Contagens reativas por categoria calculadas dinamicamente
const countConcluidas = computed(() => props.items.filter(isProcessVigente).length)
const countTodas = computed(() => props.items.length)
const countAttention = computed(() => props.items.filter(isErrorOrQuarantined).length)
const countQuarentena = computed(
  () =>
    props.items.filter(
      (p) => (p.status || '').toLowerCase().includes('quarentena') || p.quarantined,
    ).length,
)
const countValidacao = computed(
  () => props.items.filter((p) => (p.stage || '').toLowerCase().includes('valida')).length,
)
const countTratamento = computed(
  () => props.items.filter((p) => (p.stage || '').toLowerCase().includes('trata')).length,
)
const countEmCorrecao = computed(() => props.items.filter((p) => Boolean(p.assignedEditor)).length)

const setCategory = (cat: ProcessCategory) => {
  emit('update:selectedCategory', cat)
}

const updateFilterField = (field: keyof StandardFilters, value: string) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: value,
  })
}

const onConjuntoChange = (event: Event) => {
  const val = (event.target as HTMLSelectElement).value
  updateFilterField('conjunto', val)
  emit('conjunto-change')
}

const onApply = () => {
  emit('filter')
}
</script>

<template>
  <div class="process-filter-bar">
    <!-- Abas de Filtro Rápido por Categoria -->
    <div class="category-tabs">
      <button
        v-if="showConcluidasTab"
        type="button"
        class="category-tab-btn"
        :class="{ active: selectedCategory === 'CONCLUIDAS' }"
        data-testid="tab-concluidas"
        @click="setCategory('CONCLUIDAS')"
      >
        Disponíveis ({{ countConcluidas }})
      </button>

      <button
        type="button"
        class="category-tab-btn"
        :class="{ active: selectedCategory === 'TODAS' }"
        data-testid="tab-todas"
        @click="setCategory('TODAS')"
      >
        Todas as Cargas ({{ countTodas }})
      </button>

      <button
        type="button"
        class="category-tab-btn"
        :class="{ active: selectedCategory === 'ATTENTION' }"
        data-testid="tab-attention"
        @click="setCategory('ATTENTION')"
      >
        Requerem Atenção ({{ countAttention }})
      </button>

      <button
        type="button"
        class="category-tab-btn"
        :class="{ active: selectedCategory === 'QUARENTENA' }"
        data-testid="tab-quarentena"
        @click="setCategory('QUARENTENA')"
      >
        Quarentena ({{ countQuarentena }})
      </button>

      <button
        type="button"
        class="category-tab-btn"
        :class="{ active: selectedCategory === 'VALIDACAO' }"
        data-testid="tab-validacao"
        @click="setCategory('VALIDACAO')"
      >
        Validação ({{ countValidacao }})
      </button>

      <button
        type="button"
        class="category-tab-btn"
        :class="{ active: selectedCategory === 'TRATAMENTO' }"
        data-testid="tab-tratamento"
        @click="setCategory('TRATAMENTO')"
      >
        Tratamento ({{ countTratamento }})
      </button>

      <button
        type="button"
        class="category-tab-btn"
        :class="{ active: selectedCategory === 'EM_CORRECAO' }"
        data-testid="tab-em-correcao"
        @click="setCategory('EM_CORRECAO')"
      >
        Com Especialista ({{ countEmCorrecao }})
      </button>
    </div>

    <!-- Barra de Filtros Tradicionais -->
    <div class="card card-filters mt-3">
      <!-- Slot opcional para filtros extras (como busca textual e órgão/ano no catálogo) -->
      <slot name="extra-filters"></slot>

      <div class="card-content filters-container">
        <!-- Intervalo de Datas -->
        <div class="filter-item filter-dates">
          <div class="date-row">
            <label for="filterDateBeggin">Início:</label>
            <input
              type="date"
              id="filterDateBeggin"
              name="filterDateBeggin"
              class="input-inline"
              :value="modelValue.dateBeggin"
              @input="updateFilterField('dateBeggin', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="date-row">
            <label for="filterDateEnd">Fim:</label>
            <input
              type="date"
              id="filterDateEnd"
              name="filterDateEnd"
              class="input-inline"
              :value="modelValue.dateEnd"
              @input="updateFilterField('dateEnd', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <!-- Seleção de Conjunto -->
        <div class="filter-item">
          <label for="filterConjuntoSelect">Conjunto:</label>
          <select
            id="filterConjuntoSelect"
            class="input-inline"
            :value="modelValue.conjunto"
            data-testid="filter-conjunto"
            @change="onConjuntoChange"
          >
            <option value="">Todos</option>
            <option
              v-for="opt in filterOptions.conjuntos"
              :key="opt.id"
              :value="String(opt.id)"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Seleção de Etapa -->
        <div class="filter-item">
          <label for="filterEtapaSelect">Etapa:</label>
          <select
            id="filterEtapaSelect"
            class="input-inline"
            :value="modelValue.etapa"
            data-testid="filter-etapa"
            @change="updateFilterField('etapa', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Todas</option>
            <option
              v-for="opt in filterOptions.etapas"
              :key="opt.id"
              :value="String(opt.id)"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Seleção de Situação -->
        <div class="filter-item">
          <label for="filterSituacaoSelect">Situação:</label>
          <select
            id="filterSituacaoSelect"
            class="input-inline"
            :value="modelValue.situacao"
            data-testid="filter-situacao"
            @change="updateFilterField('situacao', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Todas</option>
            <option
              v-for="opt in filterOptions.situacoes"
              :key="opt.id"
              :value="String(opt.id)"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Ação de Filtrar -->
        <div class="filter-actions">
          <button
            type="button"
            class="btn btn-filter"
            data-testid="apply-filters"
            @click="onApply"
          >
            FILTRAR
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.process-filter-bar {
  width: 100%;
}

/* Abas de categoria rápida */
.category-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.category-tabs::-webkit-scrollbar {
  height: 4px;
}

.category-tabs::-webkit-scrollbar-track {
  background: transparent;
}

.category-tabs::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}

.category-tabs::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-hover);
}

.category-tab-btn {
  padding: 8px 14px;
  border-radius: 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.category-tab-btn:hover {
  background: var(--color-surface-soft);
  color: var(--color-heading);
}

.category-tab-btn.active {
  background: var(--color-brand);
  border-color: var(--color-brand);
  color: var(--color-brand-contrast);
}

/* Container de filtros */
.card-filters {
  background: var(--color-surface);
  border-radius: 10px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.filters-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  padding: 12px 14px;
  align-items: center;
}

@media (min-width: 768px) {
  .filters-container {
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 1200px) {
  .filters-container {
    grid-template-columns: auto 1fr 1fr 1fr auto;
    align-items: center;
  }
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 6px 12px;
  background: var(--color-surface-soft);
  min-width: 0;
  min-height: 42px;
  transition: border-color 150ms ease;
}

.filter-item:hover,
.filter-item:focus-within {
  border-color: var(--color-brand);
}

.filter-item label {
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.filter-dates {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  min-height: 42px;
}

.date-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

@media (max-width: 768px) {
  .filter-dates {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
}

.input-inline {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  color: var(--color-heading);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 2px 0;
  cursor: pointer;
}

.input-inline option {
  background: var(--color-surface);
  color: var(--color-text);
}

.filter-actions {
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
}

.btn-filter {
  height: 42px;
  min-height: 42px;
  border: 1px solid var(--color-brand);
  color: var(--color-brand-contrast);
  background: var(--color-brand);
  font-weight: 800;
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  padding: 0.5rem 1.4rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-filter:hover {
  background: var(--color-brand-hover);
  border-color: var(--color-brand-hover);
  box-shadow: var(--shadow-brand);
}
</style>

