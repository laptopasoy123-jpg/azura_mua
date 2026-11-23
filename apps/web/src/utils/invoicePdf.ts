import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Booking, BusinessProfile, Customer, Invoice, InvoiceItem, OrderGroup, Payment } from '../stores/crm'
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

export interface InvoiceShareItem {
  name: string
  serviceType: 'Inti' | 'Additional'
  quantity: number
  unit?: string
  unitPrice: number
}

export interface InvoiceShareGroup {
  id: string
  kind: OrderGroup['kind']
  orderDate: string
  items: InvoiceShareItem[]
}

export interface InvoiceSharePayment {
  receiptNumber: string
  paidAt: string
  method: string
  amount: number
}

export interface InvoiceSharePayload {
  invoiceNumber: string
  issuedAt: string
  poNumber: string
  customerName: string
  customerPhone: string
  eventDate: string
  eventLocation: string
  groups: InvoiceShareGroup[]
  payments: InvoiceSharePayment[]
  totalBilling: number
  totalPaid: number
  balance: number
  businessName?: string
  businessTagline?: string
  businessPhone?: string
  businessEmail?: string
  businessAddress?: string
  invoiceNote?: string
  logoUrl?: string
}

const toBase64UrlBytes = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const fromBase64UrlBytes = (token: string): Uint8Array => {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const toBase64Url = (text: string): string => toBase64UrlBytes(new TextEncoder().encode(text))

const fromBase64Url = (token: string): string => new TextDecoder().decode(fromBase64UrlBytes(token))

const compactInvoicePayload = (p: InvoiceSharePayload) => [
  2,
  p.invoiceNumber,
  p.issuedAt,
  p.poNumber,
  p.customerName,
  p.customerPhone,
  p.eventDate,
  p.eventLocation,
  p.totalBilling,
  p.totalPaid,
  p.balance,
  p.groups.map((g) => [
    g.kind === 'Awal' ? 0 : 1,
    g.orderDate,
    g.items.map((i) => [i.name, i.serviceType === 'Inti' ? 1 : 0, i.quantity, i.unit || '', i.unitPrice]),
  ]),
  p.payments.map((pay) => [pay.receiptNumber, pay.paidAt, pay.method, pay.amount]),
  p.invoiceNote || '',
  p.businessName && p.businessName !== 'Azura' ? p.businessName : '',
  p.businessPhone && p.businessPhone !== '0812 9000 2026' ? p.businessPhone : '',
] as const

const expandCompactInvoicePayload = (raw: unknown): InvoiceSharePayload | null => {
  if (!Array.isArray(raw) || raw[0] !== 2) return null
  const [, invoiceNumber, issuedAt, poNumber, customerName, customerPhone, eventDate, eventLocation, totalBilling, totalPaid, balance, groupsRaw, paysRaw, invoiceNote, businessName, businessPhone] = raw as [
    number, string, string, string, string, string, string, string, number, number, number,
    Array<[number, string, Array<[string, number, number, string, number]>]>,
    Array<[string, string, string, number]>,
    string?, string?, string?,
  ]
  return {
    invoiceNumber: String(invoiceNumber || ''),
    issuedAt: String(issuedAt || ''),
    poNumber: String(poNumber || '-'),
    customerName: String(customerName || '-'),
    customerPhone: String(customerPhone || '-'),
    eventDate: String(eventDate || ''),
    eventLocation: String(eventLocation || ''),
    totalBilling: Number(totalBilling || 0),
    totalPaid: Number(totalPaid || 0),
    balance: Number(balance || 0),
    groups: (groupsRaw ?? []).map((g, gIdx) => ({
      id: `g-${gIdx}`,
      kind: g[0] === 0 ? 'Awal' : 'Tambahan',
      orderDate: String(g[1] || ''),
      items: (g[2] ?? []).map((it) => ({
        name: String(it[0] || ''),
        serviceType: it[1] === 1 ? 'Inti' : 'Additional',
        quantity: Number(it[2] || 1),
        unit: it[3] || undefined,
        unitPrice: Number(it[4] || 0),
      })),
    })),
    payments: (paysRaw ?? []).map((pay) => ({
      receiptNumber: String(pay[0] || ''),
      paidAt: String(pay[1] || ''),
      method: String(pay[2] || ''),
      amount: Number(pay[3] || 0),
    })),
    invoiceNote: invoiceNote || undefined,
    businessName: businessName || undefined,
    businessPhone: businessPhone || undefined,
  }
}

export const encodeInvoiceShareToken = (payload: InvoiceSharePayload): string =>
  toBase64Url(JSON.stringify(compactInvoicePayload(payload)))

export const encodeInvoiceShareTokenAsync = async (payload: InvoiceSharePayload): Promise<string> => {
  const compactJson = JSON.stringify(compactInvoicePayload(payload))
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([new TextEncoder().encode(compactJson)]).stream().pipeThrough(new CompressionStream('deflate-raw'))
      const buf = await new Response(stream).arrayBuffer()
      return `z${toBase64UrlBytes(new Uint8Array(buf))}`
    } catch {
      // Fallback to uncompressed compact tuple token
    }
  }
  return toBase64Url(compactJson)
}

