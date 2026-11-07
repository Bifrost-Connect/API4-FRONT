<script setup lang="ts">
/**
 * View de visualização e gerenciamento do perfil do usuário logado.
 * Atua puramente na camada de apresentação visual, delegando toda a
 * lógica de dados, persistência e validação ao profileService.
 */
import { ref, onMounted } from 'vue'
import {
  FiUser,
  FiMail,
  FiShield,
  FiKey,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiSave,
} from 'vue-icons-plus/fi'
import { profileService, type UserProfile } from '../services/profile'

const profile = ref<UserProfile>(profileService.getProfile())

// Formulário de dados cadastrais
const formName = ref('')
const formEmail = ref('')
const formCargo = ref('')
const formDepartamento = ref('')

// Formulário de alteração de senha
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

// Feedbacks visuais
const profileSuccessMsg = ref('')
const passwordSuccessMsg = ref('')
const passwordErrorMsg = ref('')

const syncFormWithProfile = () => {
  profile.value = profileService.getProfile()
  formName.value = profile.value.name
  formEmail.value = profile.value.email
  formCargo.value = profile.value.cargo
  formDepartamento.value = profile.value.departamento
}

onMounted(() => {
  syncFormWithProfile()
})

const handleSaveProfile = () => {
  const result = profileService.updateProfile({
    name: formName.value,
    email: formEmail.value,
    cargo: formCargo.value,
    departamento: formDepartamento.value,
  })

  if (result.success) {
    profile.value = profileService.getProfile()
    profileSuccessMsg.value = result.message
    setTimeout(() => {
      profileSuccessMsg.value = ''
    }, 4000)
  }
}

const handleChangePassword = () => {
  passwordErrorMsg.value = ''
  passwordSuccessMsg.value = ''

  const result = profileService.changePassword({
    currentPassword: currentPassword.value,
    newPassword: newPassword.value,
    confirmPassword: confirmPassword.value,
  })

  if (result.success) {
    passwordSuccessMsg.value = result.message
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    setTimeout(() => {
      passwordSuccessMsg.value = ''
    }, 4000)
  } else {
    passwordErrorMsg.value = result.message
  }
}
</script>

