<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  processService,
  type IndicatorExportFormat,
  type ProcessLogDetails,
  type ProcessTraceability,
} from '../services/process'
import Stepper from '../components/Stepper.vue'
import Auditoria from '../components/Auditoria.vue'
import ProcessStageIngestao from '../components/process-stages/ProcessStageIngestao.vue'
import ProcessStageValidacao from '../components/process-stages/ProcessStageValidacao.vue'
import ProcessStageTratamento from '../components/process-stages/ProcessStageTratamento.vue'
import ProcessStagePublicacao from '../components/process-stages/ProcessStagePublicacao.vue'
import ProcessStageQuarentena from '../components/process-stages/ProcessStageQuarentena.vue'
import {
  mockAuditCargas,
  type ProcessVersion,
  type AuditProcessCarga,
} from '@/services/mocks/auditoria.mock'

interface Props {
  processId?: string
  detailsData?: ProcessLogDetails | null
}

const props = defineProps<Props>()

const route = useRoute()
const router = useRouter()

const processId = computed(() => props.processId || (route?.params?.id as string) || '')
const isLoading = ref(!props.detailsData)
const details = ref<ProcessLogDetails | null>(props.detailsData || null)

// Controle do componente Auditoria (que pode ou não ser usado)
const auditVersions = ref<ProcessVersion[]>([])
const currentCarga = ref<AuditProcessCarga | null>(null)
const isAuditOpen = ref(true)
const traceability = ref<ProcessTraceability | null>(null)
const isTraceabilityLoading = ref(false)
const traceabilityError = ref('')
const exportError = ref('')
const exportingFormat = ref<IndicatorExportFormat | null>(null)
let traceabilityRequestId = 0

const currentCargaId = computed(() => {
  return currentCarga.value?.id || details.value?.id || processId.value
})

const isBackendProcess = computed(
  () =>
    details.value?.dataSource === 'API' &&
    !currentCarga.value &&
    /^\d+$/.test(String(details.value.id)),
)
const isClosed = computed(() => details.value?.status.toLowerCase().includes('fechad') ?? false)

const loadTraceability = async (id: string, backendProcess: boolean) => {
  const requestId = ++traceabilityRequestId
  traceability.value = null
  traceabilityError.value = ''
  if (!backendProcess) {
    isTraceabilityLoading.value = false
    return
  }

  isTraceabilityLoading.value = true
  try {
    const result = await processService.getTraceability(id)
    if (requestId === traceabilityRequestId) traceability.value = result
  } catch (error: any) {
    if (requestId === traceabilityRequestId) {
      traceabilityError.value =
        error?.response?.status === 404
          ? 'A linhagem deste processo ainda não está disponível.'
          : 'Não foi possível carregar a linhagem do arquivo.'
    }
  } finally {
    if (requestId === traceabilityRequestId) isTraceabilityLoading.value = false
  }
}

