<script setup lang="ts">
import { useRoute, RouterView } from 'vue-router'
import AppShell from './components/AppShell.vue'

const route = useRoute()
</script>

<template>
  <RouterView v-if="route.meta.standalone" />
  <AppShell v-else />
</template>
