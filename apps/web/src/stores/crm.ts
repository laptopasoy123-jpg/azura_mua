import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { uid } from '../utils/format'
import {
  getSupabaseClient,
  pullAllFromSupabase,
  pushSnapshotToSupabase,
  supabaseSyncState,
  syncBooking,
  syncBusinessProfile,
  syncCancelBookingCascade,
  syncCatalogItem,
  syncDeleteExpense,
  syncDeleteInventoryItem,
  syncDeleteOrderGroup,
  syncDeletePayment,
  syncDeleteStockMovement,
  syncDeleteStockOpname,
  syncDeleteWeddingForm,
  syncDropdownGroup,
  syncEmployee,
  syncExpense,
  syncInventoryItem,
  syncInvoiceOrderGroup,
  syncJobAssignment,
  syncPayment,
  syncRefund,
  syncStockMovement,
  syncStockOpname,
  syncWeddingAttire,
  syncWeddingForm,
} from '../utils/supabaseSync'

export type BookingStatus = 'Draft' | 'Terkonfirmasi' | 'Selesai' | 'Dibatalkan'
export type StylingType = string
export type CatalogType = 'Inti' | 'Additional'

export interface Customer {
  id: string
  name: string
  phone: string
}

export interface Booking {
  id: string
  poNumber: string
  customerId: string
  location: string
  eventDate: string
  eventTime?: string
  stylingType?: StylingType
  notes?: string
  status: BookingStatus
  cancelledPaidAmount?: number
  createdAt: string
}

export interface BookingRefund {
  id: string
  refundNumber: string
  bookingId: string
  poNumber: string
  customerName: string
  refundDate: string
  amount: number
  method: string
  proofImageUrl?: string
  notes?: string
  createdAt: string
}

export type DropdownOptionGroup =
  | 'paymentMethods'
  | 'poExpenseCategories'
  | 'generalExpenseCategories'
  | 'stylingTypes'
  | 'inventoryCategories'
  | 'units'

export interface EmployeeRecord {
  id: string
  name: string
  role: string
  phone?: string
  email?: string
  active: boolean
  lastLogin?: string
}

export interface JobAssignment {
  bookingId: string
  employeeIds: string[]
  notes?: string
  updatedAt: string
}

export interface BusinessProfile {
  name: string
  tagline: string
  phone: string
  email: string
  address: string
  invoiceNote: string
  logoUrl?: string
}

export interface LaundryUrgentAlert {
  attireId: string
  attireName: string
  attireCode: string
  bookingId: string
  poNumber: string
  customerName: string
  eventDate: string
  eventName: string
  daysLeft: number
  message: string
}

export interface CatalogItem {
  id: string
  code: string
  name: string
  type: CatalogType
  description: string
  price: number
  unit: string
  active: boolean
  imageUrl?: string
}

export interface InvoiceItem {
  id: string
  catalogItemId?: string
  serviceType?: CatalogType
  name: string
  quantity: number
  unitPrice: number
  catalogPrice: number
  unit?: string
}

export interface OrderGroup {
  id: string
  kind: 'Awal' | 'Tambahan'
  orderDate: string
  createdAt: string
  items: InvoiceItem[]
}

export interface Invoice {
  id: string
  invoiceNumber: string
  bookingId: string
  kind: 'Utama' | 'Additional'
  issuedAt: string
  dueDate?: string
  groups: OrderGroup[]
  items: InvoiceItem[]
}

export interface Payment {
  id: string
  receiptNumber: string
  bookingId: string
  paidAt: string
  method: string
  amount: number
  notes?: string
}

export interface InventoryItem {
  id: string
  code: string
  name: string
  category: string
  unit: string
  initialStock: number
  stockIn: number
  stockOut: number
  stockAdjustment: number
  minimumStock: number
  location: string
  imageUrl?: string
  active: boolean
}

export interface StockMovement {
  id: string
  batchId?: string
  opnameId?: string
  itemId: string
  type: 'Masuk' | 'Keluar' | 'Penyesuaian'
  quantity: number
  date: string
  pic: string
  notes?: string
  proofImageUrl?: string
}

export interface StockOpnameItem {
  itemId: string
  itemName: string
  itemCode: string
  unit: string
  systemStock: number
  physicalStock: number
  diff: number
  notes?: string
}

export interface StockOpnameRecord {
  id: string
  opnameNumber: string
  date: string
  pic: string
  notes?: string
  items: StockOpnameItem[]
  createdAt: string
}

export interface Expense {
  id: string
  date: string
  category: string
  description: string
  amount: number
  bookingId?: string
  expenseScope?: 'Berdasarkan PO' | 'Di Luar PO'
  proofImageUrl?: string
  method: string
  source?: 'Manual' | 'Bayar Cancel'
  refundId?: string
}

export interface Activity {
  id: string
  at: string
  title: string
  detail: string
  tone: 'green' | 'blue' | 'amber' | 'rose'
}

export type AttireCategory = 'Bride' | 'Groom'
export type AttireStatus = 'Tersedia' | 'Booked' | 'Terpakai' | 'Laundry'

export interface WeddingAttire {
  id: string
  code: string
  name: string
  category: AttireCategory
  size: string
  status: AttireStatus
  imageUrl?: string
  notes?: string
}

export interface AttireScheduleEntry {
  bookingId: string
  poNumber: string
  customerName: string
  eventDate: string
  eventLocation: string
  eventNumber: 1 | 2 | 3
  eventName: string
  role: 'Bride' | 'Groom'
  bookingStatus: BookingStatus
}

export interface WeddingLookDetail {
  look: string
  accessories: string
  shoes: string
  attireId: string
}

export interface WeddingEventDetail {
  number: 1 | 2 | 3
  name: string
  readyTime: string
  timeNote: string
  bride: WeddingLookDetail
  groom: WeddingLookDetail
}

export interface WeddingFittingForm {
  id: string
  bookingId: string
  measurements: Record<string, Record<string, string>>
  events: WeddingEventDetail[]
  uniforms: Record<string, string>
  manggoloBlangkon: number | null
  manggoloSlop: number | null
  vendors: Record<string, string>
  updatedAt: string
}

const STORAGE_KEY = 'azura-mua-demo-v1'

const sortGroupsChronologically = (groups: OrderGroup[]): OrderGroup[] =>
  [...groups].sort((a, b) => {
    const byDate = a.orderDate.localeCompare(b.orderDate)
    if (byDate !== 0) return byDate
    if (a.kind !== b.kind) return a.kind === 'Awal' ? -1 : 1
    return a.createdAt.localeCompare(b.createdAt)
  })

const resolveServiceType = (item: InvoiceItem, catalog: CatalogItem[]): CatalogType => {
  if (item.serviceType === 'Inti' || item.serviceType === 'Additional') return item.serviceType
  const found = catalog.find((c) => c.id === item.catalogItemId || c.name.toLowerCase() === item.name.toLowerCase())
  return found?.type ?? 'Additional'
}

const normalizeInvoices = (rawInvoices: Invoice[], catalog: CatalogItem[]): Invoice[] => {
  const byBooking = new Map<string, Invoice>()
  for (const inv of rawInvoices) {
    const rawGroups: OrderGroup[] = Array.isArray(inv.groups) && inv.groups.length
      ? inv.groups.map((g) => ({
        ...g,
        createdAt: g.createdAt || `${g.orderDate}T00:00:00.000Z`,
        items: (g.items ?? []).map((it) => ({
          ...it,
          serviceType: resolveServiceType(it, catalog),
        })),
      }))
      : [
        {
          id: uid(),
          kind: inv.kind === 'Additional' ? 'Tambahan' : 'Awal',
          orderDate: inv.issuedAt,
          createdAt: `${inv.issuedAt}T00:00:00.000Z`,
          items: (inv.items ?? []).map((it) => ({
            ...it,
            serviceType: resolveServiceType(it, catalog),
          })),
        },
      ]

    const existing = byBooking.get(inv.bookingId)
    if (!existing) {
      const sorted = sortGroupsChronologically(rawGroups)
      byBooking.set(inv.bookingId, {
        ...inv,
        kind: 'Utama',
        groups: sorted,
        items: sorted.flatMap((g) => g.items),
      })
    } else {
      const merged = sortGroupsChronologically([...existing.groups, ...rawGroups])
      if (inv.kind === 'Utama' && existing.kind !== 'Utama') {
        existing.invoiceNumber = inv.invoiceNumber
        existing.issuedAt = inv.issuedAt
        existing.dueDate = inv.dueDate ?? existing.dueDate
      }
      existing.groups = merged
      existing.items = merged.flatMap((g) => g.items)
    }
  }
  return Array.from(byBooking.values())
}

const hasEventContent = (event: Partial<WeddingEventDetail>) =>
  Boolean(
    event.name?.trim()
    || event.readyTime?.trim()
    || event.timeNote?.trim()
    || event.bride?.attireId
    || event.bride?.look?.trim()
    || event.bride?.accessories?.trim()
    || event.bride?.shoes?.trim()
    || event.groom?.attireId
    || event.groom?.look?.trim()
    || event.groom?.accessories?.trim()
    || event.groom?.shoes?.trim(),
  )

const normalizeWeddingForms = (forms: WeddingFittingForm[]): WeddingFittingForm[] =>
  forms.map((form) => {
    const normalizedEvents = (form.events ?? []).map((ev, idx) => ({
      number: (ev.number ?? (idx + 1)) as 1 | 2 | 3,
      name: ev.name ?? '',
      readyTime: ev.readyTime ?? '',
      timeNote: ev.timeNote ?? '',
      bride: {
        look: ev.bride?.look ?? '',
        accessories: ev.bride?.accessories ?? '',
        shoes: ev.bride?.shoes ?? '',
        attireId: ev.bride?.attireId ?? '',
      },
      groom: {
        look: ev.groom?.look ?? '',
        accessories: ev.groom?.accessories ?? '',
        shoes: ev.groom?.shoes ?? '',
        attireId: ev.groom?.attireId ?? '',
      },
    }))

    let highestNonEmpty = 1
    for (let i = normalizedEvents.length - 1; i >= 1; i -= 1) {
      if (hasEventContent(normalizedEvents[i]!)) {
        highestNonEmpty = i + 1
        break
      }
    }
    const visibleEvents = normalizedEvents.length
      ? normalizedEvents.slice(0, highestNonEmpty)
      : [
        {
          number: 1 as const,
          name: '',
          readyTime: '',
          timeNote: '',
          bride: { look: '', accessories: '', shoes: '', attireId: '' },
          groom: { look: '', accessories: '', shoes: '', attireId: '' },
        },
      ]

    const measurementKeys = ['bride', 'groom', 'ibu', 'ayah', 'kembarMayangCe', 'kembarMayangCo', 'terimaTamu']
    const normalizedMeasurements: Record<string, Record<string, string>> = {}
    for (const key of measurementKeys) {
      normalizedMeasurements[key] = { ...((form.measurements && form.measurements[key]) || {}) }
    }
    if (form.measurements) {
      for (const [key, val] of Object.entries(form.measurements)) {
        if (!(key in normalizedMeasurements)) {
          normalizedMeasurements[key] = { ...(val || {}) }
        }
      }
    }

    return {
      ...form,
      measurements: normalizedMeasurements,
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
        ...(form.uniforms ?? {}),
      },
      vendors: {
        deco: '',
        doc: '',
        wcc: '',
        mc: '',
        tenda: '',
        seserahan: '',
        wo: '',
        ...(form.vendors ?? {}),
      },
      events: visibleEvents,
      manggoloBlangkon: typeof form.manggoloBlangkon === 'number' ? form.manggoloBlangkon : null,
      manggoloSlop: typeof form.manggoloSlop === 'number' ? form.manggoloSlop : null,
    }
  })

