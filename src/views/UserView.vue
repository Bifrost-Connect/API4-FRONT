<script setup lang="ts">
/**
 * View de Administração de Usuários, Perfis e Permissões (US13).
 * Estruturada em 3 abas especializadas:
 * 1. Colaboradores e Acessos (Listagem, busca, filtros e ações)
 * 2. Cargos e Permissões (Matriz RBAC por módulo e cargos customizados)
 * 3. Auditoria de Segurança (Trilha imutável de eventos administrativos)
 */
import { ref, computed, onMounted } from 'vue'
import {
  FiUsers,
  FiShield,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiX,
  FiCheck,
  FiKey,
} from 'vue-icons-plus/fi'
import UserManagementTab from '@/components/admin/UserManagementTab.vue'
import UserFormModal from '@/components/admin/UserFormModal.vue'
import RolePermissionMatrix from '@/components/admin/RolePermissionMatrix.vue'
import SecurityAuditTab from '@/components/admin/SecurityAuditTab.vue'
import {
  userService,
  type UserItem,
  type RoleDef,
  type PermissionDefinition,
  type SecurityEvent,
} from '@/services/user'
import { roleService } from '@/services/roles'
import { DuplicateEmailError } from '@/services/access/MockAccessRepository'
import { extractApiErrorMessage } from '@/services/api'

type AdminTab = 'colaboradores' | 'matriz' | 'auditoria'
const activeTab = ref<AdminTab>('colaboradores')

// Estados reativos
const users = ref<UserItem[]>([])
const roles = ref<RoleDef[]>([])
const allPermissions = ref<PermissionDefinition[]>([])
const securityEvents = ref<SecurityEvent[]>([])

const toastMessage = ref('')
const toastType = ref<'success' | 'error'>('success')

// Modal de Formulário (Cadastro / Edição)
const isFormModalOpen = ref(false)
const isEditingUser = ref(false)
const selectedUserToEdit = ref<UserItem | null>(null)

// Modal de Redefinição de Senha (POST /api/admin/usuarios/{id}/redefinir-senha)
const isResetModalOpen = ref(false)
const resetTargetUser = ref<UserItem | null>(null)
const resetNewPassword = ref('')
const resetConfirmPassword = ref('')
const resetPasswordError = ref('')
const isResettingPassword = ref(false)

const openResetPasswordModal = (user: UserItem) => {
  resetTargetUser.value = user
  resetNewPassword.value = ''
  resetConfirmPassword.value = ''
  resetPasswordError.value = ''
  isResetModalOpen.value = true
}

const closeResetPasswordModal = () => {
  isResetModalOpen.value = false
  resetTargetUser.value = null
}

const handleResetPassword = async () => {
  resetPasswordError.value = ''
  if (!resetTargetUser.value) return

  if (!resetNewPassword.value || resetNewPassword.value.length < 8) {
    resetPasswordError.value = 'A nova senha deve ter no mínimo 8 caracteres.'
    return
  }

  if (resetNewPassword.value !== resetConfirmPassword.value) {
    resetPasswordError.value = 'A nova senha e a confirmação não conferem.'
    return
  }

  isResettingPassword.value = true
  const targetName = resetTargetUser.value.name
  try {
    await userService.resetPasswordAsync(resetTargetUser.value.id, resetNewPassword.value)
    closeResetPasswordModal()
    showToast(`Senha de ${targetName} redefinida com sucesso!`)
    await refreshData()
  } catch (err: unknown) {
    resetPasswordError.value = extractApiErrorMessage(err, 'Falha ao redefinir senha do colaborador.')
  } finally {
    isResettingPassword.value = false
  }
}

// TODO: Aguardando endpoint no API4-BACK (permissões individuais fora do perfil)
// const isPermModalOpen = ref(false)
// const permUser = ref<UserItem | null>(null)
// const selectedPermissions = ref<Set<string>>(new Set())
// const permModuleFilter = ref('')
// const permSearchFilter = ref('')

const loggedInAdmin = computed(() => userService.getCurrentUser())

const availableRoleOptions = computed(() => {
  return roles.value.map((r: RoleDef) => ({
    value: r.id,
    label: r.nome,
    desc: r.descricao,
  }))
})

const refreshData = async () => {
  users.value = await userService.getUsersAsync()
  roles.value = await roleService.getRoles()
  allPermissions.value = userService.getAllPermissions()
  securityEvents.value = await userService.getSecurityEvents()
}

