<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import SearchSelect from './SearchSelect.vue'

const props = withDefaults(defineProps<{
  totalItems: number
  currentPage: number
  pageSize: number
  compact?: boolean
  pageSizeOptions?: number[]
}>(), {
  compact: false,
  pageSizeOptions: () => [10, 15, 20, 25, 30, 40, 50],
})

const emit = defineEmits<{
  'update:currentPage': [page: number]
  'update:pageSize': [size: number]
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / Math.max(1, props.pageSize))))
const safePage = computed(() => Math.min(Math.max(1, props.currentPage), totalPages.value))

const startIndex = computed(() => (props.totalItems === 0 ? 0 : (safePage.value - 1) * props.pageSize + 1))
const endIndex = computed(() => Math.min(props.totalItems, safePage.value * props.pageSize))

const blockStart = computed(() => Math.floor((safePage.value - 1) / 5) * 5 + 1)
const blockEnd = computed(() => Math.min(totalPages.value, blockStart.value + 4))

const visiblePages = computed(() => {
  const list: number[] = []
  for (let p = blockStart.value; p <= blockEnd.value; p += 1) {
    list.push(p)
  }
  return list
})

const hasPrevEllipsis = computed(() => blockStart.value > 1)
const hasNextEllipsis = computed(() => blockEnd.value < totalPages.value)

const sizeSelectOptions = computed(() =>
  props.pageSizeOptions.map((n) => ({
    value: String(n),
    label: `${n} rows`,
  })),
)

const goTo = (page: number) => {
  const clamped = Math.min(Math.max(1, page), totalPages.value)
  emit('update:currentPage', clamped)
}

const onPageSizeChange = (val: string) => {
  const parsed = Number(val)
  if (!Number.isFinite(parsed) || parsed <= 0) return
  emit('update:pageSize', parsed)
  emit('update:currentPage', 1)
}
</script>

<template>
  <footer class="dp-footer" :class="{ 'is-compact': compact }">
    <div class="dp-meta">
      <span class="dp-count">
        Showing <strong>{{ startIndex }}–{{ endIndex }}</strong> of <strong>{{ totalItems }}</strong>
      </span>
      <label class="dp-size-wrap">
        <span>Per page</span>
        <div class="dp-size-select">
          <SearchSelect
            :model-value="String(pageSize)"
            :options="sizeSelectOptions"
            size="sm"
            search-placeholder="Rows…"
            aria-label="Rows per page"
            @update:model-value="onPageSizeChange"
          />
        </div>
      </label>
    </div>

    <nav class="dp-pages" aria-label="Pagination">
      <button
        type="button"
        class="dp-btn dp-nav"
        :disabled="safePage <= 1"
        title="Previous page"
        @click="goTo(safePage - 1)"
      >
        <ChevronLeft :size="15" />
      </button>

      <button
        v-if="hasPrevEllipsis"
        type="button"
        class="dp-btn dp-ellipsis"
        :title="`Jump to page ${blockStart - 1}`"
        @click="goTo(blockStart - 1)"
      >
        …
      </button>

      <button
        v-for="p in visiblePages"
        :key="p"
        type="button"
        class="dp-btn"
        :class="{ active: p === safePage }"
        @click="goTo(p)"
      >
        {{ p }}
      </button>

      <button
        v-if="hasNextEllipsis"
        type="button"
        class="dp-btn dp-ellipsis"
        :title="`Jump to page ${blockEnd + 1}`"
        @click="goTo(blockEnd + 1)"
      >
        …
      </button>

      <button
        type="button"
        class="dp-btn dp-nav"
        :disabled="safePage >= totalPages"
        title="Next page"
        @click="goTo(safePage + 1)"
      >
        <ChevronRight :size="15" />
      </button>
    </nav>
  </footer>
</template>
