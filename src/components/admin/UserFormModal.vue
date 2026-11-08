<script setup lang="ts">
/**
 * Modal de Cadastro e Edição de Usuário (Tarefas 2 e 10).
 * Validação rigorosa de campos obrigatórios, formato de e-mail e senha forte.
 */
import { ref, computed, watch } from 'vue'
import {
  FiUser,
  FiMail,
  FiLock,
  FiShield,
  FiBriefcase,
  FiX,
  FiCheck,
  FiAlertCircle,
} from 'vue-icons-plus/fi'
import type { UserItem, RoleOption } from '@/mocks/user.mock'
import { roleService } from '@/services/roles'
import { hasSoDConflict } from '@/utils/rbac'
import SodExceptionModal from './SodExceptionModal.vue'

const props = defineProps<{
  isOpen: boolean
  isEditing: boolean
  userToEdit?: UserItem | null
  availableRoles: RoleOption[]
  loggedInAdminEmail?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (
    e: 'save',
    data: {
      name: string
      email: string
      role: string
      department: string
      status: 'Ativo' | 'Inativo'
      password?: string
      sodException?: boolean
      sodJustification?: string
    },
  ): void
}>()

// Campos do formulário
const name = ref('')
const email = ref('')
const password = ref('')
const role = ref('ANALISTA')
const department = ref('Geoprocessamento')
const status = ref<'Ativo' | 'Inativo'>('Ativo')

// Exceção SoD
const isSodModalOpen = ref(false)
const pendingSodException = ref(false)
const pendingSodJustification = ref('')

// Controle de erros
const errors = ref<Record<string, string>>({})
const isSubmitted = ref(false)

// Trava contra auto-rebaixamento do Admin logado (Tarefa 8)
const isSelfAdmin = computed(() => {
  if (!props.isEditing || !props.userToEdit || !props.loggedInAdminEmail) return false
  return props.userToEdit.email.toLowerCase() === props.loggedInAdminEmail.toLowerCase()
})

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      errors.value = {}
      isSubmitted.value = false
      if (props.isEditing && props.userToEdit) {
        name.value = props.userToEdit.name
        email.value = props.userToEdit.email
        password.value = ''
        role.value = props.userToEdit.role
        department.value = props.userToEdit.department || 'Geral'
        status.value = props.userToEdit.status
        pendingSodException.value = Boolean(props.userToEdit.sodException)
        pendingSodJustification.value = props.userToEdit.sodJustification || ''
      } else {
        name.value = ''
        email.value = ''
        password.value = ''
        role.value = 'ANALISTA'
        department.value = 'Geoprocessamento'
        status.value = 'Ativo'
        pendingSodException.value = false
        pendingSodJustification.value = ''
      }
    }
  },
  { immediate: true },
)

// Regras de validação (Tarefa 10)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/

const validate = (): boolean => {
  const errs: Record<string, string> = {}

  if (!name.value.trim() || name.value.trim().length < 3) {
    errs.name = 'O nome completo deve conter pelo menos 3 caracteres.'
  }

  if (!email.value.trim() || !emailRegex.test(email.value.trim())) {
    errs.email = 'Informe um endereço de e-mail corporativo válido.'
  }

  // Senha obrigatória apenas no cadastro de novo usuário
  if (!props.isEditing) {
    if (!password.value) {
      errs.password = 'A senha temporária é obrigatória.'
    } else if (!passwordRegex.test(password.value)) {
      errs.password =
        'A senha deve conter no mínimo 8 caracteres, com letra maiúscula, minúscula, número e caractere especial.'
    }
  } else if (password.value && !passwordRegex.test(password.value)) {
    errs.password =
      'A nova senha deve conter no mínimo 8 caracteres, com letra maiúscula, minúscula, número e caractere especial.'
  }

  errors.value = errs
  return Object.keys(errs).length === 0
}

