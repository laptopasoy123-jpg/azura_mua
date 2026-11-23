import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { reactive } from 'vue'
import type {
  AttireCategory,
  AttireStatus,
  Booking,
  BookingRefund,
  BookingStatus,
  BusinessProfile,
  CatalogItem,
  CatalogType,
  Customer,
  DropdownOptionGroup,
  EmployeeRecord,
  Expense,
  InventoryItem,
  Invoice,
  InvoiceItem,
  JobAssignment,
  OrderGroup,
  Payment,
  StockMovement,
  StockOpnameRecord,
  WeddingAttire,
  WeddingFittingForm,
} from '../stores/crm'

export const supabaseSyncState = reactive({
  configured: false,
  connected: false,
  syncing: false,
  remoteHasData: false,
  lastSyncedAt: '',
  lastError: '',
})

let client: SupabaseClient | null | undefined

export const getSupabaseClient = (): SupabaseClient | null => {
  if (client !== undefined) return client
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') {
    client = null
    return client
  }
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
  if (!url || !key || url.includes('your-project') || key.includes('xxx')) {
    client = null
    return client
  }
  supabaseSyncState.configured = true
  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  return client
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Deterministically map legacy short seed IDs ('c-1', 'b-1') to valid RFC-4122 UUIDs. */
export const toDbUuid = (id: string): string => {
  if (UUID_RE.test(id)) return id.toLowerCase()
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < id.length; i += 1) {
    const ch = id.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 0x01000193)
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b)
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = ((h2 >>> 0) & 0xffff).toString(16).padStart(4, '0')
  const hex3 = (((h2 >>> 16) & 0x0fff) | 0x4000).toString(16).padStart(4, '0')
  const hex4 = (((h1 >>> 16) & 0x3fff) | 0x8000).toString(16).padStart(4, '0')
  let tail = ''
  for (let i = 0; i < 6; i += 1) {
    const byte = (id.charCodeAt(i % id.length) + i * 31) & 0xff
    tail += byte.toString(16).padStart(2, '0')
  }
  return `${hex1}-${hex2}-${hex3}-${hex4}-${tail}`
}

const toDbBookingStatus = (s: BookingStatus): string =>
  ({ Draft: 'draft', Terkonfirmasi: 'confirmed', Selesai: 'completed', Dibatalkan: 'cancelled' })[s] ?? 'draft'

const fromDbBookingStatus = (s: unknown): BookingStatus => {
  const map: Record<string, BookingStatus> = {
    draft: 'Draft',
    confirmed: 'Terkonfirmasi',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
  }
  return map[String(s ?? '').toLowerCase()] ?? 'Draft'
}

const toDbCatalogType = (t: CatalogType): string => (t === 'Inti' ? 'core' : 'additional')
const fromDbCatalogType = (t: unknown): CatalogType => (String(t ?? '').toLowerCase() === 'core' ? 'Inti' : 'Additional')

const toDbAttireCategory = (c: AttireCategory): string => (c === 'Bride' ? 'bride' : 'groom')
const fromDbAttireCategory = (c: unknown): AttireCategory => (String(c ?? '').toLowerCase() === 'groom' ? 'Groom' : 'Bride')

const toDbAttireStatus = (s: AttireStatus): string =>
  ({ Tersedia: 'available', Booked: 'booked', Terpakai: 'booked', Laundry: 'laundry' })[s] ?? 'available'

const fromDbAttireStatus = (s: unknown): AttireStatus => {
  const v = String(s ?? '').toLowerCase()
  if (v === 'terpakai') return 'Terpakai'
  if (v === 'booked') return 'Booked'
  if (v === 'laundry') return 'Laundry'
  return 'Tersedia'
}

