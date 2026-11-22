<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { AiOutlineEye, AiOutlineEyeInvisible } from 'vue-icons-plus/ai'
import { userService, type UserSession } from '../services/user'
import { homeFor, can, canAny } from '@/utils/rbac'
import { geojsonCache } from '@/services/storage/geojsonCache'
import { extractApiErrorMessage } from '@/services/api'

const router = useRouter()
const route = useRoute()
const email = ref('')
const senha = ref('')
const showPassword = ref(false)
/* const selectedRole = ref<string>(userService.getCurrentUser().role) */
const loginError = ref('')
const isSubmitting = ref(false)

/*
const SEED_CREDENTIALS: Record<string, { email: string; password: string }> = {
  Operador: { email: 'operador@georural.com.br', password: 'Troca123' },
  Auditor: { email: 'auditor@georural.com.br', password: 'Troca123' },
  Analista: { email: 'analista@georural.com.br', password: 'Troca123' },
  Administrador: { email: 'admin@georural.com.br', password: 'Troca123' },
  Gestor: { email: 'gestor@georural.com.br', password: 'Troca123' },
}

const fillLogin = (role: string) => {
  selectedRole.value = role
  const preset = SEED_CREDENTIALS[role]
  email.value = preset?.email ?? ''
  senha.value = preset?.password ?? ''
  loginError.value = ''
}
*/

const redirectAfterLogin = (user: UserSession) => {
  const rawRedirect = typeof route.query.redirect === 'string' ? route.query.redirect.trim() : null
  let cleanRedirect: string | null = null

  if (rawRedirect && rawRedirect.startsWith('/')) {
    const rawBase = import.meta.env?.BASE_URL || '/'
    const baseUrl = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase
    let path = rawRedirect
    if (baseUrl && path.startsWith(baseUrl)) {
      path = path.slice(baseUrl.length) || '/'
    }
    if (path !== '/login' && path !== '/acesso-negado') {
      cleanRedirect = path
    }
  }

  if (cleanRedirect) {
    try {
      const resolved = router.resolve(cleanRedirect)
      if (resolved && resolved.name && resolved.name !== 'login' && resolved.name !== 'forbidden') {
        const reqPerm = resolved.meta?.permission as string | string[] | undefined
        const hasAccess =
          !reqPerm || (Array.isArray(reqPerm) ? canAny(user, reqPerm) : can(user, reqPerm))

        if (hasAccess) {
          router.replace(cleanRedirect)
          return
        }
      }
    } catch {
      // Fallback em caso de erro na resolução da rota
    }
  }

  router.replace(homeFor(user))
}

