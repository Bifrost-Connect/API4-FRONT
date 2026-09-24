<script setup lang="ts">
import { RouterView } from 'vue-router'
import Sidebar from './components/AppSidebar.vue'
import Navbar from './components/AppNavbar.vue'
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <div class="main-wrapper">
      <header>
        <Navbar />
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
  display: flex;
  flex-direction: column;
}

.main-wrapper > :deep(main) {
  flex: 1;
  padding: 32px;
}

@media (max-width: 760px) {
  .app-layout {
    display: block;
  }

  .main-wrapper > :deep(main) {
    padding: 20px 16px;
  }
}
</style>
