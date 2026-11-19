<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrmStore } from '../stores/crm'
import { displayBookingStatus, displayStockStatus, formatCurrency, formatDate, initials } from '../utils/format'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'
import {
  CalendarCheck, CircleDollarSign, WalletCards, HandCoins, ArrowUpRight,
  ArrowDownRight, CalendarDays, PackageSearch, Clock3, Download, RotateCcw,
} from '@lucide/vue'

const store = useCrmStore()
const router = useRouter()

// Interactive Cashflow date-range filter
const cashflowFrom = ref('')
const cashflowTo = ref('')
const exportingCashflow = ref(false)
const activeMonthFilter = ref('')

// Interactive Drill-down modal state
type DrillMode = 'bookings' | 'billing' | 'cashflow' | 'receivables' | 'invoices-paid' | 'invoices-partial' | 'invoices-unpaid' | 'stock'
const drillOpen = ref(false)
const drillMode = ref<DrillMode>('bookings')

const inRange = (date: string, from = cashflowFrom.value, to = cashflowTo.value) => {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

const greetingText = computed(() => {
  const hr = new Date().getHours()
  if (hr < 12) return 'Good morning'
  if (hr < 17) return 'Good afternoon'
  return 'Good evening'
})

const todayBannerDate = computed(() =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date()),
)

const kpis = computed(() => [
  { key: 'bookings' as const, label: 'Active Bookings', value: store.upcomingBookings.length, note: `${store.bookings.filter((b) => b.status !== 'Dibatalkan').length} active PO orders`, icon: CalendarCheck, tone: 'sage', trend: 'up' },
  { key: 'billing' as const, label: 'Total Billed', value: formatCurrency(store.totalBilling), note: `${store.invoices.length} issued invoices`, icon: CircleDollarSign, tone: 'blue', trend: 'up' },
  { key: 'cashflow' as const, label: 'Net Cashflow', value: formatCurrency(store.netCashflow), note: store.totalRefunds > 0 ? `In ${formatCurrency(store.totalPaid)} · Refunds ${formatCurrency(store.totalRefunds)}` : `In ${formatCurrency(store.totalPaid)} · Out ${formatCurrency(store.totalCashOut)}`, icon: WalletCards, tone: 'violet', trend: store.netCashflow >= 0 ? 'up' : 'down' },
  { key: 'receivables' as const, label: 'Accounts Receivable', value: formatCurrency(store.totalReceivable), note: 'Awaiting collection', icon: HandCoins, tone: 'amber', trend: 'down' },
])

// Live filtered cashflow totals for the selected range
const filteredCashPayments = computed(() => store.payments.filter((p) => inRange(p.paidAt)))
const filteredCashExpenses = computed(() => store.expenses.filter((e) => inRange(e.date)))
const filteredCashUnlinkedRefunds = computed(() => {
  const linked = new Set(store.expenses.map((e) => e.refundId).filter(Boolean))
  return store.refunds.filter((r) => !linked.has(r.id) && inRange(r.refundDate))
})

const filteredCashIn = computed(() => filteredCashPayments.value.reduce((s, p) => s + p.amount, 0))
const filteredCashOut = computed(() =>
  filteredCashExpenses.value.reduce((s, e) => s + e.amount, 0)
  + filteredCashUnlinkedRefunds.value.reduce((s, r) => s + r.amount, 0),
)
const filteredNetCash = computed(() => filteredCashIn.value - filteredCashOut.value)

// Dynamic monthly bar chart built from real filtered payments & expenses
const monthlyBars = computed(() => {
  const map = new Map<string, { monthKey: string; label: string; income: number; expense: number }>()
  const addPoint = (dateStr: string, kind: 'in' | 'out', amount: number) => {
    if (!dateStr || dateStr.length < 7) return
    const monthKey = dateStr.slice(0, 7)
    const entry = map.get(monthKey) ?? {
      monthKey,
      label: new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(new Date(`${monthKey}-01T00:00:00`)),
      income: 0,
      expense: 0,
    }
    if (kind === 'in') entry.income += amount
    else entry.expense += amount
    map.set(monthKey, entry)
  }

  filteredCashPayments.value.forEach((p) => addPoint(p.paidAt, 'in', p.amount))
  filteredCashExpenses.value.forEach((e) => addPoint(e.date, 'out', e.amount))
  filteredCashUnlinkedRefunds.value.forEach((r) => addPoint(r.refundDate, 'out', r.amount))

  const sorted = [...map.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey)).slice(-6)
  const peak = Math.max(1, ...sorted.flatMap((m) => [m.income, m.expense]))
  return sorted.map((m) => ({
    ...m,
    incomePct: m.income > 0 ? Math.max(8, Math.round((m.income / peak) * 100)) : 2,
    expensePct: m.expense > 0 ? Math.max(8, Math.round((m.expense / peak) * 100)) : 2,
  }))
})

