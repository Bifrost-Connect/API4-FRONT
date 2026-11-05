<script setup lang="ts">
/**
 * Menu lateral principal de navegação da aplicação.
 * Exibe todas as seções e ferramentas do sistema sem restrições de perfil mockado.
 */
import { RouterLink } from 'vue-router'
import {
  FiGrid,
  FiUploadCloud,
  FiDatabase,
  FiMap,
  FiPieChart,
  FiRotateCcw,
  FiUser,
  FiUsers,
} from 'vue-icons-plus/fi'

// Lista completa de navegação acessível em todo o sistema
const navigationItems = [
  { label: 'Dashboard', to: '/', icon: FiGrid },
  { label: 'Upload de carga', to: '/upload', icon: FiUploadCloud },
  { label: 'Catálogo de Bases', to: '/catalogo', icon: FiDatabase },
  { label: 'Mapa operacional', to: '/mapa', icon: FiMap },
  { label: 'Análise territorial', to: '/analise-territorial', icon: FiPieChart },
  { label: 'Perfil do usuário', to: '/profile', icon: FiUser },
  { label: 'Gerenciamento de usuários', to: '/users', icon: FiUsers },
]
</script>

<template>
  <aside class="sidebar">
    <!-- Logotipo e Cabeçalho da Aplicação -->
    <div class="brand">
      <span class="brand-mark">A4</span>
      <div>
        <strong>GeoRural</strong>
        <span>Sistema de Cargas</span>
      </div>
    </div>

    <!-- Links de Navegação das Telas -->
    <div class="sidebar-section-title">Navegação</div>
    <nav class="navigation" aria-label="Navegação principal">
      <RouterLink
        v-for="item in navigationItems"
        :key="item.to"
        :to="item.to"
        class="navigation-link"
        active-class="navigation-link-active"
      >
        <span class="navigation-icon" aria-hidden="true">
          <component :is="item.icon" size="18" />
        </span>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- Rodapé da Barra Lateral -->
    <div class="sidebar-footer">
      <RouterLink to="/login" class="login-link">
        <span class="navigation-icon" aria-hidden="true">
          <FiRotateCcw size="17" />
        </span>
        <span>Acessar Login</span>
      </RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 252px;
  height: 100vh;
  position: sticky;
  top: 0;
  overflow-y: auto;
  padding: 28px 16px 20px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--vis-c-dark);
  color: var(--vis-c-text-light-1);
  border-right: 4px solid var(--vis-brand-orange);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px 32px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  background: var(--vis-brand-orange);
  color: white;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.brand strong,
.brand span:last-child {
  display: block;
}
.brand strong {
  font-size: 1.1rem;
  letter-spacing: 0.04em;
}
.brand span:last-child {
  margin-top: 2px;
  color: var(--vis-c-text-light-2);
  font-size: 0.72rem;
}

.sidebar-section-title {
  padding: 0 12px 10px;
  color: var(--vis-brand-orange-light);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.navigation {
  display: grid;
  gap: 5px;
}

.navigation-link,
.login-link {
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  color: var(--vis-c-text-light-2);
  font-size: 0.9rem;
  text-decoration: none;
  border-left: 3px solid transparent;
  transition:
    background-color 150ms ease,
    color 150ms ease,
    border-color 150ms ease;
}

.navigation-link:hover,
.login-link:hover,
.navigation-link-active {
  color: white;
  background: rgba(242, 101, 34, 0.16);
  border-left-color: var(--vis-brand-orange);
}

.navigation-icon {
  width: 20px;
  color: var(--vis-brand-orange-light);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid var(--vis-c-divider-dark-2);
}

@media (max-width: 760px) {
  .sidebar {
    width: 100%;
    height: auto;
    position: sticky;
    top: 0;
    z-index: 110;
    padding: 14px 12px;
    overflow: hidden;
    border-right: 0;
    border-bottom: 4px solid var(--vis-brand-orange);
  }
  .brand {
    padding: 0 8px 16px;
  }
  .sidebar-section-title {
    display: none;
  }
  .sidebar-footer {
    display: flex;
    padding-top: 8px;
    border-top: 0;
    margin-top: 0;
  }
  .navigation {
    display: flex;
    gap: 4px;
    overflow-x: auto;
  }
  .navigation-link {
    flex: 0 0 auto;
    min-height: 40px;
    padding: 0 10px;
    border-left: 0;
    border-bottom: 3px solid transparent;
  }
  .navigation-link-active {
    border-bottom-color: var(--vis-brand-orange);
  }
  .navigation-icon {
    display: none;
  }
}
</style>