onMounted(async () => {
  await refreshData()
})

const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
  toastMessage.value = msg
  toastType.value = type
  setTimeout(() => {
    toastMessage.value = ''
  }, 4500)
}

// -------------------------------------------------------------
// Ações de Usuário (Aba 1)
// -------------------------------------------------------------

const openCreateUserModal = () => {
  isEditingUser.value = false
  selectedUserToEdit.value = null
  isFormModalOpen.value = true
}

const openEditUserModal = (user: UserItem) => {
  isEditingUser.value = true
  selectedUserToEdit.value = user
  isFormModalOpen.value = true
}

const handleSaveUser = async (data: {
  name: string
  email: string
  role: string
  department: string
  status: 'Ativo' | 'Inativo'
  password?: string
  sodException?: boolean
  sodJustification?: string
}) => {
  if (data.sodException && (!data.sodJustification || data.sodJustification.trim().length < 10)) {
    showToast('A justificativa de exceção SoD deve conter no mínimo 10 caracteres.', 'error')
    return
  }

  try {
    if (isEditingUser.value && selectedUserToEdit.value) {
      const updated = await userService.updateUserAsync(selectedUserToEdit.value.id, {
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        status: data.status,
        sodException: data.sodException,
        sodJustification: data.sodJustification,
      })
      if (updated) {
        showToast(`Colaborador ${updated.name} atualizado com sucesso!`)
      }
    } else {
      const created = await userService.createUserAsync({
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        status: data.status,
        temporaryPassword: data.password,
        sodException: data.sodException,
        sodJustification: data.sodJustification,
      })
      showToast(`Novo colaborador ${created.name} cadastrado com sucesso!`)
    }

    isFormModalOpen.value = false
    await refreshData()
  } catch (error: unknown) {
    if (error instanceof DuplicateEmailError || (error as { name?: string })?.name === 'DuplicateEmailError') {
      showToast((error as Error).message, 'error')
    } else {
      showToast(extractApiErrorMessage(error, 'Falha ao salvar dados do colaborador.'), 'error')
    }
  }
}

const handleToggleUserStatus = async (user: UserItem) => {
  try {
    const updated = await userService.toggleUserStatusAsync(user.id, user.status, user.email)
    if (updated) {
      showToast(`Status de ${updated.name} alterado para ${updated.status}.`)
      await refreshData()
    }
  } catch (err: unknown) {
    showToast(extractApiErrorMessage(err, 'Ação bloqueada pelas regras de segurança.'), 'error')
  }
}

// -------------------------------------------------------------
// Subpermissões Granulares por Usuário
// TODO: Aguardando endpoint no API4-BACK (permissões individuais fora do perfil)
// -------------------------------------------------------------
/*
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

const getPermKey = (p: PermissionDefinition) => `${p.modulo}:${p.subpermissao}`

const uniqueModules = computed(() => {
  const set = new Set<string>()
  allPermissions.value.forEach((p) => set.add(p.modulo))
  return Array.from(set)
})

const filteredPermissionDefs = computed(() => {
  return allPermissions.value.filter((p) => {
    const matchesMod = !permModuleFilter.value || p.modulo === permModuleFilter.value
    const matchesQuery =
      !permSearchFilter.value ||
      p.modulo.toLowerCase().includes(permSearchFilter.value.toLowerCase()) ||
      p.subpermissao.toLowerCase().includes(permSearchFilter.value.toLowerCase())
    return matchesMod && matchesQuery
  })
})

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
  showToast(`Permissões restauradas para os padrões da role ${permUser.value.role}.`)
}

const saveUserPermissions = () => {
  if (!permUser.value) return
  userService.updateUserPermissions(permUser.value.id, Array.from(selectedPermissions.value))
  showToast(`Permissões de ${permUser.value.name} atualizadas com sucesso!`)
  closePermissionsModal()
  refreshData()
}
*/

// -------------------------------------------------------------
// Ações de Roles (Aba 2)
// -------------------------------------------------------------

const handleCreateRole = async (data: {
  id: string
  nome: string
  descricao: string
  permissions: string[]
}) => {
  try {
    const created = await roleService.createRole(data)
    showToast(`Papel customizado "${created.nome}" criado com sucesso!`)
    await refreshData()
  } catch (err: any) {
    showToast(err?.message || 'Falha ao criar papel customizado.', 'error')
  }
}

