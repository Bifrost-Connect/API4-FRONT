<script setup lang="ts">
import type { ProcessLogDetails } from '../services/dashboard'

const props = defineProps<{
  details: ProcessLogDetails
}>()

</script>

<template>
  <div class="quarentena-container">
    <div class="alert alert-warning mb-4">
      <span class="alert-icon">⚠️</span>
      <p><strong>Atenção (Quarentena):</strong> Os registros inconsistentes desta carga foram desviados para esta zona para análise e correção.</p>
    </div>
    
    <div class="card card-content mb-4">
      <h3>Motivo da Quarentena</h3>
      <p class="error-text">{{ details.pauseReason || 'Inconsistências geométricas ou sobreposições encontradas.' }}</p>
      <div class="mt-3">
        <button class="btn btn_outline">Baixar Relatório de Erros</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quarentena-container {
  width: 100%;
}

.alert-warning {
  background-color: rgba(234, 179, 8, 0.15);
  color: var(--color-text);
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-left: 4px solid var(--vis-c-warning, #eab308);
}

.alert-icon {
  font-size: 1.5rem;
}

.card {
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.card-content {
  padding: 1.5rem;
}

.card-content h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: var(--color-heading);
}

.error-text {
  color: #ef4444;
  font-weight: 500;
}

.mt-3 {
  margin-top: 1rem;
}

.mb-4 {
  margin-bottom: 1.5rem;
}
</style>
