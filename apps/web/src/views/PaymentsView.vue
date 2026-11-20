<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Plus, WalletCards, CheckCircle2, ReceiptText, Search, Download, Eye, Pencil, Trash2,
} from '@lucide/vue'
import { useCrmStore, type Payment } from '../stores/crm'
import { formatCurrency, formatDate } from '../utils/format'
import type { ReceiptSharePayload } from '../utils/receiptPdf'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'
import CurrencyInput from '../components/CurrencyInput.vue'
import ReceiptStationery from '../components/ReceiptStationery.vue'
import SearchSelect from '../components/SearchSelect.vue'
import DataPagination from '../components/DataPagination.vue'

const store = useCrmStore()
const page = ref(1)
const pageSize = ref(10)
const showForm = ref(false)
const editingId = ref('')
const showDetail = ref(false)
const detailPayment = ref<Payment | null>(null)
const detailReceiptPayload = ref<ReceiptSharePayload | null>(null)
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

const paginatedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return rows.value.slice(start, start + pageSize.value)
})

watch(search, () => {
  page.value = 1
})

const methodLabel = (method: Payment['method']) => (method === 'Cash' ? 'Cash' : method === 'Tunai' ? 'Cash' : method)

const bookingSelectOptions = computed(() =>
  store.bookings
    .filter((b) => (editingId.value ? b.id === form.bookingId : store.bookingBalance(b.id) > 0))
    .map((b) => ({
      value: b.id,
      label: `${b.poNumber} — ${store.customerFor(b.customerId)?.name ?? 'Customer'}`,
      sublabel: `Balance ${formatCurrency(store.bookingBalance(b.id))}`,
    })),
)

const methodSelectOptions = computed(() =>
  store.paymentMethods.map((m) => ({ value: m, label: methodLabel(m) })),
)

const openCreate = () => {
  editingId.value = ''
  error.value = ''
  const firstPayable = store.bookings.find((b) => store.bookingBalance(b.id) > 0)
  Object.assign(form, {
    bookingId: firstPayable?.id ?? '',
    amount: 0,
    method: store.paymentMethods[0] || 'Transfer',
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
    paidAt: (payment.paidAt ?? '').slice(0, 10),
    notes: payment.notes ?? '',
  })
  showForm.value = true
}

const receiptParamsFor = (payment: Payment) => {
  const booking = store.bookingFor(payment.bookingId)
  const customer = booking ? store.customerFor(booking.customerId) : undefined
  const invoice = store.bookingInvoice(payment.bookingId)
  const allPayments = store.payments.filter((p) => p.bookingId === payment.bookingId)
  return {
    payment,
    booking,
    customer,
    invoice,
    sortedGroups: invoice ? store.sortedOrderGroups(invoice) : [],
    allPayments,
    sortItemsIntiFirst: store.sortInvoiceItemsIntiFirst,
    totalBilling: store.bookingTotal(payment.bookingId),
    totalPaid: store.bookingPaid(payment.bookingId),
    balance: store.bookingBalance(payment.bookingId),
    businessProfile: store.businessProfile,
  }
}

const openDetail = async (payment: Payment) => {
  detailPayment.value = payment
  const { toReceiptSharePayload } = await import('../utils/receiptPdf')
  detailReceiptPayload.value = toReceiptSharePayload(receiptParamsFor(payment))
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
    if (!form.bookingId) throw new Error('Please select a PO Number first.')
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
      method: store.paymentMethods[0] || 'Transfer',
      paidAt: new Date().toISOString().slice(0, 10),
      notes: '',
    })
    showForm.value = false
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save payment.'
  }
}

const downloadReceipt = async (payment: Payment) => {
  const booking = store.bookingFor(payment.bookingId)
  const customer = booking ? store.customerFor(booking.customerId) : undefined
  await store.runWithPdfLoader(
    `Receipt ${payment.receiptNumber}`,
    `${booking?.poNumber ?? 'PO'} · ${customer?.name ?? 'Customer'}`,
    async () => {
      const { downloadPaymentReceiptPdf } = await import('../utils/receiptPdf')
      downloadPaymentReceiptPdf(receiptParamsFor(payment))
    },
  )
}

const digitsPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

const hasWhatsAppPhone = (payment: Payment) => {
  const booking = store.bookingFor(payment.bookingId)
  const customer = booking ? store.customerFor(booking.customerId) : undefined
  return Boolean(digitsPhone(customer?.phone ?? ''))
}

