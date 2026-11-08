<script setup lang="ts">
/**
 * Componente de Skeleton loader para o Catálogo de Bases (US09 - Tarefa 9).
 */
withDefaults(
  defineProps<{
    type?: 'kpi' | 'card' | 'table'
    count?: number
  }>(),
  {
    type: 'card',
    count: 3,
  },
)
</script>

<template>
  <div v-if="type === 'kpi'" class="skeleton-kpis-grid" data-testid="skeleton-kpi">
    <div v-for="n in 4" :key="n" class="skeleton-kpi-card">
      <div class="skeleton-shimmer skeleton-circle"></div>
      <div class="skeleton-text-group">
        <div class="skeleton-shimmer skeleton-line short"></div>
        <div class="skeleton-shimmer skeleton-line long"></div>
      </div>
    </div>
  </div>

  <div v-else-if="type === 'card'" class="skeleton-cards-grid" data-testid="skeleton-cards">
    <div v-for="n in count" :key="n" class="skeleton-catalog-card">
      <div class="skeleton-header">
        <div class="skeleton-shimmer skeleton-tag"></div>
        <div class="skeleton-shimmer skeleton-pill"></div>
      </div>
      <div class="skeleton-shimmer skeleton-line title"></div>
      <div class="skeleton-shimmer skeleton-line subtitle"></div>
      <div class="skeleton-meta-grid">
        <div class="skeleton-shimmer skeleton-line" v-for="m in 4" :key="m"></div>
      </div>
      <div class="skeleton-footer">
        <div class="skeleton-shimmer skeleton-btn"></div>
        <div class="skeleton-shimmer skeleton-btn"></div>
      </div>
    </div>
  </div>

  <div v-else-if="type === 'table'" class="skeleton-table-wrapper" data-testid="skeleton-table">
    <div class="skeleton-table-header">
      <div class="skeleton-shimmer skeleton-line" v-for="col in 6" :key="col"></div>
    </div>
    <div v-for="r in count" :key="r" class="skeleton-table-row">
      <div class="skeleton-shimmer skeleton-line" v-for="col in 6" :key="col"></div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.12) 25%,
    rgba(148, 163, 184, 0.24) 50%,
    rgba(148, 163, 184, 0.12) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.skeleton-kpis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.skeleton-kpi-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 12px;
  border: 1px solid var(--vis-c-divider-dark-2, #334155);
  background: var(--vis-c-dark-soft, #1e293b);
}

.skeleton-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton-text-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 14px;
  border-radius: 4px;
}

.skeleton-line.short {
  width: 45%;
  height: 22px;
}

.skeleton-line.long {
  width: 75%;
}

.skeleton-line.title {
  height: 20px;
  width: 80%;
  margin-top: 12px;
}

.skeleton-line.subtitle {
  height: 14px;
  width: 50%;
  margin-top: 6px;
}

.skeleton-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.skeleton-catalog-card {
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--vis-c-divider-dark-2, #334155);
  background: var(--vis-c-dark-soft, #1e293b);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skeleton-tag {
  width: 70px;
  height: 20px;
}

.skeleton-pill {
  width: 90px;
  height: 24px;
  border-radius: 999px;
}

.skeleton-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 8px 0;
}

.skeleton-footer {
  display: flex;
  gap: 10px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.skeleton-btn {
  flex: 1;
  height: 36px;
  border-radius: 6px;
}

.skeleton-table-wrapper {
  background: var(--vis-c-dark-soft, #1e293b);
  border: 1px solid var(--vis-c-divider-dark-2, #334155);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.skeleton-table-header,
.skeleton-table-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}

.skeleton-table-row {
  padding: 8px 0;
  border-top: 1px solid rgba(148, 163, 184, 0.08);
}
</style>
