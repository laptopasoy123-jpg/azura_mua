<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Plus, WalletCards, CheckCircle2, ReceiptText, Search, Download, Eye, Pencil, Trash2,
} from '@lucide/vue'
import { useCrmStore, type Payment } from '../stores/crm'
import { formatCurrency, formatDate } from '../utils/format'
import {
  downloadPaymentReceiptPdf,
  formatWhatsAppPhone,
  resolveReceiptShareUrl,
} from '../utils/receiptPdf'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'
import CurrencyInput from '../components/CurrencyInput.vue'

const store = useCrmStore()
const showForm = ref(false)
const editingId = ref('')
const showDetail = ref(false)
const detailPayment = ref<Payment | null>(null)
const showDeleteConfirm = ref(false)
const deletingPayment = ref<Payment | null>(null)

const error = ref('')
const waHint = ref('')
const sendingId = ref('')
const search = ref('')
const form = reactive({
  bookingId: '',
  amount: 0,
  method: 'Transfer' as Payment['method'],
  paidAt: new Date().toISOString().slice(0, 10),
  notes: '',
})
const selected = computed(() => store.bookingFor(form.bookingId))

watch(() => form.bookingId, () => {
  if (!editingId.value) {
    form.amount = 0
  }
  error.value = ''
})

const editingOriginalAmount = computed(() =>
  editingId.value ? (store.payments.find((p) => p.id === editingId.value)?.amount ?? 0) : 0,
)
const maxAllowedForForm = computed(() =>
  selected.value ? store.bookingBalance(selected.value.id) + editingOriginalAmount.value : 0,
)

const rows = computed(() => store.payments.filter((payment) => {
  const booking = store.bookingFor(payment.bookingId)
  const customer = booking ? store.customerFor(booking.customerId) : undefined
  const query = search.value.toLowerCase()
  return !query || payment.receiptNumber.toLowerCase().includes(query) || booking?.poNumber.toLowerCase().includes(query) || customer?.name.toLowerCase().includes(query)
}))

const methodLabel = (method: Payment['method']) => (method === 'Cash' ? 'Tunai' : method)

