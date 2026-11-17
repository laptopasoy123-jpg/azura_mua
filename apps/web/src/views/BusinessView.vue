<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Download, FileSpreadsheet, Printer, Search, ReceiptText, ShoppingBag, Sparkles, CircleDollarSign, BarChart3, FileText, Trash2 } from '@lucide/vue'
import { useCrmStore, type Invoice } from '../stores/crm'
import { formatCurrency, formatDate } from '../utils/format'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'

const props = defineProps<{ module: 'orders' | 'additional' | 'invoices' | 'expenses' | 'reports' }>()
const store = useCrmStore()
const route = useRoute()
const router = useRouter()
const showExpense = ref(false)
const showOrder = ref(false)
const showInvoice = ref(false)
const selectedInvoice = ref<Invoice | null>(null)
const expenseError = ref('')
const orderError = ref('')
const expense = reactive({ date: '2026-11-15', category: 'Operasional', description: '', amount: 0, bookingId: '', method: 'Transfer' })
type OrderLine = { key: string; catalogItemId: string; quantity: number; customerPrice: number }
const order = reactive<{ bookingId: string; issuedAt: string; dueDate: string; items: OrderLine[] }>({
  bookingId: '', issuedAt: '2026-11-15', dueDate: '', items: [],
})

const meta = computed(() => ({
  orders: { eyebrow: 'Workspace', title: 'Pesanan Customer', description: 'Pesanan awal multi-item yang menghasilkan invoice utama.', icon: ShoppingBag },
  additional: { eyebrow: 'Workspace', title: 'Additional Order', description: 'Tambahkan layanan tanpa menimpa invoice utama.', icon: Sparkles },
  invoices: { eyebrow: 'Workspace', title: 'Invoice', description: 'Dokumen tagihan, alokasi pembayaran, dan sisa per invoice.', icon: ReceiptText },
  expenses: { eyebrow: 'Bisnis', title: 'Pengeluaran', description: 'Biaya terkait PO dan operasional umum.', icon: CircleDollarSign },
  reports: { eyebrow: 'Bisnis', title: 'Laporan', description: 'Ringkasan bisnis siap ekspor berdasarkan periode.', icon: BarChart3 },
})[props.module])

const paymentStatus = (bookingId: string) => {
  const total = store.bookingTotal(bookingId), paid = store.bookingPaid(bookingId)
  return paid >= total && total > 0 ? 'Lunas' : paid > 0 ? 'Dibayar Sebagian' : 'Belum Dibayar'
}

const eligibleBookings = computed(() => store.bookings.filter((booking) => {
  const hasMainInvoice = store.bookingInvoices(booking.id).some((invoice) => invoice.kind === 'Utama')
  return props.module === 'orders' ? !hasMainInvoice : hasMainInvoice
}))
const eligibleCatalog = computed(() => store.catalog.filter((item) => item.active && (props.module === 'orders' || item.type === 'Additional')))
const orderTotal = computed(() => order.items.reduce((sum, item) => sum + item.quantity * item.customerPrice, 0))
const addOrderLine = () => order.items.push({ key: crypto.randomUUID(), catalogItemId: '', quantity: 1, customerPrice: 0 })
const onCatalogChange = (line: OrderLine) => {
  const item = store.catalog.find((entry) => entry.id === line.catalogItemId)
  line.customerPrice = item?.price ?? 0
}
const openOrder = (catalogItemId = '') => {
  Object.assign(order, { bookingId: '', issuedAt: '2026-11-15', dueDate: '', items: [] })
  addOrderLine()
  if (catalogItemId) {
    const line = order.items[0]
    const item = store.catalog.find((entry) => entry.id === catalogItemId)
    if (line && item) { line.catalogItemId = item.id; line.customerPrice = item.price }
  }
  orderError.value = ''
  showOrder.value = true
}
const submitOrder = () => {
  try {
    orderError.value = ''
    if (!order.bookingId) throw new Error('Pilih Nomor PO terlebih dahulu.')
    if (order.items.some((line) => !line.catalogItemId)) throw new Error('Pilih layanan pada seluruh baris.')
    store.createInvoiceFromOrder({
      bookingId: order.bookingId,
      kind: props.module === 'additional' ? 'Additional' : 'Utama',
      issuedAt: order.issuedAt,
      dueDate: order.dueDate || undefined,
      items: order.items,
    })
    showOrder.value = false
  } catch (error) { orderError.value = error instanceof Error ? error.message : 'Pesanan gagal disimpan.' }
}

