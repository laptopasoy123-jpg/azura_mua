<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Plus, Search, Shirt, ZoomIn, UploadCloud, LoaderCircle, Save, CalendarHeart,
  Ruler, UsersRound, Store, Download, Trash2, Image as ImageIcon, Pencil,
  CalendarDays, AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, CheckCircle2,
} from '@lucide/vue'
import UiModal from '../components/UiModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import AttireSelect, { type AttireSelectOption } from '../components/AttireSelect.vue'
import {
  useCrmStore,
  type AttireCategory,
  type AttireScheduleEntry,
  type AttireStatus,
  type WeddingAttire,
  type WeddingEventDetail,
  type WeddingFittingForm,
} from '../stores/crm'
import { formatDate, uid } from '../utils/format'
import { generateWeddingFittingPdf, downloadWeddingAttireReportPdf } from '../utils/weddingPdf'
import { uploadImageWithFallback } from '../utils/uploadImage'

const store = useCrmStore()
const portalTab = ref<'inventory' | 'form' | 'database'>('inventory')

const search = ref('')
const category = ref<'Semua' | AttireCategory>('Semua')
const status = ref<'Semua' | AttireStatus>('Semua')
const showAttireForm = ref(false)
const editingAttireId = ref('')
const showZoom = ref(false)
const zoomedAttire = ref<WeddingAttire | null>(null)
const uploading = ref(false)
const uploadError = ref('')
const imagePreview = ref('')
const saveMessage = ref('')
const lastSavedBookingId = ref('')
const formError = ref('')
const downloadingPdf = ref(false)

// Calendar modal state per attire
const showCalendarModal = ref(false)
const calendarAttire = ref<WeddingAttire | null>(null)
const calendarYear = ref(2026)
const calendarMonth = ref(10)
const selectedCalendarDate = ref('')

// Status change alert modal (ONLY triggers when schedule is Hari Ini or Besok H-1)
const showStatusAlert = ref(false)
const pendingAlertAttire = ref<WeddingAttire | null>(null)
const pendingAlertTargetStatus = ref<AttireStatus>('Laundry')

// Floating success window after saving fitting form
const showSaveSuccessModal = ref(false)
const lastSavedSummary = ref('')

// Date-range PDF report for attire schedule
const scheduleReportFrom = ref('')
const scheduleReportTo = ref('')

const downloadScheduleReport = () => {
  downloadWeddingAttireReportPdf({
    fromDate: scheduleReportFrom.value,
    toDate: scheduleReportTo.value,
    bookings: store.bookings,
    customers: store.customers,
    weddingForms: store.weddingForms,
    attireList: store.weddingAttire,
    effectiveStatus: store.effectiveAttireStatus,
    attireSchedule: store.attireSchedule,
    businessProfile: store.businessProfile,
  })
}

const familyUniformFields = [
  ['ibuBesan', 'Ibu & Besan', 'Warna / model / opsi hijab'],
  ['bapakBesan', 'Bapak & Besan', 'Detail seragam'],
  ['terimaTamu', 'Terima Tamu', 'Warna / model / opsi hijab'],
] as const

const addonUniformFields = [
  ['melati', 'Melati', 'Detail melati'],
  ['henna', 'Henna', 'Detail henna'],
  ['tambahan', 'Tambahan Lain', 'Catatan tambahan'],
] as const

const measurementGroups = [
  { key: 'bride', label: 'Bride', fields: ['LD', 'LPinggang', 'LPanggul', 'LLenganA', 'LLenganB', 'PLengan', 'Others adj', 'Shoes'] },
  { key: 'groom', label: 'Groom', fields: ['LD', 'LLengan', 'LPerut', 'PLengan', 'PCelana', 'LKepala', 'Others adj', 'Shoes'] },
  { key: 'ibu', label: 'Ibu', fields: ['LD', 'LLengan', 'PLengan'] },
  { key: 'ayah', label: 'Ayah', fields: ['LD', 'PLengan', 'PCelana', 'LKepala', 'Slop'], required: ['LKepala', 'Slop'] },
  { key: 'kembarMayangCe', label: 'Kembar Mayang Ce', fields: ['LD', 'Slop'] },
  { key: 'kembarMayangCo', label: 'Kembar Mayang Co', fields: ['LD', 'Slop'] },
  { key: 'terimaTamu', label: 'Terima Tamu', fields: ['List LD'] },
]

const softlensOptions = ['Normal', 'Plus', 'Silinder'] as const

const vendorFields = [
  ['deco', 'Deco'], ['doc', 'Doc'], ['wcc', 'WCC'], ['mc', 'MC'], ['tenda', 'Tenda'], ['seserahan', 'Seserahan'], ['wo', 'WO'],
] as const

const createBlankEvent = (number: 1 | 2 | 3): WeddingEventDetail => ({
  number,
  name: '',
  readyTime: '',
  timeNote: '',
  bride: { look: '', accessories: '', shoes: '', attireId: '' },
  groom: { look: '', accessories: '', shoes: '', attireId: '' },
})

const blankMeasurements = () => Object.fromEntries(measurementGroups.map((group) => [group.key, Object.fromEntries(group.fields.map((field) => [field, '']))]))
const blankForm = (bookingId = ''): WeddingFittingForm => ({
  id: uid(),
  bookingId,
  measurements: blankMeasurements(),
  events: [createBlankEvent(1)],
  uniforms: {
    domas: '',
    manggolo: '',
    ibuBesan: '',
    bapakBesan: '',
    terimaTamu: '',
    softlens: '',
    melati: '',
    henna: '',
    tambahan: '',
  },
  manggoloBlangkon: null,
  manggoloSlop: null,
  vendors: Object.fromEntries(vendorFields.map(([key]) => [key, ''])),
  updatedAt: '',
})

const fittingForm = reactive<WeddingFittingForm>(blankForm())
const attireForm = reactive({ name: '', category: 'Bride' as AttireCategory, size: '', status: 'Tersedia' as AttireStatus, notes: '', imageUrl: '' })

const effectiveStatus = (item: WeddingAttire) => store.effectiveAttireStatus(item)

const filteredAttire = computed(() => store.weddingAttire.filter((item) => {
  const query = search.value.toLowerCase()
  const eff = effectiveStatus(item)
  return (!query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query) || item.size.toLowerCase().includes(query))
    && (category.value === 'Semua' || item.category === category.value)
    && (status.value === 'Semua' || eff === status.value)
}))

