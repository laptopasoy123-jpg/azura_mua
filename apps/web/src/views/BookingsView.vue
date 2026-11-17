<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Plus, Search, SlidersHorizontal, MapPin, CalendarDays, Phone, Eye, Pencil } from '@lucide/vue'
import { useCrmStore, type Booking, type BookingStatus } from '../stores/crm'
import { formatCurrency, formatDate, initials } from '../utils/format'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'

const store = useCrmStore()
const search = ref('')
const status = ref('Semua')
const showForm = ref(false)
const showDetail = ref(false)
const editingId = ref('')
const selectedBooking = ref<Booking | null>(null)
const error = ref('')
const form = reactive({ name: '', phone: '', location: '', eventDate: '', eventTime: '', notes: '', status: 'Draft' as BookingStatus })

const rows = computed(() => store.bookings.filter((booking) => {
  const customer = store.customerFor(booking.customerId)
  const query = search.value.toLowerCase()
  const matchesSearch = !query || booking.poNumber.toLowerCase().includes(query) || customer?.name.toLowerCase().includes(query) || customer?.phone.includes(query)
  return matchesSearch && (status.value === 'Semua' || booking.status === status.value)
}))

const paymentStatus = (id: string) => {
  const total = store.bookingTotal(id)
  const paid = store.bookingPaid(id)
  if (!total) return 'Belum Ada Tagihan'
  if (paid >= total) return 'Lunas'
  if (paid > 0) return 'Dibayar Sebagian'
  return 'Belum Dibayar'
}

const resetForm = () => Object.assign(form, { name: '', phone: '', location: '', eventDate: '', eventTime: '', notes: '', status: 'Draft' })
const openCreate = () => { editingId.value = ''; error.value = ''; resetForm(); showForm.value = true }
const openEdit = (booking: Booking) => {
  const customer = store.customerFor(booking.customerId)
  editingId.value = booking.id
  error.value = ''
  Object.assign(form, { name: customer?.name ?? '', phone: customer?.phone ?? '', location: booking.location, eventDate: booking.eventDate, eventTime: booking.eventTime ?? '', notes: booking.notes ?? '', status: booking.status })
  showForm.value = true
}
const openDetail = (booking: Booking) => { selectedBooking.value = booking; showDetail.value = true }