const submitExpense = () => {
  expenseError.value = ''
  if (!expense.description.trim() || expense.amount <= 0) { expenseError.value = 'Deskripsi dan nominal wajib diisi.'; return }
  store.addExpense({ ...expense, bookingId: expense.bookingId || undefined })
  Object.assign(expense, { date: '2026-11-15', category: 'Operasional', description: '', amount: 0, bookingId: '', method: 'Transfer' })
  showExpense.value = false
}

const previewInvoice = (invoice: Invoice) => {
  selectedInvoice.value = invoice
  showInvoice.value = true
}
const printInvoice = () => window.print()

const reportCards = [
  'Database Customer', 'Booking / PO', 'Pesanan & Additional', 'Invoice', 'Pembayaran', 'Piutang Customer',
  'Pengeluaran', 'Pemasukan & Pengeluaran', 'Barang Masuk', 'Barang Keluar', 'Stok Inventory',
]

const downloadCsv = (name: string, rows: Array<Array<string | number>>) => {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
const reportRows = (report: string) => [
  ['Laporan', report],
  ['Total Customer', store.customers.length],
  ['Total Booking', store.bookings.length],
  ['Total Tagihan', store.totalBilling],
  ['Total Pembayaran', store.totalPaid],
  ['Total Piutang', store.totalReceivable],
  ['Total Pengeluaran', store.totalExpenses],
]
const exportReport = (report: string, format: 'csv' | 'pdf') => format === 'pdf' ? window.print() : downloadCsv(report, reportRows(report))
const exportAllReports = () => downloadCsv('laporan-azura-mua', reportRows('Semua Laporan'))

watch(() => route.query.catalog, (catalog) => {
  if (typeof catalog !== 'string' || !['orders', 'additional'].includes(props.module)) return
  openOrder(catalog)
  router.replace({ path: route.path, query: {} })
}, { immediate: true })
</script>

<template>
  <div class="page-stack">
    <section class="page-heading"><div><span class="eyebrow">{{ meta.eyebrow }}</span><h2>{{ meta.title }}</h2><p>{{ meta.description }}</p></div><div class="heading-actions"><button v-if="module === 'reports'" class="secondary-button" @click="exportAllReports"><Download :size="17" />Export Semua</button><button v-else-if="module === 'expenses'" class="primary-button" @click="showExpense = true"><Plus :size="18" />Catat Pengeluaran</button><button v-else-if="module !== 'invoices'" class="primary-button" @click="openOrder()"><Plus :size="18" />{{ module === 'orders' ? 'Buat Pesanan' : 'Tambah Additional' }}</button></div></section>

    <template v-if="module === 'invoices'">
      <section class="summary-strip"><div><span>Total invoice</span><strong>{{ store.invoices.length }}</strong></div><div><span>Nilai tagihan</span><strong>{{ formatCurrency(store.totalBilling) }}</strong></div><div><span>Dibayar</span><strong>{{ formatCurrency(store.totalPaid) }}</strong></div><div><span>Piutang</span><strong>{{ formatCurrency(store.totalReceivable) }}</strong></div></section>
      <section class="invoice-card-list"><article v-for="invoice in store.invoices" :key="invoice.id" class="invoice-row-card"><span class="document-icon"><ReceiptText :size="22" /></span><div class="invoice-main"><span>{{ invoice.kind }} · {{ formatDate(invoice.issuedAt) }}</span><h3>{{ invoice.invoiceNumber }}</h3><p>{{ store.customerFor(store.bookingFor(invoice.bookingId)?.customerId ?? '')?.name }} · {{ store.bookingFor(invoice.bookingId)?.poNumber }}</p></div><div class="invoice-amount"><span>Total invoice</span><strong>{{ formatCurrency(store.invoiceTotal(invoice)) }}</strong></div><StatusBadge :label="paymentStatus(invoice.bookingId)" /><div class="row-actions"><button class="icon-button" title="Preview dan cetak" @click="previewInvoice(invoice)"><Printer :size="16" /></button><button class="icon-button" title="Save sebagai PDF" @click="previewInvoice(invoice)"><Download :size="16" /></button></div></article></section>
    </template>

    <template v-else-if="module === 'orders' || module === 'additional'">
      <section class="panel table-panel"><div class="table-toolbar"><label class="table-search"><Search :size="17" /><input placeholder="Cari PO atau customer" /></label></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Nomor PO</th><th>Customer</th><th>Jenis</th><th>Item layanan</th><th>Total</th><th>Invoice</th></tr></thead><tbody><tr v-for="invoice in store.invoices.filter((item) => module === 'orders' ? item.kind === 'Utama' : item.kind === 'Additional')" :key="invoice.id"><td><strong class="mono-code">{{ store.bookingFor(invoice.bookingId)?.poNumber }}</strong></td><td><strong>{{ store.customerFor(store.bookingFor(invoice.bookingId)?.customerId ?? '')?.name }}</strong></td><td><StatusBadge :label="invoice.kind" /></td><td><span v-for="item in invoice.items" :key="item.id" class="item-pill">{{ item.name }} ×{{ item.quantity }}</span></td><td><strong>{{ formatCurrency(store.invoiceTotal(invoice)) }}</strong></td><td>{{ invoice.invoiceNumber }}</td></tr><tr v-if="module === 'additional' && !store.invoices.some((item) => item.kind === 'Additional')"><td colspan="6"><div class="empty-state"><Sparkles :size="28" /><strong>Belum ada additional</strong><span>Additional baru akan membuat invoice terpisah pada PO yang sama.</span></div></td></tr></tbody></table></div></section>
    </template>

    <template v-else-if="module === 'expenses'">
      <section class="summary-strip"><div><span>Total pengeluaran</span><strong>{{ formatCurrency(store.totalExpenses) }}</strong></div><div><span>Terkait PO</span><strong>{{ formatCurrency(store.expenses.filter((e) => e.bookingId).reduce((s, e) => s + e.amount, 0)) }}</strong></div><div><span>Operasional umum</span><strong>{{ formatCurrency(store.expenses.filter((e) => !e.bookingId).reduce((s, e) => s + e.amount, 0)) }}</strong></div><div><span>Jumlah transaksi</span><strong>{{ store.expenses.length }}</strong></div></section>
      <section class="panel table-panel"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Pengeluaran</th><th>Kategori</th><th>Nomor PO</th><th>Metode</th><th>Nominal</th></tr></thead><tbody><tr v-for="row in store.expenses" :key="row.id"><td>{{ formatDate(row.date) }}</td><td><strong>{{ row.description }}</strong></td><td>{{ row.category }}</td><td>{{ row.bookingId ? store.bookingFor(row.bookingId)?.poNumber : 'Operasional umum' }}</td><td>{{ row.method }}</td><td><strong>{{ formatCurrency(row.amount) }}</strong></td></tr></tbody></table></div></section>
    </template>

    <template v-else>
      <section class="report-grid"><article v-for="(report, index) in reportCards" :key="report" class="report-card"><span><FileText :size="21" /></span><div><strong>{{ report }}</strong><p>Filter periode, sorting, pagination, dan ringkasan.</p></div><div class="report-actions"><button title="Export Excel" @click="exportReport(report, 'csv')"><FileSpreadsheet :size="17" /></button><button title="Export PDF" @click="exportReport(report, 'pdf')"><Download :size="17" /></button></div><small>{{ String(index + 1).padStart(2, '0') }}</small></article></section>
    </template>

    <UiModal :open="showExpense" title="Catat Pengeluaran" description="Nomor PO opsional untuk pengeluaran operasional umum." wide @close="showExpense = false"><form class="form-grid" @submit.prevent="submitExpense"><label><span>Tanggal *</span><input v-model="expense.date" type="date" /></label><label><span>Kategori *</span><select v-model="expense.category"><option>Operasional</option><option>Transportasi</option><option>Honor Tim</option><option>Perlengkapan</option><option>Akomodasi</option></select></label><label class="span-2"><span>Deskripsi *</span><input v-model="expense.description" /></label><label><span>Nominal *</span><input v-model.number="expense.amount" type="number" min="1" /></label><label><span>Metode</span><select v-model="expense.method"><option>Cash</option><option>Transfer</option><option>QRIS</option></select></label><label class="span-2"><span>Nomor PO (opsional)</span><select v-model="expense.bookingId"><option value="">Pengeluaran operasional umum</option><option v-for="booking in store.bookings" :key="booking.id" :value="booking.id">{{ booking.poNumber }} — {{ store.customerFor(booking.customerId)?.name }}</option></select></label><p v-if="expenseError" class="form-error span-2">{{ expenseError }}</p><div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showExpense = false">Batal</button><button class="primary-button">Simpan Pengeluaran</button></div></form></UiModal>

    <UiModal :open="showOrder" :title="module === 'additional' ? 'Tambah Additional' : 'Buat Pesanan'" description="Satu transaksi dapat berisi beberapa layanan dan akan menghasilkan invoice baru." wide @close="showOrder = false">
      <form class="form-grid" @submit.prevent="submitOrder">
        <label class="span-2"><span>Nomor PO *</span><select v-model="order.bookingId"><option value="">Pilih booking</option><option v-for="booking in eligibleBookings" :key="booking.id" :value="booking.id">{{ booking.poNumber }} — {{ store.customerFor(booking.customerId)?.name }} — {{ formatDate(booking.eventDate) }}</option></select></label>
        <label><span>Tanggal invoice *</span><input v-model="order.issuedAt" type="date" /></label><label><span>Jatuh tempo</span><input v-model="order.dueDate" type="date" /></label>
        <div class="order-lines span-2">
          <div class="order-lines-head"><div><strong>Item layanan</strong><span>Harga katalog muncul sebagai referensi.</span></div><button type="button" class="soft-button" @click="addOrderLine"><Plus :size="15" />Tambah Item</button></div>
          <div v-for="(line, index) in order.items" :key="line.key" class="order-line">
            <label><span>Layanan {{ index + 1 }}</span><select v-model="line.catalogItemId" @change="onCatalogChange(line)"><option value="">Pilih layanan</option><option v-for="item in eligibleCatalog" :key="item.id" :value="item.id">{{ item.name }}</option></select><small v-if="line.catalogItemId">Harga katalog: {{ formatCurrency(store.catalog.find((item) => item.id === line.catalogItemId)?.price ?? 0) }}</small></label>
            <label><span>Qty</span><input v-model.number="line.quantity" type="number" min="1" /></label>
            <label><span>Harga customer</span><input v-model.number="line.customerPrice" type="number" min="0" /></label>
            <div class="line-total"><span>Subtotal</span><strong>{{ formatCurrency(line.quantity * line.customerPrice) }}</strong></div>
            <button type="button" class="icon-button" :disabled="order.items.length === 1" @click="order.items.splice(index, 1)"><Trash2 :size="16" /></button>
          </div>
        </div>
        <div class="order-grand-total span-2"><span>Total {{ module === 'additional' ? 'additional' : 'pesanan' }}</span><strong>{{ formatCurrency(orderTotal) }}</strong></div>
        <p v-if="orderError" class="form-error span-2">{{ orderError }}</p>
        <div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showOrder = false">Batal</button><button class="primary-button">Simpan & Buat Invoice</button></div>
      </form>
    </UiModal>

    <UiModal :open="showInvoice" title="Preview Invoice" description="Gunakan dialog cetak browser untuk mencetak atau menyimpan sebagai PDF." wide @close="showInvoice = false">
      <div v-if="selectedInvoice" class="invoice-document">
        <header><div><span class="invoice-brand-mark">A</span><div><strong>Azura Makeup Studio</strong><small>Jakarta Selatan · hello@azuramakeup.id</small></div></div><div><span>INVOICE</span><strong>{{ selectedInvoice.invoiceNumber }}</strong></div></header>
        <section class="invoice-meta"><div><span>Ditagihkan kepada</span><strong>{{ store.customerFor(store.bookingFor(selectedInvoice.bookingId)?.customerId ?? '')?.name }}</strong><p>{{ store.customerFor(store.bookingFor(selectedInvoice.bookingId)?.customerId ?? '')?.phone }}</p></div><div><p><span>Nomor PO</span><strong>{{ store.bookingFor(selectedInvoice.bookingId)?.poNumber }}</strong></p><p><span>Tanggal invoice</span><strong>{{ formatDate(selectedInvoice.issuedAt) }}</strong></p><p><span>Tanggal acara</span><strong>{{ formatDate(store.bookingFor(selectedInvoice.bookingId)?.eventDate ?? '') }}</strong></p></div></section>
        <table><thead><tr><th>Layanan</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody><tr v-for="item in selectedInvoice.items" :key="item.id"><td>{{ item.name }}</td><td>{{ item.quantity }}</td><td>{{ formatCurrency(item.unitPrice) }}</td><td>{{ formatCurrency(item.quantity * item.unitPrice) }}</td></tr></tbody></table>
        <section class="invoice-total-block"><div><span>Status pembayaran PO</span><StatusBadge :label="paymentStatus(selectedInvoice.bookingId)" /></div><div><span>Total invoice</span><strong>{{ formatCurrency(store.invoiceTotal(selectedInvoice)) }}</strong></div></section>
        <footer><p>Terima kasih telah mempercayakan momen spesial Anda kepada Azura Makeup Studio.</p><small>Dokumen dibuat oleh sistem Azura MUA.</small></footer>
      </div>
      <div class="modal-actions no-print"><button class="secondary-button" @click="showInvoice = false">Tutup</button><button class="primary-button" @click="printInvoice"><Printer :size="17" />Cetak / Simpan PDF</button></div>
    </UiModal>
  </div>
</template>
