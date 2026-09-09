<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import ThemeButtom from './components/Theme_Buttom.vue'
</script>

<template>
  <header>
    <div class="wrapper">
      <HelloWorld />
      <nav>
        <ThemeButtom />
      </nav>
    </div>
  </header>

  <RouterView />
</template>
