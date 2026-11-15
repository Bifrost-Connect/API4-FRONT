<script setup lang="ts">
/**
 * Aba 3: Painel de Auditoria de Segurança e Acessos (Tarefa 3).
 * Trilha imutável de eventos: criação de contas, trocas de cargo, inativações,
 * concessão de exceções SoD e bloqueios de acesso 403.
 */
import { ref, computed, watch, onMounted } from 'vue'
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
import { authStorage } from '@/services/storage/authStorage'
import { userService } from '@/services/user'

const props = defineProps<{
  events: SecurityEvent[]
}>()

const PAGE_SIZE = 20

const searchQuery = ref('')
const selectedTypeFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const currentPage = ref(1)
const serverEvents = ref<SecurityEvent[] | null>(null)
const serverTotalPages = ref(1)

const isRealBackendSession = () => authStorage.getSession()?.isSimulated === false

const ACTION_ALIAS_MAP: Record<string, string[]> = {
  USUARIO_CRIADO: ['Criação de Conta'],
  USUARIO_ATIVADO: ['Ativação de Conta'],
  USUARIO_INATIVADO: ['Inativação de Conta'],
  PERMISSAO_ALTERADA: ['Troca de Cargo'],
  PERMISSAO_ALTERADA_COM_EXCECAO_SOD: ['Exceção SoD'],
  SENHA_REDEFINIDA: ['Redefinição de Senha'],
  ALERTA_SOD: ['Alerta', 'SoD'],
  ACESSO_NEGADO_403: ['403'],
}

function parseEventDateYmd(timestamp: string): string | null {
  if (!timestamp) return null
  const brMatch = timestamp.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
  }
  const isoMatch = timestamp.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) {
    return isoMatch[1] ?? null
  }
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

async function fetchBackendEvents() {
  if (!isRealBackendSession()) {
    serverEvents.value = null
    return
  }
  try {
    const q = searchQuery.value.trim()
    const usuarioId = /^\d+$/.test(q) ? Number(q) : undefined
    const res = await userService.getSecurityEventsPagedAsync({
      usuarioId,
      acao: selectedTypeFilter.value || undefined,
      de: dateFrom.value || undefined,
      ate: dateTo.value || undefined,
      page: currentPage.value - 1,
      size: PAGE_SIZE,
    })
    serverEvents.value = res.items
    serverTotalPages.value = Math.max(1, res.totalPages)
  } catch {
    serverEvents.value = null
  }
}

onMounted(() => {
  if (isRealBackendSession()) {
    fetchBackendEvents()
  }
})

watch([selectedTypeFilter, dateFrom, dateTo], () => {
  currentPage.value = 1
  if (isRealBackendSession()) {
    fetchBackendEvents()
  }
})

watch(searchQuery, () => {
  currentPage.value = 1
  if (isRealBackendSession() && /^\d*$/.test(searchQuery.value.trim())) {
    fetchBackendEvents()
  }
})

watch(currentPage, () => {
  if (isRealBackendSession()) {
    fetchBackendEvents()
  }
})

const localFilteredAll = computed(() => {
  const source = serverEvents.value !== null ? serverEvents.value : props.events
  return source.filter((ev) => {
    const q = searchQuery.value.toLowerCase().trim()
    const matchesSearch =
      !q ||
      ev.action.toLowerCase().includes(q) ||
      (ev.actionCode?.toLowerCase().includes(q) ?? false) ||
      ev.actorName.toLowerCase().includes(q) ||
      ev.actorEmail.toLowerCase().includes(q) ||
      ev.details.toLowerCase().includes(q)

    const filterCode = selectedTypeFilter.value
    let matchesType = !filterCode
    if (filterCode) {
      if (ev.actionCode === filterCode || ev.action.includes(filterCode)) {
        matchesType = true
      } else {
        const aliases = ACTION_ALIAS_MAP[filterCode] || []
        matchesType = aliases.some((alias) => ev.action.includes(alias))
      }
    }

    let matchesDate = true
    if (dateFrom.value || dateTo.value) {
      const ymd = parseEventDateYmd(ev.timestamp)
      if (ymd) {
        if (dateFrom.value && ymd < dateFrom.value) matchesDate = false
        if (dateTo.value && ymd > dateTo.value) matchesDate = false
      }
    }

    return matchesSearch && matchesType && matchesDate
  })
})

const totalPages = computed(() => {
  if (serverEvents.value !== null) {
    return serverTotalPages.value
  }
  return Math.max(1, Math.ceil(localFilteredAll.value.length / PAGE_SIZE))
})

