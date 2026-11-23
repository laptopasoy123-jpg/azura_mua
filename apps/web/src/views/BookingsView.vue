<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Plus, Search, SlidersHorizontal, MapPin, CalendarDays, Phone, Eye, Pencil,
  Ban, RotateCcw, UploadCloud, LoaderCircle, Image as ImageIcon, AlertTriangle,
  ArrowUp, ArrowDown, ArrowUpDown, Trash2, ShoppingBag, Layers,
} from '@lucide/vue'
import { useCrmStore, type Booking, type BookingRefund, type BookingStatus, type CatalogType, type StylingType } from '../stores/crm'
import { displayBookingStatus, formatCurrency, formatDate, initials, sortAlpha } from '../utils/format'
import { uploadImageWithFallback } from '../utils/uploadImage'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'
import CurrencyInput from '../components/CurrencyInput.vue'
import SearchSelect from '../components/SearchSelect.vue'
import DataPagination from '../components/DataPagination.vue'

const store = useCrmStore()
const route = useRoute()
const router = useRouter()
const activeView = ref<'bookings' | 'refunds'>('bookings')
const search = ref('')
const status = ref('All')
const bookingPage = ref(1)
const bookingPageSize = ref(10)
const refundPage = ref(1)
const refundPageSize = ref(10)
const highlightedBookingId = ref('')
const showForm = ref(false)
const showDetail = ref(false)
const editingId = ref('')
const selectedBooking = ref<Booking | null>(null)
const error = ref('')

// Cancellation modal
const showCancelModal = ref(false)
const cancelTarget = ref<Booking | null>(null)
const cancelWithRefund = ref(false)
const cancelError = ref('')
const cancelUploading = ref(false)
const cancelRefundForm = reactive<{
  refundDate: string
  amount: number
  method: BookingRefund['method']
  proofImageUrl: string
  notes: string
}>({
  refundDate: new Date().toISOString().slice(0, 10),
  amount: 0,
  method: 'Transfer',
  proofImageUrl: '',
  notes: '',
})

// Standalone Refund modal
const showRefundModal = ref(false)
const editingRefundId = ref('')
const refundError = ref('')
const refundUploading = ref(false)
const refundForm = reactive<{
  bookingId: string
  refundDate: string
  amount: number
  method: BookingRefund['method']
  proofImageUrl: string
  notes: string
}>({
  bookingId: '',
  refundDate: new Date().toISOString().slice(0, 10),
  amount: 0,
  method: 'Transfer',
  proofImageUrl: '',
  notes: '',
})

const showProofModal = ref(false)
const zoomedProof = ref('')

const form = reactive({
  name: '',
  phone: '',
  location: '',
  eventDate: '',
  eventTime: '',
  stylingType: '' as '' | StylingType,
  notes: '',
  status: 'Draft' as BookingStatus,
})

type BookingOrderLine = {
  key: string
  id?: string
  catalogItemId: string
  serviceName: string
  serviceKind?: CatalogType
  filterType: CatalogType
  catalogPrice: number
  unit?: string
  quantity: number
  customerPrice: number
}

type BookingOrderGroupDraft = {
  id: string
  kind: 'Awal' | 'Tambahan'
  isNew: boolean
  orderDate: string
  items: BookingOrderLine[]
}

const bookingOrderMeta = reactive({
  issuedAt: new Date().toISOString().slice(0, 10),
  dueDate: '',
})
const bookingOrderGroups = ref<BookingOrderGroupDraft[]>([])

const activeCoreCatalogOptions = computed(() =>
  store.catalog
    .filter((c) => c.active && c.type === 'Inti')
    .map((c) => ({ value: c.id, label: c.name, sublabel: `${formatCurrency(c.price)} / ${c.unit}` })),
)
const activeAddonCatalogOptions = computed(() =>
  store.catalog
    .filter((c) => c.active && c.type === 'Additional')
    .map((c) => ({ value: c.id, label: c.name, sublabel: `${formatCurrency(c.price)} / ${c.unit}` })),
)

const catalogOptionsForLine = (line: BookingOrderLine) => {
  const base = line.filterType === 'Inti' ? activeCoreCatalogOptions.value : activeAddonCatalogOptions.value
  if (line.catalogItemId && !base.some((o) => o.value === line.catalogItemId)) {
    const fallback = store.catalog.find((c) => c.id === line.catalogItemId)
    return [
      {
        value: line.catalogItemId,
        label: line.serviceName || fallback?.name || 'Service',
        sublabel: fallback ? `${formatCurrency(fallback.price)} / ${fallback.unit}` : undefined,
      },
      ...base,
    ]
  }
  return base
}

const addOrderLineToGroup = (group: BookingOrderGroupDraft, filterType: CatalogType) => {
  group.items.push({
    key: crypto.randomUUID(),
    catalogItemId: '',
    serviceName: '',
    serviceKind: filterType,
    filterType,
    catalogPrice: 0,
    quantity: 1,
    customerPrice: 0,
  })
}

const onOrderLineCatalogChange = (line: BookingOrderLine) => {
  const item = store.catalog.find((entry) => entry.id === line.catalogItemId)
  line.serviceName = item?.name ?? ''
  line.serviceKind = item?.type ?? line.filterType
  line.catalogPrice = item?.price ?? 0
  line.unit = item?.unit
  line.customerPrice = item?.price ?? 0
}

