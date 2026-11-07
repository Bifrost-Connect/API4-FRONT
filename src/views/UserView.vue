<script setup lang="ts">
/**
 * View de gerenciamento e administração de usuários do sistema.
 * Atua estritamente na camada de apresentação visual, delegando toda
 * a busca de dados, mutações e regras de permissão ao userService.
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
  FiX,
  FiCheck,
  FiSave,
  FiKey,
} from 'vue-icons-plus/fi'
import DataTable, { type Column } from '../components/DataTable.vue'
import {
  userService,
  type UserItem,
  type SystemRole,
  type PermissionDefinition,
} from '../services/user'

// Colunas para a DataTable
const columns: Column[] = [
  { key: 'name', label: 'Nome / Usuário' },
  { key: 'role', label: 'Role Associada' },
  { key: 'department', label: 'Departamento' },
  { key: 'status', label: 'Status' },
  { key: 'lastLogin', label: 'Último Acesso' },
  { key: 'actions', label: 'Ações' },
]

// Dados e catálogo providos pelo serviço
const availableRoles = userService.getAvailableRoles()
const allPermissions = userService.getAllPermissions()

// Filtros
const searchQuery = ref('')
const selectedRoleFilter = ref<string>('')
const selectedStatusFilter = ref<string>('')
const feedbackMsg = ref('')

// Modal 1: Cadastro / Edição Básica
const isModalOpen = ref(false)
const isEditing = ref(false)
const modalUserId = ref<number | null>(null)
const modalName = ref('')
const modalEmail = ref('')
const modalRole = ref<SystemRole>('ANALISTA')
const modalDepartment = ref('')
const modalStatus = ref<'Ativo' | 'Inativo'>('Ativo')

// Modal 2: Gerenciamento Exclusivo de Permissões
const isPermModalOpen = ref(false)
const permUser = ref<UserItem | null>(null)
const selectedPermissions = ref<Set<string>>(new Set())
const permModuleFilter = ref('')
const permSearchFilter = ref('')

// Usuários obtidos do serviço com filtro reativo
const filteredUsers = computed(() => {
  return userService.getUsers().filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      user.department.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesRole = !selectedRoleFilter.value || user.role === selectedRoleFilter.value
    const matchesStatus = !selectedStatusFilter.value || user.status === selectedStatusFilter.value

    return matchesSearch && matchesRole && matchesStatus
  })
})

// Módulos únicos para filtro do modal de permissões
const uniqueModules = computed(() => {
  const set = new Set<string>()
  allPermissions.forEach((p) => set.add(p.modulo))
  return Array.from(set)
})

// Subpermissões filtradas no modal
const filteredPermissionDefs = computed(() => {
  return allPermissions.filter((p) => {
    const matchesMod = !permModuleFilter.value || p.modulo === permModuleFilter.value
    const matchesQuery =
      !permSearchFilter.value ||
      p.modulo.toLowerCase().includes(permSearchFilter.value.toLowerCase()) ||
      p.subpermissao.toLowerCase().includes(permSearchFilter.value.toLowerCase())
    return matchesMod && matchesQuery
  })
})

const getPermKey = (p: PermissionDefinition) => `${p.modulo}:${p.subpermissao}`

const openCreateModal = () => {
  isEditing.value = false
  modalUserId.value = null
  modalName.value = ''
  modalEmail.value = ''
  modalRole.value = 'ANALISTA'
  modalDepartment.value = 'Geoprocessamento'
  modalStatus.value = 'Ativo'
  isModalOpen.value = true
}

const openEditModal = (user: UserItem) => {
  isEditing.value = true
  modalUserId.value = user.id
  modalName.value = user.name
  modalEmail.value = user.email
  modalRole.value = user.role
  modalDepartment.value = user.department
  modalStatus.value = user.status
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const saveUser = () => {
  if (!modalName.value || !modalEmail.value) {
    return
  }

  if (isEditing.value && modalUserId.value !== null) {
    const updated = userService.updateUser(modalUserId.value, {
      name: modalName.value,
      email: modalEmail.value,
      role: modalRole.value,
      department: modalDepartment.value || 'Geral',
      status: modalStatus.value,
    })
    if (updated) {
      showFeedback('Usuário atualizado com sucesso!')
    }
  } else {
    userService.createUser({
      name: modalName.value,
      email: modalEmail.value,
      role: modalRole.value,
      department: modalDepartment.value || 'Geral',
      status: modalStatus.value,
    })
    showFeedback('Novo usuário cadastrado com sucesso!')
  }

  closeModal()
}

// Modal de Permissões
const openPermissionsModal = (user: UserItem) => {
  permUser.value = user
  selectedPermissions.value = new Set(user.permissions)
  permModuleFilter.value = ''
  permSearchFilter.value = ''
  isPermModalOpen.value = true
}

const closePermissionsModal = () => {
  isPermModalOpen.value = false
  permUser.value = null
}

const togglePermission = (key: string) => {
  const updated = new Set(selectedPermissions.value)
  if (updated.has(key)) {
    updated.delete(key)
  } else {
    updated.add(key)
  }
  selectedPermissions.value = updated
}

const resetToRoleDefaults = () => {
  if (!permUser.value) return
  const defaults = userService.resetPermissionsToRole(permUser.value.id)
  selectedPermissions.value = new Set(defaults)
  showFeedback(`Permissões restauradas para os padrões da role ${permUser.value.role}.`)
}

const savePermissions = () => {
  if (!permUser.value) return
  userService.updateUserPermissions(permUser.value.id, Array.from(selectedPermissions.value))
  showFeedback(`Permissões de ${permUser.value.name} atualizadas com sucesso!`)
  closePermissionsModal()
}

const toggleUserStatus = (user: UserItem) => {
  const updated = userService.toggleUserStatus(user.id)
  if (updated) {
    showFeedback(`Status de ${updated.name} alterado para ${updated.status}.`)
  }
}

const showFeedback = (msg: string) => {
  feedbackMsg.value = msg
  setTimeout(() => {
    feedbackMsg.value = ''
  }, 4000)
}
</script>

<template>
  <main class="users-view">
    <header class="page-heading">
      <div class="heading-content">
        <div>
          <p class="eyebrow">Administração e Acesso</p>
          <h1>Gerenciamento de Usuários e Permissões</h1>
          <p class="page-description">
            Associe papéis aos usuários e configure subpermissões personalizadas para controle de
            acesso granular na plataforma GeoRural.
          </p>
        </div>
        <button type="button" class="btn btn_primary" @click="openCreateModal">
          <FiUserPlus size="16" />
          <span>Novo Usuário</span>
        </button>
      </div>
    </header>

    <!-- Feedback Banner -->
    <div v-if="feedbackMsg" class="alert-banner alert-success">
      <FiCheckCircle size="18" />
      <span>{{ feedbackMsg }}</span>
    </div>

    <!-- Barra de Filtros e Busca -->
    <section class="card filter-card">
      <div class="filter-grid">
        <div class="search-box">
          <FiSearch class="search-icon" size="16" />
          <input
            v-model="searchQuery"
            type="text"
            class="input search-input"
            placeholder="Buscar por nome, e-mail ou departamento..."
          />
        </div>

        <div class="filter-selects">
          <div class="select-group">
            <FiShield size="14" class="select-icon" />
            <select v-model="selectedRoleFilter" class="select">
              <option value="">Todas as Roles</option>
              <option v-for="r in availableRoles" :key="r.value" :value="r.value">
                {{ r.label }}
              </option>
            </select>
          </div>

          <div class="select-group">
            <FiFilter size="14" class="select-icon" />
            <select v-model="selectedStatusFilter" class="select">
              <option value="">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <!-- Tabela de Usuários com DataTable (expand desabilitado) -->
    <section class="card table-card">
      <DataTable :columns="columns" :data="filteredUsers" row-key="id" :disable-expand="true">
        <template #cell-name="{ item }">
          <div class="user-cell">
            <div class="user-avatar-mini">
              {{ item.name.charAt(0).toUpperCase() }}
            </div>
            <div>
              <strong class="user-cell-name">{{ item.name }}</strong>
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
            <button
              type="button"
              class="btn-action permissions"
              title="Gerenciar Subpermissões"
              @click.stop="openPermissionsModal(item)"
            >
              <FiKey size="14" />
            </button>
            <button
              type="button"
              class="btn-action edit"
              title="Editar Dados do Usuário"
              @click.stop="openEditModal(item)"
            >
              <FiEdit2 size="14" />
            </button>
            <button
              type="button"
              class="btn-action status"
              :title="item.status === 'Ativo' ? 'Desativar Usuário' : 'Ativar Usuário'"
              @click.stop="toggleUserStatus(item)"
            >
              <FiXCircle v-if="item.status === 'Ativo'" size="14" />
              <FiCheckCircle v-else size="14" />
            </button>
          </div>
        </template>
      </DataTable>

      <div v-if="filteredUsers.length === 0" class="empty-state">
        <FiUsers size="36" />
        <p>Nenhum usuário encontrado com os filtros atuais.</p>
      </div>
    </section>

    <!-- Modal 1: Criação / Edição do Usuário -->
    <div v-if="isModalOpen" class="modal-backdrop" @click.self="closeModal">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>{{ isEditing ? 'Editar Usuário' : 'Cadastrar Novo Usuário' }}</h3>
          <button type="button" class="btn-close" @click="closeModal">
            <FiX size="18" />
          </button>
        </div>

        <form @submit.prevent="saveUser" class="modal-body">
          <div class="form-group">
            <label class="label">Nome Completo</label>
            <input
              v-model="modalName"
              type="text"
              class="input"
              placeholder="Ex: Ana Silva"
              required
            />
          </div>

          <div class="form-group">
            <label class="label">E-mail Corporativo</label>
            <input
              v-model="modalEmail"
              type="email"
              class="input"
              placeholder="ana.silva@georural.com.br"
              required
            />
          </div>

          <div class="form-row two-cols">
            <div class="form-group">
              <label class="label">Role Associada</label>
              <select v-model="modalRole" class="select">
                <option v-for="r in availableRoles" :key="r.value" :value="r.value">
                  {{ r.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="label">Status Inicial</label>
              <select v-model="modalStatus" class="select">
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="label">Departamento</label>
            <input
              v-model="modalDepartment"
              type="text"
              class="input"
              placeholder="Ex: Análise Espacial"
            />
          </div>

          <p class="modal-role-tip">
            <FiShield size="14" />
            Ao associar a role <strong>{{ modalRole }}</strong
            >, o usuário receberá o pacote básico de subpermissões desta role. Você poderá anexar ou
            remover permissões específicas a qualquer momento no modal de acessos.
          </p>

          <div class="modal-footer">
            <button type="button" class="btn btn_outline" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn btn_primary">
              <FiSave size="16" />
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal 2: Modal Dedicado de Permissões -->
    <div v-if="isPermModalOpen" class="modal-backdrop" @click.self="closePermissionsModal">
      <div class="modal-dialog modal-permissions-dialog">
        <div class="modal-header">
          <div class="modal-header-titles">
            <h3>Gerenciamento de Subpermissões</h3>
            <p class="modal-subtitle">
              Usuário: <strong>{{ permUser?.name }}</strong> &bull; Role Associada:
              <span class="role-badge" :class="permUser?.role.toLowerCase()">{{
                permUser?.role
              }}</span>
            </p>
          </div>
          <button type="button" class="btn-close" aria-label="Fechar" @click="closePermissionsModal">
            <FiX size="20" />
          </button>
        </div>

        <div class="modal-body-permissions">
          <!-- Barra de Ações Rápidas e Filtro -->
          <div class="perm-toolbar">
            <div class="perm-search-box">
              <FiSearch class="search-icon" size="15" />
              <input
                v-model="permSearchFilter"
                type="text"
                class="input perm-input"
                placeholder="Buscar por módulo ou subpermissão..."
              />
            </div>

            <div class="perm-filter-actions">
              <div class="perm-module-select">
                <select v-model="permModuleFilter" class="select select-compact">
                  <option value="">Todos os Módulos ({{ uniqueModules.length }})</option>
                  <option v-for="m in uniqueModules" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>

              <button
                type="button"
                class="btn btn_outline btn-sm btn-reset-role"
                title="Restaurar para as permissões originais da role"
                @click="resetToRoleDefaults"
              >
                Restaurar Padrão da Role
              </button>
            </div>
          </div>

          <!-- Tabela de Subpermissões com Check / X -->
          <div class="permissions-table-wrapper">
            <table class="perm-table">
              <thead>
                <tr>
                  <th class="th-module">Módulo</th>
                  <th class="th-subperm">Subpermissão</th>
                  <th class="th-status">Atribuição / Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in filteredPermissionDefs"
                  :key="getPermKey(p)"
                  :class="{ 'row-active': selectedPermissions.has(getPermKey(p)) }"
                  @click="togglePermission(getPermKey(p))"
                >
                  <td class="cell-module">
                    <span class="module-tag">{{ p.modulo }}</span>
                  </td>
                  <td class="cell-subperm">
                    <code>{{ p.subpermissao }}</code>
                  </td>
                  <td class="cell-toggle">
                    <button
                      type="button"
                      class="toggle-perm-btn"
                      :class="selectedPermissions.has(getPermKey(p)) ? 'is-granted' : 'is-revoked'"
                      @click.stop="togglePermission(getPermKey(p))"
                    >
                      <template v-if="selectedPermissions.has(getPermKey(p))">
                        <FiCheck size="15" />
                        <span>Permitido (Check)</span>
                      </template>
                      <template v-else>
                        <FiX size="15" />
                        <span>Sem Acesso (X)</span>
                      </template>
                    </button>
                  </td>
                </tr>

                <tr v-if="filteredPermissionDefs.length === 0">
                  <td colspan="3" class="text-center empty-perms-cell">
                    Nenhuma subpermissão encontrada com os filtros informados.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Rodapé do Modal -->
          <div class="modal-footer-wrapper">
            <span class="summary-text">
              Total concedido: <strong>{{ selectedPermissions.size }}</strong> de
              {{ allPermissions.length }} subpermissões do sistema.
            </span>

            <div class="modal-footer-btns">
              <button type="button" class="btn btn_outline" @click="closePermissionsModal">
                Cancelar
              </button>
              <button type="button" class="btn btn_primary" @click="savePermissions">
                <FiSave size="16" />
                <span>Salvar Permissões</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.users-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
}

.heading-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .heading-content {
    flex-direction: column;
    align-items: flex-start;
  }
}

.eyebrow {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--vis-brand-orange, #e67e22);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.heading-content h1 {
  font-size: 1.85rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 6px;
}

.page-description {
  color: var(--color-text-muted, #718096);
  font-size: 0.95rem;
}

.card {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
}

.filter-card {
  padding: 16px 20px;
}

.filter-grid {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 280px;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-muted, #a0aec0);
  pointer-events: none;
}

.search-input {
  padding-left: 38px !important;
  width: 100%;
}

.filter-selects {
  display: flex;
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
  color: var(--color-text-muted, #a0aec0);
  pointer-events: none;
}

.select {
  padding-left: 34px !important;
}

.table-card {
  overflow: hidden;
  padding: 0;
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
  background: var(--color-background-soft, #edf2f7);
  color: var(--vis-brand-orange, #e67e22);
  font-weight: 700;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-cell-name {
  display: block;
  font-size: 0.92rem;
  color: var(--color-heading);
}

.user-cell-email {
  display: block;
  font-size: 0.78rem;
  color: var(--color-text-muted, #718096);
}

.dept-text,
.date-text {
  font-size: 0.88rem;
  color: var(--color-text);
}

.role-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  text-transform: uppercase;
}

.role-badge.admin {
  background: #feebc8;
  color: #c05621;
}

.role-badge.analista {
  background: #e2e8f0;
  color: #2b6cb0;
}

.role-badge.auditor {
  background: #fed7d7;
  color: #9b2c2c;
}

.role-badge.operador_dados {
  background: #c6f6d5;
  color: #22543d;
}

.role-badge.gestor {
  background: #e9d8fd;
  color: #553c9e;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-pill.ativo {
  color: #38a169;
}

.status-pill.ativo .status-dot {
  background: #38a169;
}

.status-pill.inativo {
  color: #a0aec0;
}

.status-pill.inativo .status-dot {
  background: #a0aec0;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-action {
  background: transparent;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  padding: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted, #718096);
  transition: all 0.2s ease;
}

.btn-action:hover {
  background: var(--color-background-soft, #f7fafc);
  color: var(--color-heading);
}

.btn-action.permissions:hover {
  color: var(--vis-brand-orange, #e67e22);
  border-color: var(--vis-brand-orange, #e67e22);
}

.btn-action.edit:hover {
  color: #3182ce;
  border-color: #3182ce;
}

.btn-action.status:hover {
  color: var(--vis-brand-orange, #e67e22);
  border-color: var(--vis-brand-orange, #e67e22);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--color-text-muted, #a0aec0);
}

.alert-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 500;
  margin-bottom: 20px;
}

.alert-success {
  background-color: #f0fff4;
  color: #276749;
  border: 1px solid #c6f6d5;
}

/* Modais */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  overflow-y: auto;
}

