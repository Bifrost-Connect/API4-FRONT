<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { processService, type ProcessLogDetails } from '../services/process'
import Stepper from '../components/Stepper.vue'
import ProcessStageIngestao from '../components/process-stages/ProcessStageIngestao.vue'
import ProcessStageValidacao from '../components/process-stages/ProcessStageValidacao.vue'
import ProcessStageTratamento from '../components/process-stages/ProcessStageTratamento.vue'
import ProcessStageCalculo from '../components/process-stages/ProcessStageCalculo.vue'
import ProcessStagePublicacao from '../components/process-stages/ProcessStagePublicacao.vue'

const route = useRoute()
const router = useRouter()

const processId = route.params.id as string
const isLoading = ref(true)
const details = ref<ProcessLogDetails | null>(null)

const processSteps = ['Ingestão', 'Validação', 'Tratamento', 'Cálculo analítico', 'Publicação']

const progressStepIndex = computed(() => {
  if (!details.value) return 1
  const index = processSteps.indexOf(details.value.stage)
  return index >= 0 ? index + 1 : 1
})

const activeStepIndex = ref(1)

onMounted(async () => {
  try {
    details.value = await processService.getProcessDetails(processId)
    activeStepIndex.value = progressStepIndex.value
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
})

const handleStepClick = (index: number) => {
  activeStepIndex.value = index
}

const currentComponent = computed(() => {
  switch (activeStepIndex.value) {
    case 1: return ProcessStageIngestao
    case 2: return ProcessStageValidacao
    case 3: return ProcessStageTratamento
    case 4: return ProcessStageCalculo
    case 5: return ProcessStagePublicacao
    default: return ProcessStageIngestao
  }
})

</script>

<template>
  <div class="process-log-view">
    <div class="process-header">
      <Stepper
        :currentStep="activeStepIndex"
        :progressStep="progressStepIndex"
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
        <div class="tab-content">
          <component :is="currentComponent" :details="details" />
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
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
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
</style>