const handleLogin = async () => {
  loginError.value = ''
  const trimmedEmail = email.value.trim()
  if (!trimmedEmail || !senha.value) {
    loginError.value = 'Informe e-mail e senha para entrar.'
    return
  }

  isSubmitting.value = true
  try {
    // Remove camadas restritas de sessões anteriores
    try {
      await geojsonCache.clearRestricted()
    } catch {}

    const user = await userService.loginWithCredentials(trimmedEmail, senha.value)
    redirectAfterLogin(user)
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status

    loginError.value = extractApiErrorMessage(
      err,
      status === 401
        ? 'E-mail ou senha inválidos, ou usuário inativo.'
        : 'Não foi possível conectar ao servidor de autenticação.',
    )
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="login-view">
    <div class="login-card">
      <div class="login-brand" data-testid="login-brand">
        <img
          src="/favicon.png"
          alt="Logo GeodataHub"
          class="brand-logo"
          width="44"
          height="44"
        />
        <div class="brand-info">
          <span class="brand-title">GeodataHub</span>
          <span class="brand-subtitle">Plataforma de Dados Geoespaciais</span>
        </div>
      </div>

      <div class="login-card-header">
        <h2>Login</h2>
        <p class="login-subtitle">Informe suas credenciais de acesso</p>
      </div>

      <div
        v-if="loginError"
        class="login-error-banner"
        role="alert"
        data-testid="login-error-banner"
      >
        {{ loginError }}
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="login-email" class="label">Email:</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            name="email"
            class="input"
            placeholder="nome@dominio.com.br"
            autocomplete="username"
            spellcheck="false"
            autocapitalize="none"
            enterkeyhint="next"
            required
            data-testid="login-email-input"
          />
        </div>
        <div class="form-group">
          <label for="login-password" class="label">Senha:</label>
          <div class="password-input-wrapper">
            <input
              id="login-password"
              v-model="senha"
              :type="showPassword ? 'text' : 'password'"
              name="password"
              class="input password-input"
              placeholder="Digite sua senha"
              autocomplete="current-password"
              enterkeyhint="done"
              required
              data-testid="login-password-input"
            />
            <button
              type="button"
              class="btn-visualizar"
              :aria-pressed="showPassword"
              :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
              title="Mostrar/Ocultar senha"
              @click="showPassword = !showPassword"
            >
              <AiOutlineEyeInvisible v-if="showPassword" size="20" />
              <AiOutlineEye v-else size="20" />
            </button>
          </div>
        </div>
        <button
          type="submit"
          class="btn btn_primary"
          :disabled="isSubmitting"
          data-testid="login-submit-btn"
        >
          {{ isSubmitting ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>
    </div>

    <!-- Acesso Rápido comentado temporariamente
    <div class="notice-card">
      <h3 class="aviso">Acesso Rápido (Ambiente de Homologação)</h3>
      <p>
        Escolha um perfil para preencher automaticamente o e-mail e senha de teste no formulário de login.
      </p>
      <div class="roles-container">
        <button
          type="button"
          class="btn btn_outline"
          :class="{ 'role-selected': selectedRole === 'Operador' }"
          @click="fillLogin('Operador')"
        >
          Entrar Operador
        </button>
        <button
          type="button"
          class="btn btn_outline"
          :class="{ 'role-selected': selectedRole === 'Analista' }"
          @click="fillLogin('Analista')"
        >
          Entrar Analista
        </button>
        <button
          type="button"
          class="btn btn_outline"
          :class="{ 'role-selected': selectedRole === 'Auditor' }"
          @click="fillLogin('Auditor')"
        >
          Entrar Auditor
        </button>
        <button
          type="button"
          class="btn btn_outline"
          :class="{ 'role-selected': selectedRole === 'Gestor' }"
          @click="fillLogin('Gestor')"
        >
          Entrar Gestor
        </button>
        <button
          type="button"
          class="btn btn_outline"
          :class="{ 'role-selected': selectedRole === 'Administrador' }"
          @click="fillLogin('Administrador')"
        >
          Entrar Administrador
        </button>
      </div>
    </div>
    -->
  </div>
</template>

<style scoped>
.login-view {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  min-height: 100%;
  padding: 2rem 1.25rem;
  flex-wrap: wrap;
}

.login-card,
.notice-card {
  display: flex;
  flex-direction: column;
  padding: 2.25rem 2rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background-color: var(--color-surface);
  width: 100%;
  max-width: 420px;
  box-shadow: var(--shadow-md);
}

.login-card {
  align-items: stretch;
  border-top: 3px solid var(--color-brand);
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding-bottom: 1.25rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.brand-logo {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: contain;
  background-color: var(--color-surface-soft);
  padding: 0.25rem;
  border: 1px solid var(--color-border);
}

.brand-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.brand-title {
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-heading);
  letter-spacing: -0.01em;
}

.brand-subtitle {
  font-size: 0.8rem;
  line-height: 1.3;
  color: var(--color-text-muted);
}

.login-card-header {
  margin-bottom: 1.5rem;
}

.login-card-header h2 {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-heading);
}

.login-subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.login-error-banner {
  margin-bottom: 1.25rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--badge-danger-border);
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
  font-size: 0.85rem;
  font-weight: 500;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.125rem;
}

.form-group .label {
  margin-bottom: 0.45rem;
  font-weight: 600;
  color: var(--color-heading);
}

.login-card .input {
  min-height: 42px;
  padding: 0.625rem 0.875rem;
  border-radius: 6px;
  background-color: var(--color-surface-soft);
  color: var(--color-text);
  border-color: var(--color-border);
}

.login-card .input:focus-visible {
  outline: none;
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-ring);
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  width: 100%;
  padding-right: 2.75rem;
}

.btn-visualizar {
  position: absolute;
  right: 0.5rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem;
  color: var(--color-text-muted);
  opacity: 0.8;
  transition: opacity 0.2s, color 0.2s;
}

.btn-visualizar:hover {
  opacity: 1;
  color: var(--color-brand);
}

.btn-visualizar:focus-visible {
  outline: none;
  opacity: 1;
  color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-ring);
}

.login-card .btn {
  margin-top: 0.5rem;
  width: 100%;
  min-height: 44px;
  font-weight: 700;
  border-radius: 6px;
}

.login-card .btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-brand-ring);
}

.notice-card {
  align-items: center;
  text-align: center;
}

.notice-card h3 {
  margin-bottom: 0.5rem;
  color: var(--color-brand);
}

.notice-card p {
  margin-bottom: 2rem;
  color: var(--color-text-muted);
}

.roles-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.roles-container .btn {
  width: 100%;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  transition: all 0.2s ease;
}

.roles-container .btn::before {
  display: none;
}

.roles-container .btn:hover:not(:disabled),
.roles-container .btn:focus-visible {
  color: var(--color-brand);
  border-color: var(--color-brand);
  background: var(--color-surface-soft);
}

.roles-container .btn:focus-visible {
  box-shadow:
    0 0 0 2px var(--color-background),
    0 0 0 4px var(--color-brand);
}

.roles-container .role-selected {
  color: var(--color-brand);
  border-color: var(--color-brand);
  background: var(--badge-primary-bg);
  font-weight: 800;
}
</style>