.modal-dialog {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modalFadeIn 0.2s ease-out;
}

.modal-permissions-dialog {
  max-width: 820px;
  max-height: 90vh;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  padding: 18px 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.modal-header-titles {
  flex: 1;
  min-width: 0;
}

.modal-header h3 {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-heading);
  margin: 0;
}

.modal-subtitle {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-close {
  background: transparent;
  border: 0;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.btn-close:hover {
  color: var(--color-heading);
  background: var(--color-background-soft);
}

.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.modal-body-permissions {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  flex: 1;
}

.perm-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.perm-search-box {
  position: relative;
  flex: 1;
  min-width: 240px;
  display: flex;
  align-items: center;
}

.perm-input {
  padding-left: 36px !important;
  font-size: 0.88rem;
  width: 100%;
}

.perm-filter-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.select-compact {
  font-size: 0.86rem;
  padding-top: 8px;
  padding-bottom: 8px;
  min-width: 190px;
}

.btn-reset-role {
  white-space: nowrap;
}

.btn-sm {
  font-size: 0.82rem;
  padding: 8px 14px;
  font-weight: 600;
}

.permissions-table-wrapper {
  flex: 1;
  max-height: 440px;
  min-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.perm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.perm-table th,
.perm-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.perm-table th {
  position: sticky;
  top: 0;
  background: var(--color-background-soft);
  z-index: 2;
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--color-heading);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.perm-table .th-module {
  width: 25%;
}

.perm-table .th-subperm {
  width: 45%;
}

.perm-table .th-status {
  width: 30%;
  text-align: right;
}

.perm-table tbody tr {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.perm-table tbody tr:hover {
  background: var(--color-background-soft);
}

.perm-table tbody tr.row-active {
  background: rgba(242, 101, 34, 0.06);
}

.module-tag {
  background: var(--color-background-soft);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  font-size: 0.74rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  display: inline-block;
  letter-spacing: 0.03em;
}

.cell-subperm code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.84rem;
  color: var(--color-heading);
  background: transparent;
  font-weight: 600;
}

.cell-toggle {
  text-align: right;
}

.toggle-perm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.toggle-perm-btn.is-granted {
  background: var(--badge-success-bg, rgba(16, 185, 129, 0.15));
  color: var(--badge-success-text, #15803d);
  border-color: var(--badge-success-border, rgba(16, 185, 129, 0.35));
}

.toggle-perm-btn.is-revoked {
  background: var(--badge-danger-bg, rgba(239, 68, 68, 0.12));
  color: var(--badge-danger-text, #b91c1c);
  border-color: var(--badge-danger-border, rgba(239, 68, 68, 0.35));
}

.toggle-perm-btn:hover {
  filter: brightness(0.95);
  transform: translateY(-1px);
}

.empty-perms-cell {
  padding: 36px 16px !important;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.modal-footer-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.summary-text {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.summary-text strong {
  color: var(--color-heading);
}

.modal-footer-btns {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-left: auto;
}

.modal-role-tip {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  background: var(--color-background-soft);
  padding: 10px 14px;
  border-radius: 6px;
  border-left: 3px solid var(--vis-brand-orange, #f26522);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.4;
}

.form-row.two-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--color-heading);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

/* Responsividade Mobile e Tablet */
@media (max-width: 768px) {
  .modal-permissions-dialog {
    max-height: 96vh;
    margin: 8px;
  }

  .modal-header {
    padding: 14px 18px;
  }

  .modal-body-permissions {
    padding: 14px 18px;
    gap: 12px;
  }

  .perm-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .perm-search-box {
    min-width: 100%;
  }

  .perm-filter-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .select-compact {
    min-width: 100%;
  }

  .btn-reset-role {
    width: 100%;
    text-align: center;
    justify-content: center;
  }

  .permissions-table-wrapper {
    max-height: 350px;
  }

  .perm-table th,
  .perm-table td {
    padding: 10px 10px;
    font-size: 0.82rem;
  }

  .toggle-perm-btn {
    padding: 4px 10px;
    font-size: 0.76rem;
  }

  .modal-footer-wrapper {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .modal-footer-btns {
    width: 100%;
    margin-left: 0;
  }

  .modal-footer-btns button {
    flex: 1;
    justify-content: center;
  }
}

.text-center {
  text-align: center !important;
}
</style>
