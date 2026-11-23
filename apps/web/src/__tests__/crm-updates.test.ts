import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCrmStore, type WeddingFittingForm } from '../stores/crm'
import { formatCurrency, formatTerbilang, formatThousands, parseCurrencyInput } from '../utils/format'
import { buildWeddingAttireReportPdfDoc, buildWeddingFittingPdfDoc } from '../utils/weddingPdf'
import { buildInvoicePdfDoc } from '../utils/invoicePdf'
import {
  buildPaymentReceiptPdfDoc,
  buildPaymentReceiptPdfFromPayload,
  decodeReceiptShareToken,
  encodeReceiptShareToken,
  formatWhatsAppPhone,
  toReceiptSharePayload,
} from '../utils/receiptPdf'
import { buildSelectedReportsPdfDoc } from '../utils/reportPdf'

describe('Currency formatting & parsing', () => {
  it('formats currency with Rp. prefix and Indonesian thousand separators', () => {
    expect(formatCurrency(250000)).toBe('Rp. 250.000')
    expect(formatCurrency(2500000)).toBe('Rp. 2.500.000')
    expect(formatCurrency(0)).toBe('Rp. 0')
    expect(formatCurrency(-15000)).toBe('-Rp. 15.000')
  })

  it('formats thousands and parses numeric digits without currency prefix', () => {
    expect(formatThousands(250000)).toBe('250.000')
    expect(formatThousands(0)).toBe('')
    expect(parseCurrencyInput('Rp. 250.000')).toBe(250000)
    expect(parseCurrencyInput('250.000')).toBe(250000)
    expect(parseCurrencyInput('')).toBe(0)
  })
})

describe('Database Customer — Jenis Penataan (Hijabdo / Hairdo)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('saves and updates stylingType on bookings', () => {
    const store = useCrmStore()
    const created = store.addBooking({
      name: 'Citra Kirana',
      phone: '081234567890',
      location: 'Hotel Mulia Jakarta',
      eventDate: '2026-12-20',
      eventTime: '06:30',
      stylingType: 'Hijabdo',
      notes: 'Resepsi siang',
    })

    expect(created.stylingType).toBe('Hijabdo')
    expect(store.bookingFor(created.id)?.stylingType).toBe('Hijabdo')

    store.updateBooking(created.id, {
      name: 'Citra Kirana',
      phone: '081234567890',
      location: 'Hotel Mulia Jakarta',
      eventDate: '2026-12-20',
      eventTime: '06:30',
      stylingType: 'Hairdo',
      notes: 'Resepsi siang',
      status: 'Terkonfirmasi',
    })

    expect(store.bookingFor(created.id)?.stylingType).toBe('Hairdo')
    expect(store.bookingFor(created.id)?.status).toBe('Terkonfirmasi')
  })
})

