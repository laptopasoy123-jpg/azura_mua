<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Plus, Search, SlidersHorizontal, MapPin, CalendarDays, Phone, Eye, Pencil,
  Ban, RotateCcw, UploadCloud, LoaderCircle, Image as ImageIcon, AlertTriangle,
} from '@lucide/vue'
import { useCrmStore, type Booking, type BookingRefund, type BookingStatus, type StylingType } from '../stores/crm'
import { displayBookingStatus, formatCurrency, formatDate, initials } from '../utils/format'
import { uploadImageWithFallback } from '../utils/uploadImage'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'
import CurrencyInput from '../components/CurrencyInput.vue'

const store = useCrmStore()
const activeView = ref<'bookings' | 'refunds'>('bookings')
const search = ref('')
const status = ref('All')
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

const rows = computed(() => store.bookings.filter((booking) => {
  const customer = store.customerFor(booking.customerId)
  const query = search.value.toLowerCase()
  const matchesSearch = !query || booking.poNumber.toLowerCase().includes(query) || customer?.name.toLowerCase().includes(query) || customer?.phone.includes(query)
  return matchesSearch && (status.value === 'All' || booking.status === status.value)
}))

const cancelledBookings = computed(() => store.bookings.filter((b) => b.status === 'Dibatalkan'))

const cancelPaidAmount = computed(() => (cancelTarget.value ? store.bookingPaid(cancelTarget.value.id) : 0))
const cancelRefundExceedsPaid = computed(() => cancelWithRefund.value && cancelRefundForm.amount > cancelPaidAmount.value)

