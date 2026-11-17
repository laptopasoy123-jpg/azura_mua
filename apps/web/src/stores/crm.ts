import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { uid } from '../utils/format'

export type BookingStatus = 'Draft' | 'Terkonfirmasi' | 'Selesai' | 'Dibatalkan'
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
  notes?: string
  status: BookingStatus
  createdAt: string
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
  name: string
  quantity: number
  unitPrice: number
  catalogPrice: number
}

export interface Invoice {
  id: string
  invoiceNumber: string
  bookingId: string
  kind: 'Utama' | 'Additional'
  issuedAt: string
  dueDate?: string
  items: InvoiceItem[]
}

export interface Payment {
  id: string
  receiptNumber: string
  bookingId: string
  paidAt: string
  method: 'Cash' | 'Transfer' | 'QRIS' | 'Lainnya'
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
  minimumStock: number
  location: string
  active: boolean
}

export interface StockMovement {
  id: string
  itemId: string
  type: 'Masuk' | 'Keluar'
  quantity: number
  date: string
  pic: string
  notes?: string
}

export interface Expense {
  id: string
  date: string
  category: string
  description: string
  amount: number
  bookingId?: string
  method: string
}

export interface Activity {
  id: string
  at: string
  title: string
  detail: string
  tone: 'green' | 'blue' | 'amber' | 'rose'
}

export type AttireCategory = 'Bride' | 'Groom'
export type AttireStatus = 'Tersedia' | 'Booked' | 'Laundry'

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
  bride: WeddingLookDetail
  groom: WeddingLookDetail
}

export interface WeddingFittingForm {
  id: string
  bookingId: string
  measurements: Record<string, Record<string, string>>
  events: WeddingEventDetail[]
  uniforms: Record<string, string>
  vendors: Record<string, string>
  updatedAt: string
}

const STORAGE_KEY = 'azura-mua-demo-v1'