describe('Pesanan — Tanggal Invoice Dibuat, Kelompok Kronologis, Additional & Snapshot', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps Tanggal Invoice Dibuat separate and unchanged when adding subsequent order groups', () => {
    const store = useCrmStore()
    const booking = store.addBooking({
      name: 'Dina Larasati',
      phone: '081288887777',
      location: 'Ritz Carlton',
      eventDate: '2026-12-28',
      stylingType: 'Hairdo',
    })

    const inv = store.createInvoiceFromOrder({
      bookingId: booking.id,
      issuedAt: '2026-11-01',
      orderDate: '2026-11-05',
      items: [
        { catalogItemId: 'cat-1', quantity: 1, customerPrice: 2500000 },
      ],
    })

    expect(inv.issuedAt).toBe('2026-11-01')
    expect(inv.groups).toHaveLength(1)
    expect(inv.groups[0]!.kind).toBe('Awal')
    expect(inv.groups[0]!.orderDate).toBe('2026-11-05')
    expect(store.bookingTotal(booking.id)).toBe(2500000)
    expect(store.bookingBalance(booking.id)).toBe(2500000)

    // Record DP payment
    store.addPayment({
      bookingId: booking.id,
      amount: 1000000,
      method: 'Transfer',
      paidAt: '2026-11-06',
    })
    expect(store.bookingPaid(booking.id)).toBe(1000000)
    expect(store.bookingBalance(booking.id)).toBe(1500000)

    // Add second order group (later date)
    store.addOrderGroupToBooking({
      bookingId: booking.id,
      orderDate: '2026-11-20',
      items: [
        { catalogItemId: 'cat-5', quantity: 2, customerPrice: 300000 },
        { catalogItemId: 'cat-6', quantity: 1, customerPrice: 600000 },
      ],
    })

    // Add third order group (middle date to verify chronological sort)
    store.addOrderGroupToBooking({
      bookingId: booking.id,
      orderDate: '2026-11-12',
      items: [
        { catalogItemId: 'cat-4', quantity: 1, customerPrice: 450000 },
      ],
    })

    const updated = store.bookingInvoice(booking.id)!
    // Tanggal Invoice Dibuat must remain untouched
    expect(updated.issuedAt).toBe('2026-11-01')
    // All groups linked to same invoice / PO and sorted chronologically
    const groups = store.sortedOrderGroups(updated)
    expect(groups.map((g) => g.orderDate)).toEqual(['2026-11-05', '2026-11-12', '2026-11-20'])
    expect(groups.map((g) => g.kind)).toEqual(['Awal', 'Tambahan', 'Tambahan'])

    // Totals & balance: 2.500.000 + 450.000 + (600.000 + 600.000) = 4.150.000; paid 1.000.000 => 3.150.000
    expect(store.bookingTotal(booking.id)).toBe(4150000)
    expect(store.bookingPaid(booking.id)).toBe(1000000)
    expect(store.bookingBalance(booking.id)).toBe(3150000)
    expect(store.bookingPayments(booking.id)).toHaveLength(1)
    expect(store.bookingPayments('b-3')).toHaveLength(0)
  })

  it('snapshots service name and price so catalog edits do not alter saved orders/invoices', () => {
    const store = useCrmStore()
    const booking = store.addBooking({
      name: 'Rani Puspita',
      phone: '081355556666',
      location: 'Balai Kartini',
      eventDate: '2026-12-30',
      stylingType: 'Hijabdo',
    })

    store.createInvoiceFromOrder({
      bookingId: booking.id,
      issuedAt: '2026-11-10',
      orderDate: '2026-11-10',
      items: [{ catalogItemId: 'cat-1', quantity: 1, customerPrice: 2400000 }],
    })

    // Edit catalog item name and price
    const catItem = store.catalog.find((c) => c.id === 'cat-1')!
    store.updateCatalogItem('cat-1', {
      name: 'Makeup Wedding VIP 2027',
      type: catItem.type,
      description: catItem.description,
      price: 3500000,
      unit: catItem.unit,
      active: true,
    })

    const savedInv = store.bookingInvoice(booking.id)!
    const savedItem = savedInv.groups[0]!.items[0]!
    expect(savedItem.name).toBe('Makeup Wedding')
    expect(savedItem.unitPrice).toBe(2400000)
    expect(savedItem.catalogPrice).toBe(2500000)
    expect(store.bookingTotal(booking.id)).toBe(2400000)
  })
})

