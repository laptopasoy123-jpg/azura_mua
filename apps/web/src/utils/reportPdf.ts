import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type {
  Booking,
  BookingRefund,
  Customer,
  Expense,
  InventoryItem,
  Invoice,
  OrderGroup,
  Payment,
  StockMovement,
  StockOpnameRecord,
} from '../stores/crm'
import { formatCurrency, formatDate } from './format'

export type ReportKey =
  | 'customers'
  | 'bookings'
  | 'orders'
  | 'invoices'
  | 'payments'
  | 'receivables'
  | 'expenses'
  | 'cashflow'
  | 'stock-in'
  | 'stock-out'
  | 'stock-opname'
  | 'inventory'

export interface ReportCatalogEntry {
  key: ReportKey
  title: string
  description: string
}

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  { key: 'customers', title: 'Data Pelanggan', description: 'Daftar identitas pelanggan, kontak WhatsApp, dan jumlah pemesanan.' },
  { key: 'bookings', title: 'Pemesanan / Nomor PO', description: 'Jadwal acara, lokasi, jenis penataan (Hijabdo/Hairdo), dan status PO.' },
  { key: 'orders', title: 'Pesanan & Layanan Tambahan', description: 'Rincian pesanan awal dan tambahan per tanggal pemesanan.' },
  { key: 'invoices', title: 'Faktur Tagihan', description: 'Nomor faktur, tanggal dibuat, nilai tagihan, dan status pembayaran.' },
  { key: 'payments', title: 'Pembayaran', description: 'Riwayat kwitansi pembayaran diterima beserta metode pembayaran.' },
  { key: 'receivables', title: 'Piutang Pelanggan', description: 'Daftar PO yang masih memiliki sisa tagihan belum lunas.' },
  { key: 'expenses', title: 'Pengeluaran', description: 'Rincian biaya berdasarkan PO maupun di luar PO.' },
  { key: 'cashflow', title: 'Pemasukan & Pengeluaran', description: 'Rekap perbandingan total pemasukan kas, pengeluaran, dan selisih bersih.' },
  { key: 'stock-in', title: 'Barang Masuk', description: 'Riwayat penambahan stok inventaris beserta tanggal dan penanggung jawab.' },
  { key: 'stock-out', title: 'Barang Keluar', description: 'Riwayat pemakaian/pengeluaran stok inventaris beserta tanggal dan penanggung jawab.' },
  { key: 'stock-opname', title: 'Pemeriksaan Stok (Opname)', description: 'Rekap penyelarasan stok sistem vs fisik beserta selisih (+/-).' },
  { key: 'inventory', title: 'Stok Inventaris Saat Ini', description: 'Posisi stok terkini seluruh barang beserta indikator warna status aman/menipis/habis.' },
]

export interface ReportDataSnapshot {
  customers: Customer[]
  bookings: Booking[]
  invoices: Invoice[]
  payments: Payment[]
  refunds?: BookingRefund[]
  expenses: Expense[]
  inventory: InventoryItem[]
  movements: StockMovement[]
  stockOpnames: StockOpnameRecord[]
  sortedOrderGroups: (invoice: Invoice) => OrderGroup[]
  groupTotal: (group: OrderGroup) => number
  invoiceTotal: (invoice: Invoice) => number
  bookingTotal: (bookingId: string) => number
  bookingPaid: (bookingId: string) => number
  bookingBalance: (bookingId: string) => number
  stockAvailable: (item: InventoryItem) => number
  stockStatus: (item: InventoryItem) => string
}

const inDateRange = (date: string, fromDate: string, toDate: string) => {
  if (fromDate && date < fromDate) return false
  if (toDate && date > toDate) return false
  return true
}

const getLastFinalY = (doc: jsPDF, fallback: number): number => {
  const last = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
  return last?.finalY ?? fallback
}

