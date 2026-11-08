<script setup lang="ts">
/**
 * Barra de navegação superior (Navbar) com breadcrumbs,
 * atalhos rápidos de mapa/upload e alternância de tema.
 */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ThemeButton from './ThemeButton.vue'
import { userService } from '@/services/user'

const route = useRoute()

// Mapeamento de títulos de tela para o breadcrumb superior
const pageTitles: Record<string, string> = {
  dashboard: 'Visão geral das cargas',
  upload: 'Nova carga de dados',
  mapa: 'Mapa operacional',
  styleguide: 'Guia de estilos',
  'process-log': 'Acompanhar processamento de cargas',
  'analise-territorial': 'Análise territorial',
  catalogo: 'Catálogo de bases geoespaciais',
  profile: 'Meu perfil',
  users: 'Gerenciamento de usuários',
  forbidden: 'Acesso restrito (403)',
}

const currentPageTitle = computed(() => pageTitles[route.name?.toString() ?? ''] ?? 'API4')
const canMapa = computed(() => userService.can('MAPA:VISUALIZAR'))
const canUpload = computed(() => userService.can('INGESTAO:UPLOAD'))
</script>

<template>
  <nav class="navbar" aria-label="Navegação contextual">
    <!-- Breadcrumb da tela atual -->
    <div class="breadcrumb">
      <span class="breadcrumb-root">API4</span>
      <span class="breadcrumb-separator" aria-hidden="true">/</span>
      <strong>{{ currentPageTitle }}</strong>
    </div>

    <!-- Atalhos rápidos da barra superior filtrados por permissão (Tarefa 6) -->
    <div class="navbar-actions">
      <RouterLink v-if="canMapa" to="/mapa" class="navbar-link" active-class="navbar-link-active">
        <span aria-hidden="true">⌖</span>
        <span>Mapa</span>
      </RouterLink>
      <RouterLink v-if="canUpload" to="/upload" class="navbar-link" active-class="navbar-link-active">
        <span aria-hidden="true">＋</span>
        <span>Nova carga</span>
      </RouterLink>
      <ThemeButton />
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  min-height: 76px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.breadcrumb,
.navbar-actions,
.navbar-link {
  display: flex;
  align-items: center;
}

.breadcrumb {
  gap: 10px;
  min-width: 0;
  color: var(--color-heading);
}

.breadcrumb-root {
  color: var(--color-brand);
  font-weight: 800;
  letter-spacing: 0.08em;
}

.breadcrumb-separator {
  color: var(--color-border-hover);
}

.breadcrumb strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.92rem;
}

.navbar-actions {
  gap: 8px;
  flex-shrink: 0;
}

.navbar-link {
  min-height: 38px;
  gap: 6px;
  padding: 0 10px;
  color: var(--color-text);
  font-size: 0.82rem;
  text-decoration: none;
  border: 1px solid transparent;
}

.navbar-link:hover,
.navbar-link-active {
  color: var(--color-brand);
  background: var(--color-surface-soft);
  border-color: var(--color-border);
}

@media (max-width: 760px) {
  .navbar {
    top: 130px;
    left: 0;
    min-height: 64px;
    padding: 0 16px;
  }

  .navbar-link span:last-child {
    display: inline;
  }

  .navbar-link {
    padding: 0 8px;
    font-size: 1.1rem;
  }
}
</style>
