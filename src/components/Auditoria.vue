<script setup lang="ts">
import { computed } from 'vue'
import type { ProcessVersion } from '@/services/mocks/auditoria.mock'

interface Props {
  versions: ProcessVersion[]
  selectedVersionId?: string
  cargaId?: string
  cargaDataset?: string
  layerName?: string
  canClose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedVersionId: '',
  cargaId: '',
  cargaDataset: '',
  layerName: '',
  canClose: true,
})

const emit = defineEmits<{
  (e: 'select-version', version: ProcessVersion): void
  (e: 'close'): void
}>()

const selectedVersion = computed(() => {
  return props.versions.find((v) => v.id === props.selectedVersionId) || props.versions[0] || null
})

const getStatusClass = (status: string) => {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '-')
  if (normalized.includes('conclu')) return 'status-concluida'
  if (normalized.includes('andamento')) return 'status-em-andamento'
  if (normalized.includes('aguardando') || normalized.includes('valida'))
    return 'status-aguardando-validacao'
  if (normalized.includes('falh')) return 'status-falhou'
  return ''
}
</script>

<template>
  <aside class="locations-panel" aria-label="Versões da carga">
    <!-- Cabeçalho do Painel -->
    <div class="panel-heading">
      <div>
        <h2 class="eyebrow">Versões da Carga</h2>
      </div>
      <div class="heading-actions">
        <button
          v-if="canClose"
          type="button"
          class="btn-close-panel"
          title="Fechar painel de versões"
          aria-label="Fechar painel de versões"
          @click="emit('close')"
        >
          &times;
        </button>
      </div>
    </div>

    <!-- Card de Versão Selecionada no rodapé (coordinates-card) -->
    <div v-if="selectedVersion" class="coordinates-card">
      <span>Versão em exibição</span>
      <strong>{{ selectedVersion.versionTag }}</strong>
      <small>{{ selectedVersion.stage }} &bull; {{ selectedVersion.dateTime }}</small>
      <small v-if="selectedVersion.assignedEditor">
        Autor: {{ selectedVersion.assignedEditor }}
      </small>

    </div>

    <!-- Informações de resumo da carga no topo do painel -->
    <div v-if="cargaId || cargaDataset || layerName" class="panel-summary-box">
      <div v-if="cargaId" class="summary-row">
        <span class="summary-label">Carga:</span>
        <strong class="summary-val">{{ cargaId }}</strong>
      </div>
      <div v-if="cargaDataset" class="summary-row">
        <span class="summary-label">Dataset:</span>
        <span class="summary-val text-truncate" :title="cargaDataset">{{ cargaDataset }}</span>
      </div>
      <div v-if="layerName" class="summary-row">
        <span class="summary-label">Camada:</span>
        <span class="summary-val text-truncate" :title="layerName">{{ layerName }}</span>
      </div>
    </div>

    <!-- Lista de Versões da Carga -->
    <div class="location-list">
      <button
        v-for="version in versions"
        :key="version.id"
        type="button"
        class="location-item"
        :class="{ 'location-item-active': selectedVersionId === version.id }"
        @click="emit('select-version', version)"
      >
        <span class="location-dot" :class="getStatusClass(version.status)"></span>
        <span class="location-content">
          <div class="version-item-header">
            <strong>{{ version.versionTag }}</strong>
          </div>
          <small class="version-date">
            {{ version.dateTime }} &bull; Etapa: {{ version.stage }}
          </small>
          <small class="version-desc">{{ version.changeNote }}</small>
          <small v-if="version.assignedEditor" class="version-author">
            Responsável: {{ version.assignedEditor }}
          </small>
        </span>
      </button>
    </div>


  </aside>
</template>

<style scoped>
/* Painel Lateral de Versões (Fiel ao locations-panel do Mapa) */
.locations-panel {
  display: flex;
  flex-direction: column;
  padding: 22px 18px;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface);
  height: 100%;
  min-height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-heading h2 {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--color-heading);
  margin: 0;
}

.eyebrow {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--vis-brand-orange);
  margin: 0 0 4px 0;
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.location-count {
  min-width: 28px;
  min-height: 28px;
  display: grid;
  place-items: center;
  color: white;
  background: var(--vis-brand-orange);
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: 800;
}

.btn-close-panel {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--vis-c-text-dark-2);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.15s, background-color 0.15s;
}

.btn-close-panel:hover {
  color: var(--color-heading);
  background: var(--color-surface-soft);
}

.panel-summary-box {
  margin-top: 14px;
  padding: 10px 12px;
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: grid;
  gap: 4px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  gap: 8px;
}

.summary-label {
  color: var(--vis-c-text-dark-2);
  flex-shrink: 0;
}

.summary-val {
  color: var(--color-heading);
  font-weight: 600;
  text-align: right;
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.location-list {
  display: grid;
  gap: 6px;
  margin-top: 16px;
  margin-bottom: 16px;
  flex: 1 1 auto;
  overflow-y: auto;
}

.location-item {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 10px;
  color: var(--color-text);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
  box-sizing: border-box;
}

.location-item:hover,
.location-item-active {
  background: var(--color-surface-soft);
  border-color: var(--color-border);
}

.location-item-active {
  border-left: 3px solid var(--vis-brand-orange);
}

.location-dot {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--vis-c-success);
}

.status-concluida {
  background: var(--vis-c-success);
}

.status-em-andamento {
  background: var(--vis-c-warning);
}

.status-aguardando-validacao {
  background: var(--vis-c-info);
}

.status-falhou {
  background: var(--vis-c-danger);
}

.location-content {
  display: grid;
  gap: 3px;
  width: 100%;
  min-width: 0;
}

.version-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.location-content strong {
  color: var(--color-heading);
  font-size: 0.88rem;
}

.version-status-pill {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  color: white;
  white-space: nowrap;
}

.version-status-pill.status-concluida {
  background: #16a34a;
}
.version-status-pill.status-em-andamento {
  background: #d97706;
}
.version-status-pill.status-aguardando-validacao {
  background: #0284c7;
}
.version-status-pill.status-falhou {
  background: #dc2626;
}

.version-date {
  font-size: 0.74rem;
  color: var(--vis-c-text-dark-2);
}

.version-desc {
  font-size: 0.75rem;
  color: var(--color-text);
  line-height: 1.35;
}

.version-author {
  font-size: 0.72rem;
  color: var(--vis-brand-primary);
  font-weight: 500;
}

.coordinates-card {
  display: grid;
  gap: 4px;
  margin-top: auto;
  padding: 14px;
  background: var(--color-surface-soft);
  border-left: 3px solid var(--vis-brand-orange);
  border-radius: 4px;
  box-sizing: border-box;
}

.coordinates-card span {
  font-size: 0.74rem;
  color: var(--vis-c-text-dark-2);
  text-transform: uppercase;
  font-weight: 600;
}

.coordinates-card strong {
  color: var(--color-heading);
  font-size: 0.88rem;
}

.coordinates-card small {
  color: var(--color-text);
  font-size: 0.74rem;
}

.hash-text {
  font-family: monospace;
  font-size: 0.7rem !important;
  color: var(--vis-c-text-dark-2) !important;
}
</style>
