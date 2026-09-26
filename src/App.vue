<script setup lang="ts">
import { RouterView } from 'vue-router'
import Sidebar from './components/AppSidebar.vue'
import Navbar from './components/AppNavbar.vue'
</script>

<template>
  <div class="app-layout">
    <Sidebar v-if="!$route.meta.hideMenu" />
    <div class="main-wrapper">
      <header>
        <Navbar v-if="!$route.meta.hideMenu" />
      </header>
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  background: var(--color-background);
}

.main-wrapper {
  flex: 1;
  min-width: 0;
  margin-left: 252px;
  padding-top: 76px;
  display: flex;
  flex-direction: column;
}

.main-wrapper > header {
  height: 0;
  flex: 0 0 0;
}

.main-wrapper > :deep(main) {
  flex: 1;
  padding: 32px;
}

@media (max-width: 760px) {
  .app-layout {
    display: block;
  }

  .main-wrapper {
    margin-left: 0;
    padding-top: 194px;
  }

  .main-wrapper > :deep(main) {
    padding: 20px 16px;
  }
}
</style>