const brideCatalog = computed(() => store.weddingAttire.filter((item) => item.category === 'Bride'))
const groomCatalog = computed(() => store.weddingAttire.filter((item) => item.category === 'Groom'))
const selectedBooking = computed(() => store.bookingFor(fittingForm.bookingId))
const savedFormForCurrentBooking = computed(() => store.weddingForms.find((form) => form.bookingId === fittingForm.bookingId))
const lastSavedForm = computed(() => store.weddingForms.find((form) => form.bookingId === lastSavedBookingId.value))
const selectedAttire = (id: string) => store.weddingAttire.find((item) => item.id === id)

const isAttireLocked = (item: WeddingAttire) => {
  const eff = effectiveStatus(item)
  if (eff === 'Laundry') return true
  if (selectedBooking.value?.eventDate) {
    return store.attireConflictsOnDate(item.id, selectedBooking.value.eventDate, selectedBooking.value.id).length > 0
  }
  return eff === 'Terpakai'
}

const buildAttireOptions = (list: WeddingAttire[]): AttireSelectOption[] =>
  list.map((item) => {
    const eff = effectiveStatus(item)
    if (selectedBooking.value?.eventDate) {
      const conflicts = store.attireConflictsOnDate(item.id, selectedBooking.value.eventDate, selectedBooking.value.id)
      if (conflicts.length) {
        return {
          item,
          statusKind: 'booked',
          statusLabel: `Terpakai (${conflicts[0]!.customerName}) · Terkunci`,
          locked: true,
        }
      }
    }
    if (eff === 'Laundry') {
      return {
        item,
        statusKind: 'laundry',
        statusLabel: 'Laundry · Terkunci',
        locked: true,
      }
    }
    if (eff === 'Terpakai') {
      if (selectedBooking.value?.eventDate) {
        return {
          item,
          statusKind: 'available',
          statusLabel: 'Tersedia tgl ini',
          locked: false,
        }
      }
      return {
        item,
        statusKind: 'booked',
        statusLabel: 'Terpakai · Terkunci',
        locked: true,
      }
    }
    return {
      item,
      statusKind: 'available',
      statusLabel: 'Tersedia',
      locked: false,
    }
  })

const brideAttireOptions = computed(() => buildAttireOptions(brideCatalog.value))
const groomAttireOptions = computed(() => buildAttireOptions(groomCatalog.value))

const attireSelectionAlert = (attireId: string): string => {
  if (!attireId) return ''
  const item = selectedAttire(attireId)
  if (!item) return ''
  const warnings: string[] = []
  if (item.status === 'Laundry') {
    warnings.push('Busana ini sedang berstatus Laundry / perawatan.')
  }
  if (selectedBooking.value?.eventDate) {
    const conflicts = store.attireConflictsOnDate(attireId, selectedBooking.value.eventDate, selectedBooking.value.id)
    if (conflicts.length) {
      const c = conflicts[0]!
      warnings.push(`Bentrok jadwal! Sudah dipakai ${c.poNumber} (${c.customerName}) pada ${formatDate(c.eventDate)}.`)
    }
  }
  return warnings.join(' ')
}

const loadBookingIntoForm = (bookingId: string) => {
  formError.value = ''
  const existing = store.weddingForms.find((item) => item.bookingId === bookingId)
  const next = existing ? JSON.parse(JSON.stringify(existing)) as WeddingFittingForm : blankForm(bookingId)
  if (!next.events?.length) next.events = [createBlankEvent(1)]
  next.events = next.events.map((ev, index) => ({
    ...createBlankEvent((index + 1) as 1 | 2 | 3),
    ...ev,
    number: (index + 1) as 1 | 2 | 3,
    timeNote: ev.timeNote ?? '',
  }))
  if (next.manggoloBlangkon === undefined) next.manggoloBlangkon = null
  if (next.manggoloSlop === undefined) next.manggoloSlop = null
  Object.assign(fittingForm, next)
}

watch(() => fittingForm.bookingId, (bookingId, prevId) => {
  if (!bookingId && !prevId) return
  if (bookingId) {
    saveMessage.value = ''
    loadBookingIntoForm(bookingId)
  }
})

const editSavedFitting = (bookingId: string) => {
  saveMessage.value = ''
  loadBookingIntoForm(bookingId)
  portalTab.value = 'form'
}

const addEventSection = () => {
  if (fittingForm.events.length >= 3) return
  const nextNum = (fittingForm.events.length + 1) as 1 | 2 | 3
  fittingForm.events.push(createBlankEvent(nextNum))
}

const removeEventSection = (index: number) => {
  if (index === 0 || fittingForm.events.length <= 1) return
  fittingForm.events.splice(index, 1)
  fittingForm.events.forEach((ev, idx) => {
    ev.number = (idx + 1) as 1 | 2 | 3
  })
}

const openZoom = (item: WeddingAttire) => {
  zoomedAttire.value = item
  showZoom.value = true
}

const openCreateAttire = () => {
  editingAttireId.value = ''
  Object.assign(attireForm, { name: '', category: 'Bride', size: '', status: 'Tersedia', notes: '', imageUrl: '' })
  imagePreview.value = ''
  uploadError.value = ''
  showAttireForm.value = true
}

const openEditAttire = (item: WeddingAttire) => {
  editingAttireId.value = item.id
  Object.assign(attireForm, {
    name: item.name,
    category: item.category,
    size: item.size,
    status: item.status,
    notes: item.notes ?? '',
    imageUrl: item.imageUrl ?? '',
  })
  imagePreview.value = item.imageUrl ?? ''
  uploadError.value = ''
  showAttireForm.value = true
}

const handleAttirePhoto = async (event: Event) => {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  uploadError.value = ''
  uploading.value = true
  try {
    const result = await uploadImageWithFallback(file, 'wedding-attire')
    attireForm.imageUrl = result.url
    imagePreview.value = result.url
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Gagal memproses foto.'
  } finally {
    uploading.value = false
    inputEl.value = ''
  }
}

