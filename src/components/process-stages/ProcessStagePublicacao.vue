<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  FiAlertTriangle,
  FiSearch,
  FiThumbsDown,
  FiDatabase,
  FiCheck,
  FiAward,
  FiArrowLeft,
  FiRotateCcw,
} from 'vue-icons-plus/fi'
import type { ProcessLogDetails } from '../../services/process'

const props = defineProps<{
  details: ProcessLogDetails
}>()

const emit = defineEmits<{
  (e: 'open-quarantine'): void
}>()

const router = useRouter()

// ── Estados locais de decisão do auditor ──────────────────────────────────────
const isApproved = ref(false)
const isRejected = ref(false)
const reviewNote = ref('')
const showReviewInput = ref(false)
const targetAuditStage = ref<'Tratamento' | 'Validação'>('Tratamento')

// ── Computeds de estado ────────────────────────────────────────────────────────
// Publicação NÃO tem erro intrínseco: apenas espera validação para publicar
const isAlreadyPublished = computed(() => props.details.status === 'Concluída')
/** Aprovado nesta sessão pelo auditor */
const isJustApproved = computed(() => isApproved.value && !isAlreadyPublished.value)
/** Exibe o card de sucesso apenas ao aprovar e publicar nesta sessão */
const showSuccess = computed(() => isJustApproved.value)
/** Exibe painel de decisão: processo em andamento esperando validação do auditor */
const isAwaiting = computed(
  () =>
    props.details.status === 'Em andamento' &&
    !isAlreadyPublished.value &&
    !isApproved.value &&
    !isRejected.value &&
    !showReviewInput.value,
)

/** Dados analíticos vêm da API via details.analyticsData */
const extractedData = computed(() => props.details.analyticsData ?? [])

// ── Handlers ───────────────────────────────────────────────────────────────────
const handleApprove = () => {
  isApproved.value = true
  isRejected.value = false
  showReviewInput.value = false
  props.details.status = 'Concluída'
  props.details.stage = 'Publicação'
}

const handleRejectRequest = () => {
  showReviewInput.value = true
}

const handleConfirmReject = () => {
  isRejected.value = true
  isApproved.value = false
  showReviewInput.value = false

  // Envia para auditoria da etapa anterior selecionada (Tratamento ou Validação)
  props.details.stage = targetAuditStage.value
  props.details.status = 'Em andamento'
  props.details.assignedEditor = 'Gestor Alocado'
  props.details.pauseReason = `Revisão solicitada na Publicação para ${targetAuditStage.value}: ${reviewNote.value || 'Necessário ajuste manual nos dados.'}`
}

const handleUndo = () => {
  isRejected.value = false
  isApproved.value = false
  showReviewInput.value = false
  reviewNote.value = ''
  props.details.stage = 'Publicação'
  props.details.status = 'Em andamento'
}

const goToDashboard = () => {
  router.push({ name: 'dashboard' })
}
</script>

