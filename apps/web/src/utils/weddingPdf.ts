import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AttireScheduleEntry, Booking, BusinessProfile, Customer, WeddingAttire, WeddingFittingForm } from '../stores/crm'
import { displayAttireStatus, formatDate } from './format'
import {
  drawEditorialBanner,
  drawEditorialFooter,
  drawEditorialKpiStrip,
  loadImageForPdf,
  PDF_PALETTE,
  type LoadedPdfImage,
} from './pdfTheme'

const measurementGroupMeta = [
  { key: 'bride', label: 'Bride', fields: ['LD', 'LPinggang', 'LPanggul', 'LLenganA', 'LLenganB', 'PLengan', 'Others adj', 'Shoes'] },
  { key: 'groom', label: 'Groom', fields: ['LD', 'LLengan', 'LPerut', 'PLengan', 'PCelana', 'LKepala', 'Others adj', 'Shoes'] },
  { key: 'ibu', label: 'Mother', fields: ['LD', 'LLengan', 'PLengan'] },
  { key: 'ayah', label: 'Father', fields: ['LD', 'PLengan', 'PCelana', 'LKepala', 'Slop'] },
  { key: 'kembarMayangCe', label: 'Kembar Mayang (F)', fields: ['LD', 'Slop'] },
  { key: 'kembarMayangCo', label: 'Kembar Mayang (M)', fields: ['LD', 'Slop'] },
  { key: 'terimaTamu', label: 'Guest Greeters', fields: ['List LD'] },
] as const

const vendorMeta = [
  ['deco', 'Decoration'],
  ['doc', 'Documentation'],
  ['wcc', 'Wedding Cake / Catering'],
  ['mc', 'Master of Ceremony'],
  ['tenda', 'Tent & Stage'],
  ['seserahan', 'Seserahan'],
  ['wo', 'Wedding Organizer'],
] as const

const getAutoTableFinalY = (doc: jsPDF, fallback: number): number => {
  const last = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
  return last?.finalY ?? fallback
}

const formatMeasureVal = (field: string, raw?: string) => {
  const trimmed = raw?.trim()
  if (!trimmed) return '-'
  if (field === 'Shoes' || field === 'Slop' || field === 'List LD') return trimmed
  return `${trimmed} cm`
}