const handleDeleteRole = async (roleId: string) => {
  try {
    await roleService.deleteRole(roleId)
    showToast(`Papel "${roleId}" removido com sucesso!`)
    await refreshData()
  } catch (err: any) {
    showToast(err?.message || 'Não foi possível excluir o papel.', 'error')
  }
}
</script>

<template>
  <main class="users-view" data-testid="users-view">
    <!-- Cabeçalho Principal -->
    <header class="page-heading">
      <div class="heading-content">
        <div>
          <p class="eyebrow">Administração e Acesso</p>
          <h1>Gestão de Colaboradores e Permissões</h1>
          <p class="page-description">
            Gerencie colaboradores, configure papéis dinâmicos e audite trilhas de segurança e segregação de funções.
          </p>
        </div>
      </div>
    </header>

    <!-- Toast / Banner de Feedback -->
    <div
      v-if="toastMessage"
      class="alert-banner"
      :class="toastType === 'error' ? 'alert-danger' : 'alert-success'"
      data-testid="toast-feedback"
    >
      <FiAlertCircle v-if="toastType === 'error'" size="18" />
      <FiCheckCircle v-else size="18" />
      <span>{{ toastMessage }}</span>
      <button type="button" class="btn-toast-close" @click="toastMessage = ''">&times;</button>
    </div>

    <!-- Navegação por Abas Especializadas -->
    <div class="tabs-nav" data-testid="admin-tabs-nav">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'colaboradores' }"
        data-testid="tab-colaboradores"
        @click="activeTab = 'colaboradores'"
      >
        <FiUsers size="16" />
        <span>Colaboradores e Acessos</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'matriz' }"
        data-testid="tab-matriz"
        @click="activeTab = 'matriz'"
      >
        <FiShield size="16" />
        <span>Cargos e Permissões</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'auditoria' }"
        data-testid="tab-auditoria"
        @click="activeTab = 'auditoria'"
      >
        <FiClock size="16" />
        <span>Auditoria de Segurança</span>
      </button>
    </div>

    <!-- Conteúdo da Aba 1: Colaboradores e Acessos (Tarefa 1 e 8) -->
    <UserManagementTab
      v-if="activeTab === 'colaboradores'"
      :users="users"
      :available-roles="availableRoleOptions"
      :logged-in-admin-email="loggedInAdmin.email"
      @create-user="openCreateUserModal"
      @edit-user="openEditUserModal"
      @reset-password="openResetPasswordModal"
      @toggle-status="handleToggleUserStatus"
    />

    <!-- Conteúdo da Aba 2: Cargos e Permissões (Tarefas 4 e 9) -->
    <RolePermissionMatrix
      v-else-if="activeTab === 'matriz'"
      :roles="roles"
      :all-permissions="allPermissions"
      @create-role="handleCreateRole"
      @delete-role="handleDeleteRole"
    />

    <!-- Conteúdo da Aba 3: Auditoria de Segurança (Tarefa 3) -->
    <SecurityAuditTab
      v-else-if="activeTab === 'auditoria'"
      :events="securityEvents"
    />

    <!-- Modal de Cadastro / Edição de Colaborador (Tarefas 2, 5 e 10) -->
    <UserFormModal
      :is-open="isFormModalOpen"
      :is-editing="isEditingUser"
      :user-to-edit="selectedUserToEdit"
      :available-roles="availableRoleOptions"
      :logged-in-admin-email="loggedInAdmin.email"
      @close="isFormModalOpen = false"
      @save="handleSaveUser"
    />

    <!-- Modal de Redefinição de Senha do Colaborador (US13) -->
    <div
      v-if="isResetModalOpen && resetTargetUser"
      class="modal-backdrop"
      data-testid="reset-password-modal"
      @click.self="closeResetPasswordModal"
    >
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title-group">
            <FiKey size="20" class="icon-brand" />
            <div>
              <h3>Redefinir Senha</h3>
              <p class="subtitle">
                Definir nova senha de acesso para <strong>{{ resetTargetUser.name }}</strong>
              </p>
            </div>
          </div>
          <button type="button" class="btn-close" aria-label="Fechar" @click="closeResetPasswordModal">
            <FiX size="18" />
          </button>
        </div>

        <form @submit.prevent="handleResetPassword">
          <div class="modal-body">
            <div v-if="resetPasswordError" class="alert-banner alert-danger reset-error" role="alert">
              <FiAlertCircle size="16" />
              <span>{{ resetPasswordError }}</span>
            </div>

            <div class="form-group">
              <label for="reset-new-password" class="label">Nova Senha (mínimo 8 caracteres): *</label>
              <input
                id="reset-new-password"
                v-model="resetNewPassword"
                type="password"
                name="novaSenha"
                class="input"
                autocomplete="new-password"
                minlength="8"
                required
                data-testid="input-reset-new-password"
              />
            </div>

            <div class="form-group">
              <label for="reset-confirm-password" class="label">Confirmar Nova Senha: *</label>
              <input
                id="reset-confirm-password"
                v-model="resetConfirmPassword"
                type="password"
                name="confirmarNovaSenha"
                class="input"
                autocomplete="new-password"
                minlength="8"
                required
                data-testid="input-reset-confirm-password"
              />
            </div>

            <p class="reset-hint">
              Ao confirmar, todas as sessões ativas deste colaborador serão encerradas imediatamente.
            </p>
          </div>

          <div class="modal-footer-wrapper reset-footer">
            <button type="button" class="btn btn_outline" @click="closeResetPasswordModal">
              Cancelar
            </button>
            <button
              type="submit"
              class="btn btn_primary"
              :disabled="isResettingPassword"
              data-testid="btn-confirm-reset-password"
            >
              <FiCheck size="16" />
              <span>{{ isResettingPassword ? 'Salvando...' : 'Redefinir Senha' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- TODO: Aguardando endpoint no API4-BACK (permissões individuais fora do perfil)
    <div
      v-if="isPermModalOpen && permUser"
      class="modal-backdrop"
      data-testid="permissions-modal"
      @click.self="closePermissionsModal"
    >
      ...
    </div>
    -->
  </main>
</template>

<style scoped>
.users-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-heading {
  margin-bottom: 4px;
}

.eyebrow {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-brand, #f26522);
  margin: 0 0 4px;
}

h1 {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--color-heading, #f8fafc);
  margin: 0 0 6px;
}

.page-description {
  font-size: 0.88rem;
  color: var(--color-text-muted, #94a3b8);
  margin: 0;
}

.alert-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-radius: 8px;
  font-size: 0.86rem;
  font-weight: 500;
}

.alert-success {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #4ade80;
}

.alert-danger {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.btn-toast-close {
  margin-left: auto;
  background: transparent;
  border: none;
  color: currentColor;
  font-size: 1.2rem;
  cursor: pointer;
}

/* Abas de Navegação */
.tabs-nav {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--color-border, #334155);
  padding-bottom: 4px;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted, #94a3b8);
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.tab-btn:hover {
  color: var(--color-heading, #f8fafc);
}

.tab-btn.active {
  color: var(--color-brand, #f26522);
  border-bottom-color: var(--color-brand, #f26522);
}

/* Modal de Permissões */
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
  max-width: 600px;
  width: 100%;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.modal-lg {
  max-width: 780px;
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
  gap: 12px;
}

.icon-brand {
  color: var(--color-brand, #f26522);
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
}

.modal-body {
  padding: 20px 24px;
}

.perm-filters-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-perm-input {
  flex: 1;
  min-width: 220px;
}

.select-module-filter {
  min-width: 160px;
}

.btn-reset-role {
  white-space: nowrap;
  font-size: 0.8rem;
}

.permissions-table-wrapper {
  max-height: 380px;
  overflow-y: auto;
  border: 1px solid var(--color-border, #334155);
  border-radius: 8px;
}

.perm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.perm-table th,
.perm-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border, #334155);
}

.perm-table th {
  background: var(--color-background, #0f172a);
  color: var(--color-heading, #f8fafc);
  font-weight: 700;
  text-align: left;
}

.module-tag {
  font-size: 0.74rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.15);
  color: #cbd5e1;
}

.cell-subperm code {
  color: var(--color-heading, #f8fafc);
}

.toggle-perm-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
}

.is-granted {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.is-revoked {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.modal-footer-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #334155);
}

.summary-text {
  font-size: 0.8rem;
  color: var(--color-text-muted, #94a3b8);
}

.modal-footer-btns {
  display: flex;
  gap: 10px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-heading, #f8fafc);
}

.reset-error {
  margin-bottom: 14px;
}

.reset-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-muted, #94a3b8);
}

.reset-footer {
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  margin-top: 0;
}
</style>
