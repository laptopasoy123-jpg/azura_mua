<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, ChevronUp, Download, FileWarning, Printer } from '@lucide/vue'
import type { InvoiceSharePayload } from '../utils/invoicePdf'
import { formatCurrency, formatDate } from '../utils/format'
import { useCrmStore } from '../stores/crm'
import StatusBadge from '../components/StatusBadge.vue'

const route = useRoute()
const store = useCrmStore()
const payload = ref<InvoiceSharePayload | null>(null)
const expandedGroups = ref<Record<string, boolean>>({})

onMounted(async () => {
  const token = typeof route.query.d === 'string' ? route.query.d : ''
  if (!token) return
  const { decodeInvoiceShareToken } = await import('../utils/invoicePdf')
  const decoded = decodeInvoiceShareToken(token)
  payload.value = decoded
  if (decoded) {
    const map: Record<string, boolean> = {}
    decoded.groups.forEach((group, idx) => {
      map[group.id] = idx === 0
    })
    expandedGroups.value = map
  }
})

const effectiveLogoUrl = computed(() => payload.value?.logoUrl || store.businessProfile.logoUrl || '')

const paymentStatusLabel = computed(() => {
  if (!payload.value) return 'Unpaid'
  if (payload.value.balance <= 0 && payload.value.totalBilling > 0) return 'Paid'
  if (payload.value.totalPaid > 0) return 'Partial'
  return 'Unpaid'
})

const groupedOrders = computed(() => {
  if (!payload.value) return []
  return payload.value.groups.map((group, gIdx) => {
    const intiItems = group.items.filter((it) => it.serviceType === 'Inti')
    const additionalItems = group.items.filter((it) => it.serviceType !== 'Inti')
    const total = group.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0)
    return {
      id: group.id,
      kind: group.kind,
      title: group.kind === 'Awal' ? 'Initial Order' : `Add-on Batch #${gIdx}`,
      orderDate: group.orderDate,
      intiItems,
      additionalItems,
      itemCount: group.items.length,
      total,
    }
  })
})

const allGroupsOpen = computed(() =>
  groupedOrders.value.length > 0 && groupedOrders.value.every((g) => Boolean(expandedGroups.value[g.id])),
)

const isGroupOpen = (id: string) => Boolean(expandedGroups.value[id])
const toggleGroup = (id: string) => {
  expandedGroups.value[id] = !expandedGroups.value[id]
}
const toggleAllGroups = () => {
  const next = !allGroupsOpen.value
  const map: Record<string, boolean> = {}
  for (const group of groupedOrders.value) {
    map[group.id] = next
  }
  expandedGroups.value = map
}

const printPage = () => window.print()

const downloadPdf = async () => {
  if (!payload.value) return
  const { buildInvoicePdfFromPayload } = await import('../utils/invoicePdf')
  const doc = buildInvoicePdfFromPayload({
    ...payload.value,
    logoUrl: effectiveLogoUrl.value || undefined,
  })
  doc.save(`${payload.value.invoiceNumber}.pdf`)
}
</script>

