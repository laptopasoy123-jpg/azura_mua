<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Briefcase, CalendarDays, Check, Download, MapPin, Pencil, Phone, RotateCcw,
  Search, SlidersHorizontal, UserCheck, Users, Plus,
} from '@lucide/vue'
import { useCrmStore, type Booking, type EmployeeRecord } from '../stores/crm'
import { formatDate } from '../utils/format'
import { downloadJobReportPdf, type JobReportRow } from '../utils/jobReportPdf'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'

const store = useCrmStore()

const search = ref('')
const fromDate = ref('')
const toDate = ref('')
const employeeFilter = ref('')

// Job notes edit modal
const showNoteModal = ref(false)
const noteBooking = ref<Booking | null>(null)
const noteDraft = ref('')

const activeBookings = computed(() =>
  [...store.bookings]
    .filter((b) => b.status !== 'Dibatalkan')
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
)

const bookingServicesText = (bookingId: string) => {
  const invoice = store.bookingInvoice(bookingId)
  if (!invoice) return ''
  const allItems = store.sortInvoiceItemsIntiFirst(
    invoice.groups?.length ? invoice.groups.flatMap((g) => g.items) : invoice.items,
  )
  return allItems.map((it) => `${it.name} (${it.quantity})`).join(', ')
}

const filteredBookings = computed(() => {
  const q = search.value.trim().toLowerCase()
  return activeBookings.value.filter((booking) => {
    if (fromDate.value && booking.eventDate < fromDate.value) return false
    if (toDate.value && booking.eventDate > toDate.value) return false
    const assigned = store.assignedEmployeesForBooking(booking.id)
    if (employeeFilter.value === '__unassigned__') {
      if (assigned.length > 0) return false
    } else if (employeeFilter.value && !assigned.some((e) => e.id === employeeFilter.value)) {
      return false
    }
    if (!q) return true
    const customer = store.customerFor(booking.customerId)
    const staffNames = assigned.map((e) => e.name.toLowerCase()).join(' ')
    return (
      booking.poNumber.toLowerCase().includes(q)
      || booking.location.toLowerCase().includes(q)
      || (customer?.name.toLowerCase().includes(q) ?? false)
      || staffNames.includes(q)
    )
  })
})

const assignedCount = computed(() =>
  filteredBookings.value.filter((b) => store.assignedEmployeesForBooking(b.id).length > 0).length,
)
const unassignedCount = computed(() => filteredBookings.value.length - assignedCount.value)

const isEmployeeAssigned = (bookingId: string, employeeId: string) =>
  (store.jobForBooking(bookingId)?.employeeIds ?? []).includes(employeeId)

const resetFilters = () => {
  search.value = ''
  fromDate.value = ''
  toDate.value = ''
  employeeFilter.value = ''
}

const openNoteModal = (booking: Booking) => {
  noteBooking.value = booking
  noteDraft.value = store.jobForBooking(booking.id)?.notes ?? ''
  showNoteModal.value = true
}

const saveJobNotes = () => {
  if (!noteBooking.value) return
  store.setBookingJobNotes(noteBooking.value.id, noteDraft.value)
  showNoteModal.value = false
  noteBooking.value = null
}

// Inline employee manager modal
const showStaffModal = ref(false)
const staffForm = reactive({ name: '', role: 'MUA & Hairdo', phone: '' })
const staffError = ref('')
const editingStaff = ref<EmployeeRecord | null>(null)
const roleOptions = [
  'Owner / Lead MUA',
  'MUA & Hairdo',
  'Hijabdo Stylist',
  'Asisten MUA',
  'Wardrobe & Inventory',
  'Runner / Logistik',
  'Admin / Finance',
]

const openManageStaff = () => {
  staffError.value = ''
  editingStaff.value = null
  Object.assign(staffForm, { name: '', role: 'MUA & Hairdo', phone: '' })
  showStaffModal.value = true
}

const submitNewStaff = () => {
  try {
    staffError.value = ''
    if (!staffForm.name.trim()) throw new Error('Nama karyawan wajib diisi.')
    if (editingStaff.value) {
      store.updateEmployee(editingStaff.value.id, {
        name: staffForm.name,
        role: staffForm.role,
        phone: staffForm.phone,
      })
      editingStaff.value = null
    } else {
      store.addEmployee({
        name: staffForm.name,
        role: staffForm.role,
        phone: staffForm.phone || undefined,
      })
    }
    Object.assign(staffForm, { name: '', role: 'MUA & Hairdo', phone: '' })
  } catch (err) {
    staffError.value = err instanceof Error ? err.message : 'Gagal menyimpan karyawan.'
  }
}

const startEditStaff = (emp: EmployeeRecord) => {
  editingStaff.value = emp
  Object.assign(staffForm, { name: emp.name, role: emp.role, phone: emp.phone ?? '' })
}