const seed = () => {
  const customers: Customer[] = [
    { id: 'c-1', name: 'Nadya Prameswari', phone: '0812 3421 9088' },
    { id: 'c-2', name: 'Alya Rahman', phone: '0857 9012 1120' },
    { id: 'c-3', name: 'Putri Maheswari', phone: '0813 7788 1200' },
    { id: 'c-4', name: 'Salsa Azzahra', phone: '0822 4331 2209' },
  ]
  const bookings: Booking[] = [
    { id: 'b-1', poNumber: 'PO-2026-0001', customerId: 'c-1', location: 'The Langham Jakarta', eventDate: '2026-11-22', eventTime: '05:30', status: 'Terkonfirmasi', createdAt: '2026-10-03' },
    { id: 'b-2', poNumber: 'PO-2026-0002', customerId: 'c-2', location: 'InterContinental Bandung', eventDate: '2026-12-06', eventTime: '06:00', status: 'Terkonfirmasi', createdAt: '2026-10-11' },
    { id: 'b-3', poNumber: 'PO-2026-0003', customerId: 'c-3', location: 'Gedung Smesco Jakarta', eventDate: '2026-11-28', eventTime: '07:00', status: 'Draft', createdAt: '2026-11-01' },
    { id: 'b-4', poNumber: 'PO-2026-0004', customerId: 'c-4', location: 'Royal Tulip Bogor', eventDate: '2026-12-19', eventTime: '05:00', status: 'Terkonfirmasi', createdAt: '2026-11-08' },
  ]
  const catalog: CatalogItem[] = [
    { id: 'cat-1', code: 'CAT-0001', name: 'Makeup Wedding', type: 'Inti', description: 'Complete bridal makeup dengan complexion tahan lama.', price: 2500000, unit: 'orang', active: true },
    { id: 'cat-2', code: 'CAT-0002', name: 'Makeup Engagement', type: 'Inti', description: 'Soft glam elegan untuk acara engagement.', price: 1500000, unit: 'orang', active: true },
    { id: 'cat-3', code: 'CAT-0003', name: 'Makeup Graduation', type: 'Inti', description: 'Fresh makeup untuk momen wisuda.', price: 750000, unit: 'orang', active: true },
    { id: 'cat-4', code: 'CAT-0004', name: 'Makeup Keluarga', type: 'Additional', description: 'Makeup natural untuk keluarga pengantin.', price: 500000, unit: 'orang', active: true },
    { id: 'cat-5', code: 'CAT-0005', name: 'Hairdo', type: 'Additional', description: 'Hair styling menyesuaikan konsep acara.', price: 350000, unit: 'orang', active: true },
    { id: 'cat-6', code: 'CAT-0006', name: 'Touch Up', type: 'Additional', description: 'Pendampingan dan touch up selama acara.', price: 600000, unit: 'sesi', active: true },
  ]
  const invoices: Invoice[] = [
    { id: 'inv-1', invoiceNumber: 'INV-2026-0001', bookingId: 'b-1', kind: 'Utama', issuedAt: '2026-10-03', dueDate: '2026-11-19', items: [
      { id: 'ii-1', name: 'Makeup Wedding', quantity: 1, catalogPrice: 2500000, unitPrice: 2300000 },
      { id: 'ii-2', name: 'Makeup Keluarga', quantity: 2, catalogPrice: 500000, unitPrice: 450000 },
    ] },
    { id: 'inv-2', invoiceNumber: 'INV-2026-0002', bookingId: 'b-2', kind: 'Utama', issuedAt: '2026-10-11', dueDate: '2026-12-01', items: [
      { id: 'ii-3', name: 'Makeup Wedding', quantity: 1, catalogPrice: 2500000, unitPrice: 2500000 },
      { id: 'ii-4', name: 'Hairdo', quantity: 1, catalogPrice: 350000, unitPrice: 350000 },
    ] },
    { id: 'inv-3', invoiceNumber: 'INV-2026-0003', bookingId: 'b-4', kind: 'Utama', issuedAt: '2026-11-08', dueDate: '2026-12-12', items: [
      { id: 'ii-5', name: 'Makeup Engagement', quantity: 1, catalogPrice: 1500000, unitPrice: 1400000 },
    ] },
  ]
  const payments: Payment[] = [
    { id: 'pay-1', receiptNumber: 'KWT-2026-0001', bookingId: 'b-1', paidAt: '2026-10-03', method: 'Transfer', amount: 1500000, notes: 'DP pertama' },
    { id: 'pay-2', receiptNumber: 'KWT-2026-0002', bookingId: 'b-2', paidAt: '2026-10-13', method: 'QRIS', amount: 2850000, notes: 'Pelunasan' },
    { id: 'pay-3', receiptNumber: 'KWT-2026-0003', bookingId: 'b-4', paidAt: '2026-11-08', method: 'Transfer', amount: 500000, notes: 'DP' },
  ]
  const inventory: InventoryItem[] = [
    { id: 'stock-1', code: 'BRG-0001', name: 'Foundation HD', category: 'Complexion', unit: 'botol', initialStock: 6, stockIn: 8, stockOut: 5, minimumStock: 4, location: 'Drawer A1', active: true },
    { id: 'stock-2', code: 'BRG-0002', name: 'Setting Spray', category: 'Finishing', unit: 'botol', initialStock: 3, stockIn: 3, stockOut: 4, minimumStock: 3, location: 'Drawer A2', active: true },
    { id: 'stock-3', code: 'BRG-0003', name: 'False Lashes', category: 'Accessories', unit: 'pasang', initialStock: 12, stockIn: 20, stockOut: 14, minimumStock: 8, location: 'Box B1', active: true },
    { id: 'stock-4', code: 'BRG-0004', name: 'Cleansing Balm', category: 'Skin Prep', unit: 'jar', initialStock: 2, stockIn: 2, stockOut: 3, minimumStock: 2, location: 'Drawer A3', active: true },
    { id: 'stock-5', code: 'BRG-0005', name: 'Beauty Sponge', category: 'Tools', unit: 'pcs', initialStock: 10, stockIn: 10, stockOut: 8, minimumStock: 5, location: 'Box B2', active: true },
  ]
  const movements: StockMovement[] = [
    { id: 'mov-1', itemId: 'stock-1', type: 'Keluar', quantity: 2, date: '2026-11-14', pic: 'Nisa', notes: 'Studio session' },
    { id: 'mov-2', itemId: 'stock-3', type: 'Masuk', quantity: 10, date: '2026-11-13', pic: 'Rani', notes: 'Restock supplier' },
  ]
  const expenses: Expense[] = [
    { id: 'exp-1', date: '2026-11-12', category: 'Transportasi', description: 'Transport venue Nadya', amount: 350000, bookingId: 'b-1', method: 'Transfer' },
    { id: 'exp-2', date: '2026-11-10', category: 'Operasional', description: 'Internet studio', amount: 450000, method: 'Transfer' },
    { id: 'exp-3', date: '2026-11-08', category: 'Honor Tim', description: 'Asisten makeup', amount: 600000, bookingId: 'b-4', method: 'Cash' },
  ]
  const activities: Activity[] = [
    { id: 'act-1', at: '2026-11-15T14:28:00+07:00', title: 'Pembayaran diterima', detail: 'DP PO-2026-0004 sebesar Rp500.000', tone: 'green' },
    { id: 'act-2', at: '2026-11-15T11:12:00+07:00', title: 'Stok diperbarui', detail: 'False Lashes bertambah 10 pasang', tone: 'blue' },
    { id: 'act-3', at: '2026-11-14T16:20:00+07:00', title: 'Booking dikonfirmasi', detail: 'PO-2026-0001 siap untuk acara', tone: 'amber' },
  ]
  const weddingAttire: WeddingAttire[] = [
    { id: 'attire-1', code: 'BTR-0001', name: 'Kebaya Sekar Arum', category: 'Bride', size: 'M', status: 'Tersedia' },
    { id: 'attire-2', code: 'BTR-0002', name: 'Kebaya Ayu Ratih', category: 'Bride', size: 'L', status: 'Booked' },
    { id: 'attire-3', code: 'BTR-0003', name: 'Paes Ageng Velvet', category: 'Bride', size: 'S', status: 'Laundry' },
    { id: 'attire-4', code: 'BTR-0004', name: 'Beskap Gading', category: 'Groom', size: 'L', status: 'Tersedia' },
    { id: 'attire-5', code: 'BTR-0005', name: 'Beskap Surjan Navy', category: 'Groom', size: 'XL', status: 'Tersedia' },
    { id: 'attire-6', code: 'BTR-0006', name: 'Beskap Klasik Hitam', category: 'Groom', size: 'M', status: 'Laundry' },
  ]
  const weddingForms: WeddingFittingForm[] = []
  return { customers, bookings, catalog, invoices, payments, inventory, movements, expenses, activities, weddingAttire, weddingForms }
}

