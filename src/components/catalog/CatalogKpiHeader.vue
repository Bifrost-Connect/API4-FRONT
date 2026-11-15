<script setup lang="ts">
/**
 * Header de KPIs do Catálogo de Bases (US09 - Tarefa 2).
 * Exibe 4 cards com contadores rápidos e fallback para carregamento via Skeleton.
 */
import {
  FiDatabase,
  FiCheckCircle,
  FiClock,
  FiArchive,
} from 'vue-icons-plus/fi'
import CatalogSkeleton from './CatalogSkeleton.vue'
import type { CatalogoKpis } from '@/types/catalogo'

withDefaults(
  defineProps<{
    kpis: CatalogoKpis
    loading?: boolean
  }>(),
  {
    loading: false,
  },
)
</script>

<template>
  <section class="kpis-section" aria-label="Indicadores gerais do catálogo">
    <CatalogSkeleton v-if="loading" type="kpi" />

    <div v-else class="kpis-grid" data-testid="kpis-header">
      <!-- Card 1: Total de Bases -->
      <article class="kpi-card kpi-total" data-testid="kpi-total">
        <div class="kpi-icon-wrapper total-icon">
          <FiDatabase size="22" aria-hidden="true" />
        </div>
        <div class="kpi-content">
          <span class="kpi-value" data-testid="kpi-value-total">{{ kpis.totalCarregadas }}</span>
          <span class="kpi-label">Total de Bases</span>
        </div>
      </article>

      <!-- Card 2: Prontas para Consulta -->
      <article class="kpi-card kpi-prontas" data-testid="kpi-prontas">
        <div class="kpi-icon-wrapper prontas-icon">
          <FiCheckCircle size="22" aria-hidden="true" />
        </div>
        <div class="kpi-content">
          <span class="kpi-value" data-testid="kpi-value-prontas">{{ kpis.prontasConsulta }}</span>
          <span class="kpi-label">Prontas para Consulta</span>
        </div>
      </article>

      <!-- Card 3: Em Processamento -->
      <article class="kpi-card kpi-processamento" data-testid="kpi-processamento">
        <div class="kpi-icon-wrapper processamento-icon">
          <FiClock size="22" aria-hidden="true" />
        </div>
        <div class="kpi-content">
          <span class="kpi-value" data-testid="kpi-value-processamento">{{ kpis.emProcessamento }}</span>
          <span class="kpi-label">Em Processamento</span>
        </div>
      </article>

      <!-- Card 4: Versões Congeladas -->
      <article class="kpi-card kpi-congeladas" data-testid="kpi-congeladas">
        <div class="kpi-icon-wrapper congeladas-icon">
          <FiArchive size="22" aria-hidden="true" />
        </div>
        <div class="kpi-content">
          <span class="kpi-value" data-testid="kpi-value-congeladas">
            {{ kpis.historicasCongeladas !== undefined ? kpis.historicasCongeladas : '—' }}
          </span>
          <span class="kpi-label">Versões Congeladas</span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.kpis-section {
  margin: 16px 0 20px;
}

.kpis-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

@media (max-width: 1200px) {
  .kpis-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .kpis-grid {
    grid-template-columns: 1fr;
  }
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
  min-height: 82px;
}

.kpi-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-brand);
  box-shadow: var(--shadow-brand);
}

.kpi-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.total-icon {
  background: var(--badge-info-bg);
  color: var(--badge-info-text);
}

.prontas-icon {
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
}

.processamento-icon {
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
}

.congeladas-icon {
  background: var(--badge-editor-bg);
  color: var(--badge-editor-text);
}

.kpi-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.kpi-value {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--color-heading);
  letter-spacing: -0.02em;
}

.kpi-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-top: 4px;
  line-height: 1.3;
  white-space: normal;
  word-break: normal;
  overflow: visible;
  text-overflow: clip;
}
</style>