describe('Wedding Portal — Acara, Domas/Manggolo & Softlens', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('stores per-event attire, timeNote, manggolo counts, and softlens type', () => {
    const store = useCrmStore()
    const form: WeddingFittingForm = {
      id: 'wf-1',
      bookingId: 'b-1',
      measurements: { ayah: { LKepala: '56', Slop: '42' } },
      events: [
        {
          number: 1,
          name: 'Akad Nikah',
          readyTime: '05:00',
          timeNote: 'Ready pagi jam 5 WIB',
          bride: { attireId: 'attire-1', look: 'Jawa Klasik', accessories: 'Siger', shoes: '38' },
          groom: { attireId: 'attire-4', look: 'Beskap Putih', accessories: 'Keris', shoes: '42' },
        },
        {
          number: 2,
          name: 'Resepsi',
          readyTime: '10:30',
          timeNote: 'Ganti busana resepsi',
          bride: { attireId: 'attire-2', look: 'Modern', accessories: 'Tiara', shoes: '38' },
          groom: { attireId: 'attire-5', look: 'Navy Suit', accessories: 'Pin', shoes: '42' },
        },
      ],
      uniforms: {
        domas: 'Kebaya sage 4 orang',
        manggolo: 'Beskap hitam',
        softlens: 'Silinder',
      },
      manggoloBlangkon: 4,
      manggoloSlop: 4,
      vendors: { wo: 'Harmoni WO' },
      updatedAt: '',
    }

    const saved = store.saveWeddingForm(form)
    expect(saved.events).toHaveLength(2)
    expect(saved.events[0]!.timeNote).toBe('Ready pagi jam 5 WIB')
    expect(saved.events[1]!.bride.attireId).toBe('attire-2')
    expect(saved.manggoloBlangkon).toBe(4)
    expect(saved.manggoloSlop).toBe(4)
    expect(saved.uniforms.softlens).toBe('Silinder')
  })

  it('builds a valid PDF document from saved wedding fitting form data', async () => {
    const store = useCrmStore()
    const booking = store.bookingFor('b-1')!
    const saved = store.saveWeddingForm({
      id: 'wf-pdf-1',
      bookingId: booking.id,
      measurements: { ayah: { LKepala: '56', Slop: '42' } },
      events: [
        {
          number: 1,
          name: 'Akad Nikah',
          readyTime: '05:30',
          timeNote: 'Ready pagi',
          bride: { attireId: 'attire-1', look: 'Jawa', accessories: 'Siger', shoes: '38' },
          groom: { attireId: 'attire-4', look: 'Beskap', accessories: 'Keris', shoes: '42' },
        },
      ],
      uniforms: { domas: 'Sage 4 orang', manggolo: 'Hitam', softlens: 'Normal' },
      manggoloBlangkon: 2,
      manggoloSlop: 2,
      vendors: { wo: 'Azura WO' },
      updatedAt: '',
    })

    const doc = await buildWeddingFittingPdfDoc({
      form: saved,
      booking,
      attireList: store.weddingAttire,
    })

    const bytes = new Uint8Array(doc.output('arraybuffer'))
    const header = new TextDecoder().decode(bytes.slice(0, 5))
    expect(header).toBe('%PDF-')
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('derives attire Tersedia/Terpakai status and schedule dates from fitting DB, and supports photo update', () => {
    const store = useCrmStore()
    const attire1 = store.weddingAttire.find((a) => a.id === 'attire-1')!
    expect(store.effectiveAttireStatus(attire1)).toBe('Tersedia')
    expect(store.attireSchedule('attire-1')).toHaveLength(0)

    store.saveWeddingForm({
      id: 'wf-sched-1',
      bookingId: 'b-1',
      measurements: { ayah: { LKepala: '56', Slop: '42' } },
      events: [
        {
          number: 1,
          name: 'Akad',
          readyTime: '05:30',
          timeNote: '',
          bride: { attireId: 'attire-1', look: '', accessories: '', shoes: '' },
          groom: { attireId: 'attire-4', look: '', accessories: '', shoes: '' },
        },
      ],
      uniforms: {},
      manggoloBlangkon: null,
      manggoloSlop: null,
      vendors: {},
      updatedAt: '',
    })

    // Available before the event; In Use on event day; Laundry on H+1; Available again on H+2.
    expect(store.effectiveAttireStatus(attire1, '2026-11-20')).toBe('Tersedia')
    expect(store.effectiveAttireStatus(attire1, '2026-11-22')).toBe('Terpakai')
    expect(store.effectiveAttireStatus(attire1, '2026-11-23')).toBe('Laundry')
    expect(store.effectiveAttireStatus(attire1, '2026-11-24')).toBe('Tersedia')
    const schedule = store.attireSchedule('attire-1', { referenceDate: '2026-11-20' })
    expect(schedule).toHaveLength(1)
    expect(schedule[0]!.eventDate).toBe('2026-11-22')
    expect(schedule[0]!.customerName).toBe('Nadya Prameswari')

    // No urgent alert when event is 2 days away (2026-11-20 -> 2026-11-22 = H-2)
    expect(store.urgentAttireSchedules('attire-1', '2026-11-20')).toHaveLength(0)

    // Urgent alert DOES trigger at H-1 (2026-11-21) and Hari H (2026-11-22)
    expect(store.urgentAttireSchedules('attire-1', '2026-11-21')).toHaveLength(1)
    expect(store.urgentAttireSchedules('attire-1', '2026-11-22')).toHaveLength(1)

    // Laundry status follows the event date without a manual action.
    expect(store.effectiveAttireStatus(attire1, '2026-11-21')).toBe('Tersedia')
    expect(store.getLaundryUrgentAlerts('2026-11-21')).toHaveLength(0)

    // Conflict check on same date for a different booking
    expect(store.attireConflictsOnDate('attire-1', '2026-11-22', 'b-2')).toHaveLength(1)
    expect(store.attireConflictsOnDate('attire-1', '2026-11-22', 'b-1')).toHaveLength(0)

    // Photo update via updateWeddingAttire
    store.updateWeddingAttire('attire-1', {
      name: attire1.name,
      category: attire1.category,
      size: attire1.size,
      status: attire1.status,
      imageUrl: 'data:image/jpeg;base64,abc123',
    })
    expect(store.weddingAttire.find((a) => a.id === 'attire-1')?.imageUrl).toBe('data:image/jpeg;base64,abc123')
  })

  it('cancels a booking, removes its PO transactions, releases wedding attire, and records refund affecting cashflow', () => {
    const store = useCrmStore()
    // Reserve attire-1 for b-1 (2026-11-22)
    store.saveWeddingForm({
      id: 'wf-cancel-1',
      bookingId: 'b-1',
      measurements: { ayah: { LKepala: '56', Slop: '42' } },
      events: [
        {
          number: 1,
          name: 'Akad',
          readyTime: '05:30',
          timeNote: '',
          bride: { attireId: 'attire-1', look: '', accessories: '', shoes: '' },
          groom: { attireId: 'attire-4', look: '', accessories: '', shoes: '' },
        },
      ],
      uniforms: {},
      manggoloBlangkon: null,
      manggoloSlop: null,
      vendors: {},
      updatedAt: '',
    })

    const attire1 = store.weddingAttire.find((a) => a.id === 'attire-1')!
    expect(store.effectiveAttireStatus(attire1, '2026-11-20')).toBe('Tersedia')
    expect(store.effectiveAttireStatus(attire1, '2026-11-22')).toBe('Terpakai')
    expect(store.bookingTotal('b-1')).toBe(3200000)
    expect(store.bookingPaid('b-1')).toBe(1500000)

    const cashBefore = store.netCashflow
    store.cancelBooking('b-1', {
      refundDate: '2026-11-18',
      amount: 1000000,
      method: 'Transfer',
      proofImageUrl: 'data:image/jpeg;base64,refundproof',
      notes: 'Refund sebagian DP',
    })

    expect(store.bookingFor('b-1')?.status).toBe('Dibatalkan')
    expect(store.bookingInvoice('b-1')).toBeUndefined()
    expect(store.bookingTotal('b-1')).toBe(0)
    expect(store.bookingPaid('b-1')).toBe(0)
    // Attire automatically becomes Tersedia again
    expect(store.effectiveAttireStatus(attire1, '2026-11-20')).toBe('Tersedia')
    // Refund recorded & impacts net cashflow
    expect(store.totalRefunds).toBe(1000000)
    expect(store.netCashflow).toBe(cashBefore - 1500000 - 1000000)
  })
})

describe('Pesanan Edit per Kelompok & Urutan Inti dulu baru Additional di Invoice', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('edits an order group inline without changing Tanggal Invoice Dibuat and sorts Inti before Additional on invoice', () => {
    const store = useCrmStore()
    const booking = store.addBooking({
      name: 'Maya Putri',
      phone: '081233334444',
      location: 'Hotel Kempinski',
      eventDate: '2026-12-22',
      stylingType: 'Hijabdo',
    })

    const inv = store.createInvoiceFromOrder({
      bookingId: booking.id,
      issuedAt: '2026-11-01',
      orderDate: '2026-11-05',
      items: [
        { catalogItemId: 'cat-5', quantity: 1, customerPrice: 350000 }, // Additional
        { catalogItemId: 'cat-1', quantity: 1, customerPrice: 2500000 }, // Inti
      ],
    })

    const groupId = inv.groups[0]!.id
    store.updateOrderGroup(booking.id, groupId, {
      orderDate: '2026-11-06',
      items: [
        { catalogItemId: 'cat-5', quantity: 2, customerPrice: 300000 }, // Additional
        { catalogItemId: 'cat-1', quantity: 1, customerPrice: 2400000 }, // Inti
      ],
    })

    const updated = store.bookingInvoice(booking.id)!
    expect(updated.issuedAt).toBe('2026-11-01')
    expect(updated.groups[0]!.orderDate).toBe('2026-11-06')
    expect(store.bookingTotal(booking.id)).toBe(3000000)

    const invoiceOrderedItems = store.sortInvoiceItemsIntiFirst(updated.groups[0]!.items)
    expect(invoiceOrderedItems[0]!.serviceType).toBe('Inti')
    expect(invoiceOrderedItems[0]!.name).toBe('Makeup Wedding')
    expect(invoiceOrderedItems[1]!.serviceType).toBe('Additional')
    expect(invoiceOrderedItems[1]!.name).toBe('Hairdo')
  })
})

