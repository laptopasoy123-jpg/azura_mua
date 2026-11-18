<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, Lock, Shirt, X } from '@lucide/vue'
import type { WeddingAttire } from '../stores/crm'

export interface AttireSelectOption {
  item: WeddingAttire
  statusKind: 'available' | 'booked' | 'laundry'
  statusLabel: string
  locked: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: AttireSelectOption[]
  placeholder?: string
}>(), {
  placeholder: 'Pilih busana dari katalog',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const selectedOption = computed(() =>
  props.options.find((opt) => opt.item.id === props.modelValue) ?? null,
)

const choose = (opt: AttireSelectOption) => {
  if (opt.locked) return
  emit('update:modelValue', opt.item.id)
  open.value = false
}

const clear = () => {
  emit('update:modelValue', '')
  open.value = false
}

const onDocClick = (event: MouseEvent) => {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) {
    open.value = false
  }
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div ref="rootRef" class="attire-picker">
    <button
      type="button"
      class="attire-picker-trigger"
      :class="[
        selectedOption ? `is-${selectedOption.statusKind}` : 'is-empty',
        { 'is-open': open },
      ]"
      @click="open = !open"
    >
      <div class="attire-picker-value">
        <template v-if="selectedOption">
          <img v-if="selectedOption.item.imageUrl" :src="selectedOption.item.imageUrl" :alt="selectedOption.item.name" class="attire-picker-thumb" />
          <span v-else class="attire-picker-thumb attire-picker-thumb--empty"><Shirt :size="14" /></span>
          <span class="attire-picker-text">
            <strong>{{ selectedOption.item.name }} · Size {{ selectedOption.item.size }}</strong>
            <em class="attire-status-pill" :class="`is-${selectedOption.statusKind}`">
              <Lock v-if="selectedOption.locked" :size="10" />
              {{ selectedOption.statusLabel }}
            </em>
          </span>
        </template>
        <span v-else class="attire-picker-placeholder">{{ placeholder }}</span>
      </div>
      <div class="attire-picker-icons">
        <span
          v-if="modelValue"
          role="button"
          tabindex="0"
          class="attire-picker-clear"
          title="Kosongkan pilihan"
          @click.stop="clear"
          @keydown.enter.stop="clear"
        >
          <X :size="13" />
        </span>
        <ChevronDown :size="15" class="attire-picker-chevron" />
      </div>
    </button>

    <div v-if="open" class="attire-picker-menu" role="listbox">
      <button type="button" class="attire-picker-option is-reset" @click="clear">
        <span>— Belum memilih busana</span>
      </button>
      <button
        v-for="opt in options"
        :key="opt.item.id"
        type="button"
        class="attire-picker-option"
        :class="[
          `is-${opt.statusKind}`,
          {
            'is-selected': opt.item.id === modelValue,
            'is-locked': opt.locked,
          },
        ]"
        :disabled="opt.locked"
        @click="choose(opt)"
      >
        <img v-if="opt.item.imageUrl" :src="opt.item.imageUrl" :alt="opt.item.name" class="attire-picker-thumb" />
        <span v-else class="attire-picker-thumb attire-picker-thumb--empty"><Shirt :size="14" /></span>
        <div class="attire-picker-opt-body">
          <strong>{{ opt.item.name }}</strong>
          <small>{{ opt.item.code }} · Size {{ opt.item.size }}</small>
        </div>
        <span class="attire-status-pill" :class="`is-${opt.statusKind}`">
          <Lock v-if="opt.locked" :size="10" />
          {{ opt.statusLabel }}
        </span>
      </button>
    </div>
  </div>
</template>
