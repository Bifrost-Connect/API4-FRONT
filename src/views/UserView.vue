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
  FiSave,
  FiLock,
} from 'vue-icons-plus/fi'
import UserManagementTab from '@/components/admin/UserManagementTab.vue'
import UserFormModal from '@/components/admin/UserFormModal.vue'
import RolePermissionMatrix from '@/components/admin/RolePermissionMatrix.vue'
import SecurityAuditTab from '@/components/admin/SecurityAuditTab.vue'
import ApiKeysTab from '@/components/admin/ApiKeysTab.vue'
import SodExceptionModal from '@/components/admin/SodExceptionModal.vue'
import { hasSoDConflict, isAuditorReadOnlyLocked } from '@/utils/rbac'
import {
  userService,
  DuplicateEmailError,
  type UserItem,
  type RoleDef,
  type PermissionDefinition,
  type SecurityEvent,
} from '@/services/user'
import { roleService } from '@/services/roles'
import { extractApiErrorMessage } from '@/services/api'

type AdminTab = 'colaboradores' | 'matriz' | 'auditoria' | 'chaves-api'

const hasPermission = (permissions: string[]) => userService.canAny(permissions)

const canViewUsers = computed(() => hasPermission(['USUARIOS:VISUALIZAR']))
const canViewRoles = computed(() => hasPermission(['ROLES:VISUALIZAR']))
const canViewAudit = computed(
  () =>
    hasPermission(['AUDITORIA:VISUALIZAR']) &&
    hasPermission(['USUARIOS:VISUALIZAR', 'ROLES:VISUALIZAR']),
)
const canViewApiKeys = computed(() => hasPermission(['API:VISUALIZAR_CHAVES']))

const resolveInitialTab = (): AdminTab => {
  if (canViewUsers.value) return 'colaboradores'
  if (canViewRoles.value) return 'matriz'
  if (canViewAudit.value) return 'auditoria'
  if (canViewApiKeys.value) return 'chaves-api'
  return 'colaboradores'
}

const activeTab = ref<AdminTab>(resolveInitialTab())

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

// Modal de Permissões Granulares por Usuário
const isPermModalOpen = ref(false)
const permUser = ref<UserItem | null>(null)
const selectedPermissions = ref<Set<string>>(new Set())
const permModuleFilter = ref('')
const permSearchFilter = ref('')
const isPermSodModalOpen = ref(false)

const loggedInAdmin = computed(() => userService.getCurrentUser())

const availableRoleOptions = computed(() => {
  return roles.value.map((r: RoleDef) => ({
    value: r.id,
    label: r.nome,
    desc: r.descricao,
  }))
})

const refreshData = async () => {
  if (canViewUsers.value) {
    users.value = await userService.getUsersAsync()
  }
  if (canViewRoles.value || canViewUsers.value) {
    roles.value = await roleService.getRoles()
  }
  allPermissions.value = userService.getAllPermissions()
  if (canViewAudit.value) {
    securityEvents.value = await userService.getSecurityEvents()
  }
}

