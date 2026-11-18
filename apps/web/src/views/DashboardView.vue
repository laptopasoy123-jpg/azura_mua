<script setup lang="ts">
import { computed } from 'vue'
import { useCrmStore } from '../stores/crm'
import { formatCurrency, formatDate, initials } from '../utils/format'
import StatusBadge from '../components/StatusBadge.vue'
import {
  CalendarCheck, CircleDollarSign, WalletCards, HandCoins, ArrowUpRight,
  ArrowDownRight, CalendarDays, PackageSearch, Clock3, MoreHorizontal,
} from '@lucide/vue'

const store = useCrmStore()
const kpis = computed(() => [
  { label: 'Pemesanan aktif', value: store.upcomingBookings.length, note: `${store.bookings.filter((b) => b.status !== 'Dibatalkan').length} pesanan aktif`, icon: CalendarCheck, tone: 'sage', trend: 'up' },
  { label: 'Total tagihan', value: formatCurrency(store.totalBilling), note: `${store.invoices.length} faktur diterbitkan`, icon: CircleDollarSign, tone: 'blue', trend: 'up' },
  { label: 'Arus kas bersih', value: formatCurrency(store.netCashflow), note: store.totalRefunds > 0 ? `Masuk ${formatCurrency(store.totalPaid)} · Pengembalian ${formatCurrency(store.totalRefunds)}` : `Masuk ${formatCurrency(store.totalPaid)} · Keluar ${formatCurrency(store.totalCashOut)}`, icon: WalletCards, tone: 'violet', trend: store.netCashflow >= 0 ? 'up' : 'down' },
  { label: 'Total piutang', value: formatCurrency(store.totalReceivable), note: 'Perlu ditindaklanjuti', icon: HandCoins, tone: 'amber', trend: 'down' },
])

const cashflow = [
  { month: 'Jun', income: 44, expense: 20 }, { month: 'Jul', income: 58, expense: 27 },
  { month: 'Agu', income: 49, expense: 24 }, { month: 'Sep', income: 72, expense: 34 },
  { month: 'Okt', income: 64, expense: 29 }, { month: 'Nov', income: 86, expense: 38 },
]

const invoiceStatus = computed(() => {
  const counts = { paid: 0, partial: 0, unpaid: 0 }
  store.invoices.forEach((invoice) => {
    const total = store.invoiceTotal(invoice)
    const bookingPaid = store.bookingPaid(invoice.bookingId)
    if (bookingPaid >= store.bookingTotal(invoice.bookingId)) counts.paid += 1
    else if (bookingPaid > 0) counts.partial += 1
    else counts.unpaid += 1
  })
  return counts
})

const bookingPaymentStatus = (id: string) => {
  const total = store.bookingTotal(id)
  const paid = store.bookingPaid(id)
  if (!total) return 'Belum Ada Tagihan'
  if (paid >= total) return 'Lunas'
  if (paid > 0) return 'Dibayar Sebagian'
  return 'Belum Dibayar'
}
</script>

