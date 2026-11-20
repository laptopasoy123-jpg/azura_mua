import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Booking, BusinessProfile, Customer, Invoice, InvoiceItem, OrderGroup, Payment } from '../stores/crm'
import { formatAmountWords, formatCurrency, formatDate } from './format'
import { drawEditorialBanner, drawEditorialFooter, PDF_PALETTE } from './pdfTheme'

export interface ReceiptShareItem {
  name: string
  serviceType?: string
  groupLabel: string
  quantity: number
  unit?: string
  unitPrice: number
}

export interface ReceiptInstallmentEntry {
  receiptNumber: string
  paidAt: string
  method: string
  amount: number
  isCurrent?: boolean
}

export interface ReceiptSharePayload {
  receiptNumber: string
  poNumber: string
  invoiceNumber?: string
  customerName: string
  customerPhone: string
  eventLocation: string
  eventDate: string
  firstOrderDate?: string
  paidAt: string
  method: string
  amount: number
  notes?: string
  totalBilling: number
  totalPaid: number
  balance: number
  items: ReceiptShareItem[]
  installmentHistory?: ReceiptInstallmentEntry[]
  businessName?: string
  businessTagline?: string
  businessPhone?: string
  businessEmail?: string
  businessAddress?: string
  invoiceNote?: string
  logoUrl?: string
}

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const fromBase64Url = (token: string): string => {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

export const encodeReceiptShareToken = (payload: ReceiptSharePayload): string =>
  toBase64Url(JSON.stringify(payload))

export const decodeReceiptShareToken = (token: string): ReceiptSharePayload | null => {
  try {
    const parsed = JSON.parse(fromBase64Url(token)) as ReceiptSharePayload
    if (!parsed || !parsed.receiptNumber) return null
    return parsed
  } catch {
    return null
  }
}

export const toReceiptSharePayload = (params: {
  payment: Payment
  booking?: Booking
  customer?: Customer
  invoice?: Invoice
  sortedGroups?: OrderGroup[]
  allPayments?: Payment[]
  sortItemsIntiFirst?: (items: InvoiceItem[]) => InvoiceItem[]
  totalBilling: number
  totalPaid: number
  balance: number
  businessProfile?: BusinessProfile
}): ReceiptSharePayload => {
  const {
    payment,
    booking,
    customer,
    invoice,
    sortedGroups,
    allPayments,
    sortItemsIntiFirst,
    totalBilling,
    totalPaid,
    balance,
    businessProfile,
  } = params

  const groups = sortedGroups ?? invoice?.groups ?? []
  const items: ReceiptShareItem[] = []
  groups.forEach((group, gIdx) => {
    const ordered = sortItemsIntiFirst ? sortItemsIntiFirst(group.items) : group.items
    const groupTitle = group.kind === 'Awal' ? 'Initial Order' : `Add-on #${gIdx}`
    for (const item of ordered) {
      items.push({
        name: item.name,
        serviceType: item.serviceType,
        groupLabel: `${groupTitle} · ${formatDate(group.orderDate)}`,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
      })
    }
  })

  const installmentHistory: ReceiptInstallmentEntry[] = (allPayments ?? [payment])
    .slice()
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    .map((p) => ({
      receiptNumber: p.receiptNumber,
      paidAt: p.paidAt,
      method: p.method,
      amount: p.amount,
      isCurrent: p.id === payment.id || p.receiptNumber === payment.receiptNumber,
    }))

  return {
    receiptNumber: payment.receiptNumber,
    poNumber: booking?.poNumber ?? '-',
    invoiceNumber: invoice?.invoiceNumber,
    customerName: customer?.name ?? '-',
    customerPhone: customer?.phone ?? '-',
    eventLocation: booking?.location ?? '-',
    eventDate: booking?.eventDate ?? '',
    firstOrderDate: groups[0]?.orderDate ?? invoice?.issuedAt ?? '',
    paidAt: payment.paidAt,
    method: payment.method,
    amount: payment.amount,
    notes: payment.notes,
    totalBilling,
    totalPaid,
    balance,
    items,
    installmentHistory,
    businessName: businessProfile?.name,
    businessTagline: businessProfile?.tagline,
    businessPhone: businessProfile?.phone,
    businessEmail: businessProfile?.email,
    businessAddress: businessProfile?.address,
    invoiceNote: businessProfile?.invoiceNote,
    logoUrl: businessProfile?.logoUrl,
  }
}

export const buildPaymentReceiptPdfFromPayload = (payload: ReceiptSharePayload) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 16
  const contentWidth = pageWidth - marginX * 2

  const brandName = (payload.businessName || 'AZURA').toUpperCase()
  const brandEmail = payload.businessEmail || 'hello@azuramakeup.id'
  const brandPhone = payload.businessPhone || '0812 9000 2026'
  const brandAddress = payload.businessAddress || 'South Jakarta, Indonesia'
  const footerNote = payload.invoiceNote || `Thank you for trusting ${brandName} Studio with your special celebration.`

  let cursorY = drawEditorialBanner(doc, {
    marginX,
    docTitle: 'PAYMENT RECEIPT',
    docSubtitle: payload.poNumber ? `OFFICIAL INSTALLMENT RECEIPT · ${payload.poNumber}` : 'OFFICIAL PAYMENT RECEIPT',
    rightMetaTop: payload.receiptNumber,
    rightMetaBottom: `Paid on ${formatDate(payload.paidAt)}`,
    businessProfile: {
      name: payload.businessName,
      tagline: payload.businessTagline,
      email: payload.businessEmail,
      phone: payload.businessPhone,
      address: payload.businessAddress,
      logoUrl: payload.logoUrl,
    },
  })

  // Prominent HERO PAYMENT BOX: Emphasize exact Date Paid & This Receipt's Payment Amount
  const heroH = 24
  doc.setFillColor(...PDF_PALETTE.linen)
  doc.setDrawColor(...PDF_PALETTE.gold)
  doc.setLineWidth(0.32)
  doc.roundedRect(marginX, cursorY, contentWidth, heroH, 3.2, 3.2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.4)
  doc.setTextColor(...PDF_PALETTE.goldDark)
  doc.text('THIS TRANSACTION PAYMENT RECEIVED', marginX + 5.5, cursorY + 6.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17.5)
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text(formatCurrency(payload.amount), marginX + 5.5, cursorY + 14.5)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.2)
  doc.setTextColor(...PDF_PALETTE.muted)
  const wordsLine = doc.splitTextToSize(`${formatAmountWords(payload.amount)} · Method: ${payload.method}`, contentWidth * 0.6)[0] ?? ''
  doc.text(wordsLine, marginX + 5.5, cursorY + 20.5)

  // Right divider inside hero for exact Payment Date
  const dateBoxX = marginX + contentWidth - 56
  doc.setDrawColor(...PDF_PALETTE.gold)
  doc.setLineWidth(0.3)
  doc.line(dateBoxX, cursorY + 4, dateBoxX, cursorY + heroH - 4)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.4)
  doc.setTextColor(...PDF_PALETTE.goldDark)
  doc.text('PAYMENT DATE', dateBoxX + 5, cursorY + 6.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text(formatDate(payload.paidAt, { day: '2-digit', month: 'long', year: 'numeric' }), dateBoxX + 5, cursorY + 13.5)

  const statusPillLabel = payload.balance <= 0 ? 'PAID IN FULL' : 'PARTIAL INSTALLMENT'
  const statusPillBg = payload.balance <= 0 ? PDF_PALETTE.successBg : PDF_PALETTE.warningBg
  const statusPillFg = payload.balance <= 0 ? PDF_PALETTE.successFg : PDF_PALETTE.warningFg
  doc.setFillColor(...statusPillBg)
  doc.roundedRect(dateBoxX + 5, cursorY + 16, 36, 5.4, 2.5, 2.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...statusPillFg)
  doc.text(statusPillLabel, dateBoxX + 23, cursorY + 19.7, { align: 'center' })

  cursorY += heroH + 5

  // Two clean info cards side by side
  const colGap = 5
  const infoW = (contentWidth - colGap) / 2
  const cardH = 29

  doc.setFillColor(...PDF_PALETTE.ivory)
  doc.setDrawColor(...PDF_PALETTE.gold)
  doc.setLineWidth(0.28)
  doc.roundedRect(marginX, cursorY, infoW, cardH, 3.2, 3.2, 'FD')
  doc.roundedRect(marginX + infoW + colGap, cursorY, infoW, cardH, 3.2, 3.2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...PDF_PALETTE.goldDark)
  doc.text('RECEIVED FROM', marginX + 5, cursorY + 6.2)
  doc.text('BOOKING REFERENCE', marginX + infoW + colGap + 5, cursorY + 6.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.8)
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text(payload.customerName || '-', marginX + 5, cursorY + 12.6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.4)
  doc.setTextColor(78, 70, 62)
  doc.text(`Phone / WhatsApp: ${payload.customerPhone || '-'}`, marginX + 5, cursorY + 18.4)
  doc.text(`Invoice Ref: ${payload.invoiceNumber || '-'}`, marginX + 5, cursorY + 23.8)

  const rightX = marginX + infoW + colGap + 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text(payload.poNumber || '-', rightX, cursorY + 12.6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.4)
  doc.setTextColor(78, 70, 62)
  const eventStr = `Event: ${payload.eventDate ? formatDate(payload.eventDate) : '-'}${payload.eventLocation ? ` · ${payload.eventLocation}` : ''}`
  doc.text(doc.splitTextToSize(eventStr, infoW - 10)[0] ?? eventStr, rightX, cursorY + 18.4)
  doc.text(`Notes: ${payload.notes?.trim() || '-'}`, rightX, cursorY + 23.8)

  cursorY += cardH + 6

  // Payment Installment History Table (Shows EVERY payment date & amount on this PO!)
  const historyList = payload.installmentHistory?.length
    ? payload.installmentHistory
    : [{
        receiptNumber: payload.receiptNumber,
        paidAt: payload.paidAt,
        method: payload.method,
        amount: payload.amount,
        isCurrent: true,
      }]

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.2)
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text(`Payment Installment History (${payload.poNumber})`, marginX, cursorY)
  cursorY += 2.5

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX, bottom: 24 },
    tableWidth: contentWidth,
    head: [['RECEIPT NO.', 'PAYMENT DATE', 'METHOD', 'REFERENCE', 'AMOUNT PAID']],
    body: historyList.map((entry) => [
      entry.receiptNumber,
      formatDate(entry.paidAt),
      entry.method === 'Cash' || entry.method === 'Tunai' ? 'Cash' : entry.method,
      entry.isCurrent ? 'Current Receipt' : 'Previous Installment',
      formatCurrency(entry.amount),
    ]),
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8.2,
      cellPadding: { top: 3, bottom: 3, left: 2.8, right: 2.8 },
      textColor: [38, 33, 29],
      lineColor: [212, 202, 188],
      lineWidth: 0.3,
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
      0: { cellWidth: 34, fontStyle: 'bold' },
      1: { cellWidth: 30 },
      2: { cellWidth: 28 },
      3: { cellWidth: contentWidth - 126 },
      4: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return
      const entry = historyList[hookData.row.index]
      if (entry?.isCurrent) {
        hookData.cell.styles.fillColor = [251, 246, 234]
        hookData.cell.styles.fontStyle = 'bold'
      }
    },
  })

  cursorY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY + 18) + 6

  // Service Breakdown Table
  if (payload.items.length > 0) {
    if (cursorY + 34 > pageHeight - 24) {
      doc.addPage()
      cursorY = 18
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.2)
    doc.setTextColor(...PDF_PALETTE.ink)
    doc.text(`Order Breakdown (${payload.poNumber})`, marginX, cursorY)
    cursorY += 2.5

    const orderRows = payload.items.map((item) => {
      const qtyUnit = item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity)
      const kindLabel = item.serviceType === 'Inti' ? 'Core Service' : 'Add-on'
      return [
        `${item.name} (${kindLabel})`,
        item.groupLabel,
        qtyUnit,
        formatCurrency(item.unitPrice),
        formatCurrency(item.quantity * item.unitPrice),
      ]
    })

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX, bottom: 26 },
      tableWidth: contentWidth,
      head: [['SERVICE ITEM', 'ORDER GROUP', 'QTY', 'UNIT PRICE', 'SUBTOTAL']],
      body: orderRows,
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: {
        font: 'helvetica',
        fontSize: 8.1,
        cellPadding: { top: 3, bottom: 3, left: 2.8, right: 2.8 },
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

    cursorY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY + 25) + 7
  }

  if (cursorY + 38 > pageHeight - 22) {
    doc.addPage()
    cursorY = 18
  }

  // Bottom Cumulative Balance Summary
  doc.setFillColor(...PDF_PALETTE.espresso)
  doc.setDrawColor(...PDF_PALETTE.goldDark)
  doc.setLineWidth(0.45)
  doc.roundedRect(marginX, cursorY, contentWidth, 26, 2.5, 2.5, 'FD')
  doc.setFillColor(...PDF_PALETTE.gold)
  doc.rect(marginX + 5, cursorY, contentWidth - 10, 0.8, 'F')

  const colW = contentWidth / 3
  const cols = [
    { label: 'TOTAL PO BILLING', val: formatCurrency(payload.totalBilling) },
    { label: 'CUMULATIVE PAID TO DATE', val: formatCurrency(payload.totalPaid) },
    { label: 'REMAINING BALANCE DUE', val: formatCurrency(Math.max(0, payload.balance)), gold: true },
  ]
  cols.forEach((col, i) => {
    const cx = marginX + i * colW + 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)
    doc.setTextColor(col.gold ? 225 : 196, col.gold ? 196 : 184, col.gold ? 148 : 170)
    doc.text(col.label, cx, cursorY + 8.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(col.gold ? 246 : 250, col.gold ? 230 : 248, col.gold ? 194 : 244)
    doc.text(col.val, cx, cursorY + 17.5)
  })

  drawEditorialFooter(doc, {
    marginX,
    note: footerNote,
    contactLine: `${brandEmail} · ${brandPhone} · ${brandAddress}`,
    showPageNumbers: doc.getNumberOfPages() > 1,
    framed: true,
  })

  return doc
}

