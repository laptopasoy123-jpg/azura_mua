import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type {
  Booking,
  BookingRefund,
  BusinessProfile,
  Customer,
  Expense,
  InventoryItem,
  Invoice,
  OrderGroup,
  Payment,
  StockMovement,
  StockOpnameRecord,
} from '../stores/crm'
import { REPORT_CATALOG, type ReportKey } from './reportCatalog'
import { displayBookingStatus, displayStockStatus, formatCurrency, formatDate } from './format'
import {
  drawEditorialBanner,
  drawEditorialFooter,
  drawEditorialKpiStrip,
  loadImageForPdf,
  PDF_PALETTE,
  type LoadedPdfImage,
} from './pdfTheme'

export type { ReportKey, ReportCatalogEntry } from './reportCatalog'
export { REPORT_CATALOG } from './reportCatalog'

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
  businessProfile?: BusinessProfile
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

export const buildSelectedReportsPdfDoc = async (params: {
  selectedKeys: ReportKey[]
  fromDate?: string
  toDate?: string
  data: ReportDataSnapshot
}) => {
  const { selectedKeys, fromDate = '', toDate = '', data } = params
  if (!selectedKeys.length) {
    throw new Error('Please select at least one report section first.')
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

  // Preload inventory photos when Current Inventory Stock is included
  const invImages = new Map<string, LoadedPdfImage | null>()
  if (selectedKeys.includes('inventory')) {
    await Promise.all(
      data.inventory.map(async (item) => {
        if (item.imageUrl) {
          invImages.set(item.id, await loadImageForPdf(item.imageUrl))
        }
      }),
    )
  }

  const ensureSpace = (y: number, needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage()
      return 16
    }
    return y
  }

  const drawSectionHeading = (currentY: number, title: string): number => {
    const y = ensureSpace(currentY, 18)
    doc.setFillColor(...PDF_PALETTE.goldDark)
    doc.rect(marginX, y, 3, 6.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...PDF_PALETTE.ink)
    doc.text(title, marginX + 6, y + 4.8)
    doc.setDrawColor(...PDF_PALETTE.border)
    doc.line(marginX, y + 7.8, marginX + contentWidth, y + 7.8)
    return y + 11
  }

  const periodLabel = fromDate || toDate
    ? `${fromDate ? formatDate(fromDate) : 'Start'} to ${toDate ? formatDate(toDate) : 'Latest'}`
    : 'All Records'

  const singleTitle = selectedKeys.length === 1
    ? (REPORT_CATALOG.find((r) => r.key === selectedKeys[0])?.title.toUpperCase() ?? 'STUDIO BUSINESS REPORT')
    : 'STUDIO BUSINESS REPORT'

  let y = drawEditorialBanner(doc, {
    marginX,
    docTitle: singleTitle,
    docSubtitle: `${selectedKeys.length} REPORT SECTION${selectedKeys.length > 1 ? 'S' : ''} · EXECUTIVE SUMMARY`,
    rightMetaTop: periodLabel,
    rightMetaBottom: `Generated ${formatDate(new Date().toISOString().slice(0, 10))}`,
    businessProfile: data.businessProfile,
  })

  // Top KPI Executive Summary Strip
  const totalRevenue = data.payments
    .filter((p) => inDateRange(p.paidAt, fromDate, toDate))
    .reduce((sum, p) => sum + p.amount, 0)
  const linkedRefundIds = new Set(data.expenses.map((e) => e.refundId).filter(Boolean))
  const totalExpensesPeriod = data.expenses
    .filter((e) => inDateRange(e.date, fromDate, toDate))
    .reduce((sum, e) => sum + e.amount, 0)
  const unlinkedRefunds = (data.refunds ?? [])
    .filter((r) => !linkedRefundIds.has(r.id) && inDateRange(r.refundDate, fromDate, toDate))
    .reduce((sum, r) => sum + r.amount, 0)
  const netCashPeriod = totalRevenue - totalExpensesPeriod - unlinkedRefunds
  const totalReceivables = data.bookings.reduce((sum, b) => sum + Math.max(0, data.bookingBalance(b.id)), 0)

  if (!selectedKeys.every((k) => k === 'inventory' || k === 'stock-in' || k === 'stock-out' || k === 'stock-opname')) {
    y = drawEditorialKpiStrip(doc, y, marginX, contentWidth, [
      { label: 'Total Cash Inflow', value: formatCurrency(totalRevenue), accent: 'success' },
      { label: 'Total Expenses & Refunds', value: formatCurrency(totalExpensesPeriod + unlinkedRefunds), accent: 'danger' },
      { label: 'Net Cash Position', value: formatCurrency(netCashPeriod), accent: 'info' },
      { label: 'Open Receivables', value: formatCurrency(totalReceivables), accent: 'warning' },
    ])
  }

  const tableBase = {
    margin: { left: marginX, right: marginX, bottom: 16 },
    tableWidth: contentWidth,
    theme: 'grid' as const,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: PDF_PALETTE.ink,
      lineColor: PDF_PALETTE.border,
      overflow: 'linebreak' as const,
      valign: 'middle' as const,
    },
    headStyles: {
      fillColor: PDF_PALETTE.espressoSoft,
      textColor: PDF_PALETTE.cream,
      fontStyle: 'bold' as const,
    },
    alternateRowStyles: {
      fillColor: [251, 249, 245] as [number, number, number],
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
        head: [['No.', 'Customer Name', 'Phone / WhatsApp', 'Total Bookings']],
        body: rows.length ? rows : [['-', 'No customer records found', '-', '-']],
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 74, fontStyle: 'bold' },
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
        displayBookingStatus(b.status),
      ])
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['PO No.', 'Customer', 'Event Date', 'Venue', 'Styling', 'Status']],
        body: rows.length ? rows : [['-', 'No bookings in selected date range', '-', '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 28, fontStyle: 'bold' },
          1: { cellWidth: 38 },
          2: { cellWidth: 32 },
          3: { cellWidth: 42 },
          4: { cellWidth: 20 },
          5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
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
            group.kind === 'Awal' ? 'Initial Order' : 'Add-on',
            formatDate(group.orderDate),
            itemSummary || '-',
            formatCurrency(data.groupTotal(group)),
          ])
        }
      }
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['PO No.', 'Customer', 'Type', 'Order Date', 'Services Breakdown', 'Group Total']],
        body: rows.length ? rows : [['-', 'No orders found in selected period', '-', '-', '-', '-']],
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
        head: [['Invoice No.', 'PO No.', 'Customer', 'Issued Date', 'Total Billed', 'Paid', 'Balance']],
        body: rows.length ? rows : [['-', '-', 'No invoices found in selected period', '-', '-', '-', '-']],
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
        rows.push(['TOTAL RECEIVED', '', '', '', '', formatCurrency(totalAmt)])
      }
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['Receipt No.', 'PO No.', 'Customer', 'Paid Date', 'Method', 'Amount']],
        body: rows.length ? rows : [['-', '-', 'No payment receipts in selected period', '-', '-', '-']],
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
        rows.push(['TOTAL RECEIVABLES', '', '', '', '', formatCurrency(totalReceivable)])
      }
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['PO No.', 'Customer', 'Event Date', 'Total Billing', 'Total Paid', 'Balance Due']],
        body: rows.length ? rows : [['-', 'No remaining receivables', '-', '-', '-', '-']],
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
        e.source === 'Bayar Cancel' ? `${e.category} (Cancel Payment)` : e.category,
        e.bookingId ? (findBooking(e.bookingId)?.poNumber ?? '-') : 'Studio Overhead',
        e.method,
        formatCurrency(e.amount),
      ])
      if (rows.length) {
        rows.push(['TOTAL EXPENSES', '', '', '', '', formatCurrency(totalExp)])
      }
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['Date', 'Description', 'Category & Source', 'PO Ref', 'Method', 'Amount']],
        body: rows.length ? rows : [['-', 'No expense records in selected period', '-', '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 50 },
          2: { cellWidth: 32 },
          3: { cellWidth: 26 },
          4: { cellWidth: 20 },
          5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
        },
      })
    } else if (entry.key === 'cashflow') {
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['Cashflow Component', 'Amount']],
        body: [
          ['Total Cash Inflow (Payments Received)', formatCurrency(totalRevenue)],
          ['Total PO & Studio Operating Expenses (incl. Cancel Payouts)', formatCurrency(totalExpensesPeriod)],
          ['Additional Unlinked Cancellation Refunds', formatCurrency(unlinkedRefunds)],
          ['Net Cash Position (Inflow − Total Outflow)', formatCurrency(netCashPeriod)],
        ],
        columnStyles: {
          0: { cellWidth: contentWidth - 55, fontStyle: 'bold' },
          1: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (hookData) => {
          if (hookData.section === 'body' && hookData.row.index === 3) {
            hookData.cell.styles.fillColor = PDF_PALETTE.linen
            hookData.cell.styles.fontStyle = 'bold'
          }
        },
      })
    } else if (entry.key === 'stock-in' || entry.key === 'stock-out') {
      const targetType = entry.key === 'stock-in' ? 'Masuk' : 'Keluar'
      const actionLabel = entry.key === 'stock-in' ? 'Stock In' : 'Stock Out'
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
        head: [['Date', 'Item Name', 'Qty', 'PIC', 'Notes']],
        body: rows.length ? rows : [['-', `No ${actionLabel.toLowerCase()} records in selected period`, '-', '-', '-']],
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
        head: [['Opname No.', 'Date', 'PIC', 'Item', 'System', 'Physical', 'Variance']],
        body: rows.length ? rows : [['-', '-', '-', 'No stock opname history in selected period', '-', '-', '-']],
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

      y = drawEditorialKpiStrip(doc, ensureSpace(y, 24), marginX, contentWidth, [
        { label: 'Total SKU Items', value: `${data.inventory.length} Items`, accent: 'espresso' },
        { label: 'In Stock', value: `${safeCount} Items`, accent: 'success' },
        { label: 'Low Stock Alert', value: `${lowCount} Items`, accent: 'warning' },
        { label: 'Out of Stock', value: `${emptyCount} Items`, accent: 'danger' },
      ])

      const rows = data.inventory.map((item) => [
        '',
        item.code,
        item.name,
        item.category,
        item.location,
        `${data.stockAvailable(item)} ${item.unit}`,
        `${item.minimumStock} ${item.unit}`,
        displayStockStatus(data.stockStatus(item)),
      ])
      autoTable(doc, {
        ...tableBase,
        startY: y,
        styles: {
          ...tableBase.styles,
          minCellHeight: data.inventory.length ? 12 : 9,
        },
        head: [['Photo', 'Code', 'Item Name', 'Category', 'Storage', 'Current Stock', 'Minimum', 'Status']],
        body: rows.length ? rows : [['', '-', 'No inventory items yet', '-', '-', '-', '-', '-']],
        columnStyles: {
          0: { cellWidth: 14, halign: 'center' },
          1: { cellWidth: 20, fontStyle: 'bold' },
          2: { cellWidth: 42, fontStyle: 'bold' },
          3: { cellWidth: 25 },
          4: { cellWidth: 21 },
          5: { cellWidth: 21, halign: 'center', fontStyle: 'bold' },
          6: { cellWidth: 19, halign: 'center' },
          7: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
        },
        didParseCell: (hookData) => {
          if (hookData.section !== 'body' || hookData.column.index !== 7) return
          const val = String(hookData.cell.raw ?? '')
          if (val === 'In Stock') {
            hookData.cell.styles.fillColor = PDF_PALETTE.successBg
            hookData.cell.styles.textColor = PDF_PALETTE.successFg
          } else if (val === 'Low Stock') {
            hookData.cell.styles.fillColor = PDF_PALETTE.warningBg
            hookData.cell.styles.textColor = PDF_PALETTE.warningFg
          } else if (val === 'Out of Stock') {
            hookData.cell.styles.fillColor = PDF_PALETTE.dangerBg
            hookData.cell.styles.textColor = PDF_PALETTE.dangerFg
          }
        },
        didDrawCell: (hookData) => {
          if (hookData.section !== 'body' || hookData.column.index !== 0) return
          const item = data.inventory[hookData.row.index]
          if (!item) return
          const img = invImages.get(item.id)
          if (!img) return
          const box = Math.min(hookData.cell.width - 2.6, hookData.cell.height - 2.2, 9.8)
          const x = hookData.cell.x + (hookData.cell.width - box) / 2
          const iy = hookData.cell.y + (hookData.cell.height - box) / 2
          try {
            doc.addImage(img.dataUrl, img.format, x, iy, box, box)
          } catch {
            // Skip invalid frame
          }
        },
      })
    }

    y = getLastFinalY(doc, y) + 8
  }

  drawEditorialFooter(doc, {
    marginX,
    showPageNumbers: true,
  })

  return doc
}

export const downloadSelectedReportsPdf = async (params: {
  selectedKeys: ReportKey[]
  fromDate?: string
  toDate?: string
  data: ReportDataSnapshot
}) => {
  const doc = await buildSelectedReportsPdfDoc(params)
  const suffix = params.selectedKeys.length === 1 ? params.selectedKeys[0] : 'Combined'
  doc.save(`Azura-MUA-Report-${suffix}.pdf`)
}
