<script setup lang="ts">
/**
 * Tela de Bloqueio 403 - Acesso Não Autorizado (Tarefa 7).
 * Exibida ao tentar acessar uma rota sem a permissão requerida pelo RBAC.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { FiShield, FiArrowLeft, FiLock } from 'vue-icons-plus/fi'
import { userService } from '@/services/user'
import { homeFor } from '@/utils/rbac'

const router = useRouter()
const currentUser = computed(() => userService.getCurrentUser())

const homeRoute = computed(() => homeFor(currentUser.value))

const goHome = () => {
  router.push(homeRoute.value)
}
</script>

<template>
  <main class="forbidden-view" data-testid="forbidden-view">
    <div class="forbidden-card">
      <div class="forbidden-icon-wrap" aria-hidden="true">
        <FiLock size="48" class="lock-icon" />
      </div>

      <span class="badge-status-403">Erro 403 &bull; Acesso Restrito</span>

      <h1>Acesso Não Autorizado</h1>

      <p class="description">
        Seu perfil atual (<strong>{{ currentUser.role || 'Usuário' }}</strong>) não possui as
        permissões necessárias para visualizar este recurso ou módulo do sistema GeoRural.
      </p>

      <div class="security-notice">
        <FiShield size="16" class="notice-icon" />
        <span>
          Esta tentativa de acesso foi registrada no registro de auditoria e segurança da plataforma.
        </span>
      </div>

      <div class="actions">
        <button
          type="button"
          class="btn btn_primary btn-return"
          data-testid="btn-return-home"
          @click="goHome"
        >
          <FiArrowLeft size="16" />
          <span>Voltar para Minha Área Inicial</span>
        </button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.forbidden-view {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.forbidden-card {
  max-width: 540px;
  width: 100%;
  background: var(--color-surface, #1e293b);
  border: 1px solid var(--color-border, #334155);
  border-radius: 16px;
  padding: 40px 32px;
  text-align: center;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
}

.forbidden-icon-wrap {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.12);
  color: var(--color-danger, #ef4444);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.badge-status-403 {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-danger, #ef4444);
  border: 1px solid rgba(239, 68, 68, 0.3);
  margin-bottom: 16px;
}

h1 {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--color-heading, #f8fafc);
  margin: 0 0 12px;
}

.description {
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--color-text-muted, #94a3b8);
  margin: 0 0 24px;
}

.description strong {
  color: var(--color-heading, #f8fafc);
}

.security-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--color-border, #334155);
  color: var(--color-text-muted, #94a3b8);
  font-size: 0.78rem;
  line-height: 1.4;
  text-align: left;
  margin-bottom: 28px;
}

.notice-icon {
  flex-shrink: 0;
  color: var(--color-brand, #f26522);
}

.actions {
  display: flex;
  justify-content: center;
}

.btn-return {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  font-size: 0.9rem;
  font-weight: 700;
  border-radius: 8px;
  background: var(--color-brand, #f26522);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: opacity 150ms ease, transform 150ms ease;
}

.btn-return:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}
</style>
