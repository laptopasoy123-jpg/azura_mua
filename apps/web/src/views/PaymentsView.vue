<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Plus, WalletCards, CheckCircle2, ReceiptText, Search } from '@lucide/vue'
import { useCrmStore, type Payment } from '../stores/crm'
import { formatCurrency, formatDate } from '../utils/format'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'

const store = useCrmStore()
const showForm = ref(false)
const error = ref('')
const search = ref('')
const form = reactive({ bookingId: '', amount: 0, method: 'Transfer' as Payment['method'], paidAt: '2026-11-15', notes: '' })
const selected = computed(() => store.bookingFor(form.bookingId))
watch(() => form.bookingId, () => { form.amount = 0; error.value = '' })

const rows = computed(() => store.payments.filter((payment) => {
  const booking = store.bookingFor(payment.bookingId)
  const customer = booking ? store.customerFor(booking.customerId) : undefined
  const query = search.value.toLowerCase()
  return !query || payment.receiptNumber.toLowerCase().includes(query) || booking?.poNumber.toLowerCase().includes(query) || customer?.name.toLowerCase().includes(query)
}))

const submit = () => {
  try {
    error.value = ''
    if (!form.bookingId) throw new Error('Pilih nomor PO terlebih dahulu.')
    store.addPayment(form)
    Object.assign(form, { bookingId: '', amount: 0, method: 'Transfer', paidAt: '2026-11-15', notes: '' })
    showForm.value = false
  } catch (err) { error.value = err instanceof Error ? err.message : 'Pembayaran gagal disimpan.' }
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading"><div><span class="eyebrow">Workspace</span><h2>Pembayaran Customer</h2><p>Catat DP, cicilan, atau pelunasan berdasarkan Nomor PO.</p></div><button class="primary-button" @click="showForm = true"><Plus :size="18" />Catat Pembayaran</button></section>
    <section class="summary-strip"><div><span>Total tagihan</span><strong>{{ formatCurrency(store.totalBilling) }}</strong></div><div><span>Sudah diterima</span><strong>{{ formatCurrency(store.totalPaid) }}</strong></div><div><span>Sisa piutang</span><strong>{{ formatCurrency(store.totalReceivable) }}</strong></div><div><span>Transaksi pembayaran</span><strong>{{ store.payments.length }}</strong></div></section>
    <section class="panel table-panel">
      <div class="table-toolbar"><label class="table-search"><Search :size="17" /><input v-model="search" placeholder="Cari kwitansi, PO, atau customer" /></label></div>
      <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Kwitansi</th><th>Customer & PO</th><th>Tanggal</th><th>Metode</th><th>Nominal</th><th>Status setelah transaksi</th></tr></thead><tbody>
        <tr v-for="payment in rows" :key="payment.id"><td><strong class="mono-code">{{ payment.receiptNumber }}</strong><span class="subtle-line">ID {{ payment.id.slice(0, 8) }}</span></td><td><strong>{{ store.customerFor(store.bookingFor(payment.bookingId)?.customerId ?? '')?.name }}</strong><span class="subtle-line">{{ store.bookingFor(payment.bookingId)?.poNumber }}</span></td><td>{{ formatDate(payment.paidAt) }}</td><td><span class="method-chip"><WalletCards :size="14" />{{ payment.method }}</span></td><td><strong>{{ formatCurrency(payment.amount) }}</strong></td><td><StatusBadge :label="store.bookingBalance(payment.bookingId) === 0 ? 'Lunas' : 'Dibayar Sebagian'" /></td></tr>
      </tbody></table></div>
    </section>

    <UiModal :open="showForm" title="Catat Pembayaran" description="Sistem akan mengalokasikan pembayaran ke invoice tertua." wide @close="showForm = false">
      <form class="form-grid" @submit.prevent="submit">
        <label class="span-2"><span>Nomor PO *</span><select v-model="form.bookingId"><option value="">Pilih booking</option><option v-for="booking in store.bookings.filter((b) => store.bookingBalance(b.id) > 0)" :key="booking.id" :value="booking.id">{{ booking.poNumber }} — {{ store.customerFor(booking.customerId)?.name }}</option></select></label>
        <div v-if="selected" class="payment-preview span-2"><div><span>Total tagihan</span><strong>{{ formatCurrency(store.bookingTotal(selected.id)) }}</strong></div><div><span>Sudah dibayar</span><strong>{{ formatCurrency(store.bookingPaid(selected.id)) }}</strong></div><div><span>Sisa tagihan</span><strong>{{ formatCurrency(store.bookingBalance(selected.id)) }}</strong></div></div>
        <label><span>Tanggal pembayaran *</span><input v-model="form.paidAt" type="date" /></label><label><span>Metode *</span><select v-model="form.method"><option>Cash</option><option>Transfer</option><option>QRIS</option><option>Lainnya</option></select></label>
        <label class="span-2"><span>Nominal pembayaran *</span><input v-model.number="form.amount" type="number" min="1" :max="selected ? store.bookingBalance(selected.id) : undefined" placeholder="0" /><small v-if="selected">Sisa setelah pembayaran: {{ formatCurrency(Math.max(0, store.bookingBalance(selected.id) - form.amount)) }}</small></label>
        <label class="span-2"><span>Catatan</span><textarea v-model="form.notes" rows="2" placeholder="Contoh: DP pertama" /></label>
        <div class="flow-note span-2"><ReceiptText :size="18" /><div><strong>Kwitansi dibuat otomatis</strong><span>Snapshot total tagihan, akumulasi pembayaran, dan sisa akan disimpan.</span></div><CheckCircle2 :size="19" /></div>
        <p v-if="error" class="form-error span-2">{{ error }}</p>
        <div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showForm = false">Batal</button><button class="primary-button">Simpan Pembayaran</button></div>
      </form>
    </UiModal>
  </div>
</template>
