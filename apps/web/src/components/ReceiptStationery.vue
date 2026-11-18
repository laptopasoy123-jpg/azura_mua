<script setup lang="ts">
import { computed } from 'vue'
import { Download } from '@lucide/vue'
import type { ReceiptSharePayload } from '../utils/receiptPdf'
import { formatAmountWords, formatCurrency, formatDate } from '../utils/format'

const props = withDefaults(defineProps<{
  payload: ReceiptSharePayload
  logoUrl?: string
  showDownload?: boolean
}>(), {
  logoUrl: '',
  showDownload: false,
})

const emit = defineEmits<{
  download: []
}>()

const effectiveLogo = computed(() => props.logoUrl || props.payload.logoUrl || '')
const brandName = computed(() => (props.payload.businessName || 'AZURA').toUpperCase())
const brandTagline = computed(() => (props.payload.businessTagline || 'MAKEUP ARTIST').toUpperCase())
const historyList = computed(() =>
  props.payload.installmentHistory?.length
    ? props.payload.installmentHistory
    : [{
        receiptNumber: props.payload.receiptNumber,
        paidAt: props.payload.paidAt,
        method: props.payload.method,
        amount: props.payload.amount,
        isCurrent: true,
      }],
)
</script>

<template>
  <article class="editorial-sheet">
    <!-- Charcoal Espresso & Champagne Gold Header Banner -->
    <header class="editorial-sheet-banner">
      <div class="editorial-sheet-brand">
        <div class="editorial-sheet-logo">
          <img v-if="effectiveLogo" :src="effectiveLogo" :alt="brandName" />
          <template v-else>{{ brandName.slice(0, 1) }}</template>
        </div>
        <div>
          <strong>{{ brandName }} {{ brandTagline }}</strong>
          <small>{{ payload.poNumber ? `OFFICIAL INSTALLMENT RECEIPT · ${payload.poNumber}` : 'OFFICIAL PAYMENT RECEIPT' }}</small>
          <span>
            {{ payload.businessAddress || 'South Jakarta, Indonesia' }} |
            {{ payload.businessEmail || 'hello@azuramakeup.id' }} |
            {{ payload.businessPhone || '0812 9000 2026' }}
          </span>
        </div>
      </div>

      <div class="editorial-sheet-doc">
        <small>PAYMENT RECEIPT</small>
        <strong>{{ payload.receiptNumber }}</strong>
        <span :class="{ 'is-partial': payload.balance > 0 }">
          {{ payload.balance <= 0 ? 'PAID IN FULL' : 'PARTIAL INSTALLMENT' }}
        </span>
      </div>
    </header>

    <div class="editorial-sheet-body">
      <!-- HERO BOX: Highlights THIS EXACT TRANSACTION's Date & Amount Paid -->
      <section class="editorial-hero-payment">
        <div>
          <small>THIS TRANSACTION PAYMENT RECEIVED</small>
          <strong>{{ formatCurrency(payload.amount) }}</strong>
          <span>{{ formatAmountWords(payload.amount) }} · Method: {{ payload.method === 'Cash' ? 'Cash' : payload.method }}</span>
        </div>
        <div class="editorial-hero-date">
          <small>PAYMENT DATE</small>
          <strong>{{ formatDate(payload.paidAt, { day: '2-digit', month: 'long', year: 'numeric' }) }}</strong>
        </div>
      </section>

      <!-- Received From & Booking Reference Cards -->
      <section class="editorial-meta-two">
        <div class="editorial-meta-box">
          <small>RECEIVED FROM</small>
          <strong>{{ payload.customerName || '-' }}</strong>
          <span>Phone / WhatsApp: {{ payload.customerPhone || '-' }}</span>
          <span>Invoice Ref: {{ payload.invoiceNumber || '-' }}</span>
        </div>
        <div class="editorial-meta-box">
          <small>BOOKING REFERENCE</small>
          <strong class="mono-code">{{ payload.poNumber || '-' }}</strong>
          <span>Event: {{ payload.eventDate ? formatDate(payload.eventDate) : '-' }}<template v-if="payload.eventLocation"> · {{ payload.eventLocation }}</template></span>
          <span>Notes: {{ payload.notes?.trim() || '-' }}</span>
        </div>
      </section>

      <!-- Installment History Timeline -->
      <section>
        <p class="eyebrow" style="margin-bottom: 6px;">Payment Installment History ({{ payload.poNumber }})</p>
        <table class="editorial-table">
          <thead>
            <tr>
              <th>Receipt No.</th>
              <th>Payment Date</th>
              <th>Method</th>
              <th>Reference</th>
              <th class="is-num">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in historyList" :key="entry.receiptNumber" :class="{ 'is-current': entry.isCurrent }">
              <td class="mono-code">{{ entry.receiptNumber }}</td>
              <td>{{ formatDate(entry.paidAt) }}</td>
              <td>{{ entry.method }}</td>
              <td>{{ entry.isCurrent ? 'Current Receipt' : 'Previous Installment' }}</td>
              <td class="is-num">{{ formatCurrency(entry.amount) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Order Breakdown Table -->
      <section v-if="payload.items.length">
        <p class="eyebrow" style="margin-bottom: 6px;">Order Breakdown ({{ payload.poNumber }})</p>
        <table class="editorial-table">
          <thead>
            <tr>
              <th>Service Item</th>
              <th>Order Group</th>
              <th class="is-num">Qty</th>
              <th class="is-num">Unit Price</th>
              <th class="is-num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in payload.items" :key="idx">
              <td>
                <strong>{{ item.name }}</strong>
                <span class="subtle-line">{{ item.serviceType === 'Inti' ? 'Core Service' : 'Add-on' }}</span>
              </td>
              <td>{{ item.groupLabel }}</td>
              <td class="is-num">{{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }}</td>
              <td class="is-num">{{ formatCurrency(item.unitPrice) }}</td>
              <td class="is-num"><strong>{{ formatCurrency(item.quantity * item.unitPrice) }}</strong></td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Cumulative Totals Espresso Bar (mirrors receiptPdf.ts bottom bar) -->
      <section class="editorial-summary-card" style="grid-template-columns: repeat(3, 1fr);">
        <div style="flex-direction: column; gap: 3px;">
          <small style="color: #c4b8aa; font-size: 8.5px; font-weight: 700;">TOTAL PO BILLING</small>
          <strong style="font-size: 14px; color: #faf8f4;">{{ formatCurrency(payload.totalBilling) }}</strong>
        </div>
        <div style="flex-direction: column; gap: 3px;">
          <small style="color: #c4b8aa; font-size: 8.5px; font-weight: 700;">CUMULATIVE PAID TO DATE</small>
          <strong style="font-size: 14px; color: #faf8f4;">{{ formatCurrency(payload.totalPaid) }}</strong>
        </div>
        <div style="flex-direction: column; gap: 3px;">
          <small style="color: #e1c494; font-size: 8.5px; font-weight: 700;">REMAINING BALANCE DUE</small>
          <strong style="font-size: 15px; color: #f6e6c2;">{{ formatCurrency(Math.max(0, payload.balance)) }}</strong>
        </div>
      </section>
    </div>

    <footer class="editorial-sheet-footer">
      <div>
        <strong style="display: block; color: #4d4237; margin-bottom: 2px;">{{ payload.invoiceNote || `Thank you for trusting ${brandName} Studio with your special celebration.` }}</strong>
        <span>{{ payload.businessEmail || 'hello@azuramakeup.id' }} · {{ payload.businessPhone || '0812 9000 2026' }}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <button v-if="showDownload" type="button" class="primary-button" @click="emit('download')">
          <Download :size="16" />Download Receipt PDF
        </button>
        <a href="https://daysheet.id" target="_blank" rel="noopener noreferrer" class="daysheet-copyright-link">
          Copyright © {{ new Date().getFullYear() }} Daysheet.id
        </a>
      </div>
    </footer>
  </article>
</template>
