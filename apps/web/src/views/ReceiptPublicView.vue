<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { FileWarning } from '@lucide/vue'
import type { ReceiptSharePayload } from '../utils/receiptPdf'
import { buildPaymentReceiptPdfFromPayload, decodeReceiptShareTokenAsync } from '../utils/receiptPdf'
import { useCrmStore } from '../stores/crm'
import ReceiptStationery from '../components/ReceiptStationery.vue'

const route = useRoute()
const store = useCrmStore()
const payload = ref<ReceiptSharePayload | null>(null)

onMounted(async () => {
  const token = typeof route.query.d === 'string' ? route.query.d : ''
  if (!token) return
  payload.value = await decodeReceiptShareTokenAsync(token)
})

const effectiveLogoUrl = computed(() => payload.value?.logoUrl || store.businessProfile.logoUrl || '')

const downloadPdf = async () => {
  if (!payload.value) return
  const doc = buildPaymentReceiptPdfFromPayload({
    ...payload.value,
    logoUrl: effectiveLogoUrl.value || undefined,
  })
  doc.save(`Receipt-${payload.value.receiptNumber}.pdf`)
}
</script>

<template>
  <div class="public-receipt-shell">
    <main v-if="payload" class="public-receipt-card" style="padding: 0; border: 0; background: transparent;">
      <ReceiptStationery :payload="payload" :logo-url="effectiveLogoUrl" show-download @download="downloadPdf" />
    </main>

    <main v-else class="public-receipt-card public-receipt-empty">
      <FileWarning :size="36" />
      <h2>Invalid Receipt Link</h2>
      <p>Please open the complete digital receipt link provided by Azura Makeup Artist.</p>
    </main>
  </div>
</template>
