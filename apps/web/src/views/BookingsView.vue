<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Plus, Search, SlidersHorizontal, MapPin, CalendarDays, Phone, Eye, Pencil,
  Ban, RotateCcw, UploadCloud, LoaderCircle, Image as ImageIcon, AlertTriangle,
} from '@lucide/vue'
import { useCrmStore, type Booking, type BookingRefund, type BookingStatus, type StylingType } from '../stores/crm'
import { formatCurrency, formatDate, initials } from '../utils/format'
import { uploadImageWithFallback } from '../utils/uploadImage'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'
import CurrencyInput from '../components/CurrencyInput.vue'

const store = useCrmStore()
const activeView = ref<'bookings' | 'refunds'>('bookings')
const search = ref('')
const status = ref('Semua')
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

// Standalone Refund modal (from Pengembalian Uang menu or row button)
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
  return matchesSearch && (status.value === 'Semua' || booking.status === status.value)
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
  if (booking?.status === 'Dibatalkan') return 'Dibatalkan'
  const total = store.bookingTotal(id)
  const paid = store.bookingPaid(id)
  if (!total) return 'Belum Ada Tagihan'
  if (paid >= total) return 'Lunas'
  if (paid > 0) return 'Dibayar Sebagian'
  return 'Belum Dibayar'
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
    eventDate: booking.eventDate,
    eventTime: booking.eventTime ?? '',
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
    error.value = 'Nama, telepon, lokasi, dan tanggal acara wajib diisi.'
    return
  }
  if (!form.stylingType) {
    error.value = 'Jenis penataan (Hijabdo / Hairdo) wajib dipilih.'
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
    method: 'Transfer',
    proofImageUrl: '',
    notes: `Pengembalian dana pembatalan ${booking.poNumber}`,
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
    cancelError.value = err instanceof Error ? err.message : 'Gagal mengunggah bukti pengembalian.'
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
      if (!cancelRefundForm.refundDate) throw new Error('Tanggal pengembalian uang wajib diisi.')
      if (cancelRefundForm.amount <= 0) throw new Error('Nominal pengembalian uang harus diisi secara manual dan lebih dari nol.')
      const paid = store.bookingPaid(cancelTarget.value.id)
      if (cancelRefundForm.amount > paid) {
        throw new Error(`Nominal pengembalian (${formatCurrency(cancelRefundForm.amount)}) melebihi total uang yang sudah masuk (${formatCurrency(paid)}).`)
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
    cancelError.value = err instanceof Error ? err.message : 'Gagal membatalkan booking.'
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
    method: 'Transfer',
    proofImageUrl: '',
    notes: target ? `Pengembalian dana ${target.poNumber}` : '',
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
    refundError.value = err instanceof Error ? err.message : 'Gagal mengunggah bukti pembayaran.'
  } finally {
    refundUploading.value = false
    inputEl.value = ''
  }
}

