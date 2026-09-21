<script setup lang="ts">
import { computed } from 'vue'
import type { ProcessLogDetails } from '../../services/process'
import ProcessStageQuarentena from './ProcessStageQuarentena.vue'

const props = defineProps<{
  details: ProcessLogDetails
}>()

const isInQuarantine = computed(() => {
  return props.details.status === 'Falhou' || props.details.status === 'Em validação'
})
</script>

<template>
  <div class="validacao-grid">
    <!-- Componente de Quarentena embutido caso haja erro na validação -->
    <ProcessStageQuarentena v-if="isInQuarantine" :details="details" />

    <div v-else class="alert alert-success mb-4">
      <span class="alert-icon">✅</span>
      <p>
        <strong>Sucesso:</strong> A validação ocorreu sem problemas. Nenhuma inconsistência grave
        encontrada.
      </p>
    </div>
  </div>
</template>

<style scoped>
.validacao-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.alert-success {
  background-color: rgba(34, 197, 94, 0.15);
  color: var(--color-text);
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-left: 4px solid #22c55e;
}

.alert-icon {
  font-size: 1.5rem;
}

.mb-4 {
  margin-bottom: 1.5rem;
}
</style>
