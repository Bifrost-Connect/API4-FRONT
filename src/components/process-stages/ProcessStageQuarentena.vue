<script setup lang="ts">
import { FiAlertTriangle, FiDownload, FiRefreshCw } from 'vue-icons-plus/fi'
import type { ProcessLogDetails } from '../../services/process'
import { useRouter } from 'vue-router'

const props = defineProps<{
  details: ProcessLogDetails
}>()

const router = useRouter()

const exportQuarantine = () => {
  if (!props.details.quarantineRecords) return
  const csvContent = "data:text/csv;charset=utf-8," 
    + "ID,Motivo,Etapa,Data\n"
    + props.details.quarantineRecords.map(r => `${r.recordId},${r.motivo},${r.etapaOrigem},${r.dataRejeicao}`).join("\n")
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  link.setAttribute("download", `quarentena_${props.details.id}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const reprocessLoad = () => {
  // Simulates going back to upload for re-upload
  router.push({ path: '/upload', query: { reprocessId: props.details.id } })
}
</script>

<template>
  <div class="quarentena-container">
    <div class="alert alert-warning mb-4">
      <div class="alert-icon">
        <FiAlertTriangle size="20" />
      </div>
      <div>
        <p>
          <strong>Atenção (Quarentena):</strong> Os registros inconsistentes desta carga foram
          desviados para esta zona apenas para visualização. 
        </p>
        <p style="margin-top: 0.5rem; font-size: 0.9em;">
          Esta etapa recebe rejeições provenientes tanto da <strong>Validação</strong> quanto do <strong>Cálculo/Publicação</strong>. Corrija o arquivo em seu editor GIS local e faça o re-upload.
        </p>
      </div>
    </div>

    <div class="card card-content mb-4">
      <div class="header-actions">
        <h3>Registros em Quarentena</h3>
        <button class="btn btn_outline" @click="exportQuarantine" v-if="details.quarantineRecords?.length">
          <FiDownload size="14" />
          Exportar Lista
        </button>
      </div>
      
      <p class="error-text mb-4" v-if="details.pauseReason">
        Motivo principal: {{ details.pauseReason }}
      </p>

      <div class="table-container" v-if="details.quarantineRecords?.length">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID Registro</th>
              <th>Motivo da Rejeição</th>
              <th>Etapa de Origem</th>
              <th>ID Execução</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in details.quarantineRecords" :key="record.recordId">
              <td>{{ record.recordId }}</td>
              <td>{{ record.motivo }}</td>
              <td><span class="badge">{{ record.etapaOrigem }}</span></td>
              <td class="font-mono">{{ record.execucaoId }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else>Nenhum registro detalhado na quarentena.</p>
      
      <div class="mt-4 border-top pt-4">
        <p class="mb-3 text-sm text-muted">Após corrigir o arquivo, você deve reprocessar a carga submetendo o novo arquivo corrigido.</p>
        <button class="btn btn-primary" @click="reprocessLoad">
          <FiRefreshCw size="14" />
          Reprocessar Carga (Re-upload)
        </button>
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
  align-items: flex-start;
  gap: 1rem;
  border-left: 4px solid var(--vis-c-warning, #eab308);
}

.alert-icon {
  color: #a16207;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-top: 0.2rem;
}

.card {
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.card-content {
  padding: 1.5rem;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-content h3 {
  margin: 0;
  color: var(--color-heading);
}

.error-text {
  color: #ef4444;
  font-weight: 500;
}

.btn_outline {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background-color: var(--vis-brand-orange, #f26522);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary:hover {
  filter: brightness(0.9);
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.data-table th, .data-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.data-table th {
  font-weight: 600;
  color: var(--color-heading);
  background-color: rgba(0,0,0,0.02);
}

.badge {
  background-color: rgba(0,0,0,0.05);
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.font-mono {
  font-family: monospace;
  font-size: 0.85rem;
}

.border-top {
  border-top: 1px solid var(--color-border);
}

.text-sm {
  font-size: 0.85rem;
}

.text-muted {
  opacity: 0.7;
}

.pt-4 {
  padding-top: 1.5rem;
}

.mt-3 {
  margin-top: 1rem;
}

.mt-4 {
  margin-top: 1.5rem;
}

.mb-3 {
  margin-bottom: 1rem;
}

.mb-4 {
  margin-bottom: 1.5rem;
}
</style>
