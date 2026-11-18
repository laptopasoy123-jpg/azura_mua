import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Booking, BusinessProfile, Customer, Invoice, InvoiceItem, OrderGroup, Payment } from '../stores/crm'
import { formatCurrency, formatDate, formatTerbilang } from './format'

export interface ReceiptShareItem {
  name: string
  serviceType?: string
  groupLabel: string
  quantity: number
  unit?: string
  unitPrice: number
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
    const groupTitle = group.kind === 'Awal' ? 'Pesanan Awal' : `Tambahan ${gIdx}`
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
  const brandTagline = (payload.businessTagline || 'MAKEUP ARTIST').toUpperCase()
  const brandEmail = payload.businessEmail || 'hello@azuramakeup.id'
  const brandPhone = payload.businessPhone || '0812 9000 2026'
  const brandAddress = payload.businessAddress || 'Jakarta Selatan'
  const footerNote = payload.invoiceNote || `Terima kasih telah mempercayakan momen spesial Anda kepada ${brandName} Makeup Studio.`

  // Crisp Charcoal Espresso top header card
  doc.setFillColor(33, 29, 26)
  doc.roundedRect(marginX, 14, contentWidth, 27, 3, 3, 'F')

  doc.setFillColor(196, 167, 125)
  doc.rect(marginX + 6, 14, contentWidth - 12, 0.9, 'F')

  let textStartX = marginX + 23
  if (payload.logoUrl && payload.logoUrl.startsWith('data:image/')) {
    try {
      const fmt = payload.logoUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.setFillColor(250, 248, 244)
      doc.roundedRect(marginX + 6, 19.5, 15, 15, 2.2, 2.2, 'F')
      doc.addImage(payload.logoUrl, fmt, marginX + 6.8, 20.3, 13.4, 13.4)
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
  doc.setFontSize(11)
  doc.setTextColor(246, 239, 227)
  doc.text('KWITANSI PEMBAYARAN', pageWidth - marginX - 6, 24.5, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.2)
  doc.setTextColor(225, 205, 173)
  doc.text(`${payload.receiptNumber}  ·  ${formatDate(payload.paidAt)}`, pageWidth - marginX - 6, 31.5, { align: 'right' })

  // Two clean info cards side by side
  const cardTop = 46
  const colGap = 5
  const infoW = (contentWidth - colGap) / 2
  const cardH = 30

  doc.setFillColor(250, 248, 244)
  doc.setDrawColor(226, 218, 206)
  doc.roundedRect(marginX, cardTop, infoW, cardH, 2.2, 2.2, 'FD')
  doc.roundedRect(marginX + infoW + colGap, cardTop, infoW, cardH, 2.2, 2.2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.6)
  doc.setTextColor(132, 118, 102)
  doc.text('DITERIMA DARI', marginX + 5, cardTop + 6.5)
  doc.text('RINCIAN PEMESANAN', marginX + infoW + colGap + 5, cardTop + 6.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(33, 29, 26)
  doc.text(payload.customerName || '-', marginX + 5, cardTop + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(78, 70, 62)
  doc.text(`Telepon / WA: ${payload.customerPhone || '-'}`, marginX + 5, cardTop + 19)
  doc.text(`Ref. Faktur: ${payload.invoiceNumber || '-'}`, marginX + 5, cardTop + 24.5)

  const rightX = marginX + infoW + colGap + 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(33, 29, 26)
  doc.text(payload.poNumber || '-', rightX, cardTop + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(78, 70, 62)
  const acaraStr = `Acara: ${payload.eventDate ? formatDate(payload.eventDate) : '-'}${payload.eventLocation ? ` · ${payload.eventLocation}` : ''}`
  doc.text(doc.splitTextToSize(acaraStr, infoW - 10)[0] ?? acaraStr, rightX, cardTop + 19)
  doc.text(`Pesanan Awal: ${payload.firstOrderDate ? formatDate(payload.firstOrderDate) : '-'}`, rightX, cardTop + 24.5)

  let cursorY = cardTop + cardH + 7

  // Rincian Pesanan berdasarkan PO
  if (payload.items.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(33, 29, 26)
    doc.text(`Rincian Pesanan (${payload.poNumber})`, marginX, cursorY)
    cursorY += 3

    const orderRows = payload.items.map((item) => {
      const qtyUnit = item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity)
      const kindLabel = item.serviceType === 'Inti' ? 'Layanan Inti' : 'Tambahan'
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
      head: [['Layanan', 'Kelompok & Tanggal', 'Jumlah', 'Harga Satuan', 'Subtotal']],
      body: orderRows,
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: {
        font: 'helvetica',
        fontSize: 8.3,
        cellPadding: 2.8,
        textColor: [38, 33, 29],
        lineColor: [226, 219, 208],
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [38, 32, 28],
        textColor: [246, 239, 227],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [251, 249, 245],
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 44 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      },
    })

    cursorY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY + 25) + 8
  }

  if (cursorY + 52 > pageHeight - 24) {
    doc.addPage()
    cursorY = 18
  }

  // Bottom 2-col: Left = Totals summary card | Right = Charcoal Espresso Received Box
  const leftW = contentWidth * 0.49
  const rightCardW = contentWidth * 0.46
  const rightCardX = marginX + contentWidth - rightCardW

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: pageWidth - (marginX + leftW), bottom: 26 },
    tableWidth: leftW,
    body: [
      ['Total Tagihan PO', formatCurrency(payload.totalBilling)],
      ['Akumulasi Dibayar', formatCurrency(payload.totalPaid)],
      ['Sisa Pembayaran', formatCurrency(Math.max(0, payload.balance))],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.6,
      cellPadding: 2.8,
      textColor: [48, 40, 34],
      lineColor: [226, 218, 206],
    },
    columnStyles: {
      0: { cellWidth: leftW * 0.56 },
      1: { cellWidth: leftW * 0.44, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.row.index === 2) {
        data.cell.styles.fillColor = [243, 236, 224]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [30, 26, 23]
      }
    },
  })