export const buildWeddingFittingPdfDoc = async (params: {
  form: WeddingFittingForm
  booking: Booking
  attireList: WeddingAttire[]
  businessProfile?: BusinessProfile
}) => {
  const { form, booking, attireList, businessProfile } = params
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 14
  const contentWidth = pageWidth - marginX * 2
  const bottomLimit = pageHeight - 16

  const findAttire = (id?: string) => attireList.find((item) => item.id === id)

  const ensureSpace = (currentY: number, needed: number): number => {
    if (currentY + needed > bottomLimit) {
      doc.addPage()
      return 16
    }
    return currentY
  }

  const drawSectionHeading = (currentY: number, title: string, minFollowingSpace = 16): number => {
    const y = ensureSpace(currentY, minFollowingSpace)
    doc.setFillColor(...PDF_PALETTE.goldDark)
    doc.rect(marginX, y, 3, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...PDF_PALETTE.ink)
    doc.text(title, marginX + 6, y + 4.7)
    doc.setDrawColor(...PDF_PALETTE.border)
    doc.line(marginX, y + 7.5, marginX + contentWidth, y + 7.5)
    return y + 10.5
  }

  const eventDateText = formatDate(booking.eventDate, { day: '2-digit', month: 'long', year: 'numeric' })
  let y = drawEditorialBanner(doc, {
    marginX,
    docTitle: 'WEDDING FITTING FORM',
    docSubtitle: `PURCHASE ORDER · ${booking.poNumber}`,
    rightMetaTop: eventDateText,
    rightMetaBottom: (booking.location || '-').slice(0, 42),
    businessProfile,
  })

  // Event & Venue bar
  doc.setFontSize(9)
  const locationLines = doc.splitTextToSize(booking.location || '-', contentWidth - 40) as string[]
  const infoBoxHeight = 14 + Math.max(1, locationLines.length) * 4.5
  doc.setFillColor(...PDF_PALETTE.ivory)
  doc.setDrawColor(...PDF_PALETTE.border)
  doc.roundedRect(marginX, y, contentWidth, infoBoxHeight, 2.2, 2.2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...PDF_PALETTE.goldDark)
  doc.text('Event Date:', marginX + 4.5, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text(`${eventDateText}${booking.eventTime ? ` at ${booking.eventTime}` : ''}`, marginX + 30, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...PDF_PALETTE.goldDark)
  doc.text('Event Venue:', marginX + 4.5, y + 11.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text(locationLines, marginX + 30, y + 11.5)

  y += infoBoxHeight + 6

  // 1. Size Chart
  y = drawSectionHeading(y, '1. Size Chart & Measurements', 30)

  const pairColGap = 6
  const pairTableWidth = (contentWidth - pairColGap) / 2

  const renderGroupTable = (
    group: (typeof measurementGroupMeta)[number],
    startX: number,
    startY: number,
    width: number,
  ): number => {
    const body = group.fields.map((field) => [
      field,
      formatMeasureVal(field, form.measurements[group.key]?.[field]),
    ])
    autoTable(doc, {
      startY,
      margin: { left: startX, right: pageWidth - (startX + width), bottom: 16 },
      tableWidth: width,
      head: [[group.label, 'Measurement']],
      body,
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 1.9,
        textColor: [38, 33, 29],
        lineColor: PDF_PALETTE.border,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: PDF_PALETTE.espressoSoft,
        textColor: PDF_PALETTE.cream,
        fontStyle: 'bold',
        fontSize: 8.2,
      },
      columnStyles: {
        0: { cellWidth: width * 0.48, fontStyle: 'bold', fillColor: PDF_PALETTE.ivory },
        1: { cellWidth: width * 0.52, halign: 'right' },
      },
    })
    return getAutoTableFinalY(doc, startY)
  }

  const pairs: Array<[(typeof measurementGroupMeta)[number], (typeof measurementGroupMeta)[number]]> = [
    [measurementGroupMeta[0], measurementGroupMeta[1]],
    [measurementGroupMeta[2], measurementGroupMeta[3]],
    [measurementGroupMeta[4], measurementGroupMeta[5]],
  ]

  for (const [leftGroup, rightGroup] of pairs) {
    const neededRows = Math.max(leftGroup.fields.length, rightGroup.fields.length) + 1
    y = ensureSpace(y, neededRows * 6.5 + 4)
    const pairStartY = y
    const leftEndY = renderGroupTable(leftGroup, marginX, pairStartY, pairTableWidth)
    const rightEndY = renderGroupTable(rightGroup, marginX + pairTableWidth + pairColGap, pairStartY, pairTableWidth)
    y = Math.max(leftEndY, rightEndY) + 4
  }

  const terimaTamuGroup = measurementGroupMeta[6]
  y = ensureSpace(y, 18)
  y = renderGroupTable(terimaTamuGroup, marginX, y, contentWidth) + 7

  // 2. Events & Attire Selection (with Real Attire Photos)
  y = drawSectionHeading(y, '2. Event Sessions & Selected Attire', 45)

  for (const event of form.events) {
    const brideAttire = findAttire(event.bride.attireId)
    const groomAttire = findAttire(event.groom.attireId)
    const [brideImg, groomImg] = await Promise.all([
      loadImageForPdf(brideAttire?.imageUrl),
      loadImageForPdf(groomAttire?.imageUrl),
    ])

    const colGap = 6
    const cardW = (contentWidth - colGap) / 2
    const imgBoxW = 28
    const imgBoxH = 36
    const textXOffset = imgBoxW + 4
    const textW = cardW - textXOffset - 6

    const buildCoupleLines = (
      roleLabel: string,
      attire: WeddingAttire | undefined,
      detail: { look: string; accessories: string; shoes: string },
    ) => {
      const rows = [
        { label: 'Attire', value: attire ? `${attire.name} (${attire.code} · Size ${attire.size})` : 'Not assigned yet' },
        { label: 'Look', value: detail.look?.trim() || '-' },
        { label: 'Accessories', value: detail.accessories?.trim() || '-' },
        { label: 'Footwear', value: detail.shoes?.trim() || '-' },
      ]
      const wrapped = rows.map((row) => ({
        label: row.label,
        lines: doc.splitTextToSize(`${row.label}: ${row.value}`, textW) as string[],
      }))
      const totalTextHeight = wrapped.reduce((sum, r) => sum + r.lines.length * 4.3 + 1.4, 0)
      return { roleLabel, wrapped, contentHeight: Math.max(imgBoxH + 2, totalTextHeight + 2) }
    }

    const brideInfo = buildCoupleLines('BRIDE', brideAttire, event.bride)
    const groomInfo = buildCoupleLines('GROOM', groomAttire, event.groom)
    const coupleBodyHeight = Math.max(brideInfo.contentHeight, groomInfo.contentHeight) + 15

    const eventHeaderHeight = 14
    const totalEventBlockHeight = eventHeaderHeight + coupleBodyHeight + 6
    y = ensureSpace(y, totalEventBlockHeight)

    doc.setFillColor(...PDF_PALETTE.espressoSoft)
    doc.roundedRect(marginX, y, contentWidth, eventHeaderHeight, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...PDF_PALETTE.ivory)
    const titleStr = `Session ${event.number}${event.name?.trim() ? ` — ${event.name.trim()}` : ''}`
    doc.text(titleStr, marginX + 4, y + 5.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    doc.setTextColor(225, 205, 173)
    const timePart = `Ready Time: ${event.readyTime?.trim() || '-'}`
    const notePart = event.timeNote?.trim() ? `Time Note: ${event.timeNote.trim()}` : 'Time Note: -'
    const timeLine = doc.splitTextToSize(`${timePart}   |   ${notePart}`, contentWidth - 8)
    doc.text(timeLine[0] ?? timePart, marginX + 4, y + 10.8)

    const cardsY = y + eventHeaderHeight + 2.5

    const drawCoupleCard = (
      x: number,
      info: ReturnType<typeof buildCoupleLines>,
      img: LoadedPdfImage | null,
    ) => {
      doc.setFillColor(...PDF_PALETTE.ivory)
      doc.setDrawColor(...PDF_PALETTE.border)
      doc.roundedRect(x, cardsY, cardW, coupleBodyHeight, 2, 2, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.4)
      doc.setTextColor(...PDF_PALETTE.goldDark)
      doc.text(info.roleLabel, x + 3.5, cardsY + 5.5)

      const boxX = x + 3.5
      const boxY = cardsY + 8
      doc.setFillColor(242, 236, 227)
      doc.setDrawColor(...PDF_PALETTE.border)
      doc.roundedRect(boxX, boxY, imgBoxW, imgBoxH, 1.5, 1.5, 'FD')

      if (img) {
        const scale = Math.min((imgBoxW - 2) / img.width, (imgBoxH - 2) / img.height)
        const drawW = img.width * scale
        const drawH = img.height * scale
        const drawX = boxX + (imgBoxW - drawW) / 2
        const drawY = boxY + (imgBoxH - drawH) / 2
        doc.addImage(img.dataUrl, img.format, drawX, drawY, drawW, drawH)
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(125, 118, 110)
        doc.text('No Photo', boxX + imgBoxW / 2, boxY + imgBoxH / 2 + 1, { align: 'center' })
      }

      let cursorY = cardsY + 11.5
      const textStartX = x + 3.5 + textXOffset
      doc.setFontSize(8)
      for (const row of info.wrapped) {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...PDF_PALETTE.ink)
        for (let lineIdx = 0; lineIdx < row.lines.length; lineIdx += 1) {
          doc.text(row.lines[lineIdx]!, textStartX, cursorY)
          cursorY += 4.3
        }
        cursorY += 1.4
      }
    }

    drawCoupleCard(marginX, brideInfo, brideImg)
    drawCoupleCard(marginX + cardW + colGap, groomInfo, groomImg)

    y = cardsY + coupleBodyHeight + 5
  }

  // 3. Family & Extras
  y = drawSectionHeading(y + 2, '3. Family Uniforms & Extras', 92)

  const domasManggoloRows: Array<[string, string]> = [
    ['Domas (Uniform & Details)', form.uniforms.domas?.trim() || '-'],
    ['Manggolo (Uniform & Details)', form.uniforms.manggolo?.trim() || '-'],
    ['Manggolo — Blangkon Qty', form.manggoloBlangkon !== null && form.manggoloBlangkon !== undefined ? `${form.manggoloBlangkon} pcs` : '-'],
    ['Manggolo — Slippers Qty', form.manggoloSlop !== null && form.manggoloSlop !== undefined ? `${form.manggoloSlop} pairs` : '-'],
    ['Contact Lenses', form.uniforms.softlens?.trim() || '-'],
  ]

  const keluargaTambahanRows: Array<[string, string]> = [
    ['Mother & In-laws', form.uniforms.ibuBesan?.trim() || '-'],
    ['Father & In-laws', form.uniforms.bapakBesan?.trim() || '-'],
    ['Guest Greeters', form.uniforms.terimaTamu?.trim() || '-'],
    ['Fresh Jasmine', form.uniforms.melati?.trim() || '-'],
    ['Henna Art', form.uniforms.henna?.trim() || '-'],
    ['Other Notes', form.uniforms.tambahan?.trim() || '-'],
  ]

  const famStartY = y
  autoTable(doc, {
    startY: famStartY,
    margin: { left: marginX, right: pageWidth - (marginX + pairTableWidth), bottom: 16 },
    tableWidth: pairTableWidth,
    head: [['Domas, Manggolo & Lenses', 'Details / Qty']],
    body: domasManggoloRows,
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.1,
      textColor: [38, 33, 29],
      lineColor: PDF_PALETTE.border,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: PDF_PALETTE.espressoSoft,
      textColor: PDF_PALETTE.cream,
      fontStyle: 'bold',
      fontSize: 8.2,
    },
    columnStyles: {
      0: { cellWidth: pairTableWidth * 0.54, fontStyle: 'bold', fillColor: PDF_PALETTE.ivory },
      1: { cellWidth: pairTableWidth * 0.46 },
    },
  })
  const famLeftEndY = getAutoTableFinalY(doc, famStartY)

  autoTable(doc, {
    startY: famStartY,
    margin: { left: marginX + pairTableWidth + pairColGap, right: marginX, bottom: 16 },
    tableWidth: pairTableWidth,
    head: [['Family & Additional Notes', 'Description']],
    body: keluargaTambahanRows,
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.1,
      textColor: [38, 33, 29],
      lineColor: PDF_PALETTE.border,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: PDF_PALETTE.espressoSoft,
      textColor: PDF_PALETTE.cream,
      fontStyle: 'bold',
      fontSize: 8.2,
    },
    columnStyles: {
      0: { cellWidth: pairTableWidth * 0.46, fontStyle: 'bold', fillColor: PDF_PALETTE.ivory },
      1: { cellWidth: pairTableWidth * 0.54 },
    },
  })
  const famRightEndY = getAutoTableFinalY(doc, famStartY)

  y = Math.max(famLeftEndY, famRightEndY) + 7

  // 4. Wedding Vendors
  y = drawSectionHeading(y, '4. Partner Wedding Vendors', 76)
  const vendorRows = vendorMeta.map(([key, label]) => [label, form.vendors[key]?.trim() || '-'])

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX, bottom: 16 },
    tableWidth: contentWidth,
    head: [['Vendor Role', 'Vendor Name / Contact / Notes']],
    body: vendorRows,
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8.2,
      cellPadding: 2.2,
      textColor: [38, 33, 29],
      lineColor: PDF_PALETTE.border,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: PDF_PALETTE.espressoSoft,
      textColor: PDF_PALETTE.cream,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: 'bold', fillColor: PDF_PALETTE.ivory },
      1: { cellWidth: contentWidth - 52 },
    },
  })

  drawEditorialFooter(doc, {
    marginX,
    showPageNumbers: true,
  })

  return doc
}