const onSendWhatsApp = async (payment: Payment) => {
  const params = receiptParamsFor(payment)
  const { formatWhatsAppPhone, resolveReceiptShareUrl } = await import('../utils/receiptPdf')
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
      `Hello ${params.customer?.name ?? ''},`,
      `Here is your official payment receipt from ${brandTitle}:`,
      ``,
      `• Receipt No: ${payment.receiptNumber}`,
      `• PO No: ${params.booking?.poNumber ?? '-'}`,
      `• Payment Date: ${formatDate(payment.paidAt)}`,
      `• Method: ${methodLabel(payment.method)}`,
      `• Amount Received: ${formatCurrency(payment.amount)}`,
      ...(itemLines.length ? [``, `Order Breakdown:`, ...itemLines] : []),
      ``,
      `• Total Billing: ${formatCurrency(params.totalBilling)}`,
      `• Cumulative Paid: ${formatCurrency(params.totalPaid)}`,
      `• Remaining Balance: ${formatCurrency(balance)}`,
      ``,
      `Receipt & PDF Download Link (${payment.receiptNumber}):`,
      shareResult.url,
      ``,
      `Thank you for trusting ${brandTitle} with your special day.`,
    ]

    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(lines.join('\n'))}`
    if (waTab) {
      waTab.location.href = waUrl
    } else {
      window.open(waUrl, '_blank', 'noopener,noreferrer')
    }

    waHint.value = shareResult.mode === 'r2'
      ? `WhatsApp message with direct PDF link (${shareResult.url}) is ready for ${params.customer?.phone}.`
      : `WhatsApp message with digital receipt & PDF download link is ready for ${params.customer?.phone}.`
  } finally {
    sendingId.value = ''
  }
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div>
        <span class="eyebrow">Workspace</span>
        <h2>Customer Payments</h2>
        <p>Record deposits, installments, and settlements; preview exact stationery receipts, download PDFs, and share via WhatsApp.</p>
      </div>
      <button class="primary-button" @click="openCreate"><Plus :size="18" />Record Payment</button>
    </section>

    <section class="summary-strip">
      <div><span>Transactions</span><strong>{{ store.payments.length }}</strong></div>
      <div><span>Total Billed</span><strong>{{ formatCurrency(store.totalBilling) }}</strong></div>
      <div><span>Total Received</span><strong>{{ formatCurrency(store.totalPaid) }}</strong></div>
      <div><span>Open Receivables</span><strong>{{ formatCurrency(store.totalReceivable) }}</strong></div>
    </section>

    <div v-if="waHint" class="flow-note">
      <CheckCircle2 :size="18" />
      <div><strong>Receipt PDF Link Included for WhatsApp</strong><span>{{ waHint }}</span></div>
      <button type="button" class="soft-button" @click="waHint = ''">Dismiss</button>
    </div>

    <section class="panel table-panel">
      <div class="table-toolbar">
        <label class="table-search"><Search :size="17" /><input v-model="search" placeholder="Search receipt, PO, or customer" /></label>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Customer &amp; PO</th>
              <th>Payment Date</th>
              <th>Method</th>
              <th>Amount Paid</th>
              <th>PO Status</th>
              <th>Actions &amp; Receipt</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in paginatedRows" :key="payment.id">
              <td><strong class="mono-code">{{ payment.receiptNumber }}</strong><span class="subtle-line">ID {{ payment.id.slice(0, 8) }}</span></td>
              <td>
                <strong>{{ store.customerFor(store.bookingFor(payment.bookingId)?.customerId ?? '')?.name }}</strong>
                <span class="subtle-line">{{ store.bookingFor(payment.bookingId)?.poNumber }} · {{ store.customerFor(store.bookingFor(payment.bookingId)?.customerId ?? '')?.phone }}</span>
              </td>
              <td>{{ formatDate(payment.paidAt) }}</td>
              <td><span class="method-chip"><WalletCards :size="14" />{{ methodLabel(payment.method) }}</span></td>
              <td><strong>{{ formatCurrency(payment.amount) }}</strong></td>
              <td><StatusBadge :label="store.bookingBalance(payment.bookingId) <= 0 ? 'Paid' : 'Partial'" /></td>
              <td>
                <div class="row-actions payment-doc-actions">
                  <button type="button" class="icon-button" title="Preview payment receipt" @click="openDetail(payment)">
                    <Eye :size="15" />
                  </button>
                  <button type="button" class="icon-button" title="Edit payment" @click="openEdit(payment)">
                    <Pencil :size="15" />
                  </button>
                  <button type="button" class="icon-button danger-icon-button" title="Delete payment" @click="openDeleteModal(payment)">
                    <Trash2 :size="15" />
                  </button>
                  <button type="button" class="soft-button receipt-dl-btn" title="Download Receipt PDF" @click="downloadReceipt(payment)">
                    <Download :size="14" />Receipt PDF
                  </button>
                  <button
                    v-if="hasWhatsAppPhone(payment)"
                    type="button"
                    class="wa-icon-button"
                    :disabled="sendingId === payment.id"
                    :title="`Send receipt PDF link via WhatsApp to ${store.customerFor(store.bookingFor(payment.bookingId)?.customerId ?? '')?.phone}`"
                    aria-label="Send via WhatsApp"
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
                  <strong>No payment transactions yet</strong>
                  <span>Click "Record Payment" to log a client deposit or settlement.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <DataPagination v-model:current-page="page" v-model:page-size="pageSize" :total-items="rows.length" />
    </section>

    <UiModal
      :open="showForm"
      :title="editingId ? 'Edit Payment Transaction' : 'Record Payment'"
      :description="editingId ? 'Adjust amount, method, payment date, or notes if needed.' : 'Allocates the payment directly to the selected customer PO balance.'"
      wide
      @close="showForm = false"
    >
      <form class="form-grid" @submit.prevent="submit">
        <label class="span-2 is-required">
          <span>PO Number *</span>
          <SearchSelect v-model="form.bookingId" :options="bookingSelectOptions" :disabled="Boolean(editingId)" required search-placeholder="Search PO or customer…" />
        </label>
        <div v-if="selected" class="payment-preview span-2">
          <div><span>Total Billing</span><strong>{{ formatCurrency(store.bookingTotal(selected.id)) }}</strong></div>
          <div><span>Paid to Date</span><strong>{{ formatCurrency(store.bookingPaid(selected.id)) }}</strong></div>
          <div><span>Max Allowed Input</span><strong>{{ formatCurrency(maxAllowedForForm) }}</strong></div>
        </div>
        <label class="is-required"><span>Payment Date *</span><input v-model="form.paidAt" type="date" /></label>
        <label class="is-required">
          <span>Payment Method *</span>
          <SearchSelect v-model="form.method" :options="methodSelectOptions" required search-placeholder="Search method…" />
        </label>
        <label class="span-2 is-required">
          <span>Amount Paid *</span>
          <CurrencyInput v-model="form.amount" placeholder="0" aria-label="Payment amount" />
          <small v-if="selected">Remaining balance after saving: {{ formatCurrency(Math.max(0, maxAllowedForForm - form.amount)) }}</small>
        </label>
        <label class="span-2 is-optional"><span>Notes <em class="opt-tag">Optional</em></span><textarea v-model="form.notes" rows="2" placeholder="e.g. First booking deposit (DP)" /></label>
        <div class="flow-note span-2"><ReceiptText :size="18" /><div><strong>Automatic Receipt PDF &amp; Share Link</strong><span>After saving, you can preview the editorial stationery receipt, download the PDF, or send via WhatsApp.</span></div><CheckCircle2 :size="19" /></div>
        <p v-if="error" class="form-error span-2">{{ error }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showForm = false">Cancel</button>
          <button class="primary-button">{{ editingId ? 'Save Changes' : 'Save Payment' }}</button>
        </div>
      </form>
    </UiModal>

    <!-- EYE PREVIEW: 100% Aligned with Receipt PDF -->
    <UiModal
      :open="showDetail && Boolean(detailPayment && detailReceiptPayload)"
      :title="detailPayment ? `Receipt Preview — ${detailPayment.receiptNumber}` : 'Receipt Preview'"
      description="Exact design and transaction details synchronized with the downloadable Receipt PDF."
      wide
      @close="showDetail = false"
    >
      <div v-if="detailPayment && detailReceiptPayload" style="display: grid; gap: 16px;">
        <ReceiptStationery :payload="detailReceiptPayload" :logo-url="store.businessProfile.logoUrl" />
        <div class="modal-actions">
          <button type="button" class="secondary-button" @click="showDetail = false">Close</button>
          <button type="button" class="secondary-button" @click="showDetail = false; openEdit(detailPayment)">
            <Pencil :size="15" />Edit Transaction
          </button>
          <button type="button" class="primary-button" @click="downloadReceipt(detailPayment)">
            <Download :size="16" />Download Receipt PDF
          </button>
        </div>
      </div>
    </UiModal>

    <UiModal
      :open="showDeleteConfirm && Boolean(deletingPayment)"
      title="Delete Payment Transaction?"
      description="Deleting this payment will recalculate the customer balance and total cash inflow."
      @close="showDeleteConfirm = false"
    >
      <div v-if="deletingPayment" class="cancel-impact-box">
        <strong>{{ deletingPayment.receiptNumber }} — {{ store.customerFor(store.bookingFor(deletingPayment.bookingId)?.customerId ?? '')?.name }}</strong>
        <ul>
          <li>PO Number: <b>{{ store.bookingFor(deletingPayment.bookingId)?.poNumber }}</b></li>
          <li>Amount: <b>{{ formatCurrency(deletingPayment.amount) }}</b> ({{ methodLabel(deletingPayment.method) }})</li>
        </ul>
      </div>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteConfirm = false">Cancel</button>
        <button type="button" class="danger-button" @click="confirmDelete">Yes, Delete Payment</button>
      </div>
    </UiModal>
  </div>
</template>
