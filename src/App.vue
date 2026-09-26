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
      <div class="content-scroll-container">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
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
  overflow: hidden;
}

.content-scroll-container {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}

@media (max-width: 760px) {
  .app-layout {
    flex-direction: column;
  }

  .content-scroll-container {
    padding: 20px 16px;
  }
}
</style>
