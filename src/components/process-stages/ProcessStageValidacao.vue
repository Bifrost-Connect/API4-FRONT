<script setup lang="ts">
/**
 * Etapa 2 da Esteira: Validação dos Dados.
 * Exibe o Gate de Decisão do Gestor e as verificações automáticas
 * de conformidade de schema e topologia sobre os arquivos ingeridos.
 */
import { computed } from 'vue'
import type { ProcessLogDetails } from '../../services/process'
import GateDecisaoGestor from '../GateDecisaoGestor.vue'
import StageChecklistCard from './StageChecklistCard.vue'

const props = defineProps<{
  details: ProcessLogDetails
  readOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'open-quarantine'): void
  (e: 'reload'): void
}>()

/** Checks vindos da API */
const checks = computed(() => props.details.validationChecks ?? [])

/** Identifica ocorrência de erro ou retenção na validação */
const isQuarantine = computed(
  () =>
    props.details.status === 'Em quarentena' ||
    (props.details.quarantineRecords?.length ?? 0) > 0 ||
    checks.value.some((c) => c.status === 'error'),
)

const isUnderCorrection = computed(
  () => props.details.status === 'Em andamento' && !!props.details.assignedEditor,
)

/** Status geral resumido da validação */
const overallStatus = computed(() => {
  if (isUnderCorrection.value) {
    return { label: 'Em Correção (Editor Alocado)', cls: 'warning' as const }
  }
  const errorCount = checks.value.filter((c) => c.status === 'error').length
  if (errorCount > 0) {
    return { label: `${errorCount} Erro(s) Detectado(s)`, cls: 'error' as const }
  }
  if (props.details.status === 'Falhou') {
    return { label: 'Falhou', cls: 'error' as const }
  }
  if (isQuarantine.value) {
    return { label: 'Em Quarentena', cls: 'error' as const }
  }
  if (props.details.stage === 'Validação' && props.details.status === 'Em andamento') {
    return { label: 'Em Validação', cls: 'warning' as const }
  }
  return { label: 'Concluído (Sem Erros)', cls: 'success' as const }
})
</script>

<template>
  <div class="stage-container">
    <!-- Gate de Decisão do Gestor na Validação -->
    <GateDecisaoGestor
      :processo-id="details.id"
      etapa="VALIDACAO"
      :read-only="readOnly"
      :current-status="details.status"
      :current-stage="details.stage"
      @decisao-registrada="emit('reload')"
    />

    <!-- Card de Verificações Automáticas Compartilhado -->
    <StageChecklistCard
      title="Validação"
      description="Verificações automáticas executadas pelo backend sobre os dados ingeridos."
      :checks="checks"
      :status-label="overallStatus.label"
      :status-class="overallStatus.cls"
      :show-quarantine-button="isQuarantine"
      :quarantine-message="isQuarantine ? details.pauseReason : ''"
      @open-quarantine="emit('open-quarantine')"
    />
  </div>
</template>

<style scoped>
.stage-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>
