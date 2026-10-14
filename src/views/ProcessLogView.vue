<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { processService, type ProcessLogDetails } from '../services/process.ts'
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

const currentCargaId = computed(() => {
  return currentCarga.value?.id || details.value?.id || processId.value
})

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

      details.value = targetVersion
      activeStepIndex.value = progressStepIndex.value > 4 ? 4 : progressStepIndex.value
      selectedQuarantineStage.value = targetVersion.stage
      isAuditOpen.value = true
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
  } catch (e) {
    console.error('Erro ao carregar detalhes do processo:', e)
  } finally {
    isLoading.value = false
  }
}

watch(
  () => props.detailsData,
  (newVal) => {
    if (newVal) {
      details.value = newVal
      isLoading.value = false
      activeStepIndex.value = progressStepIndex.value > 4 ? 4 : progressStepIndex.value
      selectedQuarantineStage.value = newVal.stage
      isQuarantineMode.value = false
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
          <div v-if="auditVersions.length > 0" class="process-nav-right">
            <button
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

        <Stepper
          :currentStep="activeStepIndex"
          :progressStep="progressStepIndex"
          :warningStep="warningStepIndex"
          :steps="processSteps"
          @step-click="handleStepClick"
        />
      </div>

      <main class="page-content">
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
                <ProcessStageQuarentena v-if="details" :details="details" />
              </div>
            </div>
          </div>

          <!-- Visão Normal -->
          <div v-else class="tab-content">
            <component :is="currentComponent" :details="details" @open-quarantine="openQuarantine" />
          </div>
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
}
</style>
