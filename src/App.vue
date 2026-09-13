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
  padding: 3rem;
  margin: 0 auto;
}

.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
