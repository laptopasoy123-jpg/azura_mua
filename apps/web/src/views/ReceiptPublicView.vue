<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Download, FileWarning } from '@lucide/vue'
import { buildPaymentReceiptPdfFromPayload, decodeReceiptShareToken } from '../utils/receiptPdf'
import { formatCurrency, formatDate, formatTerbilang } from '../utils/format'
import { useCrmStore } from '../stores/crm'

const route = useRoute()
const store = useCrmStore()
const payload = computed(() => {
  const token = typeof route.query.d === 'string' ? route.query.d : ''
  return token ? decodeReceiptShareToken(token) : null
})

const effectiveLogoUrl = computed(() => payload.value?.logoUrl || store.businessProfile.logoUrl || '')

const downloadPdf = () => {
  if (!payload.value) return
  const doc = buildPaymentReceiptPdfFromPayload({
    ...payload.value,
    logoUrl: effectiveLogoUrl.value || undefined,
  })
  doc.save(`Kwitansi-${payload.value.receiptNumber}.pdf`)
}
</script>

<template>
  <div class="public-receipt-shell">
    <main v-if="payload" class="public-receipt-card doc-card">
      <header class="doc-banner">
        <div class="doc-banner-brand">
          <img v-if="effectiveLogoUrl" :src="effectiveLogoUrl" :alt="payload.businessName || 'Azura'" class="doc-banner-logo" />
          <span v-else class="doc-banner-monogram">{{ (payload.businessName || 'A').slice(0, 1).toUpperCase() }}</span>
          <div>
            <strong>{{ (payload.businessName || 'AZURA').toUpperCase() }} {{ (payload.businessTagline || 'MAKEUP ARTIST').toUpperCase() }}</strong>
            <small>{{ payload.businessAddress || 'Jakarta Selatan' }} · {{ payload.businessEmail || 'hello@azuramakeup.id' }} · {{ payload.businessPhone || '0812 9000 2026' }}</small>
          </div>
        </div>
        <div class="doc-banner-meta">
          <span>KWITANSI PEMBAYARAN</span>
          <strong>{{ payload.receiptNumber }}</strong>
          <small>{{ formatDate(payload.paidAt) }}</small>
        </div>
      </header>

      <section class="doc-info-grid">
        <article>
          <span>DITERIMA DARI</span>
          <strong>{{ payload.customerName }}</strong>
          <small>Telepon / WA: {{ payload.customerPhone }}</small>
          <small v-if="payload.invoiceNumber">Ref. Faktur: {{ payload.invoiceNumber }}</small>
        </article>
        <article>
          <span>RINCIAN PEMESANAN</span>
          <strong class="mono-code">{{ payload.poNumber }}</strong>
          <small>Acara: {{ payload.eventDate ? formatDate(payload.eventDate) : '-' }} · {{ payload.eventLocation }}</small>
          <small v-if="payload.firstOrderDate">Pesanan Awal: {{ formatDate(payload.firstOrderDate) }}</small>
        </article>
      </section>

      <section v-if="payload.items.length" class="doc-table-section">
        <h3>Rincian Pesanan ({{ payload.poNumber }})</h3>
        <div class="doc-table-wrap">
          <table class="doc-table">
            <thead>
              <tr>
                <th>Layanan</th>
                <th>Kelompok</th>
                <th class="col-center">Jumlah</th>
                <th class="col-right">Harga Satuan</th>
                <th class="col-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in payload.items" :key="idx">
                <td>
                  <strong>{{ item.name }}</strong>
                  <span class="invoice-service-tag">{{ item.serviceType === 'Inti' ? 'Inti' : 'Tambahan' }}</span>
                </td>
                <td>{{ item.groupLabel }}</td>
                <td class="col-center">{{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }}</td>
                <td class="col-right">{{ formatCurrency(item.unitPrice) }}</td>
                <td class="col-right"><strong>{{ formatCurrency(item.quantity * item.unitPrice) }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="doc-bottom-grid">
        <div class="doc-totals-breakdown">
          <div><span>Total Tagihan PO</span><strong>{{ formatCurrency(payload.totalBilling) }}</strong></div>
          <div><span>Akumulasi Dibayar</span><strong>{{ formatCurrency(payload.totalPaid) }}</strong></div>
          <div class="is-balance"><span>Sisa Pembayaran</span><strong>{{ formatCurrency(Math.max(0, payload.balance)) }}</strong></div>
          <span class="public-receipt-status" :class="payload.balance <= 0 ? 'is-paid' : 'is-partial'">
            {{ payload.balance <= 0 ? 'LUNAS' : 'DIBAYAR SEBAGIAN' }}
          </span>
        </div>

        <div class="doc-espresso-card">
          <div>
            <span>NOMINAL DITERIMA</span>
            <strong class="is-hero">{{ formatCurrency(payload.amount) }}</strong>
            <em class="doc-terbilang">{{ formatTerbilang(payload.amount) }}</em>
          </div>
          <div class="doc-espresso-foot">
            <span>Metode: {{ payload.method === 'Cash' ? 'Tunai' : payload.method }}<template v-if="payload.notes"> · {{ payload.notes }}</template></span>
          </div>
        </div>
      </section>

      <footer class="doc-footer">
        <p>{{ payload.invoiceNote || 'Terima kasih telah mempercayakan momen spesial Anda kepada kami.' }}</p>
        <div class="doc-footer-row">
          <small>{{ payload.businessEmail || 'hello@azuramakeup.id' }} · {{ payload.businessPhone || '0812 9000 2026' }} · {{ payload.businessAddress || 'Jakarta Selatan' }}</small>
          <a href="https://daysheet.id" target="_blank" rel="noopener noreferrer" class="daysheet-copyright-link">
            Hak Cipta © {{ new Date().getFullYear() }} Daysheet.id
          </a>
        </div>
        <div class="public-receipt-download-row">
          <button type="button" class="primary-button" @click="downloadPdf">
            <Download :size="17" />Unduh PDF Kwitansi
          </button>
        </div>
      </footer>
    </main>

    <main v-else class="public-receipt-card public-receipt-empty">
      <FileWarning :size="36" />
      <h2>Tautan Kwitansi Tidak Valid</h2>
      <p>Pastikan Anda membuka tautan kwitansi lengkap yang dikirimkan oleh Azura Makeup Artist.</p>
    </main>
  </div>
</template>