const selectedRefundBooking = computed(() => store.bookingFor(refundForm.bookingId))
const refundPaidAmount = computed(() => selectedRefundBooking.value?.cancelledPaidAmount ?? 0)
const refundAlreadyReturned = computed(() =>
  refundForm.bookingId
    ? store.refunds.filter((r) => r.bookingId === refundForm.bookingId).reduce((sum, r) => sum + r.amount, 0)
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

const resetForm = () => Object.assign(form, { name: '', phone: '', location: '', eventDate: '', eventTime: '', stylingType: '', notes: '', status: 'Draft' })
const openCreate = () => { editingId.value = ''; error.value = ''; resetForm(); showForm.value = true }
const openEdit = (booking: Booking) => {
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
  showForm.value = true
}
const openDetail = (booking: Booking) => { selectedBooking.value = booking; showDetail.value = true }

const submit = () => {
  error.value = ''
  if (!form.name.trim() || !form.phone.trim() || !form.location.trim() || !form.eventDate) {
    error.value = 'Customer name, phone number, venue location, and event date are required.'
    return
  }
  if (!form.stylingType) {
    error.value = 'Styling type is required.'
    return
  }
  const payload = { ...form, stylingType: form.stylingType as StylingType }
  if (editingId.value) {
    const prevStatus = store.bookingFor(editingId.value)?.status
    store.updateBooking(editingId.value, payload)
    if (payload.status === 'Dibatalkan' && prevStatus !== 'Dibatalkan') {
      store.cancelBooking(editingId.value)
    }
  } else {
    store.addBooking(payload)
  }
  resetForm()
  showForm.value = false
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
    store.addBookingRefund({
      bookingId: refundForm.bookingId,
      refundDate: refundForm.refundDate,
      amount: refundForm.amount,
      method: refundForm.method,
      proofImageUrl: refundForm.proofImageUrl || undefined,
      notes: refundForm.notes,
    })
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
        <button class="secondary-button" @click="openRefundModal()"><RotateCcw :size="17" />Record Refund</button>
        <button class="primary-button" @click="openCreate"><Plus :size="18" />Add Booking</button>
      </div>
    </section>

    <section class="summary-strip">
      <div><span>Total Customers</span><strong>{{ store.customers.length }}</strong></div>
      <div><span>Total Bookings</span><strong>{{ store.bookings.length }}</strong></div>
      <div><span>Upcoming Events</span><strong>{{ store.upcomingBookings.length }}</strong></div>
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
          <select v-model="status">
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Terkonfirmasi">Confirmed</option>
            <option value="Selesai">Completed</option>
            <option value="Dibatalkan">Cancelled</option>
          </select>
        </div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table booking-table">
          <thead><tr><th>Customer</th><th>Booking</th><th>Event</th><th>Billing</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="booking in rows" :key="booking.id">
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
      <footer class="table-footer"><span>Showing {{ rows.length }} of {{ store.bookings.length }} bookings</span><div><button disabled>‹</button><button class="active" disabled>1</button><button disabled>›</button></div></footer>
    </section>

    <section v-else class="panel table-panel">
      <div class="table-toolbar">
        <div>
          <strong>Cancellation Refund History</strong>
          <p class="refund-subcopy">Every cancellation refund is automatically logged as an expense entry under Cancel Payment.</p>
        </div>
        <button class="primary-button" @click="openRefundModal()"><Plus :size="17" />Record Refund</button>
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
            </tr>
          </thead>
          <tbody>
            <tr v-for="refund in store.refunds" :key="refund.id">
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
            </tr>
            <tr v-if="!store.refunds.length">
              <td colspan="7">
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
    </section>

    <UiModal :open="showForm" :title="editingId ? 'Edit Booking' : 'Add New Booking'" :description="editingId ? 'Update customer details and event schedule.' : 'A PO Number will be generated automatically upon saving.'" wide @close="showForm = false">
      <form class="form-grid" @submit.prevent="submit">
        <label><span>Customer Name *</span><input v-model="form.name" placeholder="e.g. Nadya Prameswari" /></label>
        <label><span>Phone / WhatsApp *</span><input v-model="form.phone" placeholder="08xxxxxxxxxx" /></label>
        <label class="span-2"><span>Event Venue *</span><input v-model="form.location" placeholder="Venue name or city" /></label>
        <label><span>Event Date *</span><input v-model="form.eventDate" type="date" /></label>
        <label><span>Event Time</span><input v-model="form.eventTime" type="time" /></label>
        <label>
          <span>Styling Type *</span>
          <select v-model="form.stylingType">
            <option value="">Select styling type</option>
            <option v-for="sty in store.stylingTypes" :key="sty" :value="sty">{{ sty }}</option>
            <option v-if="form.stylingType && !store.stylingTypes.includes(form.stylingType)" :value="form.stylingType">{{ form.stylingType }}</option>
          </select>
        </label>
        <label v-if="editingId">
          <span>Booking Status</span>
          <select v-model="form.status">
            <option value="Draft">Draft</option>
            <option value="Terkonfirmasi">Confirmed</option>
            <option value="Selesai">Completed</option>
            <option value="Dibatalkan">Cancelled</option>
          </select>
        </label>
        <label class="span-2"><span>Additional Notes</span><textarea v-model="form.notes" rows="3" placeholder="Makeup concept, venue address details, or special requests" /></label>
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
          <label><span>Refund Date *</span><input v-model="cancelRefundForm.refundDate" type="date" /></label>
          <label>
            <span>Refund Method *</span>
            <select v-model="cancelRefundForm.method">
              <option v-for="m in store.paymentMethods" :key="m" :value="m">{{ m }}</option>
              <option v-if="cancelRefundForm.method && !store.paymentMethods.includes(cancelRefundForm.method)" :value="cancelRefundForm.method">
                {{ cancelRefundForm.method === 'Cash' ? 'Cash' : cancelRefundForm.method }}
              </option>
            </select>
          </label>
          <label class="span-2">
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
          <label class="span-2"><span>Refund Notes</span><input v-model="cancelRefundForm.notes" placeholder="Reason / destination bank account" /></label>
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

    <UiModal :open="showRefundModal" title="Record Cancellation Refund" description="Refund payouts are automatically added to Expenses (source: Cancel Payment) and Cashflow." wide @close="showRefundModal = false">
      <form class="form-grid" @submit.prevent="submitRefund">
        <label class="span-2">
          <span>Cancelled PO Number *</span>
          <select v-model="refundForm.bookingId">
            <option value="">Select cancelled PO</option>
            <option v-for="b in cancelledBookings" :key="b.id" :value="b.id">
              {{ b.poNumber }} — {{ store.customerFor(b.customerId)?.name }}{{ b.cancelledPaidAmount ? ` (Paid ${formatCurrency(b.cancelledPaidAmount)})` : '' }}
            </option>
          </select>
        </label>
        <div v-if="selectedRefundBooking" class="paid-info-banner span-2">
          <div>
            <span>Paid Received: <b>{{ formatCurrency(refundPaidAmount) }}</b> · Already Refunded: <b>{{ formatCurrency(refundAlreadyReturned) }}</b></span>
            <strong>Maximum Remaining Refund: {{ formatCurrency(refundMaxAllowed) }}</strong>
          </div>
          <small>Enter the agreed refund amount manually.</small>
        </div>
        <label><span>Refund Date *</span><input v-model="refundForm.refundDate" type="date" /></label>
        <label>
          <span>Method *</span>
          <select v-model="refundForm.method">
            <option v-for="m in store.paymentMethods" :key="m" :value="m">{{ m }}</option>
            <option v-if="refundForm.method && !store.paymentMethods.includes(refundForm.method)" :value="refundForm.method">
              {{ refundForm.method === 'Cash' ? 'Cash' : refundForm.method }}
            </option>
          </select>
        </label>
        <label class="span-2"><span>Refund Amount *</span><CurrencyInput v-model="refundForm.amount" aria-label="Refund amount" /></label>
        <div v-if="refundExceedsPaid" class="refund-limit-alert span-2" role="alert">
          <AlertTriangle :size="17" />
          <div>
            <strong>Warning: Amount exceeds received funds!</strong>
            <span>{{ formatCurrency(refundForm.amount) }} exceeds the maximum refundable balance of {{ formatCurrency(refundMaxAllowed) }}.</span>
          </div>
        </div>
        <label class="span-2"><span>Notes</span><input v-model="refundForm.notes" placeholder="Bank account details or notes" /></label>
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