const submit = () => {
  error.value = ''
  if (!form.name.trim() || !form.phone.trim() || !form.location.trim() || !form.eventDate) {
    error.value = 'Nama, telepon, lokasi, dan tanggal acara wajib diisi.'
    return
  }
  if (editingId.value) store.updateBooking(editingId.value, form)
  else store.addBooking(form)
  resetForm()
  showForm.value = false
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div><span class="eyebrow">Workspace</span><h2>Database Customer</h2><p>Kelola identitas customer, booking acara, tagihan, dan status pembayaran.</p></div>
      <button class="primary-button" @click="openCreate"><Plus :size="18" />Tambah Booking</button>
    </section>

    <section class="summary-strip">
      <div><span>Total customer</span><strong>{{ store.customers.length }}</strong></div>
      <div><span>Total booking</span><strong>{{ store.bookings.length }}</strong></div>
      <div><span>Acara mendatang</span><strong>{{ store.upcomingBookings.length }}</strong></div>
      <div><span>Total piutang</span><strong>{{ formatCurrency(store.totalReceivable) }}</strong></div>
    </section>

    <section class="panel table-panel">
      <div class="table-toolbar">
        <label class="table-search"><Search :size="17" /><input v-model="search" type="search" placeholder="Cari nama, nomor PO, atau telepon" /></label>
        <div class="filter-row"><SlidersHorizontal :size="17" /><select v-model="status"><option>Semua</option><option>Draft</option><option>Terkonfirmasi</option><option>Selesai</option><option>Dibatalkan</option></select></div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table booking-table">
          <thead><tr><th>Customer</th><th>Booking</th><th>Acara</th><th>Tagihan</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            <tr v-for="booking in rows" :key="booking.id">
              <td><div class="customer-cell"><div class="avatar">{{ initials(store.customerFor(booking.customerId)?.name ?? '') }}</div><div><strong>{{ store.customerFor(booking.customerId)?.name }}</strong><span><Phone :size="12" />{{ store.customerFor(booking.customerId)?.phone }}</span></div></div></td>
              <td><strong class="mono-code">{{ booking.poNumber }}</strong><span class="subtle-line">Dibuat {{ formatDate(booking.createdAt) }}</span></td>
              <td><strong><CalendarDays :size="14" />{{ formatDate(booking.eventDate) }} · {{ booking.eventTime || '—' }}</strong><span class="subtle-line"><MapPin :size="12" />{{ booking.location }}</span></td>
              <td><strong>{{ formatCurrency(store.bookingTotal(booking.id)) }}</strong><span class="subtle-line">Sisa {{ formatCurrency(store.bookingBalance(booking.id)) }}</span></td>
              <td><div class="badge-stack"><StatusBadge :label="booking.status" /><StatusBadge :label="paymentStatus(booking.id)" /></div></td>
              <td><div class="row-actions"><button class="icon-button" title="Lihat detail" @click="openDetail(booking)"><Eye :size="17" /></button><button class="icon-button" title="Edit" @click="openEdit(booking)"><Pencil :size="16" /></button></div></td>
            </tr>
            <tr v-if="!rows.length"><td colspan="6"><div class="empty-state"><Search :size="28" /><strong>Data tidak ditemukan</strong><span>Coba ubah kata kunci atau filter.</span></div></td></tr>
          </tbody>
        </table>
      </div>
      <footer class="table-footer"><span>Menampilkan {{ rows.length }} dari {{ store.bookings.length }} booking</span><div><button disabled>‹</button><button class="active" disabled>1</button><button disabled>›</button></div></footer>
    </section>

    <UiModal :open="showForm" :title="editingId ? 'Edit Booking' : 'Tambah Booking Baru'" :description="editingId ? 'Perbarui data customer dan detail acara.' : 'Nomor PO akan dibuat otomatis saat data disimpan.'" wide @close="showForm = false">
      <form class="form-grid" @submit.prevent="submit">
        <label><span>Nama customer *</span><input v-model="form.name" placeholder="Contoh: Nadya Prameswari" /></label>
        <label><span>Nomor telepon / WhatsApp *</span><input v-model="form.phone" placeholder="08xxxxxxxxxx" /></label>
        <label class="span-2"><span>Lokasi acara *</span><input v-model="form.location" placeholder="Nama venue atau kota" /></label>
        <label><span>Tanggal acara *</span><input v-model="form.eventDate" type="date" /></label>
        <label><span>Waktu acara</span><input v-model="form.eventTime" type="time" /></label>
        <label v-if="editingId"><span>Status booking</span><select v-model="form.status"><option>Draft</option><option>Terkonfirmasi</option><option>Selesai</option><option>Dibatalkan</option></select></label>
        <label class="span-2"><span>Catatan tambahan</span><textarea v-model="form.notes" rows="3" placeholder="Konsep makeup, detail alamat, atau kebutuhan khusus" /></label>
        <p v-if="error" class="form-error span-2">{{ error }}</p>
        <div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showForm = false">Batal</button><button class="primary-button">{{ editingId ? 'Simpan Perubahan' : 'Simpan Booking' }}</button></div>
      </form>
    </UiModal>

    <UiModal :open="showDetail" title="Detail Booking" description="Ringkasan customer, acara, dan pembayaran." wide @close="showDetail = false">
      <div v-if="selectedBooking" class="detail-grid">
        <div><span>Nomor PO</span><strong class="mono-code">{{ selectedBooking.poNumber }}</strong></div>
        <div><span>Status</span><StatusBadge :label="selectedBooking.status" /></div>
        <div><span>Customer</span><strong>{{ store.customerFor(selectedBooking.customerId)?.name }}</strong><small>{{ store.customerFor(selectedBooking.customerId)?.phone }}</small></div>
        <div><span>Acara</span><strong>{{ formatDate(selectedBooking.eventDate) }} · {{ selectedBooking.eventTime || '—' }}</strong><small>{{ selectedBooking.location }}</small></div>
        <div><span>Total tagihan</span><strong>{{ formatCurrency(store.bookingTotal(selectedBooking.id)) }}</strong></div>
        <div><span>Sisa pembayaran</span><strong>{{ formatCurrency(store.bookingBalance(selectedBooking.id)) }}</strong></div>
      </div>
      <div class="modal-actions"><button class="secondary-button" @click="showDetail = false">Tutup</button><button class="primary-button" @click="showDetail = false; openEdit(selectedBooking!)"><Pencil :size="16" />Edit Booking</button></div>
    </UiModal>
  </div>
</template>
