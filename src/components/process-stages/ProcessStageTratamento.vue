<script setup lang="ts">
/**
 * Etapa 3 da Esteira: Tratamento e Padronização Cartográfica.
 * Exibe o Gate de Decisão do Gestor, as transformações de reprojeção
 * e schema aplicadas, e a pré-visualização geográfica das feições tratadas.
 */
import { computed } from 'vue'
import { FiAlertTriangle } from 'vue-icons-plus/fi'
import type { ProcessLogDetails } from '../../services/process'
import { getStepIndex } from '../../utils/processUtils'
import GateDecisaoGestor from '../GateDecisaoGestor.vue'
import ProcessoMiniMapa from '../ProcessoMiniMapa.vue'
import StageChecklistCard from './StageChecklistCard.vue'

const props = defineProps<{
  details: ProcessLogDetails
  readOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'open-quarantine'): void
  (e: 'reload'): void
}>()

/** Checks de tratamento vindos da API */
const checks = computed(() => props.details.treatmentChecks ?? [])

const isError = computed(
  () =>
    props.details.status === 'Falhou' ||
    props.details.status === 'Em quarentena' ||
    (props.details.quarantineRecords?.length ?? 0) > 0 ||
    checks.value.some((c) => c.status === 'error'),
)

const isUnderCorrection = computed(
  () => props.details.status === 'Em andamento' && !!props.details.assignedEditor,
)

/** Verifica se a etapa de Validação foi superada e o Tratamento foi liberado */
const isStageReached = computed(() => {
  if (props.details.status === 'Concluída') return true
  return getStepIndex(props.details) >= 3
})

/** Status geral resumido do tratamento */
const overallStatus = computed(() => {
  if (isUnderCorrection.value) {
    return { label: 'Em Correção (Editor Alocado)', cls: 'warning' as const }
  }
  const errorCount = checks.value.filter((c) => c.status === 'error').length
  const pendingCount = checks.value.filter((c) => c.status === 'pending').length
  if (errorCount > 0) {
    return { label: `${errorCount} Erro(s) Detectado(s)`, cls: 'error' as const }
  }
  if (pendingCount > 0) {
    return { label: 'Em Andamento', cls: 'pending' as const }
  }
  return { label: 'Concluído (Sem Erros)', cls: 'success' as const }
})
</script>

<template>
  <div class="stage-container">
    <!-- Bloqueio caso a etapa anterior ainda não tenha sido aprovada -->
    <div v-if="!isStageReached" class="card card-locked">
      <div class="locked-body">
        <FiAlertTriangle size="32" class="locked-icon" />
        <h4>Etapa Bloqueada</h4>
        <p>
          O Tratamento só estará disponível após a aprovação da etapa anterior (<strong>Validação</strong>) pelo Gestor.
        </p>
      </div>
    </div>

    <template v-else>
      <!-- Gate de Decisão do Gestor no Tratamento -->
      <GateDecisaoGestor
        :processo-id="details.id"
        etapa="TRATAMENTO"
        :read-only="readOnly"
        :current-status="details.status"
        :current-stage="details.stage"
        @decisao-registrada="emit('reload')"
      />

      <!-- Card de Verificações Automáticas Compartilhado -->
      <StageChecklistCard
        title="Tratamento"
        description="Transformações automáticas aplicadas aos dados para conformidade com o schema interno."
        :checks="checks"
        :status-label="overallStatus.label"
        :status-class="overallStatus.cls"
        :show-quarantine-button="isError || (details.quarantineRecords?.length ?? 0) > 0"
        :quarantine-message="(isError || (details.quarantineRecords?.length ?? 0) > 0) ? details.pauseReason : ''"
        @open-quarantine="emit('open-quarantine')"
      />

      <!-- Prévia cartográfica das feições tratadas -->
      <ProcessoMiniMapa
        v-if="details?.id"
        :processo-id="details.id"
        :is-published="false"
        :status="details.status"
        title="Prévia Cartográfica das Feições Tratadas (SIRGAS 2000)"
        height="300px"
      />
    </template>
  </div>
</template>

<style scoped>
.stage-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card-locked {
  padding: 3rem 2rem;
  text-align: center;
  background: rgba(239, 68, 68, 0.02);
  border: 1px dashed rgba(239, 68, 68, 0.3);
  border-radius: 12px;
}

.locked-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.locked-icon {
  color: #f59e0b;
}

.locked-body h4 {
  margin: 0;
  font-size: 1.15rem;
  color: var(--color-heading);
}

.locked-body p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text);
  opacity: 0.8;
  max-width: 500px;
}
</style>