const safePayloadWrite = async (
  sb: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
  onConflict = 'id',
) => {
  const payload: Record<string, unknown> = { ...row }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await sb.from(table).upsert(payload, { onConflict })
    if (!error) return { ok: true }
    const msg = `${error.message ?? ''} ${error.details ?? ''}`
    const match =
      msg.match(/Could not find the '([a-zA-Z0-9_]+)' column/i)
      || msg.match(/column\s+["']?([a-zA-Z0-9_]+)["']?\s+(?:of|does not exist)/i)
    if (match?.[1] && match[1] in payload) {
      delete payload[match[1]]
      continue
    }
    throw new Error(`[${table}] ${error.message}`)
  }
  return { ok: false }
}

const runBg = (task: (sb: SupabaseClient) => Promise<void>) => {
  const sb = getSupabaseClient()
  if (!sb) return
  supabaseSyncState.syncing = true
  task(sb)
    .then(() => {
      supabaseSyncState.connected = true
      supabaseSyncState.lastSyncedAt = new Date().toISOString()
      supabaseSyncState.lastError = ''
    })
    .catch((err) => {
      supabaseSyncState.lastError = err instanceof Error ? err.message : 'Gagal sinkronisasi ke Supabase.'
      console.warn('[Supabase Sync]', supabaseSyncState.lastError)
    })
    .finally(() => {
      supabaseSyncState.syncing = false
    })
}

export interface RemoteHydrationResult {
  hasRemoteData: boolean
  businessProfile?: Partial<BusinessProfile>
  paymentMethods?: string[]
  poExpenseCategories?: string[]
  generalExpenseCategories?: string[]
  stylingTypes?: string[]
  inventoryCategories?: string[]
  units?: string[]
  employees?: EmployeeRecord[]
  customers?: Customer[]
  bookings?: Booking[]
  refunds?: BookingRefund[]
  jobAssignments?: JobAssignment[]
  catalog?: CatalogItem[]
  invoices?: Invoice[]
  payments?: Payment[]
  expenses?: Expense[]
  inventory?: InventoryItem[]
  movements?: StockMovement[]
  stockOpnames?: StockOpnameRecord[]
  weddingAttire?: WeddingAttire[]
  weddingForms?: WeddingFittingForm[]
}

export const pullAllFromSupabase = async (): Promise<RemoteHydrationResult | null> => {
  const sb = getSupabaseClient()
  if (!sb) return null
  supabaseSyncState.syncing = true
  try {
    const results = await Promise.all([
      sb.from('profil_bisnis').select('*').limit(1),
      sb.from('pengaturan_dropdown').select('*').order('sort_order', { ascending: true }),
      sb.from('pengaturan_karyawan').select('*').order('name', { ascending: true }),
      sb.from('data_pelanggan').select('*').order('created_at', { ascending: false }),
      sb.from('data_pelanggan_booking').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      sb.from('data_pelanggan_refund').select('*').order('created_at', { ascending: false }),
      sb.from('penugasan_tim').select('*'),
      sb.from('penugasan_tim_anggota').select('*'),
      sb.from('katalog_jasa').select('*').order('created_at', { ascending: false }),
      sb.from('pesanan').select('*').is('cancelled_at', null).order('created_at', { ascending: true }),
      sb.from('pesanan_detail').select('*'),
      sb.from('faktur_tagihan').select('*').is('cancelled_at', null).order('created_at', { ascending: false }),
      sb.from('faktur_tagihan_detail').select('*'),
      sb.from('pembayaran').select('*').is('voided_at', null).order('paid_at', { ascending: false }),
      sb.from('pengeluaran').select('*').is('voided_at', null).order('expense_date', { ascending: false }),
      sb.from('inventaris_barang').select('*').eq('is_active', true).order('item_code', { ascending: true }),
      sb.from('inventaris_barang_masuk').select('*').is('voided_at', null),
      sb.from('inventaris_barang_masuk_detail').select('*'),
      sb.from('inventaris_barang_keluar').select('*').is('voided_at', null),
      sb.from('inventaris_barang_keluar_detail').select('*'),
      sb.from('inventaris_stok_opname').select('*').order('opname_date', { ascending: false }),
      sb.from('inventaris_stok_opname_detail').select('*'),
      sb.from('inventaris_mutasi_stok').select('*').order('movement_date', { ascending: false }),
      sb.from('portal_pernikahan_busana').select('*').eq('is_active', true).order('attire_code', { ascending: true }),
      sb.from('portal_pernikahan_fitting').select('*').order('updated_at', { ascending: false }),
      sb.from('portal_pernikahan_acara').select('*').order('event_number', { ascending: true }),
    ])

    const [
      bizRes,
      ddRes,
      empRes,
      custRes,
      bookRes,
      refundRes,
      jobAssignRes,
      jobEmpRes,
      catRes,
      ordRes,
      ordItemsRes,
      invRes,
      invItemsRes,
      payRes,
      expRes,
      invStockRes,
      stockInRes,
      stockInItemsRes,
      stockOutRes,
      stockOutItemsRes,
      opnameRes,
      opnameItemsRes,
      movRes,
      attireRes,
      formsRes,
      eventsRes,
    ] = results

    const firstErr = results.find((r) => r.error)?.error
    if (firstErr) {
      throw new Error(firstErr.message)
    }

    supabaseSyncState.connected = true
    supabaseSyncState.lastSyncedAt = new Date().toISOString()
    supabaseSyncState.lastError = ''

    const custRows = custRes.data ?? []
    const bookRows = bookRes.data ?? []
    const catRows = catRes.data ?? []
    const invRows = invRes.data ?? []
    const payRows = payRes.data ?? []
    const expRows = expRes.data ?? []
    const stockItemRows = invStockRes.data ?? []
    const attireRows = attireRes.data ?? []
    const empRows = empRes.data ?? []
    const bizRows = bizRes.data ?? []
    const ddRows = ddRes.data ?? []

    const hasRemoteData = Boolean(
      custRows.length || bookRows.length || catRows.length || invRows.length
      || payRows.length || expRows.length || stockItemRows.length || attireRows.length
      || bizRows.length,
    )
    supabaseSyncState.remoteHasData = hasRemoteData

    const out: RemoteHydrationResult = { hasRemoteData }

    if (bizRows.length) {
      const b = bizRows[0] as Record<string, unknown>
      out.businessProfile = {
        name: String(b.name ?? 'AZURA'),
        tagline: String(b.tagline ?? 'MAKEUP ARTIST'),
        phone: String(b.phone ?? ''),
        email: String(b.email ?? ''),
        address: String(b.address ?? ''),
        invoiceNote: String(b.invoice_note ?? ''),
        logoUrl: b.logo_url ? String(b.logo_url) : undefined,
      }
    }

    if (ddRows.length) {
      const pick = (grp: string) =>
        ddRows.filter((r) => r.option_group === grp && r.is_active !== false).map((r) => String(r.label))
      const pm = pick('paymentMethods')
      const po = pick('poExpenseCategories')
      const gen = pick('generalExpenseCategories')
      const sty = pick('stylingTypes')
      const invCat = pick('inventoryCategories')
      const uList = pick('units')
      if (pm.length) out.paymentMethods = pm
      if (po.length) out.poExpenseCategories = po
      if (gen.length) out.generalExpenseCategories = gen
      if (sty.length) out.stylingTypes = sty
      if (invCat.length) out.inventoryCategories = invCat
      if (uList.length) out.units = uList
    }

    out.employees = empRows.map((e) => ({
      id: String(e.id),
      name: String(e.name),
      role: String(e.role ?? 'MUA / Tim'),
      phone: e.phone ? String(e.phone) : undefined,
      email: e.email ? String(e.email) : undefined,
      active: Boolean(e.active ?? true),
      lastLogin: e.last_login_label ? String(e.last_login_label) : undefined,
    }))

    const customers: Customer[] = custRows.map((c) => ({
      id: String(c.id),
      name: String(c.name),
      phone: String(c.phone),
    }))
    out.customers = customers

    const bookings: Booking[] = bookRows.map((b) => ({
      id: String(b.id),
      poNumber: String(b.po_number),
      customerId: String(b.customer_id),
      location: String(b.event_location ?? ''),
      eventDate: String(b.event_date),
      eventTime: b.event_time ? String(b.event_time).slice(0, 5) : undefined,
      stylingType: b.styling_type === 'Hijabdo' || b.styling_type === 'Hairdo' ? b.styling_type : undefined,
      notes: b.notes ? String(b.notes) : undefined,
      status: fromDbBookingStatus(b.status),
      cancelledPaidAmount: Number(b.cancelled_paid_amount ?? 0) || undefined,
      createdAt: String(b.created_at),
    }))
    out.bookings = bookings

    const bookingById = new Map(bookings.map((b) => [b.id, b]))
    const customerById = new Map(customers.map((c) => [c.id, c]))

    out.refunds = (refundRes.data ?? []).map((r) => {
      const b = bookingById.get(String(r.booking_id))
      return {
        id: String(r.id),
        refundNumber: String(r.refund_number),
        bookingId: String(r.booking_id),
        poNumber: b?.poNumber ?? '-',
        customerName: b ? (customerById.get(b.customerId)?.name ?? '-') : '-',
        refundDate: String(r.refund_date),
        amount: Number(r.amount),
        method: String(r.method),
        proofImageUrl: r.proof_url ? String(r.proof_url) : undefined,
        notes: r.notes ? String(r.notes) : undefined,
        createdAt: String(r.created_at),
      }
    })

    const jobNotesMap = new Map<string, { notes?: string; updatedAt: string }>()
    for (const j of jobAssignRes.data ?? []) {
      jobNotesMap.set(String(j.booking_id), {
        notes: j.notes ? String(j.notes) : undefined,
        updatedAt: String(j.updated_at ?? new Date().toISOString()),
      })
    }
    const jobEmpsMap = new Map<string, string[]>()
    for (const je of jobEmpRes.data ?? []) {
      const bId = String(je.booking_id)
      const arr = jobEmpsMap.get(bId) ?? []
      arr.push(String(je.employee_id))
      jobEmpsMap.set(bId, arr)
    }
    const allJobBookingIds = new Set([...jobNotesMap.keys(), ...jobEmpsMap.keys()])
    out.jobAssignments = [...allJobBookingIds].map((bookingId) => ({
      bookingId,
      employeeIds: jobEmpsMap.get(bookingId) ?? [],
      notes: jobNotesMap.get(bookingId)?.notes,
      updatedAt: jobNotesMap.get(bookingId)?.updatedAt ?? new Date().toISOString(),
    }))

    const catalog: CatalogItem[] = catRows.map((c) => ({
      id: String(c.id),
      code: String(c.catalog_code),
      name: String(c.name),
      type: fromDbCatalogType(c.type),
      description: String(c.description ?? ''),
      price: Number(c.catalog_price),
      unit: String(c.unit),
      active: Boolean(c.is_active ?? true),
      imageUrl: c.image_url ? String(c.image_url) : undefined,
      createdAt: String(c.created_at ?? ''),
    }))
    out.catalog = catalog

    // Build invoices & order groups
    const orderRows = ordRes.data ?? []
    const orderItemRows = ordItemsRes.data ?? []
    const invItemRows = invItemsRes.data ?? []
    const catMap = new Map(catalog.map((c) => [c.id, c]))

    const orderItemsByOrderId = new Map<string, InvoiceItem[]>()
    for (const oi of orderItemRows) {
      const cat = oi.catalog_item_id ? catMap.get(String(oi.catalog_item_id)) : undefined
      const arr = orderItemsByOrderId.get(String(oi.order_id)) ?? []
      arr.push({
        id: String(oi.id),
        catalogItemId: oi.catalog_item_id ? String(oi.catalog_item_id) : undefined,
        serviceType: cat?.type ?? 'Inti',
        name: String(oi.service_name_snapshot),
        quantity: Number(oi.quantity),
        unitPrice: Number(oi.customer_price),
        catalogPrice: Number(oi.catalog_price_snapshot),
        unit: String(oi.unit_snapshot ?? cat?.unit ?? 'paket'),
      })
      orderItemsByOrderId.set(String(oi.order_id), arr)
    }

    const orderMetaById = new Map(orderRows.map((o) => [String(o.id), o]))
    const rawInvoices: Invoice[] = []
    for (const inv of invRows) {
      const oId = String(inv.order_id)
      const oRow = orderMetaById.get(oId)
      const itemsForOrder = orderItemsByOrderId.get(oId)
      const itemsFromInv = invItemRows
        .filter((ii) => String(ii.invoice_id) === String(inv.id))
        .map((ii) => ({
          id: String(ii.id),
          serviceType: ii.service_type ? fromDbCatalogType(ii.service_type) : 'Inti',
          name: String(ii.service_name_snapshot),
          quantity: Number(ii.quantity),
          unitPrice: Number(ii.unit_price),
          catalogPrice: Number(ii.unit_price),
          unit: String(ii.unit_snapshot ?? 'paket'),
        }))
      const items = itemsForOrder?.length ? itemsForOrder : itemsFromInv
      const groupKind: 'Awal' | 'Tambahan' = oRow?.type === 'additional' ? 'Tambahan' : 'Awal'
      const orderDate = String(oRow?.order_date ?? inv.invoice_date ?? inv.created_at.slice(0, 10))
      const group: OrderGroup = {
        id: oId,
        kind: groupKind,
        orderDate,
        createdAt: String(oRow?.created_at ?? inv.created_at),
        items,
      }
      rawInvoices.push({
        id: String(inv.id),
        invoiceNumber: String(inv.invoice_number),
        bookingId: String(inv.booking_id),
        kind: groupKind === 'Tambahan' ? 'Additional' : 'Utama',
        issuedAt: String(inv.invoice_date),
        dueDate: inv.due_date ? String(inv.due_date) : undefined,
        groups: [group],
        items,
        createdAt: String(inv.created_at ?? ''),
      })
    }
    out.invoices = rawInvoices

    out.payments = payRows.map((p) => ({
      id: String(p.id),
      receiptNumber: String(p.receipt_number),
      bookingId: String(p.booking_id),
      paidAt: String(p.paid_at).slice(0, 10),
      method: String(p.method),
      amount: Number(p.amount),
      notes: p.notes ? String(p.notes) : undefined,
      createdAt: String(p.created_at ?? ''),
    }))

    out.expenses = expRows.map((e) => ({
      id: String(e.id),
      date: String(e.expense_date),
      category: String(e.category),
      description: String(e.description),
      amount: Number(e.amount),
      bookingId: e.booking_id ? String(e.booking_id) : undefined,
      expenseScope: e.expense_scope === 'Di Luar PO' || !e.booking_id ? 'Di Luar PO' : 'Berdasarkan PO',
      proofImageUrl: e.proof_url ? String(e.proof_url) : undefined,
      method: String(e.payment_method),
      source: e.source === 'Bayar Cancel' ? 'Bayar Cancel' : 'Manual',
      refundId: e.refund_id ? String(e.refund_id) : undefined,
    }))

    const stockInMap = new Map((stockInRes.data ?? []).map((r) => [String(r.id), r]))
    const stockInByItemId = new Map((stockInItemsRes.data ?? []).map((r) => [String(r.id), r]))
    const stockOutMap = new Map((stockOutRes.data ?? []).map((r) => [String(r.id), r]))
    const stockOutByItemId = new Map((stockOutItemsRes.data ?? []).map((r) => [String(r.id), r]))

    const movRows = movRes.data ?? []
    const inTotals = new Map<string, number>()
    const outTotals = new Map<string, number>()
    const adjTotals = new Map<string, number>()

    const movements: StockMovement[] = movRows.map((m) => {
      const itemId = String(m.inventory_item_id)
      const qty = Number(m.quantity)
      const mType = String(m.movement_type).toLowerCase()
      let uiType: 'Masuk' | 'Keluar' | 'Penyesuaian' = 'Masuk'
      let batchId: string | undefined
      let opnameId: string | undefined
      let proofImageUrl: string | undefined

      if (mType === 'in') {
        uiType = 'Masuk'
        inTotals.set(itemId, (inTotals.get(itemId) ?? 0) + Math.abs(qty))
        const link = m.stock_in_item_id ? stockInByItemId.get(String(m.stock_in_item_id)) : undefined
        const hdr = link ? stockInMap.get(String(link.stock_in_id)) : undefined
        batchId = hdr ? String(hdr.id) : undefined
        proofImageUrl = hdr?.proof_url ? String(hdr.proof_url) : undefined
      } else if (mType === 'out') {
        uiType = 'Keluar'
        outTotals.set(itemId, (outTotals.get(itemId) ?? 0) + Math.abs(qty))
        const link = m.stock_out_item_id ? stockOutByItemId.get(String(m.stock_out_item_id)) : undefined
        const hdr = link ? stockOutMap.get(String(link.stock_out_id)) : undefined
        batchId = hdr ? String(hdr.id) : undefined
        proofImageUrl = hdr?.proof_url ? String(hdr.proof_url) : undefined
      } else {
        uiType = 'Penyesuaian'
        adjTotals.set(itemId, (adjTotals.get(itemId) ?? 0) + qty)
        opnameId = m.opname_id ? String(m.opname_id) : undefined
      }

      return {
        id: String(m.id),
        batchId,
        opnameId,
        itemId,
        type: uiType,
        quantity: uiType === 'Penyesuaian' ? qty : Math.abs(qty),
        date: String(m.movement_date),
        pic: String(m.pic_name),
        notes: m.notes ? String(m.notes) : undefined,
        proofImageUrl,
      }
    })
    out.movements = movements

    out.inventory = stockItemRows.map((it) => {
      const id = String(it.id)
      return {
        id,
        code: String(it.item_code),
        name: String(it.name),
        category: String(it.category),
        unit: String(it.unit),
        initialStock: Number(it.initial_quantity ?? 0),
        stockIn: inTotals.get(id) ?? 0,
        stockOut: outTotals.get(id) ?? 0,
        stockAdjustment: adjTotals.get(id) ?? 0,
        minimumStock: Number(it.minimum_stock ?? 0),
        location: String(it.storage_location ?? ''),
        imageUrl: it.image_url ? String(it.image_url) : undefined,
        active: Boolean(it.is_active ?? true),
        createdAt: String(it.created_at ?? ''),
      }
    })

    const invItemMap = new Map(out.inventory.map((i) => [i.id, i]))
    const opnameItemsById = new Map<string, StockOpnameRecord['items']>()
    for (const oi of opnameItemsRes.data ?? []) {
      const opId = String(oi.opname_id)
      const invId = String(oi.inventory_item_id)
      const invItem = invItemMap.get(invId)
      const arr = opnameItemsById.get(opId) ?? []
      arr.push({
        itemId: invId,
        itemName: invItem?.name ?? 'Barang',
        itemCode: invItem?.code ?? '-',
        unit: invItem?.unit ?? 'pcs',
        systemStock: Number(oi.system_stock),
        physicalStock: Number(oi.physical_stock),
        diff: Number(oi.diff_quantity),
        notes: oi.notes ? String(oi.notes) : undefined,
      })
      opnameItemsById.set(opId, arr)
    }
    out.stockOpnames = (opnameRes.data ?? []).map((o) => ({
      id: String(o.id),
      opnameNumber: String(o.opname_number),
      date: String(o.opname_date),
      pic: String(o.pic_name),
      notes: o.notes ? String(o.notes) : undefined,
      items: opnameItemsById.get(String(o.id)) ?? [],
      createdAt: String(o.created_at),
    }))

    out.weddingAttire = attireRows.map((a) => ({
      id: String(a.id),
      code: String(a.attire_code),
      name: String(a.name),
      category: fromDbAttireCategory(a.category),
      size: String(a.size),
      status: fromDbAttireStatus(a.status),
      imageUrl: a.image_url ? String(a.image_url) : undefined,
      notes: a.notes ? String(a.notes) : undefined,
      createdAt: String(a.created_at ?? ''),
    }))

    const eventDetailsByFormId = new Map<string, WeddingFittingForm['events']>()
    for (const ev of eventsRes.data ?? []) {
      const fId = String(ev.fitting_form_id)
      const arr = eventDetailsByFormId.get(fId) ?? []
      arr.push({
        number: (Number(ev.event_number) as 1 | 2 | 3) || 1,
        name: String(ev.event_name ?? ''),
        readyTime: ev.ready_time ? String(ev.ready_time).slice(0, 5) : '',
        timeNote: String(ev.time_note ?? ''),
        bride: {
          attireId: ev.bride_attire_id ? String(ev.bride_attire_id) : '',
          look: String(ev.bride_look ?? ''),
          accessories: String(ev.bride_accessories ?? ''),
          shoes: String(ev.bride_shoes ?? ''),
        },
        groom: {
          attireId: ev.groom_attire_id ? String(ev.groom_attire_id) : '',
          look: String(ev.groom_look ?? ''),
          accessories: String(ev.groom_accessories ?? ''),
          shoes: String(ev.groom_shoes ?? ''),
        },
      })
      eventDetailsByFormId.set(fId, arr)
    }

    out.weddingForms = (formsRes.data ?? []).map((f) => {
      const extras = (f.uniforms_and_extras ?? {}) as Record<string, unknown>
      const rawUniforms = (extras.uniforms ?? extras) as Record<string, string>
      return {
        id: String(f.id),
        bookingId: String(f.booking_id),
        measurements: (f.measurements ?? {}) as Record<string, Record<string, string>>,
        events: eventDetailsByFormId.get(String(f.id)) ?? [],
        uniforms: rawUniforms,
        manggoloBlangkon: extras.manggoloBlangkon !== undefined ? (extras.manggoloBlangkon as number | null) : null,
        manggoloSlop: extras.manggoloSlop !== undefined ? (extras.manggoloSlop as number | null) : null,
        vendors: (f.vendors ?? {}) as Record<string, string>,
        updatedAt: String(f.updated_at),
      }
    })

    return out
  } catch (err) {
    supabaseSyncState.connected = false
    supabaseSyncState.lastError = err instanceof Error ? err.message : 'Gagal menarik data dari Supabase.'
    console.warn('[Supabase Pull]', supabaseSyncState.lastError)
    return null
  } finally {
    supabaseSyncState.syncing = false
  }
}

// --- Background Push Helpers per Entity ---

export const syncCustomer = (c: Customer) => runBg(async (sb) => {
  await safePayloadWrite(sb, 'data_pelanggan', {
    id: toDbUuid(c.id),
    name: c.name,
    phone: c.phone.length >= 8 ? c.phone : c.phone.padEnd(8, '0'),
  })
})

export const syncBooking = (b: Booking, customer?: Customer) => runBg(async (sb) => {
  if (customer) {
    await safePayloadWrite(sb, 'data_pelanggan', {
      id: toDbUuid(customer.id),
      name: customer.name,
      phone: customer.phone.length >= 8 ? customer.phone : customer.phone.padEnd(8, '0'),
    })
  }
  await safePayloadWrite(sb, 'data_pelanggan_booking', {
    id: toDbUuid(b.id),
    po_number: b.poNumber,
    customer_id: toDbUuid(b.customerId),
    event_location: b.location,
    event_date: b.eventDate,
    event_time: b.eventTime || null,
    styling_type: b.stylingType || null,
    notes: b.notes || null,
    status: toDbBookingStatus(b.status),
    cancelled_paid_amount: b.cancelledPaidAmount ?? 0,
  })
})

export const syncCancelBookingCascade = (b: Booking) => runBg(async (sb) => {
  const bUuid = toDbUuid(b.id)
  await safePayloadWrite(sb, 'data_pelanggan_booking', {
    id: bUuid,
    po_number: b.poNumber,
    customer_id: toDbUuid(b.customerId),
    event_location: b.location,
    event_date: b.eventDate,
    status: 'cancelled',
    cancelled_paid_amount: b.cancelledPaidAmount ?? 0,
  })
  const nowIso = new Date().toISOString()
  await sb.from('pesanan').update({ cancelled_at: nowIso }).eq('booking_id', bUuid)
  await sb.from('faktur_tagihan').update({ cancelled_at: nowIso }).eq('booking_id', bUuid)
  await sb.from('pembayaran').update({ voided_at: nowIso }).eq('booking_id', bUuid)
})

export const syncRefund = (r: BookingRefund) => runBg(async (sb) => {
  await safePayloadWrite(sb, 'data_pelanggan_refund', {
    id: toDbUuid(r.id),
    refund_number: r.refundNumber,
    booking_id: toDbUuid(r.bookingId),
    refund_date: r.refundDate,
    amount: Math.round(r.amount),
    method: r.method,
    proof_url: r.proofImageUrl || null,
    notes: r.notes || null,
  })
})

export const syncCatalogItem = (c: CatalogItem) => runBg(async (sb) => {
  await safePayloadWrite(sb, 'katalog_jasa', {
    id: toDbUuid(c.id),
    catalog_code: c.code,
    name: c.name,
    type: toDbCatalogType(c.type),
    description: c.description || null,
    catalog_price: Math.round(c.price),
    unit: c.unit,
    image_url: c.imageUrl || null,
    is_active: c.active,
  })
})

export const syncInvoiceOrderGroup = (invoice: Invoice, group: OrderGroup) => runBg(async (sb) => {
  const groupUuid = toDbUuid(group.id)
  const bookingUuid = toDbUuid(invoice.bookingId)
  const invRowUuid = toDbUuid(`${invoice.id}-${group.id}`)

  await safePayloadWrite(sb, 'pesanan', {
    id: groupUuid,
    booking_id: bookingUuid,
    type: group.kind === 'Tambahan' ? 'additional' : 'initial',
    order_date: group.orderDate,
  })

  await sb.from('pesanan_detail').delete().eq('order_id', groupUuid)
  for (const item of group.items) {
    await safePayloadWrite(sb, 'pesanan_detail', {
      id: toDbUuid(item.id),
      order_id: groupUuid,
      catalog_item_id: item.catalogItemId ? toDbUuid(item.catalogItemId) : null,
      service_name_snapshot: item.name,
      catalog_price_snapshot: Math.round(item.catalogPrice),
      customer_price: Math.round(item.unitPrice),
      quantity: item.quantity,
      unit_snapshot: item.unit || 'paket',
    })
  }

  const invNumber = group.kind === 'Awal' ? invoice.invoiceNumber : `${invoice.invoiceNumber}-${group.id.slice(0, 4)}`
  const { data: existingInv } = await sb
    .from('faktur_tagihan')
    .select('id')
    .or(`order_id.eq.${groupUuid},invoice_number.eq.${invNumber}`)
    .maybeSingle()
  const canonicalInvId = existingInv?.id ? String(existingInv.id) : invRowUuid

  await safePayloadWrite(sb, 'faktur_tagihan', {
    id: canonicalInvId,
    invoice_number: invNumber,
    booking_id: bookingUuid,
    order_id: groupUuid,
    invoice_date: invoice.issuedAt,
    due_date: invoice.dueDate || null,
  })

  await sb.from('faktur_tagihan_detail').delete().eq('invoice_id', canonicalInvId)
  for (const item of group.items) {
    await safePayloadWrite(sb, 'faktur_tagihan_detail', {
      id: toDbUuid(`ii-${item.id}`),
      invoice_id: canonicalInvId,
      source_order_item_id: toDbUuid(item.id),
      order_group_id: groupUuid,
      order_date: group.orderDate,
      service_type: toDbCatalogType(item.serviceType ?? 'Inti'),
      service_name_snapshot: item.name,
      quantity: item.quantity,
      unit_price: Math.round(item.unitPrice),
      unit_snapshot: item.unit || 'paket',
    })
  }
})

export const syncDeleteOrderGroup = (invoiceId: string, groupId: string) => runBg(async (sb) => {
  const groupUuid = toDbUuid(groupId)
  const invRowUuid = toDbUuid(`${invoiceId}-${groupId}`)
  const nowIso = new Date().toISOString()
  await sb.from('faktur_tagihan').update({ cancelled_at: nowIso }).or(`id.eq.${invRowUuid},order_id.eq.${groupUuid}`)
  await sb.from('pesanan').update({ cancelled_at: nowIso }).eq('id', groupUuid)
})

export const syncPayment = (
  p: Payment,
  snapshots: { totalBilling: number; totalPaid: number; balance: number },
) => runBg(async (sb) => {
  const payUuid = toDbUuid(p.id)
  await safePayloadWrite(sb, 'pembayaran', {
    id: payUuid,
    payment_number: `PAY-${p.receiptNumber.replace(/^KWT-/, '')}`,
    receipt_number: p.receiptNumber,
    booking_id: toDbUuid(p.bookingId),
    paid_at: `${p.paidAt}T12:00:00Z`,
    method: p.method,
    amount: Math.round(p.amount),
    notes: p.notes || null,
    idempotency_key: payUuid,
    billing_snapshot: Math.max(0, Math.round(snapshots.totalBilling)),
    cumulative_paid_snapshot: Math.max(0, Math.round(snapshots.totalPaid)),
    balance_snapshot: Math.max(0, Math.round(snapshots.balance)),
    voided_at: null,
  })
})

export const syncDeletePayment = (paymentId: string) => runBg(async (sb) => {
  await sb.from('pembayaran').update({ voided_at: new Date().toISOString() }).eq('id', toDbUuid(paymentId))
})

export const syncExpense = (e: Expense) => runBg(async (sb) => {
  const expUuid = toDbUuid(e.id)
  await safePayloadWrite(sb, 'pengeluaran', {
    id: expUuid,
    expense_number: `EXP-${expUuid.slice(0, 8).toUpperCase()}`,
    expense_date: e.date,
    expense_scope: e.expenseScope ?? (e.bookingId ? 'Berdasarkan PO' : 'Di Luar PO'),
    expense_type: e.bookingId ? 'po' : 'general',
    category: e.category,
    booking_id: e.bookingId ? toDbUuid(e.bookingId) : null,
    description: e.description,
    amount: Math.round(e.amount),
    payment_method: e.method,
    proof_url: e.proofImageUrl || null,
    source: e.source ?? 'Manual',
    refund_id: e.refundId ? toDbUuid(e.refundId) : null,
    voided_at: null,
  })
})

export const syncDeleteExpense = (expenseId: string) => runBg(async (sb) => {
  await sb.from('pengeluaran').update({ voided_at: new Date().toISOString() }).eq('id', toDbUuid(expenseId))
})

export const syncInventoryItem = (item: InventoryItem) => runBg(async (sb) => {
  await safePayloadWrite(sb, 'inventaris_barang', {
    id: toDbUuid(item.id),
    item_code: item.code,
    name: item.name,
    category: item.category,
    unit: item.unit,
    initial_quantity: item.initialStock,
    minimum_stock: item.minimumStock,
    storage_location: item.location || null,
    image_url: item.imageUrl || null,
    is_active: item.active,
  })
})

export const syncDeleteInventoryItem = (id: string) => runBg(async (sb) => {
  await sb.from('inventaris_barang').update({ is_active: false }).eq('id', toDbUuid(id))
})

export const syncStockMovement = (mov: StockMovement) => runBg(async (sb) => {
  const movUuid = toDbUuid(mov.id)
  const itemUuid = toDbUuid(mov.itemId)

  if (mov.type === 'Masuk') {
    const hdrUuid = toDbUuid(mov.batchId || `in-hdr-${mov.id}`)
    const linkUuid = toDbUuid(`in-item-${mov.id}`)
    await safePayloadWrite(sb, 'inventaris_barang_masuk', {
      id: hdrUuid,
      transaction_number: `IN-${hdrUuid.slice(0, 8).toUpperCase()}`,
      transaction_date: mov.date,
      pic_name: mov.pic,
      notes: mov.notes || null,
      proof_url: mov.proofImageUrl || null,
      idempotency_key: hdrUuid,
    })
    await safePayloadWrite(sb, 'inventaris_barang_masuk_detail', {
      id: linkUuid,
      stock_in_id: hdrUuid,
      inventory_item_id: itemUuid,
      quantity: Math.abs(mov.quantity),
    })
    await safePayloadWrite(sb, 'inventaris_mutasi_stok', {
      id: movUuid,
      inventory_item_id: itemUuid,
      movement_type: 'in',
      quantity: Math.abs(mov.quantity),
      stock_in_item_id: linkUuid,
      stock_out_item_id: null,
      movement_date: mov.date,
      pic_name: mov.pic,
      notes: mov.notes || null,
    })
  } else if (mov.type === 'Keluar') {
    const hdrUuid = toDbUuid(mov.batchId || `out-hdr-${mov.id}`)
    const linkUuid = toDbUuid(`out-item-${mov.id}`)
    await safePayloadWrite(sb, 'inventaris_barang_keluar', {
      id: hdrUuid,
      transaction_number: `OUT-${hdrUuid.slice(0, 8).toUpperCase()}`,
      transaction_date: mov.date,
      pic_name: mov.pic,
      purpose: mov.notes || 'Pemakaian operasional',
      notes: mov.notes || null,
      proof_url: mov.proofImageUrl || null,
      idempotency_key: hdrUuid,
    })
    await safePayloadWrite(sb, 'inventaris_barang_keluar_detail', {
      id: linkUuid,
      stock_out_id: hdrUuid,
      inventory_item_id: itemUuid,
      quantity: Math.abs(mov.quantity),
    })
    await safePayloadWrite(sb, 'inventaris_mutasi_stok', {
      id: movUuid,
      inventory_item_id: itemUuid,
      movement_type: 'out',
      quantity: -Math.abs(mov.quantity),
      stock_in_item_id: null,
      stock_out_item_id: linkUuid,
      movement_date: mov.date,
      pic_name: mov.pic,
      notes: mov.notes || null,
    })
  } else {
    if (!mov.quantity) return
    await safePayloadWrite(sb, 'inventaris_mutasi_stok', {
      id: movUuid,
      inventory_item_id: itemUuid,
      movement_type: 'adjustment',
      quantity: mov.quantity,
      stock_in_item_id: null,
      stock_out_item_id: null,
      opname_id: mov.opnameId ? toDbUuid(mov.opnameId) : null,
      movement_date: mov.date,
      pic_name: mov.pic,
      notes: mov.notes || null,
    })
  }
})

export const syncDeleteStockMovement = (movementId: string) => runBg(async (sb) => {
  await sb.from('inventaris_mutasi_stok').delete().eq('id', toDbUuid(movementId))
})

export const syncStockOpname = (opname: StockOpnameRecord, adjustments: StockMovement[]) => runBg(async (sb) => {
  const opUuid = toDbUuid(opname.id)
  await safePayloadWrite(sb, 'inventaris_stok_opname', {
    id: opUuid,
    opname_number: opname.opnameNumber,
    opname_date: opname.date,
    pic_name: opname.pic,
    notes: opname.notes || null,
  })
  await sb.from('inventaris_stok_opname_detail').delete().eq('opname_id', opUuid)
  for (const item of opname.items) {
    await safePayloadWrite(sb, 'inventaris_stok_opname_detail', {
      id: toDbUuid(`soi-${opname.id}-${item.itemId}`),
      opname_id: opUuid,
      inventory_item_id: toDbUuid(item.itemId),
      system_stock: item.systemStock,
      physical_stock: item.physicalStock,
      diff_quantity: item.diff,
      notes: item.notes || null,
    })
  }
  await sb.from('inventaris_mutasi_stok').delete().eq('opname_id', opUuid)
  for (const adj of adjustments) {
    if (!adj.quantity) continue
    await safePayloadWrite(sb, 'inventaris_mutasi_stok', {
      id: toDbUuid(adj.id),
      inventory_item_id: toDbUuid(adj.itemId),
      movement_type: 'adjustment',
      quantity: adj.quantity,
      opname_id: opUuid,
      movement_date: adj.date,
      pic_name: adj.pic,
      notes: adj.notes || null,
    })
  }
})

export const syncDeleteStockOpname = (opnameId: string) => runBg(async (sb) => {
  const opUuid = toDbUuid(opnameId)
  await sb.from('inventaris_mutasi_stok').delete().eq('opname_id', opUuid)
  await sb.from('inventaris_stok_opname').delete().eq('id', opUuid)
})

export const syncWeddingAttire = (att: WeddingAttire) => runBg(async (sb) => {
  await safePayloadWrite(sb, 'portal_pernikahan_busana', {
    id: toDbUuid(att.id),
    attire_code: att.code,
    name: att.name,
    category: toDbAttireCategory(att.category),
    size: att.size,
    status: toDbAttireStatus(att.status),
    image_url: att.imageUrl || null,
    notes: att.notes || null,
    is_active: true,
  })
})

export const syncWeddingForm = (form: WeddingFittingForm) => runBg(async (sb) => {
  const formUuid = toDbUuid(form.id)
  const bookingUuid = toDbUuid(form.bookingId)
  await safePayloadWrite(sb, 'portal_pernikahan_fitting', {
    id: formUuid,
    booking_id: bookingUuid,
    measurements: form.measurements ?? {},
    uniforms_and_extras: {
      uniforms: form.uniforms ?? {},
      manggoloBlangkon: form.manggoloBlangkon,
      manggoloSlop: form.manggoloSlop,
    },
    vendors: form.vendors ?? {},
  }, 'booking_id')

  // Retrieve canonical form id in case conflict updated an existing row
  const { data: existingForm } = await sb
    .from('portal_pernikahan_fitting')
    .select('id')
    .eq('booking_id', bookingUuid)
    .maybeSingle()
  const canonicalFormId = existingForm?.id ? String(existingForm.id) : formUuid

  await sb.from('portal_pernikahan_acara').delete().eq('fitting_form_id', canonicalFormId)
  for (const ev of form.events) {
    await safePayloadWrite(sb, 'portal_pernikahan_acara', {
      id: toDbUuid(`wed-${canonicalFormId}-${ev.number}`),
      fitting_form_id: canonicalFormId,
      event_number: ev.number,
      event_name: ev.name || null,
      ready_time: ev.readyTime || null,
      time_note: ev.timeNote || null,
      bride_attire_id: ev.bride?.attireId ? toDbUuid(ev.bride.attireId) : null,
      bride_look: ev.bride?.look || null,
      bride_accessories: ev.bride?.accessories || null,
      bride_shoes: ev.bride?.shoes || null,
      groom_attire_id: ev.groom?.attireId ? toDbUuid(ev.groom.attireId) : null,
      groom_look: ev.groom?.look || null,
      groom_accessories: ev.groom?.accessories || null,
      groom_shoes: ev.groom?.shoes || null,
    })
  }
})

export const syncDeleteWeddingForm = (bookingId: string) => runBg(async (sb) => {
  await sb.from('portal_pernikahan_fitting').delete().eq('booking_id', toDbUuid(bookingId))
})

export const syncEmployee = (emp: EmployeeRecord) => runBg(async (sb) => {
  await safePayloadWrite(sb, 'pengaturan_karyawan', {
    id: toDbUuid(emp.id),
    name: emp.name,
    role: emp.role,
    phone: emp.phone || null,
    email: emp.email || null,
    active: emp.active,
    last_login_label: emp.lastLogin || null,
  })
})

export const syncJobAssignment = (job: JobAssignment) => runBg(async (sb) => {
  const bUuid = toDbUuid(job.bookingId)
  await safePayloadWrite(sb, 'penugasan_tim', {
    booking_id: bUuid,
    notes: job.notes || null,
  }, 'booking_id')
  await sb.from('penugasan_tim_anggota').delete().eq('booking_id', bUuid)
  for (const empId of job.employeeIds) {
    await sb.from('penugasan_tim_anggota').upsert({
      booking_id: bUuid,
      employee_id: toDbUuid(empId),
    }, { onConflict: 'booking_id,employee_id' })
  }
})

export const syncBusinessProfile = (profile: BusinessProfile) => runBg(async (sb) => {
  await safePayloadWrite(sb, 'profil_bisnis', {
    id: toDbUuid('default-business-profile'),
    name: profile.name,
    tagline: profile.tagline,
    phone: profile.phone || null,
    email: profile.email || null,
    address: profile.address || null,
    logo_url: profile.logoUrl || null,
    invoice_note: profile.invoiceNote || null,
  })
})

export const syncDropdownGroup = (
  group: DropdownOptionGroup,
  labels: string[],
) => runBg(async (sb) => {
  await sb.from('pengaturan_dropdown').delete().eq('option_group', group)
  for (const [idx, label] of labels.entries()) {
    await safePayloadWrite(sb, 'pengaturan_dropdown', {
      id: toDbUuid(`dd-${group}-${idx}-${label}`),
      option_group: group,
      label,
      sort_order: idx + 1,
      is_active: true,
    })
  }
})

/** Push complete current local snapshot up to Supabase cleanly in dependency order. */
export const pushSnapshotToSupabase = async (snapshot: {
  businessProfile: BusinessProfile
  paymentMethods: string[]
  poExpenseCategories: string[]
  generalExpenseCategories: string[]
  employees: EmployeeRecord[]
  customers: Customer[]
  bookings: Booking[]
  refunds: BookingRefund[]
  jobAssignments: JobAssignment[]
  catalog: CatalogItem[]
  invoices: Invoice[]
  payments: Payment[]
  expenses: Expense[]
  inventory: InventoryItem[]
  movements: StockMovement[]
  stockOpnames: StockOpnameRecord[]
  weddingAttire: WeddingAttire[]
  weddingForms: WeddingFittingForm[]
  bookingTotal: (bookingId: string) => number
  bookingPaid: (bookingId: string) => number
  bookingBalance: (bookingId: string) => number
}) => {
  const sb = getSupabaseClient()
  if (!sb) throw new Error('Konfigurasi Supabase di .env belum terpasang.')
  supabaseSyncState.syncing = true
  try {
    await safePayloadWrite(sb, 'profil_bisnis', {
      id: toDbUuid('default-business-profile'),
      name: snapshot.businessProfile.name,
      tagline: snapshot.businessProfile.tagline,
      phone: snapshot.businessProfile.phone || null,
      email: snapshot.businessProfile.email || null,
      address: snapshot.businessProfile.address || null,
      logo_url: snapshot.businessProfile.logoUrl || null,
      invoice_note: snapshot.businessProfile.invoiceNote || null,
    })

    for (const [group, labels] of [
      ['paymentMethods', snapshot.paymentMethods],
      ['poExpenseCategories', snapshot.poExpenseCategories],
      ['generalExpenseCategories', snapshot.generalExpenseCategories],
    ] as const) {
      await sb.from('pengaturan_dropdown').delete().eq('option_group', group)
      for (const [idx, label] of labels.entries()) {
        await safePayloadWrite(sb, 'pengaturan_dropdown', {
          id: toDbUuid(`dd-${group}-${idx}-${label}`),
          option_group: group,
          label,
          sort_order: idx + 1,
          is_active: true,
        })
      }
    }

    for (const emp of snapshot.employees) {
      await safePayloadWrite(sb, 'pengaturan_karyawan', {
        id: toDbUuid(emp.id),
        name: emp.name,
        role: emp.role,
        phone: emp.phone || null,
        email: emp.email || null,
        active: emp.active,
        last_login_label: emp.lastLogin || null,
      })
    }

    for (const c of snapshot.customers) {
      await safePayloadWrite(sb, 'data_pelanggan', {
        id: toDbUuid(c.id),
        name: c.name,
        phone: c.phone.length >= 8 ? c.phone : c.phone.padEnd(8, '0'),
      })
    }

    for (const b of snapshot.bookings) {
      await safePayloadWrite(sb, 'data_pelanggan_booking', {
        id: toDbUuid(b.id),
        po_number: b.poNumber,
        customer_id: toDbUuid(b.customerId),
        event_location: b.location,
        event_date: b.eventDate,
        event_time: b.eventTime || null,
        styling_type: b.stylingType || null,
        notes: b.notes || null,
        status: toDbBookingStatus(b.status),
        cancelled_paid_amount: b.cancelledPaidAmount ?? 0,
      })
    }

    for (const c of snapshot.catalog) {
      await safePayloadWrite(sb, 'katalog_jasa', {
        id: toDbUuid(c.id),
        catalog_code: c.code,
        name: c.name,
        type: toDbCatalogType(c.type),
        description: c.description || null,
        catalog_price: Math.round(c.price),
        unit: c.unit,
        image_url: c.imageUrl || null,
        is_active: c.active,
      })
    }

    for (const inv of snapshot.invoices) {
      for (const grp of inv.groups) {
        const groupUuid = toDbUuid(grp.id)
        const bookingUuid = toDbUuid(inv.bookingId)
        const invRowUuid = toDbUuid(`${inv.id}-${grp.id}`)
        await safePayloadWrite(sb, 'pesanan', {
          id: groupUuid,
          booking_id: bookingUuid,
          type: grp.kind === 'Tambahan' ? 'additional' : 'initial',
          order_date: grp.orderDate,
        })
        await sb.from('pesanan_detail').delete().eq('order_id', groupUuid)
        for (const it of grp.items) {
          await safePayloadWrite(sb, 'pesanan_detail', {
            id: toDbUuid(it.id),
            order_id: groupUuid,
            catalog_item_id: it.catalogItemId ? toDbUuid(it.catalogItemId) : null,
            service_name_snapshot: it.name,
            catalog_price_snapshot: Math.round(it.catalogPrice),
            customer_price: Math.round(it.unitPrice),
            quantity: it.quantity,
            unit_snapshot: it.unit || 'paket',
          })
        }
        await safePayloadWrite(sb, 'faktur_tagihan', {
          id: invRowUuid,
          invoice_number: grp.kind === 'Awal' ? inv.invoiceNumber : `${inv.invoiceNumber}-${grp.id.slice(0, 4)}`,
          booking_id: bookingUuid,
          order_id: groupUuid,
          invoice_date: inv.issuedAt,
          due_date: inv.dueDate || null,
        })
        await sb.from('faktur_tagihan_detail').delete().eq('invoice_id', invRowUuid)
        for (const it of grp.items) {
          await safePayloadWrite(sb, 'faktur_tagihan_detail', {
            id: toDbUuid(`ii-${it.id}`),
            invoice_id: invRowUuid,
            source_order_item_id: toDbUuid(it.id),
            order_group_id: groupUuid,
            order_date: grp.orderDate,
            service_type: toDbCatalogType(it.serviceType ?? 'Inti'),
            service_name_snapshot: it.name,
            quantity: it.quantity,
            unit_price: Math.round(it.unitPrice),
            unit_snapshot: it.unit || 'paket',
          })
        }
      }
    }

    for (const p of snapshot.payments) {
      const payUuid = toDbUuid(p.id)
      await safePayloadWrite(sb, 'pembayaran', {
        id: payUuid,
        payment_number: `PAY-${p.receiptNumber.replace(/^KWT-/, '')}`,
        receipt_number: p.receiptNumber,
        booking_id: toDbUuid(p.bookingId),
        paid_at: `${p.paidAt}T12:00:00Z`,
        method: p.method,
        amount: Math.round(p.amount),
        notes: p.notes || null,
        idempotency_key: payUuid,
        billing_snapshot: Math.max(0, Math.round(snapshot.bookingTotal(p.bookingId))),
        cumulative_paid_snapshot: Math.max(0, Math.round(snapshot.bookingPaid(p.bookingId))),
        balance_snapshot: Math.max(0, Math.round(snapshot.bookingBalance(p.bookingId))),
      })
    }

    for (const r of snapshot.refunds) {
      await safePayloadWrite(sb, 'data_pelanggan_refund', {
        id: toDbUuid(r.id),
        refund_number: r.refundNumber,
        booking_id: toDbUuid(r.bookingId),
        refund_date: r.refundDate,
        amount: Math.round(r.amount),
        method: r.method,
        proof_url: r.proofImageUrl || null,
        notes: r.notes || null,
      })
    }

    for (const j of snapshot.jobAssignments) {
      const bUuid = toDbUuid(j.bookingId)
      await safePayloadWrite(sb, 'penugasan_tim', {
        booking_id: bUuid,
        notes: j.notes || null,
      }, 'booking_id')
      await sb.from('penugasan_tim_anggota').delete().eq('booking_id', bUuid)
      for (const empId of j.employeeIds) {
        await sb.from('penugasan_tim_anggota').upsert({
          booking_id: bUuid,
          employee_id: toDbUuid(empId),
        }, { onConflict: 'booking_id,employee_id' })
      }
    }

    for (const e of snapshot.expenses) {
      const expUuid = toDbUuid(e.id)
      await safePayloadWrite(sb, 'pengeluaran', {
        id: expUuid,
        expense_number: `EXP-${expUuid.slice(0, 8).toUpperCase()}`,
        expense_date: e.date,
        expense_scope: e.expenseScope ?? (e.bookingId ? 'Berdasarkan PO' : 'Di Luar PO'),
        expense_type: e.bookingId ? 'po' : 'general',
        category: e.category,
        booking_id: e.bookingId ? toDbUuid(e.bookingId) : null,
        description: e.description,
        amount: Math.round(e.amount),
        payment_method: e.method,
        proof_url: e.proofImageUrl || null,
      })
    }

    for (const it of snapshot.inventory) {
      await safePayloadWrite(sb, 'inventaris_barang', {
        id: toDbUuid(it.id),
        item_code: it.code,
        name: it.name,
        category: it.category,
        unit: it.unit,
        initial_quantity: it.initialStock,
        minimum_stock: it.minimumStock,
        storage_location: it.location || null,
        is_active: it.active,
      })
    }

    for (const att of snapshot.weddingAttire) {
      await safePayloadWrite(sb, 'portal_pernikahan_busana', {
        id: toDbUuid(att.id),
        attire_code: att.code,
        name: att.name,
        category: toDbAttireCategory(att.category),
        size: att.size,
        status: toDbAttireStatus(att.status),
        image_url: att.imageUrl || null,
        notes: att.notes || null,
        is_active: true,
      })
    }

    for (const form of snapshot.weddingForms) {
      const bookingUuid = toDbUuid(form.bookingId)
      const formUuid = toDbUuid(form.id)
      await safePayloadWrite(sb, 'portal_pernikahan_fitting', {
        id: formUuid,
        booking_id: bookingUuid,
        measurements: form.measurements ?? {},
        uniforms_and_extras: {
          uniforms: form.uniforms ?? {},
          manggoloBlangkon: form.manggoloBlangkon,
          manggoloSlop: form.manggoloSlop,
        },
        vendors: form.vendors ?? {},
      }, 'booking_id')
      const { data: existingForm } = await sb
        .from('portal_pernikahan_fitting')
        .select('id')
        .eq('booking_id', bookingUuid)
        .maybeSingle()
      const canonicalFormId = existingForm?.id ? String(existingForm.id) : formUuid
      await sb.from('portal_pernikahan_acara').delete().eq('fitting_form_id', canonicalFormId)
      for (const ev of form.events) {
        await safePayloadWrite(sb, 'portal_pernikahan_acara', {
          id: toDbUuid(`wed-${canonicalFormId}-${ev.number}`),
          fitting_form_id: canonicalFormId,
          event_number: ev.number,
          event_name: ev.name || null,
          ready_time: ev.readyTime || null,
          time_note: ev.timeNote || null,
          bride_attire_id: ev.bride?.attireId ? toDbUuid(ev.bride.attireId) : null,
          bride_look: ev.bride?.look || null,
          bride_accessories: ev.bride?.accessories || null,
          bride_shoes: ev.bride?.shoes || null,
          groom_attire_id: ev.groom?.attireId ? toDbUuid(ev.groom.attireId) : null,
          groom_look: ev.groom?.look || null,
          groom_accessories: ev.groom?.accessories || null,
          groom_shoes: ev.groom?.shoes || null,
        })
      }
    }

    for (const op of snapshot.stockOpnames) {
      const opUuid = toDbUuid(op.id)
      await safePayloadWrite(sb, 'inventaris_stok_opname', {
        id: opUuid,
        opname_number: op.opnameNumber,
        opname_date: op.date,
        pic_name: op.pic,
        notes: op.notes || null,
      })
      await sb.from('inventaris_stok_opname_detail').delete().eq('opname_id', opUuid)
      for (const item of op.items) {
        await safePayloadWrite(sb, 'inventaris_stok_opname_detail', {
          id: toDbUuid(`soi-${op.id}-${item.itemId}`),
          opname_id: opUuid,
          inventory_item_id: toDbUuid(item.itemId),
          system_stock: item.systemStock,
          physical_stock: item.physicalStock,
          diff_quantity: item.diff,
          notes: item.notes || null,
        })
      }
    }

    for (const mov of snapshot.movements) {
      const movUuid = toDbUuid(mov.id)
      const itemUuid = toDbUuid(mov.itemId)
      if (mov.type === 'Masuk') {
        const hdrUuid = toDbUuid(mov.batchId || `in-hdr-${mov.id}`)
        const linkUuid = toDbUuid(`in-item-${mov.id}`)
        await safePayloadWrite(sb, 'inventaris_barang_masuk', {
          id: hdrUuid,
          transaction_number: `IN-${hdrUuid.slice(0, 8).toUpperCase()}`,
          transaction_date: mov.date,
          pic_name: mov.pic,
          notes: mov.notes || null,
          proof_url: mov.proofImageUrl || null,
          idempotency_key: hdrUuid,
        })
        await safePayloadWrite(sb, 'inventaris_barang_masuk_detail', {
          id: linkUuid,
          stock_in_id: hdrUuid,
          inventory_item_id: itemUuid,
          quantity: Math.abs(mov.quantity),
        })
        await safePayloadWrite(sb, 'inventaris_mutasi_stok', {
          id: movUuid,
          inventory_item_id: itemUuid,
          movement_type: 'in',
          quantity: Math.abs(mov.quantity),
          stock_in_item_id: linkUuid,
          movement_date: mov.date,
          pic_name: mov.pic,
          notes: mov.notes || null,
        })
      } else if (mov.type === 'Keluar') {
        const hdrUuid = toDbUuid(mov.batchId || `out-hdr-${mov.id}`)
        const linkUuid = toDbUuid(`out-item-${mov.id}`)
        await safePayloadWrite(sb, 'inventaris_barang_keluar', {
          id: hdrUuid,
          transaction_number: `OUT-${hdrUuid.slice(0, 8).toUpperCase()}`,
          transaction_date: mov.date,
          pic_name: mov.pic,
          purpose: mov.notes || 'Pemakaian operasional',
          notes: mov.notes || null,
          proof_url: mov.proofImageUrl || null,
          idempotency_key: hdrUuid,
        })
        await safePayloadWrite(sb, 'inventaris_barang_keluar_detail', {
          id: linkUuid,
          stock_out_id: hdrUuid,
          inventory_item_id: itemUuid,
          quantity: Math.abs(mov.quantity),
        })
        await safePayloadWrite(sb, 'inventaris_mutasi_stok', {
          id: movUuid,
          inventory_item_id: itemUuid,
          movement_type: 'out',
          quantity: -Math.abs(mov.quantity),
          stock_out_item_id: linkUuid,
          movement_date: mov.date,
          pic_name: mov.pic,
          notes: mov.notes || null,
        })
      } else {
        if (!mov.quantity) continue
        await safePayloadWrite(sb, 'inventaris_mutasi_stok', {
          id: toDbUuid(mov.id),
          inventory_item_id: itemUuid,
          movement_type: 'adjustment',
          quantity: mov.quantity,
          opname_id: mov.opnameId ? toDbUuid(mov.opnameId) : null,
          movement_date: mov.date,
          pic_name: mov.pic,
          notes: mov.notes || null,
        })
      }
    }

    supabaseSyncState.connected = true
    supabaseSyncState.remoteHasData = true
    supabaseSyncState.lastSyncedAt = new Date().toISOString()
    supabaseSyncState.lastError = ''
  } catch (err) {
    supabaseSyncState.lastError = err instanceof Error ? err.message : 'Gagal mengirim data ke Supabase.'
    throw err
  } finally {
    supabaseSyncState.syncing = false
  }
}