<template>
  <div class="stage-container">
    <template v-if="!showSuccess">
      <!-- ═══ TABELA: DADOS EXTRAÍDOS ════════════════════════════════════════════ -->
      <div class="card">
        <div class="card-header">
          <div class="header-left">
            <h3>Dados Extraídos</h3>
            <p class="header-desc">
              Resultados do cálculo analítico gerado automaticamente pelo backend.
            </p>
          </div>
          <span class="badge success">Cálculo Concluído</span>
        </div>
        <div class="card-body p-0">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Parâmetro / Algoritmo</th>
                  <th>Resultado</th>
                  <th>Referência (Lei)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in extractedData" :key="row.param">
                  <td>{{ row.param }}</td>
                  <td class="result-cell">{{ row.result }}</td>
                  <td class="ref-cell">{{ row.reference }}</td>
                  <td>
                    <span class="badge-sm" :class="row.status">{{ row.statusLabel }}</span>
                  </td>
                </tr>
                <tr v-if="extractedData.length === 0">
                  <td colspan="4" class="empty-row">Nenhum dado analítico disponível ainda.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ═══ PAINEL DE DECISÃO: aguardando auditor ══════════════════════════════ -->
      <div v-if="isAwaiting" class="action-panel">
        <div class="action-content">
          <div class="action-icon-wrap">
            <FiSearch size="22" />
          </div>
          <div class="action-text">
            <h3>Revisão do Gestor</h3>
            <p>
              Os dados foram processados e validados com sucesso. Deseja aprovar e consolidar na
              base de produção?
            </p>
          </div>
        </div>
        <div class="action-buttons">
          <button class="btn btn-outline-danger" @click="handleRejectRequest">
            <FiThumbsDown size="15" />
            Solicitar Revisão
          </button>
          <button class="btn btn-primary" @click="handleApprove">
            <FiCheck size="15" />
            Aprovar e Publicar
          </button>
        </div>
      </div>

      <!-- ═══ INPUT DE NOTA DE REVISÃO / AUDITORIA DE ETAPA ANTERIOR ═════════ -->
      <div v-if="showReviewInput" class="review-input-panel">
        <h4>Solicitar Revisão de Etapa Anterior</h4>
        <p>
          Selecione a etapa anterior que necessita de revisão e informe o motivo. O editor deverá
          corrigir e re-enviar o arquivo.
        </p>

        <div style="margin-bottom: 0.85rem">
          <label
            style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 0.35rem"
          >
            Etapa a ser auditada:
          </label>
          <select v-model="targetAuditStage" class="input" style="max-width: 250px">
            <option value="Tratamento">Tratamento</option>
            <option value="Validação">Validação</option>
          </select>
        </div>

        <textarea
          v-model="reviewNote"
          class="review-textarea"
          placeholder="Ex: Identificado conflito de geometria nos polígonos. Necessário ajuste manual pelo editor..."
          rows="3"
        />
        <div class="review-actions">
          <button class="btn btn-ghost" @click="showReviewInput = false">Cancelar</button>
          <button class="btn btn-outline-danger" @click="handleConfirmReject">
            <FiThumbsDown size="15" />
            Confirmar e Enviar para Revisão
          </button>
        </div>
      </div>

      <!-- ═══ REVISÃO ENVIADA (rejeitado nesta sessão) ════════════════════════════ -->
      <div v-if="isRejected" class="alert-banner danger">
        <div class="alert-icon-lg">
          <FiAlertTriangle size="26" />
        </div>
        <div class="alert-text">
          <strong>Revisão Solicitada para a etapa de {{ targetAuditStage }}</strong>
          <p>
            O processo foi encaminhado para revisão de <strong>{{ targetAuditStage }}</strong> com
            gestor alocado. Status atualizado para <strong>Em andamento</strong>.
            <span v-if="reviewNote"
              ><br /><em>Instruções ao editor: {{ reviewNote }}</em></span
            >
          </p>
        </div>
        <button class="btn-ghost-small" @click="handleUndo">
          <FiRotateCcw size="13" />
          Desfazer
        </button>
      </div>
    </template>

    <!-- ═══ SUCESSO: publicado (nesta sessão) ════════ -->
    <div v-if="showSuccess" class="success-card">
      <div class="success-content">
        <div class="success-icon-wrap">
          <FiAward size="40" />
        </div>
        <h3>Carga Publicada com Sucesso!</h3>
        <p>
          Os dados espaciais e tabulares já estão disponíveis no banco de produção e visíveis nos
          dashboards de negócio.
        </p>
        <div class="success-meta">
          <span>
            <FiDatabase size="13" style="vertical-align: middle; margin-right: 4px" />
            <strong>Tabela:</strong> geo_imoveis_producao
          </span>
          <span class="meta-divider">•</span>
          <span><strong>Registros:</strong> {{ extractedData.length }} indicadores</span>
        </div>

        <!-- Ações pós-publicação -->
        <div class="success-actions">
          <button class="btn btn-outline-danger" @click="handleRejectRequest">
            <FiThumbsDown size="15" />
            Solicitar Revisão
          </button>
          <button class="btn btn-primary" @click="goToDashboard">
            <FiArrowLeft size="15" />
            Ver no Dashboard
          </button>
        </div>

        <!-- Input de revisão pós-publicação -->
        <div v-if="showReviewInput" class="post-publish-review">
          <h4>Motivo da Revisão</h4>
          <textarea
            v-model="reviewNote"
            class="review-textarea"
            placeholder="Descreva o que precisa ser revisado..."
            rows="3"
          />
          <div class="review-actions">
            <button class="btn btn-ghost" @click="showReviewInput = false">Cancelar</button>
            <button class="btn btn-outline-danger" @click="handleConfirmReject">
              <FiThumbsDown size="15" />
              Confirmar e Enviar ao Editor
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ ERRO / QUARENTENA (DESVIO LATERAL) ══════════════════════════════════ -->
    <div v-if="isError && details.pauseReason" class="alert-banner danger">
      <div class="alert-icon-lg">
        <FiAlertTriangle size="26" />
      </div>
      <div class="alert-text">
        <strong>Registros em Quarentena — Publicação Bloqueada</strong>
        <p>{{ details.pauseReason }}</p>
        <p style="font-size: 0.82rem; margin-top: 0.35rem; opacity: 0.7">
          Os registros rejeitados foram desviados para a quarentena. O editor deve corrigir o
          arquivo e subir novamente.
        </p>
      </div>
      <button class="btn-warning-outline" @click="emit('open-quarantine')">
        <FiAlertTriangle size="14" />
        Ver Quarentena
      </button>
    </div>
  </div>
