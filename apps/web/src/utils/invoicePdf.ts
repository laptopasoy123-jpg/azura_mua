import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Booking, BusinessProfile, Customer, Invoice, OrderGroup, Payment } from '../stores/crm'
import { formatCurrency, formatDate } from './format'
import { drawEditorialBanner, drawEditorialFooter, PDF_PALETTE } from './pdfTheme'

export interface InvoicePdfInput {
  invoice: Invoice
  booking?: Booking
  customer?: Customer
  sortedGroups: OrderGroup[]
  payments: Payment[]
  totalBilling: number
  totalPaid: number
  balance: number
  businessProfile?: BusinessProfile
  sortItemsIntiFirst?: (items: Invoice['items']) => Invoice['items']
}

export const buildInvoicePdfDoc = (input: InvoicePdfInput) => {
  const {
    invoice,
    booking,
    customer,
    sortedGroups,
    payments,
    totalBilling,
    totalPaid,
    balance,
    businessProfile,
    sortItemsIntiFirst,
  } = input

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 16
  const contentWidth = pageWidth - marginX * 2

  const brandEmail = businessProfile?.email || 'hello@azuramakeup.id'
  const brandPhone = businessProfile?.phone || '0812 9000 2026'
  const brandAddress = businessProfile?.address || 'South Jakarta, Indonesia'
  const invoiceNote = businessProfile?.invoiceNote || 'Thank you for trusting us with your special celebration.'

  const cardTop = drawEditorialBanner(doc, {
    marginX,
    docTitle: 'OFFICIAL INVOICE',
    docSubtitle: booking?.poNumber ? `PURCHASE ORDER · ${booking.poNumber}` : 'CLIENT BILLING STATEMENT',
    rightMetaTop: invoice.invoiceNumber,
    rightMetaBottom: `Issued ${formatDate(invoice.issuedAt)}`,
    businessProfile,
  })

  // Two clean info cards side by side
  const colGap = 5
  const infoW = (contentWidth - colGap) / 2
  const cardH = 30

  doc.setFillColor(...PDF_PALETTE.ivory)
  doc.setDrawColor(...PDF_PALETTE.goldDark)
  doc.setLineWidth(0.4)
  doc.roundedRect(marginX, cardTop, infoW, cardH, 2.2, 2.2, 'FD')
  doc.roundedRect(marginX + infoW + colGap, cardTop, infoW, cardH, 2.2, 2.2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...PDF_PALETTE.goldDark)
  doc.text('BILLED TO', marginX + 5, cardTop + 6.5)
  doc.text('BOOKING & EVENT DETAILS', marginX + infoW + colGap + 5, cardTop + 6.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text(customer?.name || '-', marginX + 5, cardTop + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(78, 70, 62)
  doc.text(`Phone / WhatsApp: ${customer?.phone || '-'}`, marginX + 5, cardTop + 19)
  doc.text(`Invoice Date: ${formatDate(invoice.issuedAt)}`, marginX + 5, cardTop + 24.4)

  const rightX = marginX + infoW + colGap + 5
  const firstOrderDate = sortedGroups[0]?.orderDate ?? invoice.issuedAt
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text(booking?.poNumber || '-', rightX, cardTop + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(78, 70, 62)
  const eventStr = `Event: ${booking?.eventDate ? formatDate(booking.eventDate) : '-'}${booking?.location ? ` · ${booking.location}` : ''}`
  doc.text(doc.splitTextToSize(eventStr, infoW - 10)[0] ?? eventStr, rightX, cardTop + 19)
  doc.text(`Initial Order: ${formatDate(firstOrderDate)}`, rightX, cardTop + 24.4)

  // Services table (grouped chronologically, Core first per group)
  const tableRows: Array<[string, string, string, string, string]> = []
  sortedGroups.forEach((group, gIdx) => {
    const items = sortItemsIntiFirst ? sortItemsIntiFirst(group.items) : group.items
    const groupTitle = group.kind === 'Awal'
      ? `Initial Order (${formatDate(group.orderDate)})`
      : `Add-on #${gIdx} (${formatDate(group.orderDate)})`
    for (const item of items) {
      const kindLabel = item.serviceType === 'Inti' ? 'Core Service' : 'Add-on'
      const qtyUnit = item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity)
      tableRows.push([
        `${item.name} (${kindLabel})`,
        groupTitle,
        qtyUnit,
        formatCurrency(item.unitPrice),
        formatCurrency(item.quantity * item.unitPrice),
      ])
    }
  })

  autoTable(doc, {
    startY: cardTop + cardH + 6,
    margin: { left: marginX, right: marginX, bottom: 26 },
    tableWidth: contentWidth,
    head: [['SERVICE DESCRIPTION', 'ORDER GROUP', 'QTY', 'UNIT PRICE', 'SUBTOTAL']],
    body: tableRows.length ? tableRows : [['No service items recorded', '-', '-', '-', 'Rp. 0']],
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 3.4, bottom: 3.4, left: 3, right: 3 },
      textColor: [38, 33, 29],
      lineColor: [212, 202, 188],
      lineWidth: 0.3,
      overflow: 'linebreak',
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [252, 250, 246],
    },
    headStyles: {
      fillColor: PDF_PALETTE.espresso,
      textColor: PDF_PALETTE.cream,
      fontStyle: 'bold',
      fontSize: 7.8,
      lineColor: [90, 78, 66],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: contentWidth - 114, fontStyle: 'bold' },
      1: { cellWidth: 42 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
  })

  let cursorY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 140) + 8
  if (cursorY + 52 > pageHeight - 24) {
    doc.addPage()
    cursorY = 18
  }

  // Bottom 2-column summary: Left = Payment timeline & status | Right = Espresso Totals Card
  const leftW = contentWidth * 0.56
  const rightBoxW = contentWidth * 0.40
  const rightBoxX = marginX + contentWidth - rightBoxW

  const shownPayments = payments.slice(0, 4)
  const historyHeight = Math.max(41, 22 + shownPayments.length * 6.8)
  doc.setFillColor(...PDF_PALETTE.ivory)
  doc.setDrawColor(...PDF_PALETTE.goldDark)
  doc.setLineWidth(0.4)
  doc.roundedRect(marginX, cursorY, leftW, historyHeight, 2.2, 2.2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.4)
  doc.setTextColor(...PDF_PALETTE.goldDark)
  doc.text('PAYMENT STATUS & HISTORY', marginX + 5, cursorY + 6.5)

  const statusText = balance <= 0 ? 'PAID IN FULL' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID'
  const statusBg = balance <= 0 ? PDF_PALETTE.successBg : totalPaid > 0 ? PDF_PALETTE.warningBg : PDF_PALETTE.dangerBg
  const statusFg = balance <= 0 ? PDF_PALETTE.successFg : totalPaid > 0 ? PDF_PALETTE.warningFg : PDF_PALETTE.dangerFg
  doc.setFillColor(...statusBg)
  doc.roundedRect(marginX + 5, cursorY + 9.2, 30, 5.8, 2.9, 2.9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  doc.setTextColor(...statusFg)
  doc.text(statusText, marginX + 20, cursorY + 13.1, { align: 'center' })

  // Thin horizontal hairline below status pill (mirrors Official Invoice Preview Eye modal)
  doc.setDrawColor(232, 224, 212)
  doc.setLineWidth(0.25)
  doc.line(marginX + 5, cursorY + 17.5, marginX + leftW - 5, cursorY + 17.5)

  let histY = cursorY + 22.5
  if (shownPayments.length) {
    for (let idx = 0; idx < shownPayments.length; idx += 1) {
      const pay = shownPayments[idx]!
      const leftText = `${pay.receiptNumber} · ${formatDate(pay.paidAt)} (${pay.method === 'Cash' || pay.method === 'Tunai' ? 'Cash' : pay.method})`
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.9)
      doc.setTextColor(78, 70, 62)
      doc.text(doc.splitTextToSize(leftText, leftW - 36)[0] ?? leftText, marginX + 5, histY)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.2)
      doc.setTextColor(...PDF_PALETTE.ink)
      doc.text(formatCurrency(pay.amount), marginX + leftW - 5, histY, { align: 'right' })

      if (idx < shownPayments.length - 1) {
        doc.setDrawColor(235, 228, 216)
        doc.setLineWidth(0.22)
        doc.line(marginX + 5, histY + 2.2, marginX + leftW - 5, histY + 2.2)
      }
      histY += 6.6
    }
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.2)
    doc.setTextColor(135, 124, 112)
    doc.text('No payment transactions recorded yet.', marginX + 5, histY)
  }

  // Right Espresso Totals Card
  doc.setFillColor(...PDF_PALETTE.espresso)
  doc.setDrawColor(...PDF_PALETTE.goldDark)
  doc.setLineWidth(0.45)
  doc.roundedRect(rightBoxX, cursorY, rightBoxW, 41, 2.5, 2.5, 'FD')
  doc.setFillColor(...PDF_PALETTE.gold)
  doc.rect(rightBoxX + 4, cursorY, rightBoxW - 8, 0.8, 'F')

  const drawTotalRow = (yOff: number, label: string, val: string, isHighlight = false) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    doc.setTextColor(isHighlight ? 246 : 204, isHighlight ? 225 : 191, isHighlight ? 186 : 174)
    doc.text(label, rightBoxX + 6, cursorY + yOff)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isHighlight ? 11.5 : 10)
    doc.setTextColor(...PDF_PALETTE.ivory)
    doc.text(val, rightBoxX + rightBoxW - 6, cursorY + yOff, { align: 'right' })
  }

  drawTotalRow(10, 'Invoice Total', formatCurrency(totalBilling))
  doc.setDrawColor(78, 67, 57)
  doc.setLineWidth(0.25)
  doc.line(rightBoxX + 6, cursorY + 14.5, rightBoxX + rightBoxW - 6, cursorY + 14.5)

  drawTotalRow(21.5, 'Total Paid', formatCurrency(totalPaid))
  doc.line(rightBoxX + 6, cursorY + 26, rightBoxX + rightBoxW - 6, cursorY + 26)

  drawTotalRow(33.8, 'Balance Due', formatCurrency(Math.max(0, balance)), true)

  drawEditorialFooter(doc, {
    marginX,
    note: invoiceNote,
    contactLine: `${brandEmail} · ${brandPhone} · ${brandAddress}`,
    showPageNumbers: doc.getNumberOfPages() > 1,
    framed: true,
  })

  return doc
}

export const downloadInvoicePdf = (input: InvoicePdfInput) => {
  const doc = buildInvoicePdfDoc(input)
  doc.save(`${input.invoice.invoiceNumber}.pdf`)
}
