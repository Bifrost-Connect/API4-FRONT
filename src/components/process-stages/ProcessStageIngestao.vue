<script setup lang="ts">
import { ref } from 'vue'
import type { ProcessLogDetails } from '../../services/process'

const props = defineProps<{
  details: ProcessLogDetails
}>()

const isEditing = ref(false)
const formData = ref({
  layerName: props.details.layerName,
  dataset: props.details.dataset,
  source: props.details.source,
  year: props.details.year,
  epsg: props.details.epsg,
  description: props.details.description,
})

const toggleEdit = () => {
  if (isEditing.value) {
    console.log('Saved data:', formData.value)
    props.details.layerName = formData.value.layerName
    props.details.dataset = formData.value.dataset
    props.details.source = formData.value.source
    props.details.year = formData.value.year
    props.details.epsg = formData.value.epsg
    props.details.description = formData.value.description
  }
  isEditing.value = !isEditing.value
}
</script>

<template>
  <div class="card card-content">
    <div class="header-with-action">
      <h3>Dados Iniciais (Formulário)</h3>
      <button class="btn btn_outline btn-sm" @click="toggleEdit">
        {{ isEditing ? 'Salvar' : 'Editar' }}
      </button>
    </div>

    <div class="form-grid">
      <div class="form-group form-group--full">
        <label>Nome da Fonte de Dados / Camada</label>
        <input v-if="isEditing" type="text" v-model="formData.layerName" class="form-control" />
        <p v-else class="form-value">{{ details.layerName }}</p>
      </div>

      <div class="form-group">
        <label>Conjunto de Dados</label>
        <input v-if="isEditing" type="text" v-model="formData.dataset" class="form-control" />
        <p v-else class="form-value">{{ details.dataset }}</p>
      </div>

      <div class="form-group">
        <label>Fonte / Origem</label>
        <input v-if="isEditing" type="text" v-model="formData.source" class="form-control" />
        <p v-else class="form-value">{{ details.source }}</p>
      </div>

      <div class="form-group">
        <label>Ano Base</label>
        <input v-if="isEditing" type="text" v-model="formData.year" class="form-control" />
        <p v-else class="form-value">{{ details.year }}</p>
      </div>

      <div class="form-group">
        <label>EPSG</label>
        <input v-if="isEditing" type="text" v-model="formData.epsg" class="form-control" />
        <p v-else class="form-value">{{ details.epsg }}</p>
      </div>

      <div class="form-group form-group--full">
        <label>Descrição</label>
        <textarea
          v-if="isEditing"
          v-model="formData.description"
          class="form-control textarea"
        ></textarea>
        <p v-else class="form-value">{{ details.description || 'Sem descrição' }}</p>
      </div>

      <div class="form-group form-group--full">
        <label>Hash de Integridade (SHA-256)</label>
        <p class="form-value hash-value">{{ details.integrityHash || '—' }}</p>
        <span class="hash-hint">Gerado automaticamente pelo backend a partir do arquivo original.</span>
      </div>
    </div>

    <div class="mt-4">
      <a
        :href="details.originalFileUrl"
        target="_blank"
        class="btn btn_primary full-width-btn"
        download
      >
        Baixar Arquivo Original
      </a>
    </div>
  </div>
</template>

<style scoped>
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
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
}

.header-with-action h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-heading);
}

.btn-sm {
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group--full {
  grid-column: 1 / -1;
}

.form-group label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
  opacity: 0.7;
  margin-bottom: 0.25rem;
}

.form-value {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-heading);
}

.form-control {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: var(--color-background);
  color: var(--color-text);
  font-size: 0.9rem;
}

.textarea {
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
}

.form-control:focus {
  outline: none;
  border-color: var(--vis-brand-orange);
}

.mt-4 {
  margin-top: 2rem;
}

.full-width-btn {
  width: 100%;
  text-align: center;
  justify-content: center;
}

.hash-value {
  font-family: 'Courier New', monospace;
  font-size: 0.82rem !important;
  word-break: break-all;
  opacity: 0.85;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.4rem 0.6rem;
  margin-top: 0.15rem;
}

.hash-hint {
  font-size: 0.75rem;
  opacity: 0.55;
  margin-top: 0.2rem;
  color: var(--color-text);
}
</style>
