<script setup lang="ts">
/**
 * Barra de navegação superior (Navbar) com breadcrumbs dinâmicos,
 * atalhos rápidos de mapa/upload e alternância de tema.
 */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ThemeButton from './ThemeButton.vue'
import { userService } from '@/services/user'
import { buildBreadcrumbs } from '@/utils/breadcrumbs'

const route = useRoute()

const breadcrumbs = computed(() => buildBreadcrumbs(route))
const canMapa = computed(() => userService.can('MAPA:VISUALIZAR'))
const canUpload = computed(() => userService.can('INGESTAO:UPLOAD'))
</script>

<template>
  <div class="navbar">
    <!-- Breadcrumb da tela atual -->
    <nav class="breadcrumb" aria-label="Navegação contextual">
      <ol class="breadcrumb-list">
        <li
          v-for="(item, index) in breadcrumbs"
          :key="`${item.label}-${index}`"
          class="breadcrumb-item"
        >
          <span v-if="index > 0" class="breadcrumb-separator" aria-hidden="true">/</span>
          <RouterLink
            v-if="item.to && !item.isCurrent"
            :to="item.to"
            class="breadcrumb-link"
            :class="{ 'breadcrumb-root': index === 0 }"
          >
            {{ item.label }}
          </RouterLink>
          <strong
            v-else
            class="breadcrumb-current"
            :class="{ 'breadcrumb-root': index === 0 && breadcrumbs.length === 1 }"
            aria-current="page"
          >
            {{ item.label }}
          </strong>
        </li>
      </ol>
    </nav>

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
  </div>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  min-height: 62px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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
  min-width: 0;
  color: var(--color-heading);
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 8px;
  min-width: 0;
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.breadcrumb-link {
  color: var(--color-text-muted);
  text-decoration: none;
  cursor: pointer;
  font-size: 0.92rem;
  transition: color 0.15s ease;
}

.breadcrumb-link:hover {
  color: var(--vis-brand-orange);
  text-decoration: underline;
}

.breadcrumb-separator {
  color: var(--color-border-hover);
  font-size: 0.85rem;
  user-select: none;
}

.breadcrumb-current {
  color: var(--color-heading);
  font-size: 0.92rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb-root {
  color: var(--color-brand);
  font-weight: 800;
  letter-spacing: 0.05em;
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