const handleSubmit = async () => {
  isSubmitted.value = true
  if (!validate()) return

  // Verifica se o papel selecionado possui conflito SoD (Tarefa 5)
  const roleDef = await roleService.getRoleById(role.value)
  const perms = roleDef ? roleDef.permissions : []
  const hasConflict = hasSoDConflict(perms)

  if (hasConflict && !pendingSodException.value) {
    isSodModalOpen.value = true
    return
  }

  emit('save', {
    name: name.value.trim(),
    email: email.value.trim(),
    role: role.value,
    department: department.value.trim(),
    status: status.value,
    password: password.value || undefined,
    sodException: pendingSodException.value,
    sodJustification: pendingSodJustification.value,
  })
}

const onSodConfirm = (justification: string) => {
  pendingSodException.value = true
  pendingSodJustification.value = justification
  isSodModalOpen.value = false

  emit('save', {
    name: name.value.trim(),
    email: email.value.trim(),
    role: role.value,
    department: department.value.trim(),
    status: status.value,
    password: password.value || undefined,
    sodException: true,
    sodJustification: justification,
  })
}
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" data-testid="user-form-modal" @click.self="$emit('close')">
    <div class="modal-dialog">
      <div class="modal-header">
        <div class="modal-title-group">
          <div class="icon-wrap" aria-hidden="true">
            <FiUser size="20" />
          </div>
          <div>
            <h3>{{ isEditing ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador' }}</h3>
            <p class="subtitle">
              {{ isEditing ? 'Atualize os dados e o papel de acesso do usuário' : 'Preencha os dados do novo membro da equipe' }}
            </p>
          </div>
        </div>
        <button type="button" class="btn-close" aria-label="Fechar" @click="$emit('close')">
          <FiX size="18" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="modal-body">
          <!-- Nome Completo -->
          <div class="form-group">
            <label for="form-name" class="label">
              Nome Completo: <span class="required">*</span>
            </label>
            <div class="input-wrap">
              <FiUser class="field-icon" size="16" />
              <input
                id="form-name"
                v-model="name"
                type="text"
                class="input input-with-icon"
                :class="{ 'input-error': isSubmitted && errors.name }"
                placeholder="Ex.: Carlos Mendes"
                data-testid="input-user-name"
              />
            </div>
            <p v-if="isSubmitted && errors.name" class="field-error" data-testid="error-user-name">
              <FiAlertCircle size="12" /> {{ errors.name }}
            </p>
          </div>

          <!-- E-mail -->
          <div class="form-group">
            <label for="form-email" class="label">
              E-mail Corporativo: <span class="required">*</span>
            </label>
            <div class="input-wrap">
              <FiMail class="field-icon" size="16" />
              <input
                id="form-email"
                v-model="email"
                type="email"
                class="input input-with-icon"
                :class="{ 'input-error': isSubmitted && errors.email }"
                placeholder="exemplo@georural.com.br"
                data-testid="input-user-email"
              />
            </div>
            <p v-if="isSubmitted && errors.email" class="field-error" data-testid="error-user-email">
              <FiAlertCircle size="12" /> {{ errors.email }}
            </p>
          </div>

          <!-- Senha Inicial / Temporária -->
          <div class="form-group">
            <label for="form-password" class="label">
              {{ isEditing ? 'Alterar Senha (Opcional):' : 'Senha Inicial Temporária: *' }}
            </label>
            <div class="input-wrap">
              <FiLock class="field-icon" size="16" />
              <input
                id="form-password"
                v-model="password"
                type="password"
                class="input input-with-icon"
                :class="{ 'input-error': isSubmitted && errors.password }"
                :placeholder="isEditing ? 'Deixe em branco para manter a atual' : 'Ex.: GeoRural#2026'"
                data-testid="input-user-password"
              />
            </div>
            <p v-if="isSubmitted && errors.password" class="field-error" data-testid="error-user-password">
              <FiAlertCircle size="12" /> {{ errors.password }}
            </p>
            <p v-else class="field-hint">Mínimo de 8 caracteres com maiúscula, minúscula, número e símbolo.</p>
          </div>

          <!-- Grid: Cargo/Perfil e Departamento -->
          <div class="form-row">
            <!-- Cargo -->
            <div class="form-group flex-1">
              <label for="form-role" class="label">
                Cargo Atribuído: <span class="required">*</span>
              </label>
              <div class="input-wrap">
                <FiShield class="field-icon" size="16" />
                <select
                  id="form-role"
                  v-model="role"
                  class="select select-with-icon"
                  :disabled="isSelfAdmin"
                  :title="isSelfAdmin ? 'Você não pode alterar seu próprio cargo de Administrador.' : ''"
                  data-testid="select-user-role"
                >
                  <option v-for="r in availableRoles" :key="r.value" :value="r.value">
                    {{ r.label }}
                  </option>
                </select>
              </div>
              <p v-if="isSelfAdmin" class="field-hint warning-hint">
                Auto-rebaixamento bloqueado para a conta administrativa ativa.
              </p>
            </div>

            <!-- Departamento -->
            <div class="form-group flex-1">
              <label for="form-dept" class="label">Departamento:</label>
              <div class="input-wrap">
                <FiBriefcase class="field-icon" size="16" />
                <input
                  id="form-dept"
                  v-model="department"
                  type="text"
                  class="input input-with-icon"
                  placeholder="Ex.: Operações de Ingestão"
                  data-testid="input-user-department"
                />
              </div>
            </div>
          </div>

          <!-- Status da Conta -->
          <div class="form-group">
            <label class="label">Status da Conta:</label>
            <div class="status-options">
              <label class="radio-label">
                <input
                  type="radio"
                  v-model="status"
                  value="Ativo"
                  name="user-status"
                  data-testid="radio-status-ativo"
                />
                <span>Ativo (Acesso liberado)</span>
              </label>
              <label class="radio-label">
                <input
                  type="radio"
                  v-model="status"
                  value="Inativo"
                  name="user-status"
                  :disabled="isSelfAdmin"
                  data-testid="radio-status-inativo"
                />
                <span>Inativo (Bloqueado)</span>
              </label>
            </div>
            <p v-if="isSelfAdmin" class="field-hint warning-hint">
              Auto-inativação bloqueada para o próprio Administrador logado.
            </p>
          </div>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn btn_outline"
            data-testid="btn-user-cancel"
            @click="$emit('close')"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="btn btn_primary"
            data-testid="btn-user-save"
          >
            <FiCheck size="16" />
            <span>{{ isEditing ? 'Salvar Alterações' : 'Concluir Cadastro' }}</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Modal de Exceção SoD (Tarefa 5) -->
    <SodExceptionModal
      :is-open="isSodModalOpen"
      :user-name="name"
      :initial-justification="pendingSodJustification"
      @confirm="onSodConfirm"
      @cancel="isSodModalOpen = false"
    />
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

.icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: rgba(242, 101, 34, 0.15);
  color: var(--color-brand, #f26522);
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

.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  gap: 14px;
}

.flex-1 {
  flex: 1;
}

.label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-heading, #f8fafc);
  margin-bottom: 6px;
}

.required {
  color: #ef4444;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-muted, #94a3b8);
  pointer-events: none;
}

.input-with-icon,
.select-with-icon {
  width: 100%;
  padding: 9px 12px 9px 36px;
  border-radius: 6px;
  background: var(--color-background, #0f172a);
  border: 1px solid var(--color-border, #334155);
  color: var(--color-heading, #f8fafc);
  font-size: 0.86rem;
  outline: none;
}

.input-with-icon:focus,
.select-with-icon:focus {
  border-color: var(--color-brand, #f26522);
  box-shadow: 0 0 0 2px rgba(242, 101, 34, 0.2);
}

.input-error {
  border-color: #ef4444 !important;
}

.field-error {
  color: #ef4444;
  font-size: 0.76rem;
  margin: 4px 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.field-hint {
  color: var(--color-text-muted, #94a3b8);
  font-size: 0.74rem;
  margin: 4px 0 0;
}

.warning-hint {
  color: #f59e0b;
}

.status-options {
  display: flex;
  gap: 20px;
  margin-top: 6px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.84rem;
  color: var(--color-heading, #f8fafc);
  cursor: pointer;
}

.radio-label input {
  accent-color: var(--color-brand, #f26522);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 24px;
  border-top: 1px solid var(--color-border, #334155);
  background: rgba(15, 23, 42, 0.3);
}

.btn_primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
