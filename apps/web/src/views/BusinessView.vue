<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Plus, Download, Printer, Search, ReceiptText, ShoppingBag,
  Sparkles, CircleDollarSign, BarChart3, Trash2, CalendarDays, Eye, Check, X, Pencil, CheckSquare, Square,
  UploadCloud, LoaderCircle, Image as ImageIcon, RotateCcw, ChevronDown, ChevronUp,
} from '@lucide/vue'
import { useCrmStore, type CatalogType, type Expense, type Invoice, type OrderGroup } from '../stores/crm'
import { formatCurrency, formatDate } from '../utils/format'
import { REPORT_CATALOG, type ReportKey } from '../utils/reportCatalog'
import { uploadImageWithFallback } from '../utils/uploadImage'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'
import CurrencyInput from '../components/CurrencyInput.vue'
import SearchSelect from '../components/SearchSelect.vue'
import DataPagination from '../components/DataPagination.vue'

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
const orderStatusFilter = ref<'All' | 'Paid' | 'Partial' | 'Unpaid'>('All')
const orderPage = ref(1)
const orderPageSize = ref(10)
const additionalPage = ref(1)
const additionalPageSize = ref(10)
const invoiceSearch = ref('')
const invoiceStatusFilter = ref<'All' | 'Paid' | 'Partial' | 'Unpaid'>('All')
const invoiceFromDate = ref('')
const invoiceToDate = ref('')
const invoicePage = ref(1)
const invoicePageSize = ref(10)
const expenseError = ref('')
const orderError = ref('')
const exportingReports = ref(false)

interface OrderLine {
  key: string
  id?: string
  catalogItemId: string
  serviceName: string
  serviceKind?: CatalogType
  filterType?: 'All' | CatalogType
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

const expenseScopeFilter = ref<'All' | 'Berdasarkan PO' | 'Di Luar PO' | 'Cancel'>('All')
const expenseFromDate = ref('')
const expenseToDate = ref('')
const expenseSearch = ref('')
const expenseCategoryFilter = ref('All')
const expensePoFilter = ref('All')
const expensePage = ref(1)
const expensePageSize = ref(10)
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
const filteredExpenses = computed(() => {
  const q = expenseSearch.value.trim().toLowerCase()
  return store.expenses.filter((e) => {
    if (expenseScopeFilter.value === 'Cancel' && e.source !== 'Bayar Cancel') return false
    if (expenseScopeFilter.value === 'Berdasarkan PO' && !e.bookingId) return false
    if (expenseScopeFilter.value === 'Di Luar PO' && e.bookingId) return false
    if (expenseFromDate.value && e.date < expenseFromDate.value) return false
    if (expenseToDate.value && e.date > expenseToDate.value) return false
    if (expenseCategoryFilter.value !== 'All' && e.category !== expenseCategoryFilter.value) return false
    if (expensePoFilter.value === '__overhead__') {
      if (e.bookingId) return false
    } else if (expensePoFilter.value !== 'All' && e.bookingId !== expensePoFilter.value) {
      return false
    }
    if (!q) return true
    const po = e.bookingId ? store.bookingFor(e.bookingId)?.poNumber.toLowerCase() ?? '' : 'studio overhead'
    return (
      e.description.toLowerCase().includes(q)
      || e.category.toLowerCase().includes(q)
      || po.includes(q)
    )
  })
})

const paginatedExpenses = computed(() => {
  const start = (expensePage.value - 1) * expensePageSize.value
  return filteredExpenses.value.slice(start, start + expensePageSize.value)
})

watch([expenseScopeFilter, expenseFromDate, expenseToDate, expenseSearch, expenseCategoryFilter, expensePoFilter], () => {
  expensePage.value = 1
})

const expenseFilterCategoryOptions = computed(() => {
  const unique = new Set<string>([
    ...store.poExpenseCategories,
    ...store.generalExpenseCategories,
    ...store.expenses.map((e) => e.category),
  ])
  return [
    { value: 'All', label: 'All Categories' },
    ...[...unique].filter(Boolean).map((c) => ({ value: c, label: c })),
  ]
})

const expenseFilterPoOptions = computed(() => [
  { value: 'All', label: 'All PO References' },
  { value: '__overhead__', label: 'Studio Overhead (Outside PO)' },
  ...store.bookings.map((b) => ({
    value: b.id,
    label: `${b.poNumber} — ${store.customerFor(b.customerId)?.name ?? 'Customer'}`,
    sublabel: formatDate(b.eventDate),
  })),
])

const resetExpenseFilters = () => {
  expenseScopeFilter.value = 'All'
  expenseFromDate.value = ''
  expenseToDate.value = ''
  expenseSearch.value = ''
  expenseCategoryFilter.value = 'All'
  expensePoFilter.value = 'All'
}
const editingExpenseRecord = computed(() =>
  editingExpenseId.value ? store.expenses.find((e) => e.id === editingExpenseId.value) ?? null : null,
)
const editingExpenseIsCancel = computed(() => editingExpenseRecord.value?.source === 'Bayar Cancel')
const order = reactive<{ bookingId: string; issuedAt: string; orderDate: string; dueDate: string; items: OrderLine[] }>({
  bookingId: '',
  issuedAt: new Date().toISOString().slice(0, 10),
  orderDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  items: [],
})

const meta = computed(() => ({
  orders: { eyebrow: 'Workspace', title: 'Customer Orders', description: 'Create initial PO orders, edit order packages, and append core or add-on service groups.', icon: ShoppingBag },
  additional: { eyebrow: 'Workspace', title: 'Add-on Services', description: 'Track, edit, and append extra add-on service batches linked to existing customer POs.', icon: Sparkles },
  invoices: { eyebrow: 'Workspace', title: 'Invoices', description: 'Official client billing statements ordering core services ahead of add-on packages.', icon: ReceiptText },
  expenses: { eyebrow: 'Business', title: 'Expenses', description: 'Record PO-linked expenses, studio overheads, and automatic Cancel Payment refund history.', icon: CircleDollarSign },
  reports: { eyebrow: 'Business', title: 'Executive Reports', description: 'Select the operational and financial sections you need and export a unified aesthetic PDF.', icon: BarChart3 },
})[props.module])

const paymentStatus = (bookingId: string) => {
  const total = store.bookingTotal(bookingId)
  const paid = store.bookingPaid(bookingId)
  if (!total) return 'Unbilled'
  if (paid >= total) return 'Paid'
  if (paid > 0) return 'Partial'
  return 'Unpaid'
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
    const status = paymentStatus(inv.bookingId)
    if (orderStatusFilter.value !== 'All' && status !== orderStatusFilter.value) return false
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

const paginatedOrderInvoices = computed(() => {
  const start = (orderPage.value - 1) * orderPageSize.value
  return filteredOrderInvoices.value.slice(start, start + orderPageSize.value)
})

watch([orderSearch, orderStatusFilter], () => {
  orderPage.value = 1
  additionalPage.value = 1
})

const orderStatusSelectOptions = [
  { value: 'All', label: 'All Payment Statuses' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Partial', label: 'Partial' },
  { value: 'Unpaid', label: 'Unpaid' },
]

const filteredInvoices = computed(() => {
  const query = invoiceSearch.value.trim().toLowerCase()
  return store.invoices.filter((inv) => {
    if (invoiceFromDate.value && inv.issuedAt < invoiceFromDate.value) return false
    if (invoiceToDate.value && inv.issuedAt > invoiceToDate.value) return false
    const status = paymentStatus(inv.bookingId)
    if (invoiceStatusFilter.value !== 'All' && status !== invoiceStatusFilter.value) return false
    if (!query) return true
    const booking = store.bookingFor(inv.bookingId)
    const customer = booking ? store.customerFor(booking.customerId) : undefined
    return (
      inv.invoiceNumber.toLowerCase().includes(query)
      || (booking?.poNumber.toLowerCase().includes(query) ?? false)
      || (customer?.name.toLowerCase().includes(query) ?? false)
      || (customer?.phone.toLowerCase().includes(query) ?? false)
    )
  })
})

const paginatedInvoices = computed(() => {
  const start = (invoicePage.value - 1) * invoicePageSize.value
  return filteredInvoices.value.slice(start, start + invoicePageSize.value)
})

watch([invoiceSearch, invoiceStatusFilter, invoiceFromDate, invoiceToDate], () => {
  invoicePage.value = 1
})

const resetInvoiceFilters = () => {
  invoiceSearch.value = ''
  invoiceStatusFilter.value = 'All'
  invoiceFromDate.value = ''
  invoiceToDate.value = ''
}

const invoiceWaPhone = (invoice: Invoice) => {
  const booking = store.bookingFor(invoice.bookingId)
  const customer = booking ? store.customerFor(booking.customerId) : undefined
  const digits = (customer?.phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

const sendInvoiceWhatsApp = (invoice: Invoice) => {
  const waPhone = invoiceWaPhone(invoice)
  if (!waPhone) {
    store.showActionToast('WhatsApp Unavailable', 'Customer phone number is missing for this PO.', 'amber')
    return
  }
  const booking = store.bookingFor(invoice.bookingId)
  const customer = booking ? store.customerFor(booking.customerId) : undefined
  const total = store.bookingTotal(invoice.bookingId)
  const paid = store.bookingPaid(invoice.bookingId)
  const balance = Math.max(0, store.bookingBalance(invoice.bookingId))
  const status = paymentStatus(invoice.bookingId)
  const brandTitle = [store.businessProfile.name || 'Azura', store.businessProfile.tagline || 'Makeup Artist'].filter(Boolean).join(' ')

  const itemLines: string[] = []
  for (const group of store.sortedOrderGroups(invoice)) {
    for (const item of store.sortInvoiceItemsIntiFirst(group.items)) {
      itemLines.push(`  • ${item.name} (${item.quantity}${item.unit ? ` ${item.unit}` : ''}) = ${formatCurrency(item.quantity * item.unitPrice)}`)
    }
  }

  const lines = [
    `Halo ${customer?.name ?? 'Kak'},`,
    `Berikut rincian *Official Invoice* dari *${brandTitle}*:`,
    ``,
    `• Invoice No: ${invoice.invoiceNumber}`,
    `• PO Number: ${booking?.poNumber ?? '-'}`,
    `• Issued Date: ${formatDate(invoice.issuedAt)}`,
    `• Event Date: ${booking?.eventDate ? formatDate(booking.eventDate) : '-'}${booking?.location ? ` · ${booking.location}` : ''}`,
    ``,
    `Rincian Layanan:`,
    ...(itemLines.length ? itemLines : ['  • (Belum ada item)']),
    ``,
    `• Total Invoice: *${formatCurrency(total)}*`,
    `• Total Paid: ${formatCurrency(paid)}`,
    `• Balance Due: *${formatCurrency(balance)}* (${status})`,
    ``,
    store.businessProfile.invoiceNote || `Terima kasih telah mempercayakan momen spesial Anda kepada ${brandTitle}.`,
  ]

  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(lines.join('\n'))}`
  window.open(waUrl, '_blank', 'noopener,noreferrer')
  store.showActionToast('WhatsApp Ready', `Opening WhatsApp invoice message for ${customer?.name ?? waPhone}.`, 'green')
}

const eligibleBookingOptions = computed(() =>
  eligibleBookings.value.map((b) => ({
    value: b.id,
    label: `${b.poNumber} — ${store.customerFor(b.customerId)?.name ?? 'Customer'}`,
    sublabel: formatDate(b.eventDate),
  })),
)

const expenseMethodOptions = computed(() =>
  store.paymentMethods.map((m) => ({ value: m, label: m === 'Cash' || m === 'Tunai' ? 'Cash' : m })),
)

const expenseBookingOptions = computed(() =>
  store.bookings
    .filter((b) => b.status !== 'Dibatalkan')
    .map((b) => ({
      value: b.id,
      label: `${b.poNumber} — ${store.customerFor(b.customerId)?.name ?? 'Customer'}`,
      sublabel: formatDate(b.eventDate),
    })),
)

const expenseCategorySelectOptions = computed(() =>
  expenseCategoryOptions.value.map((c) => ({ value: c, label: c })),
)

const catalogSearchOptionsForLine = (line: OrderLine) => {
  const options: Array<{ value: string; label: string; sublabel?: string; group?: string }> = []
  if (line.catalogItemId && !store.catalog.some((c) => c.id === line.catalogItemId)) {
    options.push({
      value: line.catalogItemId,
      label: `${line.serviceName || 'Saved service'} (Archived)`,
    })
  }
  const source = line.filterType === 'Inti'
    ? coreCatalog.value
    : line.filterType === 'Additional'
      ? additionalCatalog.value
      : eligibleCatalog.value
  for (const item of source) {
    options.push({
      value: item.id,
      label: item.name,
      sublabel: `${formatCurrency(item.price)} / ${item.unit}`,
      group: line.filterType !== 'Inti' && line.filterType !== 'Additional'
        ? (item.type === 'Inti' ? 'Core Services' : 'Add-on Services')
        : undefined,
    })
  }
  return options
}

const reportCategoryMeta = (key: ReportKey) => {
  if (key === 'bookings' || key === 'orders') {
    return { group: 'CRM & Bookings', accent: 'cat-crm' }
  }
  if (key === 'invoices' || key === 'payments' || key === 'receivables') {
    return { group: 'Billing & Revenue', accent: 'cat-billing' }
  }
  if (key === 'expenses' || key === 'cashflow') {
    return { group: 'Cashflow & Expenses', accent: 'cat-cashflow' }
  }
  return { group: 'Inventory & Stock', accent: 'cat-inventory' }
}

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

const paginatedAdditionalRows = computed(() => {
  const start = (additionalPage.value - 1) * additionalPageSize.value
  return additionalGroupRows.value.slice(start, start + additionalPageSize.value)
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

type OrderLineItem = OrderGroup['items'][number]

const resolveItemServiceType = (item: OrderLineItem): CatalogType => {
  if (item.serviceType === 'Inti' || item.serviceType === 'Additional') return item.serviceType
  return store.catalog.find((c) => c.id === item.catalogItemId || c.name.toLowerCase() === item.name.toLowerCase())?.type ?? 'Additional'
}

const splitItemsByType = (items: OrderLineItem[]) => {
  const sorted = store.sortInvoiceItemsIntiFirst(items)
  const intiItems: OrderLineItem[] = []
  const additionalItems: OrderLineItem[] = []
  for (const item of sorted) {
    if (resolveItemServiceType(item) === 'Inti') intiItems.push(item)
    else additionalItems.push(item)
  }
  return { intiItems, additionalItems }
}

const expandedInvoiceGroups = ref<Record<string, boolean>>({})
const expandedDetailGroups = ref<Record<string, boolean>>({})

const isInvoiceGroupOpen = (groupId: string) => Boolean(expandedInvoiceGroups.value[groupId])
const toggleInvoiceGroup = (groupId: string) => {
  expandedInvoiceGroups.value[groupId] = !expandedInvoiceGroups.value[groupId]
}

const isDetailGroupOpen = (groupId: string) => Boolean(expandedDetailGroups.value[groupId])
const toggleDetailGroup = (groupId: string) => {
  expandedDetailGroups.value[groupId] = !expandedDetailGroups.value[groupId]
}

const selectedInvoiceOrderGroups = computed(() => {
  if (!selectedInvoice.value) return []
  return store.sortedOrderGroups(selectedInvoice.value).map((group, gIdx) => {
    const { intiItems, additionalItems } = splitItemsByType(group.items)
    return {
      id: group.id,
      kind: group.kind,
      title: group.kind === 'Awal' ? 'Initial Order' : `Add-on Batch #${gIdx}`,
      orderDate: group.orderDate,
      intiItems,
      additionalItems,
      itemCount: group.items.length,
      total: store.groupTotal(group),
    }
  })
})