describe('Pembayaran Kwitansi PDF & WhatsApp Formatting', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('formats Indonesian phone numbers to WhatsApp 62 format and generates receipt PDF', () => {
    expect(formatWhatsAppPhone('0812 3421 9088')).toBe('6281234219088')
    expect(formatWhatsAppPhone('+62 857-9012-1120')).toBe('6285790121120')

    const store = useCrmStore()
    const payment = store.payments[0]!
    const booking = store.bookingFor(payment.bookingId)!
    const customer = store.customerFor(booking.customerId)!
    const invoice = store.bookingInvoice(booking.id)!
    const doc = buildPaymentReceiptPdfDoc({
      payment,
      booking,
      customer,
      invoice,
      sortedGroups: store.sortedOrderGroups(invoice),
      sortItemsIntiFirst: store.sortInvoiceItemsIntiFirst,
      totalBilling: store.bookingTotal(booking.id),
      totalPaid: store.bookingPaid(booking.id),
      balance: store.bookingBalance(booking.id),
    })
    const bytes = new Uint8Array(doc.output('arraybuffer'))
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')

    // Shareable receipt token round-trip & standalone PDF rebuild
    const payload = toReceiptSharePayload({
      payment,
      booking,
      customer,
      invoice,
      sortedGroups: store.sortedOrderGroups(invoice),
      sortItemsIntiFirst: store.sortInvoiceItemsIntiFirst,
      totalBilling: store.bookingTotal(booking.id),
      totalPaid: store.bookingPaid(booking.id),
      balance: store.bookingBalance(booking.id),
    })
    const token = encodeReceiptShareToken(payload)
    const decoded = decodeReceiptShareToken(token)
    expect(decoded).not.toBeNull()
    expect(decoded?.receiptNumber).toBe(payment.receiptNumber)
    expect(decoded?.items.length).toBeGreaterThan(0)
    const rebuiltPdf = buildPaymentReceiptPdfFromPayload(decoded!)
    const rebuiltBytes = new Uint8Array(rebuiltPdf.output('arraybuffer'))
    expect(new TextDecoder().decode(rebuiltBytes.slice(0, 5))).toBe('%PDF-')
  })
})

