<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Plus, Search, Shirt, ZoomIn, UploadCloud, LoaderCircle, Save, CalendarHeart,
  Ruler, UsersRound, Store, Download, Trash2, Image as ImageIcon, Pencil,
  CalendarDays, AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, CheckCircle2, RotateCcw,
} from '@lucide/vue'
import UiModal from '../components/UiModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import AttireSelect, { type AttireSelectOption } from '../components/AttireSelect.vue'
import {
  useCrmStore,
  type AttireCategory,
  type AttireScheduleEntry,
  type AttireStatus,
  type Booking,
  type WeddingAttire,
  type WeddingEventDetail,
  type WeddingFittingForm,
} from '../stores/crm'
import { displayAttireStatus, formatDate, uid } from '../utils/format'
import { uploadImageWithFallback } from '../utils/uploadImage'

const store = useCrmStore()
const portalTab = ref<'inventory' | 'form' | 'database'>('inventory')

const search = ref('')
const category = ref<'All' | AttireCategory>('All')
const status = ref<'All' | AttireStatus>('All')
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
const downloadingSchedulePdf = ref(false)

// Calendar modal state per attire
const showCalendarModal = ref(false)
const calendarAttire = ref<WeddingAttire | null>(null)
const calendarYear = ref(2026)
const calendarMonth = ref(10)
const selectedCalendarDate = ref('')

// Blocked status alert (e.g. cannot set Available on event day) & H-1 Laundry alert
const showStatusAlert = ref(false)
const statusAlertBlocked = ref(false)
const pendingAlertAttire = ref<WeddingAttire | null>(null)
const pendingAlertTargetStatus = ref<AttireStatus>('Laundry')
const statusAlertConflicts = ref<AttireScheduleEntry[]>([])

// Floating success window after saving fitting form
const showSaveSuccessModal = ref(false)
const lastSavedSummary = ref('')

// Inline floating edit modal for Tab 3 (Saved Fitting Database)
const showEditFittingModal = ref(false)
const modalFormError = ref('')

// Date-range PDF report for attire schedule
const scheduleReportFrom = ref('')
const scheduleReportTo = ref('')

