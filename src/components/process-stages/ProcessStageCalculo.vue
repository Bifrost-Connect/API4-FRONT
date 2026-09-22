<script setup lang="ts">
import { computed } from 'vue'
import type { ProcessLogDetails } from '../../services/process'

const props = defineProps<{
  details: ProcessLogDetails
}>()

const emit = defineEmits<{
  (e: 'open-quarantine'): void
}>()

const isInQuarantine = computed(() => {
  return props.details.status === 'Falhou' || props.details.status === 'Em validação'
})
</script>

<template>
  <div class="calculo-container">
    <div class="card card-content">
      <div class="header-with-action">
        <h3>Cálculo analítico</h3>
        <button v-if="isInQuarantine" class="btn btn-warning" @click="emit('open-quarantine')">Ver Quarentena</button>
      </div>
      <p class="text-muted">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam in dui mauris. Vivamus
        hendrerit arcu sed erat molestie vehicula. Sed auctor neque eu tellus rhoncus ut eleifend
        nibh porttitor. Ut in nulla enim.
      </p>
    </div>
  </div>
</template>

<style scoped>
.calculo-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card {
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.card-content {
  padding: 1.5rem;
}

.header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header-with-action h3 {
  margin: 0;
  color: var(--color-heading);
}

.btn-warning {
  background-color: #f59e0b;
  color: #fff;
  border-color: #f59e0b;
}

.btn-warning:hover {
  background-color: #d97706;
}

.text-muted {
  opacity: 0.7;
  line-height: 1.6;
}
</style>
