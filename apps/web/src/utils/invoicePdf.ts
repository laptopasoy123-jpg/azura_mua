import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Booking, BusinessProfile, Customer, Invoice, OrderGroup, Payment } from '../stores/crm'
import { formatCurrency, formatDate } from './format'

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

  const brandName = (businessProfile?.name || 'AZURA').toUpperCase()
  const brandTagline = (businessProfile?.tagline || 'MAKEUP ARTIST').toUpperCase()
  const brandEmail = businessProfile?.email || 'hello@azuramakeup.id'
  const brandPhone = businessProfile?.phone || '0812 9000 2026'
  const brandAddress = businessProfile?.address || 'Jakarta Selatan'
  const invoiceNote = businessProfile?.invoiceNote || 'Terima kasih telah mempercayakan momen spesial Anda kepada kami.'

  // Clean Charcoal Espresso top banner
  doc.setFillColor(33, 29, 26)
  doc.roundedRect(marginX, 14, contentWidth, 27, 3, 3, 'F')

  // Subtle gold accent strip inside top of banner
  doc.setFillColor(196, 167, 125)
  doc.rect(marginX + 6, 14, contentWidth - 12, 0.9, 'F')

  let textStartX = marginX + 23
  if (businessProfile?.logoUrl && businessProfile.logoUrl.startsWith('data:image/')) {
    try {
      const fmt = businessProfile.logoUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.setFillColor(250, 248, 244)
      doc.roundedRect(marginX + 6, 19.5, 15, 15, 2.2, 2.2, 'F')
      doc.addImage(businessProfile.logoUrl, fmt, marginX + 6.8, 20.3, 13.4, 13.4)
      textStartX = marginX + 25
    } catch {
      doc.setFillColor(246, 239, 227)
      doc.roundedRect(marginX + 6, 19.5, 14, 14, 2.2, 2.2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(33, 29, 26)
      doc.text(brandName.slice(0, 1), marginX + 13, 28.5, { align: 'center' })
    }
  } else {
    doc.setFillColor(246, 239, 227)
    doc.roundedRect(marginX + 6, 19.5, 14, 14, 2.2, 2.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(33, 29, 26)
    doc.text(brandName.slice(0, 1), marginX + 13, 28.5, { align: 'center' })
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  doc.setTextColor(250, 248, 244)
  doc.text(`${brandName} ${brandTagline}`, textStartX, 25.2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.2)
  doc.setTextColor(214, 200, 180)
  doc.text(`${brandAddress}  ·  ${brandEmail}  ·  ${brandPhone}`, textStartX, 31.8)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(246, 239, 227)
  doc.text('FAKTUR TAGIHAN', pageWidth - marginX - 6, 24.5, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.2)
  doc.setTextColor(225, 205, 173)
  doc.text(`${invoice.invoiceNumber}  ·  ${formatDate(invoice.issuedAt)}`, pageWidth - marginX - 6, 31.5, { align: 'right' })

  // Two clean info cards side by side
  const cardTop = 46
  const colGap = 5
  const infoW = (contentWidth - colGap) / 2
  const cardH = 29

  doc.setFillColor(250, 248, 244)
  doc.setDrawColor(226, 218, 206)
  doc.roundedRect(marginX, cardTop, infoW, cardH, 2.2, 2.2, 'FD')
  doc.roundedRect(marginX + infoW + colGap, cardTop, infoW, cardH, 2.2, 2.2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.6)
  doc.setTextColor(132, 118, 102)
  doc.text('DITAGIHKAN KEPADA', marginX + 5, cardTop + 6.5)
  doc.text('RINCIAN PEMESANAN', marginX + infoW + colGap + 5, cardTop + 6.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(33, 29, 26)
  doc.text(customer?.name || '-', marginX + 5, cardTop + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.6)
  doc.setTextColor(78, 70, 62)
  doc.text(`Telepon / WA: ${customer?.phone || '-'}`, marginX + 5, cardTop + 19)
  doc.text(`Tgl Dibuat: ${formatDate(invoice.issuedAt)}`, marginX + 5, cardTop + 24.2)

  const rightX = marginX + infoW + colGap + 5
  const firstOrderDate = sortedGroups[0]?.orderDate ?? invoice.issuedAt
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(33, 29, 26)
  doc.text(booking?.poNumber || '-', rightX, cardTop + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.6)
  doc.setTextColor(78, 70, 62)
  const acaraStr = `Acara: ${booking?.eventDate ? formatDate(booking.eventDate) : '-'}${booking?.location ? ` · ${booking.location}` : ''}`
  doc.text(doc.splitTextToSize(acaraStr, infoW - 10)[0] ?? acaraStr, rightX, cardTop + 19)
  doc.text(`Pesanan Awal: ${formatDate(firstOrderDate)}`, rightX, cardTop + 24.2)

  // Services table (grouped chronologically, Inti first per group)
  const tableRows: Array<[string, string, string, string, string]> = []
  sortedGroups.forEach((group, gIdx) => {
    const items = sortItemsIntiFirst ? sortItemsIntiFirst(group.items) : group.items
    const groupTitle = group.kind === 'Awal'
      ? `Pesanan Awal (${formatDate(group.orderDate)})`
      : `Tambahan ${gIdx} (${formatDate(group.orderDate)})`
    for (const item of items) {
      const kindLabel = item.serviceType === 'Inti' ? 'Layanan Inti' : 'Tambahan'
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
    head: [['Nama Layanan', 'Kelompok Pesanan', 'Jumlah', 'Harga Satuan', 'Subtotal']],
    body: tableRows.length ? tableRows : [['Belum ada layanan', '-', '-', '-', 'Rp. 0']],
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [38, 33, 29],
      lineColor: [226, 219, 208],
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [38, 32, 28],
      textColor: [246, 239, 227],
      fontStyle: 'bold',
      fontSize: 8.3,
    },
    alternateRowStyles: {
      fillColor: [251, 249, 245],
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

  // Bottom 2-column summary: Left = Payment history & status | Right = Espresso Totals Card
  const leftW = contentWidth * 0.54
  const rightBoxW = contentWidth * 0.42
  const rightBoxX = marginX + contentWidth - rightBoxW

  const historyHeight = Math.max(40, 18 + Math.min(4, payments.length) * 6.5)
  doc.setFillColor(250, 248, 244)
  doc.setDrawColor(226, 218, 206)
  doc.roundedRect(marginX, cursorY, leftW, historyHeight, 2.2, 2.2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.setTextColor(122, 108, 94)
  doc.text('RIWAYAT PEMBAYARAN & STATUS', marginX + 5, cursorY + 6.5)

  const statusText = balance <= 0 ? 'LUNAS' : totalPaid > 0 ? 'DIBAYAR SEBAGIAN' : 'BELUM DIBAYAR'
  const statusBg: [number, number, number] = balance <= 0 ? [225, 243, 232] : totalPaid > 0 ? [253, 240, 212] : [252, 228, 224]
  const statusFg: [number, number, number] = balance <= 0 ? [34, 102, 68] : totalPaid > 0 ? [156, 98, 22] : [176, 56, 46]
  doc.setFillColor(...statusBg)
  doc.roundedRect(marginX + 5, cursorY + 9.5, 42, 6.2, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.6)
  doc.setTextColor(...statusFg)
  doc.text(statusText, marginX + 26, cursorY + 13.7, { align: 'center' })

  let histY = cursorY + 21
  if (payments.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(58, 50, 42)
    for (const pay of payments.slice(0, 4)) {
      const line = `${pay.receiptNumber} · ${formatDate(pay.paidAt)} (${pay.method}) — ${formatCurrency(pay.amount)}`
      doc.text(doc.splitTextToSize(line, leftW - 10)[0] ?? line, marginX + 5, histY)
      histY += 5.5
    }
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.2)
    doc.setTextColor(135, 124, 112)
    doc.text('Belum ada transaksi pembayaran masuk.', marginX + 5, histY)
  }

  // Right Espresso Totals card
  doc.setFillColor(33, 29, 26)
  doc.roundedRect(rightBoxX, cursorY, rightBoxW, 40, 2.5, 2.5, 'F')

  const drawTotalRow = (yOff: number, label: string, val: string, isHighlight = false) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    doc.setTextColor(isHighlight ? 246 : 204, isHighlight ? 225 : 191, isHighlight ? 186 : 174)
    doc.text(label, rightBoxX + 6, cursorY + yOff)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isHighlight ? 11.5 : 10)
    doc.setTextColor(250, 248, 244)
    doc.text(val, rightBoxX + rightBoxW - 6, cursorY + yOff, { align: 'right' })
  }

  drawTotalRow(10, 'Total Tagihan', formatCurrency(totalBilling))
  doc.setDrawColor(78, 67, 57)
  doc.setLineWidth(0.25)
  doc.line(rightBoxX + 6, cursorY + 14.5, rightBoxX + rightBoxW - 6, cursorY + 14.5)

  drawTotalRow(21.5, 'Total Dibayar', formatCurrency(totalPaid))
  doc.line(rightBoxX + 6, cursorY + 26, rightBoxX + rightBoxW - 6, cursorY + 26)

  drawTotalRow(33.5, 'Sisa Pembayaran', formatCurrency(Math.max(0, balance)), true)

  // Footer with Hak Cipta Daysheet
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p)
    const fy = pageHeight - 19
    doc.setDrawColor(220, 211, 198)
    doc.setLineWidth(0.35)
    doc.line(marginX, fy, pageWidth - marginX, fy)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(88, 78, 68)
    doc.text(invoiceNote, marginX, fy + 5)

    doc.setFontSize(7.6)
    doc.setTextColor(122, 112, 102)
    doc.text(`${brandEmail} · ${brandPhone} · ${brandAddress}`, marginX, fy + 10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Hak Cipta © ${new Date().getFullYear()} Daysheet.id`, pageWidth - marginX, fy + 10, { align: 'right' })
  }

  return doc
}

export const downloadInvoicePdf = (input: InvoicePdfInput) => {
  const doc = buildInvoicePdfDoc(input)
  doc.save(`${input.invoice.invoiceNumber}.pdf`)
}