const downloadScheduleReport = async () => {
  downloadingSchedulePdf.value = true
  try {
    const { downloadWeddingAttireReportPdf } = await import('../utils/weddingPdf')
    await downloadWeddingAttireReportPdf({
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
  } finally {
    downloadingSchedulePdf.value = false
  }
}

const familyUniformFields = [
  ['ibuBesan', 'Mother & In-laws', 'Color / style / hijab option'],
  ['bapakBesan', 'Father & In-laws', 'Uniform details'],
  ['terimaTamu', 'Guest Greeters', 'Color / style / hijab option'],
] as const

const addonUniformFields = [
  ['melati', 'Fresh Jasmine', 'Jasmine floral details'],
  ['henna', 'Henna Art', 'Henna design details'],
  ['tambahan', 'Other Extras', 'Additional notes'],
] as const

const measurementGroups = [
  { key: 'bride', label: 'Bride', fields: ['LD', 'LPinggang', 'LPanggul', 'LLenganA', 'LLenganB', 'PLengan', 'Others adj', 'Shoes'] },
  { key: 'groom', label: 'Groom', fields: ['LD', 'LLengan', 'LPerut', 'PLengan', 'PCelana', 'LKepala', 'Others adj', 'Shoes'] },
  { key: 'ibu', label: 'Mother', fields: ['LD', 'LLengan', 'PLengan'] },
  { key: 'ayah', label: 'Father', fields: ['LD', 'PLengan', 'PCelana', 'LKepala', 'Slop'], required: ['LKepala', 'Slop'] },
  { key: 'kembarMayangCe', label: 'Kembar Mayang (F)', fields: ['LD', 'Slop'] },
  { key: 'kembarMayangCo', label: 'Kembar Mayang (M)', fields: ['LD', 'Slop'] },
  { key: 'terimaTamu', label: 'Guest Greeters', fields: ['List LD'] },
]

const softlensOptions = ['Normal', 'Plus', 'Astigmatism (Cylinder)'] as const

const vendorFields = [
  ['deco', 'Decoration'], ['doc', 'Documentation'], ['wcc', 'Wedding Cake / Catering'], ['mc', 'Master of Ceremony'], ['tenda', 'Tent & Stage'], ['seserahan', 'Seserahan'], ['wo', 'Wedding Organizer'],
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
const editModalForm = reactive<WeddingFittingForm>(blankForm())
const attireForm = reactive({ name: '', category: 'Bride' as AttireCategory, size: '', status: 'Tersedia' as AttireStatus, notes: '', imageUrl: '' })

const effectiveStatus = (item: WeddingAttire) => store.effectiveAttireStatus(item)

// Cached per-attire schedules so wardrobe cards don't recompute on every render pass
const scheduleMapByAttire = computed(() => {
  const map = new Map<string, { active: AttireScheduleEntry[]; all: AttireScheduleEntry[]; status: AttireStatus }>()
  for (const item of store.weddingAttire) {
    map.set(item.id, {
      active: store.attireSchedule(item.id),
      all: store.attireSchedule(item.id, { includePast: true }),
      status: effectiveStatus(item),
    })
  }
  return map
})

const attireSummaryCounts = computed(() => {
  let available = 0
  let booked = 0
  let inUse = 0
  let laundry = 0
  for (const item of store.weddingAttire) {
    const st = scheduleMapByAttire.value.get(item.id)?.status ?? effectiveStatus(item)
    if (st === 'Tersedia') available += 1
    else if (st === 'Booked') booked += 1
    else if (st === 'Terpakai') inUse += 1
    else laundry += 1
  }
  return { available, booked, inUse, laundry }
})

const filteredAttire = computed(() => store.weddingAttire.filter((item) => {
  const query = search.value.toLowerCase()
  const eff = scheduleMapByAttire.value.get(item.id)?.status ?? effectiveStatus(item)
  return (!query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query) || item.size.toLowerCase().includes(query))
    && (category.value === 'All' || item.category === category.value)
    && (status.value === 'All' || eff === status.value)
}))

// Hide POs that already have a saved fitting form unless currently editing that specific PO
const filledBookingIds = computed(() => new Set(store.weddingForms.map((f) => f.bookingId)))
const fittingBookingOptions = computed(() =>
  store.bookings.filter(
    (b) => b.status !== 'Dibatalkan' && (!filledBookingIds.value.has(b.id) || fittingForm.bookingId === b.id),
  ),
)

const brideCatalog = computed(() => store.weddingAttire.filter((item) => item.category === 'Bride'))
const groomCatalog = computed(() => store.weddingAttire.filter((item) => item.category === 'Groom'))
const selectedBooking = computed(() => store.bookingFor(fittingForm.bookingId))
const modalEditingBooking = computed(() => store.bookingFor(editModalForm.bookingId))
const savedFormForCurrentBooking = computed(() => store.weddingForms.find((form) => form.bookingId === fittingForm.bookingId))
const lastSavedForm = computed(() => store.weddingForms.find((form) => form.bookingId === lastSavedBookingId.value))
const selectedAttire = (id: string) => store.weddingAttire.find((item) => item.id === id)

const isAttireLockedForBooking = (item: WeddingAttire, targetBooking?: Booking) => {
  const eff = effectiveStatus(item)
  if (eff === 'Laundry') return true
  if (targetBooking?.eventDate) {
    return store.attireConflictsOnDate(item.id, targetBooking.eventDate, targetBooking.id).length > 0
  }
  return eff === 'Terpakai' || eff === 'Booked'
}

const buildAttireOptionsForBooking = (list: WeddingAttire[], targetBooking?: Booking): AttireSelectOption[] =>
  list.map((item) => {
    const eff = effectiveStatus(item)
    if (targetBooking?.eventDate) {
      const conflicts = store.attireConflictsOnDate(item.id, targetBooking.eventDate, targetBooking.id)
      if (conflicts.length) {
        return {
          item,
          statusKind: 'booked',
          statusLabel: `Booked (${conflicts[0]!.customerName}) · Locked`,
          locked: true,
        }
      }
    }
    if (eff === 'Laundry') {
      return {
        item,
        statusKind: 'laundry',
        statusLabel: 'Laundry · Locked',
        locked: true,
      }
    }
    if (eff === 'Terpakai' || eff === 'Booked') {
      if (targetBooking?.eventDate) {
        return {
          item,
          statusKind: 'available',
          statusLabel: 'Available on this date',
          locked: false,
        }
      }
      return {
        item,
        statusKind: 'booked',
        statusLabel: `${displayAttireStatus(eff)} · Locked`,
        locked: true,
      }
    }
    return {
      item,
      statusKind: 'available',
      statusLabel: 'Available',
      locked: false,
    }
  })

const brideAttireOptions = computed(() => buildAttireOptionsForBooking(brideCatalog.value, selectedBooking.value))
const groomAttireOptions = computed(() => buildAttireOptionsForBooking(groomCatalog.value, selectedBooking.value))
const modalBrideAttireOptions = computed(() => buildAttireOptionsForBooking(brideCatalog.value, modalEditingBooking.value))
const modalGroomAttireOptions = computed(() => buildAttireOptionsForBooking(groomCatalog.value, modalEditingBooking.value))

const attireSelectionAlert = (attireId: string, targetBooking: Booking | undefined = selectedBooking.value): string => {
  if (!attireId) return ''
  const item = selectedAttire(attireId)
  if (!item) return ''
  const warnings: string[] = []
  if (item.status === 'Laundry') {
    warnings.push('This attire is currently in Laundry / maintenance.')
  }
  if (targetBooking?.eventDate) {
    const conflicts = store.attireConflictsOnDate(attireId, targetBooking.eventDate, targetBooking.id)
    if (conflicts.length) {
      const c = conflicts[0]!
      warnings.push(`Schedule conflict! Already reserved by ${c.poNumber} (${c.customerName}) on ${formatDate(c.eventDate)}.`)
    }
  }
  return warnings.join(' ')
}

const buildNormalizedForm = (bookingId: string): WeddingFittingForm => {
  const base = blankForm(bookingId)
  const existing = store.weddingForms.find((item) => item.bookingId === bookingId)
  const raw = existing ? JSON.parse(JSON.stringify(existing)) as Partial<WeddingFittingForm> : {}

  const mergedMeasurements: Record<string, Record<string, string>> = {}
  for (const group of measurementGroups) {
    mergedMeasurements[group.key] = {
      ...(base.measurements[group.key] ?? {}),
      ...((raw.measurements && raw.measurements[group.key]) || {}),
    }
  }

  const rawEvents = Array.isArray(raw.events) && raw.events.length ? raw.events : [createBlankEvent(1)]
  const mergedEvents: WeddingEventDetail[] = rawEvents.map((ev, index) => ({
    ...createBlankEvent((index + 1) as 1 | 2 | 3),
    ...ev,
    number: (index + 1) as 1 | 2 | 3,
    timeNote: ev?.timeNote ?? '',
    bride: {
      look: ev?.bride?.look ?? '',
      accessories: ev?.bride?.accessories ?? '',
      shoes: ev?.bride?.shoes ?? '',
      attireId: ev?.bride?.attireId ?? '',
    },
    groom: {
      look: ev?.groom?.look ?? '',
      accessories: ev?.groom?.accessories ?? '',
      shoes: ev?.groom?.shoes ?? '',
      attireId: ev?.groom?.attireId ?? '',
    },
  }))

  return {
    id: raw.id || base.id,
    bookingId: raw.bookingId || bookingId,
    measurements: mergedMeasurements,
    events: mergedEvents,
    uniforms: { ...base.uniforms, ...(raw.uniforms ?? {}) },
    manggoloBlangkon: raw.manggoloBlangkon === undefined ? null : raw.manggoloBlangkon,
    manggoloSlop: raw.manggoloSlop === undefined ? null : raw.manggoloSlop,
    vendors: { ...base.vendors, ...(raw.vendors ?? {}) },
    updatedAt: raw.updatedAt ?? '',
  }
}

const loadBookingIntoForm = (bookingId: string) => {
  formError.value = ''
  Object.assign(fittingForm, buildNormalizedForm(bookingId))
}

watch(() => fittingForm.bookingId, (bookingId, prevId) => {
  if (!bookingId && !prevId) return
  if (bookingId) {
    saveMessage.value = ''
    loadBookingIntoForm(bookingId)
  }
})

// Keep user on Tab 3 (Saved Fitting Database) and edit in a floating popup modal
const editSavedFitting = (bookingId: string) => {
  modalFormError.value = ''
  Object.assign(editModalForm, buildNormalizedForm(bookingId))
  showEditFittingModal.value = true
}

const addEventSectionTo = (target: WeddingFittingForm) => {
  if (target.events.length >= 3) return
  const nextNum = (target.events.length + 1) as 1 | 2 | 3
  target.events.push(createBlankEvent(nextNum))
}

const removeEventSectionFrom = (target: WeddingFittingForm, index: number) => {
  if (index === 0 || target.events.length <= 1) return
  target.events.splice(index, 1)
  target.events.forEach((ev, idx) => {
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
    uploadError.value = error instanceof Error ? error.message : 'Failed to process photo.'
  } finally {
    uploading.value = false
    inputEl.value = ''
  }
}

const submitAttire = () => {
  uploadError.value = ''
  if (!attireForm.name.trim() || !attireForm.size.trim()) {
    uploadError.value = 'Attire name and size are required.'
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
  const today = localTodayIso()
  const resetSelectToStored = () => {
    if (event?.target) {
      (event.target as HTMLSelectElement).value = item.status === 'Laundry' ? 'Laundry' : 'Tersedia'
    }
  }
  // Strict Rule: Switching to Available is BLOCKED if there is a non-cancelled event TODAY using this attire
  if (nextStatus === 'Tersedia') {
    const todayEvents = store.attireConflictsOnDate(item.id, today)
    if (todayEvents.length > 0) {
      resetSelectToStored()
      statusAlertBlocked.value = true
      statusAlertConflicts.value = todayEvents
      pendingAlertAttire.value = item
      pendingAlertTargetStatus.value = nextStatus
      showStatusAlert.value = true
      return
    }
  }

  const urgentSchedule = store.urgentAttireSchedules(item.id)
  if (nextStatus === 'Laundry' && urgentSchedule.length > 0) {
    resetSelectToStored()
    statusAlertBlocked.value = false
    statusAlertConflicts.value = urgentSchedule
    pendingAlertAttire.value = item
    pendingAlertTargetStatus.value = nextStatus
    showStatusAlert.value = true
    return
  }
  store.updateWeddingAttireStatus(item.id, nextStatus)
}

const confirmStatusAlertOverride = () => {
  if (!statusAlertBlocked.value && pendingAlertAttire.value) {
    store.updateWeddingAttireStatus(pendingAlertAttire.value.id, pendingAlertTargetStatus.value)
  }
  pendingAlertAttire.value = null
  statusAlertConflicts.value = []
  showStatusAlert.value = false
}

const cancelStatusAlertOverride = () => {
  pendingAlertAttire.value = null
  statusAlertConflicts.value = []
  showStatusAlert.value = false
}

const localTodayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const calendarEntryStatus = (entry: AttireScheduleEntry): 'Cancelled' | 'Completed' | 'In Use' | 'Booked' => {
  if (entry.bookingStatus === 'Dibatalkan') return 'Cancelled'
  const today = localTodayIso()
  if (entry.eventDate < today) return 'Completed'
  if (entry.eventDate === today) return 'In Use'
  return 'Booked'
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
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(calendarYear.value, calendarMonth.value, 1)),
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

const validateFittingTarget = (
  target: WeddingFittingForm,
  targetBooking: Booking | undefined,
  opts: { scrollOnMeasurementError?: boolean; isEditModal?: boolean } = {},
): string | null => {
  if (!target.bookingId) return 'Please select a PO Number before saving the fitting form.'
  const existingForm = opts.isEditModal
    ? store.weddingForms.find((f) => f.bookingId === target.bookingId)
    : undefined

  for (let i = 0; i < target.events.length; i += 1) {
    const ev = target.events[i]!
    const prevEv = existingForm?.events?.[i]
    for (const [roleKey, roleLabel, id] of [['bride', 'Bride', ev.bride.attireId], ['groom', 'Groom', ev.groom.attireId]] as const) {
      if (!id) continue
      const item = selectedAttire(id)
      const prevId = roleKey === 'bride' ? prevEv?.bride?.attireId : prevEv?.groom?.attireId
      const unchangedInEdit = opts.isEditModal && prevId === id
      if (item && !unchangedInEdit && isAttireLockedForBooking(item, targetBooking)) {
        return `${roleLabel} attire "${item.name}" in Session ${ev.number} is currently ${displayAttireStatus(effectiveStatus(item))} and locked for this schedule.`
      }
      if (item && unchangedInEdit && targetBooking?.eventDate && store.attireConflictsOnDate(item.id, targetBooking.eventDate, targetBooking.id).length > 0) {
        return `${roleLabel} attire "${item.name}" in Session ${ev.number} has a schedule conflict on ${formatDate(targetBooking.eventDate)}.`
      }
    }
  }
  if (!opts.isEditModal) {
    for (const group of measurementGroups) {
      for (const required of group.required ?? []) {
        if (!target.measurements[group.key]?.[required]?.trim()) {
          if (opts.scrollOnMeasurementError) {
            document.getElementById('size-chart')?.scrollIntoView({ behavior: 'smooth' })
          }
          return `${required} in ${group.label} section is required.`
        }
      }
    }
  }
  target.manggoloBlangkon = target.manggoloBlangkon === null || (target.manggoloBlangkon as unknown) === ''
    ? null
    : Math.max(0, Number(target.manggoloBlangkon))
  target.manggoloSlop = target.manggoloSlop === null || (target.manggoloSlop as unknown) === ''
    ? null
    : Math.max(0, Number(target.manggoloSlop))
  return null
}

const saveForm = () => {
  formError.value = ''
  saveMessage.value = ''
  const err = validateFittingTarget(fittingForm, selectedBooking.value, { scrollOnMeasurementError: true })
  if (err) {
    formError.value = err
    return
  }

  const savedPo = selectedBooking.value?.poNumber ?? 'PO'
  const savedCustomerName = selectedBooking.value ? (store.customerFor(selectedBooking.value.customerId)?.name ?? '') : ''
  const savedBookingId = fittingForm.bookingId
  store.saveWeddingForm(JSON.parse(JSON.stringify(fittingForm)) as WeddingFittingForm)
  lastSavedBookingId.value = savedBookingId
  lastSavedSummary.value = `${savedPo}${savedCustomerName ? ` — ${savedCustomerName}` : ''}`
  saveMessage.value = `Fitting form for ${savedPo} saved to Fitting Database. The form has been reset for your next entry.`

  Object.assign(fittingForm, blankForm(''))
  showSaveSuccessModal.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const saveEditModalForm = () => {
  modalFormError.value = ''
  const err = validateFittingTarget(editModalForm, modalEditingBooking.value, { isEditModal: true })
  if (err) {
    modalFormError.value = err
    return
  }
  store.saveWeddingForm(JSON.parse(JSON.stringify(editModalForm)) as WeddingFittingForm)
  lastSavedBookingId.value = editModalForm.bookingId
  showEditFittingModal.value = false
}

const downloadSavedPdf = async (targetForm?: WeddingFittingForm) => {
  formError.value = ''
  const formToExport = targetForm ?? savedFormForCurrentBooking.value ?? lastSavedForm.value
  const booking = formToExport ? store.bookingFor(formToExport.bookingId) : undefined
  if (!formToExport || !booking) {
    formError.value = 'Please save the fitting form before downloading the PDF.'
    return
  }
  downloadingPdf.value = true
  try {
    const { generateWeddingFittingPdf } = await import('../utils/weddingPdf')
    await generateWeddingFittingPdf({
      form: formToExport,
      booking,
      attireList: store.weddingAttire,
      businessProfile: store.businessProfile,
    })
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Failed to generate PDF.'
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
      <div><span class="eyebrow">Workspace</span><h2>Wedding Wardrobe Portal</h2><p>Manage bridal attire inventory, client fitting forms, and saved wardrobe allocation schedules separately.</p></div>
      <div class="heading-actions">
        <button class="primary-button" @click="openCreateAttire"><Plus :size="18" />Add Attire</button>
      </div>
    </section>

    <div v-if="store.laundryUrgentAlerts.length" class="urgent-laundry-banner">
      <AlertTriangle :size="20" />
      <div class="urgent-laundry-list">
        <strong>Urgent Wardrobe Preparation Alert (H-1 / Event Day)</strong>
        <div v-for="alert in store.laundryUrgentAlerts" :key="`${alert.attireId}-${alert.bookingId}`" class="urgent-laundry-item">
          <span>{{ alert.message }}</span>
          <button
            type="button"
            class="soft-button urgent-ready-btn"
            @click="store.updateWeddingAttireStatus(alert.attireId, 'Tersedia')"
          >
            Mark Laundry Complete
          </button>
        </div>
      </div>
    </div>

    <section class="portal-tabs-bar">
      <div class="segmented-tabs">
        <button :class="{ active: portalTab === 'inventory' }" @click="portalTab = 'inventory'">
          1. Wardrobe Inventory &amp; Calendar ({{ store.weddingAttire.length }})
        </button>
        <button :class="{ active: portalTab === 'form' }" @click="portalTab = 'form'">
          2. Fitting Form Entry
        </button>
        <button :class="{ active: portalTab === 'database' }" @click="portalTab = 'database'">
          3. Saved Fitting Database ({{ store.weddingForms.length }})
        </button>
      </div>
    </section>

    <!-- TAB 1: WARDROBE INVENTORY -->
    <section v-if="portalTab === 'inventory'" class="panel attire-catalog-panel">
      <header class="wedding-section-head">
        <div>
          <span class="section-number">01</span>
          <div>
            <span class="eyebrow">Wardrobe inventory &amp; schedule</span>
            <h3>Bride &amp; Groom Attire</h3>
            <p>Shows <strong>Booked</strong> ahead of the event date, automatically switches to <strong>In Use</strong> on Event Day (Hari-H), and returns to <strong>Available</strong> once the event passes.</p>
          </div>
        </div>
        <div class="attire-summary">
          <span><i class="dot-available" />{{ attireSummaryCounts.available }} Available</span>
          <span><i class="dot-booked" />{{ attireSummaryCounts.booked }} Booked</span>
          <span><i class="dot-booked" style="background:#d97706" />{{ attireSummaryCounts.inUse }} In Use</span>
          <span><i class="dot-laundry" />{{ attireSummaryCounts.laundry }} Laundry</span>
        </div>
      </header>

      <div class="attire-toolbar">
        <label class="table-search"><Search :size="17" /><input v-model="search" placeholder="Search attire name, code, or size" /></label>
        <div class="filter-row">
          <select v-model="category"><option value="All">All Categories</option><option>Bride</option><option>Groom</option></select>
          <select v-model="status">
            <option value="All">All Statuses</option>
            <option value="Tersedia">Available</option>
            <option value="Booked">Booked (Upcoming)</option>
            <option value="Terpakai">In Use (Event Day)</option>
            <option value="Laundry">Laundry</option>
          </select>
        </div>
      </div>

      <div class="attire-report-bar">
        <div class="attire-report-info">
          <Download :size="18" />
          <div>
            <strong>Wardrobe Allocation Schedule Report (PDF)</strong>
            <span>Export client wardrobe usage with real attire photos from Start Date to End Date.</span>
          </div>
        </div>
        <div class="attire-report-controls">
          <label>
            <span>From Date</span>
            <input v-model="scheduleReportFrom" type="date" aria-label="Schedule from date" />
          </label>
          <label>
            <span>To Date</span>
            <input v-model="scheduleReportTo" type="date" aria-label="Schedule to date" />
          </label>
          <button
            v-if="scheduleReportFrom || scheduleReportTo"
            type="button"
            class="soft-button"
            title="Clear date filter"
            @click="scheduleReportFrom = ''; scheduleReportTo = ''"
          >
            <RotateCcw :size="14" />Reset
          </button>
          <button type="button" class="primary-button" :disabled="downloadingSchedulePdf" @click="downloadScheduleReport">
            <Download :size="16" />{{ downloadingSchedulePdf ? 'Generating PDF…' : 'Download PDF Report' }}
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
              <StatusBadge :label="displayAttireStatus(scheduleMapByAttire.get(item.id)?.status ?? effectiveStatus(item))" />
            </div>
            <div class="attire-title-row">
              <h4>{{ item.name }}</h4>
              <button type="button" class="icon-button attire-edit-btn" title="Edit attire / photo" @click="openEditAttire(item)">
                <Pencil :size="14" />
              </button>
            </div>
            <p>{{ item.category }} · Size <strong>{{ item.size }}</strong></p>

            <div class="attire-schedule-box">
              <button type="button" class="soft-button attire-calendar-btn" @click="openAttireCalendar(item)">
                <CalendarDays :size="14" />Calendar ({{ (scheduleMapByAttire.get(item.id)?.all ?? []).length }})
              </button>
            </div>

            <div v-if="item.status === 'Laundry' && (scheduleMapByAttire.get(item.id)?.active ?? []).length" class="attire-laundry-warning">
              <AlertTriangle :size="13" />
              <span>In Laundry ({{ (scheduleMapByAttire.get(item.id)?.active ?? []).length }} upcoming)</span>
            </div>

            <select
              :value="item.status === 'Laundry' ? 'Laundry' : 'Tersedia'"
              aria-label="Wardrobe status"
              @change="onAttireStatusSelect(item, ($event.target as HTMLSelectElement).value as AttireStatus, $event)"
            >
              <option value="Tersedia">Available</option>
              <option value="Laundry">Laundry</option>
            </select>
          </div>
        </article>
        <button class="attire-add-card" @click="openCreateAttire"><Plus :size="25" /><strong>Add New Attire</strong><span>Upload wardrobe photo and size</span></button>
      </div>
    </section>

    <!-- TAB 2: FITTING FORM ENTRY -->
    <template v-else-if="portalTab === 'form'">
      <div v-if="saveMessage" class="fitting-saved-banner">
        <div class="fitting-saved-copy">
          <CheckCircle2 :size="20" />
          <div>
            <strong>{{ saveMessage }}</strong>
            <span>You can download the saved fitting PDF or inspect all submissions in Tab 3 (Saved Fitting Database).</span>
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
            View Saved Forms
          </button>
        </div>
      </div>

      <section id="booking-context" class="booking-context panel">
        <div class="booking-context-icon"><CalendarHeart :size="23" /></div>
        <div>
          <span class="eyebrow">Fitting Form Entry</span>
          <h3>Select a PO booking to complete</h3>
          <p v-if="selectedBooking">
            Event: <strong>{{ formatDate(selectedBooking.eventDate) }}</strong> · Venue: <strong>{{ selectedBooking.location }}</strong>
          </p>
          <p v-else>Only POs without an existing fitting record are listed here. Saved POs are managed under Saved Fitting Database.</p>
        </div>
        <label>
          <span>PO Number / Customer ({{ fittingBookingOptions.length }} pending)</span>
          <select v-model="fittingForm.bookingId">
            <option value="">Select PO booking</option>
            <option v-for="booking in fittingBookingOptions" :key="booking.id" :value="booking.id">
              {{ booking.poNumber }} — {{ store.customerFor(booking.customerId)?.name }} — {{ formatDate(booking.eventDate) }}
            </option>
          </select>
        </label>
      </section>

      <section id="size-chart" class="panel fitting-panel">
        <header class="wedding-section-head"><div><span class="section-number">02</span><div><span class="eyebrow">Size chart</span><h3>Body Measurements <small>cm</small></h3><p>Enter measurements recorded during fitting. Fields marked * are required.</p></div></div><Ruler :size="23" /></header>
        <div class="measurement-grid">
          <article v-for="group in measurementGroups" :key="group.key" class="measurement-card">
            <h4>{{ group.label }}</h4>
            <div><label v-for="field in group.fields" :key="field"><span>{{ field }}<b v-if="group.required?.includes(field)">*</b></span><input v-model="fittingForm.measurements[group.key]![field]" :placeholder="field === 'Shoes' || field === 'Slop' ? 'Size' : '0'" /></label></div>
          </article>
        </div>
      </section>

      <section class="panel event-details-panel">
        <header class="wedding-section-head">
          <div>
            <span class="section-number">03</span>
            <div>
              <span class="eyebrow">Sessions &amp; wardrobe</span>
              <h3>Event Sessions &amp; Attire Selection</h3>
              <p>Assign Bride &amp; Groom wardrobe pieces directly from the catalog per wedding session.</p>
            </div>
          </div>
        </header>
        <div class="event-detail-list">
          <article v-for="(event, index) in fittingForm.events" :key="event.number" class="event-detail-card">
            <header>
              <div class="event-card-title">
                <span>Session {{ event.number }}</span>
                <strong>{{ event.name || 'Untitled session' }}</strong>
              </div>
              <button
                v-if="index > 0"
                type="button"
                class="event-remove-button"
                title="Remove this session"
                @click="removeEventSectionFrom(fittingForm, index)"
              >
                <Trash2 :size="14" />Remove Session {{ event.number }}
              </button>
            </header>

            <div class="event-basic-fields event-basic-fields--three">
              <label>
                <span>Session Name</span>
                <input v-model="event.name" placeholder="e.g. Akad Nikah / Reception / Ngunduh Mantu" />
              </label>
              <label>
                <span>Ready Time</span>
                <input v-model="event.readyTime" type="time" />
              </label>
              <label>
                <span>Time Note</span>
                <input v-model="event.timeNote" type="text" placeholder="e.g. Ready 04:00 AM / Morning" />
              </label>
            </div>

            <div class="couple-detail-grid">
              <section class="couple-detail-card">
                <h4>Bride</h4>
                <div class="couple-span-2">
                  <span class="attire-field-label">Select Bride Attire (Catalog)</span>
                  <AttireSelect
                    v-model="event.bride.attireId"
                    :options="brideAttireOptions"
                    placeholder="Select Bride attire from catalog"
                  />
                </div>

                <div class="selected-outfit couple-span-2" :class="{ empty: !event.bride.attireId }">
                  <button
                    v-if="selectedAttire(event.bride.attireId)?.imageUrl"
                    type="button"
                    class="selected-outfit-thumb"
                    title="Zoom attire photo"
                    @click="openZoom(selectedAttire(event.bride.attireId)!)"
                  >
                    <img :src="selectedAttire(event.bride.attireId)?.imageUrl" :alt="selectedAttire(event.bride.attireId)?.name" loading="lazy" decoding="async" />
                  </button>
                  <span v-else class="selected-outfit-placeholder"><Shirt :size="20" /></span>
                  <div>
                    <strong>{{ selectedAttire(event.bride.attireId)?.name ?? 'No attire selected' }}</strong>
                    <small>{{ selectedAttire(event.bride.attireId) ? `${selectedAttire(event.bride.attireId)?.code} · Size ${selectedAttire(event.bride.attireId)?.size}` : 'Attire name and preview photo appear automatically once selected' }}</small>
                  </div>
                </div>

                <div v-if="attireSelectionAlert(event.bride.attireId)" class="attire-inline-alert couple-span-2">
                  <AlertTriangle :size="14" />
                  <span>{{ attireSelectionAlert(event.bride.attireId) }}</span>
                </div>

                <label><span>Look</span><input v-model="event.bride.look" placeholder="Makeup look details" /></label>
                <label><span>Accessories</span><input v-model="event.bride.accessories" placeholder="Accessories" /></label>
                <label class="couple-span-2"><span>Footwear</span><input v-model="event.bride.shoes" placeholder="Shoes / heels" /></label>
              </section>

              <section class="couple-detail-card">
                <h4>Groom</h4>
                <div class="couple-span-2">
                  <span class="attire-field-label">Select Groom Attire (Catalog)</span>
                  <AttireSelect
                    v-model="event.groom.attireId"
                    :options="groomAttireOptions"
                    placeholder="Select Groom attire from catalog"
                  />
                </div>

                <div class="selected-outfit couple-span-2" :class="{ empty: !event.groom.attireId }">
                  <button
                    v-if="selectedAttire(event.groom.attireId)?.imageUrl"
                    type="button"
                    class="selected-outfit-thumb"
                    title="Zoom attire photo"
                    @click="openZoom(selectedAttire(event.groom.attireId)!)"
                  >
                    <img :src="selectedAttire(event.groom.attireId)?.imageUrl" :alt="selectedAttire(event.groom.attireId)?.name" loading="lazy" decoding="async" />
                  </button>
                  <span v-else class="selected-outfit-placeholder"><Shirt :size="20" /></span>
                  <div>
                    <strong>{{ selectedAttire(event.groom.attireId)?.name ?? 'No attire selected' }}</strong>
                    <small>{{ selectedAttire(event.groom.attireId) ? `${selectedAttire(event.groom.attireId)?.code} · Size ${selectedAttire(event.groom.attireId)?.size}` : 'Attire name and preview photo appear automatically once selected' }}</small>
                  </div>
                </div>

                <div v-if="attireSelectionAlert(event.groom.attireId)" class="attire-inline-alert couple-span-2">
                  <AlertTriangle :size="14" />
                  <span>{{ attireSelectionAlert(event.groom.attireId) }}</span>
                </div>

                <label><span>Look</span><input v-model="event.groom.look" placeholder="Groom styling details" /></label>
                <label><span>Accessories</span><input v-model="event.groom.accessories" placeholder="Blangkon / keris / pins" /></label>
                <label class="couple-span-2"><span>Footwear</span><input v-model="event.groom.shoes" placeholder="Shoes / slop" /></label>
              </section>
            </div>
          </article>

          <div v-if="fittingForm.events.length < 3" class="add-event-row">
            <button type="button" class="outline-button add-event-button" @click="addEventSectionTo(fittingForm)">
              <Plus :size="16" />+ Add Session
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
                <span class="eyebrow">Family &amp; extras</span>
                <h3>Uniforms &amp; Details</h3>
                <p>Domas, Manggolo, Softlens, family attire, and add-on floral/henna requests.</p>
              </div>
            </div>
            <UsersRound :size="21" />
          </header>

          <div class="uniform-sections">
            <div class="uniform-group-box">
              <h4>Domas Group</h4>
              <div class="uniform-group-fields">
                <label>
                  <span>Domas Uniform &amp; Details</span>
                  <input v-model="fittingForm.uniforms.domas" placeholder="Color / style / hijab option" />
                </label>
              </div>
            </div>

            <div class="uniform-group-box">
              <h4>Manggolo Group</h4>
              <div class="uniform-group-fields uniform-group-fields--manggolo">
                <label class="uniform-span-2">
                  <span>Manggolo Uniform &amp; Details</span>
                  <input v-model="fittingForm.uniforms.manggolo" placeholder="Manggolo uniform details" />
                </label>
                <label>
                  <span>Blangkon Qty</span>
                  <input v-model.number="fittingForm.manggoloBlangkon" type="number" min="0" placeholder="0" />
                </label>
                <label>
                  <span>Slippers Qty</span>
                  <input v-model.number="fittingForm.manggoloSlop" type="number" min="0" placeholder="0" />
                </label>
              </div>
            </div>

            <div class="uniform-group-box">
              <h4>Family &amp; Guest Greeters</h4>
              <div class="uniform-group-fields uniform-group-fields--two">
                <label v-for="([key, label, placeholder]) in familyUniformFields" :key="key">
                  <span>{{ label }}</span>
                  <input v-model="fittingForm.uniforms[key]" :placeholder="placeholder" />
                </label>
              </div>
            </div>

            <div class="uniform-group-box">
              <h4>Contact Lenses &amp; Extras</h4>
              <div class="uniform-group-fields uniform-group-fields--two">
                <label>
                  <span>Contact Lenses</span>
                  <select v-model="fittingForm.uniforms.softlens">
                    <option value="">Select lens type</option>
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
                <span class="eyebrow">Vendor directory</span>
                <h3>Partner Wedding Vendors</h3>
                <p>Track all supporting vendors for this wedding day.</p>
              </div>
            </div>
            <Store :size="21" />
          </header>
          <div class="mini-field-grid">
            <label v-for="([key, label]) in vendorFields" :key="key">
              <span>{{ label }}</span>
              <input v-model="fittingForm.vendors[key]" placeholder="Vendor name / contact / notes" />
            </label>
          </div>
        </section>
      </div>

      <section class="wedding-save-bar">
        <div>
          <strong>{{ selectedBooking ? `${selectedBooking.poNumber} · ${store.customerFor(selectedBooking.customerId)?.name}` : 'No PO booking selected yet' }}</strong>
          <span>Saves to Fitting Database and clears the form for your next entry.</span>
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
            <Download :size="17" />{{ downloadingPdf ? 'Generating PDF…' : 'Download PDF' }}
          </button>
          <button class="primary-button" @click="saveForm"><Save :size="17" />Save Fitting Form</button>
        </div>
      </section>
    </template>

    <!-- TAB 3: SAVED FITTING DATABASE -->
    <section v-else class="panel fitting-db-panel">
      <header class="wedding-section-head">
        <div>
          <span class="section-number">DB</span>
          <div>
            <span class="eyebrow">Saved fitting records</span>
            <h3>Customer Fitting Form Database</h3>
            <p>Edit existing submissions or download high-resolution fitting PDFs with attire photos.</p>
          </div>
        </div>
        <button type="button" class="primary-button" @click="portalTab = 'form'">
          <Plus :size="17" />Fill New Fitting Form
        </button>
      </header>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Customer</th>
              <th>Event Date &amp; Venue</th>
              <th>Sessions &amp; Assigned Wardrobe</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in fittingList"
              :key="row.form.id"
              class="order-row-selectable"
              @click="editSavedFitting(row.form.bookingId)"
            >
              <td><strong class="mono-code">{{ row.booking?.poNumber ?? '-' }}</strong></td>
              <td>
                <strong>{{ row.customer?.name ?? '-' }}</strong>
                <span v-if="row.booking?.status === 'Dibatalkan'" class="subtle-line">Status: Cancelled</span>
              </td>
              <td>
                <strong>{{ row.booking?.eventDate ? formatDate(row.booking.eventDate) : '-' }}</strong>
                <span class="subtle-line">{{ row.booking?.location ?? '-' }}</span>
              </td>
              <td>
                <div class="fitting-attire-pills">
                  <span v-for="ev in row.form.events" :key="ev.number" class="item-pill">
                    Session {{ ev.number }}:
                    {{ selectedAttire(ev.bride.attireId)?.name || '—' }} / {{ selectedAttire(ev.groom.attireId)?.name || '—' }}
                  </span>
                </div>
              </td>
              <td>{{ row.form.updatedAt ? formatDate(row.form.updatedAt.slice(0, 10)) : '-' }}</td>
              <td>
                <div class="row-actions" @click.stop>
                  <button type="button" class="icon-button" title="Edit fitting form" @click="editSavedFitting(row.form.bookingId)">
                    <Pencil :size="15" />
                  </button>
                  <button type="button" class="icon-button" title="Download Fitting PDF" @click="downloadSavedPdf(row.form)">
                    <Download :size="15" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!fittingList.length">
              <td colspan="6">
                <div class="empty-state">
                  <ClipboardList :size="26" />
                  <strong>No fitting forms saved yet</strong>
                  <span>Open Tab "2. Fitting Form Entry" to complete a customer's fitting details.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <UiModal :open="showAttireForm" :title="editingAttireId ? 'Edit Attire' : 'Add New Attire'" description="Complete wardrobe details and upload photo for catalog and PDF reports." wide @close="showAttireForm = false">
      <form class="form-grid" @submit.prevent="submitAttire">
        <label><span>Attire Name *</span><input v-model="attireForm.name" placeholder="e.g. Kebaya Sekar Arum Putih" /></label>
        <label><span>Category *</span><select v-model="attireForm.category"><option>Bride</option><option>Groom</option></select></label>
        <label><span>Size *</span><input v-model="attireForm.size" placeholder="S / M / L / Custom" /></label>
        <label>
          <span>Manual Status *</span>
          <select v-model="attireForm.status">
            <option value="Tersedia">Available</option>
            <option value="Laundry">Laundry</option>
          </select>
        </label>
        <label class="span-2"><span>Notes</span><textarea v-model="attireForm.notes" rows="2" placeholder="Color, fabric, full set accessories, or condition notes" /></label>
        <div class="span-2 attire-upload-block">
          <span class="upload-field-label">Attire Photo</span>
          <label class="upload-zone">
            <img v-if="imagePreview" :src="imagePreview" alt="Attire preview" />
            <div v-else><UploadCloud :size="25" /><strong>Click to choose JPG, PNG, or WebP photo</strong><span>Max 5 MB (rendered inside PDF reports)</span></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleAttirePhoto" />
          </label>
          <button v-if="imagePreview" type="button" class="soft-button remove-photo-btn" @click="imagePreview = ''; attireForm.imageUrl = ''">
            Remove photo
          </button>
        </div>
        <p v-if="uploading" class="upload-state span-2"><LoaderCircle class="spin" :size="16" />Processing image…</p>
        <p v-if="uploadError" class="form-error span-2">{{ uploadError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showAttireForm = false">Cancel</button>
          <button class="primary-button" :disabled="uploading">{{ editingAttireId ? 'Save Changes' : 'Save Attire' }}</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showZoom" title="Attire Details" @close="showZoom = false">
      <div v-if="zoomedAttire" class="attire-zoom"><div :class="`attire-${zoomedAttire.category.toLowerCase()}`"><img v-if="zoomedAttire.imageUrl" :src="zoomedAttire.imageUrl" :alt="zoomedAttire.name" /><ImageIcon v-else :size="48" /></div><h3>{{ zoomedAttire.name }}</h3><p>{{ zoomedAttire.code }} · {{ zoomedAttire.category }} · Size {{ zoomedAttire.size }}</p><StatusBadge :label="displayAttireStatus(effectiveStatus(zoomedAttire))" /><span>{{ zoomedAttire.notes || 'No wardrobe notes yet.' }}</span></div>
    </UiModal>

    <UiModal :open="showCalendarModal" :title="calendarAttire ? `Attire Calendar — ${calendarAttire.name}` : 'Attire Calendar'" description="Reserved dates are synced automatically from the Fitting Database by customer event date." wide @close="showCalendarModal = false">
      <div v-if="calendarAttire" class="attire-calendar-modal">
        <div class="attire-calendar-nav">
          <button type="button" class="icon-button" @click="shiftCalendarMonth(-1)"><ChevronLeft :size="16" /></button>
          <strong>{{ calendarMonthLabel }}</strong>
          <button type="button" class="icon-button" @click="shiftCalendarMonth(1)"><ChevronRight :size="16" /></button>
        </div>
        <div class="attire-calendar-weekdays">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
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
            {{ selectedCalendarDate ? `Schedule on ${formatDate(selectedCalendarDate)}` : 'All Scheduled Events for This Attire' }}
          </h4>
          <div v-if="selectedDateBookings.length" class="calendar-event-list">
            <article v-for="entry in selectedDateBookings" :key="`${entry.bookingId}-${entry.eventNumber}`" class="calendar-event-item">
              <div>
                <strong class="mono-code">{{ entry.poNumber }}</strong> · <strong>{{ entry.customerName }}</strong>
                <span>{{ formatDate(entry.eventDate) }} · {{ entry.eventLocation }}</span>
              </div>
              <div class="calendar-event-badges">
                <span class="item-pill">{{ entry.eventName }} ({{ entry.role }})</span>
                <span class="calendar-status-pill" :class="`is-${calendarEntryStatus(entry).toLowerCase().replace(/\s+/g, '-')}`">
                  {{ calendarEntryStatus(entry) }}
                </span>
              </div>
            </article>
          </div>
          <p v-else class="calendar-empty-note">This attire has no reservations in the Fitting Database yet.</p>
        </div>
      </div>
      <div class="modal-actions"><button class="primary-button" @click="showCalendarModal = false">Close</button></div>
    </UiModal>

    <UiModal
      :open="showStatusAlert"
      :title="statusAlertBlocked ? 'Cannot Change Status to Available — Scheduled Today' : 'Urgent Schedule Warning (H-1 / Event Day)'"
      :description="statusAlertBlocked ? 'This attire is currently assigned to an event taking place today based on the event date.' : 'This attire is scheduled for today or tomorrow (H-1) in the Fitting Database.'"
      @close="cancelStatusAlertOverride"
    >
      <div v-if="pendingAlertAttire" class="laundry-alert-body">
        <div class="laundry-alert-banner">
          <AlertTriangle :size="20" />
          <div>
            <strong v-if="statusAlertBlocked">{{ pendingAlertAttire.name }} is booked for an event today and cannot be switched to Available!</strong>
            <strong v-else>{{ pendingAlertAttire.name }} is needed today or tomorrow (H-1)!</strong>
            <p v-if="statusAlertBlocked">
              Status changes to <b>Available</b> are locked while an active booking exists on today's date:
            </p>
            <p v-else>
              If you switch status to <b>Laundry</b>, make sure it is cleaned and ready in time for:
            </p>
          </div>
        </div>
        <ul class="laundry-conflict-list">
          <li v-for="entry in statusAlertConflicts" :key="`${entry.bookingId}-${entry.eventNumber}`">
            <strong>{{ formatDate(entry.eventDate) }}</strong> — {{ entry.customerName }} ({{ entry.poNumber }}) · {{ entry.eventName }}
          </li>
        </ul>
      </div>
      <div class="modal-actions">
        <button type="button" :class="statusAlertBlocked ? 'primary-button' : 'secondary-button'" @click="cancelStatusAlertOverride">
          {{ statusAlertBlocked ? 'Understood' : 'Cancel' }}
        </button>
        <button v-if="!statusAlertBlocked" type="button" class="danger-button" @click="confirmStatusAlertOverride">
          Set to Laundry Anyway
        </button>
      </div>
    </UiModal>

    <UiModal :open="showSaveSuccessModal" title="Fitting Form Saved Successfully" description="Fitting record has been saved to Fitting Database and the form has been cleared." @close="showSaveSuccessModal = false">
      <div class="save-success-modal-body">
        <div class="save-success-icon"><CheckCircle2 :size="30" /></div>
        <strong>{{ lastSavedSummary || 'Fitting Form Saved' }}</strong>
        <p>You can immediately download the fitting form PDF, view all saved forms, or continue filling another PO.</p>
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
          View Saved List
        </button>
        <button type="button" class="primary-button" @click="showSaveSuccessModal = false">
          OK, New Entry
        </button>
      </div>
    </UiModal>

    <UiModal
      :open="showEditFittingModal"
      :title="modalEditingBooking ? `Edit Fitting Form — ${modalEditingBooking.poNumber}` : 'Edit Fitting Form'"
      :description="modalEditingBooking ? `${store.customerFor(modalEditingBooking.customerId)?.name ?? '-'} · Event: ${formatDate(modalEditingBooking.eventDate)} · ${modalEditingBooking.location}` : 'Update saved fitting measurements, sessions, uniforms, and vendors.'"
      wide
      @close="showEditFittingModal = false"
    >
      <div class="fitting-modal-body">
        <div class="fitting-modal-section">
          <div class="fitting-modal-section-head">
            <Ruler :size="17" />
            <strong>Body Measurements (cm)</strong>
          </div>
          <div class="measurement-grid">
            <article v-for="group in measurementGroups" :key="group.key" class="measurement-card">
              <h4>{{ group.label }}</h4>
              <div>
                <label v-for="field in group.fields" :key="field">
                  <span>{{ field }}<b v-if="group.required?.includes(field)">*</b></span>
                  <input v-model="editModalForm.measurements[group.key]![field]" :placeholder="field === 'Shoes' || field === 'Slop' ? 'Size' : '0'" />
                </label>
              </div>
            </article>
          </div>
        </div>

        <div class="fitting-modal-section">
          <div class="fitting-modal-section-head">
            <Shirt :size="17" />
            <strong>Event Sessions &amp; Attire Selection</strong>
          </div>
          <div class="event-detail-list">
            <article v-for="(event, index) in editModalForm.events" :key="event.number" class="event-detail-card">
              <header>
                <div class="event-card-title">
                  <span>Session {{ event.number }}</span>
                  <strong>{{ event.name || 'Untitled session' }}</strong>
                </div>
                <button
                  v-if="index > 0"
                  type="button"
                  class="event-remove-button"
                  title="Remove this session"
                  @click="removeEventSectionFrom(editModalForm, index)"
                >
                  <Trash2 :size="14" />Remove Session {{ event.number }}
                </button>
              </header>

              <div class="event-basic-fields event-basic-fields--three">
                <label>
                  <span>Session Name</span>
                  <input v-model="event.name" placeholder="e.g. Akad Nikah / Reception / Ngunduh Mantu" />
                </label>
                <label>
                  <span>Ready Time</span>
                  <input v-model="event.readyTime" type="time" />
                </label>
                <label>
                  <span>Time Note</span>
                  <input v-model="event.timeNote" type="text" placeholder="e.g. Ready 04:00 AM / Morning" />
                </label>
              </div>

              <div class="couple-detail-grid">
                <section class="couple-detail-card">
                  <h4>Bride</h4>
                  <div class="couple-span-2">
                    <span class="attire-field-label">Select Bride Attire (Catalog)</span>
                    <AttireSelect
                      v-model="event.bride.attireId"
                      :options="modalBrideAttireOptions"
                      placeholder="Select Bride attire from catalog"
                    />
                  </div>
                  <div v-if="attireSelectionAlert(event.bride.attireId, modalEditingBooking)" class="attire-inline-alert couple-span-2">
                    <AlertTriangle :size="14" />
                    <span>{{ attireSelectionAlert(event.bride.attireId, modalEditingBooking) }}</span>
                  </div>
                  <label><span>Look</span><input v-model="event.bride.look" placeholder="Makeup look details" /></label>
                  <label><span>Accessories</span><input v-model="event.bride.accessories" placeholder="Accessories" /></label>
                  <label class="couple-span-2"><span>Footwear</span><input v-model="event.bride.shoes" placeholder="Shoes / heels" /></label>
                </section>

                <section class="couple-detail-card">
                  <h4>Groom</h4>
                  <div class="couple-span-2">
                    <span class="attire-field-label">Select Groom Attire (Catalog)</span>
                    <AttireSelect
                      v-model="event.groom.attireId"
                      :options="modalGroomAttireOptions"
                      placeholder="Select Groom attire from catalog"
                    />
                  </div>
                  <div v-if="attireSelectionAlert(event.groom.attireId, modalEditingBooking)" class="attire-inline-alert couple-span-2">
                    <AlertTriangle :size="14" />
                    <span>{{ attireSelectionAlert(event.groom.attireId, modalEditingBooking) }}</span>
                  </div>
                  <label><span>Look</span><input v-model="event.groom.look" placeholder="Groom styling details" /></label>
                  <label><span>Accessories</span><input v-model="event.groom.accessories" placeholder="Blangkon / keris / pins" /></label>
                  <label class="couple-span-2"><span>Footwear</span><input v-model="event.groom.shoes" placeholder="Shoes / slop" /></label>
                </section>
              </div>
            </article>

            <div v-if="editModalForm.events.length < 3" class="add-event-row">
              <button type="button" class="outline-button add-event-button" @click="addEventSectionTo(editModalForm)">
                <Plus :size="16" />+ Add Session
              </button>
            </div>
          </div>
        </div>

        <div class="fitting-modal-section">
          <div class="fitting-modal-section-head">
            <UsersRound :size="17" />
            <strong>Uniforms &amp; Extras</strong>
          </div>
          <div class="uniform-sections">
            <div class="uniform-group-box">
              <h4>Domas &amp; Manggolo</h4>
              <div class="uniform-group-fields uniform-group-fields--manggolo">
                <label><span>Domas Uniform</span><input v-model="editModalForm.uniforms.domas" placeholder="Color / style / hijab option" /></label>
                <label><span>Manggolo Uniform</span><input v-model="editModalForm.uniforms.manggolo" placeholder="Manggolo uniform details" /></label>
                <label><span>Blangkon Qty</span><input v-model.number="editModalForm.manggoloBlangkon" type="number" min="0" placeholder="0" /></label>
                <label><span>Slippers Qty</span><input v-model.number="editModalForm.manggoloSlop" type="number" min="0" placeholder="0" /></label>
              </div>
            </div>
            <div class="uniform-group-box">
              <h4>Family, Greeters, Lenses &amp; Extras</h4>
              <div class="uniform-group-fields uniform-group-fields--two">
                <label v-for="([key, label, placeholder]) in familyUniformFields" :key="key">
                  <span>{{ label }}</span>
                  <input v-model="editModalForm.uniforms[key]" :placeholder="placeholder" />
                </label>
                <label>
                  <span>Contact Lenses</span>
                  <select v-model="editModalForm.uniforms.softlens">
                    <option value="">Select lens type</option>
                    <option v-for="opt in softlensOptions" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                </label>
                <label v-for="([key, label, placeholder]) in addonUniformFields" :key="key">
                  <span>{{ label }}</span>
                  <input v-model="editModalForm.uniforms[key]" :placeholder="placeholder" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="fitting-modal-section">
          <div class="fitting-modal-section-head">
            <Store :size="17" />
            <strong>Partner Wedding Vendors</strong>
          </div>
          <div class="mini-field-grid">
            <label v-for="([key, label]) in vendorFields" :key="key">
              <span>{{ label }}</span>
              <input v-model="editModalForm.vendors[key]" placeholder="Vendor name / contact / notes" />
            </label>
          </div>
        </div>
      </div>

      <p v-if="modalFormError" class="form-error" role="alert">{{ modalFormError }}</p>
      <div class="modal-actions">
        <button
          type="button"
          class="secondary-button"
          :disabled="downloadingPdf"
          @click="downloadSavedPdf(editModalForm)"
        >
          <Download :size="16" />Download PDF
        </button>
        <button type="button" class="secondary-button" @click="showEditFittingModal = false">Cancel</button>
        <button type="button" class="primary-button" @click="saveEditModalForm"><Save :size="16" />Save Changes</button>
      </div>
    </UiModal>
  </div>
</template>
