<script setup lang="ts">
import { RouterLink } from 'vue-router'

const navigationItems = [
  { label: 'Dashboard', to: '/', icon: '▦' },
  { label: 'Upload de carga', to: '/upload', icon: '↑' },
  { label: 'Mapa operacional', to: '/mapa', icon: '⌖' },
]
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="brand-mark">A4</span>
      <div>
        <strong>API4</strong>
        <span>Operador</span>
      </div>
    </div>

    <div class="sidebar-section-title">Navegação</div>
    <nav class="navigation" aria-label="Navegação principal">
      <RouterLink
        v-for="item in navigationItems"
        :key="item.to"
        :to="item.to"
        class="navigation-link"
        active-class="navigation-link-active"
      >
        <span class="navigation-icon" aria-hidden="true">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="sidebar-footer">
      <RouterLink to="/login" class="login-link">
        <span class="navigation-icon" aria-hidden="true">↪</span>
        <span>Encerrar sessão</span>
      </RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 20;
  width: 252px;
  min-height: 0;
  padding: 28px 16px 20px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
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
  letter-spacing: 0.08em;
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
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
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
  font-size: 1.15rem;
  line-height: 1;
  text-align: center;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid var(--vis-c-divider-dark-2);
}

@media (max-width: 760px) {
  .sidebar {
    inset: 0 0 auto;
    width: 100%;
    height: 130px;
    min-height: 130px;
    padding: 14px 12px;
    overflow: hidden;
    border-right: 0;
    border-bottom: 4px solid var(--vis-brand-orange);
  }

  .brand {
    padding: 0 8px 16px;
  }

  .sidebar-section-title,
  .sidebar-footer {
    display: none;
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
