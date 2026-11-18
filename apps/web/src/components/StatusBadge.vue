<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ label: string }>()

const tone = computed(() => {
  const value = props.label.toLowerCase()
  if (
    ['lunas', 'paid', 'aktif', 'active', 'aman', 'in stock', 'selesai', 'completed', 'terkonfirmasi', 'confirmed', 'tersedia', 'available', 'sesuai', 'matched']
      .some((item) => value.includes(item))
  ) return 'success'
  if (
    ['sebagian', 'partial', 'menipis', 'low stock', 'draft', 'belum ada tagihan', 'unbilled', 'terpakai', 'in use']
      .some((item) => value.includes(item))
  ) return 'warning'
  if (
    ['belum dibayar', 'unpaid', 'habis', 'out of stock', 'dibatalkan', 'cancelled', 'canceled', 'nonaktif', 'inactive', 'jatuh tempo', 'overdue', 'laundry', 'bayar cancel', 'cancel payment']
      .some((item) => value.includes(item))
  ) return 'danger'
  return 'info'
})
</script>

<template>
  <span class="status-badge" :class="`status-${tone}`">
    <i />
    {{ label }}
  </span>
</template>
