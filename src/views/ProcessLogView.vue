<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { processService, type ProcessLogDetails } from '../services/process'
import Stepper from '../components/Stepper.vue'
import ProcessStageIngestao from '../components/process-stages/ProcessStageIngestao.vue'
import ProcessStageValidacao from '../components/process-stages/ProcessStageValidacao.vue'
import ProcessStageTratamento from '../components/process-stages/ProcessStageTratamento.vue'
import ProcessStagePublicacao from '../components/process-stages/ProcessStagePublicacao.vue'
import ProcessStageQuarentena from '../components/process-stages/ProcessStageQuarentena.vue'

const route = useRoute()
const router = useRouter()

const processId = route.params.id as string
const isLoading = ref(true)
const details = ref<ProcessLogDetails | null>(null)

const processSteps = ['Ingestão', 'Validação', 'Tratamento', 'Publicação']

const progressStepIndex = computed(() => {
  if (!details.value) return 1
  if (details.value.status === 'Concluída') return 5 // Todas concluídas
  // Map old 'Cálculo analítico' and 'Publicação' both to step 4
  const stage = details.value.stage === 'Cálculo analítico' ? 'Publicação' : details.value.stage
  const index = processSteps.indexOf(stage)
  return index >= 0 ? index + 1 : 1
})

const warningStepIndex = computed(() => {
  if (!details.value) return undefined
  // Erros acontecem APENAS quando validação ou tratamento dá errado (sem editor alocado)
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

onMounted(async () => {
  try {
    details.value = await processService.getProcessDetails(processId)
    activeStepIndex.value = progressStepIndex.value > 4 ? 4 : progressStepIndex.value
    if (details.value) {
      selectedQuarantineStage.value = details.value.stage
    }
  } catch (e) {
    console.error(e)
  } finally {
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

const cancelLoad = () => {
  if (confirm('Tem certeza que deseja cancelar/invalidar esta carga?')) {
    if (details.value) {
      // Cast to any to bypass strict type if 'Invalidada' isn't in union
      details.value.status = 'Invalidada' as any
      details.value.pauseReason = 'Carga invalidada pelo operador'
    }
  }
}
</script>

<template>
  <div class="process-log-view">
    <div class="process-header">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0; color: var(--color-heading);">
          Detalhes da Carga {{ processId }}
          <span v-if="details" style="font-size: 0.9rem; margin-left: 0.5rem; padding: 0.2rem 0.6rem; border-radius: 4px; background: var(--color-surface); border: 1px solid var(--color-border);">
            {{ details.status }}
          </span>
        </h2>
        <button v-if="details" class="btn btn_outline" style="color: #dc2626; border-color: #dc2626;" @click="cancelLoad">
          Cancelar Carga
        </button>
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
        <p>Não foi possível carregar os detalhes.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.process-header {
  padding: 3rem 2rem 1rem 2rem;
}

.mb-4 {
  margin-bottom: 1.5rem;
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

.process-log-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--color-background);
}

.page-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.page-navbar h2 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--color-heading);
}

.btn-back {
  padding: 0.5rem 1rem;
}

.page-content {
  padding: 2rem;
  flex-grow: 1;
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

.input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: var(--color-background);
  color: var(--color-text);
}

.quarantine-info {
  background: rgba(234, 179, 8, 0.06);
  border: 1px solid rgba(234, 179, 8, 0.2);
  border-left: 4px solid #eab308;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.quarantine-info p {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: var(--color-text);
  line-height: 1.6;
}

.quarantine-info p:last-child {
  margin-bottom: 0;
}
</style>