onMounted(async () => {
  activeTab.value = resolveInitialTab()
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
      const target = selectedUserToEdit.value
      const trimmedPassword = data.password?.trim() || ''
      const isSelf = loggedInAdmin.value?.email
        ? target.email.toLowerCase() === loggedInAdmin.value.email.toLowerCase()
        : loggedInAdmin.value?.id !== undefined && target.id === loggedInAdmin.value.id

      const roleChanged = data.role !== target.role
      const statusChanged = data.status !== target.status
      const sodChanged =
        Boolean(data.sodException) !== Boolean(target.sodException) ||
        (Boolean(data.sodException) &&
          (data.sodJustification?.trim() || '') !== (target.sodJustification?.trim() || ''))
      const hasAccessChanges = roleChanged || statusChanged || sodChanged

      if (isSelf && !hasAccessChanges) {
        if (trimmedPassword) {
          await userService.resetPasswordAsync(target.id, trimmedPassword)
          showToast(`Senha de ${target.name} redefinida com sucesso!`)
        } else {
          showToast(`Nenhuma alteração de acesso ou senha aplicada para ${target.name}.`)
        }
      } else {
        const updated = await userService.updateUserAsync(target.id, {
          name: data.name,
          email: data.email,
          role: data.role,
          department: data.department,
          status: data.status,
          sodException: data.sodException,
          sodJustification: data.sodJustification,
        })
        if (trimmedPassword) {
          await userService.resetPasswordAsync(target.id, trimmedPassword)
        }
        if (updated) {
          showToast(`Colaborador ${updated.name} atualizado com sucesso!`)
        } else if (trimmedPassword) {
          showToast(`Senha de ${target.name} redefinida com sucesso!`)
        }
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
// -------------------------------------------------------------
const openPermissionsModal = (user: UserItem) => {
  permUser.value = user
  selectedPermissions.value = new Set(user.permissions)
  permModuleFilter.value = ''
  permSearchFilter.value = ''
  isPermSodModalOpen.value = false
  isPermModalOpen.value = true
}

const closePermissionsModal = () => {
  isPermSodModalOpen.value = false
  isPermModalOpen.value = false
  permUser.value = null
}

const getPermKey = (p: PermissionDefinition) => `${p.modulo}:${p.subpermissao}`

const isPermissionLockedForUser = (key: string): boolean => {
  if (permUser.value?.role !== 'AUDITOR') return false
  return key === 'MAPA:COMPARAR_SAFRAS' || isAuditorReadOnlyLocked(key)
}

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
  if (isPermissionLockedForUser(key)) {
    showToast('O perfil Auditor Ambiental possui trava imutável de Somente Leitura.', 'error')
    return
  }
  const updated = new Set(selectedPermissions.value)
  if (updated.has(key)) {
    updated.delete(key)
  } else {
    updated.add(key)
  }
  selectedPermissions.value = updated
}

const resetToRoleDefaults = async () => {
  if (!permUser.value) return
  const targetRole = permUser.value.role
  try {
    const defaults = await userService.resetPermissionsToRoleAsync(permUser.value.id)
    selectedPermissions.value = new Set(defaults)
    showToast(`Permissões restauradas para os padrões da role ${targetRole}.`)
    await refreshData()
    const refreshed = users.value.find((u) => u.id === permUser.value?.id)
    if (refreshed) permUser.value = refreshed
  } catch (err: unknown) {
    showToast(extractApiErrorMessage(err, 'Falha ao restaurar permissões do usuário.'), 'error')
  }
}

const persistUserPermissions = async (
  perms: string[],
  sod?: { sodException?: boolean; sodJustification?: string },
) => {
  if (!permUser.value) return
  const targetName = permUser.value.name
  try {
    const updated = await userService.updateUserPermissionsAsync(permUser.value.id, perms, sod)
    showToast(`Permissões de ${updated?.name || targetName} atualizadas com sucesso!`)
    closePermissionsModal()
    await refreshData()
  } catch (err: unknown) {
    showToast(extractApiErrorMessage(err, 'Falha ao atualizar permissões do usuário.'), 'error')
  }
}

const saveUserPermissions = async () => {
  if (!permUser.value) return
  const perms = Array.from(selectedPermissions.value)

  if (hasSoDConflict(perms) && !permUser.value.sodException) {
    isPermSodModalOpen.value = true
    return
  }

  await persistUserPermissions(
    perms,
    permUser.value.sodException
      ? { sodException: true, sodJustification: permUser.value.sodJustification }
      : undefined,
  )
}

const onPermSodConfirm = async (justification: string) => {
  isPermSodModalOpen.value = false
  await persistUserPermissions(Array.from(selectedPermissions.value), {
    sodException: true,
    sodJustification: justification,
  })
}

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
        v-if="canViewUsers"
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
        v-if="canViewRoles"
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
        v-if="canViewAudit"
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'auditoria' }"
        data-testid="tab-auditoria"
        @click="activeTab = 'auditoria'"
      >
        <FiClock size="16" />
        <span>Auditoria de Segurança</span>
      </button>

      <button
        v-if="canViewApiKeys"
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'chaves-api' }"
        data-testid="tab-chaves-api"
        @click="activeTab = 'chaves-api'"
      >
        <FiKey size="16" />
        <span>Chaves de API</span>
      </button>
    </div>

    <!-- Conteúdo da Aba 1: Colaboradores e Acessos (Tarefa 1 e 8) -->
    <UserManagementTab
      v-if="canViewUsers && activeTab === 'colaboradores'"
      :users="users"
      :available-roles="availableRoleOptions"
      :logged-in-admin-email="loggedInAdmin.email"
      @create-user="openCreateUserModal"
      @edit-user="openEditUserModal"
      @manage-permissions="openPermissionsModal"
      @toggle-status="handleToggleUserStatus"
    />

    <!-- Conteúdo da Aba 2: Cargos e Permissões (Tarefas 4 e 9) -->
    <RolePermissionMatrix
      v-else-if="canViewRoles && activeTab === 'matriz'"
      :roles="roles"
      :all-permissions="allPermissions"
      @create-role="handleCreateRole"
      @delete-role="handleDeleteRole"
    />

    <!-- Conteúdo da Aba 3: Auditoria de Segurança (Tarefa 3) -->
    <SecurityAuditTab
      v-else-if="canViewAudit && activeTab === 'auditoria'"
      :events="securityEvents"
    />

    <!-- Conteúdo da Aba 4: Chaves de API e Logs Externos (US12) -->
    <ApiKeysTab v-else-if="canViewApiKeys && activeTab === 'chaves-api'" />

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

    <!-- Modal de Gerenciamento Exclusivo de Subpermissões -->
    <div
      v-if="isPermModalOpen && permUser"
      class="modal-backdrop"
      data-testid="permissions-modal"
      @click.self="closePermissionsModal"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-header">
          <div class="modal-title-group">
            <FiShield size="22" class="icon-brand" />
            <div>
              <h3>Gerenciar Permissões de {{ permUser.name }}</h3>
              <p class="subtitle">
                Cargo base: <strong>{{ permUser.role }}</strong> &bull; Personalize as capacidades deste usuário
              </p>
            </div>
          </div>
          <button type="button" class="btn-close" aria-label="Fechar" @click="closePermissionsModal">
            <FiX size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="perm-filters-row">
            <input
              v-model="permSearchFilter"
              type="text"
              class="input search-perm-input"
              placeholder="Filtrar por nome da ação ou módulo..."
              data-testid="input-perm-search"
            />
            <select
              v-model="permModuleFilter"
              class="select select-module-filter"
              data-testid="select-perm-module"
            >
              <option value="">Todos os Módulos</option>
              <option v-for="m in uniqueModules" :key="m" :value="m">{{ m }}</option>
            </select>
            <button
              type="button"
              class="btn btn_outline btn-reset-role"
              data-testid="btn-reset-role-permissions"
              @click="resetToRoleDefaults"
            >
              Restaurar Padrão do Cargo
            </button>
          </div>

          <div class="permissions-table-wrapper">
            <table class="perm-table">
              <thead>
                <tr>
                  <th class="th-module">Módulo</th>
                  <th class="th-subperm">Subpermissão</th>
                  <th class="th-status">Status de Acesso</th>
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
                      v-if="isPermissionLockedForUser(getPermKey(p))"
                      type="button"
                      class="toggle-perm-btn is-locked"
                      disabled
                      title="O perfil Auditor Ambiental possui trava imutável de Somente Leitura (Read-Only)."
                      :data-testid="`toggle-perm-${p.modulo}-${p.subpermissao}`"
                    >
                      <FiLock size="14" />
                      <span>Bloqueado</span>
                    </button>
                    <button
                      v-else
                      type="button"
                      class="toggle-perm-btn"
                      :class="selectedPermissions.has(getPermKey(p)) ? 'is-granted' : 'is-revoked'"
                      :data-testid="`toggle-perm-${p.modulo}-${p.subpermissao}`"
                      @click.stop="togglePermission(getPermKey(p))"
                    >
                      <template v-if="selectedPermissions.has(getPermKey(p))">
                        <FiCheck size="15" />
                        <span>Permitido</span>
                      </template>
                      <template v-else>
                        <FiX size="15" />
                        <span>Sem Acesso</span>
                      </template>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="modal-footer-wrapper">
            <span class="summary-text">
              Total concedido: <strong>{{ selectedPermissions.size }}</strong> de
              {{ allPermissions.length }} subpermissões do sistema.
            </span>
            <div class="modal-footer-btns">
              <button
                type="button"
                class="btn btn_outline"
                data-testid="btn-permissions-cancel"
                @click="closePermissionsModal"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="btn btn_primary"
                data-testid="btn-permissions-save"
                @click="saveUserPermissions"
              >
                <FiSave size="16" />
                <span>Salvar Permissões</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <SodExceptionModal
        :is-open="isPermSodModalOpen"
        :user-name="permUser.name"
        :initial-justification="permUser.sodJustification"
        @confirm="onPermSodConfirm"
        @cancel="isPermSodModalOpen = false"
      />
    </div>
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
  color: var(--color-brand);
  margin: 0 0 4px;
}