</template>

<style scoped>
.stage-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* CARD */
.card {
  background: var(--color-surface);
  border-radius: 12px;
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  gap: 1rem;
}

.header-left h3 {
  margin: 0 0 0.25rem 0;
  color: var(--color-heading);
  font-size: 1.15rem;
}

.header-desc {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.6;
  color: var(--color-text);
}

.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.card-body.p-0 {
  padding: 0;
}

/* TABLE */
.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.data-table th,
.data-table td {
  padding: 0.9rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.9rem;
}

.data-table th {
  background: var(--color-background);
  font-weight: 600;
  color: var(--color-text);
  opacity: 0.8;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.data-table td {
  color: var(--color-text);
}
.result-cell {
  font-weight: 600;
  color: var(--color-heading) !important;
}
.ref-cell {
  font-size: 0.82rem !important;
  opacity: 0.7;
}

.empty-row {
  text-align: center;
  opacity: 0.5;
  font-style: italic;
  padding: 2rem !important;
}

/* BADGES */
.badge {
  padding: 0.3rem 0.75rem;
  border-radius: 50px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge.success {
  background: rgba(22, 163, 74, 0.12);
  color: #16a34a;
  border: 1px solid rgba(22, 163, 74, 0.25);
}

.badge-sm {
  padding: 0.2rem 0.6rem;
  border-radius: 50px;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-block;
}

.badge-sm.success {
  background: rgba(22, 163, 74, 0.12);
  color: #16a34a;
}
.badge-sm.error {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}
.badge-sm.warning {
  background: rgba(234, 179, 8, 0.12);
  color: #92400e;
}

/* ACTION PANEL */
.action-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
  background: var(--color-surface);
  border: 2px solid var(--vis-brand-orange, #f26522);
  border-radius: 12px;
  padding: 1.75rem 2rem;
  box-shadow: 0 4px 20px rgba(242, 101, 34, 0.08);
}

.action-content {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex: 1;
}

.action-icon-wrap {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: rgba(242, 101, 34, 0.1);
  color: var(--vis-brand-orange, #f26522);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-text h3 {
  margin: 0 0 0.4rem 0;
  color: var(--color-heading);
  font-size: 1.1rem;
}

.action-text p {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.75;
  color: var(--color-text);
  max-width: 480px;
}

.action-buttons {
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
}

/* REVIEW INPUT */
.review-input-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.review-input-panel h4 {
  margin: 0;
  color: var(--color-heading);
}

.review-input-panel p {
  margin: 0;
  font-size: 0.88rem;
  opacity: 0.7;
  color: var(--color-text);
}

.review-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.9rem;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.review-textarea:focus {
  outline: none;
  border-color: var(--vis-brand-orange, #f26522);
}

.review-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* ALERT BANNER */
.alert-banner {
  display: flex;
  align-items: flex-start;
  padding: 1.25rem 1.5rem;
  border-radius: 10px;
  gap: 1rem;
  border-left: 5px solid;
}

.alert-banner.danger {
  background: rgba(220, 53, 69, 0.06);
  border-color: #dc3545;
  border-right: 1px solid rgba(220, 53, 69, 0.2);
  border-top: 1px solid rgba(220, 53, 69, 0.2);
  border-bottom: 1px solid rgba(220, 53, 69, 0.2);
}

.alert-icon-lg {
  flex-shrink: 0;
  color: #dc3545;
  padding-top: 0.1rem;
}

.alert-text {
  flex-grow: 1;
}

.alert-text strong {
  display: block;
  font-size: 1rem;
  color: var(--color-heading);
  margin-bottom: 0.3rem;
}

.alert-text p {
  margin: 0;
  font-size: 0.88rem;
  opacity: 0.8;
  color: var(--color-text);
}

/* SUCCESS CARD */
.success-card {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(22, 163, 74, 0.3);
}

.success-content {
  padding: 3rem 2rem;
  background: linear-gradient(135deg, rgba(22, 163, 74, 0.06) 0%, var(--color-surface) 100%);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.success-icon-wrap {
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  background: rgba(22, 163, 74, 0.12);
  color: #16a34a;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
  border: 2px solid rgba(22, 163, 74, 0.2);
}

.success-content h3 {
  color: #16a34a;
  font-size: 1.6rem;
  margin: 0 0 0.75rem 0;
}

.success-content p {
  color: var(--color-text);
  max-width: 500px;
  font-size: 0.95rem;
  opacity: 0.8;
  margin: 0;
}

.success-meta {
  margin-top: 1.5rem;
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  background: rgba(22, 163, 74, 0.06);
  padding: 0.75rem 1.5rem;
  border-radius: 50px;
  font-size: 0.88rem;
  color: var(--color-text);
  border: 1px solid rgba(22, 163, 74, 0.2);
}

.meta-divider {
  opacity: 0.4;
}

.success-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.post-publish-review {
  width: 100%;
  max-width: 560px;
  margin-top: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.25rem;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.post-publish-review h4 {
  margin: 0;
  color: var(--color-heading);
  font-size: 0.95rem;
}

/* BUTTONS */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.65rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--vis-brand-orange, #f26522);
  color: #fff;
}

.btn-primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-outline-danger {
  background: transparent;
  border: 1.5px solid #dc3545;
  color: #dc3545;
}

.btn-outline-danger:hover {
  background: #dc3545;
  color: #fff;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.btn-ghost:hover {
  background: var(--color-background);
}

.btn-ghost-small {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: transparent;
  border: 1px solid rgba(220, 53, 69, 0.3);
  color: #dc3545;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  flex-shrink: 0;
  align-self: center;
  transition: all 0.2s;
}

.btn-ghost-small:hover {
  background: rgba(220, 53, 69, 0.08);
}

.btn-warning-outline {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  border: 1px solid rgba(234, 179, 8, 0.5);
  color: #92400e;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  flex-shrink: 0;
  align-self: center;
  transition: all 0.2s;
}

.btn-warning-outline:hover {
  background: #f59e0b;
  color: #fff;
}
</style>
