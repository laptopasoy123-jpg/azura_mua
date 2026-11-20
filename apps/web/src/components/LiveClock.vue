<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Calendar, Clock } from '@lucide/vue'

const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const todayDateLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now.value),
)

const liveClockLabel = computed(() => {
  const hh = String(now.value.getHours()).padStart(2, '0')
  const mm = String(now.value.getMinutes()).padStart(2, '0')
  const ss = String(now.value.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
})
</script>

<template>
  <div class="topbar-live-clock" aria-live="off">
    <span class="live-date-part"><Calendar :size="14" :stroke-width="1.8" />{{ todayDateLabel }}</span>
    <i class="live-clock-sep" aria-hidden="true" />
    <strong class="live-time-part"><Clock :size="14" :stroke-width="1.8" />{{ liveClockLabel }} WIB</strong>
    <i class="live-clock-sep" aria-hidden="true" />
    <a href="https://daysheet.id" target="_blank" rel="noopener noreferrer" class="topbar-daysheet-link" title="Visit daysheet.id">
      <span class="daysheet-pill-dot" />
      <span class="daysheet-text-day">Day</span><span class="daysheet-text-sheet">Sheet.</span>
    </a>
  </div>
</template>
