<script setup lang="ts">
/**
 * Aba 1: Painel de Gestão de Usuários e Colaboradores (Tarefa 1 e 8).
 * Listagem paginada, filtros dinâmicos, indicação de exceção SoD e travas de auto-exclusão.
 */
import { ref, computed } from 'vue'
import {
  FiUsers,
  FiUserPlus,
  FiSearch,
  FiFilter,
  FiShield,
  FiEdit2,
  FiCheckCircle,
  FiXCircle,
  FiKey,
  FiAlertTriangle,
} from 'vue-icons-plus/fi'
import DataTable, { type Column } from '../DataTable.vue'
import type { UserItem, RoleOption } from '@/mocks/user.mock'

const props = defineProps<{
  users: UserItem[]
  availableRoles: RoleOption[]
  loggedInAdminEmail?: string
}>()

const emit = defineEmits<{
  (e: 'create-user'): void
  (e: 'edit-user', user: UserItem): void
  (e: 'manage-permissions', user: UserItem): void
  (e: 'toggle-status', user: UserItem): void
}>()

// Colunas da tabela
const columns: Column[] = [
  { key: 'name', label: 'Nome' },
  { key: 'role', label: 'Cargo' },
  { key: 'department', label: 'Departamento' },
  { key: 'sod', label: 'Exceção SoD' },
  { key: 'status', label: 'Status' },
  { key: 'lastLogin', label: 'Último Acesso' },
  { key: 'actions', label: 'Ações' },
]

// Filtros e busca
const searchQuery = ref('')
const selectedRoleFilter = ref('')
const selectedStatusFilter = ref('')

// Paginação
const currentPage = ref(1)
const pageSize = ref(10)

const filteredUsers = computed(() => {
  return props.users.filter((user) => {
    const q = searchQuery.value.toLowerCase().trim()
    const matchesSearch =
      !q ||
      user.name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.department.toLowerCase().includes(q)

    const matchesRole = !selectedRoleFilter.value || user.role === selectedRoleFilter.value
    const matchesStatus = !selectedStatusFilter.value || user.status === selectedStatusFilter.value

    return matchesSearch && matchesRole && matchesStatus
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / pageSize.value)))

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredUsers.value.slice(start, start + pageSize.value)
})

// Trava contra auto-exclusão do Admin logado (Tarefa 8)
const isSelf = (user: UserItem): boolean => {
  if (!props.loggedInAdminEmail) return false
  return user.email.toLowerCase() === props.loggedInAdminEmail.toLowerCase()
}
</script>