const allInvoiceGroupsOpen = computed(() =>
  selectedInvoiceOrderGroups.value.length > 0 &&
  selectedInvoiceOrderGroups.value.every((group) => Boolean(expandedInvoiceGroups.value[group.id])),
)

const toggleAllInvoiceGroups = () => {
  const next = !allInvoiceGroupsOpen.value
  const map: Record<string, boolean> = {}
  for (const group of selectedInvoiceOrderGroups.value) {
    map[group.id] = next
  }
  expandedInvoiceGroups.value = map
}

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
  const defaultBookingId = eligibleBookings.value[0]?.id ?? ''
  Object.assign(order, { bookingId: defaultBookingId, issuedAt: today, orderDate: today, dueDate: '', items: [] })
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
  } else {
    addGroupRowByType(order.items, props.module === 'additional' ? 'Additional' : 'Inti')
  }
  orderError.value = ''
  showOrder.value = true
}

const submitOrder = () => {
  try {
    orderError.value = ''
    if (!order.bookingId) throw new Error('Please select a PO Number first.')
    if (!order.issuedAt) throw new Error('Invoice issue date is required.')
    if (!order.orderDate) throw new Error('Order date is required.')
    if (!order.items.length) {
      throw new Error(props.module === 'additional' ? 'Click + Add-on to add a service item.' : 'Click + Core Service or + Add-on to add items.')
    }
    if (order.items.some((line) => !line.catalogItemId)) throw new Error('Please choose a service on all lines.')
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
    orderError.value = error instanceof Error ? error.message : 'Failed to save order.'
  }
}

