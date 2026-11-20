<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, ChevronDown, Search, X } from '@lucide/vue'

export interface SearchSelectOption {
  value: string
  label: string
  sublabel?: string
  group?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string
  options: SearchSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  clearable?: boolean
  required?: boolean
  size?: 'sm' | 'md'
  ariaLabel?: string
}>(), {
  modelValue: '',
  placeholder: 'Select option…',
  searchPlaceholder: 'Search option…',
  disabled: false,
  clearable: false,
  required: false,
  size: 'md',
  ariaLabel: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const open = ref(false)
const query = ref('')
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const menuStyle = ref<Record<string, string>>({})

const selectedOption = computed(() =>
  props.options.find((opt) => opt.value === props.modelValue) ?? null,
)

const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(q)
      || (opt.sublabel?.toLowerCase().includes(q) ?? false)
      || (opt.group?.toLowerCase().includes(q) ?? false),
  )
})

const groupedOptions = computed(() => {
  const groups: Array<{ name: string; items: SearchSelectOption[] }> = []
  const map = new Map<string, SearchSelectOption[]>()
  for (const opt of filteredOptions.value) {
    const gName = opt.group || ''
    let bucket = map.get(gName)
    if (!bucket) {
      bucket = []
      map.set(gName, bucket)
      groups.push({ name: gName, items: bucket })
    }
    bucket.push(opt)
  }
  return groups
})

const positionMenu = () => {
  if (!triggerRef.value || typeof window === 'undefined') return
  const rect = triggerRef.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const desiredWidth = Math.max(rect.width, 220)
  const maxAllowedWidth = Math.min(desiredWidth, vw - 16)
  let left = rect.left
  if (left + maxAllowedWidth > vw - 8) {
    left = Math.max(8, vw - 8 - maxAllowedWidth)
  }
  const spaceBelow = vh - rect.bottom - 10
  const spaceAbove = rect.top - 10
  const maxMenuHeight = 290
  const openUpwards = spaceBelow < 185 && spaceAbove > spaceBelow
  const computedMaxH = Math.max(150, Math.min(maxMenuHeight, openUpwards ? spaceAbove : spaceBelow))

  if (openUpwards) {
    menuStyle.value = {
      position: 'fixed',
      left: `${Math.round(left)}px`,
      bottom: `${Math.round(vh - rect.top + 6)}px`,
      width: `${Math.round(maxAllowedWidth)}px`,
      maxHeight: `${Math.round(computedMaxH)}px`,
      zIndex: '290',
    }
  } else {
    menuStyle.value = {
      position: 'fixed',
      left: `${Math.round(left)}px`,
      top: `${Math.round(rect.bottom + 6)}px`,
      width: `${Math.round(maxAllowedWidth)}px`,
      maxHeight: `${Math.round(computedMaxH)}px`,
      zIndex: '290',
    }
  }
}

const toggleOpen = async () => {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    query.value = ''
    await nextTick()
    positionMenu()
    // Focus search box on desktop pointer devices; avoid annoying pop-up keyboard on narrow phones if just picking
    if (window.innerWidth > 768) {
      searchInputRef.value?.focus({ preventScroll: true })
    }
  }
}

const selectOption = (opt: SearchSelectOption) => {
  if (opt.disabled) return
  emit('update:modelValue', opt.value)
  emit('change', opt.value)
  open.value = false
  query.value = ''
}

const clearSelection = () => {
  emit('update:modelValue', '')
  emit('change', '')
  open.value = false
  query.value = ''
}

const onDocPointerDown = (event: MouseEvent) => {
  if (!open.value) return
  const target = event.target as Node
  if (rootRef.value?.contains(target) || menuRef.value?.contains(target)) return
  open.value = false
}

const onWindowResizeOrScroll = (event: Event) => {
  if (!open.value) return
  if (event.type === 'scroll' && menuRef.value?.contains(event.target as Node)) return
  positionMenu()
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) {
    open.value = false
  }
}

watch(open, (isOpen) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  if (isOpen) {
    document.addEventListener('mousedown', onDocPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onWindowResizeOrScroll)
    window.addEventListener('scroll', onWindowResizeOrScroll, true)
  } else {
    query.value = ''
    document.removeEventListener('mousedown', onDocPointerDown)
    document.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('resize', onWindowResizeOrScroll)
    window.removeEventListener('scroll', onWindowResizeOrScroll, true)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocPointerDown)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onWindowResizeOrScroll)
  window.removeEventListener('scroll', onWindowResizeOrScroll, true)
})
</script>

<template>
  <div ref="rootRef" class="ss-root" :class="[`ss-${size}`, { 'is-open': open, 'is-disabled': disabled, 'is-required': required }]">
    <button
      ref="triggerRef"
      type="button"
      class="ss-trigger"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggleOpen"
    >
      <span class="ss-trigger-copy">
        <strong v-if="selectedOption" class="ss-trigger-label">{{ selectedOption.label }}</strong>
        <span v-else class="ss-trigger-placeholder">{{ placeholder }}</span>
        <small v-if="selectedOption?.sublabel" class="ss-trigger-sub">{{ selectedOption.sublabel }}</small>
      </span>
      <span class="ss-trigger-actions">
        <span
          v-if="clearable && modelValue && !disabled"
          role="button"
          tabindex="0"
          class="ss-clear-btn"
          title="Clear selection"
          @click.stop="clearSelection"
          @keydown.enter.stop="clearSelection"
        >
          <X :size="12" />
        </span>
        <ChevronDown :size="15" class="ss-chevron" />
      </span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuRef"
        class="ss-menu"
        :style="menuStyle"
        role="listbox"
      >
        <div class="ss-search-wrap">
          <Search :size="14" class="ss-search-icon" />
          <input
            ref="searchInputRef"
            v-model="query"
            type="text"
            class="ss-search-input"
            :placeholder="searchPlaceholder"
            @keydown.stop
          />
          <button v-if="query" type="button" class="ss-search-clear" aria-label="Clear search" @click="query = ''">
            <X :size="12" />
          </button>
        </div>

        <div class="ss-options-scroll">
          <template v-for="group in groupedOptions" :key="group.name || '__default'">
            <div v-if="group.name" class="ss-group-label">{{ group.name }}</div>
            <button
              v-for="opt in group.items"
              :key="opt.value"
              type="button"
              role="option"
              :aria-selected="opt.value === modelValue"
              :disabled="opt.disabled"
              class="ss-option"
              :class="{ 'is-selected': opt.value === modelValue, 'is-disabled': opt.disabled }"
              @click="selectOption(opt)"
            >
              <span class="ss-option-copy">
                <strong>{{ opt.label }}</strong>
                <small v-if="opt.sublabel">{{ opt.sublabel }}</small>
              </span>
              <Check v-if="opt.value === modelValue" :size="14" class="ss-check" />
            </button>
          </template>

          <div v-if="!filteredOptions.length" class="ss-empty">
            No matching option found
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