const filteredEvents = computed(() => {
  if (serverEvents.value !== null) {
    return localFilteredAll.value
  }
  const start = (currentPage.value - 1) * PAGE_SIZE
  return localFilteredAll.value.slice(start, start + PAGE_SIZE)
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
              <option value="USUARIO_CRIADO">Criação de Contas</option>
              <option value="PERMISSAO_ALTERADA">Trocas de Cargo</option>
              <option value="PERMISSAO_ALTERADA_COM_EXCECAO_SOD">Alteração com Exceção SoD</option>
              <option value="USUARIO_ATIVADO">Ativações de Conta</option>
              <option value="USUARIO_INATIVADO">Inativações</option>
              <option value="SENHA_REDEFINIDA">Redefinição de Senha</option>
              <option value="ALERTA_SOD">Alertas SoD</option>
              <option value="ACESSO_NEGADO_403">Bloqueios 403</option>
            </select>
          </div>

          <div class="date-range-group">
            <label for="audit-date-from" class="date-label">De:</label>
            <input
              id="audit-date-from"
              v-model="dateFrom"
              type="date"
              class="input date-input"
              data-testid="audit-date-from"
            />
            <label for="audit-date-to" class="date-label">Até:</label>
            <input
              id="audit-date-to"
              v-model="dateTo"
              type="date"
              class="input date-input"
              data-testid="audit-date-to"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Tabela da Trilha Imutável -->
    <div class="card table-card">
      <div tabindex="0" role="region" aria-label="Logs de auditoria de segurança" class="audit-table-wrap">
        <table class="audit-table" data-testid="security-audit-table">
          <thead>
            <tr>
              <th class="th-time">Data e Hora</th>
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

      <div v-if="filteredEvents.length > 0" class="audit-pagination-bar">
        <span class="pagination-info">Página {{ currentPage }} de {{ totalPages }}</span>
        <div class="pagination-controls">
          <button
            type="button"
            class="btn-page"
            :disabled="currentPage <= 1"
            data-testid="audit-prev-page"
            @click="currentPage--"
          >
            Anterior
          </button>
          <button
            type="button"
            class="btn-page"
            :disabled="currentPage >= totalPages"
            data-testid="audit-next-page"
            @click="currentPage++"
          >
            Próxima
          </button>
        </div>
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
  background: var(--color-surface);
  border: 1px solid var(--color-border);
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
  color: var(--color-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding-left: 40px;
  height: 40px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-heading);
  font-size: 0.85rem;
  outline: none;
}

.search-input:focus {
  border-color: var(--color-brand);
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
  color: var(--color-text-muted);
  pointer-events: none;
}

.select {
  height: 40px;
  padding: 0 12px 0 34px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-heading);
  font-size: 0.85rem;
  outline: none;
  cursor: pointer;
}

.table-card {
  padding: 0;
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
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
  border-bottom: 1px solid var(--color-border);
}

.audit-table th {
  background: var(--color-surface-soft);
  color: var(--color-heading);
  font-weight: 700;
  text-align: left;
}

.time-text {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}

.time-icon {
  color: var(--color-text-muted);
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
  background: var(--badge-neutral-bg);
  color: var(--badge-neutral-text);
  display: flex;
  align-items: center;
  justify-content: center;
}

.actor-name {
  display: block;
  font-size: 0.84rem;
  color: var(--color-heading);
}

.actor-email {
  display: block;
  font-size: 0.74rem;
  color: var(--color-text-muted);
}

.action-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  background: var(--badge-info-bg);
  color: var(--badge-info-text);
}

.badge-sod {
  background: var(--badge-danger-bg);
  border: 1px solid var(--badge-danger-border);
  color: var(--badge-danger-text);
}

.badge-403 {
  background: var(--badge-warning-bg);
  border: 1px solid var(--badge-warning-border);
  color: var(--badge-warning-text);
}

.badge-warn {
  background: var(--badge-orange-bg);
  color: var(--badge-orange-text);
}

.details-text {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-heading);
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
  background: var(--badge-info-bg);
  color: var(--badge-info-text);
}

.sev-warn {
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
}

.sev-danger {
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
}

.empty-cell {
  text-align: center;
  padding: 48px 16px;
  color: var(--color-text-muted);
}

.empty-icon {
  margin-bottom: 8px;
  color: var(--color-text-muted);
}

.date-range-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.date-label {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.date-input {
  height: 40px;
  padding: 0 10px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-heading);
  font-size: 0.82rem;
}

.audit-pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
}

.pagination-info {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.pagination-controls {
  display: flex;
  gap: 8px;
}

.btn-page {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  color: var(--color-heading);
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-page:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
