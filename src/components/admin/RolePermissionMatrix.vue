<script setup lang="ts">
/**
 * Aba 2: Matriz de Perfis e Permissões - RBAC (Tarefas 4 e 9).
 * Matriz Módulos × Cargos com trava imutável de Read-Only do Auditor.
 */
import { computed } from 'vue'
import { FiCheck, FiLock } from 'vue-icons-plus/fi'
import type { RoleDef, PermissionDefinition } from '@/types/access'
import { isAuditorReadOnlyLocked } from '@/utils/rbac'

const props = defineProps<{
  roles: RoleDef[]
  allPermissions: PermissionDefinition[]
}>()

defineEmits<{
  (e: 'create-role', role: { id: string; nome: string; descricao: string; permissions: string[] }): void
  (e: 'update-role', roleId: string, role: { nome: string; descricao: string; permissions: string[] }): void
  (e: 'delete-role', roleId: string): void
}>()

// TODO: Aguardando endpoint no API4-BACK (CRUD de cargos customizados e mutação SoD de papéis)
// const isCreateRoleModalOpen = ref(false)
// const newRoleId = ref('')
// const newRoleName = ref('')
// const newRoleDesc = ref('')
// const newRolePermissions = ref<Set<string>>(new Set())
// const createRoleError = ref('')
// const isSodModalOpen = ref(false)

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
</script>

<template>
  <div class="matrix-container" data-testid="role-permission-matrix">
    <!-- Cabeçalho da Matriz com Governança pelo Servidor -->
    <div class="matrix-header-bar">
      <div>
        <h3>Matriz de Permissões RBAC por Módulo</h3>
        <p class="subtitle">
          Consulte as permissões associadas a cada papel operacional governado pelo servidor GeoRural.
        </p>
      </div>

      <span class="server-governance-pill">
        <FiLock size="14" />
        <span>Perfis governados pelo Back-end</span>
      </span>

      <!-- TODO: Aguardando endpoint no API4-BACK (CRUD de cargos customizados /roles)
      <button
        type="button"
        class="btn btn_primary btn-add-role"
        data-testid="btn-open-create-role"
        @click="openCreateRoleModal"
      >
        <FiPlus size="16" />
        <span>Novo Cargo Customizado</span>
      </button>
      -->
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

                <!-- TODO: Aguardando endpoint no API4-BACK (exclusão de cargo customizado)
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
                -->
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

    <!-- TODO: Aguardando endpoint no API4-BACK (CRUD de cargos customizados /roles)
    <div
      v-if="isCreateRoleModalOpen"
      class="modal-backdrop"
      data-testid="create-role-modal"
      @click.self="isCreateRoleModalOpen = false"
    >
      ...
    </div>

    <SodExceptionModal
      :is-open="isSodModalOpen"
      :user-name="newRoleName"
      @confirm="onSodConfirm"
      @cancel="isSodModalOpen = false"
    />
    -->
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
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  flex-wrap: wrap;
  gap: 14px;
}

.server-governance-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--badge-neutral-bg);
  border: 1px solid var(--color-border);
}

h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-heading);
}

.subtitle {
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
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
  background: var(--color-surface);
  border: 1px solid var(--color-border);
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
  border-bottom: 1px solid var(--color-border);
}

.th-module {
  text-align: left;
  background: var(--color-surface-soft);
  color: var(--color-heading);
  font-weight: 700;
  min-width: 220px;
  position: sticky;
  left: 0;
  z-index: 2;
}

.th-role {
  text-align: center;
  background: var(--color-surface-soft);
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
  background: var(--badge-neutral-bg);
  color: var(--color-heading);
}

.badge-custom {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--badge-info-bg);
  color: var(--badge-info-text);
  border: 1px solid var(--badge-info-border);
}

.role-desc {
  font-size: 0.7rem;
  color: var(--color-text-muted);
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
  color: var(--badge-danger-text);
  background: var(--badge-danger-bg);
  border: 1px solid var(--badge-danger-border);
  border-radius: 4px;
  cursor: pointer;
}

.btn-delete-role:hover {
  background: var(--color-danger);
  color: var(--color-brand-contrast);
}

.tr-module-heading td {
  background: var(--color-surface-soft);
  padding: 8px 14px;
  color: var(--color-brand);
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.td-perm-name {
  background: var(--color-surface);
  position: sticky;
  left: 0;
  z-index: 1;
}

.perm-key {
  font-weight: 600;
  color: var(--color-heading);
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
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
}

.badge-perm-denied {
  color: var(--color-text-muted);
  font-size: 1.2rem;
}

.locked-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--badge-neutral-bg);
  color: var(--badge-neutral-text);
  font-size: 0.68rem;
  font-weight: 600;
  border: 1px dashed var(--color-border-hover);
}

.lock-icon {
  color: var(--color-text-muted);
}

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
  max-width: 640px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-brand {
  color: var(--color-brand);
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.permissions-checklist {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 8px 12px;
  background: var(--color-background);
}

.checklist-item {
  padding: 4px 0;
}

.check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--color-heading);
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border);
}
</style>