describe('Inventory Multi-Item Masuk/Keluar, Bukti Foto & Stok Opname', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('records multi-item stock movement with proof photo and aligns stock via stok opname', () => {
    const store = useCrmStore()
    const item1 = store.inventory.find((i) => i.id === 'stock-1')!
    const item2 = store.inventory.find((i) => i.id === 'stock-2')!
    const before1 = store.stockAvailable(item1)
    const before2 = store.stockAvailable(item2)

    store.submitBatchStockMovement({
      type: 'Masuk',
      date: '2026-11-17',
      pic: 'Nisa',
      notes: 'Restock gabungan',
      proofImageUrl: 'data:image/jpeg;base64,proof123',
      items: [
        { itemId: 'stock-1', quantity: 3 },
        { itemId: 'stock-2', quantity: 4 },
      ],
    })

    expect(store.stockAvailable(item1)).toBe(before1 + 3)
    expect(store.stockAvailable(item2)).toBe(before2 + 4)
    expect(store.movements[0]!.proofImageUrl).toBe('data:image/jpeg;base64,proof123')

    // Stok opname: item1 physical = before1 + 1 (diff -2), item2 physical = before2 + 6 (diff +2)
    const opname = store.submitStockOpname({
      date: '2026-11-17',
      pic: 'Rani',
      notes: 'Opname akhir bulan',
      items: [
        { itemId: 'stock-1', physicalStock: before1 + 1, notes: '2 botol pecah' },
        { itemId: 'stock-2', physicalStock: before2 + 6, notes: 'Temuan gudang' },
      ],
    })

    expect(opname.items[0]!.diff).toBe(-2)
    expect(opname.items[1]!.diff).toBe(2)
    expect(store.stockAvailable(item1)).toBe(before1 + 1)
    expect(store.stockAvailable(item2)).toBe(before2 + 6)
  })
})

