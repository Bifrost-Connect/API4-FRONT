<script setup lang="ts">
/**
 * Header de KPIs do Catálogo de Bases (US09 - Tarefa 2).
 * Exibe 4 cards com contadores rápidos e fallback para carregamento via Skeleton.
 */
import CardContainer from '@/components/CardContainer.vue'
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
      <CardContainer
        title="Total de Bases"
        :value="kpis.totalCarregadas"
        variant="orange"
        icon-type="database"
        value-test-id="kpi-value-total"
        data-testid="kpi-total"
      />

      <!-- Card 2: Prontas para Consulta -->
      <CardContainer
        title="Prontas para Consulta"
        :value="kpis.prontasConsulta"
        variant="success"
        icon-type="check"
        value-test-id="kpi-value-prontas"
        data-testid="kpi-prontas"
      />

      <!-- Card 3: Em Processamento -->
      <CardContainer
        title="Em Processamento"
        :value="kpis.emProcessamento"
        variant="info"
        icon-type="clock"
        value-test-id="kpi-value-processamento"
        data-testid="kpi-processamento"
      />

      <!-- Card 4: Versões Congeladas -->
      <CardContainer
        title="Versões Congeladas"
        :value="kpis.historicasCongeladas !== undefined ? kpis.historicasCongeladas : '—'"
        variant="purple"
        icon-type="archive"
        value-test-id="kpi-value-congeladas"
        data-testid="kpi-congeladas"
      />
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
  gap: 16px;
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
</style>