const selectBookingOrder = (bookingId: string, openModal = false, startEditTarget: boolean | string = false) => {
  selectedOrderBookingId.value = bookingId
  showAddGroupForm.value = false
  addGroupError.value = ''
  editingGroupId.value = ''
  editGroupError.value = ''
  const inv = store.bookingInvoice(bookingId)
  const groups = inv ? store.sortedOrderGroups(inv) : []
  const detailMap: Record<string, boolean> = {}
  groups.forEach((g, idx) => {
    detailMap[g.id] = idx === 0
  })
  expandedDetailGroups.value = detailMap
  if (openModal) {
    showOrderDetail.value = true
    if (startEditTarget) {
      const target = typeof startEditTarget === 'string'
        ? groups.find((g) => g.id === startEditTarget)
        : groups[0]
      if (target) {
        expandedDetailGroups.value[target.id] = true
        startEditGroup(target)
      }
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
    deleteAdditionalError.value = err instanceof Error ? err.message : 'Failed to remove add-on group.'
  }
}

const openAddGroupForm = () => {
  editingGroupId.value = ''
  addGroupError.value = ''
  addGroupForm.orderDate = new Date().toISOString().slice(0, 10)
  addGroupForm.items = []
  addGroupRowByType(addGroupForm.items, 'Additional')
  showAddGroupForm.value = true
}

const cancelAddGroupForm = () => {
  showAddGroupForm.value = false
  addGroupError.value = ''
  addGroupForm.items = []
}

const addGroupRowByType = (targetList: OrderLine[], filterType: 'All' | CatalogType) => {
  const defaultItem = filterType === 'Inti'
    ? coreCatalog.value[0]
    : filterType === 'Additional'
      ? additionalCatalog.value[0]
      : eligibleCatalog.value[0]
  targetList.push({
    key: crypto.randomUUID(),
    catalogItemId: defaultItem?.id ?? '',
    serviceName: defaultItem?.name ?? '',
    serviceKind: defaultItem?.type,
    filterType,
    quantity: 1,
    customerPrice: defaultItem?.price ?? 0,
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
    if (!selectedOrderBookingId.value) throw new Error('Select a PO Number first.')
    if (!addGroupForm.orderDate) throw new Error('Order date is required.')
    if (!addGroupForm.items.length) throw new Error('Add at least one service item.')
    if (addGroupForm.items.some((line) => !line.catalogItemId)) {
      throw new Error('Select a service on every row.')
    }
    store.addOrderGroupToBooking({
      bookingId: selectedOrderBookingId.value,
      orderDate: addGroupForm.orderDate,
      items: addGroupForm.items,
    })
    showAddGroupForm.value = false
    addGroupForm.items = []
  } catch (err) {
    addGroupError.value = err instanceof Error ? err.message : 'Failed to save add-on package.'
  }
}

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
      filterType: 'All',
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
    if (!activeOrderBooking.value) throw new Error('Booking not found.')
    if (!editGroupForm.orderDate) throw new Error('Order date is required.')
    if (!editGroupForm.items.length) throw new Error('At least one service item is required.')
    if (editGroupForm.items.some((line) => !line.catalogItemId)) {
      throw new Error('Select a service on every row.')
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
    editGroupError.value = err instanceof Error ? err.message : 'Failed to save package changes.'
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
    date: (row.date ?? '').slice(0, 10),
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
    expenseUploadError.value = err instanceof Error ? err.message : 'Failed to upload proof image.'
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
      expenseError.value = 'Add at least one expense line.'
      return
    }
    if (expense.expenseScope === 'Berdasarkan PO' && !expense.bookingId) {
      expenseError.value = 'Please select a PO Number for PO-linked expenses.'
      return
    }
    if (editingExpenseId.value) {
      const line = expense.items[0]!
      if (!line.description.trim() || line.amount <= 0) {
        expenseError.value = 'Description and amount are required.'
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
      method: store.paymentMethods[0] || 'Transfer',
      proofImageUrl: '',
      items: [createExpenseLine()],
    })
    showExpense.value = false
  } catch (err) {
    expenseError.value = err instanceof Error ? err.message : 'Failed to save expense.'
  }
}

