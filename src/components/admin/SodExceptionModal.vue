<script setup lang="ts">
/**
 * Modal de Exceção Explícita de Segregação de Funções - Regra SoD (Tarefa 5).
 * Exibido quando um usuário acumula permissões de Ingestão de Carga (Operador)
 * e Homologação/Aprovação (Gestor).
 */
import { ref } from 'vue'
import { FiAlertTriangle, FiShield, FiX, FiCheck } from 'vue-icons-plus/fi'

const props = defineProps<{
  isOpen: boolean
  userName: string
  initialJustification?: string
}>()

const emit = defineEmits<{
  (e: 'confirm', justification: string): void
  (e: 'cancel'): void
}>()

const authorized = ref(false)
const justification = ref(props.initialJustification || '')
const touched = ref(false)

const handleConfirm = () => {
  touched.value = true
  if (!authorized.value || !justification.value.trim()) {
    return
  }
  emit('confirm', justification.value.trim())
}
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" data-testid="sod-modal" @click.self="$emit('cancel')">
    <div class="modal-dialog">
      <div class="modal-header">
        <div class="modal-title-group">
          <div class="alert-icon-wrapper" aria-hidden="true">
            <FiAlertTriangle size="22" />
          </div>
          <div>
            <h3>Conflito de Segregação de Funções (SoD)</h3>
            <p class="subtitle">Detecção de acúmulo de funções incompatíveis</p>
          </div>
        </div>
        <button type="button" class="btn-close" aria-label="Fechar" @click="$emit('cancel')">
          <FiX size="18" />
        </button>
      </div>

      <div class="modal-body">
        <div class="alert-banner-danger">
          <FiShield size="18" class="banner-icon" />
          <div>
            <strong>Atenção de Segurança e Governança:</strong>
            <p>
              O usuário <strong>{{ userName }}</strong> foi configurado com permissões simultâneas de
              <strong>Ingestão de Carga</strong> e <strong>Aprovação/Homologação</strong>.
              Este acúmulo viola a política estrita de segregação de funções operacionais.
            </p>
          </div>
        </div>

        <div class="audit-warning-box">
          <p>
            &bull; Todas as publicações e ações homologatórias executadas por este usuário
            gerarão <strong>alerta especial de auditoria permanente</strong> na trilha de segurança.
          </p>
        </div>

        <div class="form-group checkbox-group">
          <label class="checkbox-label" data-testid="sod-checkbox-label">
            <input
              type="checkbox"
              v-model="authorized"
              class="checkbox-input"
              data-testid="sod-authorize-checkbox"
            />
            <span class="checkbox-text">
              <strong>Autorizar Exceção de Segregação de Funções (SoD)</strong> sob responsabilidade da administração
            </span>
          </label>
        </div>

        <div class="form-group">
          <label for="sod-justification" class="form-label">
            Justificativa Obrigatória do Administrador:
            <span class="required">*</span>
          </label>
          <textarea
            id="sod-justification"
            v-model="justification"
            class="textarea"
            rows="3"
            placeholder="Descreva formalmente a razão técnica ou operacional para conceder esta exceção (ex.: cobrir plantão de safra)..."
            data-testid="sod-justification-input"
          ></textarea>
          <p v-if="touched && !justification.trim()" class="error-msg">
            A justificativa formal é obrigatória para autorizar uma exceção SoD.
          </p>
        </div>
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="btn btn_outline"
          data-testid="sod-cancel-btn"
          @click="$emit('cancel')"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn_danger"
          :disabled="!authorized || !justification.trim()"
          data-testid="sod-confirm-btn"
          @click="handleConfirm"
        >
          <FiCheck size="16" />
          <span>Confirmar Exceção SoD</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-dialog {
  max-width: 580px;
  width: 100%;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--color-border, #334155);
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 14px;
}

.alert-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-heading, #f8fafc);
}

.subtitle {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted, #94a3b8);
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted, #94a3b8);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.modal-body {
  padding: 20px 24px;
}

.alert-banner-danger {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
  font-size: 0.85rem;
  line-height: 1.4;
  margin-bottom: 16px;
}

.banner-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-banner-danger strong {
  color: #fca5a5;
  display: block;
  margin-bottom: 4px;
}

.alert-banner-danger p {
  margin: 0;
  color: #fecaca;
}

.audit-warning-box {
  padding: 10px 14px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 6px;
  color: #fbbf24;
  font-size: 0.8rem;
  margin-bottom: 20px;
}

.audit-warning-box p {
  margin: 0;
}

.form-group {
  margin-bottom: 16px;
}

.checkbox-group {
  padding: 12px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--color-border, #334155);
  border-radius: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #ef4444;
}

.checkbox-text {
  font-size: 0.86rem;
  color: var(--color-heading, #f8fafc);
}

.form-label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-heading, #f8fafc);
  margin-bottom: 6px;
}

.required {
  color: #ef4444;
}

.textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--color-background, #0f172a);
  border: 1px solid var(--color-border, #334155);
  color: var(--color-heading, #f8fafc);
  font-size: 0.86rem;
  resize: vertical;
  outline: none;
}

.textarea:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}

.error-msg {
  color: #ef4444;
  font-size: 0.78rem;
  margin: 4px 0 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 24px;
  border-top: 1px solid var(--color-border, #334155);
  background: rgba(15, 23, 42, 0.3);
}

.btn_danger {
  background: #dc2626;
  color: #fff;
  border: none;
  padding: 8px 18px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.86rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.btn_danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