const normalizeWeddingAttire = (items: Array<Omit<WeddingAttire, 'status'> & { status: string }>): WeddingAttire[] =>
  items.map((item) => ({
    ...item,
    status: item.status === 'Booked' ? 'Terpakai' : (item.status === 'Laundry' ? 'Laundry' : (item.status === 'Terpakai' ? 'Terpakai' : 'Tersedia')),
  }))

const normalizeInventory = (items: Array<Partial<InventoryItem> & Omit<InventoryItem, 'stockAdjustment'>>): InventoryItem[] =>
  items.map((item) => ({
    ...item,
    stockAdjustment: typeof item.stockAdjustment === 'number' ? item.stockAdjustment : 0,
  }))

const seed = () => {
  const customers: Customer[] = [
    { id: 'c-1', name: 'Nadya Prameswari', phone: '0812 3421 9088' },
    { id: 'c-2', name: 'Alya Rahman', phone: '0857 9012 1120' },
    { id: 'c-3', name: 'Putri Maheswari', phone: '0813 7788 1200' },
    { id: 'c-4', name: 'Salsa Azzahra', phone: '0822 4331 2209' },
  ]
  const bookings: Booking[] = [
    { id: 'b-1', poNumber: 'PO-2026-0001', customerId: 'c-1', location: 'The Langham Jakarta', eventDate: '2026-11-22', eventTime: '05:30', stylingType: 'Hijabdo', status: 'Terkonfirmasi', createdAt: '2026-10-03' },
    { id: 'b-2', poNumber: 'PO-2026-0002', customerId: 'c-2', location: 'InterContinental Bandung', eventDate: '2026-12-06', eventTime: '06:00', stylingType: 'Hairdo', status: 'Terkonfirmasi', createdAt: '2026-10-11' },
    { id: 'b-3', poNumber: 'PO-2026-0003', customerId: 'c-3', location: 'Gedung Smesco Jakarta', eventDate: '2026-11-28', eventTime: '07:00', stylingType: 'Hijabdo', status: 'Draft', createdAt: '2026-11-01' },
    { id: 'b-4', poNumber: 'PO-2026-0004', customerId: 'c-4', location: 'Royal Tulip Bogor', eventDate: '2026-12-19', eventTime: '05:00', stylingType: 'Hairdo', status: 'Terkonfirmasi', createdAt: '2026-11-08' },
  ]
  const catalog: CatalogItem[] = [
    { id: 'cat-1', code: 'CAT-0001', name: 'Makeup Wedding', type: 'Inti', description: 'Complete bridal makeup dengan complexion tahan lama.', price: 2500000, unit: 'orang', active: true },
    { id: 'cat-2', code: 'CAT-0002', name: 'Makeup Engagement', type: 'Inti', description: 'Soft glam elegan untuk acara engagement.', price: 1500000, unit: 'orang', active: true },
    { id: 'cat-3', code: 'CAT-0003', name: 'Makeup Graduation', type: 'Inti', description: 'Fresh makeup untuk momen wisuda.', price: 750000, unit: 'orang', active: true },
    { id: 'cat-4', code: 'CAT-0004', name: 'Makeup Keluarga', type: 'Additional', description: 'Makeup natural untuk keluarga pengantin.', price: 500000, unit: 'orang', active: true },
    { id: 'cat-5', code: 'CAT-0005', name: 'Hairdo', type: 'Additional', description: 'Hair styling menyesuaikan konsep acara.', price: 350000, unit: 'orang', active: true },
    { id: 'cat-6', code: 'CAT-0006', name: 'Touch Up', type: 'Additional', description: 'Pendampingan dan touch up selama acara.', price: 600000, unit: 'sesi', active: true },
  ]

  const inv1Items: InvoiceItem[] = [
    { id: 'ii-1', catalogItemId: 'cat-1', serviceType: 'Inti', name: 'Makeup Wedding', quantity: 1, catalogPrice: 2500000, unitPrice: 2300000, unit: 'orang' },
    { id: 'ii-2', catalogItemId: 'cat-4', serviceType: 'Additional', name: 'Makeup Keluarga', quantity: 2, catalogPrice: 500000, unitPrice: 450000, unit: 'orang' },
  ]
  const inv2Items: InvoiceItem[] = [
    { id: 'ii-3', catalogItemId: 'cat-1', serviceType: 'Inti', name: 'Makeup Wedding', quantity: 1, catalogPrice: 2500000, unitPrice: 2500000, unit: 'orang' },
    { id: 'ii-4', catalogItemId: 'cat-5', serviceType: 'Additional', name: 'Hairdo', quantity: 1, catalogPrice: 350000, unitPrice: 350000, unit: 'orang' },
  ]
  const inv3Items: InvoiceItem[] = [
    { id: 'ii-5', catalogItemId: 'cat-2', serviceType: 'Inti', name: 'Makeup Engagement', quantity: 1, catalogPrice: 1500000, unitPrice: 1400000, unit: 'orang' },
  ]

  const invoices: Invoice[] = [
    {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0001',
      bookingId: 'b-1',
      kind: 'Utama',
      issuedAt: '2026-10-03',
      dueDate: '2026-11-19',
      groups: [{ id: 'og-1', kind: 'Awal', orderDate: '2026-10-03', createdAt: '2026-10-03T09:00:00.000Z', items: inv1Items }],
      items: inv1Items,
    },
    {
      id: 'inv-2',
      invoiceNumber: 'INV-2026-0002',
      bookingId: 'b-2',
      kind: 'Utama',
      issuedAt: '2026-10-11',
      dueDate: '2026-12-01',
      groups: [{ id: 'og-2', kind: 'Awal', orderDate: '2026-10-11', createdAt: '2026-10-11T09:00:00.000Z', items: inv2Items }],
      items: inv2Items,
    },
    {
      id: 'inv-3',
      invoiceNumber: 'INV-2026-0003',
      bookingId: 'b-4',
      kind: 'Utama',
      issuedAt: '2026-11-08',
      dueDate: '2026-12-12',
      groups: [{ id: 'og-3', kind: 'Awal', orderDate: '2026-11-08', createdAt: '2026-11-08T09:00:00.000Z', items: inv3Items }],
      items: inv3Items,
    },
  ]

  const payments: Payment[] = [
    { id: 'pay-1', receiptNumber: 'KWT-2026-0001', bookingId: 'b-1', paidAt: '2026-10-03', method: 'Transfer', amount: 1500000, notes: 'DP pertama' },
    { id: 'pay-2', receiptNumber: 'KWT-2026-0002', bookingId: 'b-2', paidAt: '2026-10-13', method: 'QRIS', amount: 2850000, notes: 'Pelunasan' },
    { id: 'pay-3', receiptNumber: 'KWT-2026-0003', bookingId: 'b-4', paidAt: '2026-11-08', method: 'Transfer', amount: 500000, notes: 'DP' },
  ]
  const inventory: InventoryItem[] = [
    { id: 'stock-1', code: 'BRG-0001', name: 'Foundation HD', category: 'Complexion', unit: 'botol', initialStock: 6, stockIn: 8, stockOut: 5, stockAdjustment: 0, minimumStock: 4, location: 'Drawer A1', active: true },
    { id: 'stock-2', code: 'BRG-0002', name: 'Setting Spray', category: 'Finishing', unit: 'botol', initialStock: 3, stockIn: 3, stockOut: 4, stockAdjustment: 0, minimumStock: 3, location: 'Drawer A2', active: true },
    { id: 'stock-3', code: 'BRG-0003', name: 'False Lashes', category: 'Accessories', unit: 'pasang', initialStock: 12, stockIn: 20, stockOut: 14, stockAdjustment: 0, minimumStock: 8, location: 'Box B1', active: true },
    { id: 'stock-4', code: 'BRG-0004', name: 'Cleansing Balm', category: 'Skin Prep', unit: 'jar', initialStock: 2, stockIn: 2, stockOut: 3, stockAdjustment: 0, minimumStock: 2, location: 'Drawer A3', active: true },
    { id: 'stock-5', code: 'BRG-0005', name: 'Beauty Sponge', category: 'Tools', unit: 'pcs', initialStock: 10, stockIn: 10, stockOut: 8, stockAdjustment: 0, minimumStock: 5, location: 'Box B2', active: true },
  ]
  const movements: StockMovement[] = [
    { id: 'mov-1', batchId: 'batch-seed-1', itemId: 'stock-1', type: 'Keluar', quantity: 2, date: '2026-11-14', pic: 'Nisa', notes: 'Studio session' },
    { id: 'mov-2', batchId: 'batch-seed-2', itemId: 'stock-3', type: 'Masuk', quantity: 10, date: '2026-11-13', pic: 'Rani', notes: 'Restock supplier' },
  ]
  const stockOpnames: StockOpnameRecord[] = []
  const expenses: Expense[] = [
    { id: 'exp-1', date: '2026-11-12', category: 'Transportasi', description: 'Transport venue Nadya', amount: 350000, bookingId: 'b-1', method: 'Transfer' },
    { id: 'exp-2', date: '2026-11-10', category: 'Operasional', description: 'Internet studio', amount: 450000, method: 'Transfer' },
    { id: 'exp-3', date: '2026-11-08', category: 'Honor Tim', description: 'Asisten makeup', amount: 600000, bookingId: 'b-4', method: 'Cash' },
  ]
  const activities: Activity[] = [
    { id: 'act-1', at: '2026-11-15T14:28:00+07:00', title: 'Payment received', detail: 'DP PO-2026-0004 for Rp. 500.000', tone: 'green' },
    { id: 'act-2', at: '2026-11-15T11:12:00+07:00', title: 'Stock updated', detail: 'False Lashes increased by 10 pairs', tone: 'blue' },
    { id: 'act-3', at: '2026-11-14T16:20:00+07:00', title: 'Booking confirmed', detail: 'PO-2026-0001 confirmed for event', tone: 'amber' },
  ]
  const weddingAttire: WeddingAttire[] = [
    { id: 'attire-1', code: 'BTR-0001', name: 'Kebaya Sekar Arum', category: 'Bride', size: 'M', status: 'Tersedia' },
    { id: 'attire-2', code: 'BTR-0002', name: 'Kebaya Ayu Ratih', category: 'Bride', size: 'L', status: 'Tersedia' },
    { id: 'attire-3', code: 'BTR-0003', name: 'Paes Ageng Velvet', category: 'Bride', size: 'S', status: 'Laundry' },
    { id: 'attire-4', code: 'BTR-0004', name: 'Beskap Gading', category: 'Groom', size: 'L', status: 'Tersedia' },
    { id: 'attire-5', code: 'BTR-0005', name: 'Beskap Surjan Navy', category: 'Groom', size: 'XL', status: 'Tersedia' },
    { id: 'attire-6', code: 'BTR-0006', name: 'Beskap Klasik Hitam', category: 'Groom', size: 'M', status: 'Laundry' },
  ]
  const weddingForms: WeddingFittingForm[] = []
  const refunds: BookingRefund[] = []
  const employees: EmployeeRecord[] = [
    { id: 'emp-1', name: 'Aura Rahma', role: 'Owner / Lead MUA', email: 'aura@azuramakeup.id', phone: '0812 9000 2026', active: true, lastLogin: 'Hari ini, 14:22' },
    { id: 'emp-2', name: 'Nisa Amalia', role: 'Finance', email: 'nisa@azuramakeup.id', phone: '0812 8811 2201', active: true, lastLogin: 'Kemarin, 18:04' },
    { id: 'emp-3', name: 'Rani Putri', role: 'Wardrobe & Inventory', email: 'rani@azuramakeup.id', phone: '0813 7711 9022', active: true, lastLogin: '13 Nov 2026' },
    { id: 'emp-4', name: 'Sinta Dewi', role: 'MUA & Hairdo', email: 'sinta@azuramakeup.id', phone: '0857 2241 8810', active: true, lastLogin: '15 Nov 2026' },
    { id: 'emp-5', name: 'Dina Kartika', role: 'Hijabdo Stylist', email: 'dina@azuramakeup.id', phone: '0821 6640 3190', active: true, lastLogin: '14 Nov 2026' },
  ]
  const jobAssignments: JobAssignment[] = [
    { bookingId: 'b-1', employeeIds: ['emp-1', 'emp-5'], notes: 'Resepsi pagi di The Langham', updatedAt: '2026-11-12T09:00:00.000Z' },
    { bookingId: 'b-2', employeeIds: ['emp-1', 'emp-4'], notes: 'Full day wedding Bandung', updatedAt: '2026-11-13T10:00:00.000Z' },
    { bookingId: 'b-4', employeeIds: ['emp-4'], notes: 'Standby 04.30 WIB', updatedAt: '2026-11-14T11:00:00.000Z' },
  ]
  const businessProfile: BusinessProfile = {
    name: 'AZURA',
    tagline: 'MAKEUP ARTIST',
    phone: '0812 9000 2026',
    email: 'hello@azuramakeup.id',
    address: 'Jakarta Selatan, DKI Jakarta',
    invoiceNote: 'Terima kasih telah mempercayakan momen spesial Anda kepada Azura Makeup Studio.',
    logoUrl: '',
  }
  const paymentMethods = ['Tunai', 'Transfer', 'QRIS', 'Lainnya']
  const poExpenseCategories = ['Transportasi', 'Honor Tim', 'Akomodasi', 'Perlengkapan', 'Operasional']
  const generalExpenseCategories = ['Operasional', 'Perlengkapan', 'Akomodasi', 'Transportasi', 'Honor Tim']
  const stylingTypes = ['Hijabdo', 'Hairdo']
  const inventoryCategories = ['Complexion', 'Finishing', 'Aksesoris Mata', 'Skin Prep', 'Tools', 'Hair Styling', 'Hijab Styling', 'Softlens Care']
  const units = ['paket', 'orang', 'sesi', 'set', 'botol', 'pcs', 'pasang', 'jar', 'kotak', 'pack']
  return {
    customers, bookings, catalog, invoices, payments, refunds, inventory, movements, stockOpnames,
    expenses, activities, weddingAttire, weddingForms, employees, jobAssignments, businessProfile,
    paymentMethods, poExpenseCategories, generalExpenseCategories, stylingTypes, inventoryCategories, units,
  }
}

const localTodayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const calendarDaysDiff = (fromIso: string, toIso: string) => {
  const a = new Date(`${fromIso}T00:00:00`).getTime()
  const b = new Date(`${toIso}T00:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
}

export interface ActionToast {
  id: string
  title: string
  detail: string
  tone: 'blue' | 'green' | 'amber' | 'rose'
}

export const useCrmStore = defineStore('crm', () => {
  const isSupabaseMode = Boolean(getSupabaseClient())
  if (isSupabaseMode && typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }

  const defaults = seed()
  const saved = !isSupabaseMode && typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  const parsed = saved ? JSON.parse(saved) as Partial<ReturnType<typeof seed>> : {}

  const emptyInitial: ReturnType<typeof seed> = {
    customers: [],
    bookings: [],
    catalog: [],
    invoices: [],
    payments: [],
    refunds: [],
    inventory: [],
    movements: [],
    stockOpnames: [],
    expenses: [],
    activities: [],
    weddingAttire: [],
    weddingForms: [],
    employees: [],
    jobAssignments: [],
    businessProfile: defaults.businessProfile,
    paymentMethods: defaults.paymentMethods,
    poExpenseCategories: defaults.poExpenseCategories,
    generalExpenseCategories: defaults.generalExpenseCategories,
    stylingTypes: defaults.stylingTypes,
    inventoryCategories: defaults.inventoryCategories,
    units: defaults.units,
  }

  const mergedCatalog = parsed.catalog ?? defaults.catalog
  const initial: ReturnType<typeof seed> = isSupabaseMode
    ? emptyInitial
    : {
      ...defaults,
      ...parsed,
      catalog: mergedCatalog,
      invoices: normalizeInvoices(parsed.invoices ?? defaults.invoices, mergedCatalog),
      inventory: normalizeInventory(parsed.inventory ?? defaults.inventory),
      weddingAttire: normalizeWeddingAttire(parsed.weddingAttire ?? defaults.weddingAttire),
      weddingForms: normalizeWeddingForms(parsed.weddingForms ?? defaults.weddingForms),
      stockOpnames: parsed.stockOpnames ?? defaults.stockOpnames,
      refunds: parsed.refunds ?? defaults.refunds,
    }

  const customers = ref(initial.customers)
  const bookings = ref(initial.bookings)
  const catalog = ref(initial.catalog)
  const invoices = ref(initial.invoices)
  const payments = ref(initial.payments)
  const refunds = ref(initial.refunds)
  const inventory = ref(initial.inventory)
  const movements = ref(initial.movements)
  const stockOpnames = ref(initial.stockOpnames)
  const expenses = ref(initial.expenses)
  const activities = ref(initial.activities)
  const weddingAttire = ref(initial.weddingAttire)
  const weddingForms = ref(initial.weddingForms)
  const employees = ref(initial.employees ?? (isSupabaseMode ? [] : defaults.employees))
  const jobAssignments = ref(initial.jobAssignments ?? [])
  const businessProfile = ref<BusinessProfile>({ ...defaults.businessProfile, ...(initial.businessProfile ?? {}) })
  const paymentMethods = ref<string[]>(initial.paymentMethods?.length ? initial.paymentMethods : defaults.paymentMethods)
  const poExpenseCategories = ref<string[]>(initial.poExpenseCategories?.length ? initial.poExpenseCategories : defaults.poExpenseCategories)
  const generalExpenseCategories = ref<string[]>(initial.generalExpenseCategories?.length ? initial.generalExpenseCategories : defaults.generalExpenseCategories)
  const stylingTypes = ref<string[]>(initial.stylingTypes?.length ? initial.stylingTypes : defaults.stylingTypes)
  const inventoryCategories = ref<string[]>(initial.inventoryCategories?.length ? initial.inventoryCategories : defaults.inventoryCategories)
  const units = ref<string[]>(initial.units?.length ? initial.units : defaults.units)

  const groupTotal = (group: OrderGroup) =>
    group.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  const sortedOrderGroups = (invoice: Invoice) =>
    sortGroupsChronologically(invoice.groups ?? [])

  const sortInvoiceItemsIntiFirst = (items: InvoiceItem[]): InvoiceItem[] =>
    [...items].sort((a, b) => {
      const typeA = resolveServiceType(a, catalog.value)
      const typeB = resolveServiceType(b, catalog.value)
      if (typeA === typeB) return 0
      return typeA === 'Inti' ? -1 : 1
    })

  const invoiceTotal = (invoice: Invoice) => {
    if (invoice.groups?.length) {
      return invoice.groups.reduce((sum, group) => sum + groupTotal(group), 0)
    }
    return invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  }

  const customerMap = computed(() => {
    const map = new Map<string, Customer>()
    for (const c of customers.value) map.set(c.id, c)
    return map
  })

  const bookingMap = computed(() => {
    const map = new Map<string, Booking>()
    for (const b of bookings.value) map.set(b.id, b)
    return map
  })

  const invoicesByBookingMap = computed(() => {
    const map = new Map<string, Invoice[]>()
    for (const inv of invoices.value) {
      let list = map.get(inv.bookingId)
      if (!list) {
        list = []
        map.set(inv.bookingId, list)
      }
      list.push(inv)
    }
    return map
  })

  const paymentsByBookingMap = computed(() => {
    const map = new Map<string, Payment[]>()
    for (const pay of payments.value) {
      let list = map.get(pay.bookingId)
      if (!list) {
        list = []
        map.set(pay.bookingId, list)
      }
      list.push(pay)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    }
    return map
  })

  const totalByBookingMap = computed(() => {
    const map = new Map<string, number>()
    for (const inv of invoices.value) {
      map.set(inv.bookingId, (map.get(inv.bookingId) ?? 0) + invoiceTotal(inv))
    }
    return map
  })

  const paidByBookingMap = computed(() => {
    const map = new Map<string, number>()
    for (const pay of payments.value) {
      map.set(pay.bookingId, (map.get(pay.bookingId) ?? 0) + pay.amount)
    }
    return map
  })

  const bookingInvoices = (bookingId: string) => invoicesByBookingMap.value.get(bookingId) ?? []
  const bookingInvoice = (bookingId: string) => invoicesByBookingMap.value.get(bookingId)?.[0]
  const bookingPayments = (bookingId: string) => paymentsByBookingMap.value.get(bookingId) ?? []
  const bookingTotal = (bookingId: string) => totalByBookingMap.value.get(bookingId) ?? 0
  const bookingPaid = (bookingId: string) => paidByBookingMap.value.get(bookingId) ?? 0
  const bookingBalance = (bookingId: string) => bookingTotal(bookingId) - bookingPaid(bookingId)
  const customerFor = (id: string) => customerMap.value.get(id)
  const bookingFor = (id: string) => bookingMap.value.get(id)

  const stockAvailable = (item: InventoryItem) =>
    item.initialStock + item.stockIn - item.stockOut + (item.stockAdjustment ?? 0)

  const stockStatus = (item: InventoryItem) => {
    const available = stockAvailable(item)
    if (available <= 0) return 'Habis'
    if (available <= item.minimumStock) return 'Menipis'
    return 'Aman'
  }

  const attireSchedule = (
    attireId: string,
    options?: { includePast?: boolean; includeCancelled?: boolean; referenceDate?: string },
  ): AttireScheduleEntry[] => {
    const refDate = options?.referenceDate ?? localTodayIso()
    const includePast = options?.includePast ?? false
    const includeCancelled = options?.includeCancelled ?? false
    const entries: AttireScheduleEntry[] = []
    for (const form of weddingForms.value) {
      const booking = bookingFor(form.bookingId)
      if (!booking) continue
      if (!includeCancelled && booking.status === 'Dibatalkan') continue
      if (!includePast && booking.eventDate < refDate) continue
      const customer = customerFor(booking.customerId)
      for (const ev of form.events ?? []) {
        if (ev.bride?.attireId === attireId) {
          entries.push({
            bookingId: booking.id,
            poNumber: booking.poNumber,
            customerName: customer?.name ?? 'Customer',
            eventDate: booking.eventDate,
            eventLocation: booking.location,
            eventNumber: ev.number,
            eventName: ev.name || `Acara ${ev.number}`,
            role: 'Bride',
            bookingStatus: booking.status,
          })
        }
        if (ev.groom?.attireId === attireId) {
          entries.push({
            bookingId: booking.id,
            poNumber: booking.poNumber,
            customerName: customer?.name ?? 'Customer',
            eventDate: booking.eventDate,
            eventLocation: booking.location,
            eventNumber: ev.number,
            eventName: ev.name || `Acara ${ev.number}`,
            role: 'Groom',
            bookingStatus: booking.status,
          })
        }
      }
    }
    return entries.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  }

  const effectiveAttireStatus = (attire: WeddingAttire, referenceDate?: string): AttireStatus => {
    if (attire.status === 'Laundry') return 'Laundry'
    const refDate = referenceDate ?? localTodayIso()
    const activeScheduled = attireSchedule(attire.id, { includePast: false, referenceDate: refDate })
    if (activeScheduled.some((entry) => entry.eventDate === refDate)) return 'Terpakai'
    if (activeScheduled.length > 0) return 'Booked'
    // Once event dates have passed, attire automatically returns to Tersedia
    return 'Tersedia'
  }

  const attireConflictsOnDate = (attireId: string, eventDate: string, excludeBookingId?: string): AttireScheduleEntry[] => {
    if (!eventDate) return []
    return attireSchedule(attireId, { includePast: true }).filter(
      (entry) => entry.eventDate === eventDate && (!excludeBookingId || entry.bookingId !== excludeBookingId),
    )
  }

  const urgentAttireSchedules = (attireId: string, referenceDate?: string, maxDays = 1): AttireScheduleEntry[] => {
    const refDate = referenceDate ?? localTodayIso()
    return attireSchedule(attireId, { includePast: false, referenceDate: refDate }).filter((entry) => {
      const diff = calendarDaysDiff(refDate, entry.eventDate)
      return diff >= 0 && diff <= maxDays
    })
  }

  const getLaundryUrgentAlerts = (referenceDate?: string): LaundryUrgentAlert[] => {
    const refDate = referenceDate ?? localTodayIso()
    const alerts: LaundryUrgentAlert[] = []
    for (const item of weddingAttire.value) {
      if (item.status !== 'Laundry') continue
      const upcoming = attireSchedule(item.id, { includePast: false, referenceDate: refDate })
      for (const entry of upcoming) {
        const diff = calendarDaysDiff(refDate, entry.eventDate)
        if (diff >= 0 && diff <= 2) {
          const dayPrefix = diff === 0
            ? 'Event today'
            : diff === 1
              ? 'H-1 event tomorrow'
              : 'H-2 event in 2 days'
          alerts.push({
            attireId: item.id,
            attireName: item.name,
            attireCode: item.code,
            bookingId: entry.bookingId,
            poNumber: entry.poNumber,
            customerName: entry.customerName,
            eventDate: entry.eventDate,
            eventName: entry.eventName,
            daysLeft: diff,
            message: `${dayPrefix} for ${entry.customerName} (${entry.poNumber})! Prepare attire ${item.name} immediately (still in Laundry).`,
          })
        }
      }
    }
    return alerts.sort((a, b) => a.daysLeft - b.daysLeft)
  }

  const laundryUrgentAlerts = computed(() => getLaundryUrgentAlerts())

  const totalBilling = computed(() => invoices.value.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0))
  const totalPaid = computed(() => payments.value.reduce((sum, payment) => sum + payment.amount, 0))
  const totalReceivable = computed(() => Math.max(0, totalBilling.value - totalPaid.value))
  const totalExpenses = computed(() => expenses.value.reduce((sum, expense) => sum + expense.amount, 0))
  const totalRefunds = computed(() => refunds.value.reduce((sum, refund) => sum + refund.amount, 0))
  const totalCashOut = computed(() => {
    const linkedRefundIds = new Set(expenses.value.map((e) => e.refundId).filter(Boolean))
    const unlinkedRefunds = refunds.value
      .filter((r) => !linkedRefundIds.has(r.id))
      .reduce((sum, r) => sum + r.amount, 0)
    return totalExpenses.value + unlinkedRefunds
  })
  const netCashflow = computed(() => totalPaid.value - totalCashOut.value)
  const upcomingBookings = computed(() => [...bookings.value].filter((item) => item.status !== 'Dibatalkan' && item.eventDate >= '2026-11-15').sort((a, b) => a.eventDate.localeCompare(b.eventDate)))
  const lowStock = computed(() => inventory.value.filter((item) => stockStatus(item) !== 'Aman'))

  const actionToast = ref<ActionToast | null>(null)
  let actionToastTimer: ReturnType<typeof setTimeout> | undefined

  const pdfDownloadState = ref<{ active: boolean; title: string; subtitle: string }>({
    active: false,
    title: '',
    subtitle: '',
  })

  const dismissActionToast = () => {
    if (actionToastTimer) {
      clearTimeout(actionToastTimer)
      actionToastTimer = undefined
    }
    actionToast.value = null
  }

  const showActionToast = (title: string, detail: string, tone: Activity['tone'] = 'green') => {
    if (typeof window === 'undefined' || import.meta.env.MODE === 'test') return
    const id = uid()
    actionToast.value = { id, title, detail, tone }
    if (actionToastTimer) clearTimeout(actionToastTimer)
    actionToastTimer = setTimeout(() => {
      if (actionToast.value?.id === id) actionToast.value = null
      actionToastTimer = undefined
    }, 3200)
  }

  const runWithPdfLoader = async (title: string, subtitle: string, fn: () => Promise<void> | void) => {
    pdfDownloadState.value = { active: true, title, subtitle }
    const started = Date.now()
    try {
      await new Promise((resolve) => setTimeout(resolve, 60))
      await fn()
      const elapsed = Date.now() - started
      if (elapsed < 650) {
        await new Promise((resolve) => setTimeout(resolve, 650 - elapsed))
      }
      pdfDownloadState.value = { active: false, title: '', subtitle: '' }
      showActionToast('PDF Downloaded Successfully', `${title} — ${subtitle}`, 'green')
    } catch (error) {
      pdfDownloadState.value = { active: false, title: '', subtitle: '' }
      showActionToast('PDF Download Failed', error instanceof Error ? error.message : 'Unable to generate PDF', 'rose')
      throw error
    }
  }

  const addActivity = (title: string, detail: string, tone: Activity['tone']) => {
    activities.value.unshift({ id: uid(), at: new Date().toISOString(), title, detail, tone })
    showActionToast(title, detail, tone)
  }

  const addBooking = (input: { name: string; phone: string; location: string; eventDate: string; eventTime?: string; stylingType?: StylingType; notes?: string }) => {
    const customer: Customer = { id: uid(), name: input.name.trim(), phone: input.phone.trim() }
    const sequence = bookings.value.length + 1
    const booking: Booking = {
      id: uid(),
      poNumber: `PO-${new Date(input.eventDate).getFullYear()}-${String(sequence).padStart(4, '0')}`,
      customerId: customer.id,
      location: input.location.trim(),
      eventDate: input.eventDate,
      eventTime: input.eventTime,
      stylingType: input.stylingType,
      notes: input.notes,
      status: 'Draft',
      createdAt: new Date().toISOString().slice(0, 10),
    }
    customers.value.unshift(customer)
    bookings.value.unshift(booking)
    addActivity('New booking created', `${booking.poNumber} for ${customer.name}`, 'blue')
    syncBooking(booking, customer)
    return booking
  }

  const updateBooking = (id: string, input: { name: string; phone: string; location: string; eventDate: string; eventTime?: string; stylingType?: StylingType; notes?: string; status: BookingStatus }) => {
    const booking = bookingFor(id)
    if (!booking) throw new Error('Booking not found.')
    const customer = customerFor(booking.customerId)
    if (!customer) throw new Error('Customer not found.')
    customer.name = input.name.trim()
    customer.phone = input.phone.trim()
    Object.assign(booking, {
      location: input.location.trim(),
      eventDate: input.eventDate,
      eventTime: input.eventTime,
      stylingType: input.stylingType,
      notes: input.notes,
      status: input.status,
    })
    addActivity('Booking updated', `${booking.poNumber} for ${customer.name}`, 'blue')
    syncBooking(booking, customer)
    return booking
  }

  const addBookingRefund = (input: {
    bookingId: string
    refundDate: string
    amount: number
    method: BookingRefund['method']
    proofImageUrl?: string
    notes?: string
  }) => {
    const booking = bookingFor(input.bookingId)
    if (!booking) throw new Error('Booking not found.')
    if (!input.refundDate) throw new Error('Refund date is required.')
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Refund amount must be greater than zero.')
    }
    const customer = customerFor(booking.customerId)
    if (booking.status === 'Dibatalkan') {
      const maxPaid = booking.cancelledPaidAmount ?? 0
      const alreadyRefunded = refunds.value
        .filter((r) => r.bookingId === booking.id)
        .reduce((sum, r) => sum + r.amount, 0)
      const remaining = Math.max(0, maxPaid - alreadyRefunded)
      if (input.amount > remaining) {
        throw new Error(
          maxPaid <= 0
            ? 'This PO has no received funds eligible for refund.'
            : `Refund amount exceeds remaining paid funds (${new Intl.NumberFormat('id-ID').format(remaining)}).`,
        )
      }
    }
    const refund: BookingRefund = {
      id: uid(),
      refundNumber: `RFD-${new Date(input.refundDate).getFullYear()}-${String(refunds.value.length + 1).padStart(4, '0')}`,
      bookingId: booking.id,
      poNumber: booking.poNumber,
      customerName: customer?.name ?? 'Customer',
      refundDate: input.refundDate,
      amount: Math.round(input.amount),
      method: input.method,
      proofImageUrl: input.proofImageUrl || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    }
    refunds.value.unshift(refund)
    const cancelExpense: Expense = {
      id: uid(),
      date: refund.refundDate,
      category: 'Cancel Refund',
      description: `Cancel Payment — ${booking.poNumber} (${customer?.name ?? 'Customer'})`,
      amount: refund.amount,
      bookingId: booking.id,
      expenseScope: 'Berdasarkan PO',
      proofImageUrl: refund.proofImageUrl,
      method: refund.method,
      source: 'Bayar Cancel',
      refundId: refund.id,
    }
    expenses.value.unshift(cancelExpense)
    addActivity(
      'Cancel refund recorded',
      `${refund.refundNumber} (${booking.poNumber}) of Rp. ${new Intl.NumberFormat('id-ID').format(refund.amount)}`,
      'rose',
    )
    syncRefund(refund)
    syncExpense(cancelExpense)
    return refund
  }

  const updateBookingRefund = (
    id: string,
    input: {
      bookingId: string
      refundDate: string
      amount: number
      method: BookingRefund['method']
      proofImageUrl?: string
      notes?: string
    },
  ) => {
    const existing = refunds.value.find((r) => r.id === id)
    if (!existing) throw new Error('Refund record not found.')
    const booking = bookingFor(input.bookingId) ?? bookingFor(existing.bookingId)
    if (!booking) throw new Error('Booking not found.')
    if (!input.amount || input.amount <= 0) throw new Error('Refund amount must be greater than Rp. 0.')

    const customer = customerFor(booking.customerId)
    existing.bookingId = booking.id
    existing.refundDate = input.refundDate
    existing.amount = Math.round(Number(input.amount))
    existing.method = input.method
    existing.proofImageUrl = input.proofImageUrl || undefined
    existing.notes = input.notes?.trim() || undefined

    const linkedExpense = expenses.value.find((e) => e.refundId === existing.id)
    if (linkedExpense) {
      linkedExpense.bookingId = booking.id
      linkedExpense.date = existing.refundDate
      linkedExpense.amount = existing.amount
      linkedExpense.method = existing.method
      linkedExpense.proofImageUrl = existing.proofImageUrl
      linkedExpense.description = `Cancel Payment — ${booking.poNumber} (${customer?.name ?? 'Customer'})`
      syncExpense(linkedExpense)
    }

    addActivity(
      'Cancel refund updated',
      `${existing.refundNumber} (${booking.poNumber}) updated to Rp. ${new Intl.NumberFormat('id-ID').format(existing.amount)}`,
      'blue',
    )
    syncRefund(existing)
    return existing
  }

  const cancelBooking = (
    bookingId: string,
    refundInput?: {
      refundDate: string
      amount: number
      method: BookingRefund['method']
      proofImageUrl?: string
      notes?: string
    },
  ) => {
    const booking = bookingFor(bookingId)
    if (!booking) throw new Error('Booking not found.')
    const customer = customerFor(booking.customerId)
    const paidBefore = bookingPaid(bookingId)

    if (refundInput && refundInput.amount > 0 && refundInput.amount > paidBefore) {
      throw new Error(
        paidBefore <= 0
          ? 'Customer has no paid balance, so refund amount must be Rp. 0.'
          : `Refund amount exceeds total received funds (Rp. ${new Intl.NumberFormat('id-ID').format(paidBefore)}).`,
      )
    }

    booking.status = 'Dibatalkan'
    if (paidBefore > 0) {
      booking.cancelledPaidAmount = (booking.cancelledPaidAmount ?? 0) + paidBefore
    }

    // Remove all orders/invoices and payments under this cancelled PO
    invoices.value = invoices.value.filter((inv) => inv.bookingId !== bookingId)
    payments.value = payments.value.filter((pay) => pay.bookingId !== bookingId)

    addActivity('Booking cancelled', `${booking.poNumber} · ${customer?.name ?? 'Customer'}`, 'rose')
    syncCancelBookingCascade(booking)

    if (refundInput && refundInput.amount > 0) {
      addBookingRefund({
        bookingId,
        ...refundInput,
      })
    }
    return booking
  }

  const addPayment = (input: { bookingId: string; amount: number; method: Payment['method']; paidAt: string; notes?: string }) => {
    const balance = bookingBalance(input.bookingId)
    if (input.amount <= 0 || input.amount > balance) throw new Error('Payment amount must be positive and cannot exceed remaining balance.')
    const payment: Payment = {
      id: uid(),
      receiptNumber: `KWT-${new Date(input.paidAt).getFullYear()}-${String(payments.value.length + 1).padStart(4, '0')}`,
      ...input,
    }
    payments.value.unshift(payment)
    const booking = bookingFor(input.bookingId)
    addActivity('Payment received', `${booking?.poNumber ?? 'PO'} for Rp. ${new Intl.NumberFormat('id-ID').format(input.amount)}`, 'green')
    syncPayment(payment, {
      totalBilling: bookingTotal(input.bookingId),
      totalPaid: bookingPaid(input.bookingId),
      balance: bookingBalance(input.bookingId),
    })
    return payment
  }

  const updatePayment = (
    id: string,
    input: { amount: number; method: Payment['method']; paidAt: string; notes?: string },
  ) => {
    const payment = payments.value.find((p) => p.id === id)
    if (!payment) throw new Error('Payment record not found.')
    const maxAllowed = bookingBalance(payment.bookingId) + payment.amount
    if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > maxAllowed) {
      throw new Error('Payment amount must be positive and cannot exceed remaining balance.')
    }
    if (!input.paidAt) throw new Error('Payment date is required.')
    Object.assign(payment, {
      amount: Math.round(input.amount),
      method: input.method,
      paidAt: input.paidAt,
      notes: input.notes?.trim() || undefined,
    })
    addActivity('Payment updated', `${payment.receiptNumber} · Rp. ${new Intl.NumberFormat('id-ID').format(payment.amount)}`, 'blue')
    syncPayment(payment, {
      totalBilling: bookingTotal(payment.bookingId),
      totalPaid: bookingPaid(payment.bookingId),
      balance: bookingBalance(payment.bookingId),
    })
    return payment
  }

  const deletePayment = (id: string) => {
    const idx = payments.value.findIndex((p) => p.id === id)
    if (idx < 0) throw new Error('Payment record not found.')
    const [removed] = payments.value.splice(idx, 1)
    if (removed) {
      addActivity('Payment deleted', `${removed.receiptNumber} for Rp. ${new Intl.NumberFormat('id-ID').format(removed.amount)}`, 'rose')
      syncDeletePayment(removed.id)
    }
    return removed
  }

  const addCatalogItem = (input: Omit<CatalogItem, 'id' | 'code'>) => {
    const item: CatalogItem = { ...input, id: uid(), code: `CAT-${String(catalog.value.length + 1).padStart(4, '0')}` }
    catalog.value.unshift(item)
    addActivity('Service added', `${item.name} added to ${item.type} catalog`, 'blue')
    syncCatalogItem(item)
  }

  const updateCatalogItem = (id: string, input: Omit<CatalogItem, 'id' | 'code'>) => {
    const item = catalog.value.find((entry) => entry.id === id)
    if (!item) throw new Error('Catalog service not found.')
    Object.assign(item, input)
    addActivity('Service updated', `${item.name} in ${item.type} catalog`, 'blue')
    syncCatalogItem(item)
    return item
  }

  const snapshotLineItems = (lines: Array<{ catalogItemId: string; quantity: number; customerPrice: number }>): InvoiceItem[] =>
    lines.map((line) => {
      const catalogItem = catalog.value.find((item) => item.id === line.catalogItemId && item.active)
      if (!catalogItem) throw new Error('One or more selected services are unavailable or inactive.')
      if (!Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.customerPrice) || line.customerPrice < 0) {
        throw new Error('Invalid quantity or unit price.')
      }
      return {
        id: uid(),
        catalogItemId: catalogItem.id,
        serviceType: catalogItem.type,
        name: catalogItem.name,
        quantity: line.quantity,
        catalogPrice: catalogItem.price,
        unitPrice: Math.round(line.customerPrice),
        unit: catalogItem.unit,
      }
    })

  const createInvoiceFromOrder = (input: {
    bookingId: string
    kind?: Invoice['kind']
    issuedAt: string
    orderDate?: string
    dueDate?: string
    items: Array<{ catalogItemId: string; quantity: number; customerPrice: number }>
  }) => {
    const booking = bookingFor(input.bookingId)
    if (!booking) throw new Error('Booking not found.')
    if (!input.items.length) throw new Error('Add at least one service item.')
    if (!input.issuedAt) throw new Error('Invoice issue date is required.')
    const orderDate = input.orderDate || input.issuedAt

    if (input.kind === 'Additional') {
      return addOrderGroupToBooking({
        bookingId: input.bookingId,
        orderDate,
        items: input.items,
      })
    }

    if (bookingInvoice(input.bookingId)) {
      throw new Error('This booking already has an initial order and invoice.')
    }

    const invoiceItems = sortInvoiceItemsIntiFirst(snapshotLineItems(input.items))
    const initialGroup: OrderGroup = {
      id: uid(),
      kind: 'Awal',
      orderDate,
      createdAt: new Date().toISOString(),
      items: invoiceItems,
    }

    const invoice: Invoice = {
      id: uid(),
      invoiceNumber: `INV-${new Date(input.issuedAt).getFullYear()}-${String(invoices.value.length + 1).padStart(4, '0')}`,
      bookingId: input.bookingId,
      kind: 'Utama',
      issuedAt: input.issuedAt,
      dueDate: input.dueDate,
      groups: [initialGroup],
      items: [...invoiceItems],
    }
    invoices.value.unshift(invoice)
    addActivity('Initial order created', `${invoice.invoiceNumber} for ${booking.poNumber}`, 'blue')
    syncInvoiceOrderGroup(invoice, initialGroup)
    return invoice
  }

  const addOrderGroupToBooking = (input: {
    bookingId: string
    orderDate: string
    items: Array<{ catalogItemId: string; quantity: number; customerPrice: number }>
  }) => {
    const booking = bookingFor(input.bookingId)
    if (!booking) throw new Error('Booking not found.')
    const invoice = bookingInvoice(input.bookingId)
    if (!invoice) throw new Error('An initial order must exist before adding extra service batches.')
    if (!input.orderDate) throw new Error('Order date is required.')
    if (!input.items.length) throw new Error('Add at least one service item.')

    const snappedItems = sortInvoiceItemsIntiFirst(snapshotLineItems(input.items))
    const newGroup: OrderGroup = {
      id: uid(),
      kind: 'Tambahan',
      orderDate: input.orderDate,
      createdAt: new Date().toISOString(),
      items: snappedItems,
    }

    invoice.groups = sortGroupsChronologically([...invoice.groups, newGroup])
    invoice.items = invoice.groups.flatMap((g) => g.items)

    addActivity('Add-on order recorded', `${booking.poNumber} · ${snappedItems.length} item(s) on ${input.orderDate}`, 'amber')
    syncInvoiceOrderGroup(invoice, newGroup)
    return invoice
  }

  const updateOrderGroup = (
    bookingId: string,
    groupId: string,
    input: {
      orderDate: string
      items: Array<{
        id?: string
        catalogItemId?: string
        serviceType?: CatalogType
        name?: string
        catalogPrice?: number
        unit?: string
        quantity: number
        customerPrice: number
      }>
    },
  ) => {
    const booking = bookingFor(bookingId)
    if (!booking) throw new Error('Booking not found.')
    const invoice = bookingInvoice(bookingId)
    if (!invoice) throw new Error('Invoice not found.')
    const groupIndex = invoice.groups.findIndex((g) => g.id === groupId)
    if (groupIndex < 0) throw new Error('Order group not found.')
    if (!input.orderDate) throw new Error('Order date is required.')
    if (!input.items.length) throw new Error('An order group must contain at least one service item.')

    const existingGroup = invoice.groups[groupIndex]!
    const nextItems: InvoiceItem[] = input.items.map((line) => {
      if (!Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.customerPrice) || line.customerPrice < 0) {
        throw new Error('Invalid quantity or customer unit price.')
      }
      const prevItem = line.id ? existingGroup.items.find((it) => it.id === line.id) : undefined
      if (prevItem && (!line.catalogItemId || line.catalogItemId === prevItem.catalogItemId)) {
        return {
          ...prevItem,
          quantity: line.quantity,
          unitPrice: Math.round(line.customerPrice),
        }
      }
      const catalogItem = catalog.value.find((c) => c.id === line.catalogItemId)
      if (!catalogItem) throw new Error('Select a valid catalog service on every line.')
      return {
        id: line.id || uid(),
        catalogItemId: catalogItem.id,
        serviceType: catalogItem.type,
        name: catalogItem.name,
        quantity: line.quantity,
        catalogPrice: catalogItem.price,
        unitPrice: Math.round(line.customerPrice),
        unit: catalogItem.unit,
      }
    })

    const updatedGroup: OrderGroup = {
      ...existingGroup,
      orderDate: input.orderDate,
      items: sortInvoiceItemsIntiFirst(nextItems),
    }

    const updatedGroups = [...invoice.groups]
    updatedGroups.splice(groupIndex, 1, updatedGroup)
    invoice.groups = sortGroupsChronologically(updatedGroups)
    invoice.items = invoice.groups.flatMap((g) => g.items)

    addActivity('Order updated', `${booking.poNumber} · group ${existingGroup.kind}`, 'blue')
    syncInvoiceOrderGroup(invoice, updatedGroup)
    return invoice
  }

  const deleteOrderGroup = (bookingId: string, groupId: string) => {
    const booking = bookingFor(bookingId)
    if (!booking) throw new Error('Booking not found.')
    const invoice = bookingInvoice(bookingId)
    if (!invoice) throw new Error('Invoice not found.')
    const idx = invoice.groups.findIndex((g) => g.id === groupId)
    if (idx < 0) throw new Error('Order group not found.')
    const target = invoice.groups[idx]!
    if (invoice.groups.length <= 1) {
      throw new Error('At least one order group must remain on a PO. Cancel the PO to remove the entire order.')
    }
    invoice.groups.splice(idx, 1)
    invoice.groups = sortGroupsChronologically(invoice.groups)
    invoice.items = invoice.groups.flatMap((g) => g.items)
    addActivity('Order group removed', `${booking.poNumber} · ${target.kind}`, 'rose')
    syncDeleteOrderGroup(invoice.id, target.id)
    return invoice
  }

  const addExpense = (input: Omit<Expense, 'id'>) => {
    const rec: Expense = { id: uid(), ...input }
    expenses.value.unshift(rec)
    addActivity('Expense recorded', input.description, 'rose')
    syncExpense(rec)
  }

  const addBatchExpenses = (input: {
    date: string
    method: string
    expenseScope: 'Berdasarkan PO' | 'Di Luar PO'
    bookingId?: string
    proofImageUrl?: string
    items: Array<{ category: string; description: string; amount: number; proofImageUrl?: string }>
  }) => {
    if (!input.date) throw new Error('Expense date is required.')
    if (!input.items.length) throw new Error('Add at least one expense item.')
    if (input.expenseScope === 'Berdasarkan PO' && !input.bookingId) {
      throw new Error('Select a PO Number for PO-linked expenses.')
    }
    for (const row of input.items) {
      if (!row.description.trim()) throw new Error('Description is required on all expense lines.')
      if (!Number.isFinite(row.amount) || row.amount <= 0) {
        throw new Error(`Amount for "${row.description.trim()}" must be greater than zero.`)
      }
    }

    const created: Expense[] = []
    for (const row of [...input.items].reverse()) {
      const record: Expense = {
        id: uid(),
        date: input.date,
        category: row.category,
        description: row.description.trim(),
        amount: Math.round(row.amount),
        method: input.method,
        expenseScope: input.expenseScope,
        bookingId: input.expenseScope === 'Berdasarkan PO' ? input.bookingId : undefined,
        proofImageUrl: row.proofImageUrl || input.proofImageUrl || undefined,
        source: 'Manual',
      }
      expenses.value.unshift(record)
      created.unshift(record)
      syncExpense(record)
    }

    const totalSum = created.reduce((s, r) => s + r.amount, 0)
    addActivity(
      'Expenses recorded',
      `${created.length} expense item(s) totaling Rp. ${new Intl.NumberFormat('id-ID').format(totalSum)}`,
      'rose',
    )
    return created
  }

  const updateExpense = (id: string, input: Omit<Expense, 'id'>) => {
    const existing = expenses.value.find((e) => e.id === id)
    if (!existing) throw new Error('Expense record not found.')
    Object.assign(existing, {
      ...input,
      bookingId: input.bookingId || undefined,
      proofImageUrl: input.proofImageUrl || undefined,
    })
    if (existing.refundId) {
      const linkedRefund = refunds.value.find((r) => r.id === existing.refundId)
      if (linkedRefund) {
        linkedRefund.amount = existing.amount
        linkedRefund.refundDate = existing.date
        linkedRefund.proofImageUrl = existing.proofImageUrl
        syncRefund(linkedRefund)
      }
    }
    addActivity('Expense updated', existing.description, 'blue')
    syncExpense(existing)
    return existing
  }

  const deleteExpense = (id: string) => {
    const idx = expenses.value.findIndex((e) => e.id === id)
    if (idx < 0) throw new Error('Expense record not found.')
    const [removed] = expenses.value.splice(idx, 1)
    if (removed) {
      addActivity('Expense deleted', removed.description, 'rose')
      syncDeleteExpense(removed.id)
    }
    return removed
  }

  const moveStock = (input: { itemId: string; type: 'Masuk' | 'Keluar'; quantity: number; date: string; pic: string; notes?: string; proofImageUrl?: string }) => {
    submitBatchStockMovement({
      type: input.type,
      date: input.date,
      pic: input.pic,
      notes: input.notes,
      proofImageUrl: input.proofImageUrl,
      items: [{ itemId: input.itemId, quantity: input.quantity }],
    })
  }

  const submitBatchStockMovement = (input: {
    type: 'Masuk' | 'Keluar'
    date: string
    pic: string
    notes?: string
    proofImageUrl?: string
    items: Array<{ itemId: string; quantity: number }>
  }) => {
    if (!input.pic.trim()) throw new Error('Staff PIC name is required.')
    if (!input.date) throw new Error('Transaction date is required.')
    if (!input.items.length) throw new Error('Add at least one inventory item.')

    // Validate all rows first (including summed qty if same item appears more than once)
    const qtyByItem = new Map<string, number>()
    for (const row of input.items) {
      if (!row.itemId) throw new Error('Select an item on every row.')
      if (!Number.isFinite(row.quantity) || row.quantity <= 0) throw new Error('Quantity must be greater than zero.')
      const item = inventory.value.find((entry) => entry.id === row.itemId)
      if (!item) throw new Error('Inventory item not found.')
      qtyByItem.set(row.itemId, (qtyByItem.get(row.itemId) ?? 0) + row.quantity)
    }

    if (input.type === 'Keluar') {
      for (const [itemId, totalQty] of qtyByItem.entries()) {
        const item = inventory.value.find((entry) => entry.id === itemId)!
        if (totalQty > stockAvailable(item)) {
          throw new Error(`Outgoing quantity for ${item.name} (${totalQty}) exceeds available stock (${stockAvailable(item)}).`)
        }
      }
    }

    const batchId = uid()
    for (const row of input.items) {
      const item = inventory.value.find((entry) => entry.id === row.itemId)!
      if (input.type === 'Masuk') item.stockIn += row.quantity
      else item.stockOut += row.quantity
      const mov: StockMovement = {
        id: uid(),
        batchId,
        itemId: row.itemId,
        type: input.type,
        quantity: row.quantity,
        date: input.date,
        pic: input.pic.trim(),
        notes: input.notes?.trim() || undefined,
        proofImageUrl: input.proofImageUrl || undefined,
      }
      movements.value.unshift(mov)
      syncStockMovement(mov)
    }

    addActivity(
      input.type === 'Masuk' ? 'Stock In recorded' : 'Stock Out recorded',
      `${input.items.length} item(s) handled by ${input.pic.trim()}`,
      input.type === 'Masuk' ? 'green' : 'amber',
    )
    return batchId
  }

  const submitStockOpname = (input: {
    date: string
    pic: string
    notes?: string
    items: Array<{ itemId: string; physicalStock: number; notes?: string }>
  }) => {
    if (!input.pic.trim()) throw new Error('Stock opname auditor PIC is required.')
    if (!input.date) throw new Error('Stock opname date is required.')
    if (!input.items.length) throw new Error('Select at least one item for stock opname.')

    const opnameItems: StockOpnameItem[] = input.items.map((row) => {
      const item = inventory.value.find((entry) => entry.id === row.itemId)
      if (!item) throw new Error('Inventory item not found.')
      if (!Number.isFinite(row.physicalStock) || row.physicalStock < 0) {
        throw new Error(`Physical stock count for ${item.name} cannot be negative.`)
      }
      const systemStock = stockAvailable(item)
      const diff = row.physicalStock - systemStock
      return {
        itemId: item.id,
        itemName: item.name,
        itemCode: item.code,
        unit: item.unit,
        systemStock,
        physicalStock: row.physicalStock,
        diff,
        notes: row.notes?.trim() || undefined,
      }
    })

    const recordId = uid()
    const opAdjMovements: StockMovement[] = []
    for (const line of opnameItems) {
      if (line.diff !== 0) {
        const item = inventory.value.find((entry) => entry.id === line.itemId)!
        item.stockAdjustment = (item.stockAdjustment ?? 0) + line.diff
        const adjMov: StockMovement = {
          id: uid(),
          opnameId: recordId,
          itemId: item.id,
          type: 'Penyesuaian',
          quantity: line.diff,
          date: input.date,
          pic: input.pic.trim(),
          notes: `Stock Opname${line.notes ? ` · ${line.notes}` : ''}`,
        }
        movements.value.unshift(adjMov)
        opAdjMovements.push(adjMov)
      }
    }

    const record: StockOpnameRecord = {
      id: recordId,
      opnameNumber: `SO-${new Date(input.date).getFullYear()}-${String(stockOpnames.value.length + 1).padStart(4, '0')}`,
      date: input.date,
      pic: input.pic.trim(),
      notes: input.notes?.trim() || undefined,
      items: opnameItems,
      createdAt: new Date().toISOString(),
    }
    stockOpnames.value.unshift(record)
    syncStockOpname(record, opAdjMovements)

    const diffCount = opnameItems.filter((i) => i.diff !== 0).length
    addActivity(
      'Stock opname reconciled',
      `${record.opnameNumber} · ${opnameItems.length} item(s) audited (${diffCount} adjusted)`,
      diffCount > 0 ? 'amber' : 'green',
    )
    return record
  }

  const updateStockMovement = (
    id: string,
    input: { itemId: string; type: 'Masuk' | 'Keluar'; quantity: number; date: string; pic: string; notes?: string; proofImageUrl?: string },
  ) => {
    const mov = movements.value.find((m) => m.id === id)
    if (!mov) throw new Error('Stock movement record not found.')
    if (!input.pic.trim()) throw new Error('Staff PIC name is required.')
    if (!input.date) throw new Error('Transaction date is required.')
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('Quantity must be greater than zero.')

    const oldItem = inventory.value.find((i) => i.id === mov.itemId)
    const newItem = inventory.value.find((i) => i.id === input.itemId)
    if (!newItem) throw new Error('Target item not found.')

    if (oldItem) {
      if (mov.type === 'Masuk') oldItem.stockIn = Math.max(0, oldItem.stockIn - mov.quantity)
      else if (mov.type === 'Keluar') oldItem.stockOut = Math.max(0, oldItem.stockOut - mov.quantity)
    }

    if (input.type === 'Keluar' && input.quantity > stockAvailable(newItem)) {
      if (oldItem) {
        if (mov.type === 'Masuk') oldItem.stockIn += mov.quantity
        else if (mov.type === 'Keluar') oldItem.stockOut += mov.quantity
      }
      throw new Error(`Outgoing quantity for ${newItem.name} (${input.quantity}) exceeds available stock (${stockAvailable(newItem)}).`)
    }

    if (input.type === 'Masuk') newItem.stockIn += input.quantity
    else newItem.stockOut += input.quantity

    Object.assign(mov, {
      itemId: input.itemId,
      type: input.type,
      quantity: input.quantity,
      date: input.date,
      pic: input.pic.trim(),
      notes: input.notes?.trim() || undefined,
      proofImageUrl: input.proofImageUrl || undefined,
    })

    addActivity(`Stock ${input.type === 'Masuk' ? 'In' : 'Out'} updated`, `${newItem.name} (${input.quantity} ${newItem.unit})`, 'blue')
    syncStockMovement(mov)
    return mov
  }

  const deleteStockMovement = (id: string) => {
    const idx = movements.value.findIndex((m) => m.id === id)
    if (idx < 0) throw new Error('Stock movement record not found.')
    const [removed] = movements.value.splice(idx, 1)
    if (removed) {
      const item = inventory.value.find((i) => i.id === removed.itemId)
      if (item) {
        if (removed.type === 'Masuk') item.stockIn = Math.max(0, item.stockIn - removed.quantity)
        else if (removed.type === 'Keluar') item.stockOut = Math.max(0, item.stockOut - removed.quantity)
        else item.stockAdjustment = (item.stockAdjustment ?? 0) - removed.quantity
      }
      addActivity('Stock movement deleted', `${item?.name ?? 'Item'} · ${removed.type}`, 'rose')
      syncDeleteStockMovement(removed.id)
    }
    return removed
  }

  const updateStockOpname = (
    id: string,
    input: { date: string; pic: string; notes?: string; items: Array<{ itemId: string; physicalStock: number; notes?: string }> },
  ) => {
    const record = stockOpnames.value.find((r) => r.id === id)
    if (!record) throw new Error('Stock opname record not found.')
    if (!input.pic.trim()) throw new Error('Staff PIC name is required.')
    if (!input.date) throw new Error('Stock opname date is required.')
    if (!input.items.length) throw new Error('Select at least one item.')

    for (const prevLine of record.items) {
      if (prevLine.diff !== 0) {
        const item = inventory.value.find((i) => i.id === prevLine.itemId)
        if (item) item.stockAdjustment = (item.stockAdjustment ?? 0) - prevLine.diff
      }
    }
    movements.value = movements.value.filter((m) => m.opnameId !== record.id)

    const nextItems: StockOpnameItem[] = input.items.map((row) => {
      const item = inventory.value.find((entry) => entry.id === row.itemId)
      if (!item) throw new Error('Inventory item not found.')
      if (!Number.isFinite(row.physicalStock) || row.physicalStock < 0) {
        throw new Error(`Physical stock count for ${item.name} cannot be negative.`)
      }
      const systemStock = stockAvailable(item)
      const diff = row.physicalStock - systemStock
      return {
        itemId: item.id,
        itemName: item.name,
        itemCode: item.code,
        unit: item.unit,
        systemStock,
        physicalStock: row.physicalStock,
        diff,
        notes: row.notes?.trim() || undefined,
      }
    })

    const nextOpAdjMovements: StockMovement[] = []
    for (const line of nextItems) {
      if (line.diff !== 0) {
        const item = inventory.value.find((entry) => entry.id === line.itemId)!
        item.stockAdjustment = (item.stockAdjustment ?? 0) + line.diff
        const adjMov: StockMovement = {
          id: uid(),
          opnameId: record.id,
          itemId: item.id,
          type: 'Penyesuaian',
          quantity: line.diff,
          date: input.date,
          pic: input.pic.trim(),
          notes: `Stock Opname${line.notes ? ` · ${line.notes}` : ''}`,
        }
        movements.value.unshift(adjMov)
        nextOpAdjMovements.push(adjMov)
      }
    }

    Object.assign(record, {
      date: input.date,
      pic: input.pic.trim(),
      notes: input.notes?.trim() || undefined,
      items: nextItems,
    })

    addActivity('Stock opname updated', `${record.opnameNumber} · ${nextItems.length} item(s)`, 'blue')
    syncStockOpname(record, nextOpAdjMovements)
    return record
  }

  const deleteStockOpname = (id: string) => {
    const idx = stockOpnames.value.findIndex((r) => r.id === id)
    if (idx < 0) throw new Error('Stock opname record not found.')
    const [removed] = stockOpnames.value.splice(idx, 1)
    if (removed) {
      for (const line of removed.items) {
        if (line.diff !== 0) {
          const item = inventory.value.find((i) => i.id === line.itemId)
          if (item) item.stockAdjustment = (item.stockAdjustment ?? 0) - line.diff
        }
      }
      movements.value = movements.value.filter((m) => m.opnameId !== removed.id)
      addActivity('Stock opname deleted', removed.opnameNumber, 'rose')
      syncDeleteStockOpname(removed.id)
    }
    return removed
  }

  const addInventoryItem = (input: Omit<InventoryItem, 'id' | 'code' | 'stockIn' | 'stockOut' | 'stockAdjustment' | 'active'>) => {
    const item: InventoryItem = {
      ...input,
      id: uid(),
      code: `BRG-${String(inventory.value.length + 1).padStart(4, '0')}`,
      stockIn: 0,
      stockOut: 0,
      stockAdjustment: 0,
      active: true,
    }
    inventory.value.unshift(item)
    addActivity('New inventory item added', `${item.name} added to inventory catalog`, 'blue')
    syncInventoryItem(item)
    return item
  }

  const updateInventoryItem = (id: string, input: {
    name: string
    category: string
    unit: string
    location: string
    initialStock: number
    minimumStock: number
    imageUrl?: string
  }) => {
    const item = inventory.value.find((entry) => entry.id === id)
    if (!item) throw new Error('Inventory item not found.')
    Object.assign(item, {
      name: input.name.trim(),
      category: input.category.trim(),
      unit: input.unit.trim(),
      location: input.location.trim(),
      initialStock: Math.max(0, Number(input.initialStock) || 0),
      minimumStock: Math.max(0, Number(input.minimumStock) || 0),
      imageUrl: input.imageUrl !== undefined ? (input.imageUrl || undefined) : item.imageUrl,
    })
    addActivity('Inventory item updated', `${item.name} updated in inventory catalog`, 'blue')
    syncInventoryItem(item)
    return item
  }

  const deleteInventoryItem = (id: string) => {
    const idx = inventory.value.findIndex((entry) => entry.id === id)
    if (idx < 0) throw new Error('Inventory item not found.')
    const [removed] = inventory.value.splice(idx, 1)
    if (removed) {
      addActivity('Inventory item deleted', `${removed.name} removed from inventory catalog`, 'rose')
      syncDeleteInventoryItem(removed.id)
    }
    return removed
  }

  const addWeddingAttire = (input: Omit<WeddingAttire, 'id' | 'code'>) => {
    const item: WeddingAttire = {
      ...input,
      id: uid(),
      code: `BTR-${String(weddingAttire.value.length + 1).padStart(4, '0')}`,
    }
    weddingAttire.value.unshift(item)
    addActivity('Attire added', `${item.name} · ${item.category} · Size ${item.size}`, 'blue')
    syncWeddingAttire(item)
    return item
  }

  const updateWeddingAttire = (id: string, input: Omit<WeddingAttire, 'id' | 'code'>) => {
    const item = weddingAttire.value.find((entry) => entry.id === id)
    if (!item) throw new Error('Attire not found.')
    Object.assign(item, input)
    addActivity('Attire updated', `${item.name} · ${item.category} · Size ${item.size}`, 'blue')
    syncWeddingAttire(item)
    return item
  }

  const updateWeddingAttireStatus = (id: string, status: AttireStatus) => {
    const item = weddingAttire.value.find((entry) => entry.id === id)
    if (!item) throw new Error('Attire not found.')
    item.status = status
    addActivity('Attire status updated', `${item.name} → ${status === 'Tersedia' ? 'Available' : status}`, 'blue')
    syncWeddingAttire(item)
  }

  const saveWeddingForm = (input: WeddingFittingForm) => {
    if (!bookingFor(input.bookingId)) throw new Error('Select a PO Number before saving the fitting form.')
    const index = weddingForms.value.findIndex((form) => form.bookingId === input.bookingId)
    const form = { ...input, updatedAt: new Date().toISOString() }
    if (index >= 0) weddingForms.value.splice(index, 1, form)
    else weddingForms.value.unshift(form)
    const booking = bookingFor(input.bookingId)
    addActivity('Fitting form saved', `${booking?.poNumber} · ${customerFor(booking?.customerId ?? '')?.name}`, 'green')
    syncWeddingForm(form)
    return form
  }

  const deleteWeddingForm = (bookingId: string) => {
    const index = weddingForms.value.findIndex((form) => form.bookingId === bookingId)
    if (index >= 0) weddingForms.value.splice(index, 1)
    const booking = bookingFor(bookingId)
    addActivity('Fitting form deleted', booking?.poNumber || bookingId, 'rose')
    syncDeleteWeddingForm(bookingId)
  }

  const activeEmployees = computed(() => employees.value.filter((emp) => emp.active))

  const addEmployee = (input: { name: string; role: string; email?: string; phone?: string; active?: boolean }) => {
    const cleanName = input.name.trim()
    if (!cleanName) throw new Error('Employee name is required.')
    const emp: EmployeeRecord = {
      id: uid(),
      name: cleanName,
      role: input.role.trim() || 'MUA / Team',
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      active: input.active ?? true,
      lastLogin: 'Just added',
    }
    employees.value.push(emp)
    addActivity('Employee added', `${emp.name} (${emp.role})`, 'blue')
    syncEmployee(emp)
    return emp
  }

  const updateEmployee = (id: string, input: Partial<Omit<EmployeeRecord, 'id'>>) => {
    const emp = employees.value.find((e) => e.id === id)
    if (!emp) throw new Error('Employee not found.')
    if (typeof input.name === 'string') emp.name = input.name.trim()
    if (typeof input.role === 'string') emp.role = input.role.trim()
    if (input.email !== undefined) emp.email = input.email?.trim() || undefined
    if (input.phone !== undefined) emp.phone = input.phone?.trim() || undefined
    if (typeof input.active === 'boolean') emp.active = input.active
    addActivity('Employee updated', `${emp.name} (${emp.role})`, 'blue')
    syncEmployee(emp)
    return emp
  }

  const toggleEmployeeStatus = (id: string) => {
    const emp = employees.value.find((e) => e.id === id)
    if (!emp) throw new Error('Employee not found.')
    emp.active = !emp.active
    addActivity('Employee status updated', `${emp.name} is now ${emp.active ? 'Active' : 'Inactive'}`, emp.active ? 'green' : 'amber')
    syncEmployee(emp)
    return emp
  }

  const jobForBooking = (bookingId: string) =>
    jobAssignments.value.find((job) => job.bookingId === bookingId)

  const assignedEmployeesForBooking = (bookingId: string) => {
    const job = jobForBooking(bookingId)
    if (!job?.employeeIds.length) return []
    return job.employeeIds
      .map((empId) => employees.value.find((e) => e.id === empId))
      .filter((e): e is EmployeeRecord => Boolean(e))
  }

  const toggleBookingEmployee = (bookingId: string, employeeId: string) => {
    const booking = bookingFor(bookingId)
    if (!booking) throw new Error('Booking PO not found.')
    let job = jobForBooking(bookingId)
    if (!job) {
      job = { bookingId, employeeIds: [], updatedAt: new Date().toISOString() }
      jobAssignments.value.unshift(job)
    }
    const idx = job.employeeIds.indexOf(employeeId)
    const empName = employees.value.find((e) => e.id === employeeId)?.name || 'Staff'
    if (idx >= 0) {
      job.employeeIds.splice(idx, 1)
      addActivity('Staff unassigned', `${empName} removed from ${booking.poNumber}`, 'amber')
    } else {
      job.employeeIds.push(employeeId)
      addActivity('Staff assigned', `${empName} assigned to ${booking.poNumber}`, 'green')
    }
    job.updatedAt = new Date().toISOString()
    syncJobAssignment(job)
    return job
  }

  const setBookingJobNotes = (bookingId: string, notes: string) => {
    const booking = bookingFor(bookingId)
    if (!booking) throw new Error('Booking PO not found.')
    let job = jobForBooking(bookingId)
    if (!job) {
      job = { bookingId, employeeIds: [], updatedAt: new Date().toISOString() }
      jobAssignments.value.unshift(job)
    }
    job.notes = notes.trim() || undefined
    job.updatedAt = new Date().toISOString()
    addActivity('Assignment notes updated', booking.poNumber, 'blue')
    syncJobAssignment(job)
    return job
  }

  const updateBusinessProfile = (patch: Partial<BusinessProfile>) => {
    Object.assign(businessProfile.value, patch)
    addActivity('Business profile updated', businessProfile.value.name || 'Azura Makeup Artist', 'blue')
    syncBusinessProfile(businessProfile.value)
    return businessProfile.value
  }

  const dropdownListRef = (group: DropdownOptionGroup) => {
    if (group === 'paymentMethods') return paymentMethods
    if (group === 'poExpenseCategories') return poExpenseCategories
    if (group === 'generalExpenseCategories') return generalExpenseCategories
    if (group === 'stylingTypes') return stylingTypes
    if (group === 'inventoryCategories') return inventoryCategories
    return units
  }

  const addDropdownOption = (group: DropdownOptionGroup, rawLabel: string) => {
    const label = rawLabel.trim()
    if (!label) throw new Error('Dropdown option label is required.')
    const target = dropdownListRef(group)
    if (target.value.some((item) => item.toLowerCase() === label.toLowerCase())) {
      throw new Error(`Option "${label}" already exists.`)
    }
    target.value.push(label)
    addActivity('Dropdown settings updated', `Added option "${label}"`, 'blue')
    syncDropdownGroup(group, target.value)
    return label
  }

  const updateDropdownOption = (group: DropdownOptionGroup, oldLabel: string, rawNextLabel: string) => {
    const nextLabel = rawNextLabel.trim()
    if (!nextLabel) throw new Error('Dropdown option label cannot be empty.')
    const target = dropdownListRef(group)
    const index = target.value.indexOf(oldLabel)
    if (index < 0) throw new Error('Option not found.')
    if (
      nextLabel.toLowerCase() !== oldLabel.toLowerCase()
      && target.value.some((item) => item.toLowerCase() === nextLabel.toLowerCase())
    ) {
      throw new Error(`Option "${nextLabel}" already exists.`)
    }
    target.value.splice(index, 1, nextLabel)
    addActivity('Dropdown settings updated', `${oldLabel} -> ${nextLabel}`, 'blue')
    syncDropdownGroup(group, target.value)
    return nextLabel
  }

  const removeDropdownOption = (group: DropdownOptionGroup, label: string) => {
    const target = dropdownListRef(group)
    if (target.value.length <= 1) {
      throw new Error('At least 1 active option must remain.')
    }
    target.value = target.value.filter((item) => item !== label)
    addActivity('Dropdown option removed', label, 'amber')
    syncDropdownGroup(group, target.value)
  }

  const hydrateFromSupabase = async () => {
    const remote = await pullAllFromSupabase()
    if (!remote) return false

    if (remote.businessProfile) {
      Object.assign(businessProfile.value, remote.businessProfile)
    }
    if (remote.paymentMethods?.length) paymentMethods.value = remote.paymentMethods
    if (remote.poExpenseCategories?.length) poExpenseCategories.value = remote.poExpenseCategories
    if (remote.generalExpenseCategories?.length) generalExpenseCategories.value = remote.generalExpenseCategories
    if (remote.stylingTypes?.length) stylingTypes.value = remote.stylingTypes
    if (remote.inventoryCategories?.length) inventoryCategories.value = remote.inventoryCategories
    if (remote.units?.length) units.value = remote.units
    if (remote.employees) employees.value = remote.employees

    if (remote.customers) customers.value = remote.customers
    if (remote.bookings) bookings.value = remote.bookings
    if (remote.refunds) refunds.value = remote.refunds
    if (remote.jobAssignments) jobAssignments.value = remote.jobAssignments
    if (remote.catalog) catalog.value = remote.catalog
    if (remote.invoices) invoices.value = normalizeInvoices(remote.invoices, catalog.value)
    if (remote.payments) payments.value = remote.payments
    if (remote.expenses) expenses.value = remote.expenses
    if (remote.inventory) inventory.value = normalizeInventory(remote.inventory)
    if (remote.movements) movements.value = remote.movements
    if (remote.stockOpnames) stockOpnames.value = remote.stockOpnames
    if (remote.weddingAttire) weddingAttire.value = normalizeWeddingAttire(remote.weddingAttire)
    if (remote.weddingForms) weddingForms.value = normalizeWeddingForms(remote.weddingForms)

    return remote.hasRemoteData
  }

  const syncLocalDataToDatabase = async () => {
    await pushSnapshotToSupabase({
      businessProfile: businessProfile.value,
      paymentMethods: paymentMethods.value,
      poExpenseCategories: poExpenseCategories.value,
      generalExpenseCategories: generalExpenseCategories.value,
      employees: employees.value,
      customers: customers.value,
      bookings: bookings.value,
      refunds: refunds.value,
      jobAssignments: jobAssignments.value,
      catalog: catalog.value,
      invoices: invoices.value,
      payments: payments.value,
      expenses: expenses.value,
      inventory: inventory.value,
      movements: movements.value,
      stockOpnames: stockOpnames.value,
      weddingAttire: weddingAttire.value,
      weddingForms: weddingForms.value,
      bookingTotal,
      bookingPaid,
      bookingBalance,
    })
    addActivity('Sinkronisasi ke Supabase selesai', 'Seluruh data lokal tersimpan ke database Supabase', 'green')
  }

  if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') {
    void hydrateFromSupabase()
  }

  const resetDemo = () => {
    const fresh = seed()
    customers.value = fresh.customers
    bookings.value = fresh.bookings
    catalog.value = fresh.catalog
    invoices.value = fresh.invoices
    payments.value = fresh.payments
    inventory.value = fresh.inventory
    movements.value = fresh.movements
    stockOpnames.value = fresh.stockOpnames
    expenses.value = fresh.expenses
    activities.value = fresh.activities
    weddingAttire.value = fresh.weddingAttire
    weddingForms.value = fresh.weddingForms
    refunds.value = fresh.refunds
    employees.value = fresh.employees
    jobAssignments.value = fresh.jobAssignments
    businessProfile.value = fresh.businessProfile
    paymentMethods.value = fresh.paymentMethods
    poExpenseCategories.value = fresh.poExpenseCategories
    generalExpenseCategories.value = fresh.generalExpenseCategories
    stylingTypes.value = fresh.stylingTypes
    inventoryCategories.value = fresh.inventoryCategories
    units.value = fresh.units
  }

  let persistenceTimer: ReturnType<typeof setTimeout> | undefined

  const persistSnapshot = () => {
    if (isSupabaseMode || typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      customers: customers.value, bookings: bookings.value, catalog: catalog.value, invoices: invoices.value,
      payments: payments.value, refunds: refunds.value, inventory: inventory.value, movements: movements.value, stockOpnames: stockOpnames.value,
      expenses: expenses.value, activities: activities.value,
      weddingAttire: weddingAttire.value, weddingForms: weddingForms.value,
      employees: employees.value, jobAssignments: jobAssignments.value, businessProfile: businessProfile.value,
      paymentMethods: paymentMethods.value, poExpenseCategories: poExpenseCategories.value, generalExpenseCategories: generalExpenseCategories.value,
      stylingTypes: stylingTypes.value, inventoryCategories: inventoryCategories.value, units: units.value,
    }))
  }

  const schedulePersistence = () => {
    if (isSupabaseMode || typeof window === 'undefined') return
    if (persistenceTimer) clearTimeout(persistenceTimer)
    persistenceTimer = setTimeout(() => {
      persistenceTimer = undefined
      if ('requestIdleCallback' in window) window.requestIdleCallback(persistSnapshot, { timeout: 800 })
      else persistSnapshot()
    }, 180)
  }

  if (!isSupabaseMode) {
    watch([customers, bookings, catalog, invoices, payments, refunds, inventory, movements, stockOpnames, expenses, activities, weddingAttire, weddingForms, employees, jobAssignments, businessProfile, paymentMethods, poExpenseCategories, generalExpenseCategories, stylingTypes, inventoryCategories, units], () => {
      schedulePersistence()
    }, { deep: true })
  }

  if (!isSupabaseMode && typeof window !== 'undefined') {
    window.addEventListener('pagehide', persistSnapshot)
  }

  return {
    customers, bookings, catalog, invoices, payments, refunds, inventory, movements, stockOpnames, expenses, activities, weddingAttire, weddingForms,
    employees, jobAssignments, activeEmployees, businessProfile, paymentMethods, poExpenseCategories, generalExpenseCategories,
    stylingTypes, inventoryCategories, units,
    totalBilling, totalPaid, totalReceivable, totalExpenses, totalRefunds, totalCashOut, netCashflow, upcomingBookings, lowStock, laundryUrgentAlerts,
    groupTotal, sortedOrderGroups, sortInvoiceItemsIntiFirst, invoiceTotal, bookingInvoices, bookingInvoice, bookingPayments, bookingTotal, bookingPaid, bookingBalance, customerFor, bookingFor,
    stockAvailable, stockStatus, attireSchedule, effectiveAttireStatus, attireConflictsOnDate, urgentAttireSchedules, getLaundryUrgentAlerts,
    addBooking, updateBooking, cancelBooking, addBookingRefund, updateBookingRefund, addPayment, updatePayment, deletePayment, addCatalogItem, updateCatalogItem,
    createInvoiceFromOrder, addOrderGroupToBooking, updateOrderGroup, deleteOrderGroup,
    addExpense, addBatchExpenses, updateExpense, deleteExpense, moveStock, submitBatchStockMovement, submitStockOpname, updateStockMovement, deleteStockMovement, updateStockOpname, deleteStockOpname, addInventoryItem, updateInventoryItem, deleteInventoryItem,
    addWeddingAttire, updateWeddingAttire, updateWeddingAttireStatus, saveWeddingForm, deleteWeddingForm,
    addEmployee, updateEmployee, toggleEmployeeStatus, jobForBooking, assignedEmployeesForBooking, toggleBookingEmployee, setBookingJobNotes,
    updateBusinessProfile, addDropdownOption, updateDropdownOption, removeDropdownOption, resetDemo,
    actionToast, showActionToast, dismissActionToast, pdfDownloadState, runWithPdfLoader,
    dbSyncState: supabaseSyncState, refreshFromDatabase: hydrateFromSupabase, syncLocalDataToDatabase,
  }
})