const invoiceBuckets = computed(() => {
  const paid: typeof store.invoices = []
  const partial: typeof store.invoices = []
  const unpaid: typeof store.invoices = []
  store.invoices.forEach((invoice) => {
    const bookingPaid = store.bookingPaid(invoice.bookingId)
    const total = store.bookingTotal(invoice.bookingId)
    if (total > 0 && bookingPaid >= total) paid.push(invoice)
    else if (bookingPaid > 0) partial.push(invoice)
    else unpaid.push(invoice)
  })
  return { paid, partial, unpaid }
})

const bookingPaymentStatus = (id: string) => {
  const total = store.bookingTotal(id)
  const paid = store.bookingPaid(id)
  if (!total) return 'Unbilled'
  if (paid >= total) return 'Paid'
  if (paid > 0) return 'Partial'
  return 'Unpaid'
}

const openDrill = (mode: DrillMode, monthKey = '') => {
  activeMonthFilter.value = monthKey
  drillMode.value = mode
  drillOpen.value = true
}

const drillMeta = computed(() => ({
  bookings: { title: 'Active Bookings & Upcoming POs', desc: 'Click Go to Bookings to edit schedule or record refunds.', route: '/customers', cta: 'Open Customers' },
  billing: { title: 'Issued Client Invoices', desc: 'All active PO invoices and billing totals.', route: '/invoices', cta: 'Open Invoices' },
  cashflow: {
    title: activeMonthFilter.value
      ? `Cashflow Ledger (${activeMonthFilter.value})`
      : (cashflowFrom.value || cashflowTo.value ? `Cashflow (${cashflowFrom.value || 'Start'} – ${cashflowTo.value || 'Latest'})` : 'All Cashflow Transactions'),
    desc: 'Live inflows (payments received) and outflows (PO/studio expenses & cancel payouts).',
    route: '/payments',
    cta: 'Open Payments',
  },
  receivables: { title: 'Open Accounts Receivable', desc: 'POs with unpaid balances remaining.', route: '/payments', cta: 'Record Payment' },
  'invoices-paid': { title: 'Paid in Full Invoices', desc: 'Completed client billing statements.', route: '/invoices', cta: 'Open Invoices' },
  'invoices-partial': { title: 'Partially Paid Invoices', desc: 'POs with deposits recorded and remaining balance due.', route: '/payments', cta: 'Open Payments' },
  'invoices-unpaid': { title: 'Unpaid Invoices', desc: 'Issued invoices awaiting first payment.', route: '/payments', cta: 'Open Payments' },
  stock: { title: 'Inventory Attention List', desc: 'Low Stock and Out of Stock supplies requiring restock.', route: '/inventory', cta: 'Open Inventory' },
})[drillMode.value])

const cashflowDrillRows = computed(() => {
  const inRows = filteredCashPayments.value
    .filter((p) => !activeMonthFilter.value || p.paidAt.startsWith(activeMonthFilter.value))
    .map((p) => ({
      id: `in-${p.id}`,
      date: p.paidAt,
      kind: 'Inflow' as const,
      ref: p.receiptNumber,
      label: `${store.customerFor(store.bookingFor(p.bookingId)?.customerId ?? '')?.name ?? 'Client'} (${store.bookingFor(p.bookingId)?.poNumber ?? '-'})`,
      amount: p.amount,
    }))
  const outRows = filteredCashExpenses.value
    .filter((e) => !activeMonthFilter.value || e.date.startsWith(activeMonthFilter.value))
    .map((e) => ({
      id: `out-${e.id}`,
      date: e.date,
      kind: 'Outflow' as const,
      ref: e.source === 'Bayar Cancel' ? 'Cancel Payment' : e.category,
      label: e.description,
      amount: e.amount,
    }))
  return [...inRows, ...outRows].sort((a, b) => b.date.localeCompare(a.date))
})

