<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Plus, Download, Printer, Search, ReceiptText, ShoppingBag,
  Sparkles, CircleDollarSign, BarChart3, FileText, Trash2, CalendarDays, Eye, Check, X, Pencil, CheckSquare, Square,
  UploadCloud, LoaderCircle, Image as ImageIcon,
} from '@lucide/vue'
import { useCrmStore, type CatalogType, type Expense, type Invoice, type OrderGroup } from '../stores/crm'
import { formatCurrency, formatDate } from '../utils/format'
import { REPORT_CATALOG, downloadSelectedReportsPdf, type ReportKey } from '../utils/reportPdf'
import { downloadInvoicePdf } from '../utils/invoicePdf'
import { uploadImageWithFallback } from '../utils/uploadImage'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'
import CurrencyInput from '../components/CurrencyInput.vue'

const props = defineProps<{ module: 'orders' | 'additional' | 'invoices' | 'expenses' | 'reports' }>()
const store = useCrmStore()
const route = useRoute()
const router = useRouter()

const showExpense = ref(false)
const showOrder = ref(false)
const showOrderDetail = ref(false)
const showInvoice = ref(false)
const selectedInvoiceId = ref('')
const selectedOrderBookingId = ref('')
const orderSearch = ref('')
const expenseError = ref('')
const orderError = ref('')

// Progressive "+ Pesanan" form state (only visible after clicking "+ Pesanan")
interface OrderLine {
  key: string
  id?: string
  catalogItemId: string
  serviceName: string
  serviceKind?: CatalogType
  filterType?: 'Semua' | CatalogType
  quantity: number
  customerPrice: number
}

const showAddGroupForm = ref(false)
const addGroupError = ref('')
const addGroupForm = reactive<{
  orderDate: string
  items: OrderLine[]
}>({
  orderDate: new Date().toISOString().slice(0, 10),
  items: [],
})

// Inline edit per group (pencil icon)
const editingGroupId = ref('')
const editGroupError = ref('')
const editGroupForm = reactive<{
  orderDate: string
  items: OrderLine[]
}>({
  orderDate: '',
  items: [],
})

// Checklist Reports state
const selectedReportKeys = ref<ReportKey[]>(['bookings', 'orders', 'invoices', 'payments'])
const reportFromDate = ref('')
const reportToDate = ref('')
const reportError = ref('')

const expenseScopeFilter = ref<'Semua' | 'Berdasarkan PO' | 'Di Luar PO'>('Semua')
const editingExpenseId = ref('')
const expenseUploading = ref(false)
const expenseUploadError = ref('')
const showExpenseDetail = ref(false)
const selectedExpenseDetail = ref<Expense | null>(null)
const showDeleteExpenseModal = ref(false)
const deletingExpense = ref<Expense | null>(null)
const showExpenseProofZoom = ref(false)
const zoomedExpenseProof = ref('')

// Additional group delete state
const showDeleteAdditionalModal = ref(false)
const deletingAdditionalTarget = ref<{ bookingId: string; groupId: string; poNumber: string; customerName: string; orderDate: string } | null>(null)
const deleteAdditionalError = ref('')

interface ExpenseLine {
  key: string
  category: string
  description: string
  amount: number
}

const createExpenseLine = (category = store.poExpenseCategories[0] ?? 'Transportasi'): ExpenseLine => ({
  key: crypto.randomUUID(),
  category,
  description: '',
  amount: 0,
})

const expense = reactive<{
  date: string
  expenseScope: 'Berdasarkan PO' | 'Di Luar PO'
  bookingId: string
  method: string
  proofImageUrl: string
  items: ExpenseLine[]
}>({
  date: new Date().toISOString().slice(0, 10),
  expenseScope: 'Berdasarkan PO',
  bookingId: '',
  method: 'Transfer',
  proofImageUrl: '',
  items: [createExpenseLine()],
})

const expenseCategoryOptions = computed(() =>
  expense.expenseScope === 'Berdasarkan PO'
    ? store.poExpenseCategories
    : store.generalExpenseCategories,
)
const expenseBatchTotal = computed(() =>
  expense.items.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0),
)
const filteredExpenses = computed(() =>
  store.expenses.filter((e) => {
    if (expenseScopeFilter.value === 'Berdasarkan PO') return Boolean(e.bookingId)
    if (expenseScopeFilter.value === 'Di Luar PO') return !e.bookingId
    return true
  }),
)
const order = reactive<{ bookingId: string; issuedAt: string; orderDate: string; dueDate: string; items: OrderLine[] }>({
  bookingId: '',
  issuedAt: new Date().toISOString().slice(0, 10),
  orderDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  items: [],
})

const meta = computed(() => ({
  orders: { eyebrow: 'Ruang Kerja', title: 'Pesanan Pelanggan', description: 'Kelola pesanan awal, ubah tiap kelompok pesanan, dan tambah layanan Inti atau Tambahan per Nomor PO.', icon: ShoppingBag },
  additional: { eyebrow: 'Ruang Kerja', title: 'Pesanan Tambahan', description: 'Riwayat, perubahan, dan penambahan layanan tambahan yang terhubung pada Nomor PO yang sama.', icon: Sparkles },
  invoices: { eyebrow: 'Ruang Kerja', title: 'Faktur Tagihan', description: 'Dokumen tagihan dengan urutan layanan Inti di atas Tambahan dan pengelompokan tanggal pemesanan.', icon: ReceiptText },
  expenses: { eyebrow: 'Bisnis', title: 'Pengeluaran', description: 'Biaya berdasarkan Nomor PO maupun pengeluaran di luar PO beserta bukti pembayaran opsional.', icon: CircleDollarSign },
  reports: { eyebrow: 'Bisnis', title: 'Laporan', description: 'Centang bagian laporan yang dibutuhkan lalu unduh sebagai satu dokumen PDF yang rapi.', icon: BarChart3 },
})[props.module])

const paymentStatus = (bookingId: string) => {
  const total = store.bookingTotal(bookingId)
  const paid = store.bookingPaid(bookingId)
  if (!total) return 'Belum Ada Tagihan'
  if (paid >= total) return 'Lunas'
  if (paid > 0) return 'Dibayar Sebagian'
  return 'Belum Dibayar'
}

const eligibleBookings = computed(() => store.bookings.filter((booking) => {
  const hasInvoice = Boolean(store.bookingInvoice(booking.id))
  return props.module === 'orders' ? !hasInvoice : hasInvoice
}))

const coreCatalog = computed(() => store.catalog.filter((item) => item.active && item.type === 'Inti'))
const additionalCatalog = computed(() => store.catalog.filter((item) => item.active && item.type === 'Additional'))
const eligibleCatalog = computed(() =>
  store.catalog.filter((item) => item.active && (props.module === 'orders' || item.type === 'Additional')),
)

const filteredOrderInvoices = computed(() => {
  const query = orderSearch.value.trim().toLowerCase()
  return store.invoices.filter((inv) => {
    if (!query) return true
    const booking = store.bookingFor(inv.bookingId)
    const customer = booking ? store.customerFor(booking.customerId) : undefined
    return (
      inv.invoiceNumber.toLowerCase().includes(query)
      || (booking?.poNumber.toLowerCase().includes(query) ?? false)
      || (customer?.name.toLowerCase().includes(query) ?? false)
    )
  })
})

const additionalGroupRows = computed(() => {
  const query = orderSearch.value.trim().toLowerCase()
  const rows: Array<{
    id: string
    invoice: Invoice
    bookingId: string
    poNumber: string
    customerName: string
    orderDate: string
    items: Invoice['items']
    total: number
  }> = []
  for (const inv of store.invoices) {
    const booking = store.bookingFor(inv.bookingId)
    const customer = booking ? store.customerFor(booking.customerId) : undefined
    const poNumber = booking?.poNumber ?? ''
    const customerName = customer?.name ?? ''
    for (const group of store.sortedOrderGroups(inv)) {
      if (group.kind !== 'Tambahan') continue
      if (query && !poNumber.toLowerCase().includes(query) && !customerName.toLowerCase().includes(query) && !inv.invoiceNumber.toLowerCase().includes(query)) {
        continue
      }
      rows.push({
        id: group.id,
        invoice: inv,
        bookingId: inv.bookingId,
        poNumber,
        customerName,
        orderDate: group.orderDate,
        items: group.items,
        total: store.groupTotal(group),
      })
    }
  }
  return rows.sort((a, b) => b.orderDate.localeCompare(a.orderDate))
})

watch(
  () => store.invoices.map((i) => i.bookingId),
  (ids) => {
    if (props.module !== 'orders') return
    if (!ids.length) {
      selectedOrderBookingId.value = ''
      return
    }
    if (!selectedOrderBookingId.value || !ids.includes(selectedOrderBookingId.value)) {
      selectedOrderBookingId.value = ids[0]!
    }
  },
  { immediate: true },
)

const activeOrderInvoice = computed(() =>
  selectedOrderBookingId.value ? store.bookingInvoice(selectedOrderBookingId.value) : undefined,
)

