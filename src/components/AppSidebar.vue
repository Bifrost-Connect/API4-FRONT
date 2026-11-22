<script setup lang="ts">
/**
 * Menu lateral principal de navegação da aplicação.
 * Renderiza dinamicamente as seções conforme as permissões da sessão ativa (Tarefa 6).
 */
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { FiChevronLeft, FiChevronRight, FiLogOut } from 'vue-icons-plus/fi'
import { userService } from '@/services/user'
import { getVisibleMenuItems } from '@/utils/rbac'

const SIDEBAR_COLLAPSED_KEY = 'georural_sidebar_collapsed'

const router = useRouter()

const isCollapsed = ref(false)
if (typeof localStorage !== 'undefined') {
  isCollapsed.value = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
}

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed.value))
  }
}

// Lista dinâmica de navegação filtrada por permissão
const navigationItems = computed(() => getVisibleMenuItems(userService.getCurrentUser()))

const handleLogout = async () => {
  await userService.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar-collapsed': isCollapsed }">
    <!-- Logotipo e Cabeçalho da Aplicação -->
    <div class="brand">
      <span class="brand-mark">A4</span>
      <div v-if="!isCollapsed">
        <strong>GeoRural</strong>
        <span>Sistema de Cargas</span>
      </div>
      <button
        type="button"
        class="collapse-toggle-btn"
        data-testid="sidebar-toggle"
        :title="isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'"
        :aria-label="isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'"
        @click="toggleSidebar"
      >
        <FiChevronRight v-if="isCollapsed" size="16" />
        <FiChevronLeft v-else size="16" />
      </button>
    </div>

    <!-- Links de Navegação das Telas -->
    <div v-if="!isCollapsed" class="sidebar-section-title">Navegação</div>
    <nav class="navigation" aria-label="Navegação principal">
      <RouterLink
        v-for="item in navigationItems"
        :key="item.to"
        :to="item.to"
        class="navigation-link"
        active-class="navigation-link-active"
        :title="item.label"
      >
        <span class="navigation-icon" aria-hidden="true">
          <component :is="item.icon" size="18" />
        </span>
        <span v-if="!isCollapsed">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- Rodapé da Barra Lateral -->
    <div class="sidebar-footer">
      <button
        type="button"
        class="login-link logout-btn"
        :title="isCollapsed ? 'Sair' : undefined"
        @click="handleLogout"
      >
        <span class="navigation-icon" aria-hidden="true">
          <FiLogOut size="17" />
        </span>
        <span v-if="!isCollapsed">Sair</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 228px;
  height: 100vh;
  position: sticky;
  top: 0;
  overflow-y: auto;
  padding: 22px 12px 16px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--vis-c-dark);
  color: var(--vis-c-text-light-1);
  border-right: 4px solid var(--vis-brand-orange);
  transition:
    width 0.2s ease,
    padding 0.2s ease;
}

.sidebar.sidebar-collapsed {
  width: 68px;
  padding: 22px 8px 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 10px 24px;
}

.sidebar.sidebar-collapsed .brand {
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  padding: 0 0 16px;
}

.collapse-toggle-btn {
  margin-left: auto;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vis-c-divider-dark-2);
  border-radius: 4px;
  color: var(--vis-c-text-light-2);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color 150ms ease,
    color 150ms ease,
    border-color 150ms ease;
}

.collapse-toggle-btn:hover {
  color: var(--color-brand-contrast);
  background: var(--color-brand-soft-strong);
  border-color: var(--vis-brand-orange);
}

.sidebar.sidebar-collapsed .collapse-toggle-btn {
  margin-left: 0;
}

.brand-mark {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: var(--vis-brand-orange);
  color: var(--color-brand-contrast);
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
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  color: var(--vis-c-text-light-2);
  font-size: 0.85rem;
  text-decoration: none;
  border-left: 3px solid transparent;
  transition:
    background-color 150ms ease,
    color 150ms ease,
    border-color 150ms ease;
}

.logout-btn {
  background: transparent;
  border-top: none;
  border-right: none;
  border-bottom: none;
  width: 100%;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.navigation-link:hover,
.login-link:hover,
.navigation-link-active {
  color: var(--color-brand-contrast);
  background: var(--color-brand-soft-strong);
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

.sidebar.sidebar-collapsed .navigation-link,
.sidebar.sidebar-collapsed .logout-btn {
  justify-content: center;
  padding: 0;
}

.sidebar.sidebar-collapsed .navigation-icon {
  margin: 0;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid var(--vis-c-divider-dark-2);
}

@media (max-width: 760px) {
  .collapse-toggle-btn {
    display: none;
  }
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