const submitAttire = () => {
  uploadError.value = ''
  if (!attireForm.name.trim() || !attireForm.size.trim()) {
    uploadError.value = 'Nama dan ukuran busana wajib diisi.'
    return
  }
  const payload = {
    name: attireForm.name.trim(),
    category: attireForm.category,
    size: attireForm.size.trim(),
    status: attireForm.status,
    notes: attireForm.notes.trim() || undefined,
    imageUrl: attireForm.imageUrl || undefined,
  }
  if (editingAttireId.value) {
    store.updateWeddingAttire(editingAttireId.value, payload)
  } else {
    store.addWeddingAttire(payload)
  }
  Object.assign(attireForm, { name: '', category: 'Bride', size: '', status: 'Tersedia', notes: '', imageUrl: '' })
  imagePreview.value = ''
  editingAttireId.value = ''
  showAttireForm.value = false
}

const onAttireStatusSelect = (item: WeddingAttire, nextStatus: AttireStatus, event?: Event) => {
  // Only show warning popup if the attire is scheduled Hari Ini (today) or Besok (H-1)
  const urgentSchedule = store.urgentAttireSchedules(item.id)
  if ((nextStatus === 'Laundry' || nextStatus === 'Tersedia') && urgentSchedule.length > 0) {
    if (event?.target) {
      (event.target as HTMLSelectElement).value = effectiveStatus(item)
    }
    pendingAlertAttire.value = item
    pendingAlertTargetStatus.value = nextStatus
    showStatusAlert.value = true
    return
  }
  store.updateWeddingAttireStatus(item.id, nextStatus)
}

const confirmStatusAlertOverride = () => {
  if (pendingAlertAttire.value) {
    store.updateWeddingAttireStatus(pendingAlertAttire.value.id, pendingAlertTargetStatus.value)
  }
  pendingAlertAttire.value = null
  showStatusAlert.value = false
}

const cancelStatusAlertOverride = () => {
  pendingAlertAttire.value = null
  showStatusAlert.value = false
}

// Monthly calendar for selected attire (includes past & cancelled for audit, with Selesai / Batal labels)
const localTodayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const calendarEntryStatus = (entry: AttireScheduleEntry): 'Batal' | 'Selesai' | 'Terpakai' => {
  if (entry.bookingStatus === 'Dibatalkan') return 'Batal'
  if (entry.eventDate < localTodayIso()) return 'Selesai'
  return 'Terpakai'
}

const openAttireCalendar = (item: WeddingAttire) => {
  calendarAttire.value = item
  const schedule = store.attireSchedule(item.id, { includePast: true, includeCancelled: true })
  if (schedule.length) {
    const firstDate = new Date(`${schedule[0]!.eventDate}T00:00:00`)
    calendarYear.value = firstDate.getFullYear()
    calendarMonth.value = firstDate.getMonth()
    selectedCalendarDate.value = schedule[0]!.eventDate
  } else {
    const now = new Date()
    calendarYear.value = now.getFullYear()
    calendarMonth.value = now.getMonth()
    selectedCalendarDate.value = ''
  }
  showCalendarModal.value = true
}

const calendarMonthLabel = computed(() =>
  new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(calendarYear.value, calendarMonth.value, 1)),
)

const shiftCalendarMonth = (delta: number) => {
  const next = new Date(calendarYear.value, calendarMonth.value + delta, 1)
  calendarYear.value = next.getFullYear()
  calendarMonth.value = next.getMonth()
}

const calendarScheduleMap = computed(() => {
  const map = new Map<string, ReturnType<typeof store.attireSchedule>>()
  if (!calendarAttire.value) return map
  for (const entry of store.attireSchedule(calendarAttire.value.id, { includePast: true, includeCancelled: true })) {
    const list = map.get(entry.eventDate) ?? []
    list.push(entry)
    map.set(entry.eventDate, list)
  }
  return map
})

const calendarCells = computed(() => {
  const firstOfMonth = new Date(calendarYear.value, calendarMonth.value, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(calendarYear.value, calendarMonth.value + 1, 0).getDate()
  const cells: Array<{ key: string; day: number | null; iso: string; count: number }> = []
  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ key: `pad-${i}`, day: null, iso: '', count: 0 })
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const mm = String(calendarMonth.value + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const iso = `${calendarYear.value}-${mm}-${dd}`
    cells.push({
      key: iso,
      day: d,
      iso,
      count: calendarScheduleMap.value.get(iso)?.length ?? 0,
    })
  }
  return cells
})

const selectedDateBookings = computed(() => {
  if (!calendarAttire.value) return []
  const all = store.attireSchedule(calendarAttire.value.id, { includePast: true, includeCancelled: true })
  if (!selectedCalendarDate.value) return all
  const matching = all.filter((item) => item.eventDate === selectedCalendarDate.value)
  return matching.length ? matching : all
})