const activeOrderBooking = computed(() =>
  selectedOrderBookingId.value ? store.bookingFor(selectedOrderBookingId.value) : undefined,
)

const activeOrderGroups = computed(() =>
  activeOrderInvoice.value ? store.sortedOrderGroups(activeOrderInvoice.value) : [],
)

const selectedInvoice = computed(() =>
  store.invoices.find((inv) => inv.id === selectedInvoiceId.value) ?? null,
)

const orderTotal = computed(() => order.items.reduce((sum, item) => sum + item.quantity * item.customerPrice, 0))
const addGroupTotal = computed(() => addGroupForm.items.reduce((sum, item) => sum + item.quantity * item.customerPrice, 0))
const editGroupTotal = computed(() => editGroupForm.items.reduce((sum, item) => sum + item.quantity * item.customerPrice, 0))

const onCatalogChange = (line: OrderLine) => {
  const item = store.catalog.find((entry) => entry.id === line.catalogItemId)
  line.serviceName = item?.name ?? ''
  line.serviceKind = item?.type
  line.customerPrice = item?.price ?? 0
}

const openOrder = (catalogItemId = '') => {
  const today = new Date().toISOString().slice(0, 10)
  Object.assign(order, { bookingId: '', issuedAt: today, orderDate: today, dueDate: '', items: [] })
  if (catalogItemId) {
    const item = store.catalog.find((entry) => entry.id === catalogItemId)
    if (item) {
      order.items.push({
        key: crypto.randomUUID(),
        catalogItemId: item.id,
        serviceName: item.name,
        serviceKind: item.type,
        filterType: item.type,
        quantity: 1,
        customerPrice: item.price,
      })
    }
  }
  orderError.value = ''
  showOrder.value = true
}

const submitOrder = () => {
  try {
    orderError.value = ''
    if (!order.bookingId) throw new Error('Pilih Nomor PO terlebih dahulu.')
    if (!order.issuedAt) throw new Error('Tanggal Invoice Dibuat wajib diisi.')
    if (!order.orderDate) throw new Error('Tanggal Pemesanan wajib diisi.')
    if (!order.items.length) {
      throw new Error(props.module === 'additional' ? 'Klik + Additional untuk menambahkan layanan.' : 'Klik + Layanan Inti atau + Additional untuk menambahkan layanan.')
    }
    if (order.items.some((line) => !line.catalogItemId)) throw new Error('Pilih layanan pada seluruh baris.')
    const saved = store.createInvoiceFromOrder({
      bookingId: order.bookingId,
      kind: props.module === 'additional' ? 'Additional' : 'Utama',
      issuedAt: order.issuedAt,
      orderDate: order.orderDate,
      dueDate: order.dueDate || undefined,
      items: order.items,
    })
    selectedOrderBookingId.value = saved.bookingId
    showOrder.value = false
  } catch (error) {
    orderError.value = error instanceof Error ? error.message : 'Pesanan gagal disimpan.'
  }
}

const selectBookingOrder = (bookingId: string, openModal = false, startEditTarget: boolean | string = false) => {
  selectedOrderBookingId.value = bookingId
  showAddGroupForm.value = false
  addGroupError.value = ''
  editingGroupId.value = ''
  editGroupError.value = ''
  if (openModal) {
    showOrderDetail.value = true
    if (startEditTarget) {
      const inv = store.bookingInvoice(bookingId)
      const groups = inv ? store.sortedOrderGroups(inv) : []
      const target = typeof startEditTarget === 'string'
        ? groups.find((g) => g.id === startEditTarget)
        : groups[0]
      if (target) startEditGroup(target)
    }
  }
}

const openDeleteAdditionalModal = (row: { bookingId: string; id: string; poNumber: string; customerName: string; orderDate: string }) => {
  deleteAdditionalError.value = ''
  deletingAdditionalTarget.value = {
    bookingId: row.bookingId,
    groupId: row.id,
    poNumber: row.poNumber,
    customerName: row.customerName,
    orderDate: row.orderDate,
  }
  showDeleteAdditionalModal.value = true
}

const confirmDeleteAdditional = () => {
  try {
    deleteAdditionalError.value = ''
    if (!deletingAdditionalTarget.value) return
    store.deleteOrderGroup(deletingAdditionalTarget.value.bookingId, deletingAdditionalTarget.value.groupId)
    deletingAdditionalTarget.value = null
    showDeleteAdditionalModal.value = false
  } catch (err) {
    deleteAdditionalError.value = err instanceof Error ? err.message : 'Gagal menghapus kelompok tambahan.'
  }
}

const openAddGroupForm = () => {
  editingGroupId.value = ''
  addGroupError.value = ''
  addGroupForm.orderDate = new Date().toISOString().slice(0, 10)
  addGroupForm.items = []
  showAddGroupForm.value = true
}

const cancelAddGroupForm = () => {
  showAddGroupForm.value = false
  addGroupError.value = ''
  addGroupForm.items = []
}

const addGroupRowByType = (targetList: OrderLine[], filterType: 'Semua' | CatalogType) => {
  targetList.push({
    key: crypto.randomUUID(),
    catalogItemId: '',
    serviceName: '',
    filterType,
    quantity: 1,
    customerPrice: 0,
  })
}

const catalogOptionsForLine = (line: OrderLine) => {
  if (line.filterType === 'Inti') return coreCatalog.value
  if (line.filterType === 'Additional') return additionalCatalog.value
  return store.catalog.filter((c) => c.active)
}

const submitAdditionalGroup = () => {
  try {
    addGroupError.value = ''
    if (!selectedOrderBookingId.value) throw new Error('Pilih Nomor PO terlebih dahulu.')
    if (!addGroupForm.orderDate) throw new Error('Tanggal pemesanan wajib diisi.')
    if (!addGroupForm.items.length) throw new Error('Tambahkan minimal satu layanan.')
    if (addGroupForm.items.some((line) => !line.catalogItemId)) {
      throw new Error('Pilih layanan pada seluruh baris.')
    }
    store.addOrderGroupToBooking({
      bookingId: selectedOrderBookingId.value,
      orderDate: addGroupForm.orderDate,
      items: addGroupForm.items,
    })
    showAddGroupForm.value = false
    addGroupForm.items = []
  } catch (err) {
    addGroupError.value = err instanceof Error ? err.message : 'Gagal menyimpan pesanan tambahan.'
  }
}

// Inline pencil edit per order group
const startEditGroup = (group: OrderGroup) => {
  showAddGroupForm.value = false
  editingGroupId.value = group.id
  editGroupError.value = ''
  editGroupForm.orderDate = group.orderDate
  editGroupForm.items = group.items.map((item) => {
    const matchedCatalog = store.catalog.find((c) => c.id === item.catalogItemId || c.name.toLowerCase() === item.name.toLowerCase())
    return {
      key: crypto.randomUUID(),
      id: item.id,
      catalogItemId: matchedCatalog?.id ?? item.catalogItemId ?? '',
      serviceName: item.name,
      serviceKind: item.serviceType ?? matchedCatalog?.type,
      filterType: 'Semua',
      quantity: item.quantity,
      customerPrice: item.unitPrice,
    }
  })
}

const cancelEditGroup = () => {
  editingGroupId.value = ''
  editGroupError.value = ''
  editGroupForm.items = []
}

const saveEditGroup = (groupId: string) => {
  try {
    editGroupError.value = ''
    if (!activeOrderBooking.value) throw new Error('Booking tidak ditemukan.')
    if (!editGroupForm.orderDate) throw new Error('Tanggal pemesanan wajib diisi.')
    if (!editGroupForm.items.length) throw new Error('Minimal harus ada satu item layanan.')
    if (editGroupForm.items.some((line) => !line.catalogItemId)) {
      throw new Error('Pilih layanan pada seluruh baris.')
    }
    store.updateOrderGroup(activeOrderBooking.value.id, groupId, {
      orderDate: editGroupForm.orderDate,
      items: editGroupForm.items.map((line) => ({
        id: line.id,
        catalogItemId: line.catalogItemId,
        quantity: line.quantity,
        customerPrice: line.customerPrice,
      })),
    })
    editingGroupId.value = ''
    editGroupForm.items = []
  } catch (err) {
    editGroupError.value = err instanceof Error ? err.message : 'Gagal menyimpan perubahan kelompok pesanan.'
  }
}

const openCreateExpense = () => {
  editingExpenseId.value = ''
  expenseError.value = ''
  expenseUploadError.value = ''
  const defaultCat = store.poExpenseCategories[0] ?? 'Transportasi'
  Object.assign(expense, {
    date: new Date().toISOString().slice(0, 10),
    expenseScope: 'Berdasarkan PO',
    bookingId: '',
    method: store.paymentMethods[1] ?? store.paymentMethods[0] ?? 'Transfer',
    proofImageUrl: '',
    items: [createExpenseLine(defaultCat)],
  })
  showExpense.value = true
}