const addExtraOrderBatch = () => {
  const today = new Date().toISOString().slice(0, 10)
  const batch: BookingOrderGroupDraft = {
    id: crypto.randomUUID(),
    kind: 'Tambahan',
    isNew: true,
    orderDate: today,
    items: [],
  }
  addOrderLineToGroup(batch, 'Additional')
  bookingOrderGroups.value.push(batch)
}

const bookingOrderGrandTotal = computed(() =>
  bookingOrderGroups.value.reduce(
    (sum, group) => sum + group.items.reduce((s, item) => s + item.quantity * item.customerPrice, 0),
    0,
  ),
)

const editingHasExistingInvoice = computed(() =>
  Boolean(editingId.value && store.bookingInvoice(editingId.value)),
)

const customerSortDir = ref<'none' | 'asc' | 'desc'>('none')
const toggleCustomerSort = () => {
  customerSortDir.value = customerSortDir.value === 'none' ? 'asc' : customerSortDir.value === 'asc' ? 'desc' : 'none'
}

const rows = computed(() => {
  const filtered = store.bookings.filter((booking) => {
    const customer = store.customerFor(booking.customerId)
    const query = search.value.toLowerCase()
    const matchesSearch = !query || booking.poNumber.toLowerCase().includes(query) || customer?.name.toLowerCase().includes(query) || customer?.phone.includes(query)
    return matchesSearch && (status.value === 'All' || booking.status === status.value)
  })
  if (customerSortDir.value === 'none') return filtered
  return sortAlpha(filtered, (b) => store.customerFor(b.customerId)?.name ?? '', customerSortDir.value)
})

const paginatedRows = computed(() => {
  const start = (bookingPage.value - 1) * bookingPageSize.value
  return rows.value.slice(start, start + bookingPageSize.value)
})

const paginatedRefunds = computed(() => {
  const start = (refundPage.value - 1) * refundPageSize.value
  return store.refunds.slice(start, start + refundPageSize.value)
})

watch([search, status], () => {
  bookingPage.value = 1
})