const saveForm = () => {
  formError.value = ''
  saveMessage.value = ''
  if (!fittingForm.bookingId) { formError.value = 'Pilih Nomor PO sebelum menyimpan form fitting.'; return }
  for (const ev of fittingForm.events) {
    for (const [roleLabel, id] of [['Bride', ev.bride.attireId], ['Groom', ev.groom.attireId]] as const) {
      if (!id) continue
      const item = selectedAttire(id)
      if (item && isAttireLocked(item)) {
        formError.value = `Busana ${roleLabel} "${item.name}" pada Acara ${ev.number} sedang ${effectiveStatus(item) === 'Laundry' ? 'Laundry' : 'Terpakai'} dan terkunci untuk jadwal ini.`
        return
      }
    }
  }
  for (const group of measurementGroups) {
    for (const required of group.required ?? []) {
      if (!fittingForm.measurements[group.key]?.[required]?.trim()) {
        formError.value = `${required} pada bagian ${group.label} wajib diisi.`
        document.getElementById('size-chart')?.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
  }
  const normalizedBlangkon = fittingForm.manggoloBlangkon === null || (fittingForm.manggoloBlangkon as unknown) === ''
    ? null
    : Math.max(0, Number(fittingForm.manggoloBlangkon))
  const normalizedSlop = fittingForm.manggoloSlop === null || (fittingForm.manggoloSlop as unknown) === ''
    ? null
    : Math.max(0, Number(fittingForm.manggoloSlop))

  fittingForm.manggoloBlangkon = normalizedBlangkon
  fittingForm.manggoloSlop = normalizedSlop

  const savedPo = selectedBooking.value?.poNumber ?? 'PO'
  const savedCustomerName = selectedBooking.value ? (store.customerFor(selectedBooking.value.customerId)?.name ?? '') : ''
  const savedBookingId = fittingForm.bookingId
  store.saveWeddingForm(JSON.parse(JSON.stringify(fittingForm)) as WeddingFittingForm)
  lastSavedBookingId.value = savedBookingId
  lastSavedSummary.value = `${savedPo}${savedCustomerName ? ` — ${savedCustomerName}` : ''}`
  saveMessage.value = `Form fitting ${savedPo} tersimpan ke Database Fitting. Form dikosongkan kembali untuk pengisian berikutnya.`

  // Reset form back to blank after saving and scroll back to top
  Object.assign(fittingForm, blankForm(''))
  showSaveSuccessModal.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const downloadSavedPdf = async (targetForm?: WeddingFittingForm) => {
  formError.value = ''
  const formToExport = targetForm ?? savedFormForCurrentBooking.value ?? lastSavedForm.value
  const booking = formToExport ? store.bookingFor(formToExport.bookingId) : undefined
  if (!formToExport || !booking) {
    formError.value = 'Simpan form fitting terlebih dahulu sebelum mengunduh PDF.'
    return
  }
  downloadingPdf.value = true
  try {
    await generateWeddingFittingPdf({
      form: formToExport,
      booking,
      attireList: store.weddingAttire,
    })
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Gagal membuat PDF.'
  } finally {
    downloadingPdf.value = false
  }
}

const fittingList = computed(() =>
  store.weddingForms.map((form) => {
    const booking = store.bookingFor(form.bookingId)
    const customer = booking ? store.customerFor(booking.customerId) : undefined
    return { form, booking, customer }
  }),
)
</script>

<template>
  <div class="page-stack wedding-page">
    <section class="page-heading">
      <div><span class="eyebrow">Ruang Kerja</span><h2>Portal Pernikahan</h2><p>Kelola inventaris busana, pengisian formulir fitting, dan data formulir fitting tersimpan secara terpisah.</p></div>
      <div class="heading-actions">
        <button class="primary-button" @click="openCreateAttire"><Plus :size="18" />Tambah Busana</button>
      </div>
    </section>

    <div v-if="store.laundryUrgentAlerts.length" class="urgent-laundry-banner">
      <AlertTriangle :size="20" />
      <div class="urgent-laundry-list">
        <strong>Peringatan Persiapan Busana (H-1 / Hari H)</strong>
        <div v-for="alert in store.laundryUrgentAlerts" :key="`${alert.attireId}-${alert.bookingId}`" class="urgent-laundry-item">
          <span>{{ alert.message }}</span>
          <button
            type="button"
            class="soft-button urgent-ready-btn"
            @click="store.updateWeddingAttireStatus(alert.attireId, 'Tersedia')"
          >
            Selesai Laundry
          </button>
        </div>
      </div>
    </div>

    <section class="portal-tabs-bar">
      <div class="segmented-tabs">
        <button :class="{ active: portalTab === 'inventory' }" @click="portalTab = 'inventory'">
          1. Inventaris &amp; Kalender Busana ({{ store.weddingAttire.length }})
        </button>
        <button :class="{ active: portalTab === 'form' }" @click="portalTab = 'form'">
          2. Pengisian Formulir Fitting
        </button>
        <button :class="{ active: portalTab === 'database' }" @click="portalTab = 'database'">
          3. Data Fitting Tersimpan ({{ store.weddingForms.length }})
        </button>
      </div>
    </section>

    <!-- TAB 1: INVENTORY BUSANA -->
    <section v-if="portalTab === 'inventory'" class="panel attire-catalog-panel">
      <header class="wedding-section-head">
        <div>
          <span class="section-number">01</span>
          <div>
            <span class="eyebrow">Inventory & jadwal busana</span>
            <h3>Busana Bride & Groom</h3>
            <p>Otomatis Terpakai saat tanggal acara customer aktif, otomatis Tersedia setelah tanggal acara lewat.</p>
          </div>
        </div>
        <div class="attire-summary">
          <span><i class="dot-available" />{{ store.weddingAttire.filter((item) => effectiveStatus(item) === 'Tersedia').length }} Tersedia</span>
          <span><i class="dot-booked" />{{ store.weddingAttire.filter((item) => effectiveStatus(item) === 'Terpakai').length }} Terpakai</span>
          <span><i class="dot-laundry" />{{ store.weddingAttire.filter((item) => effectiveStatus(item) === 'Laundry').length }} Laundry</span>
        </div>
      </header>

      <div class="attire-toolbar">
        <label class="table-search"><Search :size="17" /><input v-model="search" placeholder="Cari nama, kode, atau ukuran" /></label>
        <div class="filter-row">
          <select v-model="category"><option>Semua</option><option>Bride</option><option>Groom</option></select>
          <select v-model="status"><option>Semua</option><option>Tersedia</option><option>Terpakai</option><option>Laundry</option></select>
        </div>
      </div>

      <div class="attire-report-bar">
        <div class="attire-report-info">
          <Download :size="16" />
          <div>
            <strong>Laporan Jadwal Pemakaian Busana (PDF)</strong>
            <span>Tarik rincian siapa memakai busana Bride/Groom dari tanggal sampai tanggal.</span>
          </div>
        </div>
        <div class="attire-report-controls">
          <label>
            <span>Dari Tanggal</span>
            <input v-model="scheduleReportFrom" type="date" />
          </label>
          <label>
            <span>Sampai Tanggal</span>
            <input v-model="scheduleReportTo" type="date" />
          </label>
          <button type="button" class="primary-button" @click="downloadScheduleReport">
            <Download :size="16" />Unduh Laporan PDF
          </button>
        </div>
      </div>

      <div class="attire-grid">
        <article v-for="item in filteredAttire" :key="item.id" class="attire-card">
          <button class="attire-photo" :class="`attire-${item.category.toLowerCase()}`" @click="openZoom(item)">
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" loading="lazy" decoding="async" />
            <span v-else><Shirt :size="34" /><small>{{ item.category }}</small></span>
            <i><ZoomIn :size="15" />Zoom</i>
          </button>
          <div class="attire-card-body">
            <div>
              <span>{{ item.code }}</span>
              <StatusBadge :label="effectiveStatus(item)" />
            </div>
            <div class="attire-title-row">
              <h4>{{ item.name }}</h4>
              <button type="button" class="icon-button attire-edit-btn" title="Edit busana / foto" @click="openEditAttire(item)">
                <Pencil :size="14" />
              </button>
            </div>
            <p>{{ item.category }} · Size <strong>{{ item.size }}</strong></p>

            <div class="attire-schedule-box">
              <div v-if="store.attireSchedule(item.id).length" class="attire-date-chips">
                <span
                  v-for="entry in store.attireSchedule(item.id).slice(0, 2)"
                  :key="`${entry.bookingId}-${entry.eventNumber}`"
                  class="attire-date-chip"
                >
                  {{ formatDate(entry.eventDate) }} · {{ entry.customerName }}
                </span>
                <small v-if="store.attireSchedule(item.id).length > 2">
                  +{{ store.attireSchedule(item.id).length - 2 }} jadwal aktif lainnya
                </small>
              </div>
              <span v-else class="attire-no-schedule">Tersedia (tidak ada jadwal aktif)</span>

              <button type="button" class="soft-button attire-calendar-btn" @click="openAttireCalendar(item)">
                <CalendarDays :size="14" />Kalender ({{ store.attireSchedule(item.id, { includePast: true }).length }})
              </button>
            </div>

            <div v-if="item.status === 'Laundry' && store.attireSchedule(item.id).length" class="attire-laundry-warning">
              <AlertTriangle :size="13" />
              <span>Sedang Laundry padahal ada {{ store.attireSchedule(item.id).length }} jadwal pemakaian aktif!</span>
            </div>

            <select
              :value="effectiveStatus(item)"
              @change="onAttireStatusSelect(item, ($event.target as HTMLSelectElement).value as AttireStatus, $event)"
            >
              <option value="Tersedia">Tersedia</option>
              <option value="Terpakai">Terpakai</option>
              <option value="Laundry">Laundry</option>
            </select>
          </div>
        </article>
        <button class="attire-add-card" @click="openCreateAttire"><Plus :size="25" /><strong>Tambah busana baru</strong><span>Upload foto dan data ukuran</span></button>
      </div>
    </section>

    <!-- TAB 2: PENGISIAN FORM FITTING -->
    <template v-else-if="portalTab === 'form'">
      <div v-if="saveMessage" class="fitting-saved-banner">
        <div class="fitting-saved-copy">
          <CheckCircle2 :size="20" />
          <div>
            <strong>{{ saveMessage }}</strong>
            <span>Anda dapat mengunduh PDF hasil simpanan terakhir atau melihatnya di tab Database Fitting Tersimpan.</span>
          </div>
        </div>
        <div class="fitting-saved-actions">
          <button
            v-if="lastSavedForm"
            type="button"
            class="soft-button"
            :disabled="downloadingPdf"
            @click="downloadSavedPdf(lastSavedForm)"
          >
            <Download :size="15" />Download PDF
          </button>
          <button type="button" class="primary-button" @click="portalTab = 'database'">
            Lihat Daftar Tersimpan
          </button>
        </div>
      </div>

      <section id="booking-context" class="booking-context panel">
        <div class="booking-context-icon"><CalendarHeart :size="23" /></div>
        <div>
          <span class="eyebrow">Pengisian form fitting</span>
          <h3>Pilih booking yang akan dilengkapi</h3>
          <p v-if="selectedBooking">
            Acara: <strong>{{ formatDate(selectedBooking.eventDate) }}</strong> · Lokasi: <strong>{{ selectedBooking.location }}</strong>
          </p>
          <p v-else>Setelah klik "Simpan Form Fitting", data masuk ke Database Fitting dan form otomatis kosong kembali.</p>
        </div>
        <label>
          <span>Nomor PO / Customer</span>
          <select v-model="fittingForm.bookingId">
            <option value="">Pilih booking</option>
            <option v-for="booking in store.bookings.filter((b) => b.status !== 'Dibatalkan')" :key="booking.id" :value="booking.id">{{ booking.poNumber }} — {{ store.customerFor(booking.customerId)?.name }} — {{ formatDate(booking.eventDate) }}</option>
          </select>
        </label>
      </section>

      <section id="size-chart" class="panel fitting-panel">
        <header class="wedding-section-head"><div><span class="section-number">02</span><div><span class="eyebrow">Blank form</span><h3>Size Chart <small>cm</small></h3><p>Isi hasil pengukuran saat fitting. Kolom bertanda * wajib.</p></div></div><Ruler :size="23" /></header>
        <div class="measurement-grid">
          <article v-for="group in measurementGroups" :key="group.key" class="measurement-card">
            <h4>{{ group.label }}</h4>
            <div><label v-for="field in group.fields" :key="field"><span>{{ field }}<b v-if="group.required?.includes(field)">*</b></span><input v-model="fittingForm.measurements[group.key]![field]" :placeholder="field === 'Shoes' || field === 'Slop' ? 'Ukuran' : '0'" /></label></div>
          </article>
        </div>
      </section>

      <section class="panel event-details-panel">
        <header class="wedding-section-head">
          <div>
            <span class="section-number">03</span>
            <div>
              <span class="eyebrow">Acara & pilihan busana</span>
              <h3>Rincian Acara & Busana</h3>
              <p>Pilih busana Bride & Groom langsung dari katalog di dalam masing-masing acara.</p>
            </div>
          </div>
        </header>
        <div class="event-detail-list">
          <article v-for="(event, index) in fittingForm.events" :key="event.number" class="event-detail-card">
            <header>
              <div class="event-card-title">
                <span>Acara {{ event.number }}</span>
                <strong>{{ event.name || 'Belum diberi nama' }}</strong>
              </div>
              <button
                v-if="index > 0"
                type="button"
                class="event-remove-button"
                title="Hapus acara ini"
                @click="removeEventSection(index)"
              >
                <Trash2 :size="14" />Hapus Acara {{ event.number }}
              </button>
            </header>

            <div class="event-basic-fields event-basic-fields--three">
              <label>
                <span>Nama Acara</span>
                <input v-model="event.name" placeholder="Contoh: Akad / Resepsi / Ngunduh Mantu" />
              </label>
              <label>
                <span>Pukul</span>
                <input v-model="event.readyTime" type="time" />
              </label>
              <label>
                <span>Keterangan Waktu</span>
                <input v-model="event.timeNote" type="text" placeholder="Contoh: Ready 04.00 / Pagi" />
              </label>
            </div>

            <div class="couple-detail-grid">
              <section class="couple-detail-card">
                <h4>Bride</h4>
                <div class="couple-span-2">
                  <span class="attire-field-label">Pilih Busana Bride (Katalog)</span>
                  <AttireSelect
                    v-model="event.bride.attireId"
                    :options="brideAttireOptions"
                    placeholder="Pilih busana Bride dari katalog"
                  />
                </div>

                <div class="selected-outfit couple-span-2" :class="{ empty: !event.bride.attireId }">
                  <button
                    v-if="selectedAttire(event.bride.attireId)?.imageUrl"
                    type="button"
                    class="selected-outfit-thumb"
                    title="Perbesar foto busana"
                    @click="openZoom(selectedAttire(event.bride.attireId)!)"
                  >
                    <img :src="selectedAttire(event.bride.attireId)?.imageUrl" :alt="selectedAttire(event.bride.attireId)?.name" loading="lazy" decoding="async" />
                  </button>
                  <span v-else class="selected-outfit-placeholder"><Shirt :size="20" /></span>
                  <div>
                    <strong>{{ selectedAttire(event.bride.attireId)?.name ?? 'Belum ada busana dipilih' }}</strong>
                    <small>{{ selectedAttire(event.bride.attireId) ? `${selectedAttire(event.bride.attireId)?.code} · Size ${selectedAttire(event.bride.attireId)?.size}` : 'Nama dan gambar busana tampil otomatis setelah dipilih' }}</small>
                  </div>
                </div>

                <div v-if="attireSelectionAlert(event.bride.attireId)" class="attire-inline-alert couple-span-2">
                  <AlertTriangle :size="14" />
                  <span>{{ attireSelectionAlert(event.bride.attireId) }}</span>
                </div>

                <label><span>Look</span><input v-model="event.bride.look" placeholder="Detail look" /></label>
                <label><span>Acc</span><input v-model="event.bride.accessories" placeholder="Aksesori" /></label>
                <label class="couple-span-2"><span>Shoes</span><input v-model="event.bride.shoes" placeholder="Sepatu" /></label>
              </section>

              <section class="couple-detail-card">
                <h4>Groom</h4>
                <div class="couple-span-2">
                  <span class="attire-field-label">Pilih Busana Groom (Katalog)</span>
                  <AttireSelect
                    v-model="event.groom.attireId"
                    :options="groomAttireOptions"
                    placeholder="Pilih busana Groom dari katalog"
                  />
                </div>

                <div class="selected-outfit couple-span-2" :class="{ empty: !event.groom.attireId }">
                  <button
                    v-if="selectedAttire(event.groom.attireId)?.imageUrl"
                    type="button"
                    class="selected-outfit-thumb"
                    title="Perbesar foto busana"
                    @click="openZoom(selectedAttire(event.groom.attireId)!)"
                  >
                    <img :src="selectedAttire(event.groom.attireId)?.imageUrl" :alt="selectedAttire(event.groom.attireId)?.name" loading="lazy" decoding="async" />
                  </button>
                  <span v-else class="selected-outfit-placeholder"><Shirt :size="20" /></span>
                  <div>
                    <strong>{{ selectedAttire(event.groom.attireId)?.name ?? 'Belum ada busana dipilih' }}</strong>
                    <small>{{ selectedAttire(event.groom.attireId) ? `${selectedAttire(event.groom.attireId)?.code} · Size ${selectedAttire(event.groom.attireId)?.size}` : 'Nama dan gambar busana tampil otomatis setelah dipilih' }}</small>
                  </div>
                </div>

                <div v-if="attireSelectionAlert(event.groom.attireId)" class="attire-inline-alert couple-span-2">
                  <AlertTriangle :size="14" />
                  <span>{{ attireSelectionAlert(event.groom.attireId) }}</span>
                </div>

                <label><span>Look</span><input v-model="event.groom.look" placeholder="Detail look" /></label>
                <label><span>Acc</span><input v-model="event.groom.accessories" placeholder="Aksesori" /></label>
                <label class="couple-span-2"><span>Shoes</span><input v-model="event.groom.shoes" placeholder="Sepatu" /></label>
              </section>
            </div>
          </article>

          <div v-if="fittingForm.events.length < 3" class="add-event-row">
            <button type="button" class="outline-button add-event-button" @click="addEventSection">
              <Plus :size="16" />+ Tambah Acara
            </button>
          </div>
        </div>
      </section>

      <div class="wedding-bottom-grid">
        <section class="panel wedding-mini-form">
          <header class="wedding-section-head">
            <div>
              <span class="section-number">04</span>
              <div>
                <span class="eyebrow">Keluarga & tambahan</span>
                <h3>Seragam dan Detail</h3>
                <p>Kelompok Domas, Manggolo, Softlens, serta seragam keluarga dan tambahan.</p>
              </div>
            </div>
            <UsersRound :size="21" />
          </header>

          <div class="uniform-sections">
            <div class="uniform-group-box">
              <h4>Kelompok Domas</h4>
              <div class="uniform-group-fields">
                <label>
                  <span>Seragam & Detail Domas</span>
                  <input v-model="fittingForm.uniforms.domas" placeholder="Warna / model / opsi hijab" />
                </label>
              </div>
            </div>

            <div class="uniform-group-box">
              <h4>Kelompok Manggolo</h4>
              <div class="uniform-group-fields uniform-group-fields--manggolo">
                <label class="uniform-span-2">
                  <span>Seragam & Detail Manggolo</span>
                  <input v-model="fittingForm.uniforms.manggolo" placeholder="Detail seragam Manggolo" />
                </label>
                <label>
                  <span>Jumlah Blangkon</span>
                  <input v-model.number="fittingForm.manggoloBlangkon" type="number" min="0" placeholder="0" />
                </label>
                <label>
                  <span>Jumlah Slop</span>
                  <input v-model.number="fittingForm.manggoloSlop" type="number" min="0" placeholder="0" />
                </label>
              </div>
            </div>

            <div class="uniform-group-box">
              <h4>Keluarga & Penerima Tamu</h4>
              <div class="uniform-group-fields uniform-group-fields--two">
                <label v-for="([key, label, placeholder]) in familyUniformFields" :key="key">
                  <span>{{ label }}</span>
                  <input v-model="fittingForm.uniforms[key]" :placeholder="placeholder" />
                </label>
              </div>
            </div>

            <div class="uniform-group-box">
              <h4>Softlens & Tambahan</h4>
              <div class="uniform-group-fields uniform-group-fields--two">
                <label>
                  <span>Softlens</span>
                  <select v-model="fittingForm.uniforms.softlens">
                    <option value="">Pilih jenis softlens</option>
                    <option v-for="opt in softlensOptions" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                </label>
                <label v-for="([key, label, placeholder]) in addonUniformFields" :key="key">
                  <span>{{ label }}</span>
                  <input v-model="fittingForm.uniforms[key]" :placeholder="placeholder" />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section class="panel wedding-mini-form">
          <header class="wedding-section-head">
            <div>
              <span class="section-number">05</span>
              <div>
                <span class="eyebrow">List vendor</span>
                <h3>Vendor Pernikahan</h3>
                <p>Catat seluruh vendor pendukung acara.</p>
              </div>
            </div>
            <Store :size="21" />
          </header>
          <div class="mini-field-grid">
            <label v-for="([key, label]) in vendorFields" :key="key">
              <span>{{ label }}</span>
              <input v-model="fittingForm.vendors[key]" placeholder="Nama vendor / kontak / catatan" />
            </label>
          </div>
        </section>
      </div>

      <section class="wedding-save-bar">
        <div>
          <strong>{{ selectedBooking ? `${selectedBooking.poNumber} · ${store.customerFor(selectedBooking.customerId)?.name}` : 'Belum ada booking dipilih' }}</strong>
          <span>Simpan ke Database Fitting; form akan kosong kembali setelah tersimpan.</span>
        </div>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="wedding-save-actions">
          <button
            v-if="savedFormForCurrentBooking"
            type="button"
            class="secondary-button wedding-pdf-button"
            :disabled="downloadingPdf"
            @click="downloadSavedPdf(savedFormForCurrentBooking)"
          >
            <Download :size="17" />{{ downloadingPdf ? 'Menyiapkan PDF…' : 'Download PDF' }}
          </button>
          <button class="primary-button" @click="saveForm"><Save :size="17" />Simpan Form Fitting</button>
        </div>
      </section>
    </template>

    <!-- TAB 3: DAFTAR FORM FITTING TERSIMPAN -->
    <section v-else class="panel fitting-db-panel">
      <header class="wedding-section-head">
        <div>
          <span class="section-number">DB</span>
          <div>
            <span class="eyebrow">Database fitting tersimpan</span>
            <h3>Daftar Form Fitting Customer</h3>
            <p>Edit ulang atau unduh PDF untuk setiap form fitting yang sudah tersimpan.</p>
          </div>
        </div>
        <button type="button" class="primary-button" @click="portalTab = 'form'">
          <Plus :size="17" />Isi Form Fitting Baru
        </button>
      </header>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nomor PO</th>
              <th>Customer</th>
              <th>Tanggal & Lokasi Acara</th>
              <th>Acara & Busana Terpilih</th>
              <th>Diperbarui</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in fittingList" :key="row.form.id">
              <td><strong class="mono-code">{{ row.booking?.poNumber ?? '-' }}</strong></td>
              <td>
                <strong>{{ row.customer?.name ?? '-' }}</strong>
                <span v-if="row.booking?.status === 'Dibatalkan'" class="subtle-line">Status: Dibatalkan</span>
              </td>
              <td>
                <strong>{{ row.booking?.eventDate ? formatDate(row.booking.eventDate) : '-' }}</strong>
                <span class="subtle-line">{{ row.booking?.location ?? '-' }}</span>
              </td>
              <td>
                <div class="fitting-attire-pills">
                  <span v-for="ev in row.form.events" :key="ev.number" class="item-pill">
                    Acara {{ ev.number }}:
                    {{ selectedAttire(ev.bride.attireId)?.name || '—' }} / {{ selectedAttire(ev.groom.attireId)?.name || '—' }}
                  </span>
                </div>
              </td>
              <td>{{ row.form.updatedAt ? formatDate(row.form.updatedAt.slice(0, 10)) : '-' }}</td>
              <td>
                <div class="row-actions">
                  <button type="button" class="icon-button" title="Edit form fitting" @click="editSavedFitting(row.form.bookingId)">
                    <Pencil :size="15" />
                  </button>
                  <button type="button" class="icon-button" title="Download PDF fitting" @click="downloadSavedPdf(row.form)">
                    <Download :size="15" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!fittingList.length">
              <td colspan="6">
                <div class="empty-state">
                  <ClipboardList :size="26" />
                  <strong>Database fitting masih kosong</strong>
                  <span>Buka tab "2. Pengisian Form Fitting" untuk melengkapi data fitting customer.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <UiModal :open="showAttireForm" :title="editingAttireId ? 'Edit Busana' : 'Tambah Busana'" description="Lengkapi data dan unggah foto busana untuk katalog dan PDF." wide @close="showAttireForm = false">
      <form class="form-grid" @submit.prevent="submitAttire">
        <label><span>Nama busana *</span><input v-model="attireForm.name" placeholder="Contoh: Kebaya Sekar Arum" /></label>
        <label><span>Kategori *</span><select v-model="attireForm.category"><option>Bride</option><option>Groom</option></select></label>
        <label><span>Ukuran *</span><input v-model="attireForm.size" placeholder="S / M / L / Custom" /></label>
        <label><span>Status *</span><select v-model="attireForm.status"><option value="Tersedia">Tersedia</option><option value="Terpakai">Terpakai</option><option value="Laundry">Laundry</option></select></label>
        <label class="span-2"><span>Catatan</span><textarea v-model="attireForm.notes" rows="2" placeholder="Warna, bahan, detail set, atau kondisi busana" /></label>
        <div class="span-2 attire-upload-block">
          <span class="upload-field-label">Foto busana</span>
          <label class="upload-zone">
            <img v-if="imagePreview" :src="imagePreview" alt="Preview busana" />
            <div v-else><UploadCloud :size="25" /><strong>Klik untuk pilih foto JPG, PNG, atau WebP</strong><span>Maksimal 5 MB (tersimpan otomatis)</span></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleAttirePhoto" />
          </label>
          <button v-if="imagePreview" type="button" class="soft-button remove-photo-btn" @click="imagePreview = ''; attireForm.imageUrl = ''">
            Hapus foto
          </button>
        </div>
        <p v-if="uploading" class="upload-state span-2"><LoaderCircle class="spin" :size="16" />Memproses foto…</p>
        <p v-if="uploadError" class="form-error span-2">{{ uploadError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showAttireForm = false">Batal</button>
          <button class="primary-button" :disabled="uploading">{{ editingAttireId ? 'Simpan Perubahan' : 'Simpan Busana' }}</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showZoom" title="Detail Busana" @close="showZoom = false">
      <div v-if="zoomedAttire" class="attire-zoom"><div :class="`attire-${zoomedAttire.category.toLowerCase()}`"><img v-if="zoomedAttire.imageUrl" :src="zoomedAttire.imageUrl" :alt="zoomedAttire.name" /><ImageIcon v-else :size="48" /></div><h3>{{ zoomedAttire.name }}</h3><p>{{ zoomedAttire.code }} · {{ zoomedAttire.category }} · Size {{ zoomedAttire.size }}</p><StatusBadge :label="effectiveStatus(zoomedAttire)" /><span>{{ zoomedAttire.notes || 'Belum ada catatan busana.' }}</span></div>
    </UiModal>

    <UiModal :open="showCalendarModal" :title="calendarAttire ? `Kalender Busana — ${calendarAttire.name}` : 'Kalender Busana'" description="Tanggal terpakai ditarik otomatis dari Database Fitting berdasarkan tanggal acara customer." wide @close="showCalendarModal = false">
      <div v-if="calendarAttire" class="attire-calendar-modal">
        <div class="attire-calendar-nav">
          <button type="button" class="icon-button" @click="shiftCalendarMonth(-1)"><ChevronLeft :size="16" /></button>
          <strong>{{ calendarMonthLabel }}</strong>
          <button type="button" class="icon-button" @click="shiftCalendarMonth(1)"><ChevronRight :size="16" /></button>
        </div>
        <div class="attire-calendar-weekdays">
          <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span>
        </div>
        <div class="attire-calendar-grid">
          <button
            v-for="cell in calendarCells"
            :key="cell.key"
            type="button"
            class="calendar-day-cell"
            :class="{
              'is-empty': !cell.day,
              'is-booked': cell.count > 0,
              'is-selected': cell.iso && cell.iso === selectedCalendarDate,
            }"
            :disabled="!cell.day"
            @click="cell.iso && (selectedCalendarDate = selectedCalendarDate === cell.iso ? '' : cell.iso)"
          >
            <template v-if="cell.day">
              <span>{{ cell.day }}</span>
              <i v-if="cell.count > 0">{{ cell.count }}</i>
            </template>
          </button>
        </div>

        <div class="attire-calendar-events">
          <h4>
            {{ selectedCalendarDate ? `Jadwal pada ${formatDate(selectedCalendarDate)}` : 'Semua Jadwal Pemakaian Busana Ini' }}
          </h4>
          <div v-if="selectedDateBookings.length" class="calendar-event-list">
            <article v-for="entry in selectedDateBookings" :key="`${entry.bookingId}-${entry.eventNumber}`" class="calendar-event-item">
              <div>
                <strong class="mono-code">{{ entry.poNumber }}</strong> · <strong>{{ entry.customerName }}</strong>
                <span>{{ formatDate(entry.eventDate) }} · {{ entry.eventLocation }}</span>
              </div>
              <div class="calendar-event-badges">
                <span class="item-pill">{{ entry.eventName }} ({{ entry.role }})</span>
                <span class="calendar-status-pill" :class="`is-${calendarEntryStatus(entry).toLowerCase()}`">
                  {{ calendarEntryStatus(entry) }}
                </span>
              </div>
            </article>
          </div>
          <p v-else class="calendar-empty-note">Busana ini belum dijadwalkan pada tanggal manapun di Database Fitting.</p>
        </div>
      </div>
      <div class="modal-actions"><button class="primary-button" @click="showCalendarModal = false">Tutup</button></div>
    </UiModal>

    <UiModal :open="showStatusAlert" title="Peringatan Jadwal Busana (H-1 / Hari Ini)" description="Busana ini dijadwalkan dipakai hari ini atau besok (H-1) di Database Fitting." @close="cancelStatusAlertOverride">
      <div v-if="pendingAlertAttire" class="laundry-alert-body">
        <div class="laundry-alert-banner">
          <AlertTriangle :size="20" />
          <div>
            <strong>{{ pendingAlertAttire.name }} dipakai hari ini / besok (H-1)!</strong>
            <p v-if="pendingAlertTargetStatus === 'Laundry'">
              Jika diubah ke status <b>Laundry</b>, pastikan busana siap tepat waktu sebelum acara berikut:
            </p>
            <p v-else>
              Anda mengubah status ke <b>Tersedia</b>, padahal busana terjadwal dipakai hari ini / besok (H-1) pada acara berikut:
            </p>
          </div>
        </div>
        <ul class="laundry-conflict-list">
          <li v-for="entry in store.urgentAttireSchedules(pendingAlertAttire.id)" :key="`${entry.bookingId}-${entry.eventNumber}`">
            <strong>{{ formatDate(entry.eventDate) }}</strong> — {{ entry.customerName }} ({{ entry.poNumber }}) · {{ entry.eventName }}
          </li>
        </ul>
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary-button" @click="cancelStatusAlertOverride">Batal</button>
        <button type="button" class="danger-button" @click="confirmStatusAlertOverride">
          {{ pendingAlertTargetStatus === 'Laundry' ? 'Tetap Ubah ke Laundry' : 'Tetap Lanjutkan' }}
        </button>
      </div>
    </UiModal>

    <UiModal :open="showSaveSuccessModal" title="Berhasil Input Form Fitting" description="Data form fitting telah disimpan ke Database Fitting dan form telah dikosongkan kembali." @close="showSaveSuccessModal = false">
      <div class="save-success-modal-body">
        <div class="save-success-icon"><CheckCircle2 :size="30" /></div>
        <strong>{{ lastSavedSummary || 'Form Fitting Tersimpan' }}</strong>
        <p>Anda dapat langsung mengunduh PDF hasil fitting yang barusan disimpan, membuka daftar database fitting, atau melanjutkan input customer berikutnya.</p>
      </div>
      <div class="modal-actions">
        <button
          v-if="lastSavedForm"
          type="button"
          class="secondary-button"
          :disabled="downloadingPdf"
          @click="downloadSavedPdf(lastSavedForm)"
        >
          <Download :size="16" />Download PDF
        </button>
        <button
          type="button"
          class="secondary-button"
          @click="showSaveSuccessModal = false; portalTab = 'database'"
        >
          Lihat Daftar Tersimpan
        </button>
        <button type="button" class="primary-button" @click="showSaveSuccessModal = false">
          OK, Isi Form Baru
        </button>
      </div>
    </UiModal>
  </div>
</template>