const openEditExpense = (row: Expense) => {
  editingExpenseId.value = row.id
  expenseError.value = ''
  expenseUploadError.value = ''
  Object.assign(expense, {
    date: row.date,
    expenseScope: row.bookingId ? 'Berdasarkan PO' : 'Di Luar PO',
    bookingId: row.bookingId ?? '',
    method: row.method,
    proofImageUrl: row.proofImageUrl ?? '',
    items: [
      {
        key: crypto.randomUUID(),
        category: row.category,
        description: row.description,
        amount: row.amount,
      },
    ],
  })
  showExpense.value = true
}

const addExpenseLine = () => {
  const lastCategory = expense.items[expense.items.length - 1]?.category ?? 'Operasional'
  expense.items.push(createExpenseLine(lastCategory))
}

const handleExpenseProofUpload = async (event: Event) => {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  expenseUploadError.value = ''
  expenseUploading.value = true
  try {
    const res = await uploadImageWithFallback(file, 'expense-proof')
    expense.proofImageUrl = res.url
  } catch (err) {
    expenseUploadError.value = err instanceof Error ? err.message : 'Gagal mengunggah bukti pembayaran.'
  } finally {
    expenseUploading.value = false
    inputEl.value = ''
  }
}

const openDeleteExpenseModal = (row: Expense) => {
  deletingExpense.value = row
  showDeleteExpenseModal.value = true
}

const confirmDeleteExpense = () => {
  if (!deletingExpense.value) return
  store.deleteExpense(deletingExpense.value.id)
  deletingExpense.value = null
  showDeleteExpenseModal.value = false
}

const submitExpense = () => {
  try {
    expenseError.value = ''
    if (!expense.items.length) {
      expenseError.value = 'Tambahkan minimal satu baris pengeluaran.'
      return
    }
    if (expense.expenseScope === 'Berdasarkan PO' && !expense.bookingId) {
      expenseError.value = 'Pilih Nomor PO untuk pengeluaran berdasarkan PO.'
      return
    }
    if (editingExpenseId.value) {
      const line = expense.items[0]!
      if (!line.description.trim() || line.amount <= 0) {
        expenseError.value = 'Deskripsi dan nominal wajib diisi.'
        return
      }
      store.updateExpense(editingExpenseId.value, {
        date: expense.date,
        category: line.category,
        description: line.description.trim(),
        amount: line.amount,
        method: expense.method,
        expenseScope: expense.expenseScope,
        bookingId: expense.expenseScope === 'Berdasarkan PO' ? expense.bookingId : undefined,
        proofImageUrl: expense.proofImageUrl || undefined,
      })
    } else {
      store.addBatchExpenses({
        date: expense.date,
        method: expense.method,
        expenseScope: expense.expenseScope,
        bookingId: expense.expenseScope === 'Berdasarkan PO' ? expense.bookingId : undefined,
        proofImageUrl: expense.proofImageUrl || undefined,
        items: expense.items.map((line) => ({
          category: line.category,
          description: line.description,
          amount: line.amount,
        })),
      })
    }
    editingExpenseId.value = ''
    Object.assign(expense, {
      date: new Date().toISOString().slice(0, 10),
      expenseScope: 'Berdasarkan PO',
      bookingId: '',
      method: 'Transfer',
      proofImageUrl: '',
      items: [createExpenseLine()],
    })
    showExpense.value = false
  } catch (err) {
    expenseError.value = err instanceof Error ? err.message : 'Gagal menyimpan pengeluaran.'
  }
}

const previewInvoice = (invoice: Invoice) => {
  selectedInvoiceId.value = invoice.id
  showInvoice.value = true
}
const downloadInvoice = (invoice: Invoice) => {
  const booking = store.bookingFor(invoice.bookingId)
  const customer = booking ? store.customerFor(booking.customerId) : undefined
  downloadInvoicePdf({
    invoice,
    booking,
    customer,
    sortedGroups: store.sortedOrderGroups(invoice),
    payments: store.bookingPayments(invoice.bookingId),
    totalBilling: store.bookingTotal(invoice.bookingId),
    totalPaid: store.bookingPaid(invoice.bookingId),
    balance: store.bookingBalance(invoice.bookingId),
    businessProfile: store.businessProfile,
    sortItemsIntiFirst: store.sortInvoiceItemsIntiFirst,
  })
}
const printInvoice = () => window.print()

// Report checklist helpers
const toggleReportKey = (key: ReportKey) => {
  reportError.value = ''
  const idx = selectedReportKeys.value.indexOf(key)
  if (idx >= 0) selectedReportKeys.value.splice(idx, 1)
  else selectedReportKeys.value.push(key)
}

const selectAllReports = () => {
  reportError.value = ''
  selectedReportKeys.value = REPORT_CATALOG.map((r) => r.key)
}

const clearAllReports = () => {
  reportError.value = ''
  selectedReportKeys.value = []
}

const exportSelectedReportsPdf = (overrideKeys?: ReportKey[]) => {
  try {
    reportError.value = ''
    const keys = overrideKeys ?? selectedReportKeys.value
    if (!keys.length) throw new Error('Ceklis minimal satu laporan untuk diunduh sebagai PDF.')
    downloadSelectedReportsPdf({
      selectedKeys: keys,
      fromDate: reportFromDate.value,
      toDate: reportToDate.value,
      data: {
        customers: store.customers,
        bookings: store.bookings,
        invoices: store.invoices,
        payments: store.payments,
        refunds: store.refunds,
        expenses: store.expenses,
        inventory: store.inventory,
        movements: store.movements,
        stockOpnames: store.stockOpnames,
        sortedOrderGroups: store.sortedOrderGroups,
        groupTotal: store.groupTotal,
        invoiceTotal: store.invoiceTotal,
        bookingTotal: store.bookingTotal,
        bookingPaid: store.bookingPaid,
        bookingBalance: store.bookingBalance,
        stockAvailable: store.stockAvailable,
        stockStatus: store.stockStatus,
      },
    })
  } catch (err) {
    reportError.value = err instanceof Error ? err.message : 'Gagal membuat PDF laporan.'
  }
}