<template>
  <div class="user-management-tab" data-testid="user-management-tab">
    <!-- Barra de Filtros e Busca -->
    <section class="card filter-card">
      <div class="filter-grid">
        <div class="search-box">
          <FiSearch class="search-icon" size="16" />
          <input
            v-model="searchQuery"
            type="text"
            class="input search-input"
            placeholder="Buscar colaborador por nome, e-mail ou departamento..."
            data-testid="user-search-input"
            @input="currentPage = 1"
          />
        </div>

        <div class="filter-selects">
          <div class="select-group">
            <FiShield size="14" class="select-icon" />
            <select
              v-model="selectedRoleFilter"
              class="select"
              data-testid="filter-user-role"
              @change="currentPage = 1"
            >
              <option value="">Todos os Cargos</option>
              <option v-for="r in availableRoles" :key="r.value" :value="r.value">
                {{ r.label }}
              </option>
            </select>
          </div>

          <div class="select-group">
            <FiFilter size="14" class="select-icon" />
            <select
              v-model="selectedStatusFilter"
              class="select"
              data-testid="filter-user-status"
              @change="currentPage = 1"
            >
              <option value="">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>

          <button
            type="button"
            class="btn btn_primary btn-new-user"
            data-testid="btn-open-create-user"
            @click="$emit('create-user')"
          >
            <FiUserPlus size="16" />
            <span>Novo Colaborador</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Tabela de Usuários -->
    <section class="card table-card">
      <DataTable :columns="columns" :data="paginatedUsers" row-key="id" :disable-expand="true">
        <template #cell-name="{ item }">
          <div class="user-cell">
            <div class="user-avatar-mini" :class="{ 'avatar-admin': item.role === 'ADMIN' }">
              {{ item.name.charAt(0).toUpperCase() }}
            </div>
            <div>
              <strong class="user-cell-name">
                {{ item.name }}
                <span v-if="isSelf(item)" class="badge-current-user">(Você)</span>
              </strong>
              <span class="user-cell-email">{{ item.email }}</span>
            </div>
          </div>
        </template>

        <template #cell-role="{ item }">
          <span class="role-badge" :class="item.role.toLowerCase()">
            {{ item.role }}
          </span>
        </template>

        <template #cell-department="{ item }">
          <span class="dept-text">{{ item.department }}</span>
        </template>

        <!-- Indicação de Exceção SoD (Tarefa 1 e 5) -->
        <template #cell-sod="{ item }">
          <span
            v-if="item.sodException"
            class="sod-badge"
            :title="item.sodJustification ? `Justificativa SoD: ${item.sodJustification}` : 'Exceção SoD Ativa'"
            data-testid="badge-sod-active"
          >
            <FiAlertTriangle size="12" />
            Exceção SoD
          </span>
          <span v-else class="sod-none">—</span>
        </template>

        <template #cell-status="{ item }">
          <span class="status-pill" :class="item.status.toLowerCase()">
            <span class="status-dot"></span>
            {{ item.status }}
          </span>
        </template>

        <template #cell-lastLogin="{ item }">
          <span class="date-text">{{ item.lastLogin }}</span>
        </template>

        <template #cell-actions="{ item }">
          <div class="table-actions">
            <!-- Gerenciar Subpermissões -->
            <button
              type="button"
              class="btn-action permissions"
              title="Gerenciar Subpermissões"
              data-testid="btn-action-permissions"
              @click.stop="$emit('manage-permissions', item)"
            >
              <FiKey size="14" />
            </button>

            <!-- Editar Dados do Usuário -->
            <button
              type="button"
              class="btn-action edit"
              title="Editar Dados do Usuário"
              data-testid="btn-action-edit"
              @click.stop="$emit('edit-user', item)"
            >
              <FiEdit2 size="14" />
            </button>

            <!-- Ativar / Inativar Usuário com Trava de Auto-Exclusão (Tarefa 8) -->
            <button
              type="button"
              class="btn-action status"
              :class="{ 'btn-disabled': isSelf(item) }"
              :disabled="isSelf(item)"
              :title="
                isSelf(item)
                  ? 'Você não pode inativar seu próprio acesso de Administrador'
                  : item.status === 'Ativo'
                    ? 'Inativar Usuário'
                    : 'Ativar Usuário'
              "
              data-testid="btn-action-toggle-status"
              @click.stop="!isSelf(item) && $emit('toggle-status', item)"
            >
              <FiXCircle v-if="item.status === 'Ativo'" size="14" />
              <FiCheckCircle v-else size="14" />
            </button>
          </div>
        </template>
      </DataTable>

      <div v-if="filteredUsers.length === 0" class="empty-state">
        <FiUsers size="36" />
        <p>Nenhum colaborador encontrado com os filtros aplicados.</p>
      </div>

      <!-- Paginação da Tabela -->
      <div v-if="filteredUsers.length > 0" class="pagination-bar">
        <span class="pagination-info">
          Exibindo {{ (currentPage - 1) * pageSize + 1 }} a
          {{ Math.min(currentPage * pageSize, filteredUsers.length) }} de
          {{ filteredUsers.length }} colaboradores
        </span>

        <div class="pagination-controls">
          <button
            type="button"
            class="btn-page"
            :disabled="currentPage <= 1"
            data-testid="btn-prev-page"
            @click="currentPage--"
          >
            Anterior
          </button>
          <span class="page-number">Página {{ currentPage }} de {{ totalPages }}</span>
          <button
            type="button"
            class="btn-page"
            :disabled="currentPage >= totalPages"
            data-testid="btn-next-page"
            @click="currentPage++"
          >
            Próxima
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.user-management-tab {
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
  flex-wrap: wrap;
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

.btn-new-user {
  height: 40px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.86rem;
  border-radius: 8px;
  white-space: nowrap;
}

.table-card {
  padding: 0;
  overflow: hidden;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 10px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar-mini {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.avatar-admin {
  background: rgba(242, 101, 34, 0.2);
  color: var(--color-brand, #f26522);
}

.user-cell-name {
  display: block;
  font-size: 0.88rem;
  color: var(--color-heading, #f8fafc);
}

.badge-current-user {
  font-size: 0.72rem;
  color: var(--color-brand, #f26522);
  font-weight: 700;
  margin-left: 4px;
}

.user-cell-email {
  display: block;
  font-size: 0.78rem;
  color: var(--color-text-muted, #94a3b8);
}

.role-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  background: rgba(148, 163, 184, 0.15);
  color: #cbd5e1;
}

.role-badge.admin {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.role-badge.operador_dados {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.role-badge.analista {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.role-badge.auditor {
  background: rgba(234, 179, 8, 0.15);
  color: #facc15;
}

.role-badge.gestor {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
}

.dept-text,
.date-text {
  font-size: 0.84rem;
  color: var(--color-text-muted, #94a3b8);
}

.sod-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #ef4444;
  font-size: 0.74rem;
  font-weight: 700;
}

.sod-none {
  color: var(--color-text-muted, #64748b);
  font-size: 0.85rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 600;
}

.status-pill.ativo {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.status-pill.inativo {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-action {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--color-border, #334155);
  background: var(--color-surface, #1e293b);
  color: var(--color-text-muted, #94a3b8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn-action:hover:not(:disabled) {
  border-color: var(--color-brand, #f26522);
  color: var(--color-heading, #f8fafc);
}

.btn-action.permissions:hover:not(:disabled) {
  color: #facc15;
}

.btn-action.status:hover:not(:disabled) {
  color: #ef4444;
}

.btn-action:disabled,
.btn-disabled {
  opacity: 0.35;
  cursor: not-allowed !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 16px;
  color: var(--color-text-muted, #94a3b8);
  gap: 12px;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border, #334155);
  flex-wrap: wrap;
  gap: 12px;
}

.pagination-info {
  font-size: 0.8rem;
  color: var(--color-text-muted, #94a3b8);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-page {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--color-background, #0f172a);
  border: 1px solid var(--color-border, #334155);
  color: var(--color-heading, #f8fafc);
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-page:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-number {
  font-size: 0.8rem;
  color: var(--color-text-muted, #94a3b8);
}
</style>
