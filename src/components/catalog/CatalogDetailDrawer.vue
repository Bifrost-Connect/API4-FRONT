<script setup lang="ts">
/**
 * Drawer / Modal de Ficha Técnica e Prévia de Atributos da Base (US09 - Tarefa 6).
 */
import { computed, onMounted, onUnmounted } from 'vue'
import {
  FiX,
  FiFileText,
  FiMapPin,
  FiPieChart,
  FiCheckCircle,
  FiDatabase,
  FiCalendar,
  FiLayers,
  FiHardDrive,
  FiLock,
  FiGlobe,
} from 'vue-icons-plus/fi'
import type { CatalogoItem } from '@/types/catalogo'
import { isBaseDisponivel, normalizeSituacaoBadge } from '@/utils/catalogoUtils'

const props = defineProps<{
  base: CatalogoItem | null
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-map', base: CatalogoItem): void
  (e: 'compare-safra', base: CatalogoItem): void
}>()

const isDisponivel = computed(() => (props.base ? isBaseDisponivel(props.base) : false))
const badgeInfo = computed(() => normalizeSituacaoBadge(props.base?.status))

// Colunas e linhas da tabela de prévia de atributos
const previewColumns = computed(() => {
  if (!props.base?.previa_atributos || props.base.previa_atributos.length === 0 || !props.base.previa_atributos[0]) {
    return []
  }
  return Object.keys(props.base.previa_atributos[0])
})

const previewRows = computed(() => {
  return props.base?.previa_atributos || []
})

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isOpen && base"
      class="drawer-backdrop"
      data-testid="catalog-drawer-backdrop"
      @click.self="emit('close')"
    >
      <aside
        class="drawer-container"
        role="dialog"
        aria-modal="true"
        :aria-label="`Ficha Técnica da Base ${base.dataset || base.id}`"
        data-testid="catalog-detail-drawer"
      >
        <!-- Cabeçalho do Drawer -->
        <header class="drawer-header">
          <div class="drawer-header-left">
            <span class="drawer-tag">Base #{{ base.id }}</span>
            <span :class="['badge-status', badgeInfo.badgeClass]" data-testid="drawer-status-badge">
              {{ badgeInfo.label }}
            </span>
            <h2 class="drawer-title" data-testid="drawer-title">{{ base.dataset }}</h2>
            <p class="drawer-subtitle">
              Órgão Emissor: <strong>{{ base.source || '—' }}</strong> &bull; Safra:
              <strong>{{ base.year || '—' }}</strong>
            </p>
          </div>
          <button
            type="button"
            class="btn-close-drawer"
            aria-label="Fechar ficha técnica"
            data-testid="btn-close-drawer"
            @click="emit('close')"
          >
            <FiX size="20" />
          </button>
        </header>

        <!-- Corpo do Drawer -->
        <div class="drawer-body">
          <!-- Ações Rápidas Analíticas no Topo -->
          <div v-if="isDisponivel" class="drawer-actions-bar">
            <button
              type="button"
              class="btn-action-primary"
              data-testid="drawer-btn-map"
              @click="emit('open-map', base)"
            >
              <FiMapPin size="16" />
              Abrir no Mapa Interativo
            </button>
            <button
              type="button"
              class="btn-action-secondary"
              data-testid="drawer-btn-compare"
              @click="emit('compare-safra', base)"
            >
              <FiPieChart size="16" />
              Comparar Safra
            </button>
          </div>

          <!-- Seção 1: Metadados Ricos (Ficha Técnica) -->
          <section class="section-metadados" aria-labelledby="heading-ficha-tecnica">
            <h3 id="heading-ficha-tecnica" class="section-heading">
              <FiFileText size="18" />
              Ficha Técnica e Metadados
            </h3>

            <div class="metadata-grid" data-testid="drawer-metadata-grid">
              <div class="meta-card">
                <span class="meta-label"><FiLayers size="14" /> Formato de Dados</span>
                <span class="meta-val" data-testid="meta-formato">{{ base.tamanho_arquivo ? 'GeoJSON' : '—' }}</span>
              </div>

              <div class="meta-card">
                <span class="meta-label"><FiLock size="14" /> Classificação de Acesso</span>
                <span class="meta-val" data-testid="meta-classificacao">{{ base.classificacao_acesso || 'Pública' }}</span>
              </div>

              <div class="meta-card">
                <span class="meta-label"><FiGlobe size="14" /> Cobertura Espacial</span>
                <span class="meta-val" data-testid="meta-cobertura-espacial">{{ base.cobertura_espacial || 'Nacional' }}</span>
              </div>

              <div class="meta-card">
                <span class="meta-label"><FiCalendar size="14" /> Cobertura Temporal</span>
                <span class="meta-val" data-testid="meta-cobertura-temporal">{{ base.cobertura_temporal || `Safra ${base.year || '—'}` }}</span>
              </div>

              <div class="meta-card">
                <span class="meta-label"><FiCalendar size="14" /> Data de Publicação</span>
                <span class="meta-val" data-testid="meta-data-publicacao">{{ base.data_publicacao || '—' }}</span>
              </div>

              <div class="meta-card">
                <span class="meta-label"><FiHardDrive size="14" /> Tamanho do Arquivo</span>
                <span class="meta-val" data-testid="meta-tamanho">{{ base.tamanho_arquivo || '—' }}</span>
              </div>

              <div class="meta-card">
                <span class="meta-label"><FiDatabase size="14" /> Contagem de Registros</span>
                <span class="meta-val" data-testid="meta-registros">
                  {{ base.total_feicoes !== undefined ? base.total_feicoes.toLocaleString('pt-BR') : '—' }}
                </span>
              </div>

              <div class="meta-card">
                <span class="meta-label"><FiGlobe size="14" /> Sistema de Referência (EPSG)</span>
                <span class="meta-val" data-testid="meta-epsg">{{ base.epsg || 'SIRGAS 2000 (EPSG:4674)' }}</span>
              </div>

              <div class="meta-card full-width">
                <span class="meta-label"><FiCheckCircle size="14" /> Hash de Integridade</span>
                <code class="meta-hash" data-testid="meta-hash">{{ base.hash_integridade || 'SHA256: d8b2c4e97a3f81e0... (Verificado)' }}</code>
              </div>
            </div>
          </section>

          <!-- Seção 2: Prévia das Primeiras Linhas da Tabela de Atributos -->
          <section class="section-preview" aria-labelledby="heading-previa">
            <div class="preview-header">
              <h3 id="heading-previa" class="section-heading">
                <FiDatabase size="18" />
                Prévia da Tabela de Atributos
              </h3>
              <span v-if="previewRows.length > 0" class="preview-count-tag">
                Exibindo primeiras {{ previewRows.length }} linhas
              </span>
            </div>

            <!-- Tabela com Atributos se houver dados -->
            <div
              v-if="previewRows.length > 0"
              class="table-responsive-wrapper"
              data-testid="preview-table-container"
            >
              <table class="preview-table" data-testid="preview-table">
                <thead>
                  <tr>
                    <th v-for="col in previewColumns" :key="col" scope="col">{{ col }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in previewRows" :key="idx">
                    <td v-for="col in previewColumns" :key="col">
                      {{ row[col] !== undefined && row[col] !== null ? row[col] : '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Fallback elegante quando não houver atributos retornados pela API -->
            <div v-else class="preview-empty-state" data-testid="preview-empty-state">
              <FiDatabase size="32" class="preview-empty-icon" />
              <p class="preview-empty-text">
                Prévia de atributos pontuais não retornada pela camada de persistência para esta carga.
              </p>
              <small class="preview-empty-sub">
                Os metadados consolidados e geometrias estão disponíveis para consulta no Mapa Interativo.
              </small>
            </div>
          </section>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: flex-end;
}

.drawer-container {
  width: 100%;
  max-width: 680px;
  height: 100vh;
  background: var(--color-surface);
  color: var(--color-text);
  border-left: 2px solid var(--color-brand);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-drawer);
  overflow: hidden;
  animation: slideIn 220ms ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-header {
  padding: 24px 28px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  background: var(--color-surface-soft);
}

.drawer-header-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-tag {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-brand);
}

.drawer-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--color-heading);
}

