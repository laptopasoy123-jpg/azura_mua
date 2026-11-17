<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ label: string }>()
const tone = computed(() => {
  const value = props.label.toLowerCase()
  if (['lunas', 'aktif', 'aman', 'selesai', 'terkonfirmasi'].some((item) => value.includes(item))) return 'success'
  if (['sebagian', 'menipis', 'draft', 'belum ada tagihan'].some((item) => value.includes(item))) return 'warning'
  if (['belum dibayar', 'habis', 'dibatalkan', 'nonaktif', 'jatuh tempo'].some((item) => value.includes(item))) return 'danger'
  return 'info'
})
</script>

<template><span class="status-badge" :class="`status-${tone}`"><i />{{ label }}</span></template>