const openCreate = () => {
  editingId.value = ''
  error.value = ''
  Object.assign(form, {
    bookingId: '',
    amount: 0,
    method: 'Transfer',
    paidAt: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  showForm.value = true
}

const openEdit = (payment: Payment) => {
  editingId.value = payment.id
  error.value = ''
  Object.assign(form, {
    bookingId: payment.bookingId,
    amount: payment.amount,
    method: payment.method,
    paidAt: payment.paidAt,
    notes: payment.notes ?? '',
  })
  showForm.value = true
}

const openDetail = (payment: Payment) => {
  detailPayment.value = payment
  showDetail.value = true
}

const openDeleteModal = (payment: Payment) => {
  deletingPayment.value = payment
  showDeleteConfirm.value = true
}

const confirmDelete = () => {
  if (!deletingPayment.value) return
  store.deletePayment(deletingPayment.value.id)
  deletingPayment.value = null
  showDeleteConfirm.value = false
}

const submit = () => {
  try {
    error.value = ''
    if (!form.bookingId) throw new Error('Pilih Nomor PO terlebih dahulu.')
    if (editingId.value) {
      store.updatePayment(editingId.value, {
        amount: form.amount,
        method: form.method,
        paidAt: form.paidAt,
        notes: form.notes,
      })
    } else {
      store.addPayment(form)
    }
    editingId.value = ''
    Object.assign(form, {
      bookingId: '',
      amount: 0,
      method: 'Transfer',
      paidAt: new Date().toISOString().slice(0, 10),
      notes: '',
    })
    showForm.value = false
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Pembayaran gagal disimpan.'
  }
}

const receiptParamsFor = (payment: Payment) => {
  const booking = store.bookingFor(payment.bookingId)
  const customer = booking ? store.customerFor(booking.customerId) : undefined
  const invoice = store.bookingInvoice(payment.bookingId)
  return {
    payment,
    booking,
    customer,
    invoice,
    sortedGroups: invoice ? store.sortedOrderGroups(invoice) : [],
    sortItemsIntiFirst: store.sortInvoiceItemsIntiFirst,
    totalBilling: store.bookingTotal(payment.bookingId),
    totalPaid: store.bookingPaid(payment.bookingId),
    balance: store.bookingBalance(payment.bookingId),
    businessProfile: store.businessProfile,
  }
}

const downloadReceipt = (payment: Payment) => {
  downloadPaymentReceiptPdf(receiptParamsFor(payment))
}

const hasWhatsAppPhone = (payment: Payment) => {
  const booking = store.bookingFor(payment.bookingId)
  const customer = booking ? store.customerFor(booking.customerId) : undefined
  return Boolean(formatWhatsAppPhone(customer?.phone ?? ''))
}

const onSendWhatsApp = async (payment: Payment) => {
  const params = receiptParamsFor(payment)
  const waPhone = formatWhatsAppPhone(params.customer?.phone ?? '')
  if (!waPhone) return

  const waTab = window.open('about:blank', '_blank')
  sendingId.value = payment.id

  try {
    const shareResult = await resolveReceiptShareUrl(params)
    const itemLines: string[] = []
    for (const group of params.sortedGroups) {
      for (const it of params.sortItemsIntiFirst(group.items)) {
        itemLines.push(`  - ${it.name} (${it.quantity}${it.unit ? ` ${it.unit}` : ''}) : ${formatCurrency(it.quantity * it.unitPrice)}`)
      }
    }

    const balance = Math.max(0, params.balance)
    const brandTitle = [store.businessProfile.name || 'Azura', store.businessProfile.tagline || 'Makeup Artist'].filter(Boolean).join(' ')
    const lines = [
      `Halo Kak ${params.customer?.name ?? ''},`,
      `Berikut bukti kwitansi pembayaran dari ${brandTitle}:`,
      ``,
      `• No. Kwitansi: ${payment.receiptNumber}`,
      `• No. PO: ${params.booking?.poNumber ?? '-'}`,
      `• Tanggal Bayar: ${formatDate(payment.paidAt)}`,
      `• Metode: ${methodLabel(payment.method)}`,
      `• Nominal Diterima: ${formatCurrency(payment.amount)}`,
      ...(itemLines.length ? [``, `Rincian Pesanan:`, ...itemLines] : []),
      ``,
      `• Total Tagihan: ${formatCurrency(params.totalBilling)}`,
      `• Sudah Dibayar: ${formatCurrency(params.totalPaid)}`,
      `• Sisa Pembayaran: ${formatCurrency(balance)}`,
      ``,
      `Tautan PDF Kwitansi (${payment.receiptNumber}):`,
      shareResult.url,
      ``,
      `Terima kasih telah mempercayakan momen spesial Anda kepada ${brandTitle}.`,
    ]

    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(lines.join('\n'))}`
    if (waTab) {
      waTab.location.href = waUrl
    } else {
      window.open(waUrl, '_blank', 'noopener,noreferrer')
    }

    waHint.value = shareResult.mode === 'r2'
      ? `Pesan WhatsApp disertai tautan PDF langsung (${shareResult.url}) siap dikirim ke ${params.customer?.phone}.`
      : `Pesan WhatsApp disertai tautan Kwitansi & Unduh PDF siap dikirim ke ${params.customer?.phone}.`
  } finally {
    sendingId.value = ''
  }
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div>
        <span class="eyebrow">Ruang Kerja</span>
        <h2>Pembayaran Pelanggan</h2>
        <p>Catat uang muka, cicilan, atau pelunasan; lihat detail, ubah/hapus transaksi, unduh kwitansi PDF, dan kirim ke WhatsApp.</p>
      </div>
      <button class="primary-button" @click="openCreate"><Plus :size="18" />Catat Pembayaran</button>
    </section>

    <section class="summary-strip">
      <div><span>Total tagihan</span><strong>{{ formatCurrency(store.totalBilling) }}</strong></div>
      <div><span>Sudah diterima</span><strong>{{ formatCurrency(store.totalPaid) }}</strong></div>
      <div><span>Sisa piutang</span><strong>{{ formatCurrency(store.totalReceivable) }}</strong></div>
      <div><span>Transaksi pembayaran</span><strong>{{ store.payments.length }}</strong></div>
    </section>

    <div v-if="waHint" class="flow-note">
      <CheckCircle2 :size="18" />
      <div><strong>Tautan PDF Kwitansi Disertakan ke WhatsApp</strong><span>{{ waHint }}</span></div>
      <button type="button" class="soft-button" @click="waHint = ''">Tutup</button>
    </div>

    <section class="panel table-panel">
      <div class="table-toolbar">
        <label class="table-search"><Search :size="17" /><input v-model="search" placeholder="Cari kwitansi, PO, atau pelanggan" /></label>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kwitansi</th>
              <th>Pelanggan &amp; PO</th>
              <th>Tanggal</th>
              <th>Metode</th>
              <th>Nominal</th>
              <th>Status Tagihan</th>
              <th>Aksi &amp; Kwitansi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in rows" :key="payment.id">
              <td><strong class="mono-code">{{ payment.receiptNumber }}</strong><span class="subtle-line">ID {{ payment.id.slice(0, 8) }}</span></td>
              <td>
                <strong>{{ store.customerFor(store.bookingFor(payment.bookingId)?.customerId ?? '')?.name }}</strong>
                <span class="subtle-line">{{ store.bookingFor(payment.bookingId)?.poNumber }} · {{ store.customerFor(store.bookingFor(payment.bookingId)?.customerId ?? '')?.phone }}</span>
              </td>
              <td>{{ formatDate(payment.paidAt) }}</td>
              <td><span class="method-chip"><WalletCards :size="14" />{{ methodLabel(payment.method) }}</span></td>
              <td><strong>{{ formatCurrency(payment.amount) }}</strong></td>
              <td><StatusBadge :label="store.bookingBalance(payment.bookingId) <= 0 ? 'Lunas' : 'Dibayar Sebagian'" /></td>
              <td>
                <div class="row-actions payment-doc-actions">
                  <button type="button" class="icon-button" title="Lihat detail pembayaran" @click="openDetail(payment)">
                    <Eye :size="15" />
                  </button>
                  <button type="button" class="icon-button" title="Ubah pembayaran" @click="openEdit(payment)">
                    <Pencil :size="15" />
                  </button>
                  <button type="button" class="icon-button danger-icon-button" title="Hapus pembayaran" @click="openDeleteModal(payment)">
                    <Trash2 :size="15" />
                  </button>
                  <button type="button" class="soft-button receipt-dl-btn" title="Unduh Kwitansi PDF" @click="downloadReceipt(payment)">
                    <Download :size="14" />Kwitansi
                  </button>
                  <button
                    v-if="hasWhatsAppPhone(payment)"
                    type="button"
                    class="wa-icon-button"
                    :disabled="sendingId === payment.id"
                    :title="`Kirim tautan PDF kwitansi ke WhatsApp ${store.customerFor(store.bookingFor(payment.bookingId)?.customerId ?? '')?.phone}`"
                    aria-label="Kirim via WhatsApp"
                    @click="onSendWhatsApp(payment)"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.08c-.24.68-1.41 1.3-1.95 1.38-.5.07-1.13.1-1.82-.12-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.18-4.94-4.38-.14-.2-1.18-1.57-1.18-3 0-1.43.75-2.13 1.02-2.42.27-.29.59-.36.79-.36.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.59.83 2.03.9 2.18.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.36 1.45.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.34.07.12.07.7-.17 1.38z"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!rows.length">
              <td colspan="7">
                <div class="empty-state">
                  <ReceiptText :size="28" />
                  <strong>Belum ada transaksi pembayaran</strong>
                  <span>Klik "Catat Pembayaran" untuk menambahkan pembayaran pelanggan.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <UiModal
      :open="showForm"
      :title="editingId ? 'Ubah Transaksi Pembayaran' : 'Catat Pembayaran'"
      :description="editingId ? 'Perbaiki nominal, metode, tanggal, atau catatan pembayaran jika terjadi kesalahan input.' : 'Sistem akan mengalokasikan pembayaran ke tagihan PO yang dipilih.'"
      wide
      @close="showForm = false"
    >
      <form class="form-grid" @submit.prevent="submit">
        <label class="span-2">
          <span>Nomor PO *</span>
          <select v-model="form.bookingId" :disabled="Boolean(editingId)">
            <option value="">Pilih pemesanan PO</option>
            <option
              v-for="booking in store.bookings.filter((b) => Boolean(editingId) ? b.id === form.bookingId : store.bookingBalance(b.id) > 0)"
              :key="booking.id"
              :value="booking.id"
            >
              {{ booking.poNumber }} — {{ store.customerFor(booking.customerId)?.name }}
            </option>
          </select>
        </label>
        <div v-if="selected" class="payment-preview span-2">
          <div><span>Total tagihan</span><strong>{{ formatCurrency(store.bookingTotal(selected.id)) }}</strong></div>
          <div><span>Sudah dibayar</span><strong>{{ formatCurrency(store.bookingPaid(selected.id)) }}</strong></div>
          <div><span>Maksimal input</span><strong>{{ formatCurrency(maxAllowedForForm) }}</strong></div>
        </div>
        <label><span>Tanggal pembayaran *</span><input v-model="form.paidAt" type="date" /></label>
        <label>
          <span>Metode *</span>
          <select v-model="form.method">
            <option v-for="m in store.paymentMethods" :key="m" :value="m">{{ m }}</option>
            <option v-if="form.method && !store.paymentMethods.includes(form.method)" :value="form.method">
              {{ methodLabel(form.method) }}
            </option>
          </select>
        </label>
        <label class="span-2">
          <span>Nominal pembayaran *</span>
          <CurrencyInput v-model="form.amount" placeholder="0" aria-label="Nominal pembayaran" />
          <small v-if="selected">Sisa tagihan setelah disimpan: {{ formatCurrency(Math.max(0, maxAllowedForForm - form.amount)) }}</small>
        </label>
        <label class="span-2"><span>Catatan</span><textarea v-model="form.notes" rows="2" placeholder="Contoh: Uang muka pertama" /></label>
        <div class="flow-note span-2"><ReceiptText :size="18" /><div><strong>Kwitansi &amp; Tautan PDF otomatis</strong><span>Setelah disimpan, Anda dapat mengunduh PDF kwitansi atau mengirim tautan PDF langsung ke WhatsApp pelanggan.</span></div><CheckCircle2 :size="19" /></div>
        <p v-if="error" class="form-error span-2">{{ error }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showForm = false">Batal</button>
          <button class="primary-button">{{ editingId ? 'Simpan Perubahan' : 'Simpan Pembayaran' }}</button>
        </div>
      </form>
    </UiModal>

    <UiModal
      :open="showDetail && Boolean(detailPayment)"
      :title="detailPayment ? `Detail Pembayaran — ${detailPayment.receiptNumber}` : 'Detail Pembayaran'"
      description="Rincian transaksi pembayaran, status tagihan PO, dan daftar layanan."
      wide
      @close="showDetail = false"
    >
      <div v-if="detailPayment" class="detail-grid">
        <div><span>Nomor Kwitansi</span><strong class="mono-code">{{ detailPayment.receiptNumber }}</strong></div>
        <div><span>Status Tagihan PO</span><StatusBadge :label="store.bookingBalance(detailPayment.bookingId) <= 0 ? 'Lunas' : 'Dibayar Sebagian'" /></div>
        <div>
          <span>Pelanggan</span>
          <strong>{{ store.customerFor(store.bookingFor(detailPayment.bookingId)?.customerId ?? '')?.name }}</strong>
          <small>{{ store.customerFor(store.bookingFor(detailPayment.bookingId)?.customerId ?? '')?.phone }}</small>
        </div>
        <div>
          <span>Nomor PO &amp; Acara</span>
          <strong class="mono-code">{{ store.bookingFor(detailPayment.bookingId)?.poNumber }}</strong>
          <small>{{ formatDate(store.bookingFor(detailPayment.bookingId)?.eventDate ?? '') }} · {{ store.bookingFor(detailPayment.bookingId)?.location }}</small>
        </div>
        <div><span>Tanggal Bayar</span><strong>{{ formatDate(detailPayment.paidAt) }}</strong></div>
        <div><span>Metode Pembayaran</span><strong>{{ methodLabel(detailPayment.method) }}</strong></div>
        <div><span>Nominal Diterima</span><strong>{{ formatCurrency(detailPayment.amount) }}</strong></div>
        <div><span>Sisa Tagihan PO</span><strong>{{ formatCurrency(Math.max(0, store.bookingBalance(detailPayment.bookingId))) }}</strong></div>
        <div v-if="detailPayment.notes" class="span-2"><span>Catatan</span><strong>{{ detailPayment.notes }}</strong></div>
      </div>
      <div v-if="detailPayment" class="modal-actions">
        <button type="button" class="secondary-button" @click="showDetail = false">Tutup</button>
        <button type="button" class="secondary-button" @click="showDetail = false; openEdit(detailPayment)">
          <Pencil :size="15" />Ubah Transaksi
        </button>
        <button type="button" class="primary-button" @click="downloadReceipt(detailPayment)">
          <Download :size="16" />Unduh Kwitansi PDF
        </button>
      </div>
    </UiModal>

    <UiModal
      :open="showDeleteConfirm && Boolean(deletingPayment)"
      title="Hapus Transaksi Pembayaran?"
      description="Penghapusan transaksi akan memperbarui sisa tagihan pelanggan dan total pemasukan."
      @close="showDeleteConfirm = false"
    >
      <div v-if="deletingPayment" class="cancel-impact-box">
        <strong>{{ deletingPayment.receiptNumber }} — {{ store.customerFor(store.bookingFor(deletingPayment.bookingId)?.customerId ?? '')?.name }}</strong>
        <ul>
          <li>Nomor PO: <b>{{ store.bookingFor(deletingPayment.bookingId)?.poNumber }}</b></li>
          <li>Nominal: <b>{{ formatCurrency(deletingPayment.amount) }}</b> ({{ methodLabel(deletingPayment.method) }})</li>
        </ul>
      </div>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteConfirm = false">Batal</button>
        <button type="button" class="danger-button" @click="confirmDelete">Ya, Hapus Pembayaran</button>
      </div>
    </UiModal>
  </div>
</template>