export const generateWeddingFittingPdf = async (params: {
  form: WeddingFittingForm
  booking: Booking
  attireList: WeddingAttire[]
  businessProfile?: BusinessProfile
}) => {
  const doc = await buildWeddingFittingPdfDoc(params)
  doc.save(`Fitting-Form-${params.booking.poNumber}.pdf`)
}

export interface WeddingAttireReportInput {
  fromDate?: string
  toDate?: string
  bookings: Booking[]
  customers: Customer[]
  weddingForms: WeddingFittingForm[]
  attireList: WeddingAttire[]
  effectiveStatus: (attire: WeddingAttire) => string
  attireSchedule: (attireId: string, opts?: { includePast?: boolean }) => AttireScheduleEntry[]
  businessProfile?: BusinessProfile
}

export const buildWeddingAttireReportPdfDoc = async (input: WeddingAttireReportInput): Promise<jsPDF> => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 12
  const contentWidth = pageWidth - marginX * 2

  const fromDate = input.fromDate?.trim() || ''
  const toDate = input.toDate?.trim() || ''

  const localNow = new Date()
  const todayIso = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`

  const findCustomer = (id: string) => input.customers.find((c) => c.id === id)
  const findAttire = (id?: string) => (id ? input.attireList.find((a) => a.id === id) : undefined)

  // Preload all unique attire thumbnails once
  const imageCache = new Map<string, LoadedPdfImage | null>()
  await Promise.all(
    input.attireList.map(async (att) => {
      if (att.imageUrl) {
        imageCache.set(att.id, await loadImageForPdf(att.imageUrl))
      }
    }),
  )

  interface ScheduleRow {
    eventDate: string
    poNumber: string
    customerName: string
    customerPhone: string
    location: string
    eventLabel: string
    role: string
    attireId?: string
    attireLabel: string
    statusLabel: string
  }

  const rows: ScheduleRow[] = []
  const sortedBookings = [...input.bookings]
    .filter((b) => (!fromDate || b.eventDate >= fromDate) && (!toDate || b.eventDate <= toDate))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))

  for (const booking of sortedBookings) {
    const customer = findCustomer(booking.customerId)
    const customerName = customer?.name || '-'
    const customerPhone = customer?.phone || ''
    const form = input.weddingForms.find((f) => f.bookingId === booking.id)
    const statusLabel =
      booking.status === 'Dibatalkan'
        ? 'Cancelled'
        : booking.eventDate < todayIso
          ? 'Completed'
          : booking.eventDate === todayIso
            ? 'In Use'
            : 'Booked'

    if (form?.events?.length) {
      let hasAssignedAttire = false
      for (const [i, ev] of form.events.entries()) {
        const eventTitle = `Session ${ev.number || i + 1}${ev.name ? ` · ${ev.name}` : ''}${ev.readyTime ? ` (${ev.readyTime})` : ''}`
        const pushRole = (attireId: string | undefined, role: 'Bride' | 'Groom') => {
          const att = findAttire(attireId)
          if (!att) return
          hasAssignedAttire = true
          rows.push({
            eventDate: booking.eventDate,
            poNumber: booking.poNumber,
            customerName,
            customerPhone,
            location: booking.location || '-',
            eventLabel: eventTitle,
            role,
            attireId: att.id,
            attireLabel: `${att.name}\n${att.code} · Size ${att.size}`,
            statusLabel,
          })
        }
        pushRole(ev.bride.attireId, 'Bride')
        pushRole(ev.groom.attireId, 'Groom')
      }
      if (!hasAssignedAttire) {
        rows.push({
          eventDate: booking.eventDate,
          poNumber: booking.poNumber,
          customerName,
          customerPhone,
          location: booking.location || '-',
          eventLabel: 'Fitting Saved',
          role: 'Unassigned',
          attireLabel: 'No wardrobe selected',
          statusLabel,
        })
      }
    } else {
      rows.push({
        eventDate: booking.eventDate,
        poNumber: booking.poNumber,
        customerName,
        customerPhone,
        location: booking.location || '-',
        eventLabel: 'PO Event',
        role: 'Fitting Pending',
        attireLabel: 'Fitting form not filled',
        statusLabel,
      })
    }
  }

  const periodLabel = fromDate || toDate
    ? `${fromDate ? formatDate(fromDate) : 'Start'} to ${toDate ? formatDate(toDate) : 'Latest'}`
    : 'All Scheduled Dates'

  let cursorY = drawEditorialBanner(doc, {
    marginX,
    docTitle: 'WARDROBE SCHEDULE REPORT',
    docSubtitle: 'WEDDING ATTIRE ALLOCATION & STOCK STATUS',
    rightMetaTop: periodLabel,
    rightMetaBottom: `${rows.length} schedule entries · Printed ${formatDate(todayIso)}`,
    businessProfile: input.businessProfile,
  })

  const bookedCount = input.attireList.filter((a) => input.effectiveStatus(a) === 'Booked').length
  const inUseCount = input.attireList.filter((a) => input.effectiveStatus(a) === 'Terpakai').length
  const availableCount = input.attireList.filter((a) => input.effectiveStatus(a) === 'Tersedia').length
  const laundryCount = input.attireList.filter((a) => input.effectiveStatus(a) === 'Laundry').length

  cursorY = drawEditorialKpiStrip(doc, cursorY, marginX, contentWidth, [
    { label: 'Total Wardrobe Pieces', value: `${input.attireList.length} Attire`, accent: 'espresso' },
    { label: 'Available Today', value: `${availableCount} Pieces`, accent: 'success' },
    { label: 'Booked (Upcoming)', value: `${bookedCount} Pieces`, accent: 'info' },
    { label: 'In Use (Event Day)', value: `${inUseCount} Pieces`, accent: 'warning' },
    { label: 'In Laundry', value: `${laundryCount} Pieces`, accent: 'danger' },
  ])

  const tableBody = rows.length
    ? rows.map((row, idx) => [
        String(idx + 1),
        '',
        formatDate(row.eventDate),
        row.poNumber,
        row.customerPhone ? `${row.customerName}\n${row.customerPhone}` : row.customerName,
        row.location,
        row.attireLabel,
        `${row.role}\n${row.eventLabel}`,
        row.statusLabel,
      ])
    : [['-', '', '-', '-', 'No wardrobe schedule entries found for the selected date range.', '-', '-', '-', '-']]

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX, bottom: 16 },
    tableWidth: contentWidth,
    head: [['No.', 'Photo', 'Event Date', 'PO No.', 'Customer', 'Venue', 'Selected Attire', 'Role & Session', 'Status']],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      minCellHeight: rows.length ? 15 : 10,
      textColor: PDF_PALETTE.ink,
      lineColor: PDF_PALETTE.border,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: PDF_PALETTE.espressoSoft,
      textColor: PDF_PALETTE.cream,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [251, 249, 245],
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 23 },
      3: { cellWidth: 26, fontStyle: 'bold' },
      4: { cellWidth: 37 },
      5: { cellWidth: 42 },
      6: { cellWidth: 50, fontStyle: 'bold' },
      7: { cellWidth: 44 },
      8: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 8) return
      const val = String(hookData.cell.raw ?? '')
      if (val === 'Booked') {
        hookData.cell.styles.fillColor = PDF_PALETTE.infoBg
        hookData.cell.styles.textColor = PDF_PALETTE.infoFg
      } else if (val === 'In Use') {
        hookData.cell.styles.fillColor = PDF_PALETTE.warningBg
        hookData.cell.styles.textColor = PDF_PALETTE.warningFg
      } else if (val === 'Completed') {
        hookData.cell.styles.fillColor = PDF_PALETTE.successBg
        hookData.cell.styles.textColor = PDF_PALETTE.successFg
      } else if (val.includes('Cancel') || val.includes('Laundry')) {
        hookData.cell.styles.fillColor = PDF_PALETTE.dangerBg
        hookData.cell.styles.textColor = PDF_PALETTE.dangerFg
      }
    },
    didDrawCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 1) return
      const row = rows[hookData.row.index]
      if (!row?.attireId) return
      const img = imageCache.get(row.attireId)
      if (!img) return
      const box = Math.min(hookData.cell.width - 3, hookData.cell.height - 2.4, 12.5)
      const x = hookData.cell.x + (hookData.cell.width - box) / 2
      const y = hookData.cell.y + (hookData.cell.height - box) / 2
      try {
        doc.addImage(img.dataUrl, img.format, x, y, box, box)
      } catch {
        // Ignore broken image frames
      }
    },
  })

  // Section 2: Current Wardrobe Inventory Status with Photos
  let nextY = getAutoTableFinalY(doc, cursorY) + 10
  if (nextY > pageHeight - 50) {
    doc.addPage()
    nextY = 16
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...PDF_PALETTE.ink)
  doc.text('Current Wardrobe Inventory & Upcoming Reservations', marginX, nextY)

  const summaryRows = input.attireList.map((att, idx) => {
    const activeSchedules = input.attireSchedule(att.id)
    const nextSchedule = activeSchedules[0]
    return [
      String(idx + 1),
      '',
      att.code,
      att.name,
      att.category,
      att.size,
      displayAttireStatus(input.effectiveStatus(att)),
      nextSchedule
        ? `${activeSchedules.length} active reservation(s) · Next: ${formatDate(nextSchedule.eventDate)} (${nextSchedule.customerName})`
        : 'No upcoming bookings',
    ]
  })

  autoTable(doc, {
    startY: nextY + 3,
    margin: { left: marginX, right: marginX, bottom: 16 },
    tableWidth: contentWidth,
    head: [['No.', 'Photo', 'Code', 'Attire Name', 'Category', 'Size', 'Status Today', 'Reservation Summary']],
    body: summaryRows.length ? summaryRows : [['-', '', '-', 'No wardrobe attire items yet', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      minCellHeight: input.attireList.length ? 15 : 10,
      textColor: PDF_PALETTE.ink,
      lineColor: PDF_PALETTE.border,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: PDF_PALETTE.espressoSoft,
      textColor: PDF_PALETTE.cream,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [251, 249, 245],
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 23, fontStyle: 'bold' },
      3: { cellWidth: 54, fontStyle: 'bold' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: contentWidth - 170 },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 6) return
      const val = String(hookData.cell.raw ?? '')
      if (val === 'Available') {
        hookData.cell.styles.fillColor = PDF_PALETTE.successBg
        hookData.cell.styles.textColor = PDF_PALETTE.successFg
      } else if (val === 'Booked') {
        hookData.cell.styles.fillColor = PDF_PALETTE.infoBg
        hookData.cell.styles.textColor = PDF_PALETTE.infoFg
      } else if (val === 'In Use') {
        hookData.cell.styles.fillColor = PDF_PALETTE.warningBg
        hookData.cell.styles.textColor = PDF_PALETTE.warningFg
      } else if (val === 'Laundry') {
        hookData.cell.styles.fillColor = PDF_PALETTE.dangerBg
        hookData.cell.styles.textColor = PDF_PALETTE.dangerFg
      }
    },
    didDrawCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 1) return
      const att = input.attireList[hookData.row.index]
      if (!att) return
      const img = imageCache.get(att.id)
      if (!img) return
      const box = Math.min(hookData.cell.width - 3, hookData.cell.height - 2.4, 12.5)
      const x = hookData.cell.x + (hookData.cell.width - box) / 2
      const y = hookData.cell.y + (hookData.cell.height - box) / 2
      try {
        doc.addImage(img.dataUrl, img.format, x, y, box, box)
      } catch {
        // Ignore broken image frames
      }
    },
  })

  drawEditorialFooter(doc, {
    marginX,
    showPageNumbers: true,
  })

  return doc
}

export const downloadWeddingAttireReportPdf = async (input: WeddingAttireReportInput) => {
  const doc = await buildWeddingAttireReportPdfDoc(input)
  const slug = input.fromDate || input.toDate ? `${input.fromDate || 'start'}-to-${input.toDate || 'end'}` : 'all'
  doc.save(`Wardrobe-Schedule-Report-${slug}.pdf`)
}