export const buildSelectedReportsPdfDoc = (params: {
  selectedKeys: ReportKey[]
  fromDate?: string
  toDate?: string
  data: ReportDataSnapshot
}) => {
  const { selectedKeys, fromDate = '', toDate = '', data } = params
  if (!selectedKeys.length) {
    throw new Error('Pilih minimal satu jenis laporan terlebih dahulu.')
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 14
  const contentWidth = pageWidth - marginX * 2
  const bottomLimit = pageHeight - 16

  const findCustomer = (id: string) => data.customers.find((c) => c.id === id)
  const findBooking = (id: string) => data.bookings.find((b) => b.id === id)
  const findInvItem = (id: string) => data.inventory.find((i) => i.id === id)

  const ensureSpace = (y: number, needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage()
      return 16
    }
    return y
  }

  const drawSectionHeading = (currentY: number, title: string): number => {
    const y = ensureSpace(currentY, 16)
    doc.setFillColor(30, 26, 23)
    doc.rect(marginX, y, 3, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(30, 26, 23)
    doc.text(title, marginX + 6, y + 4.7)
    doc.setDrawColor(225, 217, 206)
    doc.line(marginX, y + 7.5, marginX + contentWidth, y + 7.5)
    return y + 10.5
  }

  // Header Banner
  doc.setFillColor(30, 26, 23)
  doc.roundedRect(marginX, 14, contentWidth, 24, 2.5, 2.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  doc.setTextColor(246, 239, 227)
  doc.text('LAPORAN BISNIS — AZURA MAKEUP ARTIST', marginX + 6, 23)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(218, 205, 187)
  const periodLabel = fromDate || toDate
    ? `Periode: ${fromDate ? formatDate(fromDate) : 'Awal'} s/d ${toDate ? formatDate(toDate) : 'Sekarang'}`
    : 'Periode: Semua Data'
  const printedAt = `Dicetak: ${formatDate(new Date().toISOString().slice(0, 10))} · ${selectedKeys.length} bagian laporan`
  doc.text(`${periodLabel}   |   ${printedAt}`, marginX + 6, 31.5)

  let y = 44

  const tableBase = {
    margin: { left: marginX, right: marginX, bottom: 16 },
    tableWidth: contentWidth,
    theme: 'grid' as const,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.3,
      textColor: [34, 47, 41] as [number, number, number],
      lineColor: [223, 231, 227] as [number, number, number],
      overflow: 'linebreak' as const,
      valign: 'middle' as const,
    },
    headStyles: {
      fillColor: [38, 32, 28] as [number, number, number],
      textColor: [246, 239, 227] as [number, number, number],
      fontStyle: 'bold' as const,
    },
  }

  const orderedSelected = REPORT_CATALOG.filter((entry) => selectedKeys.includes(entry.key))

  for (const entry of orderedSelected) {
    y = drawSectionHeading(y, entry.title)

    if (entry.key === 'customers') {
      const rows = data.customers.map((c, idx) => {
        const count = data.bookings.filter((b) => b.customerId === c.id).length
        return [String(idx + 1), c.name, c.phone, String(count)]
      })
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['No', 'Nama Customer', 'Telepon / WhatsApp', 'Total Booking']],
        body: rows.length ? rows : [['-', 'Belum ada data customer', '-', '-']],
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 74 },
          2: { cellWidth: 56 },
          3: { cellWidth: 40, halign: 'center' },
        },
      })
    } else if (entry.key === 'bookings') {
      const filtered = data.bookings.filter((b) => inDateRange(b.eventDate, fromDate, toDate))
      const rows = filtered.map((b) => [
        b.poNumber,
        findCustomer(b.customerId)?.name ?? '-',
        `${formatDate(b.eventDate)} ${b.eventTime || ''}`.trim(),
        b.location,
        b.stylingType || '-',
        b.status,
      ])
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['No. PO', 'Customer', 'Tanggal Acara', 'Lokasi', 'Penataan', 'Status']],
        body: rows.length ? rows : [['-', 'Tidak ada booking pada periode ini', '-', '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 28, fontStyle: 'bold' },
          1: { cellWidth: 38 },
          2: { cellWidth: 32 },
          3: { cellWidth: 42 },
          4: { cellWidth: 20 },
          5: { cellWidth: 22 },
        },
      })
    } else if (entry.key === 'orders') {
      const rows: string[][] = []
      for (const inv of data.invoices) {
        const booking = findBooking(inv.bookingId)
        const cust = booking ? findCustomer(booking.customerId) : undefined
        for (const group of data.sortedOrderGroups(inv)) {
          if (!inDateRange(group.orderDate, fromDate, toDate)) continue
          const itemSummary = group.items
            .map((it) => `${it.name} (${it.quantity} × ${formatCurrency(it.unitPrice)})`)
            .join('\n')
          rows.push([
            booking?.poNumber ?? '-',
            cust?.name ?? '-',
            group.kind === 'Awal' ? 'Pesanan Awal' : 'Tambahan',
            formatDate(group.orderDate),
            itemSummary || '-',
            formatCurrency(data.groupTotal(group)),
          ])
        }
      }
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['No. PO', 'Customer', 'Jenis', 'Tgl Pesan', 'Rincian Layanan', 'Total Kelompok']],
        body: rows.length ? rows : [['-', 'Tidak ada pesanan pada periode ini', '-', '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 26, fontStyle: 'bold' },
          1: { cellWidth: 30 },
          2: { cellWidth: 22 },
          3: { cellWidth: 24 },
          4: { cellWidth: 50 },
          5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
        },
      })
    } else if (entry.key === 'invoices') {
      const filtered = data.invoices.filter((inv) => inDateRange(inv.issuedAt, fromDate, toDate))
      const rows = filtered.map((inv) => {
        const booking = findBooking(inv.bookingId)
        const cust = booking ? findCustomer(booking.customerId) : undefined
        const total = data.invoiceTotal(inv)
        const paid = data.bookingPaid(inv.bookingId)
        const balance = Math.max(0, data.bookingBalance(inv.bookingId))
        return [
          inv.invoiceNumber,
          booking?.poNumber ?? '-',
          cust?.name ?? '-',
          formatDate(inv.issuedAt),
          formatCurrency(total),
          formatCurrency(paid),
          formatCurrency(balance),
        ]
      })
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['No. Invoice', 'No. PO', 'Customer', 'Tgl Dibuat', 'Tagihan', 'Dibayar', 'Sisa']],
        body: rows.length ? rows : [['-', '-', 'Tidak ada invoice pada periode ini', '-', '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 28, fontStyle: 'bold' },
          1: { cellWidth: 26 },
          2: { cellWidth: 32 },
          3: { cellWidth: 22 },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 25, halign: 'right' },
          6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        },
      })
    } else if (entry.key === 'payments') {
      const filtered = data.payments.filter((p) => inDateRange(p.paidAt, fromDate, toDate))
      const totalAmt = filtered.reduce((sum, p) => sum + p.amount, 0)
      const rows = filtered.map((p) => {
        const booking = findBooking(p.bookingId)
        const cust = booking ? findCustomer(booking.customerId) : undefined
        return [
          p.receiptNumber,
          booking?.poNumber ?? '-',
          cust?.name ?? '-',
          formatDate(p.paidAt),
          p.method,
          formatCurrency(p.amount),
        ]
      })
      if (rows.length) {
        rows.push(['TOTAL', '', '', '', '', formatCurrency(totalAmt)])
      }
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['No. Kwitansi', 'No. PO', 'Customer', 'Tanggal', 'Metode', 'Nominal']],
        body: rows.length ? rows : [['-', '-', 'Tidak ada pembayaran pada periode ini', '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 30, fontStyle: 'bold' },
          1: { cellWidth: 28 },
          2: { cellWidth: 44 },
          3: { cellWidth: 26 },
          4: { cellWidth: 22 },
          5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
        },
      })
    } else if (entry.key === 'receivables') {
      const outstanding = data.bookings.filter((b) => data.bookingBalance(b.id) > 0)
      const totalReceivable = outstanding.reduce((sum, b) => sum + data.bookingBalance(b.id), 0)
      const rows = outstanding.map((b) => [
        b.poNumber,
        findCustomer(b.customerId)?.name ?? '-',
        formatDate(b.eventDate),
        formatCurrency(data.bookingTotal(b.id)),
        formatCurrency(data.bookingPaid(b.id)),
        formatCurrency(data.bookingBalance(b.id)),
      ])
      if (rows.length) {
        rows.push(['TOTAL PIUTANG', '', '', '', '', formatCurrency(totalReceivable)])
      }
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['No. PO', 'Customer', 'Tgl Acara', 'Total Tagihan', 'Sudah Dibayar', 'Sisa Piutang']],
        body: rows.length ? rows : [['-', 'Tidak ada piutang tersisa', '-', '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 28, fontStyle: 'bold' },
          1: { cellWidth: 42 },
          2: { cellWidth: 26 },
          3: { cellWidth: 29, halign: 'right' },
          4: { cellWidth: 29, halign: 'right' },
          5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        },
      })
    } else if (entry.key === 'expenses') {
      const filtered = data.expenses.filter((e) => inDateRange(e.date, fromDate, toDate))
      const totalExp = filtered.reduce((sum, e) => sum + e.amount, 0)
      const rows = filtered.map((e) => [
        formatDate(e.date),
        e.description,
        e.category,
        e.bookingId ? (findBooking(e.bookingId)?.poNumber ?? '-') : 'Operasional umum',
        e.method,
        formatCurrency(e.amount),
      ])
      if (rows.length) {
        rows.push(['TOTAL', '', '', '', '', formatCurrency(totalExp)])
      }
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['Tanggal', 'Deskripsi', 'Kategori', 'No. PO', 'Metode', 'Nominal']],
        body: rows.length ? rows : [['-', 'Tidak ada pengeluaran pada periode ini', '-', '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 52 },
          2: { cellWidth: 26 },
          3: { cellWidth: 29 },
          4: { cellWidth: 20 },
          5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
        },
      })
    } else if (entry.key === 'cashflow') {
      const paidPeriod = data.payments.filter((p) => inDateRange(p.paidAt, fromDate, toDate)).reduce((s, p) => s + p.amount, 0)
      const expPeriod = data.expenses.filter((e) => inDateRange(e.date, fromDate, toDate)).reduce((s, e) => s + e.amount, 0)
      const refundPeriod = (data.refunds ?? []).filter((r) => inDateRange(r.refundDate, fromDate, toDate)).reduce((s, r) => s + r.amount, 0)
      const net = paidPeriod - expPeriod - refundPeriod
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['Komponen Keuangan', 'Nominal']],
        body: [
          ['Total Pemasukan (Pembayaran Diterima)', formatCurrency(paidPeriod)],
          ['Total Pengeluaran Operasional & PO', formatCurrency(expPeriod)],
          ['Total Pengembalian Uang (Refund PO Batal)', formatCurrency(refundPeriod)],
          ['Selisih Kas Bersih (Pemasukan − Pengeluaran − Refund)', formatCurrency(net)],
        ],
        columnStyles: {
          0: { cellWidth: contentWidth - 55, fontStyle: 'bold' },
          1: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
        },
      })
    } else if (entry.key === 'stock-in' || entry.key === 'stock-out') {
      const targetType = entry.key === 'stock-in' ? 'Masuk' : 'Keluar'
      const filtered = data.movements.filter((m) => m.type === targetType && inDateRange(m.date, fromDate, toDate))
      const rows = filtered.map((m) => {
        const item = findInvItem(m.itemId)
        return [
          formatDate(m.date),
          item?.name ?? '-',
          `${m.quantity} ${item?.unit ?? ''}`.trim(),
          m.pic,
          m.notes || '-',
        ]
      })
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['Tanggal', 'Nama Barang', 'Qty', 'PIC', 'Keterangan']],
        body: rows.length ? rows : [['-', `Tidak ada barang ${targetType.toLowerCase()} pada periode ini`, '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 54, fontStyle: 'bold' },
          2: { cellWidth: 26, halign: 'center' },
          3: { cellWidth: 32 },
          4: { cellWidth: 44 },
        },
      })
    } else if (entry.key === 'stock-opname') {
      const filtered = data.stockOpnames.filter((so) => inDateRange(so.date, fromDate, toDate))
      const rows: string[][] = []
      for (const so of filtered) {
        for (const item of so.items) {
          const diffStr = item.diff > 0 ? `+${item.diff}` : String(item.diff)
          rows.push([
            so.opnameNumber,
            formatDate(so.date),
            so.pic,
            item.itemName,
            String(item.systemStock),
            String(item.physicalStock),
            `${diffStr} ${item.unit}`,
          ])
        }
      }
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['No. Opname', 'Tanggal', 'PIC', 'Barang', 'Sistem', 'Fisik', 'Selisih']],
        body: rows.length ? rows : [['-', '-', '-', 'Belum ada riwayat stok opname pada periode ini', '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 26, fontStyle: 'bold' },
          1: { cellWidth: 24 },
          2: { cellWidth: 24 },
          3: { cellWidth: 46 },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 18, halign: 'center' },
          6: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
        },
      })
    } else if (entry.key === 'inventory') {
      const safeCount = data.inventory.filter((i) => data.stockStatus(i) === 'Aman').length
      const lowCount = data.inventory.filter((i) => data.stockStatus(i) === 'Menipis').length
      const emptyCount = data.inventory.filter((i) => data.stockStatus(i) === 'Habis').length
      const nowTime = new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date())

      y = ensureSpace(y, 40)
      // Spacious, padded info banner + clean pill indicators
      doc.setFillColor(250, 246, 239)
      doc.setDrawColor(218, 205, 185)
      doc.roundedRect(marginX, y, contentWidth, 16.5, 2.2, 2.2, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.8)
      doc.setTextColor(33, 29, 26)
      doc.text(`Stok inventaris sampai dengan saat ini (${nowTime} WIB)`, marginX + 5, y + 6.2)

      // Colored mini pills for Aman / Menipis / Habis / Total
      const pills: Array<{ label: string; bg: [number, number, number]; fg: [number, number, number] }> = [
        { label: `Aman: ${safeCount}`, bg: [225, 243, 232], fg: [34, 102, 68] },
        { label: `Menipis: ${lowCount}`, bg: [253, 240, 212], fg: [156, 98, 22] },
        { label: `Habis: ${emptyCount}`, bg: [252, 228, 224], fg: [176, 56, 46] },
        { label: `Total: ${data.inventory.length} barang`, bg: [236, 229, 217], fg: [60, 50, 40] },
      ]
      let pillX = marginX + 5
      const pillY = y + 9.2
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      for (const pill of pills) {
        const w = doc.getTextWidth(pill.label) + 7
        doc.setFillColor(...pill.bg)
        doc.roundedRect(pillX, pillY, w, 5.2, 1.5, 1.5, 'F')
        doc.setTextColor(...pill.fg)
        doc.text(pill.label, pillX + 3.5, pillY + 3.7)
        pillX += w + 3.5
      }

      y += 20

      const rows = data.inventory.map((item) => [
        item.code,
        item.name,
        item.category,
        item.location,
        `${data.stockAvailable(item)} ${item.unit}`,
        `${item.minimumStock} ${item.unit}`,
        data.stockStatus(item),
      ])
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['Kode', 'Nama Barang', 'Kategori', 'Lokasi', 'Stok Saat Ini', 'Minimum', 'Status']],
        body: rows.length ? rows : [['-', 'Belum ada barang inventaris', '-', '-', '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold' },
          1: { cellWidth: 42 },
          2: { cellWidth: 26 },
          3: { cellWidth: 24 },
          4: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        },
        didParseCell: (hookData) => {
          if (hookData.section !== 'body' || hookData.column.index !== 6) return
          const val = String(hookData.cell.raw ?? '')
          if (val === 'Aman') {
            hookData.cell.styles.fillColor = [225, 243, 232]
            hookData.cell.styles.textColor = [34, 102, 68]
          } else if (val === 'Menipis') {
            hookData.cell.styles.fillColor = [253, 240, 212]
            hookData.cell.styles.textColor = [156, 98, 22]
          } else if (val === 'Habis') {
            hookData.cell.styles.fillColor = [252, 228, 224]
            hookData.cell.styles.textColor = [176, 56, 46]
          }
        },
      })
    }

    y = getLastFinalY(doc, y) + 8
  }

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    doc.setTextColor(122, 112, 102)
    doc.text(`Hak Cipta © ${new Date().getFullYear()} Daysheet.id`, marginX, pageHeight - 8)
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' })
  }

  return doc
}

export const downloadSelectedReportsPdf = (params: {
  selectedKeys: ReportKey[]
  fromDate?: string
  toDate?: string
  data: ReportDataSnapshot
}) => {
  const doc = buildSelectedReportsPdfDoc(params)
  const suffix = params.selectedKeys.length === 1 ? params.selectedKeys[0] : 'Gabungan'
  doc.save(`Laporan-Azura-MUA-${suffix}.pdf`)
}