<template>
  <main class="profile-view">
    <header class="page-heading">
      <div>
        <p class="eyebrow">Minha Conta</p>
        <h1>Meu Perfil</h1>
        <p class="page-description">
          Gerenciamento de credenciais, informações cadastrais e nível de acesso ao GeoRural.
        </p>
      </div>
    </header>

    <div class="profile-grid">
      <!-- Card lateral de resumo do usuário -->
      <section class="card user-summary-card">
        <div class="avatar-wrapper">
          <div class="avatar">
            <FiUser size="48" />
          </div>
          <span class="role-badge" :class="profile.role.toLowerCase()">
            <FiShield size="14" />
            {{ profile.role }}
          </span>
        </div>

        <div class="user-info-brief">
          <h2 class="user-display-name">{{ profile.name }}</h2>
          <p class="user-display-email">{{ profile.email }}</p>
        </div>

        <hr class="card-divider" />

        <div class="quick-meta-list">
          <div class="meta-item">
            <span class="meta-label"><FiClock size="14" /> Último login:</span>
            <span class="meta-val">{{ profile.lastLogin }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label"><FiShield size="14" /> Status da Conta:</span>
            <span class="meta-val status-active">{{ profile.status }}</span>
          </div>
        </div>
      </section>

      <!-- Painel Principal de Configurações -->
      <div class="profile-content">
        <!-- Notificação de sucesso geral -->
        <div v-if="profileSuccessMsg" class="alert-banner alert-success">
          <FiCheckCircle size="18" />
          <span>{{ profileSuccessMsg }}</span>
        </div>

        <!-- Seção: Informações Pessoais -->
        <section class="card section-card">
          <div class="card-header">
            <h3>Informações Cadastrais</h3>
            <p>Atualize suas informações de identificação e departamento.</p>
          </div>

          <form @submit.prevent="handleSaveProfile" class="form-layout">
            <div class="form-row two-cols">
              <div class="form-group">
                <label for="name" class="label">Nome Completo</label>
                <div class="input-with-icon">
                  <FiUser class="input-icon" size="16" />
                  <input
                    id="name"
                    v-model="formName"
                    type="text"
                    class="input input-indented"
                    required
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="email" class="label">E-mail Corporativo</label>
                <div class="input-with-icon">
                  <FiMail class="input-icon" size="16" />
                  <input
                    id="email"
                    v-model="formEmail"
                    type="email"
                    class="input input-indented"
                    required
                  />
                </div>
              </div>
            </div>

            <div class="form-row two-cols">
              <div class="form-group">
                <label for="cargo" class="label">Cargo / Função</label>
                <input id="cargo" v-model="formCargo" type="text" class="input" />
              </div>

              <div class="form-group">
                <label for="depto" class="label">Departamento / Diretoria</label>
                <input id="depto" v-model="formDepartamento" type="text" class="input" />
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn_primary">
                <FiSave size="16" />
                Salvar Alterações
              </button>
            </div>
          </form>
        </section>

        <!-- Seção: Alterar Senha -->
        <section class="card section-card">
          <div class="card-header">
            <h3>Segurança e Senha</h3>
            <p>Recomendamos o uso de senhas fortes com números e caracteres especiais.</p>
          </div>

          <div v-if="passwordSuccessMsg" class="alert-banner alert-success">
            <FiCheckCircle size="18" />
            <span>{{ passwordSuccessMsg }}</span>
          </div>
          <div v-if="passwordErrorMsg" class="alert-banner alert-danger">
            <FiAlertCircle size="18" />
            <span>{{ passwordErrorMsg }}</span>
          </div>

          <form @submit.prevent="handleChangePassword" class="form-layout">
            <div class="form-group">
              <label for="cur-pass" class="label">Senha Atual</label>
              <div class="input-with-icon">
                <FiKey class="input-icon" size="16" />
                <input
                  id="cur-pass"
                  v-model="currentPassword"
                  type="password"
                  class="input input-indented"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div class="form-row two-cols">
              <div class="form-group">
                <label for="new-pass" class="label">Nova Senha</label>
                <div class="input-with-icon">
                  <FiKey class="input-icon" size="16" />
                  <input
                    id="new-pass"
                    v-model="newPassword"
                    type="password"
                    class="input input-indented"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="confirm-pass" class="label">Confirmar Nova Senha</label>
                <div class="input-with-icon">
                  <FiKey class="input-icon" size="16" />
                  <input
                    id="confirm-pass"
                    v-model="confirmPassword"
                    type="password"
                    class="input input-indented"
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn_outline">Atualizar Senha</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.profile-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
}

.page-heading {
  margin-bottom: 28px;
}

.eyebrow {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--vis-brand-orange, #e67e22);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.page-heading h1 {
  font-size: 1.85rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 6px;
}

.page-description {
  color: var(--color-text-muted, #718096);
  font-size: 0.95rem;
}

.profile-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 28px;
  align-items: start;
}

@media (max-width: 900px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}

.card {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.user-summary-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.avatar-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

.avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--color-background-soft, #f7fafc);
  color: var(--vis-brand-orange, #e67e22);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid var(--vis-brand-orange, #e67e22);
  margin-bottom: 10px;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: #edf2f7;
  color: #4a5568;
}

.role-badge.administrador {
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

.role-badge.operador {
  background: #c6f6d5;
  color: #22543d;
}

.user-display-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 4px;
}

.user-display-email {
  font-size: 0.88rem;
  color: var(--color-text-muted, #718096);
}

.card-divider {
  width: 100%;
  border: 0;
  border-top: 1px solid var(--color-border, #e2e8f0);
  margin: 20px 0;
}

.quick-meta-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 0.86rem;
  margin-bottom: 8px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meta-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-muted, #718096);
}

.meta-val {
  font-weight: 600;
  color: var(--color-heading);
}

.meta-val.status-active {
  color: #38a169;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-header h3 {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 4px;
}

.card-header p {
  font-size: 0.86rem;
  color: var(--color-text-muted, #718096);
}

.form-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row.two-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 640px) {
  .form-row.two-cols {
    grid-template-columns: 1fr;
  }
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

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-muted, #a0aec0);
  pointer-events: none;
}

.input-indented {
  padding-left: 38px !important;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.alert-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 500;
}

.alert-success {
  background-color: #f0fff4;
  color: #276749;
  border: 1px solid #c6f6d5;
}

.alert-danger {
  background-color: #fff5f5;
  color: #9b2c2c;
  border: 1px solid #fed7d7;
}
</style>
