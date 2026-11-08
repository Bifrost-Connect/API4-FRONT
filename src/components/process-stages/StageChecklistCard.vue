<script setup lang="ts">
/**
 * Componente reutilizável para exibição do checklist e status das etapas
 * de processamento (Validação e Tratamento).
 * Evita a duplicação de layout de card, itens de verificação, ícones e alertas.
 */
import { computed } from 'vue'
import { FiCheckCircle, FiXCircle, FiClock, FiAlertTriangle } from 'vue-icons-plus/fi'
import type { ProcessStageCheck } from '../../services/process'

const props = withDefaults(
  defineProps<{
    title: string
    description: string
    checks?: ProcessStageCheck[]
    statusLabel: string
    statusClass?: 'success' | 'warning' | 'error' | 'pending'
    showQuarantineButton?: boolean
    quarantineMessage?: string
  }>(),
  {
    checks: () => [],
    statusClass: 'success',
    showQuarantineButton: false,
    quarantineMessage: '',
  },
)

const emit = defineEmits<{
  (e: 'open-quarantine'): void
}>()
</script>

<template>
  <div class="card checklist-card">
    <!-- Cabeçalho do Card da Etapa -->
    <div class="card-header">
      <div class="header-left">
        <h3>{{ title }}</h3>
        <p class="header-desc">{{ description }}</p>
      </div>
      <div class="header-right">
        <span class="badge" :class="statusClass">{{ statusLabel }}</span>
        <button
          v-if="showQuarantineButton"
          type="button"
          class="btn btn-warning"
          @click="emit('open-quarantine')"
        >
          <FiAlertTriangle size="14" />
          Ver Quarentena
        </button>
      </div>
    </div>

    <!-- Lista de Verificações Automáticas -->
    <div class="card-body">
      <ul class="checklist">
        <li
          v-for="check in checks"
          :key="check.id"
          class="checklist-item"
          :class="check.status"
        >
          <div class="check-icon" :class="check.status">
            <FiCheckCircle v-if="check.status === 'success'" size="18" />
            <FiXCircle v-else-if="check.status === 'error'" size="18" />
            <FiClock v-else size="18" />
          </div>
          <div class="check-body">
            <strong>{{ check.label }}</strong>
            <span class="check-desc">{{ check.description }}</span>
            <span class="check-detail" :class="check.status">{{ check.detail }}</span>
          </div>
          <span class="check-badge" :class="check.status">
            {{
              check.status === 'success' ? 'OK' : check.status === 'error' ? 'Erro' : 'Pendente'
            }}
          </span>
        </li>
      </ul>

      <!-- Alerta de Registros em Quarentena -->
      <div v-if="quarantineMessage" class="error-alert">
        <div class="alert-icon">
          <FiAlertTriangle size="22" />
        </div>
        <div class="alert-content">
          <strong>Registros em Quarentena (Desvio Lateral)</strong>
          <p>{{ quarantineMessage }}</p>
          <p class="error-hint">
            O arquivo original ou as feições rejeitadas requerem saneamento/reprocessamento.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checklist-card {
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

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.checklist {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  transition: background 0.2s;
}

.checklist-item.success {
  border-color: var(--badge-success-border);
  background: var(--badge-success-bg);
}

.checklist-item.error {
  border-color: var(--badge-danger-border);
  background: var(--badge-danger-bg);
}

.checklist-item.pending {
  border-color: var(--badge-warning-border);
  background: var(--badge-warning-bg);
}

.check-icon {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.check-icon.success {
  color: var(--badge-success-text);
  background: var(--badge-success-bg);
}

.check-icon.error {
  color: var(--badge-danger-text);
  background: var(--badge-danger-bg);
}

.check-icon.pending {
  color: var(--badge-warning-text);
  background: var(--badge-warning-bg);
}

.check-body {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.check-body strong {
  font-size: 0.95rem;
  color: var(--color-heading);
}

.check-desc {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.check-detail {
  font-size: 0.85rem;
  font-weight: 500;
  margin-top: 0.1rem;
}

.check-detail.success {
  color: var(--badge-success-text);
}
.check-detail.error {
  color: var(--badge-danger-text);
}
.check-detail.pending {
  color: var(--badge-warning-text);
}

/* Badges */
.badge {
  padding: 0.3rem 0.75rem;
  border-radius: 50px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge.success {
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
  border: 1px solid var(--badge-success-border);
}

.badge.error {
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
  border: 1px solid var(--badge-danger-border);
}

.badge.warning,
.badge.pending {
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
  border: 1px solid var(--badge-warning-border);
}

.check-badge {
  flex-shrink: 0;
  padding: 0.2rem 0.6rem;
  border-radius: 50px;
  font-size: 0.75rem;
  font-weight: 700;
}

.check-badge.success {
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
  border: 1px solid var(--badge-success-border);
}
.check-badge.error {
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
  border: 1px solid var(--badge-danger-border);
}
.check-badge.pending {
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
  border: 1px solid var(--badge-warning-border);
}

/* Alerta de erro */
.error-alert {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  background: var(--badge-danger-bg);
  border: 1px solid var(--badge-danger-border);
  border-left: 4px solid var(--badge-danger-text);
}

.alert-icon {
  flex-shrink: 0;
  color: var(--badge-danger-text);
  padding-top: 0.1rem;
}

.alert-content strong {
  display: block;
  color: var(--badge-danger-text);
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
}

.alert-content p {
  margin: 0;
  font-size: 0.88rem;
  opacity: 0.8;
  color: var(--color-text);
}

.error-hint {
  font-size: 0.82rem;
  margin-top: 0.35rem;
  opacity: 0.7;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-warning {
  background-color: var(--badge-warning-bg);
  color: var(--badge-warning-text);
  border: 1px solid var(--badge-warning-border);
}

.btn-warning:hover {
  background-color: var(--badge-warning-text);
  color: #fff;
}
</style>

