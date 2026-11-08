<script setup lang="ts">
/**
 * Aba 2: Matriz de Perfis e Permissões - RBAC (Tarefas 4 e 9).
 * Matriz Módulos × Cargos com trava imutável de Read-Only do Auditor
 * e capacidade de criar, editar e excluir papéis customizados.
 */
import { ref, computed } from 'vue'
import {
  FiShield,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiX,
  FiLock,
  FiInfo,
  FiSave,
} from 'vue-icons-plus/fi'
import type { RoleDef, PermissionDefinition } from '@/mocks/user.mock'
import { isAuditorReadOnlyLocked, hasSoDConflict } from '@/utils/rbac'
import SodExceptionModal from './SodExceptionModal.vue'

const props = defineProps<{
  roles: RoleDef[]
  allPermissions: PermissionDefinition[]
}>()

const emit = defineEmits<{
  (e: 'create-role', role: { id: string; nome: string; descricao: string; permissions: string[] }): void
  (e: 'update-role', roleId: string, role: { nome: string; descricao: string; permissions: string[] }): void
  (e: 'delete-role', roleId: string): void
}>()

// Modal de Novo Cargo Customizado
const isCreateRoleModalOpen = ref(false)
const newRoleId = ref('')
const newRoleName = ref('')
const newRoleDesc = ref('')
const newRolePermissions = ref<Set<string>>(new Set())
const createRoleError = ref('')

// Modal SoD para criação de cargo
const isSodModalOpen = ref(false)

// Agrupa permissões por módulo
const groupedPermissions = computed(() => {
  const groups: Record<string, PermissionDefinition[]> = {}
  props.allPermissions.forEach((p) => {
    if (!groups[p.modulo]) groups[p.modulo] = []
    groups[p.modulo]!.push(p)
  })
  return groups
})

const getPermKey = (p: PermissionDefinition) => `${p.modulo}:${p.subpermissao}`

const roleHasPermission = (role: RoleDef, permKey: string): boolean => {
  return role.permissions.includes(permKey)
}

// Verifica se uma permissão está bloqueada para edição nesta role
const isPermissionLockedForRole = (role: RoleDef, permKey: string): boolean => {
  if (role.id === 'AUDITOR') {
    return isAuditorReadOnlyLocked(permKey)
  }
  return false
}

const openCreateRoleModal = () => {
  newRoleId.value = ''
  newRoleName.value = ''
  newRoleDesc.value = ''
  newRolePermissions.value = new Set()
  createRoleError.value = ''
  isCreateRoleModalOpen.value = true
}

const toggleNewRolePermission = (permKey: string) => {
  const updated = new Set(newRolePermissions.value)
  if (updated.has(permKey)) {
    updated.delete(permKey)
  } else {
    updated.add(permKey)
  }
  newRolePermissions.value = updated
}

const submitCreateRole = () => {
  if (!newRoleId.value.trim() || !newRoleName.value.trim()) {
    createRoleError.value = 'Informe o identificador e o nome do cargo.'
    return
  }

  const perms = Array.from(newRolePermissions.value)
  if (hasSoDConflict(perms)) {
    isSodModalOpen.value = true
    return
  }

  finishCreateRole()
}

const finishCreateRole = () => {
  emit('create-role', {
    id: newRoleId.value.trim().toUpperCase(),
    nome: newRoleName.value.trim(),
    descricao: newRoleDesc.value.trim(),
    permissions: Array.from(newRolePermissions.value),
  })
  isCreateRoleModalOpen.value = false
}

const onSodConfirm = () => {
  isSodModalOpen.value = false
  finishCreateRole()
}
</script>

