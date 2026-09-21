<script setup lang="ts">
import type { ProcessLogDetails } from '../../services/process'

const props = defineProps<{
  details: ProcessLogDetails
}>()
</script>

<template>
  <div class="publicacao-container">
    <div class="card card-content mb-4">
      <h3>Publicação</h3>
      <p class="text-muted">Nesta etapa os resultados validados e calculados são disponibilizados para consumo e travados contra alterações. (Conteúdo em construção para as próximas Sprints).</p>
    </div>
  </div>
</template>

<style scoped>
.publicacao-container {
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

.card-content h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: var(--color-heading);
}

.text-muted {
  opacity: 0.6;
  font-style: italic;
}
</style>