export const useCrmStore = defineStore('crm', () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  const defaults = seed()
  const initial: ReturnType<typeof seed> = saved ? { ...defaults, ...JSON.parse(saved) } : defaults
  const customers = ref(initial.customers)
  const bookings = ref(initial.bookings)
  const catalog = ref(initial.catalog)
  const invoices = ref(initial.invoices)
  const payments = ref(initial.payments)
  const inventory = ref(initial.inventory)
  const movements = ref(initial.movements)
  const expenses = ref(initial.expenses)
  const activities = ref(initial.activities)
  const weddingAttire = ref(initial.weddingAttire)
  const weddingForms = ref(initial.weddingForms)

  const invoiceTotal = (invoice: Invoice) => invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const bookingInvoices = (bookingId: string) => invoices.value.filter((invoice) => invoice.bookingId === bookingId)
  const bookingTotal = (bookingId: string) => bookingInvoices(bookingId).reduce((sum, invoice) => sum + invoiceTotal(invoice), 0)
  const bookingPaid = (bookingId: string) => payments.value.filter((payment) => payment.bookingId === bookingId).reduce((sum, payment) => sum + payment.amount, 0)
  const bookingBalance = (bookingId: string) => Math.max(0, bookingTotal(bookingId) - bookingPaid(bookingId))
  const customerFor = (id: string) => customers.value.find((customer) => customer.id === id)
  const bookingFor = (id: string) => bookings.value.find((booking) => booking.id === id)
  const stockAvailable = (item: InventoryItem) => item.initialStock + item.stockIn - item.stockOut
  const stockStatus = (item: InventoryItem) => {
    const available = stockAvailable(item)
    if (available <= 0) return 'Habis'
    if (available <= item.minimumStock) return 'Menipis'
    return 'Aman'
  }

  const totalBilling = computed(() => invoices.value.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0))
  const totalPaid = computed(() => payments.value.reduce((sum, payment) => sum + payment.amount, 0))
  const totalReceivable = computed(() => Math.max(0, totalBilling.value - totalPaid.value))
  const totalExpenses = computed(() => expenses.value.reduce((sum, expense) => sum + expense.amount, 0))
  const upcomingBookings = computed(() => [...bookings.value].filter((item) => item.status !== 'Dibatalkan' && item.eventDate >= '2026-11-15').sort((a, b) => a.eventDate.localeCompare(b.eventDate)))
  const lowStock = computed(() => inventory.value.filter((item) => stockStatus(item) !== 'Aman'))

  const addActivity = (title: string, detail: string, tone: Activity['tone']) => {
    activities.value.unshift({ id: uid(), at: new Date().toISOString(), title, detail, tone })
  }

  const addBooking = (input: { name: string; phone: string; location: string; eventDate: string; eventTime?: string; notes?: string }) => {
    const customer: Customer = { id: uid(), name: input.name.trim(), phone: input.phone.trim() }
    const sequence = bookings.value.length + 1
    const booking: Booking = {
      id: uid(),
      poNumber: `PO-${new Date(input.eventDate).getFullYear()}-${String(sequence).padStart(4, '0')}`,
      customerId: customer.id,
      location: input.location.trim(),
      eventDate: input.eventDate,
      eventTime: input.eventTime,
      notes: input.notes,
      status: 'Draft',
      createdAt: new Date().toISOString().slice(0, 10),
    }
    customers.value.unshift(customer)
    bookings.value.unshift(booking)
    addActivity('Booking baru dibuat', `${booking.poNumber} untuk ${customer.name}`, 'blue')
    return booking
  }

  const updateBooking = (id: string, input: { name: string; phone: string; location: string; eventDate: string; eventTime?: string; notes?: string; status: BookingStatus }) => {
    const booking = bookingFor(id)
    if (!booking) throw new Error('Booking tidak ditemukan.')
    const customer = customerFor(booking.customerId)
    if (!customer) throw new Error('Customer tidak ditemukan.')
    customer.name = input.name.trim()
    customer.phone = input.phone.trim()
    Object.assign(booking, {
      location: input.location.trim(),
      eventDate: input.eventDate,
      eventTime: input.eventTime,
      notes: input.notes,
      status: input.status,
    })
    addActivity('Booking diperbarui', `${booking.poNumber} untuk ${customer.name}`, 'blue')
    return booking
  }

  const addPayment = (input: { bookingId: string; amount: number; method: Payment['method']; paidAt: string; notes?: string }) => {
    const balance = bookingBalance(input.bookingId)
    if (input.amount <= 0 || input.amount > balance) throw new Error('Nominal pembayaran harus lebih dari nol dan tidak boleh melebihi sisa tagihan.')
    const payment: Payment = {
      id: uid(),
      receiptNumber: `KWT-${new Date(input.paidAt).getFullYear()}-${String(payments.value.length + 1).padStart(4, '0')}`,
      ...input,
    }
    payments.value.unshift(payment)
    const booking = bookingFor(input.bookingId)
    addActivity('Pembayaran diterima', `${booking?.poNumber ?? 'PO'} sebesar ${new Intl.NumberFormat('id-ID').format(input.amount)}`, 'green')
    return payment
  }

  const addCatalogItem = (input: Omit<CatalogItem, 'id' | 'code'>) => {
    const item: CatalogItem = { ...input, id: uid(), code: `CAT-${String(catalog.value.length + 1).padStart(4, '0')}` }
    catalog.value.unshift(item)
    addActivity('Layanan ditambahkan', `${item.name} masuk ke katalog ${item.type}`, 'blue')
  }

  const updateCatalogItem = (id: string, input: Omit<CatalogItem, 'id' | 'code'>) => {
    const item = catalog.value.find((entry) => entry.id === id)
    if (!item) throw new Error('Layanan tidak ditemukan.')
    Object.assign(item, input)
    addActivity('Layanan diperbarui', `${item.name} pada katalog ${item.type}`, 'blue')
    return item
  }

  const createInvoiceFromOrder = (input: {
    bookingId: string
    kind: Invoice['kind']
    issuedAt: string
    dueDate?: string
    items: Array<{ catalogItemId: string; quantity: number; customerPrice: number }>
  }) => {
    const booking = bookingFor(input.bookingId)
    if (!booking) throw new Error('Booking tidak ditemukan.')
    if (!input.items.length) throw new Error('Tambahkan minimal satu layanan.')
    if (input.kind === 'Additional' && !bookingInvoices(input.bookingId).length) {
      throw new Error('Additional hanya dapat dibuat setelah pesanan awal memiliki invoice.')
    }
    if (input.kind === 'Utama' && bookingInvoices(input.bookingId).some((invoice) => invoice.kind === 'Utama')) {
      throw new Error('Booking ini sudah mempunyai invoice utama.')
    }

    const invoiceItems: InvoiceItem[] = input.items.map((line) => {
      const catalogItem = catalog.value.find((item) => item.id === line.catalogItemId && item.active)
      if (!catalogItem) throw new Error('Salah satu layanan tidak tersedia atau sudah nonaktif.')
      if (line.quantity <= 0 || line.customerPrice < 0) throw new Error('Qty dan harga customer tidak valid.')
      return {
        id: uid(),
        name: catalogItem.name,
        quantity: line.quantity,
        catalogPrice: catalogItem.price,
        unitPrice: line.customerPrice,
      }
    })

    const invoice: Invoice = {
      id: uid(),
      invoiceNumber: `INV-${new Date(input.issuedAt).getFullYear()}-${String(invoices.value.length + 1).padStart(4, '0')}`,
      bookingId: input.bookingId,
      kind: input.kind,
      issuedAt: input.issuedAt,
      dueDate: input.dueDate,
      items: invoiceItems,
    }
    invoices.value.unshift(invoice)
    addActivity(
      input.kind === 'Utama' ? 'Pesanan dan invoice dibuat' : 'Additional ditambahkan',
      `${invoice.invoiceNumber} untuk ${booking.poNumber}`,
      input.kind === 'Utama' ? 'blue' : 'amber',
    )
    return invoice
  }

  const addExpense = (input: Omit<Expense, 'id'>) => {
    expenses.value.unshift({ id: uid(), ...input })
    addActivity('Pengeluaran dicatat', input.description, 'rose')
  }

  const moveStock = (input: { itemId: string; type: StockMovement['type']; quantity: number; date: string; pic: string; notes?: string }) => {
    const item = inventory.value.find((entry) => entry.id === input.itemId)
    if (!item) throw new Error('Barang tidak ditemukan.')
    if (!input.pic.trim()) throw new Error('Nama PIC wajib diisi.')
    if (input.quantity <= 0) throw new Error('Qty harus lebih dari nol.')
    if (input.type === 'Keluar' && input.quantity > stockAvailable(item)) throw new Error('Qty keluar melebihi stok tersedia.')
    input.type === 'Masuk' ? (item.stockIn += input.quantity) : (item.stockOut += input.quantity)
    movements.value.unshift({ id: uid(), ...input, pic: input.pic.trim() })
    addActivity(`Barang ${input.type.toLowerCase()}`, `${item.name} ${input.quantity} ${item.unit}`, input.type === 'Masuk' ? 'green' : 'amber')
  }

  const addInventoryItem = (input: Omit<InventoryItem, 'id' | 'code' | 'stockIn' | 'stockOut' | 'active'>) => {
    const item: InventoryItem = {
      ...input,
      id: uid(),
      code: `BRG-${String(inventory.value.length + 1).padStart(4, '0')}`,
      stockIn: 0,
      stockOut: 0,
      active: true,
    }
    inventory.value.unshift(item)
    addActivity('Barang baru ditambahkan', `${item.name} masuk ke master inventory`, 'blue')
    return item
  }

  const addWeddingAttire = (input: Omit<WeddingAttire, 'id' | 'code'>) => {
    const item: WeddingAttire = {
      ...input,
      id: uid(),
      code: `BTR-${String(weddingAttire.value.length + 1).padStart(4, '0')}`,
    }
    weddingAttire.value.unshift(item)
    addActivity('Busana ditambahkan', `${item.name} · ${item.category} · Size ${item.size}`, 'blue')
    return item
  }

  const updateWeddingAttireStatus = (id: string, status: AttireStatus) => {
    const item = weddingAttire.value.find((entry) => entry.id === id)
    if (!item) throw new Error('Busana tidak ditemukan.')
    item.status = status
  }

  const saveWeddingForm = (input: WeddingFittingForm) => {
    if (!bookingFor(input.bookingId)) throw new Error('Pilih Nomor PO sebelum menyimpan form.')
    const index = weddingForms.value.findIndex((form) => form.bookingId === input.bookingId)
    const form = { ...input, updatedAt: new Date().toISOString() }
    if (index >= 0) weddingForms.value.splice(index, 1, form)
    else weddingForms.value.unshift(form)
    const booking = bookingFor(input.bookingId)
    addActivity('Form fitting disimpan', `${booking?.poNumber} · ${customerFor(booking?.customerId ?? '')?.name}`, 'green')
    return form
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
    expenses.value = fresh.expenses
    activities.value = fresh.activities
    weddingAttire.value = fresh.weddingAttire
    weddingForms.value = fresh.weddingForms
  }

  let persistenceTimer: ReturnType<typeof setTimeout> | undefined

  const persistSnapshot = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      customers: customers.value, bookings: bookings.value, catalog: catalog.value, invoices: invoices.value,
      payments: payments.value, inventory: inventory.value, movements: movements.value, expenses: expenses.value, activities: activities.value,
      weddingAttire: weddingAttire.value, weddingForms: weddingForms.value,
    }))
  }

  const schedulePersistence = () => {
    if (persistenceTimer) clearTimeout(persistenceTimer)
    persistenceTimer = setTimeout(() => {
      persistenceTimer = undefined
      if ('requestIdleCallback' in window) window.requestIdleCallback(persistSnapshot, { timeout: 800 })
      else persistSnapshot()
    }, 180)
  }

  watch([customers, bookings, catalog, invoices, payments, inventory, movements, expenses, activities, weddingAttire, weddingForms], () => {
    schedulePersistence()
  }, { deep: true })

  window.addEventListener('pagehide', persistSnapshot)

  return {
    customers, bookings, catalog, invoices, payments, inventory, movements, expenses, activities, weddingAttire, weddingForms,
    totalBilling, totalPaid, totalReceivable, totalExpenses, upcomingBookings, lowStock,
    invoiceTotal, bookingInvoices, bookingTotal, bookingPaid, bookingBalance, customerFor, bookingFor,
    stockAvailable, stockStatus, addBooking, updateBooking, addPayment, addCatalogItem, updateCatalogItem, createInvoiceFromOrder, addExpense, moveStock, addInventoryItem,
    addWeddingAttire, updateWeddingAttireStatus, saveWeddingForm, resetDemo,
  }
})