const previewInvoice = (invoice: Invoice) => {
  selectedInvoiceId.value = invoice.id
  const map: Record<string, boolean> = {}
  for (const group of store.sortedOrderGroups(invoice)) {
    map[group.id] = false
  }
  expandedInvoiceGroups.value = map
  showInvoice.value = true
}
const downloadInvoice = async (invoice: Invoice) => {
  const booking = store.bookingFor(invoice.bookingId)
  const customer = booking ? store.customerFor(booking.customerId) : undefined
  await store.runWithPdfLoader(
    `Invoice ${invoice.invoiceNumber}`,
    `${booking?.poNumber ?? 'PO'} · ${customer?.name ?? 'Customer'}`,
    async () => {
      const { downloadInvoicePdf } = await import('../utils/invoicePdf')
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
    },
  )
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

const exportSelectedReportsPdf = async (overrideKeys?: ReportKey[]) => {
  try {
    reportError.value = ''
    const keys = overrideKeys ?? selectedReportKeys.value
    if (!keys.length) throw new Error('Select at least one report section to export as PDF.')
    exportingReports.value = true
    await store.runWithPdfLoader(
      'Executive Business Report',
      `${keys.length} report section(s) exported`,
      async () => {
        const { downloadSelectedReportsPdf } = await import('../utils/reportPdf')
        await downloadSelectedReportsPdf({
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
            businessProfile: store.businessProfile,
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
      },
    )
  } catch (err) {
    reportError.value = err instanceof Error ? err.message : 'Failed to generate PDF report.'
  } finally {
    exportingReports.value = false
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
          :disabled="!selectedReportKeys.length || exportingReports"
          @click="exportSelectedReportsPdf()"
        >
          <Download :size="17" />{{ exportingReports ? 'Building PDF…' : `Download PDF (${selectedReportKeys.length} Reports)` }}
        </button>
        <button v-else-if="module === 'expenses'" class="primary-button" @click="openCreateExpense"><Plus :size="18" />Record Expense</button>
        <button v-else-if="module !== 'invoices'" class="primary-button" @click="openOrder()"><Plus :size="18" />{{ module === 'orders' ? 'Create Order' : 'Add Service Batch' }}</button>
      </div>
    </section>

    <template v-if="module === 'invoices'">
      <section class="summary-strip summary-strip--invoices">
        <div class="summary-card-featured"><span>Total Invoices</span><strong>{{ store.invoices.length }}</strong></div>
        <div><span>Total Billed</span><strong>{{ formatCurrency(store.totalBilling) }}</strong></div>
        <div><span>Collected</span><strong>{{ formatCurrency(store.totalPaid) }}</strong></div>
        <div><span>Receivables</span><strong>{{ formatCurrency(store.totalReceivable) }}</strong></div>
      </section>

      <section class="panel invoice-filter-bar">
        <div class="invoice-filter-top">
          <label class="table-search">
            <Search :size="17" />
            <input v-model="invoiceSearch" placeholder="Search customer name, PO number, or invoice no..." />
          </label>
          <div class="invoice-date-range">
            <label class="job-filter-field">
              <span>Issued From</span>
              <input v-model="invoiceFromDate" type="date" aria-label="Invoice issued from date" />
            </label>
            <label class="job-filter-field">
              <span>Issued To</span>
              <input v-model="invoiceToDate" type="date" aria-label="Invoice issued to date" />
            </label>
            <button v-if="invoiceSearch || invoiceFromDate || invoiceToDate || invoiceStatusFilter !== 'All'" type="button" class="soft-button" @click="resetInvoiceFilters">
              <RotateCcw :size="14" />Reset
            </button>
          </div>
        </div>
        <div class="segmented-tabs">
          <button type="button" :class="{ active: invoiceStatusFilter === 'All' }" @click="invoiceStatusFilter = 'All'">All ({{ store.invoices.length }})</button>
          <button type="button" :class="{ active: invoiceStatusFilter === 'Paid' }" @click="invoiceStatusFilter = 'Paid'">Paid</button>
          <button type="button" :class="{ active: invoiceStatusFilter === 'Partial' }" @click="invoiceStatusFilter = 'Partial'">Partial</button>
          <button type="button" :class="{ active: invoiceStatusFilter === 'Unpaid' }" @click="invoiceStatusFilter = 'Unpaid'">Unpaid</button>
        </div>
      </section>

      <section class="invoice-card-list">
        <article v-for="invoice in paginatedInvoices" :key="invoice.id" class="invoice-row-card">
          <span class="document-icon"><ReceiptText :size="22" /></span>
          <div class="invoice-main">
            <span>Issued {{ formatDate(invoice.issuedAt) }} · {{ store.sortedOrderGroups(invoice).length }} order group(s)</span>
            <h3>{{ invoice.invoiceNumber }}</h3>
            <p>{{ store.customerFor(store.bookingFor(invoice.bookingId)?.customerId ?? '')?.name }} · {{ store.bookingFor(invoice.bookingId)?.poNumber }}</p>
          </div>
          <div class="invoice-amount">
            <span>Total billed · Balance {{ formatCurrency(store.bookingBalance(invoice.bookingId)) }}</span>
            <strong>{{ formatCurrency(store.invoiceTotal(invoice)) }}</strong>
          </div>
          <StatusBadge :label="paymentStatus(invoice.bookingId)" />
          <div class="row-actions">
            <button class="icon-button" title="Preview official invoice" @click="previewInvoice(invoice)"><Eye :size="16" /></button>
            <button class="icon-button" title="Print invoice" @click="previewInvoice(invoice)"><Printer :size="16" /></button>
            <button class="icon-button" title="Download Invoice PDF" @click="downloadInvoice(invoice)"><Download :size="16" /></button>
            <button
              v-if="invoiceWaPhone(invoice)"
              type="button"
              class="wa-icon-button"
              title="Share invoice details via WhatsApp"
              aria-label="Send invoice via WhatsApp"
              @click="sendInvoiceWhatsApp(invoice)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.08c-.24.68-1.41 1.3-1.95 1.38-.5.07-1.13.1-1.82-.12-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.18-4.94-4.38-.14-.2-1.18-1.57-1.18-3 0-1.43.75-2.13 1.02-2.42.27-.29.59-.36.79-.36.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.59.83 2.03.9 2.18.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.36 1.45.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.34.07.12.07.7-.17 1.38z"/>
              </svg>
            </button>
          </div>
        </article>
        <div v-if="!filteredInvoices.length" class="panel empty-state">
          <ReceiptText :size="26" />
          <strong>No matching invoices found</strong>
          <span>Try clearing the search query or adjusting the issued date &amp; status filters.</span>
        </div>
      </section>
      <section class="panel" style="padding: 4px;">
        <DataPagination v-model:current-page="invoicePage" v-model:page-size="invoicePageSize" :total-items="filteredInvoices.length" />
      </section>
    </template>

    <template v-else-if="module === 'orders'">
      <section class="summary-strip summary-strip--orders">
        <div class="summary-card-featured"><span>PO Orders</span><strong>{{ store.invoices.length }}</strong></div>
        <div><span>Total Billed</span><strong>{{ formatCurrency(store.totalBilling) }}</strong></div>
        <div><span>Payments Received</span><strong>{{ formatCurrency(store.totalPaid) }}</strong></div>
        <div><span>Balance Due</span><strong>{{ formatCurrency(store.totalReceivable) }}</strong></div>
      </section>

      <section class="panel table-panel">
        <div class="table-toolbar">
          <label class="table-search"><Search :size="17" /><input v-model="orderSearch" placeholder="Search PO number, invoice, or customer" /></label>
          <div class="filter-row">
            <SearchSelect v-model="orderStatusFilter" :options="orderStatusSelectOptions" search-placeholder="Filter status…" aria-label="Filter order payment status" />
          </div>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Customer</th>
                <th>Invoice Issued</th>
                <th>Total Billing</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th>Invoice No.</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="invoice in paginatedOrderInvoices"
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
                    <button class="icon-button" title="View order details" @click="selectBookingOrder(invoice.bookingId, true, false)"><Eye :size="16" /></button>
                    <button class="icon-button" title="Edit order" @click="selectBookingOrder(invoice.bookingId, true, true)"><Pencil :size="15" /></button>
                    <button class="icon-button" title="Preview invoice" @click="previewInvoice(invoice)"><ReceiptText :size="16" /></button>
                  </div>
                </td>
              </tr>
              <tr v-if="!filteredOrderInvoices.length">
                <td colspan="8">
                  <div class="empty-state">
                    <ShoppingBag :size="28" />
                    <strong>No orders yet</strong>
                    <span>Click "Create Order" to build a customer's initial PO package.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <DataPagination v-model:current-page="orderPage" v-model:page-size="orderPageSize" :total-items="filteredOrderInvoices.length" />
      </section>
    </template>

    <template v-else-if="module === 'additional'">
      <section class="panel table-panel">
        <div class="table-toolbar">
          <label class="table-search"><Search :size="17" /><input v-model="orderSearch" placeholder="Search PO number, invoice, or customer" /></label>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Customer</th>
                <th>Order Date</th>
                <th>Service Items</th>
                <th>Package Total</th>
                <th>Invoice</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in paginatedAdditionalRows" :key="row.id">
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
                    <button type="button" class="icon-button" title="View PO orders" @click="selectBookingOrder(row.bookingId, true, false)">
                      <Eye :size="15" />
                    </button>
                    <button type="button" class="icon-button" title="Edit this add-on batch" @click="selectBookingOrder(row.bookingId, true, row.id)">
                      <Pencil :size="15" />
                    </button>
                    <button type="button" class="icon-button danger-icon-button" title="Delete add-on batch" @click="openDeleteAdditionalModal(row)">
                      <Trash2 :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!additionalGroupRows.length">
                <td colspan="7">
                  <div class="empty-state">
                    <Sparkles :size="28" />
                    <strong>No add-on services yet</strong>
                    <span>New add-on batches append to the client's PO and invoice automatically.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <DataPagination v-model:current-page="additionalPage" v-model:page-size="additionalPageSize" :total-items="additionalGroupRows.length" />
      </section>
    </template>

    <template v-else-if="module === 'expenses'">
      <section class="summary-strip">
        <div><span>Transactions</span><strong>{{ store.expenses.length }}</strong></div>
        <div><span>Total Expenses</span><strong>{{ formatCurrency(store.totalExpenses) }}</strong></div>
        <div><span>PO Linked</span><strong>{{ formatCurrency(store.expenses.filter((e) => e.bookingId).reduce((s, e) => s + e.amount, 0)) }}</strong></div>
        <div><span>Cancel Payouts</span><strong>{{ formatCurrency(store.expenses.filter((e) => e.source === 'Bayar Cancel').reduce((s, e) => s + e.amount, 0)) }}</strong></div>
      </section>
      <section class="panel table-panel">
        <div class="table-toolbar expense-filter-toolbar">
          <div class="segmented-tabs">
            <button :class="{ active: expenseScopeFilter === 'All' }" @click="expenseScopeFilter = 'All'">All</button>
            <button :class="{ active: expenseScopeFilter === 'Berdasarkan PO' }" @click="expenseScopeFilter = 'Berdasarkan PO'">PO Linked</button>
            <button :class="{ active: expenseScopeFilter === 'Di Luar PO' }" @click="expenseScopeFilter = 'Di Luar PO'">Studio Overhead</button>
            <button :class="{ active: expenseScopeFilter === 'Cancel' }" @click="expenseScopeFilter = 'Cancel'">Cancel Payment</button>
          </div>
          <div class="expense-advanced-filters">
            <label class="table-search">
              <Search :size="16" />
              <input v-model="expenseSearch" type="search" placeholder="Search expense description…" />
            </label>
            <label class="job-filter-field">
              <span>From Date</span>
              <input v-model="expenseFromDate" type="date" aria-label="Expense from date" />
            </label>
            <label class="job-filter-field">
              <span>To Date</span>
              <input v-model="expenseToDate" type="date" aria-label="Expense to date" />
            </label>
            <div class="job-filter-field">
              <span>Category</span>
              <SearchSelect v-model="expenseCategoryFilter" :options="expenseFilterCategoryOptions" search-placeholder="Search category…" aria-label="Filter expense category" />
            </div>
            <div class="job-filter-field">
              <span>PO Reference</span>
              <SearchSelect v-model="expensePoFilter" :options="expenseFilterPoOptions" search-placeholder="Search PO reference…" aria-label="Filter expense PO" />
            </div>
            <button
              v-if="expenseFromDate || expenseToDate || expenseSearch || expenseCategoryFilter !== 'All' || expensePoFilter !== 'All' || expenseScopeFilter !== 'All'"
              type="button"
              class="soft-button"
              @click="resetExpenseFilters"
            >
              <RotateCcw :size="14" />Reset
            </button>
          </div>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Source</th><th>Description</th><th>Category</th><th>PO Ref</th><th>Method</th><th>Amount</th><th>Proof</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-for="row in paginatedExpenses" :key="row.id">
                <td>{{ formatDate(row.date) }}</td>
                <td>
                  <div class="badge-stack">
                    <span class="expense-scope-badge" :class="row.bookingId ? 'is-po' : 'is-non-po'">
                      {{ row.bookingId ? 'PO Linked' : 'Studio Overhead' }}
                    </span>
                    <span v-if="row.source === 'Bayar Cancel'" class="source-pill is-cancel">
                      Auto Cancel Refund
                    </span>
                  </div>
                </td>
                <td>
                  <strong>{{ row.description }}</strong>
                  <span v-if="row.source === 'Bayar Cancel'" class="subtle-line">Auto-recorded upon booking cancellation</span>
                </td>
                <td>{{ row.category }}</td>
                <td>{{ row.bookingId ? store.bookingFor(row.bookingId)?.poNumber : 'Studio Overhead' }}</td>
                <td>{{ row.method === 'Cash' || row.method === 'Tunai' ? 'Cash' : row.method }}</td>
                <td><strong>{{ formatCurrency(row.amount) }}</strong></td>
                <td>
                  <button v-if="row.proofImageUrl" type="button" class="proof-thumb-btn" title="View payment proof" @click="zoomedExpenseProof = row.proofImageUrl; showExpenseProofZoom = true">
                    <img :src="row.proofImageUrl" alt="Expense proof" />
                  </button>
                  <span v-else class="subtle-line">—</span>
                </td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="icon-button" title="View expense details" @click="selectedExpenseDetail = row; showExpenseDetail = true">
                      <Eye :size="15" />
                    </button>
                    <button type="button" class="icon-button" title="Edit expense" @click="openEditExpense(row)">
                      <Pencil :size="15" />
                    </button>
                    <button type="button" class="icon-button danger-icon-button" title="Delete expense" @click="openDeleteExpenseModal(row)">
                      <Trash2 :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!filteredExpenses.length">
                <td colspan="9">
                  <div class="empty-state">
                    <CircleDollarSign :size="28" />
                    <strong>No expense records yet</strong>
                    <span>Click "Record Expense" or log a cancellation refund to track expenses here.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <DataPagination v-model:current-page="expensePage" v-model:page-size="expensePageSize" :total-items="filteredExpenses.length" />
      </section>
    </template>

    <template v-else>
      <section class="panel report-toolbar-panel">
        <div class="report-filter-row">
          <label><span>From Date (Optional)</span><input v-model="reportFromDate" type="date" /></label>
          <label><span>To Date (Optional)</span><input v-model="reportToDate" type="date" /></label>
          <button v-if="reportFromDate || reportToDate" type="button" class="soft-button" @click="reportFromDate = ''; reportToDate = ''">Reset Dates</button>
        </div>
        <div class="report-select-controls">
          <button type="button" class="soft-button" @click="selectAllReports"><CheckSquare :size="15" />Select All ({{ REPORT_CATALOG.length }})</button>
          <button type="button" class="soft-button" @click="clearAllReports"><Square :size="15" />Clear</button>
        </div>
      </section>

      <p v-if="reportError" class="form-error">{{ reportError }}</p>

      <section class="report-grid">
        <article
          v-for="(report, index) in REPORT_CATALOG"
          :key="report.key"
          class="report-card report-card--selectable report-card--categorized"
          :class="[reportCategoryMeta(report.key).accent, { 'is-checked': selectedReportKeys.includes(report.key) }]"
          @click="toggleReportKey(report.key)"
        >
          <label class="report-checkbox-wrap" @click.stop>
            <input
              type="checkbox"
              :checked="selectedReportKeys.includes(report.key)"
              @change="toggleReportKey(report.key)"
            />
          </label>
          <div class="report-card-body">
            <span class="report-category-badge" :class="reportCategoryMeta(report.key).accent">
              {{ reportCategoryMeta(report.key).group }}
            </span>
            <strong>{{ report.title }}</strong>
            <p>{{ report.description }}</p>
          </div>
          <div class="report-actions" @click.stop>
            <button type="button" title="Download this section only" @click="exportSelectedReportsPdf([report.key])">
              <Download :size="16" />
            </button>
          </div>
          <small>{{ String(index + 1).padStart(2, '0') }}</small>
        </article>
      </section>

      <section class="report-download-bar">
        <div>
          <strong>{{ selectedReportKeys.length }} of {{ REPORT_CATALOG.length }} report sections selected</strong>
          <span>Exports into an executive Azura stationery PDF complete with KPI cards, thumbnails, and page numbers.</span>
        </div>
        <button type="button" class="primary-button" :disabled="!selectedReportKeys.length || exportingReports" @click="exportSelectedReportsPdf()">
          <Download :size="17" />{{ exportingReports ? 'Building PDF…' : 'Download PDF Report' }}
        </button>
      </section>
    </template>

    <UiModal
      :open="showExpense"
      :title="editingExpenseIsCancel ? 'Edit Cancel Payment (Auto Refund)' : (editingExpenseId ? 'Edit Expense Record' : 'Record Expenses (Batch Enabled)')"
      :description="editingExpenseIsCancel ? 'This is an automatic cancellation refund entry. Only Date, Amount, and Payment Proof can be modified.' : 'Select expense scope and log one or more expense lines at once.'"
      wide
      @close="showExpense = false"
    >
      <form class="form-grid" @submit.prevent="submitExpense">
        <template v-if="editingExpenseIsCancel">
          <div class="span-2 paid-info-banner">
            <div>
              <strong>Automatic Cancellation Refund ({{ editingExpenseRecord?.description }})</strong>
              <span>Linked PO and category are locked to preserve cancellation audit history. Changes here sync with Refund History.</span>
            </div>
          </div>
          <label><span>Refund / Expense Date *</span><input v-model="expense.date" type="date" /></label>
          <label v-if="expense.items[0]">
            <span>Refund Amount *</span>
            <CurrencyInput v-model="expense.items[0].amount" aria-label="Cancel payment amount" />
          </label>
        </template>

        <template v-else>
          <div class="span-2 expense-scope-toggle">
            <span>Expense Scope *</span>
            <div class="segmented-tabs">
              <button
                type="button"
                :class="{ active: expense.expenseScope === 'Berdasarkan PO' }"
                @click="expense.expenseScope = 'Berdasarkan PO'; expense.items.forEach((l) => { if (!store.poExpenseCategories.includes(l.category)) l.category = store.poExpenseCategories[0] ?? l.category })"
              >
                PO Linked
              </button>
              <button
                type="button"
                :class="{ active: expense.expenseScope === 'Di Luar PO' }"
                @click="expense.expenseScope = 'Di Luar PO'; expense.bookingId = ''; expense.items.forEach((l) => { if (!store.generalExpenseCategories.includes(l.category)) l.category = store.generalExpenseCategories[0] ?? l.category })"
              >
                Studio Overhead (Outside PO)
              </button>
            </div>
          </div>
          <label class="is-required"><span>Date *</span><input v-model="expense.date" type="date" /></label>
          <label class="is-required">
            <span>Payment Method *</span>
            <SearchSelect v-model="expense.method" :options="expenseMethodOptions" required search-placeholder="Search method…" />
          </label>
          <label v-if="expense.expenseScope === 'Berdasarkan PO'" class="span-2 is-required">
            <span>Select PO Number *</span>
            <SearchSelect v-model="expense.bookingId" :options="expenseBookingOptions" required placeholder="Select linked PO" search-placeholder="Search PO or customer…" />
          </label>

          <div class="order-lines span-2">
            <div class="order-lines-head">
              <div>
                <strong>Expense Line Items ({{ expense.items.length }} Row(s))</strong>
                <span>Log multiple items together in a single batch save.</span>
              </div>
              <button v-if="!editingExpenseId" type="button" class="soft-button" @click="addExpenseLine">
                <Plus :size="15" />Add Line
              </button>
            </div>

            <div v-for="(line, idx) in expense.items" :key="line.key" class="expense-batch-row">
              <label class="is-required">
                <span>Category {{ idx + 1 }} *</span>
                <SearchSelect v-model="line.category" :options="expenseCategorySelectOptions" required search-placeholder="Search category…" />
              </label>
              <label class="is-required">
                <span>Description *</span>
                <input v-model="line.description" placeholder="e.g. Crew transport to venue / supplies" />
              </label>
              <label class="is-required">
                <span>Amount *</span>
                <CurrencyInput v-model="line.amount" aria-label="Expense amount" />
              </label>
              <button
                v-if="!editingExpenseId"
                type="button"
                class="icon-button order-line-remove"
                :disabled="expense.items.length === 1"
                title="Remove row"
                @click="expense.items.splice(idx, 1)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </div>

          <div class="order-grand-total span-2">
            <span>Batch Total ({{ expense.items.length }} Item(s))</span>
            <strong>{{ formatCurrency(expenseBatchTotal) }}</strong>
          </div>
        </template>

        <div class="span-2 attire-upload-block">
          <span class="upload-field-label">Payment Receipt / Proof (Optional)</span>
          <label class="upload-zone">
            <img v-if="expense.proofImageUrl" :src="expense.proofImageUrl" alt="Expense proof" />
            <div v-else><UploadCloud :size="24" /><strong>Upload JPG, PNG, or WebP receipt or proof</strong><span>Optional · Max 5 MB</span></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleExpenseProofUpload" />
          </label>
          <button v-if="expense.proofImageUrl" type="button" class="soft-button remove-photo-btn" @click="expense.proofImageUrl = ''">Remove proof</button>
          <p v-if="expenseUploading" class="upload-state"><LoaderCircle class="spin" :size="15" />Processing image…</p>
          <p v-if="expenseUploadError" class="form-error">{{ expenseUploadError }}</p>
        </div>
        <p v-if="expenseError" class="form-error span-2">{{ expenseError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showExpense = false">Cancel</button>
          <button class="primary-button" :disabled="expenseUploading">
            {{ editingExpenseId ? 'Save Changes' : `Save Expenses (${expense.items.length} Item(s))` }}
          </button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showExpenseDetail && Boolean(selectedExpenseDetail)" title="Expense Details" description="Breakdown and optional proof of payment." @close="showExpenseDetail = false">
      <div v-if="selectedExpenseDetail" class="detail-grid">
        <div><span>Date</span><strong>{{ formatDate(selectedExpenseDetail.date) }}</strong></div>
        <div><span>Source</span><strong>{{ selectedExpenseDetail.source === 'Bayar Cancel' ? 'Cancel Payment (Auto)' : (selectedExpenseDetail.bookingId ? 'PO Linked' : 'Studio Overhead') }}</strong></div>
        <div><span>Category</span><strong>{{ selectedExpenseDetail.category }}</strong></div>
        <div><span>PO Number</span><strong>{{ selectedExpenseDetail.bookingId ? store.bookingFor(selectedExpenseDetail.bookingId)?.poNumber : 'Studio Overhead' }}</strong></div>
        <div><span>Method</span><strong>{{ selectedExpenseDetail.method === 'Cash' || selectedExpenseDetail.method === 'Tunai' ? 'Cash' : selectedExpenseDetail.method }}</strong></div>
        <div><span>Amount</span><strong>{{ formatCurrency(selectedExpenseDetail.amount) }}</strong></div>
        <div class="span-2"><span>Description</span><strong>{{ selectedExpenseDetail.description }}</strong></div>
        <div v-if="selectedExpenseDetail.proofImageUrl" class="span-2">
          <span>Payment Proof</span>
          <img :src="selectedExpenseDetail.proofImageUrl" alt="Expense proof" class="expense-detail-proof-img" />
        </div>
      </div>
      <div class="modal-actions">
        <button class="secondary-button" @click="showExpenseDetail = false">Close</button>
        <button v-if="selectedExpenseDetail" class="primary-button" @click="showExpenseDetail = false; openEditExpense(selectedExpenseDetail)"><Pencil :size="15" />Edit Expense</button>
      </div>
    </UiModal>

    <UiModal :open="showDeleteExpenseModal && Boolean(deletingExpense)" title="Delete Expense Record?" description="Removing this expense will recalculate net cashflow." @close="showDeleteExpenseModal = false">
      <div v-if="deletingExpense" class="cancel-impact-box">
        <strong>{{ deletingExpense.description }}</strong>
        <ul>
          <li>Date: {{ formatDate(deletingExpense.date) }} · Category: {{ deletingExpense.category }}</li>
          <li>Amount: <b>{{ formatCurrency(deletingExpense.amount) }}</b></li>
        </ul>
      </div>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteExpenseModal = false">Cancel</button>
        <button type="button" class="danger-button" @click="confirmDeleteExpense">Yes, Delete Expense</button>
      </div>
    </UiModal>

    <UiModal :open="showExpenseProofZoom" title="Expense Payment Proof" @close="showExpenseProofZoom = false">
      <div class="attire-zoom">
        <div>
          <img v-if="zoomedExpenseProof" :src="zoomedExpenseProof" alt="Expense proof" />
          <ImageIcon v-else :size="48" />
        </div>
      </div>
    </UiModal>

    <UiModal :open="showDeleteAdditionalModal && Boolean(deletingAdditionalTarget)" title="Delete Add-on Group?" description="The add-on service batch will be removed from the PO and invoice totals recalculated." @close="showDeleteAdditionalModal = false">
      <div v-if="deletingAdditionalTarget" class="cancel-impact-box">
        <strong>{{ deletingAdditionalTarget.poNumber }} — {{ deletingAdditionalTarget.customerName }}</strong>
        <ul>
          <li>Order Date: {{ formatDate(deletingAdditionalTarget.orderDate) }}</li>
        </ul>
      </div>
      <p v-if="deleteAdditionalError" class="form-error" style="margin-top: 12px;">{{ deleteAdditionalError }}</p>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteAdditionalModal = false">Cancel</button>
        <button type="button" class="danger-button" @click="confirmDeleteAdditional">Yes, Delete Batch</button>
      </div>
    </UiModal>

    <UiModal :open="showOrder" :title="module === 'additional' ? 'Add Service Batch' : 'Create Order'" :description="module === 'additional' ? 'Append an add-on batch to an existing PO without altering the original invoice issue date.' : 'Record initial customer services and issue a PO invoice.'" wide @close="showOrder = false">
      <form class="form-grid" @submit.prevent="submitOrder">
        <label class="span-2 is-required">
          <span>PO Number *</span>
          <SearchSelect v-model="order.bookingId" :options="eligibleBookingOptions" required search-placeholder="Search PO or customer…" />
        </label>
        <template v-if="module === 'orders'">
          <label class="is-required"><span>Invoice Issue Date *</span><input v-model="order.issuedAt" type="date" /></label>
          <label class="is-required"><span>Order Date *</span><input v-model="order.orderDate" type="date" /></label>
          <label class="span-2 is-optional"><span>Due Date <em class="opt-tag">Optional</em></span><input v-model="order.dueDate" type="date" /></label>
        </template>
        <template v-else>
          <label class="span-2 is-required"><span>Add-on Order Date *</span><input v-model="order.orderDate" type="date" /></label>
        </template>

        <div class="order-lines span-2">
          <div class="order-lines-head">
            <div>
              <strong>{{ module === 'additional' ? 'Add-on Service Items' : 'Order Services (Core & Add-ons)' }}</strong>
              <span>{{ module === 'additional' ? 'Click Add-on to add extra services; item snapshot pricing is stored automatically.' : 'Click Core Service or Add-on to build this customer order.' }}</span>
            </div>
            <div class="add-group-add-trigger">
              <button v-if="module === 'orders'" type="button" class="soft-button add-inti-button" @click="addGroupRowByType(order.items, 'Inti')">
                <Plus :size="14" />Core Service
              </button>
              <button type="button" class="soft-button add-additional-button" @click="addGroupRowByType(order.items, 'Additional')">
                <Plus :size="14" />Add-on
              </button>
            </div>
          </div>

          <div v-if="!order.items.length" class="empty-order-lines-hint">
            <template v-if="module === 'additional'">
              No services added yet. Click <strong>Add-on</strong> to insert a service row.
            </template>
            <template v-else>
              No services added yet. Click <strong>Core Service</strong> or <strong>Add-on</strong> to insert items.
            </template>
          </div>

          <div v-else class="order-lines-grid">
            <div class="order-lines-columns">
              <span>Service Name</span>
              <span>Qty</span>
              <span>Unit Price</span>
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
                    {{ line.filterType === 'Inti' ? 'Core' : line.filterType === 'Additional' ? 'Add-on' : (line.serviceKind === 'Inti' ? 'Core' : 'Add-on') }}
                  </span>
                  <SearchSelect
                    v-model="line.catalogItemId"
                    :options="catalogSearchOptionsForLine(line)"
                    required
                    search-placeholder="Search service…"
                    @change="onCatalogChange(line)"
                  />
                </div>
                <small v-if="line.catalogItemId">
                  Unit: {{ store.catalog.find((item) => item.id === line.catalogItemId)?.unit ?? 'unit' }} · Catalog rate: {{ formatCurrency(store.catalog.find((item) => item.id === line.catalogItemId)?.price ?? 0) }}
                </small>
              </div>
              <input v-model.number="line.quantity" type="number" min="1" aria-label="Qty" />
              <CurrencyInput v-model="line.customerPrice" aria-label="Unit price" />
              <div class="order-line-subtotal">
                <strong>{{ formatCurrency(line.quantity * line.customerPrice) }}</strong>
              </div>
              <button
                type="button"
                class="icon-button order-line-remove"
                title="Remove line"
                @click="order.items.splice(index, 1)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
        </div>

        <div class="order-grand-total span-2">
          <span>{{ module === 'additional' ? 'Add-on Package Total' : 'Initial Order Total' }}</span>
          <strong>{{ formatCurrency(orderTotal) }}</strong>
        </div>
        <p v-if="orderError" class="form-error span-2">{{ orderError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showOrder = false">Cancel</button>
          <button class="primary-button">{{ module === 'additional' ? 'Save Add-on Batch' : 'Save & Issue Invoice' }}</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showOrderDetail && Boolean(activeOrderInvoice && activeOrderBooking)" :title="activeOrderBooking ? `Orders ${activeOrderBooking.poNumber} — ${store.customerFor(activeOrderBooking.customerId)?.name}` : 'Order Details'" description="Edit per order group, add incremental core or add-on packages, and check remaining balance." wide @close="showOrderDetail = false">
      <div v-if="activeOrderInvoice && activeOrderBooking" class="order-detail-modal-body">
        <header class="order-detail-header order-detail-header--modal">
          <div>
            <p>
              Invoice No: <strong>{{ activeOrderInvoice.invoiceNumber }}</strong> ·
              Issued: <strong>{{ formatDate(activeOrderInvoice.issuedAt) }}</strong> ·
              Event: <strong>{{ formatDate(activeOrderBooking.eventDate) }}</strong>
            </p>
          </div>
          <div class="order-detail-header-actions">
            <StatusBadge :label="paymentStatus(activeOrderBooking.id)" />
            <button type="button" class="secondary-button" @click="showOrderDetail = false; previewInvoice(activeOrderInvoice)">
              <ReceiptText :size="16" />Preview Invoice
            </button>
          </div>
        </header>

        <div class="order-groups-stack">
          <article v-for="(group, gIdx) in activeOrderGroups" :key="group.id" class="order-group-card">
            <header class="order-group-head">
              <div class="order-group-title">
                <span class="order-group-badge" :class="group.kind === 'Awal' ? 'is-initial' : 'is-additional'">
                  {{ group.kind === 'Awal' ? 'Initial Order' : `Add-on Batch #${gIdx}` }}
                </span>
                <span class="order-group-date"><CalendarDays :size="14" />Order Date: <strong>{{ formatDate(group.orderDate) }}</strong></span>
              </div>
              <div class="order-group-head-right">
                <div class="order-group-subtotal">
                  <span>Package Total</span>
                  <strong>{{ formatCurrency(store.groupTotal(group)) }}</strong>
                </div>
                <button
                  type="button"
                  class="order-toggle-btn"
                  @click="toggleDetailGroup(group.id)"
                >
                  <ChevronUp v-if="isDetailGroupOpen(group.id) || editingGroupId === group.id" :size="14" />
                  <ChevronDown v-else :size="14" />
                  <span>{{ isDetailGroupOpen(group.id) || editingGroupId === group.id ? 'Hide' : `Show (${group.items.length})` }}</span>
                </button>
                <button
                  v-if="editingGroupId !== group.id"
                  type="button"
                  class="icon-button"
                  title="Edit this order group"
                  @click="startEditGroup(group)"
                >
                  <Pencil :size="15" />
                </button>
              </div>
            </header>

            <div v-if="editingGroupId === group.id" class="edit-group-inline">
              <div class="add-group-meta">
                <label>
                  <span>Order Date *</span>
                  <input v-model="editGroupForm.orderDate" type="date" required />
                </label>
                <div class="add-group-add-trigger">
                  <button type="button" class="soft-button add-inti-button" @click="addGroupRowByType(editGroupForm.items, 'Inti')">
                    <Plus :size="14" />Core
                  </button>
                  <button type="button" class="soft-button add-additional-button" @click="addGroupRowByType(editGroupForm.items, 'Additional')">
                    <Plus :size="14" />Add-on
                  </button>
                </div>
              </div>

              <div class="order-lines-grid">
                <div class="order-lines-columns">
                  <span>Service Name</span>
                  <span>Qty</span>
                  <span>Unit Price</span>
                  <span class="align-right">Subtotal</span>
                  <span />
                </div>

                <div v-for="(line, idx) in editGroupForm.items" :key="line.key" class="order-line-row">
                  <div class="order-line-service">
                    <SearchSelect
                      v-model="line.catalogItemId"
                      :options="catalogSearchOptionsForLine(line)"
                      required
                      search-placeholder="Search service…"
                      @change="onCatalogChange(line)"
                    />
                    <small v-if="line.catalogItemId">
                      {{ store.catalog.find((c) => c.id === line.catalogItemId)?.type === 'Inti' ? 'Core' : 'Add-on' }} · Unit: {{ store.catalog.find((c) => c.id === line.catalogItemId)?.unit ?? 'unit' }} · Catalog {{ formatCurrency(store.catalog.find((c) => c.id === line.catalogItemId)?.price ?? 0) }}
                    </small>
                  </div>
                  <input v-model.number="line.quantity" type="number" min="1" aria-label="Qty" />
                  <CurrencyInput v-model="line.customerPrice" aria-label="Unit price" />
                  <div class="order-line-subtotal">
                    <strong>{{ formatCurrency(line.quantity * line.customerPrice) }}</strong>
                  </div>
                  <button
                    type="button"
                    class="icon-button order-line-remove"
                    :disabled="editGroupForm.items.length === 1"
                    title="Remove line"
                    @click="editGroupForm.items.splice(idx, 1)"
                  >
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>

              <div class="add-group-form-footer">
                <div class="add-group-total">
                  <span>Updated Package Total</span>
                  <strong>{{ formatCurrency(editGroupTotal) }}</strong>
                </div>
                <div class="add-group-actions">
                  <button type="button" class="secondary-button" @click="cancelEditGroup">Cancel</button>
                  <button type="button" class="primary-button" @click="saveEditGroup(group.id)"><Check :size="16" />Save Changes</button>
                </div>
              </div>
              <p v-if="editGroupError" class="form-error">{{ editGroupError }}</p>
            </div>

            <div v-else-if="isDetailGroupOpen(group.id)" class="order-group-tiers">
              <div v-if="splitItemsByType(group.items).intiItems.length" class="service-tier-block is-inti">
                <header class="service-tier-head">
                  <span>Core Services (Inti)</span>
                  <span class="service-tier-count">{{ splitItemsByType(group.items).intiItems.length }} item(s)</span>
                </header>
                <div class="tier-item-list">
                  <div v-for="item in splitItemsByType(group.items).intiItems" :key="item.id" class="tier-item-row">
                    <span class="tier-item-name">{{ item.name }}</span>
                    <span class="tier-item-qtyprice">{{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }} × {{ formatCurrency(item.unitPrice) }}</span>
                    <strong class="tier-item-subtotal">{{ formatCurrency(item.quantity * item.unitPrice) }}</strong>
                  </div>
                </div>
              </div>

              <div v-if="splitItemsByType(group.items).additionalItems.length" class="service-tier-block is-add">
                <header class="service-tier-head">
                  <span>Add-on Services (Additional)</span>
                  <span class="service-tier-count">{{ splitItemsByType(group.items).additionalItems.length }} item(s)</span>
                </header>
                <div class="tier-item-list">
                  <div v-for="item in splitItemsByType(group.items).additionalItems" :key="item.id" class="tier-item-row">
                    <span class="tier-item-name">{{ item.name }}</span>
                    <span class="tier-item-qtyprice">{{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }} × {{ formatCurrency(item.unitPrice) }}</span>
                    <strong class="tier-item-subtotal">{{ formatCurrency(item.quantity * item.unitPrice) }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <form v-if="showAddGroupForm" class="add-group-form" @submit.prevent="submitAdditionalGroup">
            <header class="add-group-form-head">
              <div>
                <strong>Add Order Group</strong>
                <span>Pick the order date and append core or add-on service packages from catalog.</span>
              </div>
              <button type="button" class="icon-button" title="Close" @click="cancelAddGroupForm"><X :size="16" /></button>
            </header>

            <div class="add-group-meta">
              <label>
                <span>Order Date *</span>
                <input v-model="addGroupForm.orderDate" type="date" required />
              </label>
              <div class="add-group-add-trigger">
                <button type="button" class="soft-button add-inti-button" @click="addGroupRowByType(addGroupForm.items, 'Inti')">
                  <Plus :size="15" />Core
                </button>
                <button type="button" class="soft-button add-additional-button" @click="addGroupRowByType(addGroupForm.items, 'Additional')">
                  <Plus :size="15" />Add-on
                </button>
              </div>
            </div>

            <div v-if="!addGroupForm.items.length" class="empty-order-lines-hint">
              Click <strong>Core</strong> or <strong>Add-on</strong> above to insert service lines.
            </div>

            <div v-else class="order-lines-grid">
              <div class="order-lines-columns">
                <span>Service Name</span>
                <span>Qty</span>
                <span>Unit Price</span>
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
                      {{ line.filterType === 'Inti' ? 'Core' : line.filterType === 'Additional' ? 'Add-on' : (line.serviceKind === 'Inti' ? 'Core' : 'Add-on') }}
                    </span>
                    <SearchSelect
                      v-model="line.catalogItemId"
                      :options="catalogSearchOptionsForLine(line)"
                      required
                      search-placeholder="Search service…"
                      @change="onCatalogChange(line)"
                    />
                  </div>
                  <small v-if="line.catalogItemId">
                    {{ store.catalog.find((c) => c.id === line.catalogItemId)?.type === 'Inti' ? 'Core' : 'Add-on' }} · Unit: {{ store.catalog.find((c) => c.id === line.catalogItemId)?.unit }} · Catalog {{ formatCurrency(store.catalog.find((c) => c.id === line.catalogItemId)?.price ?? 0) }}
                  </small>
                </div>
                <input v-model.number="line.quantity" type="number" min="1" aria-label="Qty" />
                <CurrencyInput v-model="line.customerPrice" aria-label="Unit price" />
                <div class="order-line-subtotal">
                  <strong>{{ formatCurrency(line.quantity * line.customerPrice) }}</strong>
                </div>
                <button
                  type="button"
                  class="icon-button order-line-remove"
                  title="Remove line"
                  @click="addGroupForm.items.splice(idx, 1)"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>

            <div class="add-group-form-footer">
              <div class="add-group-total">
                <span>Add-on Batch Total</span>
                <strong>{{ formatCurrency(addGroupTotal) }}</strong>
              </div>
              <div class="add-group-actions">
                <button type="button" class="secondary-button" @click="cancelAddGroupForm">Cancel</button>
                <button type="submit" class="primary-button"><Check :size="16" />Save Order Group</button>
              </div>
            </div>
            <p v-if="addGroupError" class="form-error">{{ addGroupError }}</p>
          </form>

          <div class="add-order-group-bar">
            <button v-if="!showAddGroupForm" type="button" class="outline-button add-pesanan-button" @click="openAddGroupForm">
              <Plus :size="17" />Add Order Group
            </button>
          </div>
        </div>

        <footer class="order-financial-summary">
          <div>
            <span>Total Billed</span>
            <strong>{{ formatCurrency(store.bookingTotal(activeOrderBooking.id)) }}</strong>
          </div>
          <div>
            <span>Payments Received</span>
            <strong>{{ formatCurrency(store.bookingPaid(activeOrderBooking.id)) }}</strong>
          </div>
          <div class="is-balance">
            <span>Balance Due</span>
            <strong>{{ formatCurrency(store.bookingBalance(activeOrderBooking.id)) }}</strong>
          </div>
        </footer>

        <section v-if="store.bookingPayments(activeOrderBooking.id).length" class="po-payment-history">
          <strong>PO Payment History ({{ store.bookingPayments(activeOrderBooking.id).length }} transaction(s))</strong>
          <ul>
            <li v-for="pay in store.bookingPayments(activeOrderBooking.id)" :key="pay.id">
              <span class="mono-code">{{ pay.receiptNumber }}</span>
              <span>{{ formatDate(pay.paidAt) }} · {{ pay.method }}<template v-if="pay.notes"> ({{ pay.notes }})</template></span>
              <strong>{{ formatCurrency(pay.amount) }}</strong>
            </li>
          </ul>
        </section>
      </div>
      <div class="modal-actions"><button class="primary-button" @click="showOrderDetail = false">Close</button></div>
    </UiModal>

    <!-- INVOICE EYE PREVIEW: 100% Aligned with invoicePdf.ts Editorial Stationery -->
    <UiModal :open="showInvoice" title="Official Invoice Preview" description="Identical layout, service sequence, and balance summary as the downloaded Invoice PDF." wide @close="showInvoice = false">
      <article v-if="selectedInvoice" class="editorial-sheet">
        <header class="editorial-sheet-banner">
          <div class="editorial-sheet-brand">
            <div class="editorial-sheet-logo">
              <img v-if="store.businessProfile.logoUrl" :src="store.businessProfile.logoUrl" :alt="store.businessProfile.name" />
              <template v-else>{{ (store.businessProfile.name || 'A').slice(0, 1).toUpperCase() }}</template>
            </div>
            <div>
              <strong>{{ (store.businessProfile.name || 'AZURA').toUpperCase() }} {{ (store.businessProfile.tagline || 'MAKEUP ARTIST').toUpperCase() }}</strong>
              <small>{{ store.bookingFor(selectedInvoice.bookingId)?.poNumber ? `PURCHASE ORDER · ${store.bookingFor(selectedInvoice.bookingId)?.poNumber}` : 'CLIENT BILLING STATEMENT' }}</small>
              <span>{{ store.businessProfile.address }} | {{ store.businessProfile.email }}<template v-if="store.businessProfile.phone"> | {{ store.businessProfile.phone }}</template></span>
            </div>
          </div>
          <div class="editorial-sheet-doc">
            <small>OFFICIAL INVOICE</small>
            <strong>{{ selectedInvoice.invoiceNumber }}</strong>
            <span
              :class="{
                'is-partial': store.bookingPaid(selectedInvoice.bookingId) > 0 && store.bookingBalance(selectedInvoice.bookingId) > 0,
                'is-unpaid': store.bookingPaid(selectedInvoice.bookingId) <= 0,
              }"
            >
              {{ store.bookingBalance(selectedInvoice.bookingId) <= 0 ? 'PAID IN FULL' : store.bookingPaid(selectedInvoice.bookingId) > 0 ? 'PARTIAL PAYMENT' : 'UNPAID' }}
            </span>
          </div>
        </header>

        <div class="editorial-sheet-body">
          <section class="editorial-meta-two">
            <div class="editorial-meta-box">
              <small>BILLED TO</small>
              <strong>{{ store.customerFor(store.bookingFor(selectedInvoice.bookingId)?.customerId ?? '')?.name || '-' }}</strong>
              <span>Phone / WhatsApp: {{ store.customerFor(store.bookingFor(selectedInvoice.bookingId)?.customerId ?? '')?.phone || '-' }}</span>
              <span>Invoice Date: {{ formatDate(selectedInvoice.issuedAt) }}</span>
            </div>
            <div class="editorial-meta-box">
              <small>BOOKING &amp; EVENT DETAILS</small>
              <strong class="mono-code">{{ store.bookingFor(selectedInvoice.bookingId)?.poNumber || '-' }}</strong>
              <span>Event: {{ store.bookingFor(selectedInvoice.bookingId)?.eventDate ? formatDate(store.bookingFor(selectedInvoice.bookingId)!.eventDate) : '-' }}<template v-if="store.bookingFor(selectedInvoice.bookingId)?.location"> · {{ store.bookingFor(selectedInvoice.bookingId)?.location }}</template></span>
              <span>Initial Order: {{ formatDate(store.sortedOrderGroups(selectedInvoice)[0]?.orderDate ?? selectedInvoice.issuedAt) }}</span>
            </div>
          </section>

          <section class="invoice-orders-section">
            <header class="invoice-orders-head">
              <div class="invoice-orders-title">
                <strong>Order Breakdown</strong>
                <span>{{ selectedInvoiceOrderGroups.length }} order(s)</span>
              </div>
              <button
                v-if="selectedInvoiceOrderGroups.length"
                type="button"
                class="invoice-expand-all-btn no-print"
                @click="toggleAllInvoiceGroups"
              >
                <ChevronUp v-if="allInvoiceGroupsOpen" :size="14" />
                <ChevronDown v-else :size="14" />
                <span>{{ allInvoiceGroupsOpen ? 'Hide All Details' : 'Show All Details' }}</span>
              </button>
            </header>

            <article v-for="group in selectedInvoiceOrderGroups" :key="group.id" class="invoice-order-card">
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
                    @click="toggleInvoiceGroup(group.id)"
                  >
                    <ChevronUp v-if="isInvoiceGroupOpen(group.id)" :size="14" />
                    <ChevronDown v-else :size="14" />
                    <span>{{ isInvoiceGroupOpen(group.id) ? 'Hide' : `Show (${group.itemCount})` }}</span>
                  </button>
                </div>
              </header>

              <div v-show="isInvoiceGroupOpen(group.id)" class="invoice-order-body">
                <div v-if="group.intiItems.length" class="service-tier-block is-inti">
                  <header class="service-tier-head">
                    <span>Core Services (Inti)</span>
                    <span class="service-tier-count">{{ group.intiItems.length }} item(s)</span>
                  </header>
                  <div class="tier-item-list">
                    <div v-for="item in group.intiItems" :key="item.id" class="tier-item-row">
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
                    <div v-for="item in group.additionalItems" :key="item.id" class="tier-item-row">
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
            <div class="editorial-meta-box">
              <small>PAYMENT STATUS &amp; HISTORY</small>
              <StatusBadge :label="paymentStatus(selectedInvoice.bookingId)" style="margin: 4px 0;" />
              <ul v-if="store.bookingPayments(selectedInvoice.bookingId).length" class="doc-history-list" style="margin-top: 6px;">
                <li v-for="pay in store.bookingPayments(selectedInvoice.bookingId)" :key="pay.id">
                  <span>{{ pay.receiptNumber }} · {{ formatDate(pay.paidAt) }} ({{ pay.method === 'Cash' || pay.method === 'Tunai' ? 'Cash' : pay.method }})</span>
                  <strong>{{ formatCurrency(pay.amount) }}</strong>
                </li>
              </ul>
              <span v-else>No payment transactions recorded yet.</span>
            </div>

            <div class="editorial-summary-card">
              <div><span>Invoice Total</span><strong>{{ formatCurrency(store.bookingTotal(selectedInvoice.bookingId)) }}</strong></div>
              <div><span>Total Paid</span><strong>{{ formatCurrency(store.bookingPaid(selectedInvoice.bookingId)) }}</strong></div>
              <div class="is-highlight"><span>Balance Due</span><strong>{{ formatCurrency(Math.max(0, store.bookingBalance(selectedInvoice.bookingId))) }}</strong></div>
            </div>
          </section>
        </div>

        <footer class="editorial-sheet-footer">
          <div>
            <strong style="display: block; color: #4d4237; margin-bottom: 2px;">{{ store.businessProfile.invoiceNote || 'Thank you for trusting us with your special celebration.' }}</strong>
            <span>{{ store.businessProfile.email }} · {{ store.businessProfile.phone }} · {{ store.businessProfile.address }}</span>
          </div>
          <a href="https://daysheet.id" target="_blank" rel="noopener noreferrer" class="daysheet-copyright-link">
            Copyright © {{ new Date().getFullYear() }} Daysheet.id
          </a>
        </footer>
      </article>
      <div class="modal-actions invoice-preview-actions no-print" style="margin-top: 14px;">
        <button class="secondary-button" @click="showInvoice = false">Close</button>
        <button type="button" class="secondary-button" @click="printInvoice"><Printer :size="16" />Print</button>
        <button
          v-if="selectedInvoice && invoiceWaPhone(selectedInvoice)"
          type="button"
          class="secondary-button wa-share-btn"
          @click="sendInvoiceWhatsApp(selectedInvoice)"
        >
          Send WhatsApp
        </button>
        <button v-if="selectedInvoice" type="button" class="primary-button" @click="downloadInvoice(selectedInvoice)"><Download :size="17" />Download Invoice PDF</button>
      </div>
    </UiModal>
  </div>
</template>
