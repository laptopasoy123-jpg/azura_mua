<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { formatThousands, parseCurrencyInput } from '../utils/format'

const props = withDefaults(defineProps<{
  modelValue: number
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
}>(), {
  placeholder: '0',
  disabled: false,
  ariaLabel: 'Nominal rupiah',
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const displayValue = ref(props.modelValue > 0 ? formatThousands(props.modelValue) : (props.modelValue === 0 ? '0' : ''))

watch(() => props.modelValue, (next) => {
  const numericCurrent = parseCurrencyInput(displayValue.value)
  if (next !== numericCurrent) {
    displayValue.value = next > 0 ? formatThousands(next) : (next === 0 && displayValue.value !== '' ? '0' : '')
  }
})

const onFocus = () => {
  if (props.modelValue === 0) {
    displayValue.value = ''
  }
}

const onBlur = () => {
  if (!displayValue.value.trim()) {
    displayValue.value = '0'
    emit('update:modelValue', 0)
  } else {
    displayValue.value = props.modelValue > 0 ? formatThousands(props.modelValue) : '0'
  }
}

const onInput = async (event: Event) => {
  const el = event.target as HTMLInputElement
  const raw = el.value
  const caret = el.selectionStart ?? raw.length
  const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, '').length

  const numeric = parseCurrencyInput(raw)
  const formatted = numeric > 0 ? formatThousands(numeric) : (raw.trim() === '' ? '' : '0')
  displayValue.value = formatted
  emit('update:modelValue', numeric)

  await nextTick()
  if (!inputRef.value) return
  if (formatted === '') {
    inputRef.value.setSelectionRange(0, 0)
    return
  }
  let seenDigits = 0
  let nextCaret = formatted.length
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i]!)) {
      seenDigits += 1
    }
    if (seenDigits >= digitsBeforeCaret) {
      nextCaret = digitsBeforeCaret === 0 ? 0 : i + 1
      break
    }
  }
  inputRef.value.setSelectionRange(nextCaret, nextCaret)
}
</script>

<template>
  <div class="currency-input" :class="{ 'is-disabled': disabled }">
    <span class="currency-prefix" aria-hidden="true">Rp.</span>
    <input
      ref="inputRef"
      :value="displayValue"
      type="text"
      inputmode="numeric"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @focus="onFocus"
      @blur="onBlur"
      @input="onInput"
    />
  </div>
</template>