watch(
  () => route.query.highlight,
  async (targetId) => {
    if (typeof targetId !== 'string' || !targetId) return
    activeView.value = 'bookings'
    search.value = ''
    status.value = 'All'
    highlightedBookingId.value = targetId
    const idx = rows.value.findIndex((b) => b.id === targetId)
    if (idx >= 0) {
      bookingPage.value = Math.floor(idx / bookingPageSize.value) + 1
    }
    await nextTick()
    const el = document.querySelector(`[data-booking-id="${targetId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    router.replace({ path: route.path, query: {} })
  },
  { immediate: true },
)

const statusSelectOptions = [
  { value: 'All', label: 'All Statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Terkonfirmasi', label: 'Confirmed' },
  { value: 'Selesai', label: 'Completed' },
  { value: 'Dibatalkan', label: 'Cancelled' },
]

const bookingStatusOptions = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Terkonfirmasi', label: 'Confirmed' },
  { value: 'Selesai', label: 'Completed' },
  { value: 'Dibatalkan', label: 'Cancelled' },
]

const stylingTypeOptions = computed(() => {
  const base = store.stylingTypes.map((s) => ({ value: s, label: s }))
  if (form.stylingType && !store.stylingTypes.includes(form.stylingType)) {
    base.push({ value: form.stylingType, label: form.stylingType })
  }
  return base
})

const methodSelectOptions = computed(() =>
  store.paymentMethods.map((m) => ({ value: m, label: m === 'Cash' || m === 'Tunai' ? 'Cash' : m })),
)

const cancelledPoSelectOptions = computed(() =>
  cancelledBookings.value.map((b) => ({
    value: b.id,
    label: `${b.poNumber} — ${store.customerFor(b.customerId)?.name ?? 'Customer'}`,
    sublabel: b.cancelledPaidAmount ? `Paid ${formatCurrency(b.cancelledPaidAmount)}` : undefined,
  })),
)

const activeBookingsCount = computed(() => store.bookings.filter((b) => b.status !== 'Dibatalkan').length)
const confirmedDoneCount = computed(() => store.bookings.filter((b) => b.status === 'Terkonfirmasi' || b.status === 'Selesai').length)

const cancelledBookings = computed(() => store.bookings.filter((b) => b.status === 'Dibatalkan'))

const cancelPaidAmount = computed(() => (cancelTarget.value ? store.bookingPaid(cancelTarget.value.id) : 0))
const cancelRefundExceedsPaid = computed(() => cancelWithRefund.value && cancelRefundForm.amount > cancelPaidAmount.value)

const selectedRefundBooking = computed(() => store.bookingFor(refundForm.bookingId))
const refundPaidAmount = computed(() => selectedRefundBooking.value?.cancelledPaidAmount ?? 0)
const refundAlreadyReturned = computed(() =>
  refundForm.bookingId
    ? store.refunds
        .filter((r) => r.bookingId === refundForm.bookingId && r.id !== editingRefundId.value)
        .reduce((sum, r) => sum + r.amount, 0)
    : 0,
)
const refundMaxAllowed = computed(() => Math.max(0, refundPaidAmount.value - refundAlreadyReturned.value))
const refundExceedsPaid = computed(() => Boolean(refundForm.bookingId) && refundForm.amount > refundMaxAllowed.value)

const paymentStatus = (id: string) => {
  const booking = store.bookingFor(id)
  if (booking?.status === 'Dibatalkan') return 'Cancelled'
  const total = store.bookingTotal(id)
  const paid = store.bookingPaid(id)
  if (!total) return 'Unbilled'
  if (paid >= total) return 'Paid'
  if (paid > 0) return 'Partial'
  return 'Unpaid'
}

const resetForm = () => {
  const today = new Date().toISOString().slice(0, 10)
  Object.assign(form, {
    name: '',
    phone: '',
    location: '',
    eventDate: '',
    eventTime: '',
    stylingType: (store.stylingTypes[0] || 'Hijabdo') as StylingType,
    notes: '',
    status: 'Draft',
  })
  Object.assign(bookingOrderMeta, { issuedAt: today, dueDate: '' })
  bookingOrderGroups.value = [
    {
      id: crypto.randomUUID(),
      kind: 'Awal',
      isNew: true,
      orderDate: today,
      items: [],
    },
  ]
}
const openCreate = () => { editingId.value = ''; error.value = ''; resetForm(); showForm.value = true }
const openEdit = (booking: Booking) => {
  const today = new Date().toISOString().slice(0, 10)
  const customer = store.customerFor(booking.customerId)
  editingId.value = booking.id
  error.value = ''
  Object.assign(form, {
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    location: booking.location,
    eventDate: (booking.eventDate ?? '').slice(0, 10),
    eventTime: (booking.eventTime ?? '').slice(0, 5),
    stylingType: booking.stylingType ?? '',
    notes: booking.notes ?? '',
    status: booking.status,
  })
  const existingInv = store.bookingInvoice(booking.id)
  if (existingInv) {
    Object.assign(bookingOrderMeta, {
      issuedAt: existingInv.issuedAt,
      dueDate: existingInv.dueDate ?? '',
    })
    bookingOrderGroups.value = store.sortedOrderGroups(existingInv).map((group) => ({
      id: group.id,
      kind: group.kind,
      isNew: false,
      orderDate: group.orderDate,
      items: group.items.map((item) => {
        const inferredType: CatalogType = item.serviceType
          ?? store.catalog.find((c) => c.id === item.catalogItemId || c.name.toLowerCase() === item.name.toLowerCase())?.type
          ?? 'Additional'
        return {
          key: item.id,
          id: item.id,
          catalogItemId: item.catalogItemId ?? '',
          serviceName: item.name,
          serviceKind: inferredType,
          filterType: inferredType,
          catalogPrice: item.catalogPrice,
          unit: item.unit,
          quantity: item.quantity,
          customerPrice: item.unitPrice,
        }
      }),
    }))
  } else {
    Object.assign(bookingOrderMeta, { issuedAt: today, dueDate: '' })
    bookingOrderGroups.value = [
      {
        id: crypto.randomUUID(),
        kind: 'Awal',
        isNew: true,
        orderDate: today,
        items: [],
      },
    ]
  }
  showForm.value = true
}
const openDetail = (booking: Booking) => { selectedBooking.value = booking; showDetail.value = true }

const submit = () => {
  try {
    error.value = ''
    if (!form.name.trim() || !form.phone.trim() || !form.location.trim() || !form.eventDate) {
      error.value = 'Customer name, phone number, venue location, and event date are required.'
      return
    }
    if (!form.stylingType) {
      error.value = 'Styling type is required.'
      return
    }

    const activeGroups = bookingOrderGroups.value.filter((g) => !g.isNew || g.items.length > 0)
    for (const group of activeGroups) {
      if (!group.orderDate) {
        error.value = 'Order date is required for every order group.'
        return
      }
      if (!group.items.length) {
        error.value = 'Each existing order group must have at least one service item.'
        return
      }
      for (const line of group.items) {
        if (!line.catalogItemId && !line.id) {
          error.value = 'Please choose a service on all order lines (or remove empty lines).'
          return
        }
        if (!Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.customerPrice) || line.customerPrice < 0) {
          error.value = 'Order quantity must be greater than 0 and unit price cannot be negative.'
          return
        }
      }
    }

    const payload = { ...form, stylingType: form.stylingType as StylingType }
    let targetBookingId = editingId.value
    let isCancelled = false

    if (editingId.value) {
      const prevStatus = store.bookingFor(editingId.value)?.status
      store.updateBooking(editingId.value, payload)
      if (payload.status === 'Dibatalkan' && prevStatus !== 'Dibatalkan') {
        store.cancelBooking(editingId.value)
        isCancelled = true
      } else if (payload.status === 'Dibatalkan') {
        isCancelled = true
      }
    } else {
      const created = store.addBooking(payload)
      targetBookingId = created.id
    }

    if (!isCancelled && activeGroups.length > 0) {
      const existingInv = store.bookingInvoice(targetBookingId)
      if (!existingInv) {
        const firstGroup = activeGroups[0]!
        store.createInvoiceFromOrder({
          bookingId: targetBookingId,
          kind: 'Utama',
          issuedAt: bookingOrderMeta.issuedAt || firstGroup.orderDate,
          orderDate: firstGroup.orderDate,
          dueDate: bookingOrderMeta.dueDate || undefined,
          items: firstGroup.items.map((line) => ({
            catalogItemId: line.catalogItemId,
            quantity: line.quantity,
            customerPrice: line.customerPrice,
          })),
        })
        for (const extra of activeGroups.slice(1)) {
          store.addOrderGroupToBooking({
            bookingId: targetBookingId,
            orderDate: extra.orderDate,
            items: extra.items.map((line) => ({
              catalogItemId: line.catalogItemId,
              quantity: line.quantity,
              customerPrice: line.customerPrice,
            })),
          })
        }
      } else {
        for (const group of activeGroups) {
          if (!group.isNew) {
            store.updateOrderGroup(targetBookingId, group.id, {
              orderDate: group.orderDate,
              items: group.items.map((line) => ({
                id: line.id,
                catalogItemId: line.catalogItemId || undefined,
                serviceType: line.serviceKind,
                name: line.serviceName,
                catalogPrice: line.catalogPrice,
                unit: line.unit,
                quantity: line.quantity,
                customerPrice: line.customerPrice,
              })),
            })
          } else if (group.items.length > 0) {
            store.addOrderGroupToBooking({
              bookingId: targetBookingId,
              orderDate: group.orderDate,
              items: group.items.map((line) => ({
                catalogItemId: line.catalogItemId,
                quantity: line.quantity,
                customerPrice: line.customerPrice,
              })),
            })
          }
        }
      }
    }

    resetForm()
    showForm.value = false
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save booking & order.'
  }
}

const openCancelModal = (booking: Booking) => {
  cancelTarget.value = booking
  const paid = store.bookingPaid(booking.id)
  cancelWithRefund.value = paid > 0
  cancelError.value = ''
  Object.assign(cancelRefundForm, {
    refundDate: new Date().toISOString().slice(0, 10),
    amount: 0,
    method: store.paymentMethods[0] || 'Transfer',
    proofImageUrl: '',
    notes: `Cancellation refund for ${booking.poNumber}`,
  })
  showCancelModal.value = true
}

const handleCancelProofUpload = async (event: Event) => {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  cancelError.value = ''
  cancelUploading.value = true
  try {
    const res = await uploadImageWithFallback(file, 'payment-proof')
    cancelRefundForm.proofImageUrl = res.url
  } catch (err) {
    cancelError.value = err instanceof Error ? err.message : 'Failed to upload refund proof.'
  } finally {
    cancelUploading.value = false
    inputEl.value = ''
  }
}

const confirmCancelBooking = () => {
  try {
    cancelError.value = ''
    if (!cancelTarget.value) return
    if (cancelWithRefund.value) {
      if (!cancelRefundForm.refundDate) throw new Error('Refund date is required.')
      if (cancelRefundForm.amount <= 0) throw new Error('Refund amount must be greater than zero.')
      const paid = store.bookingPaid(cancelTarget.value.id)
      if (cancelRefundForm.amount > paid) {
        throw new Error(`Refund amount (${formatCurrency(cancelRefundForm.amount)}) exceeds total paid amount (${formatCurrency(paid)}).`)
      }
    }
    store.cancelBooking(
      cancelTarget.value.id,
      cancelWithRefund.value
        ? {
            refundDate: cancelRefundForm.refundDate,
            amount: cancelRefundForm.amount,
            method: cancelRefundForm.method,
            proofImageUrl: cancelRefundForm.proofImageUrl || undefined,
            notes: cancelRefundForm.notes,
          }
        : undefined,
    )
    showCancelModal.value = false
    cancelTarget.value = null
  } catch (err) {
    cancelError.value = err instanceof Error ? err.message : 'Failed to cancel booking.'
  }
}

const openRefundModal = (booking?: Booking) => {
  editingRefundId.value = ''
  refundError.value = ''
  const defaultBookingId = booking?.id ?? cancelledBookings.value[0]?.id ?? ''
  const target = store.bookingFor(defaultBookingId)
  Object.assign(refundForm, {
    bookingId: defaultBookingId,
    refundDate: new Date().toISOString().slice(0, 10),
    amount: 0,
    method: store.paymentMethods[0] || 'Transfer',
    proofImageUrl: '',
    notes: target ? `Refund for ${target.poNumber}` : '',
  })
  showRefundModal.value = true
}

const openEditRefundModal = (refund: BookingRefund) => {
  editingRefundId.value = refund.id
  refundError.value = ''
  Object.assign(refundForm, {
    bookingId: refund.bookingId,
    refundDate: (refund.refundDate ?? '').slice(0, 10),
    amount: refund.amount,
    method: refund.method,
    proofImageUrl: refund.proofImageUrl ?? '',
    notes: refund.notes ?? '',
  })
  showRefundModal.value = true
}

const handleRefundProofUpload = async (event: Event) => {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  refundError.value = ''
  refundUploading.value = true
  try {
    const res = await uploadImageWithFallback(file, 'payment-proof')
    refundForm.proofImageUrl = res.url
  } catch (err) {
    refundError.value = err instanceof Error ? err.message : 'Failed to upload proof image.'
  } finally {
    refundUploading.value = false
    inputEl.value = ''
  }
}

const submitRefund = () => {
  try {
    refundError.value = ''
    if (!refundForm.bookingId) throw new Error('Please select a cancelled PO first.')
    if (editingRefundId.value) {
      store.updateBookingRefund(editingRefundId.value, {
        bookingId: refundForm.bookingId,
        refundDate: refundForm.refundDate,
        amount: refundForm.amount,
        method: refundForm.method,
        proofImageUrl: refundForm.proofImageUrl || undefined,
        notes: refundForm.notes,
      })
    } else {
      store.addBookingRefund({
        bookingId: refundForm.bookingId,
        refundDate: refundForm.refundDate,
        amount: refundForm.amount,
        method: refundForm.method,
        proofImageUrl: refundForm.proofImageUrl || undefined,
        notes: refundForm.notes,
      })
    }
    editingRefundId.value = ''
    showRefundModal.value = false
    activeView.value = 'refunds'
  } catch (err) {
    refundError.value = err instanceof Error ? err.message : 'Failed to save refund.'
  }
}

const openProofZoom = (url: string) => {
  zoomedProof.value = url
  showProofModal.value = true
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div><span class="eyebrow">Workspace</span><h2>Customers &amp; Bookings</h2><p>Manage customer contacts, event PO bookings, PO cancellations, and refund payouts.</p></div>
      <div class="heading-actions">
        <button class="primary-button" @click="openCreate"><Plus :size="18" />Add Booking</button>
      </div>
    </section>

    <section class="summary-strip">
      <div><span>Active Bookings</span><strong>{{ activeBookingsCount }}</strong></div>
      <div><span>Upcoming Events</span><strong>{{ store.upcomingBookings.length }}</strong></div>
      <div><span>Confirmed / Done</span><strong>{{ confirmedDoneCount }}</strong></div>
      <div><span>Total Refunds</span><strong>{{ formatCurrency(store.totalRefunds) }}</strong></div>
    </section>

    <section class="portal-tabs-bar">
      <div class="segmented-tabs">
        <button :class="{ active: activeView === 'bookings' }" @click="activeView = 'bookings'">
          Bookings &amp; Customers ({{ store.bookings.length }})
        </button>
        <button :class="{ active: activeView === 'refunds' }" @click="activeView = 'refunds'">
          Refund History ({{ store.refunds.length }})
        </button>
      </div>
    </section>

    <section v-if="activeView === 'bookings'" class="panel table-panel">
      <div class="table-toolbar">
        <label class="table-search"><Search :size="17" /><input v-model="search" type="search" placeholder="Search name, PO number, or phone" /></label>
        <div class="filter-row">
          <SlidersHorizontal :size="17" />
          <SearchSelect v-model="status" :options="statusSelectOptions" search-placeholder="Filter status…" aria-label="Filter booking status" />
        </div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table booking-table">
          <thead>
            <tr>
              <th>
                <button type="button" class="th-sort-btn" :class="{ 'is-active': customerSortDir !== 'none' }" title="Sort customer A–Z / Z–A" @click="toggleCustomerSort">
                  <span>Customer</span>
                  <ArrowUp v-if="customerSortDir === 'asc'" :size="14" class="sort-icon" />
                  <ArrowDown v-else-if="customerSortDir === 'desc'" :size="14" class="sort-icon" />
                  <ArrowUpDown v-else :size="13" class="sort-icon is-idle" />
                </button>
              </th>
              <th>Booking</th><th>Event</th><th>Billing</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="booking in paginatedRows"
              :key="booking.id"
              :data-booking-id="booking.id"
              :class="{ 'is-highlighted-row': highlightedBookingId === booking.id }"
              @click="highlightedBookingId === booking.id && (highlightedBookingId = '')"
            >
              <td><div class="customer-cell"><div class="avatar">{{ initials(store.customerFor(booking.customerId)?.name ?? '') }}</div><div><strong>{{ store.customerFor(booking.customerId)?.name }}</strong><span><Phone :size="12" />{{ store.customerFor(booking.customerId)?.phone }}</span></div></div></td>
              <td><strong class="mono-code">{{ booking.poNumber }}</strong><span class="subtle-line">Created {{ formatDate(booking.createdAt) }}</span></td>
              <td><strong><CalendarDays :size="14" />{{ formatDate(booking.eventDate) }} · {{ booking.eventTime || '—' }}</strong><span class="subtle-line"><MapPin :size="12" />{{ booking.location }}<template v-if="booking.stylingType"> · {{ booking.stylingType }}</template></span></td>
              <td>
                <strong>{{ formatCurrency(store.bookingTotal(booking.id)) }}</strong>
                <span class="subtle-line">
                  {{ booking.status === 'Dibatalkan' ? 'Transaction cancelled' : `Balance ${formatCurrency(store.bookingBalance(booking.id))}` }}
                </span>
              </td>
              <td><div class="badge-stack"><StatusBadge :label="displayBookingStatus(booking.status)" /><StatusBadge :label="paymentStatus(booking.id)" /></div></td>
              <td>
                <div class="row-actions">
                  <button class="icon-button" title="View details" @click="openDetail(booking)"><Eye :size="17" /></button>
                  <button class="icon-button" title="Edit booking" @click="openEdit(booking)"><Pencil :size="16" /></button>
                  <button
                    v-if="booking.status !== 'Dibatalkan'"
                    class="icon-button booking-cancel-btn"
                    title="Cancel booking (clear transactions & release wardrobe)"
                    @click="openCancelModal(booking)"
                  >
                    <Ban :size="16" />
                  </button>
                  <button
                    v-else
                    class="icon-button booking-refund-btn"
                    title="Record refund payout"
                    @click="openRefundModal(booking)"
                  >
                    <RotateCcw :size="16" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!rows.length"><td colspan="6"><div class="empty-state"><Search :size="28" /><strong>No matching bookings found</strong><span>Try adjusting your search keywords or status filter.</span></div></td></tr>
          </tbody>
        </table>
      </div>
      <DataPagination
        v-model:current-page="bookingPage"
        v-model:page-size="bookingPageSize"
        :total-items="rows.length"
      />
    </section>

    <section v-else class="panel table-panel">
      <div class="table-toolbar">
        <div>
          <strong>Cancellation Refund History</strong>
          <p class="refund-subcopy">Every cancellation refund is automatically logged as an expense entry under Cancel Payment and can be edited anytime.</p>
        </div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Refund No.</th>
              <th>PO &amp; Customer</th>
              <th>Refund Date</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Proof</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="refund in paginatedRefunds" :key="refund.id">
              <td><strong class="mono-code">{{ refund.refundNumber }}</strong></td>
              <td><strong>{{ refund.customerName }}</strong><span class="subtle-line">{{ refund.poNumber }}</span></td>
              <td>{{ formatDate(refund.refundDate) }}</td>
              <td>{{ refund.method }}</td>
              <td><strong class="negative-number">−{{ formatCurrency(refund.amount) }}</strong></td>
              <td>
                <button v-if="refund.proofImageUrl" type="button" class="proof-thumb-btn" title="View transfer proof" @click="openProofZoom(refund.proofImageUrl)">
                  <img :src="refund.proofImageUrl" alt="Refund proof" />
                </button>
                <span v-else class="subtle-line">—</span>
              </td>
              <td>{{ refund.notes || '—' }}</td>
              <td>
                <div class="row-actions">
                  <button type="button" class="icon-button" title="Edit refund details" @click="openEditRefundModal(refund)">
                    <Pencil :size="15" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!store.refunds.length">
              <td colspan="8">
                <div class="empty-state">
                  <RotateCcw :size="26" />
                  <strong>No cancellation refunds yet</strong>
                  <span>When a cancelled PO is refunded, it is automatically recorded here and in Expenses.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <DataPagination
        v-model:current-page="refundPage"
        v-model:page-size="refundPageSize"
        :total-items="store.refunds.length"
      />
    </section>

    <UiModal :open="showForm" :title="editingId ? 'Edit Booking & Order' : 'Add New Booking & Order'" :description="editingId ? 'Update customer details, event schedule, and order services.' : 'PO Number and Invoice will be generated with Customer Name & Event Date.'" wide @close="showForm = false">
      <form class="form-grid" @submit.prevent="submit">
        <label class="is-required"><span>Customer Name *</span><input v-model="form.name" placeholder="e.g. Nadya Prameswari" /></label>
        <label class="is-required"><span>Phone / WhatsApp *</span><input v-model="form.phone" placeholder="08xxxxxxxxxx" /></label>
        <label class="span-2 is-required"><span>Event Venue *</span><input v-model="form.location" placeholder="Venue name or city" /></label>
        <label class="is-required"><span>Event Date *</span><input v-model="form.eventDate" type="date" /></label>
        <label class="is-optional"><span>Event Time <em class="opt-tag">Optional</em></span><input v-model="form.eventTime" type="time" /></label>
        <label class="is-required">
          <span>Styling Type *</span>
          <SearchSelect v-model="form.stylingType" :options="stylingTypeOptions" required search-placeholder="Search styling…" />
        </label>
        <label v-if="editingId" class="is-optional">
          <span>Booking Status <em class="opt-tag">Optional</em></span>
          <SearchSelect v-model="form.status" :options="bookingStatusOptions" search-placeholder="Search status…" />
        </label>
        <label class="span-2 is-optional"><span>Additional Notes <em class="opt-tag">Optional</em></span><textarea v-model="form.notes" rows="2" placeholder="Makeup concept, venue address details, or special requests" /></label>

        <div v-if="form.status !== 'Dibatalkan'" class="span-2" style="display:flex;flex-direction:column;gap:12px;">
          <div v-if="!editingHasExistingInvoice" class="form-grid" style="margin:0;">
            <label class="is-optional"><span>Invoice Issue Date</span><input v-model="bookingOrderMeta.issuedAt" type="date" /></label>
            <label class="is-optional"><span>Invoice Due Date <em class="opt-tag">Optional</em></span><input v-model="bookingOrderMeta.dueDate" type="date" /></label>
          </div>

          <div v-for="(group, gIdx) in bookingOrderGroups" :key="group.id" class="order-lines">
            <div class="order-lines-head">
              <div>
                <strong>{{ group.kind === 'Awal' ? 'Order Services (Initial)' : `Add-on Batch #${gIdx}` }}</strong>
                <span>{{ group.isNew && !editingHasExistingInvoice ? 'Optional on booking creation — add services to generate invoice in one step.' : 'Edit services, quantities, customer prices, or add items.' }}</span>
              </div>
              <div class="add-group-add-trigger" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <input v-model="group.orderDate" type="date" title="Order date" style="height:34px;padding:0 10px;border-radius:9px;" />
                <button type="button" class="soft-button" @click="addOrderLineToGroup(group, 'Inti')"><ShoppingBag :size="14" />+ Core Service</button>
                <button type="button" class="soft-button" @click="addOrderLineToGroup(group, 'Additional')"><Layers :size="14" />+ Add-on</button>
              </div>
            </div>

            <div v-if="group.items.length" class="order-lines-grid">
              <div class="order-lines-columns">
                <span>Service</span><span>Qty</span><span>Customer Price</span><span class="align-right">Subtotal</span><span></span>
              </div>
              <div v-for="(line, lIdx) in group.items" :key="line.key" class="order-line-row">
                <div class="order-line-service">
                  <div class="order-line-service-top">
                    <span class="service-kind-tag" :class="line.filterType === 'Inti' ? 'is-core' : 'is-addon'">
                      {{ line.filterType === 'Inti' ? 'Core' : 'Add-on' }}
                    </span>
                    <SearchSelect
                      v-model="line.catalogItemId"
                      :options="catalogOptionsForLine(line)"
                      placeholder="Select service…"
                      search-placeholder="Search service…"
                      @update:model-value="onOrderLineCatalogChange(line)"
                    />
                  </div>
                  <small v-if="line.catalogPrice">Catalog ref: {{ formatCurrency(line.catalogPrice) }} / {{ line.unit || 'unit' }}</small>
                </div>
                <input v-model.number="line.quantity" type="number" min="1" />
                <CurrencyInput v-model="line.customerPrice" />
                <div class="order-line-subtotal"><strong>{{ formatCurrency(line.quantity * line.customerPrice) }}</strong></div>
                <button
                  type="button"
                  class="icon-button order-line-remove"
                  :disabled="!group.isNew && group.items.length === 1"
                  title="Remove item"
                  @click="group.items.splice(lIdx, 1)"
                >
                  <Trash2 :size="15" />
                </button>
              </div>
            </div>
            <p v-else class="subtle-line" style="margin:4px 0 0;">No services added yet. Click <strong>+ Core Service</strong> or <strong>+ Add-on</strong> above.</p>
          </div>

          <div v-if="editingHasExistingInvoice" style="display:flex;justify-content:flex-start;">
            <button type="button" class="soft-button" @click="addExtraOrderBatch"><Plus :size="15" />Add New Add-on Batch</button>
          </div>

          <div class="order-grand-total">
            <span>Total Order Billing</span>
            <strong>{{ formatCurrency(bookingOrderGrandTotal) }}</strong>
          </div>
        </div>

        <p v-if="error" class="form-error span-2">{{ error }}</p>
        <div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showForm = false">Cancel</button><button class="primary-button">{{ editingId ? 'Save Changes' : 'Save Booking' }}</button></div>
      </form>
    </UiModal>

    <UiModal :open="showDetail" title="Booking Details" description="Customer, event schedule, and billing summary." wide @close="showDetail = false">
      <div v-if="selectedBooking" class="detail-grid">
        <div><span>PO Number</span><strong class="mono-code">{{ selectedBooking.poNumber }}</strong></div>
        <div><span>Status</span><StatusBadge :label="displayBookingStatus(selectedBooking.status)" /></div>
        <div><span>Customer</span><strong>{{ store.customerFor(selectedBooking.customerId)?.name }}</strong><small>{{ store.customerFor(selectedBooking.customerId)?.phone }}</small></div>
        <div><span>Event</span><strong>{{ formatDate(selectedBooking.eventDate) }} · {{ selectedBooking.eventTime || '—' }}</strong><small>{{ selectedBooking.location }}</small></div>
        <div><span>Styling Type</span><strong>{{ selectedBooking.stylingType || '—' }}</strong></div>
        <div><span>Total Billing</span><strong>{{ formatCurrency(store.bookingTotal(selectedBooking.id)) }}</strong></div>
        <div><span>Remaining Balance</span><strong>{{ formatCurrency(store.bookingBalance(selectedBooking.id)) }}</strong></div>
        <div v-if="selectedBooking.notes" class="span-2"><span>Notes</span><strong>{{ selectedBooking.notes }}</strong></div>
        <div v-if="store.bookingInvoice(selectedBooking.id)?.items.length" class="span-2">
          <span>Ordered Services</span>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
            <span v-for="item in store.bookingInvoice(selectedBooking.id)?.items" :key="item.id" class="item-pill">
              {{ item.name }} ×{{ item.quantity }} ({{ formatCurrency(item.quantity * item.unitPrice) }})
            </span>
          </div>
        </div>
      </div>
      <div class="modal-actions"><button class="secondary-button" @click="showDetail = false">Close</button><button class="primary-button" @click="showDetail = false; openEdit(selectedBooking!)"><Pencil :size="16" />Edit Booking</button></div>
    </UiModal>

    <UiModal :open="showCancelModal" title="Cancel Booking (PO)" description="Cancelling removes linked billing transactions and releases assigned wardrobe items." wide @close="showCancelModal = false">
      <form v-if="cancelTarget" class="form-grid" @submit.prevent="confirmCancelBooking">
        <div class="cancel-impact-box span-2">
          <strong>{{ cancelTarget.poNumber }} — {{ store.customerFor(cancelTarget.customerId)?.name }}</strong>
          <ul>
            <li>All <b>Orders, Invoices, and Payments</b> on this PO will be cleared from active billing.</li>
            <li>Any assigned <b>Wedding Attire</b> returns to <b>Available</b> automatically.</li>
            <li>Recording a refund below automatically logs an expense entry under <b>Cancel Payment</b> source history.</li>
          </ul>
        </div>

        <div class="paid-info-banner span-2">
          <div>
            <span>Total Paid Received (PO {{ cancelTarget.poNumber }})</span>
            <strong>{{ formatCurrency(cancelPaidAmount) }}</strong>
          </div>
          <small>{{ cancelPaidAmount > 0 ? 'Enter the exact refund amount below if money is returned.' : 'No payments have been received for this PO.' }}</small>
        </div>

        <label class="span-2 checkbox-inline-label">
          <input v-model="cancelWithRefund" type="checkbox" />
          <span>Also record a Refund Payout to the customer (automatically logged into Expenses &amp; Cashflow)</span>
        </label>

        <template v-if="cancelWithRefund">
          <label class="is-required"><span>Refund Date *</span><input v-model="cancelRefundForm.refundDate" type="date" /></label>
          <label class="is-required">
            <span>Refund Method *</span>
            <SearchSelect v-model="cancelRefundForm.method" :options="methodSelectOptions" required search-placeholder="Search method…" />
          </label>
          <label class="span-2 is-required">
            <span>Refund Amount (max. {{ formatCurrency(cancelPaidAmount) }}) *</span>
            <CurrencyInput v-model="cancelRefundForm.amount" aria-label="Refund amount" />
          </label>
          <div v-if="cancelRefundExceedsPaid" class="refund-limit-alert span-2" role="alert">
            <AlertTriangle :size="17" />
            <div>
              <strong>Warning: Refund exceeds paid amount!</strong>
              <span>You entered {{ formatCurrency(cancelRefundForm.amount) }}, while total received payments equal {{ formatCurrency(cancelPaidAmount) }}.</span>
            </div>
          </div>
          <label class="span-2 is-optional"><span>Refund Notes <em class="opt-tag">Optional</em></span><input v-model="cancelRefundForm.notes" placeholder="Reason / destination bank account" /></label>
          <div class="span-2 attire-upload-block">
            <span class="upload-field-label">Transfer / Refund Proof</span>
            <label class="upload-zone">
              <img v-if="cancelRefundForm.proofImageUrl" :src="cancelRefundForm.proofImageUrl" alt="Refund proof" />
              <div v-else><UploadCloud :size="24" /><strong>Upload JPG, PNG, or WebP transfer proof</strong><span>Max 5 MB</span></div>
              <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleCancelProofUpload" />
            </label>
            <button v-if="cancelRefundForm.proofImageUrl" type="button" class="soft-button remove-photo-btn" @click="cancelRefundForm.proofImageUrl = ''">Remove proof</button>
            <p v-if="cancelUploading" class="upload-state"><LoaderCircle class="spin" :size="15" />Processing image…</p>
          </div>
        </template>

        <p v-if="cancelError" class="form-error span-2">{{ cancelError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showCancelModal = false">Back</button>
          <button type="submit" class="danger-button" :disabled="cancelUploading">Confirm Cancel PO</button>
        </div>
      </form>
    </UiModal>

    <UiModal
      :open="showRefundModal"
      :title="editingRefundId ? 'Edit Cancellation Refund' : 'Record Cancellation Refund'"
      description="Refund payouts are automatically synced with Expenses (source: Cancel Payment) and Cashflow."
      wide
      @close="showRefundModal = false"
    >
      <form class="form-grid" @submit.prevent="submitRefund">
        <label class="span-2 is-required">
          <span>Cancelled PO Number *</span>
          <SearchSelect v-model="refundForm.bookingId" :options="cancelledPoSelectOptions" :disabled="Boolean(editingRefundId)" required search-placeholder="Search cancelled PO…" />
        </label>
        <div v-if="selectedRefundBooking" class="paid-info-banner span-2">
          <div>
            <span>Paid Received: <b>{{ formatCurrency(refundPaidAmount) }}</b> · Already Refunded: <b>{{ formatCurrency(refundAlreadyReturned) }}</b></span>
            <strong>Maximum Remaining Refund: {{ formatCurrency(refundMaxAllowed) }}</strong>
          </div>
          <small>Enter the agreed refund amount manually.</small>
        </div>
        <label class="is-required"><span>Refund Date *</span><input v-model="refundForm.refundDate" type="date" /></label>
        <label class="is-required">
          <span>Method *</span>
          <SearchSelect v-model="refundForm.method" :options="methodSelectOptions" required search-placeholder="Search method…" />
        </label>
        <label class="span-2 is-required"><span>Refund Amount *</span><CurrencyInput v-model="refundForm.amount" aria-label="Refund amount" /></label>
        <div v-if="refundExceedsPaid" class="refund-limit-alert span-2" role="alert">
          <AlertTriangle :size="17" />
          <div>
            <strong>Warning: Amount exceeds received funds!</strong>
            <span>{{ formatCurrency(refundForm.amount) }} exceeds the maximum refundable balance of {{ formatCurrency(refundMaxAllowed) }}.</span>
          </div>
        </div>
        <label class="span-2 is-optional"><span>Notes <em class="opt-tag">Optional</em></span><input v-model="refundForm.notes" placeholder="Bank account details or notes" /></label>
        <div class="span-2 attire-upload-block">
          <span class="upload-field-label">Transfer Proof</span>
          <label class="upload-zone">
            <img v-if="refundForm.proofImageUrl" :src="refundForm.proofImageUrl" alt="Refund proof" />
            <div v-else><UploadCloud :size="24" /><strong>Upload JPG, PNG, or WebP payment proof</strong><span>Max 5 MB</span></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleRefundProofUpload" />
          </label>
          <button v-if="refundForm.proofImageUrl" type="button" class="soft-button remove-photo-btn" @click="refundForm.proofImageUrl = ''">Remove proof</button>
          <p v-if="refundUploading" class="upload-state"><LoaderCircle class="spin" :size="15" />Processing image…</p>
        </div>
        <p v-if="refundError" class="form-error span-2">{{ refundError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showRefundModal = false">Cancel</button>
          <button type="submit" class="primary-button" :disabled="refundUploading">Save Refund Payout</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showProofModal" title="Refund Transfer Proof" @close="showProofModal = false">
      <div class="attire-zoom">
        <div>
          <img v-if="zoomedProof" :src="zoomedProof" alt="Refund proof" />
          <ImageIcon v-else :size="48" />
        </div>
      </div>
    </UiModal>
  </div>
</template>