<template>
  <div class="page-stack">
    <section class="welcome-panel">
      <div>
        <span class="eyebrow">Minggu, 15 November 2026</span>
        <h2>Selamat sore, Aura <span>✦</span></h2>
        <p>Semua aktivitas bisnis kamu ada di sini. Ada {{ store.upcomingBookings.length }} acara mendatang dan {{ store.lowStock.length }} stok perlu perhatian.</p>
      </div>
      <div class="welcome-ornament" aria-hidden="true"><i /><i /><i /></div>
    </section>

    <section class="kpi-grid">
      <article v-for="item in kpis" :key="item.label" class="kpi-card">
        <div class="kpi-top"><span class="kpi-icon" :class="`tone-${item.tone}`"><component :is="item.icon" :size="21" /></span><MoreHorizontal :size="19" /></div>
        <p>{{ item.label }}</p>
        <strong>{{ item.value }}</strong>
        <small :class="`trend-${item.trend}`"><component :is="item.trend === 'up' ? ArrowUpRight : ArrowDownRight" :size="14" />{{ item.note }}</small>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel chart-panel">
        <header class="panel-header">
          <div><span class="eyebrow">Keuangan</span><h3>Arus kas bulanan</h3><p>Masuk {{ formatCurrency(store.totalPaid) }} · Pengeluaran {{ formatCurrency(store.totalExpenses) }} · Pengembalian {{ formatCurrency(store.totalRefunds) }}</p></div>
          <span class="soft-button">6 bulan terakhir</span>
        </header>
        <div class="chart-legend"><span><i class="legend-income" />Pembayaran</span><span><i class="legend-expense" />Pengeluaran</span></div>
        <div class="bar-chart" aria-label="Grafik arus kas enam bulan">
          <div v-for="row in cashflow" :key="row.month" class="bar-group">
            <div class="bars"><i class="income-bar" :style="{ height: `${row.income}%` }" /><i class="expense-bar" :style="{ height: `${row.expense}%` }" /></div>
            <span>{{ row.month }}</span>
          </div>
        </div>
      </article>

      <article class="panel invoice-summary">
        <header class="panel-header"><div><span class="eyebrow">Faktur</span><h3>Status pembayaran</h3><p>{{ store.invoices.length }} faktur aktif</p></div></header>
        <div class="donut-wrap">
          <div class="donut" :style="{ '--paid': `${invoiceStatus.paid * 120}deg`, '--partial': `${(invoiceStatus.paid + invoiceStatus.partial) * 120}deg` }"><div><strong>{{ store.invoices.length }}</strong><span>Total</span></div></div>
        </div>
        <div class="invoice-legend">
          <div><i class="paid" /><span>Lunas</span><strong>{{ invoiceStatus.paid }}</strong></div>
          <div><i class="partial" /><span>Sebagian</span><strong>{{ invoiceStatus.partial }}</strong></div>
          <div><i class="unpaid" /><span>Belum dibayar</span><strong>{{ invoiceStatus.unpaid }}</strong></div>
        </div>
      </article>
    </section>

    <section class="dashboard-grid lower-grid">
      <article class="panel upcoming-panel">
        <header class="panel-header"><div><span class="eyebrow">Agenda</span><h3>Acara terdekat</h3></div><RouterLink to="/customers" class="text-link">Lihat semua</RouterLink></header>
        <div class="event-list">
          <div v-for="booking in store.upcomingBookings.slice(0, 4)" :key="booking.id" class="event-row">
            <div class="date-tile"><strong>{{ new Date(`${booking.eventDate}T00:00:00`).getDate() }}</strong><span>{{ formatDate(booking.eventDate, { month: 'short' }) }}</span></div>
            <div class="avatar soft-avatar">{{ initials(store.customerFor(booking.customerId)?.name ?? '') }}</div>
            <div class="event-copy"><strong>{{ store.customerFor(booking.customerId)?.name }}</strong><span>{{ booking.location }}</span></div>
            <div class="event-time"><Clock3 :size="14" />{{ booking.eventTime ?? '—' }}</div>
            <StatusBadge :label="bookingPaymentStatus(booking.id)" />
          </div>
        </div>
      </article>

      <article class="panel alert-panel">
        <header class="panel-header"><div><span class="eyebrow">Inventaris</span><h3>Perlu perhatian</h3></div><RouterLink to="/inventory" class="text-link">Buka inventaris</RouterLink></header>
        <div class="stock-list">
          <div v-for="item in store.lowStock" :key="item.id" class="stock-alert-row">
            <span class="stock-icon"><PackageSearch :size="19" /></span>
            <div><strong>{{ item.name }}</strong><span>{{ item.category }} · {{ item.location }}</span></div>
            <div class="stock-count"><strong>{{ store.stockAvailable(item) }}</strong><span>{{ item.unit }}</span></div>
            <StatusBadge :label="store.stockStatus(item)" />
          </div>
        </div>
      </article>
    </section>

    <section class="panel activity-panel">
      <header class="panel-header"><div><span class="eyebrow">Aktivitas</span><h3>Transaksi terbaru</h3></div><CalendarDays :size="20" /></header>
      <div class="activity-grid">
        <div v-for="activity in store.activities.slice(0, 4)" :key="activity.id" class="activity-item">
          <i :class="`activity-${activity.tone}`" />
          <div><strong>{{ activity.title }}</strong><span>{{ activity.detail }}</span></div>
          <time>{{ new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(activity.at)) }}</time>
        </div>
      </div>
    </section>
  </div>
</template>