<template>
  <div class="public-receipt-shell">
    <main v-if="payload" class="public-receipt-card" style="padding: 18px; background: #fff;">
      <article class="editorial-sheet">
        <header class="editorial-sheet-banner">
          <div class="editorial-brand">
            <img v-if="effectiveLogoUrl" :src="effectiveLogoUrl" alt="Brand Logo" />
            <span v-else>{{ (payload.businessName || 'A').charAt(0).toUpperCase() }}</span>
            <div>
              <strong>{{ payload.businessName || 'AZURA' }}</strong>
              <small>{{ (payload.businessTagline || 'MAKEUP ARTIST & STUDIO').toUpperCase() }}</small>
            </div>
          </div>
          <div class="editorial-doc-meta">
            <span>OFFICIAL INVOICE</span>
            <strong>{{ payload.invoiceNumber }}</strong>
            <small>Issued {{ formatDate(payload.issuedAt) }}</small>
          </div>
        </header>

        <div class="editorial-sheet-body">
          <section class="editorial-info-grid">
            <div class="editorial-info-card">
              <span>Billed To</span>
              <strong>{{ payload.customerName }}</strong>
              <small>Phone / WhatsApp: {{ payload.customerPhone || '-' }}</small>
              <small>Invoice Date: {{ formatDate(payload.issuedAt) }}</small>
            </div>
            <div class="editorial-info-card">
              <span>Booking &amp; Event Details</span>
              <strong>{{ payload.poNumber }}</strong>
              <small>Event: {{ payload.eventDate ? formatDate(payload.eventDate) : '-' }}{{ payload.eventLocation ? ` · ${payload.eventLocation}` : '' }}</small>
              <small>Initial Order: {{ formatDate(payload.groups[0]?.orderDate ?? payload.issuedAt) }}</small>
            </div>
          </section>

          <section class="invoice-orders-section">
            <header class="invoice-orders-head">
              <div class="invoice-orders-title">
                <strong>Order Breakdown</strong>
                <span>{{ groupedOrders.length }} order(s)</span>
              </div>
              <button
                v-if="groupedOrders.length"
                type="button"
                class="invoice-expand-all-btn no-print"
                @click="toggleAllGroups"
              >
                <ChevronUp v-if="allGroupsOpen" :size="14" />
                <ChevronDown v-else :size="14" />
                <span>{{ allGroupsOpen ? 'Hide All Details' : 'Show All Details' }}</span>
              </button>
            </header>

            <article v-for="group in groupedOrders" :key="group.id" class="invoice-order-card">
              <header class="invoice-order-head">
                <div class="invoice-order-meta">
                  <div class="invoice-order-top">
                    <span class="invoice-order-badge" :class="group.kind === 'Awal' ? 'is-initial' : 'is-additional'">
                      {{ group.title }}
                    </span>
                    <span class="invoice-order-date">{{ formatDate(group.orderDate) }}</span>
                  </div>
                  <span class="invoice-order-submeta">
                    {{ group.intiItems.length }} Inti · {{ group.additionalItems.length }} Additional
                  </span>
                </div>

                <div class="invoice-order-right">
                  <div class="invoice-order-total">
                    <small>Order Total</small>
                    <strong>{{ formatCurrency(group.total) }}</strong>
                  </div>
                  <button
                    type="button"
                    class="invoice-toggle-btn no-print"
                    @click="toggleGroup(group.id)"
                  >
                    <ChevronUp v-if="isGroupOpen(group.id)" :size="14" />
                    <ChevronDown v-else :size="14" />
                    <span>{{ isGroupOpen(group.id) ? 'Hide' : `Show (${group.itemCount})` }}</span>
                  </button>
                </div>
              </header>

              <div v-show="isGroupOpen(group.id)" class="invoice-order-body">
                <div v-if="group.intiItems.length" class="service-tier-block is-inti">
                  <header class="service-tier-head">
                    <span>Core Services (Inti)</span>
                    <span class="service-tier-count">{{ group.intiItems.length }} item(s)</span>
                  </header>
                  <div class="tier-item-list">
                    <div v-for="(item, idx) in group.intiItems" :key="idx" class="tier-item-row">
                      <span class="tier-item-name">{{ item.name }}</span>
                      <span class="tier-item-qtyprice">{{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }} × {{ formatCurrency(item.unitPrice) }}</span>
                      <strong class="tier-item-subtotal">{{ formatCurrency(item.quantity * item.unitPrice) }}</strong>
                    </div>
                  </div>
                </div>

                <div v-if="group.additionalItems.length" class="service-tier-block is-add">
                  <header class="service-tier-head">
                    <span>Add-on Services (Additional)</span>
                    <span class="service-tier-count">{{ group.additionalItems.length }} item(s)</span>
                  </header>
                  <div class="tier-item-list">
                    <div v-for="(item, idx) in group.additionalItems" :key="idx" class="tier-item-row">
                      <span class="tier-item-name">{{ item.name }}</span>
                      <span class="tier-item-qtyprice">{{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }} × {{ formatCurrency(item.unitPrice) }}</span>
                      <strong class="tier-item-subtotal">{{ formatCurrency(item.quantity * item.unitPrice) }}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section class="editorial-totals">
            <div class="editorial-words">
              <strong>Payment Status &amp; History</strong>
              <StatusBadge :label="paymentStatusLabel" style="margin: 4px 0;" />
              <ul v-if="payload.payments.length" class="doc-history-list" style="margin-top: 6px;">
                <li v-for="pay in payload.payments" :key="pay.receiptNumber">
                  <span>{{ pay.receiptNumber }} · {{ formatDate(pay.paidAt) }} ({{ pay.method === 'Cash' || pay.method === 'Tunai' ? 'Cash' : pay.method }})</span>
                  <strong>{{ formatCurrency(pay.amount) }}</strong>
                </li>
              </ul>
              <span v-else>No payment transactions recorded yet.</span>
            </div>

            <div class="editorial-summary-card">
              <div><span>Invoice Total</span><strong>{{ formatCurrency(payload.totalBilling) }}</strong></div>
              <div><span>Total Paid</span><strong>{{ formatCurrency(payload.totalPaid) }}</strong></div>
              <div class="is-highlight"><span>Balance Due</span><strong>{{ formatCurrency(Math.max(0, payload.balance)) }}</strong></div>
            </div>
          </section>
        </div>

        <footer class="editorial-sheet-footer">
          <div>
            <strong style="display: block; color: #4d4237; margin-bottom: 2px;">{{ payload.invoiceNote || 'Thank you for trusting us with your special celebration.' }}</strong>
            <span>{{ payload.businessEmail || 'hello@azuramakeup.id' }} · {{ payload.businessPhone || '0812 9000 2026' }} · {{ payload.businessAddress || 'South Jakarta, Indonesia' }}</span>
          </div>
          <a href="https://daysheet.id" target="_blank" rel="noopener noreferrer" class="daysheet-copyright-link">
            Copyright © {{ new Date().getFullYear() }} Daysheet.id
          </a>
        </footer>
      </article>

      <div class="modal-actions receipt-preview-actions no-print" style="margin-top: 14px;">
        <button type="button" class="secondary-button" @click="printPage">
          <Printer :size="16" />Print Invoice
        </button>
        <button type="button" class="primary-button" @click="downloadPdf">
          <Download :size="17" />Download Invoice PDF
        </button>
      </div>
    </main>

    <main v-else class="public-receipt-card public-receipt-empty">
      <FileWarning :size="36" />
      <h2>Invalid Invoice Link</h2>
      <p>Please open the complete digital invoice link provided by Azura Makeup Artist.</p>
    </main>
  </div>
</template>