export const decodeInvoiceShareToken = (token: string): InvoiceSharePayload | null => {
  try {
    const parsed = JSON.parse(fromBase64Url(token))
    if (Array.isArray(parsed)) return expandCompactInvoicePayload(parsed)
    const obj = parsed as InvoiceSharePayload
    if (!obj || !obj.invoiceNumber) return null
    return obj
  } catch {
    return null
  }
}

export const decodeInvoiceShareTokenAsync = async (token: string): Promise<InvoiceSharePayload | null> => {
  if (!token) return null
  if (token.startsWith('z') && typeof DecompressionStream !== 'undefined') {
    try {
      const bytes = fromBase64UrlBytes(token.slice(1))
      const stream = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      const text = await new Response(stream).text()
      const parsed = JSON.parse(text)
      return Array.isArray(parsed) ? expandCompactInvoicePayload(parsed) : (parsed as InvoiceSharePayload)
    } catch {
      return null
    }
  }
  return decodeInvoiceShareToken(token)
}

export const toInvoiceSharePayload = (input: InvoicePdfInput): InvoiceSharePayload => {
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

  const groups: InvoiceShareGroup[] = sortedGroups.map((group) => {
    const items = sortItemsIntiFirst ? sortItemsIntiFirst(group.items) : group.items
    return {
      id: group.id,
      kind: group.kind,
      orderDate: group.orderDate,
      items: items.map((item: InvoiceItem) => ({
        name: item.name,
        serviceType: item.serviceType === 'Inti' ? 'Inti' : 'Additional',
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
      })),
    }
  })

  return {
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt,
    poNumber: booking?.poNumber ?? '-',
    customerName: customer?.name ?? '-',
    customerPhone: customer?.phone ?? '-',
    eventDate: booking?.eventDate ?? '',
    eventLocation: booking?.location ?? '',
    groups,
    payments: payments.map((p) => ({
      receiptNumber: p.receiptNumber,
      paidAt: p.paidAt,
      method: p.method,
      amount: p.amount,
    })),
    totalBilling,
    totalPaid,
    balance,
    businessName: businessProfile?.name,
    businessTagline: businessProfile?.tagline,
    businessPhone: businessProfile?.phone,
    businessEmail: businessProfile?.email,
    businessAddress: businessProfile?.address,
    invoiceNote: businessProfile?.invoiceNote,
    logoUrl: businessProfile?.logoUrl,
  }
}

