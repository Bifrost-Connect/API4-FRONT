<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AiOutlineEye, AiOutlineEyeInvisible } from 'vue-icons-plus/ai'
const email = ref('')
const senha = ref('')
const showPassword = ref(false)
const fillLogin = (role: string) => {
  email.value = `${role}@georural.com.br`
  senha.value = 'Troca123'
}
</script>

<template>
  <div class="login-view">
    <div class="login-card">
      <h2>Login</h2>
      <div class="form-group">
        <label class="label">Email:</label>
        <input type="text" class="input" v-model="email" />
      </div>
      <div class="form-group">
        <label class="label">Senha:</label>
        <div class="password-input-wrapper">
          <input
            :type="showPassword ? 'text' : 'password'"
            class="input password-input"
            v-model="senha"
          />
          <button
            type="button"
            class="btn-visualizar"
            @click="showPassword = !showPassword"
            title="Mostrar/Ocultar senha"
          >
            <AiOutlineEyeInvisible v-if="showPassword" size="20" />
            <AiOutlineEye v-else size="20" />
          </button>
        </div>
      </div>
      <router-link to="/" class="btn btn_primary">Entrar</router-link>
    </div>

    <div class="notice-card">
      <h3 class="aviso">Sistema em fase de testes</h3>
      <p>Use uma das opções abaixo para entrar</p>
      <div class="roles-container">
        <button class="btn btn_outline" @click="fillLogin('operador')">Entrar Operador</button>
        <button class="btn btn_outline" @click="fillLogin('analista')">Entrar Analista</button>
        <button class="btn btn_outline" @click="fillLogin('auditor')">Entrar Auditor</button>
        <button class="btn btn_outline" @click="fillLogin('administrador')">
          Entrar Administrador
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-view {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  height: 100%;
  padding: 2rem;
  flex-wrap: wrap;
}

.login-card,
.notice-card {
  display: flex;
  flex-direction: column;
  padding: 2.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-background-soft);
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.login-card {
  align-items: stretch;
}

.login-card h2 {
  margin-bottom: 1.5rem;
  text-align: center;
  color: var(--color-heading);
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.25rem;
}

.form-group .label {
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  width: 100%;
  padding-right: 2.5rem;
}

.btn-visualizar {
  position: absolute;
  right: 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  color: var(--color-text);
  opacity: 0.6;
  transition: opacity 0.2s;
}

.btn-visualizar:hover {
  opacity: 1;
}

.login-card .btn {
  margin-top: 1rem;
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
  color: var(--color-text);
  opacity: 0.8;
}

.roles-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.roles-container .btn {
  width: 100%;
}
</style>
