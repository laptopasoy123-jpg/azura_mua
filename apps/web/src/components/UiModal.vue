<script setup lang="ts">
import { X } from '@lucide/vue'

defineProps<{ open: boolean; title: string; description?: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @mousedown.self="emit('close')">
      <section class="modal-card" :class="{ 'modal-wide': wide }" role="dialog" aria-modal="true" :aria-label="title">
        <header class="modal-header">
          <div><h2>{{ title }}</h2><p v-if="description">{{ description }}</p></div>
          <button class="icon-button" aria-label="Tutup" @click="emit('close')"><X :size="20" /></button>
        </header>
        <div class="modal-body"><slot /></div>
      </section>
    </div>
  </Teleport>
</template>
