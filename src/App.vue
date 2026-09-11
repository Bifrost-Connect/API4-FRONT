<script setup lang="ts">
import { RouterView } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import Navbar from './components/Navbar.vue'
import ThemeButtom from './components/Theme_Buttom.vue'
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <div class="main-wrapper">
      <header>
        <Navbar />
        <ThemeButtom />
      </header>
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
