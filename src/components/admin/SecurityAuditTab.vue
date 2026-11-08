<script setup lang="ts">
/**
 * Aba 3: Painel de Auditoria de Segurança e Acessos (Tarefa 3).
 * Trilha imutável de eventos: criação de contas, trocas de cargo, inativações,
 * concessão de exceções SoD e bloqueios de acesso 403.
 */
import { ref, computed } from 'vue'
import {
  FiShield,
  FiSearch,
  FiFilter,
  FiAlertTriangle,
  FiClock,
  FiUser,
  FiLock,
} from 'vue-icons-plus/fi'
import type { SecurityEvent } from '@/mocks/user.mock'

const props = defineProps<{
  events: SecurityEvent[]
}>()

const searchQuery = ref('')
const selectedTypeFilter = ref('')

const filteredEvents = computed(() => {
  return props.events.filter((ev) => {
    const q = searchQuery.value.toLowerCase().trim()
    const matchesSearch =
      !q ||
      ev.action.toLowerCase().includes(q) ||
      ev.actorName.toLowerCase().includes(q) ||
      ev.actorEmail.toLowerCase().includes(q) ||
      ev.details.toLowerCase().includes(q)

    const matchesType = !selectedTypeFilter.value || ev.action.includes(selectedTypeFilter.value)

    return matchesSearch && matchesType
  })
})
</script>

<template>
  <div class="security-audit-tab" data-testid="security-audit-tab">
    <!-- Barra de Filtros da Auditoria -->
    <div class="card filter-card">
      <div class="filter-grid">
        <div class="search-box">
          <FiSearch class="search-icon" size="16" />
          <input
            v-model="searchQuery"
            type="text"
            class="input search-input"
            placeholder="Buscar por ação, responsável ou justificativa no log..."
            data-testid="audit-search-input"
          />
        </div>

        <div class="filter-selects">
          <div class="select-group">
            <FiFilter size="14" class="select-icon" />
            <select v-model="selectedTypeFilter" class="select" data-testid="filter-audit-type">
              <option value="">Todas as Ações</option>
              <option value="Criação">Criação de Contas</option>
              <option value="Troca">Trocas de Cargo</option>
              <option value="Inativação">Inativações</option>
              <option value="SoD">Exceções SoD</option>
              <option value="403">Bloqueios 403</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabela da Trilha Imutável -->
    <div class="card table-card">
      <div class="audit-table-wrap">
        <table class="audit-table" data-testid="security-audit-table">
          <thead>
            <tr>
              <th class="th-time">Data / Hora</th>
              <th class="th-actor">Responsável (Ator)</th>
              <th class="th-action">Ação Administrativa</th>
              <th class="th-details">Detalhes &amp; Justificativa</th>
              <th class="th-severity">Nível</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ev in filteredEvents" :key="ev.id" class="tr-event" data-testid="audit-event-row">
              <td class="td-time">
                <span class="time-text">
                  <FiClock size="12" class="time-icon" />
                  {{ ev.timestamp }}
                </span>
              </td>

              <td class="td-actor">
                <div class="actor-cell">
                  <div class="actor-avatar">
                    <FiUser size="12" />
                  </div>
                  <div>
                    <strong class="actor-name">{{ ev.actorName }}</strong>
                    <span class="actor-email">{{ ev.actorEmail }}</span>
                  </div>
                </div>
              </td>

              <td class="td-action">
                <span
                  class="action-badge"
                  :class="{
                    'badge-sod': ev.action.includes('SoD'),
                    'badge-403': ev.action.includes('403'),
                    'badge-warn': ev.action.includes('Inativação'),
                  }"
                >
                  <FiLock v-if="ev.action.includes('403')" size="12" />
                  <FiAlertTriangle v-else-if="ev.action.includes('SoD')" size="12" />
                  {{ ev.action }}
                </span>
              </td>

              <td class="td-details">
                <p class="details-text">{{ ev.details }}</p>
              </td>

              <td class="td-severity">
                <span
                  class="severity-pill"
                  :class="{
                    'sev-info': ev.severity === 'INFO',
                    'sev-warn': ev.severity === 'WARNING',
                    'sev-danger': ev.severity === 'DANGER',
                  }"
                >
                  {{ ev.severity }}
                </span>
              </td>
            </tr>

            <tr v-if="filteredEvents.length === 0">
              <td colspan="5" class="empty-cell">
                <FiShield size="32" class="empty-icon" />
                <p>Nenhum evento de segurança localizado para os filtros informados.</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.security-audit-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  padding: 16px 20px;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 10px;
}

.filter-grid {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 280px;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted, #94a3b8);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding-left: 40px;
  height: 40px;
  background: var(--color-background, #0f172a);
  border: 1px solid var(--color-border, #334155);
  border-radius: 8px;
  color: var(--color-heading, #f8fafc);
  font-size: 0.85rem;
  outline: none;
}

.search-input:focus {
  border-color: var(--color-brand, #f26522);
}

.filter-selects {
  display: flex;
  align-items: center;
  gap: 12px;
}

.select-group {
  position: relative;
  display: flex;
  align-items: center;
}

.select-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-muted, #94a3b8);
  pointer-events: none;
}

.select {
  height: 40px;
  padding: 0 12px 0 34px;
  background: var(--color-background, #0f172a);
  border: 1px solid var(--color-border, #334155);
  border-radius: 8px;
  color: var(--color-heading, #f8fafc);
  font-size: 0.85rem;
  outline: none;
  cursor: pointer;
}

.table-card {
  padding: 0;
  overflow: hidden;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 10px;
}

.audit-table-wrap {
  overflow-x: auto;
}

.audit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.audit-table th,
.audit-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border, #334155);
}

.audit-table th {
  background: var(--color-background, #0f172a);
  color: var(--color-heading, #f8fafc);
  font-weight: 700;
  text-align: left;
}

.time-text {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-text-muted, #94a3b8);
  font-size: 0.8rem;
  white-space: nowrap;
}

.time-icon {
  color: var(--color-text-muted, #64748b);
}

.actor-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.actor-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.actor-name {
  display: block;
  font-size: 0.84rem;
  color: var(--color-heading, #f8fafc);
}

.actor-email {
  display: block;
  font-size: 0.74rem;
  color: var(--color-text-muted, #94a3b8);
}

.action-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.badge-sod {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #ef4444;
}

.badge-403 {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #f59e0b;
}

.badge-warn {
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
}

.details-text {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-heading, #f8fafc);
  line-height: 1.4;
}

.severity-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.sev-info {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.sev-warn {
  background: rgba(245, 158, 11, 0.15);
  color: #facc15;
}

.sev-danger {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.empty-cell {
  text-align: center;
  padding: 48px 16px;
  color: var(--color-text-muted, #94a3b8);
}

.empty-icon {
  margin-bottom: 8px;
  color: var(--color-text-muted, #64748b);
}
</style>