watch(() => route.query.catalog, (catalog) => {
  if (typeof catalog !== 'string' || !['orders', 'additional'].includes(props.module)) return
  openOrder(catalog)
  router.replace({ path: route.path, query: {} })
}, { immediate: true })
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div><span class="eyebrow">{{ meta.eyebrow }}</span><h2>{{ meta.title }}</h2><p>{{ meta.description }}</p></div>
      <div class="heading-actions">
        <button
          v-if="module === 'reports'"
          class="primary-button"
          :disabled="!selectedReportKeys.length"
          @click="exportSelectedReportsPdf()"
        >
          <Download :size="17" />Unduh PDF ({{ selectedReportKeys.length }} Laporan)
        </button>
        <button v-else-if="module === 'expenses'" class="primary-button" @click="openCreateExpense"><Plus :size="18" />Catat Pengeluaran</button>
        <button v-else-if="module !== 'invoices'" class="primary-button" @click="openOrder()"><Plus :size="18" />{{ module === 'orders' ? 'Buat Pesanan' : 'Tambah Layanan Tambahan' }}</button>
      </div>
    </section>

    <template v-if="module === 'invoices'">
      <section class="summary-strip">
        <div><span>Total invoice</span><strong>{{ store.invoices.length }}</strong></div>
        <div><span>Nilai tagihan</span><strong>{{ formatCurrency(store.totalBilling) }}</strong></div>
        <div><span>Dibayar</span><strong>{{ formatCurrency(store.totalPaid) }}</strong></div>
        <div><span>Piutang</span><strong>{{ formatCurrency(store.totalReceivable) }}</strong></div>
      </section>
      <section class="invoice-card-list">
        <article v-for="invoice in store.invoices" :key="invoice.id" class="invoice-row-card">
          <span class="document-icon"><ReceiptText :size="22" /></span>
          <div class="invoice-main">
            <span>Invoice dibuat {{ formatDate(invoice.issuedAt) }} · {{ store.sortedOrderGroups(invoice).length }} kelompok pesanan</span>
            <h3>{{ invoice.invoiceNumber }}</h3>
            <p>{{ store.customerFor(store.bookingFor(invoice.bookingId)?.customerId ?? '')?.name }} · {{ store.bookingFor(invoice.bookingId)?.poNumber }}</p>
          </div>
          <div class="invoice-amount">
            <span>Total tagihan · Sisa {{ formatCurrency(store.bookingBalance(invoice.bookingId)) }}</span>
            <strong>{{ formatCurrency(store.invoiceTotal(invoice)) }}</strong>
          </div>
          <StatusBadge :label="paymentStatus(invoice.bookingId)" />
          <div class="row-actions">
            <button class="icon-button" title="Lihat detail faktur" @click="previewInvoice(invoice)"><Eye :size="16" /></button>
            <button class="icon-button" title="Cetak faktur" @click="previewInvoice(invoice)"><Printer :size="16" /></button>
            <button class="icon-button" title="Unduh PDF Faktur" @click="downloadInvoice(invoice)"><Download :size="16" /></button>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="module === 'orders'">
      <section class="summary-strip">
        <div><span>Pesanan PO</span><strong>{{ store.invoices.length }}</strong></div>
        <div><span>Total tagihan</span><strong>{{ formatCurrency(store.totalBilling) }}</strong></div>
        <div><span>Pembayaran diterima</span><strong>{{ formatCurrency(store.totalPaid) }}</strong></div>
        <div><span>Sisa tagihan</span><strong>{{ formatCurrency(store.totalReceivable) }}</strong></div>
      </section>

      <section class="panel table-panel">
        <div class="table-toolbar">
          <label class="table-search"><Search :size="17" /><input v-model="orderSearch" placeholder="Cari Nomor PO, invoice, atau customer" /></label>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nomor PO</th>
                <th>Customer</th>
                <th>Tanggal Invoice Dibuat</th>
                <th>Total Tagihan</th>
                <th>Sisa Pembayaran</th>
                <th>Status</th>
                <th>Invoice</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="invoice in filteredOrderInvoices"
                :key="invoice.id"
                class="order-row-selectable"
                :class="{ 'is-selected': invoice.bookingId === selectedOrderBookingId }"
                @click="selectBookingOrder(invoice.bookingId, true)"
              >
                <td><strong class="mono-code">{{ store.bookingFor(invoice.bookingId)?.poNumber }}</strong></td>
                <td><strong>{{ store.customerFor(store.bookingFor(invoice.bookingId)?.customerId ?? '')?.name }}</strong></td>
                <td>{{ formatDate(invoice.issuedAt) }}</td>
                <td><strong>{{ formatCurrency(store.bookingTotal(invoice.bookingId)) }}</strong></td>
                <td><strong>{{ formatCurrency(store.bookingBalance(invoice.bookingId)) }}</strong></td>
                <td><StatusBadge :label="paymentStatus(invoice.bookingId)" /></td>
                <td>{{ invoice.invoiceNumber }}</td>
                <td>
                  <div class="row-actions" @click.stop>
                    <button class="icon-button" title="Lihat detail pesanan" @click="selectBookingOrder(invoice.bookingId, true, false)"><Eye :size="16" /></button>
                    <button class="icon-button" title="Edit pesanan" @click="selectBookingOrder(invoice.bookingId, true, true)"><Pencil :size="15" /></button>
                    <button class="icon-button" title="Lihat invoice" @click="previewInvoice(invoice)"><ReceiptText :size="16" /></button>
                  </div>
                </td>
              </tr>
              <tr v-if="!filteredOrderInvoices.length">
                <td colspan="8">
                  <div class="empty-state">
                    <ShoppingBag :size="28" />
                    <strong>Belum ada pesanan</strong>
                    <span>Klik tombol "Buat Pesanan" untuk mencatat pesanan awal customer.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-else-if="module === 'additional'">
      <section class="panel table-panel">
        <div class="table-toolbar">
          <label class="table-search"><Search :size="17" /><input v-model="orderSearch" placeholder="Cari Nomor PO, faktur, atau pelanggan" /></label>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nomor PO</th>
                <th>Pelanggan</th>
                <th>Tanggal Pesanan</th>
                <th>Item Layanan</th>
                <th>Total Harga Paket</th>
                <th>Faktur</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in additionalGroupRows" :key="row.id">
                <td><strong class="mono-code">{{ row.poNumber }}</strong></td>
                <td><strong>{{ row.customerName }}</strong></td>
                <td>{{ formatDate(row.orderDate) }}</td>
                <td>
                  <span v-for="item in store.sortInvoiceItemsIntiFirst(row.items)" :key="item.id" class="item-pill">
                    {{ item.name }} ×{{ item.quantity }} ({{ formatCurrency(item.unitPrice) }})
                  </span>
                </td>
                <td><strong>{{ formatCurrency(row.total) }}</strong></td>
                <td>{{ row.invoice.invoiceNumber }}</td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="icon-button" title="Lihat detail pesanan PO" @click="selectBookingOrder(row.bookingId, true, false)">
                      <Eye :size="15" />
                    </button>
                    <button type="button" class="icon-button" title="Ubah pesanan tambahan ini" @click="selectBookingOrder(row.bookingId, true, row.id)">
                      <Pencil :size="15" />
                    </button>
                    <button type="button" class="icon-button danger-icon-button" title="Hapus kelompok tambahan ini" @click="openDeleteAdditionalModal(row)">
                      <Trash2 :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!additionalGroupRows.length">
                <td colspan="7">
                  <div class="empty-state">
                    <Sparkles :size="28" />
                    <strong>Belum ada pesanan tambahan</strong>
                    <span>Layanan tambahan baru akan tercatat sebagai kelompok pesanan pada PO dan faktur yang sama.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-else-if="module === 'expenses'">
      <section class="summary-strip">
        <div><span>Total pengeluaran</span><strong>{{ formatCurrency(store.totalExpenses) }}</strong></div>
        <div><span>Berdasarkan PO</span><strong>{{ formatCurrency(store.expenses.filter((e) => e.bookingId).reduce((s, e) => s + e.amount, 0)) }}</strong></div>
        <div><span>Di Luar PO</span><strong>{{ formatCurrency(store.expenses.filter((e) => !e.bookingId).reduce((s, e) => s + e.amount, 0)) }}</strong></div>
        <div><span>Jumlah transaksi</span><strong>{{ store.expenses.length }}</strong></div>
      </section>
      <section class="panel table-panel">
        <div class="table-toolbar">
          <div class="segmented-tabs">
            <button :class="{ active: expenseScopeFilter === 'Semua' }" @click="expenseScopeFilter = 'Semua'">Semua</button>
            <button :class="{ active: expenseScopeFilter === 'Berdasarkan PO' }" @click="expenseScopeFilter = 'Berdasarkan PO'">Berdasarkan PO</button>
            <button :class="{ active: expenseScopeFilter === 'Di Luar PO' }" @click="expenseScopeFilter = 'Di Luar PO'">Di Luar PO</button>
          </div>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Sumber</th><th>Pengeluaran</th><th>Kategori</th><th>Nomor PO</th><th>Metode</th><th>Nominal</th><th>Bukti</th><th>Aksi</th></tr></thead>
            <tbody>
              <tr v-for="row in filteredExpenses" :key="row.id">
                <td>{{ formatDate(row.date) }}</td>
                <td>
                  <span class="expense-scope-badge" :class="row.bookingId ? 'is-po' : 'is-non-po'">
                    {{ row.bookingId ? 'Berdasarkan PO' : 'Di Luar PO' }}
                  </span>
                </td>
                <td><strong>{{ row.description }}</strong></td>
                <td>{{ row.category }}</td>
                <td>{{ row.bookingId ? store.bookingFor(row.bookingId)?.poNumber : 'Di Luar PO (Operasional)' }}</td>
                <td>{{ row.method === 'Cash' ? 'Tunai' : row.method }}</td>
                <td><strong>{{ formatCurrency(row.amount) }}</strong></td>
                <td>
                  <button v-if="row.proofImageUrl" type="button" class="proof-thumb-btn" title="Lihat bukti pembayaran" @click="zoomedExpenseProof = row.proofImageUrl; showExpenseProofZoom = true">
                    <img :src="row.proofImageUrl" alt="Bukti pengeluaran" />
                  </button>
                  <span v-else class="subtle-line">—</span>
                </td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="icon-button" title="Lihat detail pengeluaran" @click="selectedExpenseDetail = row; showExpenseDetail = true">
                      <Eye :size="15" />
                    </button>
                    <button type="button" class="icon-button" title="Ubah pengeluaran" @click="openEditExpense(row)">
                      <Pencil :size="15" />
                    </button>
                    <button type="button" class="icon-button danger-icon-button" title="Hapus pengeluaran" @click="openDeleteExpenseModal(row)">
                      <Trash2 :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!filteredExpenses.length">
                <td colspan="9">
                  <div class="empty-state">
                    <CircleDollarSign :size="28" />
                    <strong>Belum ada data pengeluaran</strong>
                    <span>Klik "Catat Pengeluaran" untuk menambahkan pengeluaran baru.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="panel report-toolbar-panel">
        <div class="report-filter-row">
          <label><span>Dari Tanggal (Opsional)</span><input v-model="reportFromDate" type="date" /></label>
          <label><span>Sampai Tanggal (Opsional)</span><input v-model="reportToDate" type="date" /></label>
          <button v-if="reportFromDate || reportToDate" type="button" class="soft-button" @click="reportFromDate = ''; reportToDate = ''">Reset Periode</button>
        </div>
        <div class="report-select-controls">
          <button type="button" class="soft-button" @click="selectAllReports"><CheckSquare :size="15" />Pilih Semua ({{ REPORT_CATALOG.length }})</button>
          <button type="button" class="soft-button" @click="clearAllReports"><Square :size="15" />Kosongkan</button>
        </div>
      </section>

      <p v-if="reportError" class="form-error">{{ reportError }}</p>

      <section class="report-grid">
        <article
          v-for="(report, index) in REPORT_CATALOG"
          :key="report.key"
          class="report-card report-card--selectable"
          :class="{ 'is-checked': selectedReportKeys.includes(report.key) }"
          @click="toggleReportKey(report.key)"
        >
          <label class="report-checkbox-wrap" @click.stop>
            <input
              type="checkbox"
              :checked="selectedReportKeys.includes(report.key)"
              @change="toggleReportKey(report.key)"
            />
          </label>
          <div>
            <strong>{{ report.title }}</strong>
            <p>{{ report.description }}</p>
          </div>
          <div class="report-actions" @click.stop>
            <button type="button" title="Download PDF bagian ini saja" @click="exportSelectedReportsPdf([report.key])">
              <Download :size="16" />
            </button>
          </div>
          <small>{{ String(index + 1).padStart(2, '0') }}</small>
        </article>
      </section>

      <section class="report-download-bar">
        <div>
          <strong>{{ selectedReportKeys.length }} dari {{ REPORT_CATALOG.length }} bagian laporan dipilih</strong>
          <span>Hasil ekspor disusun dalam format tabel PDF profesional lengkap dengan nomor halaman.</span>
        </div>
        <button type="button" class="primary-button" :disabled="!selectedReportKeys.length" @click="exportSelectedReportsPdf()">
          <Download :size="17" />Download PDF Laporan
        </button>
      </section>
    </template>

    <UiModal :open="showExpense" :title="editingExpenseId ? 'Ubah Data Pengeluaran' : 'Catat Pengeluaran (Bisa Banyak Item)'" description="Pilih jenis pengeluaran, lalu tambahkan satu atau beberapa item pengeluaran sekaligus dalam satu kali simpan." wide @close="showExpense = false">
      <form class="form-grid" @submit.prevent="submitExpense">
        <div class="span-2 expense-scope-toggle">
          <span>Jenis Pengeluaran *</span>
          <div class="segmented-tabs">
            <button
              type="button"
              :class="{ active: expense.expenseScope === 'Berdasarkan PO' }"
              @click="expense.expenseScope = 'Berdasarkan PO'; expense.items.forEach((l) => { if (!store.poExpenseCategories.includes(l.category)) l.category = store.poExpenseCategories[0] ?? l.category })"
            >
              Berdasarkan PO
            </button>
            <button
              type="button"
              :class="{ active: expense.expenseScope === 'Di Luar PO' }"
              @click="expense.expenseScope = 'Di Luar PO'; expense.bookingId = ''; expense.items.forEach((l) => { if (!store.generalExpenseCategories.includes(l.category)) l.category = store.generalExpenseCategories[0] ?? l.category })"
            >
              Di Luar PO (Operasional Umum)
            </button>
          </div>
        </div>
        <label><span>Tanggal *</span><input v-model="expense.date" type="date" /></label>
        <label>
          <span>Metode Pembayaran *</span>
          <select v-model="expense.method">
            <option v-for="m in store.paymentMethods" :key="m" :value="m">{{ m }}</option>
            <option v-if="expense.method && !store.paymentMethods.includes(expense.method)" :value="expense.method">
              {{ expense.method === 'Cash' ? 'Tunai' : expense.method }}
            </option>
          </select>
        </label>
        <label v-if="expense.expenseScope === 'Berdasarkan PO'" class="span-2">
          <span>Pilih Nomor PO *</span>
          <select v-model="expense.bookingId">
            <option value="">Pilih Nomor PO terkait</option>
            <option v-for="booking in store.bookings.filter((b) => b.status !== 'Dibatalkan')" :key="booking.id" :value="booking.id">
              {{ booking.poNumber }} — {{ store.customerFor(booking.customerId)?.name }}
            </option>
          </select>
        </label>

        <div class="order-lines span-2">
          <div class="order-lines-head">
            <div>
              <strong>Daftar Item Pengeluaran ({{ expense.items.length }} Baris)</strong>
              <span>Tambahkan beberapa pengeluaran sekaligus agar tidak perlu input satu per satu.</span>
            </div>
            <button v-if="!editingExpenseId" type="button" class="soft-button" @click="addExpenseLine">
              <Plus :size="15" />+ Tambah Baris
            </button>
          </div>

          <div v-for="(line, idx) in expense.items" :key="line.key" class="expense-batch-row">
            <label>
              <span>Kategori {{ idx + 1 }} *</span>
              <select v-model="line.category">
                <option v-for="cat in expenseCategoryOptions" :key="cat" :value="cat">{{ cat }}</option>
                <option v-if="line.category && !expenseCategoryOptions.includes(line.category)" :value="line.category">
                  {{ line.category }}
                </option>
              </select>
            </label>
            <label>
              <span>Deskripsi Pengeluaran *</span>
              <input v-model="line.description" placeholder="Contoh: Transportasi venue / beli perlengkapan" />
            </label>
            <label>
              <span>Nominal *</span>
              <CurrencyInput v-model="line.amount" aria-label="Nominal pengeluaran" />
            </label>
            <button
              v-if="!editingExpenseId"
              type="button"
              class="icon-button order-line-remove"
              :disabled="expense.items.length === 1"
              title="Hapus baris pengeluaran"
              @click="expense.items.splice(idx, 1)"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </div>

        <div class="order-grand-total span-2">
          <span>Total Pengeluaran ({{ expense.items.length }} Item)</span>
          <strong>{{ formatCurrency(expenseBatchTotal) }}</strong>
        </div>

        <div class="span-2 attire-upload-block">
          <span class="upload-field-label">Bukti Pembayaran (Opsional)</span>
          <label class="upload-zone">
            <img v-if="expense.proofImageUrl" :src="expense.proofImageUrl" alt="Bukti pembayaran pengeluaran" />
            <div v-else><UploadCloud :size="24" /><strong>Unggah bukti nota atau transfer JPG, PNG, atau WebP</strong><span>Opsional · Maksimal 5 MB</span></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleExpenseProofUpload" />
          </label>
          <button v-if="expense.proofImageUrl" type="button" class="soft-button remove-photo-btn" @click="expense.proofImageUrl = ''">Hapus bukti</button>
          <p v-if="expenseUploading" class="upload-state"><LoaderCircle class="spin" :size="15" />Memproses foto…</p>
          <p v-if="expenseUploadError" class="form-error">{{ expenseUploadError }}</p>
        </div>
        <p v-if="expenseError" class="form-error span-2">{{ expenseError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showExpense = false">Batal</button>
          <button class="primary-button" :disabled="expenseUploading">
            {{ editingExpenseId ? 'Simpan Perubahan' : `Simpan Pengeluaran (${expense.items.length} Item)` }}
          </button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showExpenseDetail && Boolean(selectedExpenseDetail)" title="Detail Pengeluaran" description="Rincian biaya dan bukti pembayaran opsional." @close="showExpenseDetail = false">
      <div v-if="selectedExpenseDetail" class="detail-grid">
        <div><span>Tanggal</span><strong>{{ formatDate(selectedExpenseDetail.date) }}</strong></div>
        <div><span>Jenis Pengeluaran</span><strong>{{ selectedExpenseDetail.bookingId ? 'Berdasarkan PO' : 'Di Luar PO' }}</strong></div>
        <div><span>Kategori</span><strong>{{ selectedExpenseDetail.category }}</strong></div>
        <div><span>Nomor PO</span><strong>{{ selectedExpenseDetail.bookingId ? store.bookingFor(selectedExpenseDetail.bookingId)?.poNumber : 'Di Luar PO (Operasional)' }}</strong></div>
        <div><span>Metode</span><strong>{{ selectedExpenseDetail.method === 'Cash' ? 'Tunai' : selectedExpenseDetail.method }}</strong></div>
        <div><span>Nominal</span><strong>{{ formatCurrency(selectedExpenseDetail.amount) }}</strong></div>
        <div class="span-2"><span>Deskripsi</span><strong>{{ selectedExpenseDetail.description }}</strong></div>
        <div v-if="selectedExpenseDetail.proofImageUrl" class="span-2">
          <span>Bukti Pembayaran</span>
          <img :src="selectedExpenseDetail.proofImageUrl" alt="Bukti pembayaran" class="expense-detail-proof-img" />
        </div>
      </div>
      <div class="modal-actions">
        <button class="secondary-button" @click="showExpenseDetail = false">Tutup</button>
        <button v-if="selectedExpenseDetail" class="primary-button" @click="showExpenseDetail = false; openEditExpense(selectedExpenseDetail)"><Pencil :size="15" />Ubah Pengeluaran</button>
      </div>
    </UiModal>

    <UiModal :open="showDeleteExpenseModal && Boolean(deletingExpense)" title="Hapus Data Pengeluaran?" description="Pengeluaran yang dihapus akan memperbarui perhitungan arus kas bersih." @close="showDeleteExpenseModal = false">
      <div v-if="deletingExpense" class="cancel-impact-box">
        <strong>{{ deletingExpense.description }}</strong>
        <ul>
          <li>Tanggal: {{ formatDate(deletingExpense.date) }} · Kategori: {{ deletingExpense.category }}</li>
          <li>Nominal: <b>{{ formatCurrency(deletingExpense.amount) }}</b></li>
        </ul>
      </div>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteExpenseModal = false">Batal</button>
        <button type="button" class="danger-button" @click="confirmDeleteExpense">Ya, Hapus Pengeluaran</button>
      </div>
    </UiModal>

    <UiModal :open="showExpenseProofZoom" title="Bukti Pembayaran Pengeluaran" @close="showExpenseProofZoom = false">
      <div class="attire-zoom">
        <div>
          <img v-if="zoomedExpenseProof" :src="zoomedExpenseProof" alt="Bukti pembayaran pengeluaran" />
          <ImageIcon v-else :size="48" />
        </div>
      </div>
    </UiModal>

    <UiModal :open="showDeleteAdditionalModal && Boolean(deletingAdditionalTarget)" title="Hapus Kelompok Tambahan?" description="Kelompok pesanan tambahan akan dihapus dari PO dan nilai faktur diperbarui otomatis." @close="showDeleteAdditionalModal = false">
      <div v-if="deletingAdditionalTarget" class="cancel-impact-box">
        <strong>{{ deletingAdditionalTarget.poNumber }} — {{ deletingAdditionalTarget.customerName }}</strong>
        <ul>
          <li>Tanggal Pemesanan: {{ formatDate(deletingAdditionalTarget.orderDate) }}</li>
        </ul>
      </div>
      <p v-if="deleteAdditionalError" class="form-error" style="margin-top: 12px;">{{ deleteAdditionalError }}</p>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteAdditionalModal = false">Batal</button>
        <button type="button" class="danger-button" @click="confirmDeleteAdditional">Ya, Hapus Kelompok Tambahan</button>
      </div>
    </UiModal>

    <UiModal :open="showOrder" :title="module === 'additional' ? 'Tambah Additional' : 'Buat Pesanan'" :description="module === 'additional' ? 'Menambahkan kelompok pesanan additional pada Nomor PO yang sama tanpa mengubah tanggal invoice dibuat.' : 'Catat pesanan awal customer dan terbitkan invoice PO.'" wide @close="showOrder = false">
      <form class="form-grid" @submit.prevent="submitOrder">
        <label class="span-2">
          <span>Nomor PO *</span>
          <select v-model="order.bookingId">
            <option value="">Pilih booking</option>
            <option v-for="booking in eligibleBookings" :key="booking.id" :value="booking.id">{{ booking.poNumber }} — {{ store.customerFor(booking.customerId)?.name }} — {{ formatDate(booking.eventDate) }}</option>
          </select>
        </label>
        <template v-if="module === 'orders'">
          <label><span>Tanggal Invoice Dibuat *</span><input v-model="order.issuedAt" type="date" /></label>
          <label><span>Tanggal Pemesanan *</span><input v-model="order.orderDate" type="date" /></label>
          <label class="span-2"><span>Jatuh tempo (opsional)</span><input v-model="order.dueDate" type="date" /></label>
        </template>
        <template v-else>
          <label class="span-2"><span>Tanggal Pemesanan Additional *</span><input v-model="order.orderDate" type="date" /></label>
        </template>

        <div class="order-lines span-2">
          <div class="order-lines-head">
            <div>
              <strong>{{ module === 'additional' ? 'Item layanan Additional' : 'Item layanan (Inti & Additional)' }}</strong>
              <span>{{ module === 'additional' ? 'Klik + Additional di samping untuk menambahkan layanan additional; nama & harga tersimpan saat transaksi.' : 'Klik + Layanan Inti atau + Additional di samping untuk menambahkan layanan; nama & harga tersimpan saat transaksi.' }}</span>
            </div>
            <div class="add-group-add-trigger">
              <button v-if="module === 'orders'" type="button" class="soft-button add-inti-button" @click="addGroupRowByType(order.items, 'Inti')">
                <Plus :size="14" />+ Layanan Inti
              </button>
              <button type="button" class="soft-button add-additional-button" @click="addGroupRowByType(order.items, 'Additional')">
                <Plus :size="14" />+ Additional
              </button>
            </div>
          </div>

          <div v-if="!order.items.length" class="empty-order-lines-hint">
            <template v-if="module === 'additional'">
              Belum ada layanan ditambahkan. Klik <strong>+ Additional</strong> untuk menambahkan item.
            </template>
            <template v-else>
              Belum ada layanan ditambahkan. Klik <strong>+ Layanan Inti</strong> atau <strong>+ Additional</strong> untuk menambahkan item.
            </template>
          </div>

          <div v-else class="order-lines-grid">
            <div class="order-lines-columns">
              <span>Nama Layanan</span>
              <span>Qty</span>
              <span>Harga Satuan</span>
              <span class="align-right">Subtotal</span>
              <span />
            </div>

            <div v-for="(line, index) in order.items" :key="line.key" class="order-line-row">
              <div class="order-line-service">
                <div class="order-line-service-top">
                  <span
                    class="service-kind-tag"
                    :class="(line.filterType === 'Inti' || line.serviceKind === 'Inti') ? 'is-inti' : 'is-add'"
                  >
                    {{ line.filterType === 'Inti' ? 'Inti' : line.filterType === 'Additional' ? 'Additional' : (line.serviceKind ?? 'Layanan') }}
                  </span>
                  <select v-model="line.catalogItemId" @change="onCatalogChange(line)">
                    <option value="">{{ line.filterType === 'Inti' ? 'Pilih layanan inti' : line.filterType === 'Additional' ? 'Pilih layanan additional' : 'Pilih layanan' }}</option>
                    <option v-for="item in (line.filterType === 'Inti' ? coreCatalog : line.filterType === 'Additional' ? additionalCatalog : eligibleCatalog)" :key="item.id" :value="item.id">
                      {{ item.name }} ({{ formatCurrency(item.price) }}/{{ item.unit }})
                    </option>
                  </select>
                </div>
                <small v-if="line.catalogItemId">
                  Satuan: {{ store.catalog.find((item) => item.id === line.catalogItemId)?.unit ?? 'unit' }} · Harga katalog: {{ formatCurrency(store.catalog.find((item) => item.id === line.catalogItemId)?.price ?? 0) }}
                </small>
              </div>
              <input v-model.number="line.quantity" type="number" min="1" aria-label="Qty" />
              <CurrencyInput v-model="line.customerPrice" aria-label="Harga satuan" />
              <div class="order-line-subtotal">
                <strong>{{ formatCurrency(line.quantity * line.customerPrice) }}</strong>
              </div>
              <button
                type="button"
                class="icon-button order-line-remove"
                title="Hapus baris"
                @click="order.items.splice(index, 1)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
        </div>

        <div class="order-grand-total span-2">
          <span>Total {{ module === 'additional' ? 'additional' : 'pesanan awal' }}</span>
          <strong>{{ formatCurrency(orderTotal) }}</strong>
        </div>
        <p v-if="orderError" class="form-error span-2">{{ orderError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showOrder = false">Batal</button>
          <button class="primary-button">{{ module === 'additional' ? 'Simpan Additional' : 'Simpan & Buat Invoice' }}</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showOrderDetail && Boolean(activeOrderInvoice && activeOrderBooking)" :title="activeOrderBooking ? `Pesanan ${activeOrderBooking.poNumber} — ${store.customerFor(activeOrderBooking.customerId)?.name}` : 'Detail Pesanan'" description="Edit per kelompok pesanan, tambah layanan Inti/Additional bertahap, dan pantau sisa tagihan." wide @close="showOrderDetail = false">
      <div v-if="activeOrderInvoice && activeOrderBooking" class="order-detail-modal-body">
        <header class="order-detail-header order-detail-header--modal">
          <div>
            <p>
              Nomor Invoice: <strong>{{ activeOrderInvoice.invoiceNumber }}</strong> ·
              Tanggal Invoice Dibuat: <strong>{{ formatDate(activeOrderInvoice.issuedAt) }}</strong> ·
              Acara: <strong>{{ formatDate(activeOrderBooking.eventDate) }}</strong>
            </p>
          </div>
          <div class="order-detail-header-actions">
            <StatusBadge :label="paymentStatus(activeOrderBooking.id)" />
            <button type="button" class="secondary-button" @click="showOrderDetail = false; previewInvoice(activeOrderInvoice)">
              <ReceiptText :size="16" />Lihat Invoice
            </button>
          </div>
        </header>

        <div class="order-groups-stack">
          <article v-for="(group, gIdx) in activeOrderGroups" :key="group.id" class="order-group-card">
            <header class="order-group-head">
              <div class="order-group-title">
                <span class="order-group-badge" :class="group.kind === 'Awal' ? 'is-initial' : 'is-additional'">
                  {{ group.kind === 'Awal' ? 'Pesanan Awal' : `Pesanan Tambahan ${gIdx}` }}
                </span>
                <span class="order-group-date"><CalendarDays :size="14" />Tanggal Pemesanan: <strong>{{ formatDate(group.orderDate) }}</strong></span>
              </div>
              <div class="order-group-head-right">
                <div class="order-group-subtotal">
                  <span>Total harga paket</span>
                  <strong>{{ formatCurrency(store.groupTotal(group)) }}</strong>
                </div>
                <button
                  v-if="editingGroupId !== group.id"
                  type="button"
                  class="icon-button"
                  title="Edit kelompok pesanan ini"
                  @click="startEditGroup(group)"
                >
                  <Pencil :size="15" />
                </button>
              </div>
            </header>

            <div v-if="editingGroupId === group.id" class="edit-group-inline">
              <div class="add-group-meta">
                <label>
                  <span>Tanggal Pemesanan *</span>
                  <input v-model="editGroupForm.orderDate" type="date" required />
                </label>
                <div class="add-group-add-trigger">
                  <button type="button" class="soft-button add-inti-button" @click="addGroupRowByType(editGroupForm.items, 'Inti')">
                    <Plus :size="14" />+ Inti
                  </button>
                  <button type="button" class="soft-button add-additional-button" @click="addGroupRowByType(editGroupForm.items, 'Additional')">
                    <Plus :size="14" />+ Additional
                  </button>
                </div>
              </div>

              <div class="order-lines-grid">
                <div class="order-lines-columns">
                  <span>Nama Layanan</span>
                  <span>Qty</span>
                  <span>Harga Satuan</span>
                  <span class="align-right">Subtotal</span>
                  <span />
                </div>

                <div v-for="(line, idx) in editGroupForm.items" :key="line.key" class="order-line-row">
                  <div class="order-line-service">
                    <select v-model="line.catalogItemId" @change="onCatalogChange(line)">
                      <option value="">Pilih layanan</option>
                      <template v-if="line.filterType === 'Inti' || line.filterType === 'Additional'">
                        <option v-for="item in catalogOptionsForLine(line)" :key="item.id" :value="item.id">
                          {{ item.name }} ({{ formatCurrency(item.price) }}/{{ item.unit }})
                        </option>
                      </template>
                      <template v-else>
                        <optgroup label="Layanan Inti">
                          <option v-for="item in coreCatalog" :key="item.id" :value="item.id">
                            {{ item.name }} ({{ formatCurrency(item.price) }}/{{ item.unit }})
                          </option>
                        </optgroup>
                        <optgroup label="Layanan Additional">
                          <option v-for="item in additionalCatalog" :key="item.id" :value="item.id">
                            {{ item.name }} ({{ formatCurrency(item.price) }}/{{ item.unit }})
                          </option>
                        </optgroup>
                      </template>
                    </select>
                    <small v-if="line.catalogItemId">
                      {{ store.catalog.find((c) => c.id === line.catalogItemId)?.type ?? line.serviceKind ?? 'Layanan' }} · Satuan: {{ store.catalog.find((c) => c.id === line.catalogItemId)?.unit ?? 'unit' }} · Katalog {{ formatCurrency(store.catalog.find((c) => c.id === line.catalogItemId)?.price ?? 0) }}
                    </small>
                  </div>
                  <input v-model.number="line.quantity" type="number" min="1" aria-label="Qty" />
                  <CurrencyInput v-model="line.customerPrice" aria-label="Harga satuan" />
                  <div class="order-line-subtotal">
                    <strong>{{ formatCurrency(line.quantity * line.customerPrice) }}</strong>
                  </div>
                  <button
                    type="button"
                    class="icon-button order-line-remove"
                    :disabled="editGroupForm.items.length === 1"
                    title="Hapus baris"
                    @click="editGroupForm.items.splice(idx, 1)"
                  >
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>

              <div class="add-group-form-footer">
                <div class="add-group-total">
                  <span>Total harga paket (Setelah Edit)</span>
                  <strong>{{ formatCurrency(editGroupTotal) }}</strong>
                </div>
                <div class="add-group-actions">
                  <button type="button" class="secondary-button" @click="cancelEditGroup">Batal</button>
                  <button type="button" class="primary-button" @click="saveEditGroup(group.id)"><Check :size="16" />Simpan Perubahan</button>
                </div>
              </div>
              <p v-if="editGroupError" class="form-error">{{ editGroupError }}</p>
            </div>

            <div v-else class="order-group-table-wrap">
              <table class="order-group-table">
                <thead>
                  <tr>
                    <th>Nama Layanan</th>
                    <th class="col-qty">Qty</th>
                    <th class="col-money">Harga Satuan</th>
                    <th class="col-money">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in store.sortInvoiceItemsIntiFirst(group.items)" :key="item.id">
                    <td>
                      <strong>{{ item.name }}</strong>
                      <span class="service-kind-tag" :class="item.serviceType === 'Inti' ? 'is-inti' : 'is-add'">
                        {{ item.serviceType ?? 'Additional' }}
                      </span>
                    </td>
                    <td class="col-qty">{{ item.quantity }} <small v-if="item.unit">{{ item.unit }}</small></td>
                    <td class="col-money">{{ formatCurrency(item.unitPrice) }}</td>
                    <td class="col-money"><strong>{{ formatCurrency(item.quantity * item.unitPrice) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <form v-if="showAddGroupForm" class="add-group-form" @submit.prevent="submitAdditionalGroup">
            <header class="add-group-form-head">
              <div>
                <strong>Tambah Kelompok Pesanan</strong>
                <span>Pilih tanggal pemesanan dan tambahkan layanan Inti maupun Additional dari katalog.</span>
              </div>
              <button type="button" class="icon-button" title="Tutup" @click="cancelAddGroupForm"><X :size="16" /></button>
            </header>

            <div class="add-group-meta">
              <label>
                <span>Tanggal Pesanan *</span>
                <input v-model="addGroupForm.orderDate" type="date" required />
              </label>
              <div class="add-group-add-trigger">
                <button type="button" class="soft-button add-inti-button" @click="addGroupRowByType(addGroupForm.items, 'Inti')">
                  <Plus :size="15" />+ Inti
                </button>
                <button type="button" class="soft-button add-additional-button" @click="addGroupRowByType(addGroupForm.items, 'Additional')">
                  <Plus :size="15" />+ Additional
                </button>
              </div>
            </div>

            <div v-if="!addGroupForm.items.length" class="empty-order-lines-hint">
              Klik tombol <strong>+ Inti</strong> atau <strong>+ Additional</strong> di atas untuk memilih dan menampilkan baris layanan.
            </div>

            <div v-else class="order-lines-grid">
              <div class="order-lines-columns">
                <span>Nama Layanan</span>
                <span>Qty</span>
                <span>Harga Satuan</span>
                <span class="align-right">Subtotal</span>
                <span />
              </div>

              <div v-for="(line, idx) in addGroupForm.items" :key="line.key" class="order-line-row">
                <div class="order-line-service">
                  <div class="order-line-service-top">
                    <span
                      class="service-kind-tag"
                      :class="(line.filterType === 'Inti' || line.serviceKind === 'Inti') ? 'is-inti' : 'is-add'"
                    >
                      {{ line.filterType === 'Inti' ? 'Inti' : line.filterType === 'Additional' ? 'Additional' : (line.serviceKind ?? 'Layanan') }}
                    </span>
                    <select v-model="line.catalogItemId" @change="onCatalogChange(line)">
                      <option value="">{{ line.filterType === 'Inti' ? 'Pilih layanan inti' : line.filterType === 'Additional' ? 'Pilih layanan additional' : 'Pilih layanan inti / additional' }}</option>
                      <template v-if="line.filterType === 'Inti' || line.filterType === 'Additional'">
                        <option v-for="item in catalogOptionsForLine(line)" :key="item.id" :value="item.id">
                          {{ item.name }} ({{ formatCurrency(item.price) }}/{{ item.unit }})
                        </option>
                      </template>
                      <template v-else>
                        <optgroup label="Layanan Inti">
                          <option v-for="item in coreCatalog" :key="item.id" :value="item.id">
                            {{ item.name }} ({{ formatCurrency(item.price) }}/{{ item.unit }})
                          </option>
                        </optgroup>
                        <optgroup label="Layanan Additional">
                          <option v-for="item in additionalCatalog" :key="item.id" :value="item.id">
                            {{ item.name }} ({{ formatCurrency(item.price) }}/{{ item.unit }})
                          </option>
                        </optgroup>
                      </template>
                    </select>
                  </div>
                  <small v-if="line.catalogItemId">
                    {{ store.catalog.find((c) => c.id === line.catalogItemId)?.type }} · Satuan: {{ store.catalog.find((c) => c.id === line.catalogItemId)?.unit }} · Katalog {{ formatCurrency(store.catalog.find((c) => c.id === line.catalogItemId)?.price ?? 0) }}
                  </small>
                </div>
                <input v-model.number="line.quantity" type="number" min="1" aria-label="Qty" />
                <CurrencyInput v-model="line.customerPrice" aria-label="Harga satuan" />
                <div class="order-line-subtotal">
                  <strong>{{ formatCurrency(line.quantity * line.customerPrice) }}</strong>
                </div>
                <button
                  type="button"
                  class="icon-button order-line-remove"
                  title="Hapus baris"
                  @click="addGroupForm.items.splice(idx, 1)"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>

            <div class="add-group-form-footer">
              <div class="add-group-total">
                <span>Total Pesanan Tambahan</span>
                <strong>{{ formatCurrency(addGroupTotal) }}</strong>
              </div>
              <div class="add-group-actions">
                <button type="button" class="secondary-button" @click="cancelAddGroupForm">Batal</button>
                <button type="submit" class="primary-button"><Check :size="16" />Simpan Pesanan Tambahan</button>
              </div>
            </div>
            <p v-if="addGroupError" class="form-error">{{ addGroupError }}</p>
          </form>

          <div class="add-order-group-bar">
            <button v-if="!showAddGroupForm" type="button" class="outline-button add-pesanan-button" @click="openAddGroupForm">
              <Plus :size="17" />+ Pesanan
            </button>
          </div>
        </div>

        <footer class="order-financial-summary">
          <div>
            <span>Total Tagihan</span>
            <strong>{{ formatCurrency(store.bookingTotal(activeOrderBooking.id)) }}</strong>
          </div>
          <div>
            <span>Total Pembayaran Diterima</span>
            <strong>{{ formatCurrency(store.bookingPaid(activeOrderBooking.id)) }}</strong>
          </div>
          <div class="is-balance">
            <span>Sisa Pembayaran</span>
            <strong>{{ formatCurrency(store.bookingBalance(activeOrderBooking.id)) }}</strong>
          </div>
        </footer>

        <section v-if="store.bookingPayments(activeOrderBooking.id).length" class="po-payment-history">
          <strong>Riwayat Pembayaran PO ({{ store.bookingPayments(activeOrderBooking.id).length }} transaksi)</strong>
          <ul>
            <li v-for="pay in store.bookingPayments(activeOrderBooking.id)" :key="pay.id">
              <span class="mono-code">{{ pay.receiptNumber }}</span>
              <span>{{ formatDate(pay.paidAt) }} · {{ pay.method }}<template v-if="pay.notes"> ({{ pay.notes }})</template></span>
              <strong>{{ formatCurrency(pay.amount) }}</strong>
            </li>
          </ul>
        </section>
      </div>
      <div class="modal-actions"><button class="primary-button" @click="showOrderDetail = false">Tutup</button></div>
    </UiModal>

    <UiModal :open="showInvoice" title="Pratinjau Faktur Tagihan" description="Dokumen tagihan dengan urutan layanan Inti di atas Tambahan." wide @close="showInvoice = false">
      <div v-if="selectedInvoice" class="invoice-document doc-card">
        <header class="doc-banner">
          <div class="doc-banner-brand">
            <img v-if="store.businessProfile.logoUrl" :src="store.businessProfile.logoUrl" :alt="store.businessProfile.name" class="doc-banner-logo" />
            <span v-else class="doc-banner-monogram">{{ (store.businessProfile.name || 'A').slice(0, 1).toUpperCase() }}</span>
            <div>
              <strong>{{ (store.businessProfile.name || 'AZURA').toUpperCase() }} {{ (store.businessProfile.tagline || 'MAKEUP ARTIST').toUpperCase() }}</strong>
              <small>{{ store.businessProfile.address }} · {{ store.businessProfile.email }}<template v-if="store.businessProfile.phone"> · {{ store.businessProfile.phone }}</template></small>
            </div>
          </div>
          <div class="doc-banner-meta">
            <span>FAKTUR TAGIHAN</span>
            <strong>{{ selectedInvoice.invoiceNumber }}</strong>
            <small>{{ formatDate(selectedInvoice.issuedAt) }}</small>
          </div>
        </header>

        <section class="doc-info-grid">
          <article>
            <span>DITAGIHKAN KEPADA</span>
            <strong>{{ store.customerFor(store.bookingFor(selectedInvoice.bookingId)?.customerId ?? '')?.name }}</strong>
            <small>Telepon / WA: {{ store.customerFor(store.bookingFor(selectedInvoice.bookingId)?.customerId ?? '')?.phone }}</small>
            <small>Tanggal Dibuat: {{ formatDate(selectedInvoice.issuedAt) }}</small>
          </article>
          <article>
            <span>RINCIAN PEMESANAN</span>
            <strong class="mono-code">{{ store.bookingFor(selectedInvoice.bookingId)?.poNumber }}</strong>
            <small>Acara: {{ formatDate(store.bookingFor(selectedInvoice.bookingId)?.eventDate ?? '') }} · {{ store.bookingFor(selectedInvoice.bookingId)?.location }}</small>
            <small>Pesanan Awal: {{ formatDate(store.sortedOrderGroups(selectedInvoice)[0]?.orderDate ?? selectedInvoice.issuedAt) }}</small>
          </article>
        </section>

        <div class="invoice-groups">
          <section v-for="(group, gIdx) in store.sortedOrderGroups(selectedInvoice)" :key="group.id" class="invoice-group-block doc-table-section">
            <div class="doc-group-caption">
              <strong>{{ group.kind === 'Awal' ? 'Pesanan Awal' : `Pesanan Tambahan ${gIdx}` }}</strong>
              <span>Tanggal Pemesanan: {{ formatDate(group.orderDate) }}</span>
            </div>
            <div class="doc-table-wrap">
              <table class="doc-table">
                <thead>
                  <tr>
                    <th>Nama Layanan</th>
                    <th class="col-center">Jumlah</th>
                    <th class="col-right">Harga Satuan</th>
                    <th class="col-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in store.sortInvoiceItemsIntiFirst(group.items)" :key="item.id">
                    <td>
                      <strong>{{ item.name }}</strong>
                      <span class="invoice-service-tag">{{ item.serviceType === 'Inti' ? 'Inti' : 'Tambahan' }}</span>
                    </td>
                    <td class="col-center">{{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }}</td>
                    <td class="col-right">{{ formatCurrency(item.unitPrice) }}</td>
                    <td class="col-right"><strong>{{ formatCurrency(item.quantity * item.unitPrice) }}</strong></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3">Total harga paket</td>
                    <td class="col-right"><strong>{{ formatCurrency(store.groupTotal(group)) }}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>

        <section class="doc-bottom-grid">
          <div class="doc-history-card">
            <span class="doc-sublabel">RIWAYAT PEMBAYARAN &amp; STATUS</span>
            <StatusBadge :label="paymentStatus(selectedInvoice.bookingId)" />
            <ul v-if="store.bookingPayments(selectedInvoice.bookingId).length" class="doc-history-list">
              <li v-for="pay in store.bookingPayments(selectedInvoice.bookingId)" :key="pay.id">
                <span>{{ pay.receiptNumber }} · {{ formatDate(pay.paidAt) }} ({{ pay.method === 'Cash' ? 'Tunai' : pay.method }})</span>
                <strong>{{ formatCurrency(pay.amount) }}</strong>
              </li>
            </ul>
            <p v-else class="doc-muted-note">Belum ada transaksi pembayaran tercatat.</p>
          </div>

          <div class="doc-espresso-card">
            <div class="doc-espresso-line">
              <span>Total Tagihan</span>
              <strong>{{ formatCurrency(store.bookingTotal(selectedInvoice.bookingId)) }}</strong>
            </div>
            <div class="doc-espresso-line">
              <span>Total Dibayar</span>
              <strong>{{ formatCurrency(store.bookingPaid(selectedInvoice.bookingId)) }}</strong>
            </div>
            <div class="doc-espresso-line is-total">
              <span>Sisa Pembayaran</span>
              <strong>{{ formatCurrency(Math.max(0, store.bookingBalance(selectedInvoice.bookingId))) }}</strong>
            </div>
          </div>
        </section>

        <footer class="doc-footer">
          <p>{{ store.businessProfile.invoiceNote || 'Terima kasih telah mempercayakan momen spesial Anda.' }}</p>
          <div class="doc-footer-row">
            <small>{{ store.businessProfile.email }} · {{ store.businessProfile.phone }} · {{ store.businessProfile.address }}</small>
            <a href="https://daysheet.id" target="_blank" rel="noopener noreferrer" class="daysheet-copyright-link">
              Hak Cipta © {{ new Date().getFullYear() }} Daysheet.id
            </a>
          </div>
        </footer>
      </div>
      <div class="modal-actions no-print">
        <button class="secondary-button" @click="showInvoice = false">Tutup</button>
        <button type="button" class="secondary-button" @click="printInvoice"><Printer :size="16" />Cetak</button>
        <button v-if="selectedInvoice" type="button" class="primary-button" @click="downloadInvoice(selectedInvoice)"><Download :size="17" />Unduh PDF Faktur</button>
      </div>
    </UiModal>
  </div>
</template>