<template>
  <div class="matrix-container" data-testid="role-permission-matrix">
    <!-- Cabeçalho da Matriz com Botão de Novo Cargo -->
    <div class="matrix-header-bar">
      <div>
        <h3>Matriz de Permissões RBAC por Módulo</h3>
        <p class="subtitle">
          Consulte e configure as permissões associadas a cada papel operacional do sistema GeoRural.
        </p>
      </div>

      <button
        type="button"
        class="btn btn_primary btn-add-role"
        data-testid="btn-open-create-role"
        @click="openCreateRoleModal"
      >
        <FiPlus size="16" />
        <span>Novo Cargo Customizado</span>
      </button>
    </div>

    <!-- Tabela da Matriz -->
    <div class="matrix-table-wrap">
      <table class="matrix-table" data-testid="matrix-table">
        <thead>
          <tr>
            <th class="th-module">Módulo e Permissão</th>
            <th
              v-for="role in roles"
              :key="role.id"
              class="th-role"
              :class="{ 'th-role-custom': !role.padrao }"
              data-testid="th-role"
            >
              <div class="role-header-content">
                <div class="role-header-title">
                  <span class="role-tag" :class="role.id.toLowerCase()">{{ role.nome }}</span>
                  <span v-if="!role.padrao" class="badge-custom">Custom</span>
                </div>
                <p class="role-desc">{{ role.descricao }}</p>

                <button
                  v-if="!role.padrao"
                  type="button"
                  class="btn-delete-role"
                  title="Excluir cargo customizado"
                  data-testid="btn-delete-custom-role"
                  @click="$emit('delete-role', role.id)"
                >
                  <FiTrash2 size="13" />
                  <span>Excluir</span>
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(perms, moduleName) in groupedPermissions" :key="moduleName">
            <!-- Cabeçalho do Módulo -->
            <tr class="tr-module-heading">
              <td :colspan="roles.length + 1">
                <strong>{{ moduleName }}</strong>
              </td>
            </tr>

            <!-- Linhas de Subpermissões -->
            <tr v-for="perm in perms" :key="getPermKey(perm)" class="tr-perm-row">
              <td class="td-perm-name">
                <span class="perm-key">{{ perm.subpermissao }}</span>
              </td>

              <!-- Célula para cada Role -->
              <td
                v-for="role in roles"
                :key="role.id"
                class="td-perm-status"
                :data-testid="`cell-${role.id}-${perm.modulo}-${perm.subpermissao}`"
              >
                <!-- Trava Imutável do Auditor para Ações Não-Read-Only (Tarefa 9) -->
                <div
                  v-if="role.id === 'AUDITOR' && isPermissionLockedForRole(role, getPermKey(perm))"
                  class="locked-cell"
                  title="O perfil Auditor Ambiental possui trava imutável de Somente Leitura (Read-Only)."
                  data-testid="auditor-locked-cell"
                >
                  <FiLock size="13" class="lock-icon" />
                  <span class="lock-text">Bloqueado</span>
                </div>

                <!-- Indicador de Permissão Concedida / Ausente -->
                <div v-else class="perm-indicator">
                  <span
                    v-if="roleHasPermission(role, getPermKey(perm))"
                    class="badge-perm-allowed"
                    title="Permissão concedida"
                  >
                    <FiCheck size="14" />
                  </span>
                  <span v-else class="badge-perm-denied" title="Permissão bloqueada">
                    &bull;
                  </span>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Modal de Criação de Cargo Customizado -->
    <div
      v-if="isCreateRoleModalOpen"
      class="modal-backdrop"
      data-testid="create-role-modal"
      @click.self="isCreateRoleModalOpen = false"
    >
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title-group">
            <FiShield size="20" class="icon-brand" />
            <h3>Criar Novo Cargo Customizado</h3>
          </div>
          <button type="button" class="btn-close" @click="isCreateRoleModalOpen = false">
            <FiX size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div v-if="createRoleError" class="alert alert-danger mb-3">
            {{ createRoleError }}
          </div>

          <div class="form-group">
            <label class="label">Identificador do Cargo (ID em Maiúsculas): *</label>
            <input
              v-model="newRoleId"
              type="text"
              class="input"
              placeholder="Ex.: ANALISTA_SENIOR"
              data-testid="input-new-role-id"
            />
          </div>

          <div class="form-group">
            <label class="label">Nome Exibido do Cargo: *</label>
            <input
              v-model="newRoleName"
              type="text"
              class="input"
              placeholder="Ex.: Analista Territorial Sênior"
              data-testid="input-new-role-name"
            />
          </div>

          <div class="form-group">
            <label class="label">Descrição da Finalidade:</label>
            <input
              v-model="newRoleDesc"
              type="text"
              class="input"
              placeholder="Ex.: Responsável por cruzamentos analíticos e auditoria avançada"
              data-testid="input-new-role-desc"
            />
          </div>

          <div class="form-group">
            <label class="label">Selecione as Permissões Autorizadas:</label>
            <div class="permissions-checklist">
              <div
                v-for="p in allPermissions"
                :key="getPermKey(p)"
                class="checklist-item"
              >
                <label class="check-label">
                  <input
                    type="checkbox"
                    :checked="newRolePermissions.has(getPermKey(p))"
                    @change="toggleNewRolePermission(getPermKey(p))"
                  />
                  <span><strong>{{ p.modulo }}</strong>: {{ p.subpermissao }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn_outline" @click="isCreateRoleModalOpen = false">
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn_primary"
            data-testid="btn-submit-new-role"
            @click="submitCreateRole"
          >
            <FiSave size="15" />
            <span>Criar Cargo</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal SoD caso crie cargo com acúmulo de funções -->
    <SodExceptionModal
      :is-open="isSodModalOpen"
      :user-name="newRoleName"
      @confirm="onSodConfirm"
      @cancel="isSodModalOpen = false"
    />
  </div>
</template>

<style scoped>
.matrix-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.matrix-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 10px;
  flex-wrap: wrap;
  gap: 14px;
}