const renderInvoicePdfFromNormalized = (payload: InvoiceSharePayload, businessProfile?: BusinessProfile) => {
  const effectiveProfile: BusinessProfile | undefined = businessProfile ?? (
    payload.businessName || payload.businessPhone || payload.businessEmail || payload.businessAddress || payload.logoUrl
      ? {
          name: payload.businessName || 'Azura',
          tagline: payload.businessTagline || 'Makeup Artist',
          phone: payload.businessPhone || '',
          email: payload.businessEmail || '',
          address: payload.businessAddress || '',
          invoiceNote: payload.invoiceNote || '',
          logoUrl: payload.logoUrl,
        }
      : undefined
  )

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 16
  const contentWidth = pageWidth - marginX * 2

  const brandEmail = effectiveProfile?.email || payload.businessEmail || 'hello@azuramakeup.id'
  const brandPhone = effectiveProfile?.phone || payload.businessPhone || '0812 9000 2026'
  const brandAddress = effectiveProfile?.address || payload.businessAddress || 'South Jakarta, Indonesia'
  const invoiceNote = effectiveProfile?.invoiceNote || payload.invoiceNote || 'Thank you for trusting us with your special celebration.'

  const cardTop = drawEditorialBanner(doc, {
    marginX,
    docTitle: 'OFFICIAL INVOICE',
    docSubtitle: payload.poNumber && payload.poNumber !== '-' ? `PURCHASE ORDER · ${payload.poNumber}` : 'CLIENT BILLING STATEMENT',
    rightMetaTop: payload.invoiceNumber,
    rightMetaBottom: `Issued ${formatDate(payload.issuedAt)}`,
    businessProfile: effectiveProfile,
  })

  // Two clean info cards side by side
  const colGap = 5
  const infoW = (contentWidth - colGap) / 2
  const cardH = 30

  doc.setFillColor(...PDF_PALETTE.ivory)
  doc.setDrawColor(...PDF_PALETTE.gold)
  doc.setLineWidth(0.28)
  doc.roundedRect(marginX, cardTop, infoW, cardH, 3.2, 3.2, 'FD')
  doc.roundedRect(marginX + infoW + colGap, cardTop, infoW, cardH, 3.2, 3.2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...PDF_PALETTE.goldDark)
  doc.text('BILLED TO', marginX + 5, cardTop + 6.5)
  doc.text('BOOKING & EVENT DETAILS', marginX + infoW + colGap + 5, cardTop + 6.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text(payload.customerName || '-', marginX + 5, cardTop + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(78, 70, 62)
  doc.text(`Phone / WhatsApp: ${payload.customerPhone || '-'}`, marginX + 5, cardTop + 19)
  doc.text(`Invoice Date: ${formatDate(payload.issuedAt)}`, marginX + 5, cardTop + 24.4)

  const rightX = marginX + infoW + colGap + 5
  const firstOrderDate = payload.groups[0]?.orderDate ?? payload.issuedAt
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text(payload.poNumber || '-', rightX, cardTop + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(78, 70, 62)
  const eventStr = `Event: ${payload.eventDate ? formatDate(payload.eventDate) : '-'}${payload.eventLocation ? ` · ${payload.eventLocation}` : ''}`
  doc.text(doc.splitTextToSize(eventStr, infoW - 10)[0] ?? eventStr, rightX, cardTop + 19)
  doc.text(`Initial Order: ${formatDate(firstOrderDate)}`, rightX, cardTop + 24.4)

  // Services table (grouped chronologically, Core first per group)
  const tableRows: Array<[string, string, string, string, string]> = []
  payload.groups.forEach((group, gIdx) => {
    const groupTitle = group.kind === 'Awal'
      ? `Initial Order (${formatDate(group.orderDate)})`
      : `Add-on #${gIdx} (${formatDate(group.orderDate)})`
    for (const item of group.items) {
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

  const shownPayments = payload.payments.slice(0, 4)
  const historyHeight = Math.max(41, 22 + shownPayments.length * 6.8)
  doc.setFillColor(...PDF_PALETTE.ivory)
  doc.setDrawColor(...PDF_PALETTE.gold)
  doc.setLineWidth(0.28)
  doc.roundedRect(marginX, cursorY, leftW, historyHeight, 3.2, 3.2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.4)
  doc.setTextColor(...PDF_PALETTE.goldDark)
  doc.text('PAYMENT STATUS & HISTORY', marginX + 5, cursorY + 6.5)

  const statusText = payload.balance <= 0 ? 'PAID IN FULL' : payload.totalPaid > 0 ? 'PARTIAL' : 'UNPAID'
  const statusBg = payload.balance <= 0 ? PDF_PALETTE.successBg : payload.totalPaid > 0 ? PDF_PALETTE.warningBg : PDF_PALETTE.dangerBg
  const statusFg = payload.balance <= 0 ? PDF_PALETTE.successFg : payload.totalPaid > 0 ? PDF_PALETTE.warningFg : PDF_PALETTE.dangerFg
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
  doc.setDrawColor(...PDF_PALETTE.gold)
  doc.setLineWidth(0.3)
  doc.roundedRect(rightBoxX, cursorY, rightBoxW, 41, 3.4, 3.4, 'FD')
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

  drawTotalRow(10, 'Invoice Total', formatCurrency(payload.totalBilling))
  doc.setDrawColor(78, 67, 57)
  doc.setLineWidth(0.25)
  doc.line(rightBoxX + 6, cursorY + 14.5, rightBoxX + rightBoxW - 6, cursorY + 14.5)

  drawTotalRow(21.5, 'Total Paid', formatCurrency(payload.totalPaid))
  doc.line(rightBoxX + 6, cursorY + 26, rightBoxX + rightBoxW - 6, cursorY + 26)

  drawTotalRow(33.8, 'Balance Due', formatCurrency(Math.max(0, payload.balance)), true)

  drawEditorialFooter(doc, {
    marginX,
    note: invoiceNote,
    contactLine: `${brandEmail} · ${brandPhone} · ${brandAddress}`,
    showPageNumbers: doc.getNumberOfPages() > 1,
    framed: true,
  })

  return doc
}

export const buildInvoicePdfFromPayload = (payload: InvoiceSharePayload) =>
  renderInvoicePdfFromNormalized(payload)

export const buildInvoicePdfDoc = (input: InvoicePdfInput) =>
  renderInvoicePdfFromNormalized(toInvoiceSharePayload(input), input.businessProfile)

export const downloadInvoicePdf = (input: InvoicePdfInput) => {
  const doc = buildInvoicePdfDoc(input)
  doc.save(`${input.invoice.invoiceNumber}.pdf`)
}

export const resolveInvoiceShareUrl = async (input: InvoicePdfInput): Promise<{ url: string; mode: 'r2' | 'viewer' }> => {
  const payload = toInvoiceSharePayload(input)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const doc = renderInvoicePdfFromNormalized(payload, input.businessProfile)

  try {
    const blob = doc.output('blob')
    const file = new File([blob], `${payload.invoiceNumber}.pdf`, { type: 'application/pdf' })
    const body = new FormData()
    body.append('file', file)
    body.append('purpose', 'invoice-pdf')
    body.append('visibility', 'public')

    const apiBase = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(`${apiBase}/api/files`, {
      method: 'POST',
      body,
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (response.ok) {
      const json = await response.json() as { ok: boolean; data?: { url: string } }
      if (json.ok && json.data?.url) {
        const absolute = json.data.url.startsWith('http')
          ? json.data.url
          : `${apiBase || origin}${json.data.url}`
        return { url: absolute, mode: 'r2' }
      }
    }
  } catch {
    // Fall back to self-contained digital invoice & PDF download link
  }

  const token = await encodeInvoiceShareTokenAsync({ ...payload, logoUrl: undefined })
  return {
    url: `${origin}/invoice?d=${token}`,
    mode: 'viewer',
  }
}