const exportCashflowRangePdf = async () => {
  exportingCashflow.value = true
  try {
    const periodLabel = cashflowFrom.value || cashflowTo.value
      ? `${cashflowFrom.value || 'Start'} to ${cashflowTo.value || 'Present'}`
      : 'All Recorded Dates'
    await store.runWithPdfLoader('Monthly Cashflow Report', periodLabel, async () => {
      const { downloadSelectedReportsPdf } = await import('../utils/reportPdf')
      await downloadSelectedReportsPdf({
        selectedKeys: ['cashflow', 'payments', 'expenses'],
        fromDate: cashflowFrom.value,
        toDate: cashflowTo.value,
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
    })
  } finally {
    exportingCashflow.value = false
  }
}
</script>

<template>
  <div class="page-stack">
    <section class="welcome-panel">
      <div>
        <span class="eyebrow">{{ todayBannerDate }}</span>
        <h2>{{ greetingText }}, Aura <span>✦</span></h2>
        <p>Interactive studio overview — click any KPI card, invoice breakdown, or cashflow period to inspect live data or export filtered PDFs.</p>
      </div>
      <div class="welcome-ornament" aria-hidden="true"><i /><i /><i /></div>
    </section>

    <section class="kpi-grid">
      <article
        v-for="item in kpis"
        :key="item.label"
        class="kpi-card kpi-card--interactive"
        role="button"
        tabindex="0"
        @click="openDrill(item.key)"
        @keydown.enter="openDrill(item.key)"
      >
        <div class="kpi-top">
          <span class="kpi-icon" :class="`tone-${item.tone}`"><component :is="item.icon" :size="21" /></span>
          <span class="kpi-card-link-hint">Inspect →</span>
        </div>
        <p>{{ item.label }}</p>
        <strong>{{ item.value }}</strong>
        <small :class="`trend-${item.trend}`"><component :is="item.trend === 'up' ? ArrowUpRight : ArrowDownRight" :size="14" />{{ item.note }}</small>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel chart-panel">
        <header class="panel-header">
          <div>
            <span class="eyebrow">Finance · Interactive Range</span>
            <h3>Monthly Cashflow</h3>
            <p>Filter a date range to inspect live numbers right here, or export only that filtered window as PDF.</p>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="soft-button" @click="openDrill('cashflow')">
              Inspect Ledger ({{ cashflowDrillRows.length }})
            </button>
            <button type="button" class="primary-button" :disabled="exportingCashflow" @click="exportCashflowRangePdf">
              <Download :size="15" />{{ exportingCashflow ? 'Exporting…' : 'Download Cashflow PDF' }}
            </button>
          </div>
        </header>

        <div class="cashflow-filter-strip">
          <label><span>From Date</span><input v-model="cashflowFrom" type="date" aria-label="Cashflow from date" /></label>
          <label><span>To Date</span><input v-model="cashflowTo" type="date" aria-label="Cashflow to date" /></label>
          <button v-if="cashflowFrom || cashflowTo" type="button" class="soft-button" @click="cashflowFrom = ''; cashflowTo = ''">
            <RotateCcw :size="13" />Reset
          </button>
        </div>

        <div class="cashflow-live-kpis">
          <div class="interactive-row" @click="openDrill('cashflow')">
            <span>Filtered Inflow</span>
            <strong class="positive-number">{{ formatCurrency(filteredCashIn) }}</strong>
          </div>
          <div class="interactive-row" @click="openDrill('cashflow')">
            <span>Filtered Outflow</span>
            <strong class="negative-number">{{ formatCurrency(filteredCashOut) }}</strong>
          </div>
          <div class="interactive-row" @click="openDrill('cashflow')">
            <span>Filtered Net Cashflow</span>
            <strong>{{ formatCurrency(filteredNetCash) }}</strong>
          </div>
        </div>

        <div class="chart-legend"><span><i class="legend-income" />Payments (Click bar to inspect month)</span><span><i class="legend-expense" />Expenses &amp; Refunds</span></div>
        <div class="bar-chart" aria-label="Cashflow bar chart">
          <div
            v-for="row in monthlyBars"
            :key="row.monthKey"
            class="bar-group interactive-row"
            :title="`${row.label}: In ${formatCurrency(row.income)} · Out ${formatCurrency(row.expense)}`"
            @click="openDrill('cashflow', row.monthKey)"
          >
            <div class="bars">
              <i class="income-bar" :style="{ height: `${row.incomePct}%` }" />
              <i class="expense-bar" :style="{ height: `${row.expensePct}%` }" />
            </div>
            <span>{{ row.label }}</span>
          </div>
          <div v-if="!monthlyBars.length" class="empty-state" style="width: 100%;">
            <strong>No cashflow entries in this date range</strong>
            <span>Try clearing or widening From Date / To Date.</span>
          </div>
        </div>
      </article>

      <article class="panel invoice-summary">
        <header class="panel-header"><div><span class="eyebrow">Invoices</span><h3>Payment Status</h3><p>Click any status below to view matching POs in the database.</p></div></header>
        <div class="donut-wrap">
          <div
            class="donut interactive-row"
            role="button"
            tabindex="0"
            :style="{
              '--paid': `${(invoiceBuckets.paid.length / Math.max(1, store.invoices.length)) * 360}deg`,
              '--partial': `${((invoiceBuckets.paid.length + invoiceBuckets.partial.length) / Math.max(1, store.invoices.length)) * 360}deg`,
            }"
            @click="openDrill('billing')"
            @keydown.enter="openDrill('billing')"
          >
            <div><strong>{{ store.invoices.length }} PO</strong><span>Total</span></div>
          </div>
        </div>
        <div class="invoice-legend" style="display: grid; gap: 6px;">
          <button type="button" class="invoice-legend-btn" @click="openDrill('invoices-paid')">
            <i class="paid" /><span>Paid</span><strong>{{ invoiceBuckets.paid.length }} PO</strong>
          </button>
          <button type="button" class="invoice-legend-btn" @click="openDrill('invoices-partial')">
            <i class="partial" /><span>Partial</span><strong>{{ invoiceBuckets.partial.length }} PO</strong>
          </button>
          <button type="button" class="invoice-legend-btn" @click="openDrill('invoices-unpaid')">
            <i class="unpaid" /><span>Unpaid</span><strong>{{ invoiceBuckets.unpaid.length }} PO</strong>
          </button>
        </div>
      </article>
    </section>

    <section class="dashboard-grid lower-grid">
      <article class="panel upcoming-panel">
        <header class="panel-header"><div><span class="eyebrow">Schedule</span><h3>Upcoming Events</h3></div><RouterLink to="/customers" class="text-link">View all</RouterLink></header>
        <div class="event-list">
          <div
            v-for="booking in store.upcomingBookings.slice(0, 4)"
            :key="booking.id"
            class="event-row interactive-row"
            @click="router.push('/customers')"
          >
            <div class="date-tile"><strong>{{ new Date(`${booking.eventDate}T00:00:00`).getDate() }}</strong><span>{{ formatDate(booking.eventDate, { month: 'short' }) }}</span></div>
            <div class="avatar soft-avatar">{{ initials(store.customerFor(booking.customerId)?.name ?? '') }}</div>
            <div class="event-copy"><strong>{{ store.customerFor(booking.customerId)?.name }}</strong><span>{{ booking.location }} · {{ booking.poNumber }}</span></div>
            <div class="event-time"><Clock3 :size="14" />{{ booking.eventTime ?? '—' }}</div>
            <StatusBadge :label="bookingPaymentStatus(booking.id)" />
          </div>
        </div>
      </article>

      <article class="panel alert-panel">
        <header class="panel-header"><div><span class="eyebrow">Inventory</span><h3>Low Stock Alerts</h3></div><RouterLink to="/inventory" class="text-link">Open inventory</RouterLink></header>
        <div class="stock-list">
          <div
            v-for="item in store.lowStock"
            :key="item.id"
            class="stock-alert-row interactive-row"
            @click="openDrill('stock')"
          >
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="item-thumb-img" />
            <span v-else class="stock-icon"><PackageSearch :size="19" /></span>
            <div><strong>{{ item.name }}</strong><span>{{ item.category }}</span></div>
            <div class="stock-count"><strong>{{ store.stockAvailable(item) }} {{ item.unit }}</strong></div>
            <StatusBadge :label="displayStockStatus(store.stockStatus(item))" />
          </div>
          <div v-if="!store.lowStock.length" class="empty-state" style="min-height: 110px;">
            <strong>All inventory items are well stocked</strong>
          </div>
        </div>
      </article>
    </section>

    <section class="panel activity-panel">
      <header class="panel-header"><div><span class="eyebrow">Activity</span><h3>Recent Transactions</h3></div><CalendarDays :size="20" /></header>
      <div class="activity-grid">
        <div v-for="activity in store.activities.slice(0, 4)" :key="activity.id" class="activity-item">
          <i :class="`activity-${activity.tone}`" />
          <div><strong>{{ activity.title }}</strong><span>{{ activity.detail }}</span></div>
          <time>{{ new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(activity.at)) }}</time>
        </div>
      </div>
    </section>

    <!-- Interactive Drill-Down Modal -->
    <UiModal :open="drillOpen" :title="drillMeta.title" :description="drillMeta.desc" wide @close="drillOpen = false">
      <div class="data-table-wrap" style="max-height: 360px; overflow-y: auto;">
        <table v-if="drillMode === 'bookings'" class="data-table">
          <thead><tr><th>PO No.</th><th>Customer</th><th>Event Date</th><th>Venue</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="b in store.upcomingBookings" :key="b.id">
              <td class="mono-code"><strong>{{ b.poNumber }}</strong></td>
              <td>{{ store.customerFor(b.customerId)?.name }}</td>
              <td>{{ formatDate(b.eventDate) }}</td>
              <td>{{ b.location }}</td>
              <td><StatusBadge :label="displayBookingStatus(b.status)" /></td>
            </tr>
          </tbody>
        </table>

        <table v-else-if="drillMode === 'billing' || drillMode === 'invoices-paid' || drillMode === 'invoices-partial' || drillMode === 'invoices-unpaid'" class="data-table">
          <thead><tr><th>Invoice</th><th>PO &amp; Customer</th><th>Issued</th><th>Billed</th><th>Balance</th><th>Status</th></tr></thead>
          <tbody>
            <tr
              v-for="inv in (drillMode === 'invoices-paid' ? invoiceBuckets.paid : drillMode === 'invoices-partial' ? invoiceBuckets.partial : drillMode === 'invoices-unpaid' ? invoiceBuckets.unpaid : store.invoices)"
              :key="inv.id"
            >
              <td class="mono-code"><strong>{{ inv.invoiceNumber }}</strong></td>
              <td>{{ store.customerFor(store.bookingFor(inv.bookingId)?.customerId ?? '')?.name }} ({{ store.bookingFor(inv.bookingId)?.poNumber }})</td>
              <td>{{ formatDate(inv.issuedAt) }}</td>
              <td><strong>{{ formatCurrency(store.bookingTotal(inv.bookingId)) }}</strong></td>
              <td>{{ formatCurrency(Math.max(0, store.bookingBalance(inv.bookingId))) }}</td>
              <td><StatusBadge :label="bookingPaymentStatus(inv.bookingId)" /></td>
            </tr>
          </tbody>
        </table>

        <table v-else-if="drillMode === 'receivables'" class="data-table">
          <thead><tr><th>PO No.</th><th>Customer</th><th>Event Date</th><th>Total</th><th>Paid</th><th>Balance Due</th></tr></thead>
          <tbody>
            <tr v-for="b in store.bookings.filter((x) => store.bookingBalance(x.id) > 0)" :key="b.id">
              <td class="mono-code"><strong>{{ b.poNumber }}</strong></td>
              <td>{{ store.customerFor(b.customerId)?.name }}</td>
              <td>{{ formatDate(b.eventDate) }}</td>
              <td>{{ formatCurrency(store.bookingTotal(b.id)) }}</td>
              <td>{{ formatCurrency(store.bookingPaid(b.id)) }}</td>
              <td><strong class="negative-number">{{ formatCurrency(store.bookingBalance(b.id)) }}</strong></td>
            </tr>
          </tbody>
        </table>

        <table v-else-if="drillMode === 'cashflow'" class="data-table">
          <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>Amount</th></tr></thead>
          <tbody>
            <tr v-for="row in cashflowDrillRows" :key="row.id">
              <td>{{ formatDate(row.date) }}</td>
              <td><StatusBadge :label="row.kind === 'Inflow' ? 'Paid' : 'Unpaid'" /></td>
              <td class="mono-code">{{ row.ref }}</td>
              <td>{{ row.label }}</td>
              <td><strong :class="row.kind === 'Inflow' ? 'positive-number' : 'negative-number'">{{ row.kind === 'Inflow' ? '+' : '−' }}{{ formatCurrency(row.amount) }}</strong></td>
            </tr>
          </tbody>
        </table>

        <table v-else class="data-table">
          <thead><tr><th>Code</th><th>Item Name</th><th>Category</th><th>Available</th><th>Min</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="item in store.lowStock" :key="item.id">
              <td class="mono-code">{{ item.code }}</td>
              <td><strong>{{ item.name }}</strong></td>
              <td>{{ item.category }}</td>
              <td><strong>{{ store.stockAvailable(item) }} {{ item.unit }}</strong></td>
              <td>{{ item.minimumStock }} {{ item.unit }}</td>
              <td><StatusBadge :label="displayStockStatus(store.stockStatus(item))" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="modal-actions" style="margin-top: 14px;">
        <button type="button" class="secondary-button" @click="drillOpen = false">Close</button>
        <button type="button" class="primary-button" @click="drillOpen = false; router.push(drillMeta.route)">
          {{ drillMeta.cta }}
        </button>
      </div>
    </UiModal>
  </div>
</template>