h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-heading, #f8fafc);
}

.subtitle {
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: var(--color-text-muted, #94a3b8);
}

.btn-add-role {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.86rem;
}

.matrix-table-wrap {
  overflow-x: auto;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 10px;
}

.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.matrix-table th,
.matrix-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border, #334155);
}

.th-module {
  text-align: left;
  background: var(--color-background, #0f172a);
  color: var(--color-heading, #f8fafc);
  font-weight: 700;
  min-width: 220px;
  position: sticky;
  left: 0;
  z-index: 2;
}

.th-role {
  text-align: center;
  background: var(--color-background, #0f172a);
  min-width: 160px;
}

.role-header-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.role-header-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.role-tag {
  font-size: 0.74rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
  color: #f8fafc;
}

.badge-custom {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.role-desc {
  font-size: 0.7rem;
  color: var(--color-text-muted, #94a3b8);
  margin: 0;
  line-height: 1.2;
}

.btn-delete-role {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  margin-top: 4px;
  font-size: 0.7rem;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  cursor: pointer;
}

.btn-delete-role:hover {
  background: #ef4444;
  color: #fff;
}

.tr-module-heading td {
  background: rgba(15, 23, 42, 0.7);
  padding: 8px 14px;
  color: var(--color-brand, #f26522);
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.td-perm-name {
  background: var(--color-surface, #1e293b);
  position: sticky;
  left: 0;
  z-index: 1;
}

.perm-key {
  font-weight: 600;
  color: var(--color-heading, #f8fafc);
  font-size: 0.8rem;
}

.td-perm-status {
  text-align: center;
}

.badge-perm-allowed {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.18);
  color: #22c55e;
}

.badge-perm-denied {
  color: var(--color-text-muted, #475569);
  font-size: 1.2rem;
}

.locked-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(100, 116, 139, 0.15);
  color: #64748b;
  font-size: 0.68rem;
  font-weight: 600;
  border: 1px dashed #475569;
}

.lock-icon {
  color: #94a3b8;
}

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
  max-width: 640px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 12px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #334155);
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-brand {
  color: var(--color-brand, #f26522);
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted, #94a3b8);
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.permissions-checklist {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--color-border, #334155);
  border-radius: 6px;
  padding: 8px 12px;
  background: var(--color-background, #0f172a);
}

.checklist-item {
  padding: 4px 0;
}

.check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--color-heading, #f8fafc);
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border, #334155);
}
</style>