const submitRefund = () => {
  try {
    refundError.value = ''
    if (!refundForm.bookingId) throw new Error('Pilih Nomor PO yang dibatalkan terlebih dahulu.')
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
    refundError.value = err instanceof Error ? err.message : 'Gagal menyimpan pengembalian uang.'
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
      <div><span class="eyebrow">Ruang Kerja</span><h2>Data Pelanggan</h2><p>Kelola identitas pelanggan, pemesanan acara, pembatalan PO, dan pengembalian dana.</p></div>
      <div class="heading-actions">
        <button class="secondary-button" @click="openRefundModal()"><RotateCcw :size="17" />Pengembalian Dana</button>
        <button class="primary-button" @click="openCreate"><Plus :size="18" />Tambah Pemesanan</button>
      </div>
    </section>

    <section class="summary-strip">
      <div><span>Total pelanggan</span><strong>{{ store.customers.length }}</strong></div>
      <div><span>Total pemesanan</span><strong>{{ store.bookings.length }}</strong></div>
      <div><span>Acara mendatang</span><strong>{{ store.upcomingBookings.length }}</strong></div>
      <div><span>Total pengembalian dana</span><strong>{{ formatCurrency(store.totalRefunds) }}</strong></div>
    </section>

    <section class="portal-tabs-bar">
      <div class="segmented-tabs">
        <button :class="{ active: activeView === 'bookings' }" @click="activeView = 'bookings'">
          Daftar Pemesanan &amp; Pelanggan ({{ store.bookings.length }})
        </button>
        <button :class="{ active: activeView === 'refunds' }" @click="activeView = 'refunds'">
          Riwayat Pengembalian Dana ({{ store.refunds.length }})
        </button>
      </div>
    </section>

    <section v-if="activeView === 'bookings'" class="panel table-panel">
      <div class="table-toolbar">
        <label class="table-search"><Search :size="17" /><input v-model="search" type="search" placeholder="Cari nama, nomor PO, atau telepon" /></label>
        <div class="filter-row"><SlidersHorizontal :size="17" /><select v-model="status"><option>Semua</option><option>Draft</option><option>Terkonfirmasi</option><option>Selesai</option><option>Dibatalkan</option></select></div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table booking-table">
          <thead><tr><th>Pelanggan</th><th>Pemesanan</th><th>Acara</th><th>Tagihan</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            <tr v-for="booking in rows" :key="booking.id">
              <td><div class="customer-cell"><div class="avatar">{{ initials(store.customerFor(booking.customerId)?.name ?? '') }}</div><div><strong>{{ store.customerFor(booking.customerId)?.name }}</strong><span><Phone :size="12" />{{ store.customerFor(booking.customerId)?.phone }}</span></div></div></td>
              <td><strong class="mono-code">{{ booking.poNumber }}</strong><span class="subtle-line">Dibuat {{ formatDate(booking.createdAt) }}</span></td>
              <td><strong><CalendarDays :size="14" />{{ formatDate(booking.eventDate) }} · {{ booking.eventTime || '—' }}</strong><span class="subtle-line"><MapPin :size="12" />{{ booking.location }}<template v-if="booking.stylingType"> · {{ booking.stylingType }}</template></span></td>
              <td>
                <strong>{{ formatCurrency(store.bookingTotal(booking.id)) }}</strong>
                <span class="subtle-line">
                  {{ booking.status === 'Dibatalkan' ? 'Transaksi dibatalkan' : `Sisa ${formatCurrency(store.bookingBalance(booking.id))}` }}
                </span>
              </td>
              <td><div class="badge-stack"><StatusBadge :label="booking.status" /><StatusBadge :label="paymentStatus(booking.id)" /></div></td>
              <td>
                <div class="row-actions">
                  <button class="icon-button" title="Lihat detail" @click="openDetail(booking)"><Eye :size="17" /></button>
                  <button class="icon-button" title="Edit" @click="openEdit(booking)"><Pencil :size="16" /></button>
                  <button
                    v-if="booking.status !== 'Dibatalkan'"
                    class="icon-button booking-cancel-btn"
                    title="Batalkan booking (hapus transaksi & bebaskan busana)"
                    @click="openCancelModal(booking)"
                  >
                    <Ban :size="16" />
                  </button>
                  <button
                    v-else
                    class="icon-button booking-refund-btn"
                    title="Catat pengembalian uang (refund)"
                    @click="openRefundModal(booking)"
                  >
                    <RotateCcw :size="16" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!rows.length"><td colspan="6"><div class="empty-state"><Search :size="28" /><strong>Data tidak ditemukan</strong><span>Coba ubah kata kunci atau filter.</span></div></td></tr>
          </tbody>
        </table>
      </div>
      <footer class="table-footer"><span>Menampilkan {{ rows.length }} dari {{ store.bookings.length }} booking</span><div><button disabled>‹</button><button class="active" disabled>1</button><button disabled>›</button></div></footer>
    </section>

    <section v-else class="panel table-panel">
      <div class="table-toolbar">
        <div>
          <strong>Riwayat Pengembalian Uang (Refund)</strong>
          <p class="refund-subcopy">Setiap pengembalian dana otomatis dicatat sebagai arus kas keluar.</p>
        </div>
        <button class="primary-button" @click="openRefundModal()"><Plus :size="17" />Catat Pengembalian Uang</button>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>No. Refund</th>
              <th>Nomor PO & Customer</th>
              <th>Tanggal Dikembalikan</th>
              <th>Metode</th>
              <th>Nominal</th>
              <th>Bukti Pembayaran</th>
              <th>Catatan</th>
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
                <button v-if="refund.proofImageUrl" type="button" class="proof-thumb-btn" title="Lihat bukti transfer" @click="openProofZoom(refund.proofImageUrl)">
                  <img :src="refund.proofImageUrl" alt="Bukti refund" />
                </button>
                <span v-else class="subtle-line">—</span>
              </td>
              <td>{{ refund.notes || '—' }}</td>
            </tr>
            <tr v-if="!store.refunds.length">
              <td colspan="7">
                <div class="empty-state">
                  <RotateCcw :size="26" />
                  <strong>Belum ada pengembalian uang</strong>
                  <span>Jika ada PO yang dibatalkan dan dananya dikembalikan, catat di sini untuk memengaruhi arus kas.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <UiModal :open="showForm" :title="editingId ? 'Edit Booking' : 'Tambah Booking Baru'" :description="editingId ? 'Perbarui data customer dan detail acara.' : 'Nomor PO akan dibuat otomatis saat data disimpan.'" wide @close="showForm = false">
      <form class="form-grid" @submit.prevent="submit">
        <label><span>Nama customer *</span><input v-model="form.name" placeholder="Contoh: Nadya Prameswari" /></label>
        <label><span>Nomor telepon / WhatsApp *</span><input v-model="form.phone" placeholder="08xxxxxxxxxx" /></label>
        <label class="span-2"><span>Lokasi acara *</span><input v-model="form.location" placeholder="Nama venue atau kota" /></label>
        <label><span>Tanggal acara *</span><input v-model="form.eventDate" type="date" /></label>
        <label><span>Waktu acara</span><input v-model="form.eventTime" type="time" /></label>
        <label><span>Jenis penataan *</span><select v-model="form.stylingType"><option value="">Pilih jenis penataan</option><option value="Hijabdo">Hijabdo</option><option value="Hairdo">Hairdo</option></select></label>
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
        <div><span>Jenis penataan</span><strong>{{ selectedBooking.stylingType || '—' }}</strong></div>
        <div><span>Total tagihan</span><strong>{{ formatCurrency(store.bookingTotal(selectedBooking.id)) }}</strong></div>
        <div><span>Sisa pembayaran</span><strong>{{ formatCurrency(store.bookingBalance(selectedBooking.id)) }}</strong></div>
        <div v-if="selectedBooking.notes" class="span-2"><span>Catatan</span><strong>{{ selectedBooking.notes }}</strong></div>
      </div>
      <div class="modal-actions"><button class="secondary-button" @click="showDetail = false">Tutup</button><button class="primary-button" @click="showDetail = false; openEdit(selectedBooking!)"><Pencil :size="16" />Edit Booking</button></div>
    </UiModal>

    <UiModal :open="showCancelModal" title="Batalkan Booking (PO)" description="Pembatalan akan menghapus transaksi terkait PO ini dan otomatis membebaskan busana." wide @close="showCancelModal = false">
      <form v-if="cancelTarget" class="form-grid" @submit.prevent="confirmCancelBooking">
        <div class="cancel-impact-box span-2">
          <strong>{{ cancelTarget.poNumber }} — {{ store.customerFor(cancelTarget.customerId)?.name }}</strong>
          <ul>
            <li>Seluruh data <b>Pesanan, Invoice, dan Pembayaran</b> pada PO ini akan dihapus dari daftar transaksi.</li>
            <li>Seluruh <b>Busana Wedding</b> yang dipesan untuk PO ini otomatis kembali berstatus <b>Tersedia</b>.</li>
          </ul>
        </div>

        <div class="paid-info-banner span-2">
          <div>
            <span>Total Uang Sudah Masuk (PO {{ cancelTarget.poNumber }})</span>
            <strong>{{ formatCurrency(cancelPaidAmount) }}</strong>
          </div>
          <small>{{ cancelPaidAmount > 0 ? 'Masukkan nominal pengembalian secara manual di bawah jika dana dikembalikan.' : 'Belum ada pembayaran masuk pada PO ini.' }}</small>
        </div>

        <label class="span-2 checkbox-inline-label">
          <input v-model="cancelWithRefund" type="checkbox" />
          <span>Sekaligus catat Pengembalian Uang (Refund) ke customer (memengaruhi arus kas)</span>
        </label>

        <template v-if="cancelWithRefund">
          <label><span>Tanggal dikembalikan *</span><input v-model="cancelRefundForm.refundDate" type="date" /></label>
          <label>
            <span>Metode pengembalian *</span>
            <select v-model="cancelRefundForm.method">
              <option v-for="m in store.paymentMethods" :key="m" :value="m">{{ m }}</option>
              <option v-if="cancelRefundForm.method && !store.paymentMethods.includes(cancelRefundForm.method)" :value="cancelRefundForm.method">
                {{ cancelRefundForm.method === 'Cash' ? 'Tunai' : cancelRefundForm.method }}
              </option>
            </select>
          </label>
          <label class="span-2">
            <span>Nominal pengembalian (isi manual, maks. {{ formatCurrency(cancelPaidAmount) }}) *</span>
            <CurrencyInput v-model="cancelRefundForm.amount" aria-label="Nominal pengembalian" />
          </label>
          <div v-if="cancelRefundExceedsPaid" class="refund-limit-alert span-2" role="alert">
            <AlertTriangle :size="17" />
            <div>
              <strong>Peringatan: Nominal pengembalian melebihi uang masuk!</strong>
              <span>Anda mengisi {{ formatCurrency(cancelRefundForm.amount) }}, sedangkan total uang yang sudah masuk hanya {{ formatCurrency(cancelPaidAmount) }}.</span>
            </div>
          </div>
          <label class="span-2"><span>Catatan pengembalian</span><input v-model="cancelRefundForm.notes" placeholder="Alasan / rekening tujuan" /></label>
          <div class="span-2 attire-upload-block">
            <span class="upload-field-label">Bukti pembayaran / transfer pengembalian</span>
            <label class="upload-zone">
              <img v-if="cancelRefundForm.proofImageUrl" :src="cancelRefundForm.proofImageUrl" alt="Bukti pengembalian" />
              <div v-else><UploadCloud :size="24" /><strong>Unggah bukti transfer JPG, PNG, atau WebP</strong><span>Maksimal 5 MB</span></div>
              <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleCancelProofUpload" />
            </label>
            <button v-if="cancelRefundForm.proofImageUrl" type="button" class="soft-button remove-photo-btn" @click="cancelRefundForm.proofImageUrl = ''">Hapus bukti</button>
            <p v-if="cancelUploading" class="upload-state"><LoaderCircle class="spin" :size="15" />Memproses foto…</p>
          </div>
        </template>

        <p v-if="cancelError" class="form-error span-2">{{ cancelError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showCancelModal = false">Batal</button>
          <button type="submit" class="danger-button" :disabled="cancelUploading">Konfirmasi Batalkan PO</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showRefundModal" title="Pengembalian Uang (Refund)" description="Catat pengembalian dana untuk booking yang dibatalkan agar tercatat di arus kas." wide @close="showRefundModal = false">
      <form class="form-grid" @submit.prevent="submitRefund">
        <label class="span-2">
          <span>Nomor PO Dibatalkan *</span>
          <select v-model="refundForm.bookingId">
            <option value="">Pilih PO yang dibatalkan</option>
            <option v-for="b in cancelledBookings" :key="b.id" :value="b.id">
              {{ b.poNumber }} — {{ store.customerFor(b.customerId)?.name }}{{ b.cancelledPaidAmount ? ` (Pernah bayar ${formatCurrency(b.cancelledPaidAmount)})` : '' }}
            </option>
          </select>
        </label>
        <div v-if="selectedRefundBooking" class="paid-info-banner span-2">
          <div>
            <span>Uang Masuk: <b>{{ formatCurrency(refundPaidAmount) }}</b> · Sudah Direfund: <b>{{ formatCurrency(refundAlreadyReturned) }}</b></span>
            <strong>Maksimal Sisa Pengembalian: {{ formatCurrency(refundMaxAllowed) }}</strong>
          </div>
          <small>Isi nominal pengembalian secara manual sesuai kesepakatan.</small>
        </div>
        <label><span>Tanggal dikembalikan *</span><input v-model="refundForm.refundDate" type="date" /></label>
        <label>
          <span>Metode *</span>
          <select v-model="refundForm.method">
            <option v-for="m in store.paymentMethods" :key="m" :value="m">{{ m }}</option>
            <option v-if="refundForm.method && !store.paymentMethods.includes(refundForm.method)" :value="refundForm.method">
              {{ refundForm.method === 'Cash' ? 'Tunai' : refundForm.method }}
            </option>
          </select>
        </label>
        <label class="span-2"><span>Nominal pengembalian (isi manual) *</span><CurrencyInput v-model="refundForm.amount" aria-label="Nominal pengembalian" /></label>
        <div v-if="refundExceedsPaid" class="refund-limit-alert span-2" role="alert">
          <AlertTriangle :size="17" />
          <div>
            <strong>Peringatan: Nominal melebihi uang masuk!</strong>
            <span>Nominal {{ formatCurrency(refundForm.amount) }} melebihi batas pengembalian {{ formatCurrency(refundMaxAllowed) }}.</span>
          </div>
        </div>
        <label class="span-2"><span>Catatan</span><input v-model="refundForm.notes" placeholder="Nomor rekening atau keterangan" /></label>
        <div class="span-2 attire-upload-block">
          <span class="upload-field-label">Bukti pembayaran / transfer</span>
          <label class="upload-zone">
            <img v-if="refundForm.proofImageUrl" :src="refundForm.proofImageUrl" alt="Bukti refund" />
            <div v-else><UploadCloud :size="24" /><strong>Unggah bukti pembayaran JPG, PNG, atau WebP</strong><span>Maksimal 5 MB</span></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleRefundProofUpload" />
          </label>
          <button v-if="refundForm.proofImageUrl" type="button" class="soft-button remove-photo-btn" @click="refundForm.proofImageUrl = ''">Hapus bukti</button>
          <p v-if="refundUploading" class="upload-state"><LoaderCircle class="spin" :size="15" />Memproses foto…</p>
        </div>
        <p v-if="refundError" class="form-error span-2">{{ refundError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showRefundModal = false">Batal</button>
          <button type="submit" class="primary-button" :disabled="refundUploading">Simpan Pengembalian Uang</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showProofModal" title="Bukti Pengembalian Uang" @close="showProofModal = false">
      <div class="attire-zoom">
        <div>
          <img v-if="zoomedProof" :src="zoomedProof" alt="Bukti pengembalian uang" />
          <ImageIcon v-else :size="48" />
        </div>
      </div>
    </UiModal>
  </div>
</template>