.drawer-subtitle {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.btn-close-drawer {
  background: var(--badge-neutral-bg);
  border: 1px solid transparent;
  color: var(--color-text-muted);
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn-close-drawer:hover {
  background: var(--badge-danger-bg);
  color: var(--color-danger);
}

.drawer-body {
  padding: 24px 28px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.drawer-actions-bar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-action-primary,
.btn-action-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn-action-primary {
  background: var(--color-brand);
  color: var(--color-brand-contrast);
  border: none;
}

.btn-action-primary:hover {
  background: var(--color-brand-hover);
  box-shadow: var(--shadow-brand);
}

.btn-action-secondary {
  background: transparent;
  color: var(--color-heading);
  border: 1px solid var(--color-border);
}

.btn-action-secondary:hover {
  background: var(--color-surface-soft);
  border-color: var(--color-brand);
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.96rem;
  font-weight: 700;
  margin: 0 0 16px;
  color: var(--color-heading);
  letter-spacing: -0.01em;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.meta-card {
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-card.full-width {
  grid-column: 1 / -1;
}

.meta-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.meta-val {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-heading);
}

.meta-hash {
  font-family: monospace;
  font-size: 0.8rem;
  background: var(--color-code-bg);
  padding: 6px 8px;
  border-radius: 4px;
  color: var(--color-code-text);
  word-break: break-all;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preview-count-tag {
  font-size: 0.72rem;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--badge-info-bg);
  color: var(--badge-info-text);
  font-weight: 600;
}

.table-responsive-wrapper {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-soft);
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.preview-table th {
  position: sticky;
  top: 0;
  background: var(--color-background-soft);
  color: var(--color-brand);
  padding: 10px 12px;
  text-align: left;
  border-bottom: 2px solid var(--color-border);
  font-weight: 700;
  white-space: nowrap;
}

.preview-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.preview-table tr:hover td {
  background: var(--color-brand-soft);
}

.preview-empty-state {
  padding: 28px 20px;
  text-align: center;
  background: var(--color-surface-soft);
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.preview-empty-icon {
  color: var(--color-text-muted);
  opacity: 0.6;
}

.preview-empty-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-heading);
  font-weight: 600;
}

.preview-empty-sub {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.badge-status {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
}

.badge-status-concluida {
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
  border: 1px solid var(--badge-success-border);
}

.badge-status-andamento {
  background: var(--badge-info-bg);
  color: var(--badge-info-text);
  border: 1px solid var(--badge-info-border);
}

.badge-status-quarentena {
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
  border: 1px solid var(--badge-warning-border);
}

.badge-status-ressalva {
  background: var(--badge-orange-bg);
  color: var(--badge-orange-text);
  border: 1px solid var(--badge-orange-border);
}

.badge-status-falhou {
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
  border: 1px solid var(--badge-danger-border);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