const exportIndicator = async (format: IndicatorExportFormat) => {
  if (!isBackendProcess.value || !details.value) return
  exportingFormat.value = format
  exportError.value = ''
  try {
    const file = await processService.exportIndicator(details.value.id, format)
    const objectUrl = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `indicador_${details.value.id}.${format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    exportError.value = 'Não foi possível exportar esta versão. Tente novamente mais tarde.'
  } finally {
    exportingFormat.value = null
  }
}

const processSteps = ['Ingestão', 'Validação', 'Tratamento', 'Publicação']

const progressStepIndex = computed(() => {
  if (!details.value) return 1
  if (details.value.status === 'Concluída') return 5 // Todas concluídas
  const stage = details.value.stage === 'Cálculo analítico' ? 'Publicação' : details.value.stage
  const index = processSteps.indexOf(stage)
  return index >= 0 ? index + 1 : 1
})

const warningStepIndex = computed(() => {
  if (!details.value) return undefined
  const isErrorStage = details.value.stage === 'Validação' || details.value.stage === 'Tratamento'
  const isErrorStatus =
    details.value.status === 'Falhou' || details.value.status === 'Aguardando validação'
  if (isErrorStage && isErrorStatus && !details.value.assignedEditor) {
    return processSteps.indexOf(details.value.stage) + 1
  }
  return undefined
})

const activeStepIndex = ref(1)
const isQuarantineMode = ref(false)
const selectedQuarantineStage = ref('')

const loadData = async (idToLoad: string) => {
  isLoading.value = true
  try {
    // 1. Verifica se o ID corresponde a uma das cargas do mock de auditoria
    const foundCarga = mockAuditCargas.find(
      (c) =>
        c.id.toLowerCase() === idToLoad.toLowerCase() ||
        c.versions.some((v) => v.id.toLowerCase() === idToLoad.toLowerCase()),
    )

    if (foundCarga) {
      currentCarga.value = foundCarga
      auditVersions.value = foundCarga.versions

      // Se o ID for de uma versão específica, seleciona ela; caso contrário, a primeira (mais recente)
      const targetVersion =
        foundCarga.versions.find((v) => v.id.toLowerCase() === idToLoad.toLowerCase()) ||
        foundCarga.versions[0]

      if (!targetVersion) {
        details.value = null
        currentCarga.value = null
        auditVersions.value = []
        return
      }

      details.value = targetVersion
      activeStepIndex.value = progressStepIndex.value > 4 ? 4 : progressStepIndex.value
      selectedQuarantineStage.value = targetVersion.stage
      isAuditOpen.value = true
      await loadTraceability(idToLoad, false)
      return
    }

    // 2. Fallback para o processService padrão caso não seja mock de auditoria
    auditVersions.value = []
    currentCarga.value = null
    isAuditOpen.value = false
    details.value = await processService.getProcessDetails(idToLoad)
    activeStepIndex.value = progressStepIndex.value > 4 ? 4 : progressStepIndex.value
    if (details.value) {
      selectedQuarantineStage.value = details.value.stage
    }
    await loadTraceability(idToLoad, details.value?.dataSource === 'API')
  } catch (e) {
    console.error('Erro ao carregar detalhes do processo:', e)
  } finally {
    isLoading.value = false
  }
}

watch(
  () => props.detailsData,
  async (newVal) => {
    if (newVal) {
      details.value = newVal
      isLoading.value = false
      activeStepIndex.value = progressStepIndex.value > 4 ? 4 : progressStepIndex.value
      selectedQuarantineStage.value = newVal.stage
      isQuarantineMode.value = false
      await loadTraceability(newVal.id, newVal.dataSource === 'API')
    }
  },
  { immediate: true },
)

watch(
  () => processId.value,
  (newId) => {
    if (newId && !props.detailsData) {
      loadData(newId)
    }
  },
)

onMounted(async () => {
  if (props.detailsData) {
    details.value = props.detailsData
    isLoading.value = false
    activeStepIndex.value = progressStepIndex.value > 4 ? 4 : progressStepIndex.value
    selectedQuarantineStage.value = props.detailsData.stage
    await loadTraceability(props.detailsData.id, props.detailsData.dataSource === 'API')
    return
  }

  if (processId.value) {
    await loadData(processId.value)
  } else {
    isLoading.value = false
  }
})

const handleStepClick = (index: number) => {
  activeStepIndex.value = index
  isQuarantineMode.value = false
}

const openQuarantine = () => {
  isQuarantineMode.value = true
}

const handleVersionChange = (newVersion: ProcessVersion) => {
  details.value = newVersion
  activeStepIndex.value = progressStepIndex.value > 4 ? 4 : progressStepIndex.value
  selectedQuarantineStage.value = newVersion.stage
  isQuarantineMode.value = false
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/auditoria')
  }
}

const currentComponent = computed(() => {
  switch (activeStepIndex.value) {
    case 1:
      return ProcessStageIngestao
    case 2:
      return ProcessStageValidacao
    case 3:
      return ProcessStageTratamento
    case 4:
      return ProcessStagePublicacao
    default:
      return ProcessStageIngestao
  }
})
</script>

<template>
  <div class="process-log-page" :class="{ 'has-audit-open': isAuditOpen && auditVersions.length > 0 }">
    <!-- Coluna Principal com a Visualização do Processo -->
    <div class="process-main-column">
      <div class="process-header">
        <div class="process-nav-row">
          <div class="process-nav-left">
            <button class="btn btn_outline btn-sm btn-back" @click="goBack" title="Voltar para tela anterior">
              &larr; Voltar
            </button>
            <h2 class="process-title">
              Detalhes da Carga {{ currentCargaId }}
              <span v-if="details" class="status-badge" :class="details.status.toLowerCase().replace(/\s+/g, '-')">
                {{ details.status }}
              </span>
            </h2>
          </div>

          <!-- Botão para alternar a exibição da Auditoria (se disponível) -->
          <div v-if="isBackendProcess || auditVersions.length > 0" class="process-nav-right">
            <div class="process-actions">
              <template v-if="isBackendProcess">
                <button class="btn btn_outline btn-sm" :disabled="!!exportingFormat" @click="exportIndicator('geojson')">
                  {{ exportingFormat === 'geojson' ? 'Exportando…' : 'Exportar GeoJSON' }}
                </button>
                <button class="btn btn_outline btn-sm" :disabled="!!exportingFormat" @click="exportIndicator('csv')">
                  {{ exportingFormat === 'csv' ? 'Exportando…' : 'Exportar CSV' }}
                </button>
              </template>
              <button
                v-if="auditVersions.length > 0"
                class="btn btn_outline btn-sm audit-toggle-btn"
                :class="{ 'btn-active': isAuditOpen }"
                @click="isAuditOpen = !isAuditOpen"
              >
                <svg class="audit-icon" viewBox="0 0 24 24" width="16" height="16" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M12 7v5l4 2" />
                </svg>
                <span class="audit-label">{{ isAuditOpen ? 'Ocultar Auditoria' : 'Auditoria de Versões' }}</span>
                <span class="audit-count-badge">{{ auditVersions.length }}</span>
              </button>
            </div>
          </div>
        </div>

        <Stepper
          :currentStep="activeStepIndex"
          :progressStep="progressStepIndex"
          :warningStep="warningStepIndex"
          :steps="processSteps"
          @step-click="handleStepClick"
        />
      </div>

      <main class="page-content">
        <div v-if="exportError" class="traceability-error" role="alert">{{ exportError }}</div>
        <div v-if="isClosed" class="closed-version-banner" role="status">
          Versão histórica fechada. O conteúdo está disponível somente para consulta.
        </div>
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Carregando informações da carga...</p>
        </div>

        <div v-else-if="details" class="details-container">
          <!-- Visão de Quarentena (Desvio Lateral) -->
          <div v-if="isQuarantineMode" class="quarantine-view tab-content">
            <div class="card card-content">
              <div class="quarantine-header">
                <h2>Zona de Quarentena</h2>
                <button class="btn btn_outline" @click="isQuarantineMode = false">
                  Voltar ao Fluxo
                </button>
              </div>

              <div class="quarantine-body">
              <ProcessStageQuarentena v-if="details" :details="details" :read-only="isClosed" />
              </div>
            </div>
          </div>

          <!-- Visão Normal -->
          <div v-else class="tab-content">
            <component :is="currentComponent" :details="details" :read-only="isClosed" @open-quarantine="openQuarantine" />
          </div>

          <section v-if="isBackendProcess" class="traceability-card" aria-labelledby="traceability-heading">
            <div class="traceability-heading">
              <div>
                <p class="traceability-eyebrow">US05 · Rastreabilidade</p>
                <h3 id="traceability-heading">Origem do indicador</h3>
              </div>
              <span v-if="traceability" class="traceability-id">Processo {{ traceability.processoId }}</span>
            </div>
            <p v-if="isTraceabilityLoading" class="traceability-state" role="status">Carregando linhagem do arquivo…</p>
            <p v-else-if="traceabilityError" class="traceability-state traceability-error" role="alert">{{ traceabilityError }}</p>
            <dl v-else-if="traceability" class="traceability-grid">
              <div><dt>Arquivo original</dt><dd>{{ traceability.nomeArquivoOriginal }}</dd></div>
              <div><dt>ID do arquivo</dt><dd>{{ traceability.arquivoOriginalId }}</dd></div>
              <div><dt>Data da carga</dt><dd>{{ traceability.dataCarga || '—' }}</dd></div>
              <div><dt>Parâmetros</dt><dd>{{ traceability.parametrosProcessamento || '—' }}</dd></div>
              <div class="traceability-hash"><dt>Hash SHA-256</dt><dd>{{ traceability.hashSha256 || '—' }}</dd></div>
            </dl>
          </section>
        </div>

        <div v-else class="loading-state">
          <p>Não foi possível carregar os detalhes da carga.</p>
        </div>
      </main>
    </div>

    <!-- Componente Auditoria (Usado como painel lateral opcional) -->
    <div v-if="isAuditOpen && auditVersions.length > 0" class="audit-side-wrapper">
      <Auditoria
        :versions="auditVersions"
        :selectedVersionId="details?.id"
        :cargaId="currentCarga?.id"
        :cargaDataset="details?.dataset"
        :layerName="details?.layerName"
        :canClose="true"
        @select-version="handleVersionChange"
        @close="isAuditOpen = false"
      />
    </div>
  </div>
</template>

<style scoped>
.process-log-page {
  display: flex;
  margin: -32px;
  height: calc(100% + 64px);
  background-color: var(--color-background);
  position: relative;
  overflow: hidden;
}

.process-main-column {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.audit-side-wrapper {
  width: clamp(300px, 28vw, 380px);
  flex-shrink: 0;
  background: var(--color-surface);
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.04);
  animation: slideIn 0.25s ease;
}

.audit-side-wrapper > :deep(.locations-panel) {
  flex: 1;
  width: 100%;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.process-header {
  padding: 2rem 2rem 1rem 2rem;
  border-bottom: 1px solid var(--color-border);
}

.process-nav-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.process-nav-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1 1 320px;
  min-width: 0;
}

.process-nav-right {
  flex-shrink: 0;
  margin-left: auto;
}

.process-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn-back {
  white-space: nowrap;
  flex-shrink: 0;
}

.process-title {
  margin: 0;
  color: var(--color-heading);
  font-size: 1.4rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  min-width: 0;
  word-break: break-word;
}

.has-audit-open .process-title {
  font-size: 1.2rem;
}

.has-audit-open .process-header,
.has-audit-open .page-content {
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.status-badge {
  font-size: 0.85rem;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
  font-weight: 600;
}

.status-badge.concluída,
.status-badge.concluida {
  color: #16a34a;
  border-color: rgba(22, 163, 74, 0.3);
}

.status-badge.em-andamento {
  color: #d97706;
  border-color: rgba(217, 119, 6, 0.3);
}

.status-badge.aguardando-validação,
.status-badge.aguardando-validacao {
  color: #0284c7;
  border-color: rgba(2, 132, 199, 0.3);
}

.status-badge.falhou {
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.3);
}

.status-badge.fechado {
  color: #713f12;
  border-color: #f59e0b;
  background: #fef3c7;
}

.audit-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.audit-toggle-btn.btn-active {
  background: var(--vis-brand-orange);
  border-color: var(--vis-brand-orange);
  color: #fff;
}

.audit-icon {
  flex-shrink: 0;
  display: block;
}

.audit-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  font-size: 0.72rem;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--vis-brand-orange);
  color: #fff;
}

.audit-toggle-btn.btn-active .audit-count-badge {
  background: #fff;
  color: var(--vis-brand-orange);
}

.page-content {
  padding: 2rem;
  flex-grow: 1;
}

.traceability-card {
  margin-top: 1.25rem;
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.traceability-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--color-border);
}

.traceability-heading h3 { margin: 0; color: var(--color-heading); font-size: 1rem; }
.traceability-eyebrow { margin: 0 0 4px; color: var(--vis-brand-orange); font-size: .68rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.traceability-id { color: var(--vis-c-text-dark-2); font-size: .78rem; }
.traceability-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 20px; margin: 1rem 0 0; }
.traceability-grid div { min-width: 0; }
.traceability-grid dt { margin-bottom: 4px; color: var(--vis-c-text-dark-2); font-size: .72rem; font-weight: 700; }
.traceability-grid dd { margin: 0; color: var(--color-heading); font-size: .82rem; overflow-wrap: anywhere; }
.traceability-hash { grid-column: 1 / -1; }
.traceability-state { margin: 1rem 0 0; color: var(--vis-c-text-dark-2); font-size: .84rem; }
.traceability-error { color: var(--vis-c-danger); }
.closed-version-banner { margin-bottom: 1rem; padding: 11px 14px; color: #713f12; background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; font-size: .84rem; font-weight: 700; }

.details-container {
  max-width: 1200px;
  margin: 0 auto;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card {
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.card-content {
  padding: 1.5rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  gap: 1rem;
}

.quarantine-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.quarantine-header h2 {
  color: var(--color-heading);
  margin: 0;
}

@media (max-width: 1024px) {
  .process-log-page.has-audit-open {
    flex-direction: column;
    height: auto;
    overflow: visible;
  }
  .has-audit-open .process-main-column {
    overflow: visible;
  }
  .audit-side-wrapper {
    width: 100%;
    height: auto;
    border-top: 1px solid var(--color-border);
  }
}

@media (max-width: 760px) {
  .process-log-page {
    margin: -20px -16px;
    height: calc(100% + 40px);
  }
  .traceability-grid { grid-template-columns: 1fr; }
  .traceability-hash { grid-column: auto; }
}
</style>