describe('Laporan Checklist PDF', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('generates a multi-section PDF from checked report keys', async () => {
    const store = useCrmStore()
    const doc = await buildSelectedReportsPdfDoc({
      selectedKeys: ['customers', 'bookings', 'orders', 'payments', 'stock-opname', 'inventory'],
      data: {
        customers: store.customers,
        bookings: store.bookings,
        invoices: store.invoices,
        payments: store.payments,
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

    const bytes = new Uint8Array(doc.output('arraybuffer'))
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(100)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('enforces manual refund limit, logs auto cancel expense without double counting, and manages employees & inventory photos', () => {
    const store = useCrmStore()
    const baseExpensesBefore = store.totalExpenses
    // b-1 has paid 1.500.000
    expect(() =>
      store.cancelBooking('b-1', {
        refundDate: '2026-11-18',
        amount: 2000000,
        method: 'Transfer',
      }),
    ).toThrow(/exceeds/i)

    // Cancel b-2 (paid 2.850.000) with partial refund 1.000.000 -> auto logs Expense with source 'Bayar Cancel'
    store.cancelBooking('b-2', {
      refundDate: '2026-11-18',
      amount: 1000000,
      method: 'Transfer',
      notes: 'Cancelled partial refund',
    })
    const cancelExp = store.expenses.find((e) => e.bookingId === 'b-2' && e.source === 'Bayar Cancel')
    expect(cancelExp).toBeTruthy()
    expect(cancelExp?.amount).toBe(1000000)
    // totalCashOut includes the auto expense once without double counting the linked refund
    expect(store.totalExpenses).toBe(baseExpensesBefore + 1000000)
    expect(store.totalCashOut).toBe(baseExpensesBefore + 1000000)

    // Assign and unassign employee on b-1
    store.toggleBookingEmployee('b-1', 'emp-4')
    const assigned = store.assignedEmployeesForBooking('b-1')
    expect(assigned.some((e) => e.id === 'emp-4')).toBe(true)

    store.setBookingJobNotes('b-1', 'Standby venue jam 04.30')
    expect(store.jobForBooking('b-1')?.notes).toBe('Standby venue jam 04.30')

    const newEmp = store.addEmployee({ name: 'Laras Putri', role: 'Asisten MUA' })
    expect(store.activeEmployees.some((e) => e.id === newEmp.id)).toBe(true)

    // Business profile logo & inventory catalog add/edit/delete
    store.updateBusinessProfile({ name: 'Azura Bridal', logoUrl: 'data:image/png;base64,iVBORw==' })
    expect(store.businessProfile.name).toBe('Azura Bridal')
    expect(store.businessProfile.logoUrl).toBe('data:image/png;base64,iVBORw==')

    const invCountBefore = store.inventory.length
    const addedItem = store.addInventoryItem({
      name: 'Highlighter Stick',
      category: 'Complexion',
      unit: 'pcs',
      initialStock: 5,
      minimumStock: 2,
      location: 'Drawer B3',
    })
    expect(store.inventory.length).toBe(invCountBefore + 1)
    store.updateInventoryItem(addedItem.id, {
      name: 'Highlighter Liquid',
      category: 'Complexion',
      unit: 'botol',
      initialStock: 6,
      minimumStock: 2,
      location: 'Drawer B4',
    })
    expect(store.inventory.find((i) => i.id === addedItem.id)?.name).toBe('Highlighter Liquid')
    store.deleteInventoryItem(addedItem.id)
    expect(store.inventory.length).toBe(invCountBefore)
  })

  it('builds editorial invoice PDF, terbilang words, and includes cancelled entries in calendar audit', () => {
    expect(formatTerbilang(1000000)).toBe('Satu juta rupiah')
    expect(formatTerbilang(2850000)).toBe('Dua juta delapan ratus lima puluh ribu rupiah')

    const store = useCrmStore()
    const inv = store.invoices[0]!
    const booking = store.bookingFor(inv.bookingId)!
    const customer = store.customerFor(booking.customerId)!
    const doc = buildInvoicePdfDoc({
      invoice: inv,
      booking,
      customer,
      sortedGroups: store.sortedOrderGroups(inv),
      payments: store.bookingPayments(inv.bookingId),
      totalBilling: store.bookingTotal(inv.bookingId),
      totalPaid: store.bookingPaid(inv.bookingId),
      balance: store.bookingBalance(inv.bookingId),
      businessProfile: store.businessProfile,
      sortItemsIntiFirst: store.sortInvoiceItemsIntiFirst,
    })
    const bytes = new Uint8Array(doc.output('arraybuffer'))
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')

    store.saveWeddingForm({
      id: 'wf-cal-cancel',
      bookingId: 'b-1',
      measurements: {},
      events: [{
        number: 1,
        name: 'Akad',
        readyTime: '05:00',
        timeNote: '',
        bride: { attireId: 'attire-1', look: '', accessories: '', shoes: '' },
        groom: { attireId: '', look: '', accessories: '', shoes: '' },
      }],
      uniforms: {},
      manggoloBlangkon: null,
      manggoloSlop: null,
      vendors: {},
      updatedAt: '',
    })
    store.cancelBooking('b-1')
    const attire1 = store.weddingAttire.find((a) => a.id === 'attire-1')!
    expect(store.effectiveAttireStatus(attire1)).toBe('Tersedia')
    const calEntries = store.attireSchedule('attire-1', { includePast: true, includeCancelled: true })
    expect(calEntries.some((e) => e.bookingId === 'b-1' && e.bookingStatus === 'Dibatalkan')).toBe(true)
  })

  it('supports editing/deleting payments, additional order groups, expenses with proof, stock movements, and stock opname', () => {
    const store = useCrmStore()

    // Payment edit & delete (b-1 initial paid = 1.500.000)
    const pay = store.payments.find((p) => p.bookingId === 'b-1')!
    store.updatePayment(pay.id, { amount: 1800000, method: 'QRIS', paidAt: '2026-11-16', notes: 'Diperbarui' })
    expect(store.bookingPaid('b-1')).toBe(1800000)
    store.deletePayment(pay.id)
    expect(store.bookingPaid('b-1')).toBe(0)

    // Delete additional order group
    store.addOrderGroupToBooking({
      bookingId: 'b-1',
      orderDate: '2026-11-18',
      items: [{ catalogItemId: 'cat-5', quantity: 1, customerPrice: 350000 }],
    })
    const inv = store.bookingInvoice('b-1')!
    const addedGroup = inv.groups.find((g) => g.kind === 'Tambahan')!
    expect(addedGroup).toBeTruthy()
    store.deleteOrderGroup('b-1', addedGroup.id)
    expect(store.bookingInvoice('b-1')!.groups.some((g) => g.id === addedGroup.id)).toBe(false)

    // Expense with optional proof, update, and delete
    const expCountBefore = store.expenses.length
    store.addExpense({
      date: '2026-11-18',
      category: 'Perlengkapan',
      description: 'Sponge makeup cadangan',
      amount: 120000,
      method: 'Transfer',
      expenseScope: 'Di Luar PO',
      proofImageUrl: 'data:image/jpeg;base64,abc',
    })
    const createdExp = store.expenses[0]!
    expect(createdExp.proofImageUrl).toBe('data:image/jpeg;base64,abc')
    store.updateExpense(createdExp.id, {
      date: '2026-11-18',
      category: 'Transportasi',
      description: 'Transportasi ke venue',
      amount: 200000,
      method: 'Cash',
      expenseScope: 'Berdasarkan PO',
      bookingId: 'b-2',
    })
    expect(store.expenses[0]!.bookingId).toBe('b-2')
    expect(store.expenses[0]!.amount).toBe(200000)
    store.deleteExpense(createdExp.id)
    expect(store.expenses.length).toBe(expCountBefore)

    // Batch multiple expenses in one submission
    store.addBatchExpenses({
      date: '2026-11-18',
      method: 'Transfer',
      expenseScope: 'Berdasarkan PO',
      bookingId: 'b-1',
      items: [
        { category: 'Transportasi', description: 'Tol & bensin tim', amount: 150000 },
        { category: 'Honor Tim', description: 'Asisten hairdo', amount: 400000 },
      ],
    })
    expect(store.expenses.length).toBe(expCountBefore + 2)
    expect(store.expenses[0]!.description).toBe('Tol & bensin tim')
    expect(store.expenses[1]!.description).toBe('Asisten hairdo')

    // Stock movement edit & delete recalculates stock
    const item = store.inventory.find((i) => i.id === 'stock-1')!
    const baseAvail = store.stockAvailable(item)
    store.moveStock({ itemId: 'stock-1', type: 'Masuk', quantity: 4, date: '2026-11-18', pic: 'Rani' })
    const createdMov = store.movements[0]!
    expect(store.stockAvailable(item)).toBe(baseAvail + 4)
    store.updateStockMovement(createdMov.id, { itemId: 'stock-1', type: 'Masuk', quantity: 7, date: '2026-11-18', pic: 'Nisa' })
    expect(store.stockAvailable(item)).toBe(baseAvail + 7)
    store.deleteStockMovement(createdMov.id)
    expect(store.stockAvailable(item)).toBe(baseAvail)

    // Stock opname edit & delete reverts and reapplies stockAdjustment cleanly
    const opname = store.submitStockOpname({
      date: '2026-11-18',
      pic: 'Rani',
      items: [{ itemId: 'stock-1', physicalStock: baseAvail - 2 }],
    })
    expect(store.stockAvailable(item)).toBe(baseAvail - 2)
    store.updateStockOpname(opname.id, {
      date: '2026-11-18',
      pic: 'Rani',
      items: [{ itemId: 'stock-1', physicalStock: baseAvail + 3 }],
    })
    expect(store.stockAvailable(item)).toBe(baseAvail + 3)
    store.deleteStockOpname(opname.id)
    expect(store.stockAvailable(item)).toBe(baseAvail)
  })
})

describe('Pengaturan Dropdown & Laporan Jadwal Busana PDF', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds, updates, and removes dropdown options across payment methods and expense categories', () => {
    const store = useCrmStore()

    store.addDropdownOption('paymentMethods', 'Debit BCA')
    expect(store.paymentMethods).toContain('Debit BCA')
    store.updateDropdownOption('paymentMethods', 'Debit BCA', 'EDC BCA')
    expect(store.paymentMethods).toContain('EDC BCA')
    expect(store.paymentMethods).not.toContain('Debit BCA')
    store.removeDropdownOption('paymentMethods', 'EDC BCA')
    expect(store.paymentMethods).not.toContain('EDC BCA')

    store.addDropdownOption('poExpenseCategories', 'Fresh Flowers')
    expect(store.poExpenseCategories).toContain('Fresh Flowers')
    store.addDropdownOption('generalExpenseCategories', 'Utilities')
    expect(store.generalExpenseCategories).toContain('Utilities')
    store.addDropdownOption('stylingTypes', 'Paes Solo')
    expect(store.stylingTypes).toContain('Paes Solo')
    store.addDropdownOption('inventoryCategories', 'Brushes')
    expect(store.inventoryCategories).toContain('Brushes')
    store.addDropdownOption('units', 'box')
    expect(store.units).toContain('box')
  })

  it('builds a valid PDF document for wedding attire schedules filtered by date range', async () => {
    const store = useCrmStore()
    store.saveWeddingForm({
      id: 'wf-report-1',
      bookingId: 'b-1',
      measurements: {},
      events: [
        {
          number: 1,
          name: 'Resepsi Pagi',
          readyTime: '06:00',
          timeNote: 'Siap jam 6',
          bride: { attireId: 'attire-1', look: 'Jawa', accessories: 'Siger', shoes: '38' },
          groom: { attireId: 'attire-4', look: 'Beskap', accessories: 'Keris', shoes: '42' },
        },
      ],
      uniforms: {},
      manggoloBlangkon: null,
      manggoloSlop: null,
      vendors: {},
      updatedAt: '',
    })

    const doc = await buildWeddingAttireReportPdfDoc({
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      bookings: store.bookings,
      customers: store.customers,
      weddingForms: store.weddingForms,
      attireList: store.weddingAttire,
      effectiveStatus: store.effectiveAttireStatus,
      attireSchedule: store.attireSchedule,
      businessProfile: store.businessProfile,
    })

    const bytes = new Uint8Array(doc.output('arraybuffer'))
    const header = new TextDecoder().decode(bytes.slice(0, 5))
    expect(header).toBe('%PDF-')
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('uses PO/INV/KWT-NAMA-DD/MM/YYYY format and updates on booking edit', () => {
    const store = useCrmStore()
    const booking = store.addBooking({
      name: 'Rara Sekar',
      phone: '081234567890',
      location: 'Hotel Mulia',
      eventDate: '2026-12-25',
      stylingType: 'Hijabdo',
    })
    expect(booking.poNumber).toBe('PO-Rara Sekar-25/12/2026')

    const inv = store.createInvoiceFromOrder({
      bookingId: booking.id,
      kind: 'Utama',
      issuedAt: '2026-11-23',
      items: [{ catalogItemId: store.catalog[0]!.id, quantity: 1, customerPrice: 2000000 }],
    })
    expect(inv.invoiceNumber).toBe('INV-Rara Sekar-25/12/2026')

    const pay1 = store.addPayment({
      bookingId: booking.id,
      amount: 500000,
      method: 'Transfer',
      paidAt: '2026-11-23',
    })
    const pay2 = store.addPayment({
      bookingId: booking.id,
      amount: 500000,
      method: 'QRIS',
      paidAt: '2026-11-24',
    })
    expect(pay1.receiptNumber).toBe('KWT-Rara Sekar-25/12/2026')
    expect(pay2.receiptNumber).toBe('KWT-Rara Sekar-25/12/2026 (2)')

    store.updateBooking(booking.id, {
      name: 'Rara Putri',
      phone: '081234567890',
      location: 'Hotel Mulia',
      eventDate: '2026-12-26',
      stylingType: 'Hijabdo',
      status: 'Terkonfirmasi',
    })
    expect(booking.poNumber).toBe('PO-Rara Putri-26/12/2026')
    expect(inv.invoiceNumber).toBe('INV-Rara Putri-26/12/2026')
    expect(pay1.receiptNumber).toBe('KWT-Rara Putri-26/12/2026')
    expect(pay2.receiptNumber).toBe('KWT-Rara Putri-26/12/2026 (2)')
  })
})