export const buildPaymentReceiptPdfDoc = (params: {
  payment: Payment
  booking?: Booking
  customer?: Customer
  invoice?: Invoice
  sortedGroups?: OrderGroup[]
  allPayments?: Payment[]
  sortItemsIntiFirst?: (items: InvoiceItem[]) => InvoiceItem[]
  totalBilling: number
  totalPaid: number
  balance: number
  businessProfile?: BusinessProfile
}) => buildPaymentReceiptPdfFromPayload(toReceiptSharePayload(params))

export const downloadPaymentReceiptPdf = (params: {
  payment: Payment
  booking?: Booking
  customer?: Customer
  invoice?: Invoice
  sortedGroups?: OrderGroup[]
  allPayments?: Payment[]
  sortItemsIntiFirst?: (items: InvoiceItem[]) => InvoiceItem[]
  totalBilling: number
  totalPaid: number
  balance: number
  businessProfile?: BusinessProfile
}) => {
  const doc = buildPaymentReceiptPdfDoc(params)
  doc.save(`Receipt-${params.payment.receiptNumber}.pdf`)
}

export const resolveReceiptShareUrl = async (params: {
  payment: Payment
  booking?: Booking
  customer?: Customer
  invoice?: Invoice
  sortedGroups?: OrderGroup[]
  allPayments?: Payment[]
  sortItemsIntiFirst?: (items: InvoiceItem[]) => InvoiceItem[]
  totalBilling: number
  totalPaid: number
  balance: number
  businessProfile?: BusinessProfile
}): Promise<{ url: string; mode: 'r2' | 'viewer' }> => {
  const payload = toReceiptSharePayload(params)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const doc = buildPaymentReceiptPdfFromPayload(payload)

  try {
    const blob = doc.output('blob')
    const file = new File([blob], `Receipt-${payload.receiptNumber}.pdf`, { type: 'application/pdf' })
    const body = new FormData()
    body.append('file', file)
    body.append('purpose', 'payment-proof')
    body.append('visibility', 'public')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1800)
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/files`, {
      method: 'POST',
      body,
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (response.ok) {
      const json = await response.json() as { ok: boolean; data?: { url: string } }
      if (json.ok && json.data?.url) {
        const absolute = json.data.url.startsWith('http') ? json.data.url : `${origin}${json.data.url}`
        return { url: absolute, mode: 'r2' }
      }
    }
  } catch {
    // Fall back to self-contained digital receipt & PDF download link
  }

  const shareablePayload: ReceiptSharePayload =
    payload.logoUrl && payload.logoUrl.startsWith('data:') && payload.logoUrl.length > 24000
      ? { ...payload, logoUrl: undefined }
      : payload
  const token = encodeReceiptShareToken(shareablePayload)
  return {
    url: `${origin}/kwitansi?d=${token}`,
    mode: 'viewer',
  }
}

export const formatWhatsAppPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}