h1 {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--color-heading);
  margin: 0 0 6px;
}

.page-description {
  font-size: 0.88rem;
  color: var(--color-text-muted);
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
  background: var(--badge-success-bg);
  border: 1px solid var(--badge-success-border);
  color: var(--badge-success-text);
}

.alert-danger {
  background: var(--badge-danger-bg);
  border: 1px solid var(--badge-danger-border);
  color: var(--badge-danger-text);
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
  border-bottom: 1px solid var(--color-border);
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
  color: var(--color-text-muted);
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.tab-btn:hover {
  color: var(--color-heading);
}

.tab-btn.active {
  color: var(--color-brand);
  border-bottom-color: var(--color-brand);
}

/* Modal de Permissões */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
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
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
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
  border-bottom: 1px solid var(--color-border);
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-brand {
  color: var(--color-brand);
}

h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-heading);
}

.subtitle {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
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
  border: 1px solid var(--color-border);
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
  border-bottom: 1px solid var(--color-border);
}

.perm-table th {
  background: var(--color-surface-soft);
  color: var(--color-heading);
  font-weight: 700;
  text-align: left;
}

.module-tag {
  font-size: 0.74rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--badge-neutral-bg);
  color: var(--badge-neutral-text);
}

.cell-subperm code {
  color: var(--color-heading);
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
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
}

.is-revoked {
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
}

.is-locked {
  background: var(--badge-neutral-bg);
  color: var(--badge-neutral-text);
  cursor: not-allowed;
  opacity: 0.75;
}

.modal-footer-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.summary-text {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.modal-footer-btns {
  display: flex;
  gap: 10px;
}
</style>