const exportPdf = () => {
  const rows: JobReportRow[] = filteredBookings.value.map((booking) => {
    const customer = store.customerFor(booking.customerId)
    const assigned = store.assignedEmployeesForBooking(booking.id)
    const job = store.jobForBooking(booking.id)
    return {
      poNumber: booking.poNumber,
      eventDate: booking.eventDate,
      eventTime: booking.eventTime,
      customerName: customer?.name ?? 'Customer',
      stylingType: booking.stylingType,
      location: booking.location,
      servicesSummary: bookingServicesText(booking.id) || 'Belum ada item pesanan',
      assignedNames: assigned.map((e) => e.name),
      notes: job?.notes || booking.notes,
      status: booking.status,
    }
  })

  const empName = employeeFilter.value && employeeFilter.value !== '__unassigned__'
    ? store.employees.find((e) => e.id === employeeFilter.value)?.name
    : employeeFilter.value === '__unassigned__'
      ? 'Belum Ditugaskan'
      : undefined

  downloadJobReportPdf({
    fromDate: fromDate.value,
    toDate: toDate.value,
    filterEmployeeName: empName,
    rows,
    employees: store.activeEmployees,
  })
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div>
        <span class="eyebrow">Ruang Kerja</span>
        <h2>Penugasan Tim Karyawan</h2>
        <p>Klik nama karyawan untuk menetapkan pemegang tugas pada setiap Nomor PO dan unduh laporan tugas PDF per rentang tanggal acara.</p>
      </div>
      <div class="heading-actions">
        <button type="button" class="secondary-button" @click="openManageStaff">
          <Users :size="16" />Kelola Karyawan ({{ store.activeEmployees.length }})
        </button>
        <button type="button" class="primary-button" @click="exportPdf">
          <Download :size="17" />Unduh Laporan Tugas PDF
        </button>
      </div>
    </section>

    <section class="summary-strip">
      <div><span>Total PO (Filter)</span><strong>{{ filteredBookings.length }} PO</strong></div>
      <div><span>Sudah Ditugaskan</span><strong>{{ assignedCount }} PO</strong></div>
      <div><span>Belum Ada Tim</span><strong>{{ unassignedCount }} PO</strong></div>
      <div><span>Karyawan Aktif</span><strong>{{ store.activeEmployees.length }} Orang</strong></div>
    </section>

    <section class="panel table-panel">
      <div class="job-filter-bar">
        <label class="table-search">
          <Search :size="17" />
          <input v-model="search" type="search" placeholder="Cari PO, customer, lokasi, atau nama karyawan…" />
        </label>

        <div class="job-date-filters">
          <label class="job-filter-field">
            <span>Dari Tanggal</span>
            <input v-model="fromDate" type="date" aria-label="Dari tanggal acara" />
          </label>
          <label class="job-filter-field">
            <span>Sampai Tanggal</span>
            <input v-model="toDate" type="date" aria-label="Sampai tanggal acara" />
          </label>
          <label class="job-filter-field">
            <span>Filter Karyawan</span>
            <div class="filter-row">
              <SlidersHorizontal :size="15" />
              <select v-model="employeeFilter" aria-label="Filter karyawan">
                <option value="">Semua Karyawan</option>
                <option value="__unassigned__">Belum Ditugaskan</option>
                <option v-for="emp in store.activeEmployees" :key="emp.id" :value="emp.id">
                  {{ emp.name }} ({{ emp.role }})
                </option>
              </select>
            </div>
          </label>
          <button
            v-if="search || fromDate || toDate || employeeFilter"
            type="button"
            class="soft-button"
            title="Reset filter"
            @click="resetFilters"
          >
            <RotateCcw :size="14" />Reset
          </button>
        </div>
      </div>

      <div class="data-table-wrap">
        <table class="data-table jobs-table">
          <thead>
            <tr>
              <th>PO &amp; Tanggal Acara</th>
              <th>Customer &amp; Lokasi</th>
              <th>Pesanan Layanan</th>
              <th>Pemegang Job (Klik untuk Pilih)</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="booking in filteredBookings" :key="booking.id">
              <td>
                <div class="job-po-cell">
                  <strong class="mono-code">{{ booking.poNumber }}</strong>
                  <span class="job-date-line">
                    <CalendarDays :size="13" />
                    {{ formatDate(booking.eventDate) }}<template v-if="booking.eventTime"> · {{ booking.eventTime }}</template>
                  </span>
                  <StatusBadge :label="booking.status" />
                </div>
              </td>
              <td>
                <div class="job-customer-cell">
                  <strong>{{ store.customerFor(booking.customerId)?.name }}</strong>
                  <span class="subtle-line"><Phone :size="12" />{{ store.customerFor(booking.customerId)?.phone }}</span>
                  <span class="subtle-line"><MapPin :size="12" />{{ booking.location }}</span>
                  <span v-if="booking.stylingType" class="job-styling-chip">Penataan: {{ booking.stylingType }}</span>
                </div>
              </td>
              <td>
                <div class="job-services-cell">
                  <p v-if="bookingServicesText(booking.id)">{{ bookingServicesText(booking.id) }}</p>
                  <span v-else class="subtle-line">Belum ada rincian pesanan di menu Pesanan.</span>
                  <small v-if="store.jobForBooking(booking.id)?.notes" class="job-note-preview">
                    Catatan job: {{ store.jobForBooking(booking.id)?.notes }}
                  </small>
                </div>
              </td>
              <td>
                <div v-if="store.activeEmployees.length" class="job-assignee-grid">
                  <button
                    v-for="emp in store.activeEmployees"
                    :key="emp.id"
                    type="button"
                    class="employee-toggle-chip"
                    :class="{ 'is-assigned': isEmployeeAssigned(booking.id, emp.id) }"
                    :title="`${emp.name} · ${emp.role}`"
                    @click="store.toggleBookingEmployee(booking.id, emp.id)"
                  >
                    <Check v-if="isEmployeeAssigned(booking.id, emp.id)" :size="13" :stroke-width="2.4" />
                    <UserCheck v-else :size="13" :stroke-width="1.75" />
                    <span>{{ emp.name }}</span>
                  </button>
                </div>
                <span v-else class="subtle-line">Klik tombol "Kelola Karyawan" di atas untuk menambahkan daftar karyawan.</span>
              </td>
              <td>
                <button
                  type="button"
                  class="icon-button"
                  title="Edit catatan job untuk PO ini"
                  @click="openNoteModal(booking)"
                >
                  <Pencil :size="16" />
                </button>
              </td>
            </tr>
            <tr v-if="!filteredBookings.length">
              <td colspan="5">
                <div class="empty-state">
                  <Briefcase :size="28" />
                  <strong>Tidak ada pesanan/job pada filter ini</strong>
                  <span>Sesuaikan rentang tanggal atau reset filter untuk menampilkan seluruh PO masuk.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="table-footer">
        <span>Menampilkan {{ filteredBookings.length }} PO aktif · Klik nama karyawan untuk langsung menugaskan atau melepas job</span>
      </footer>
    </section>

    <UiModal
      :open="showNoteModal"
      :title="noteBooking ? `Catatan Job — ${noteBooking.poNumber}` : 'Catatan Job'"
      description="Tambahkan instruksi call time, pembagian tugas, atau catatan lapangan untuk tim."
      @close="showNoteModal = false"
    >
      <form class="form-grid" @submit.prevent="saveJobNotes">
        <label class="span-2">
          <span>Catatan / Instruksi Tim</span>
          <textarea v-model="noteDraft" rows="3" placeholder="Contoh: Standby lokasi 04.30 WIB, bawa perlengkapan hijabdo cadangan" />
        </label>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showNoteModal = false">Batal</button>
          <button type="submit" class="primary-button">Simpan Catatan</button>
        </div>
      </form>
    </UiModal>

    <UiModal
      :open="showStaffModal"
      title="Kelola Daftar Karyawan"
      description="Tambah, ubah, atau nonaktifkan karyawan; nama yang aktif otomatis tampil untuk ditugaskan di PO."
      wide
      @close="showStaffModal = false"
    >
      <form class="form-grid" @submit.prevent="submitNewStaff">
        <label><span>Nama Karyawan *</span><input v-model="staffForm.name" placeholder="Contoh: Sinta Dewi" /></label>
        <label><span>Peran / Tugas *</span>
          <select v-model="staffForm.role">
            <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
          </select>
        </label>
        <label class="span-2"><span>No. Telepon / WA (opsional)</span><input v-model="staffForm.phone" placeholder="08xxxxxxxxxx" /></label>
        <p v-if="staffError" class="form-error span-2">{{ staffError }}</p>
        <div class="modal-actions span-2">
          <button v-if="editingStaff" type="button" class="secondary-button" @click="editingStaff = null; Object.assign(staffForm, { name: '', role: 'MUA & Hairdo', phone: '' })">
            Batal Edit
          </button>
          <button type="submit" class="primary-button">
            <Plus :size="15" />{{ editingStaff ? 'Simpan Perubahan Karyawan' : 'Tambah Karyawan' }}
          </button>
        </div>
      </form>

      <div class="staff-manage-list">
        <h4>Daftar Karyawan Terdaftar ({{ store.employees.length }})</h4>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Nama</th><th>Peran</th><th>Status</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              <tr v-for="emp in store.employees" :key="emp.id">
                <td><strong>{{ emp.name }}</strong><span v-if="emp.phone" class="subtle-line">{{ emp.phone }}</span></td>
                <td>{{ emp.role }}</td>
                <td><StatusBadge :label="emp.active ? 'Aktif' : 'Nonaktif'" /></td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="icon-button" title="Edit karyawan" @click="startEditStaff(emp)"><Pencil :size="15" /></button>
                    <button type="button" class="soft-button" @click="store.toggleEmployeeStatus(emp.id)">
                      {{ emp.active ? 'Nonaktifkan' : 'Aktifkan' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </UiModal>
  </div>
</template>