  const afterLeftTableY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY + 24) + 4
  const statusLabel = payload.balance <= 0 ? 'LUNAS' : 'DIBAYAR SEBAGIAN'
  const statusFill: [number, number, number] = payload.balance <= 0 ? [225, 243, 232] : [253, 240, 212]
  const statusColor: [number, number, number] = payload.balance <= 0 ? [34, 102, 68] : [156, 98, 22]
  doc.setFillColor(...statusFill)
  doc.roundedRect(marginX, afterLeftTableY, 38, 6.8, 3.2, 3.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.6)
  doc.setTextColor(...statusColor)
  doc.text(statusLabel, marginX + 19, afterLeftTableY + 4.6, { align: 'center' })

  // Right Espresso dark box
  const darkBoxH = 38
  doc.setFillColor(33, 29, 26)
  doc.roundedRect(rightCardX, cursorY, rightCardW, darkBoxH, 2.5, 2.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(214, 198, 173)
  doc.text('NOMINAL DITERIMA', rightCardX + 6, cursorY + 7.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(250, 248, 244)
  doc.text(formatCurrency(payload.amount), rightCardX + 6, cursorY + 15)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.2)
  doc.setTextColor(225, 212, 194)
  const terbilangLines = doc.splitTextToSize(formatTerbilang(payload.amount), rightCardW - 12)
  doc.text(terbilangLines[0] ?? '', rightCardX + 6, cursorY + 21)

  doc.setDrawColor(78, 67, 57)
  doc.setLineWidth(0.25)
  doc.line(rightCardX + 6, cursorY + 25.5, rightCardX + rightCardW - 6, cursorY + 25.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.8)
  doc.setTextColor(246, 239, 227)
  const methodLabel = `Metode: ${payload.method}${payload.notes?.trim() ? ` · ${payload.notes.trim()}` : ''}`
  doc.text(doc.splitTextToSize(methodLabel, rightCardW - 12)[0] ?? methodLabel, rightCardX + 6, cursorY + 32)

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
    doc.text(footerNote, marginX, fy + 5)

    doc.setFontSize(7.6)
    doc.setTextColor(122, 112, 102)
    doc.text(`${brandEmail} · ${brandPhone} · ${brandAddress}`, marginX, fy + 10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Hak Cipta © ${new Date().getFullYear()} Daysheet.id`, pageWidth - marginX, fy + 10, { align: 'right' })
  }

  return doc
}

export const buildPaymentReceiptPdfDoc = (params: {
  payment: Payment
  booking?: Booking
  customer?: Customer
  invoice?: Invoice
  sortedGroups?: OrderGroup[]
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
  sortItemsIntiFirst?: (items: InvoiceItem[]) => InvoiceItem[]
  totalBilling: number
  totalPaid: number
  balance: number
  businessProfile?: BusinessProfile
}) => {
  const doc = buildPaymentReceiptPdfDoc(params)
  doc.save(`Kwitansi-${params.payment.receiptNumber}.pdf`)
}

export const resolveReceiptShareUrl = async (params: {
  payment: Payment
  booking?: Booking
  customer?: Customer
  invoice?: Invoice
  sortedGroups?: OrderGroup[]
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
    const file = new File([blob], `Kwitansi-${payload.receiptNumber}.pdf`, { type: 'application/pdf' })
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
