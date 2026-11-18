import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AttireScheduleEntry, Booking, BusinessProfile, Customer, WeddingAttire, WeddingFittingForm } from '../stores/crm'
import { formatDate } from './format'

interface LoadedImage {
  dataUrl: string
  format: 'JPEG' | 'PNG'
  width: number
  height: number
}

const loadImageForPdf = async (url?: string): Promise<LoadedImage | null> => {
  if (!url) return null
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = url
    })
    const w = loaded.naturalWidth || loaded.width
    const h = loaded.naturalHeight || loaded.height
    if (!w || !h) return null

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(loaded, 0, 0, w, h)
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.9),
      format: 'JPEG',
      width: w,
      height: h,
    }
  } catch {
    return null
  }
}

const measurementGroupMeta = [
  { key: 'bride', label: 'Bride', fields: ['LD', 'LPinggang', 'LPanggul', 'LLenganA', 'LLenganB', 'PLengan', 'Others adj', 'Shoes'] },
  { key: 'groom', label: 'Groom', fields: ['LD', 'LLengan', 'LPerut', 'PLengan', 'PCelana', 'LKepala', 'Others adj', 'Shoes'] },
  { key: 'ibu', label: 'Ibu', fields: ['LD', 'LLengan', 'PLengan'] },
  { key: 'ayah', label: 'Ayah', fields: ['LD', 'PLengan', 'PCelana', 'LKepala', 'Slop'] },
  { key: 'kembarMayangCe', label: 'Kembar Mayang Ce', fields: ['LD', 'Slop'] },
  { key: 'kembarMayangCo', label: 'Kembar Mayang Co', fields: ['LD', 'Slop'] },
  { key: 'terimaTamu', label: 'Terima Tamu', fields: ['List LD'] },
] as const

const vendorMeta = [
  ['deco', 'Deco'],
  ['doc', 'Doc'],
  ['wcc', 'WCC'],
  ['mc', 'MC'],
  ['tenda', 'Tenda'],
  ['seserahan', 'Seserahan'],
  ['wo', 'WO'],
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
}) => {
  const { form, booking, attireList } = params
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

  // Header: strictly Tanggal Acara and Lokasi Acara (supports multi-line long locations without clipping)
  const eventDateText = formatDate(booking.eventDate, { day: '2-digit', month: 'long', year: 'numeric' })
  doc.setFontSize(9.5)
  const locationLines = doc.splitTextToSize(booking.location || '-', contentWidth - 40) as string[]
  const headerBoxHeight = 20 + Math.max(1, locationLines.length) * 5

  doc.setFillColor(248, 245, 240)
  doc.setDrawColor(218, 207, 193)
  doc.roundedRect(marginX, 14, contentWidth, headerBoxHeight, 2.5, 2.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(30, 26, 23)
  doc.text('FORM FITTING PERNIKAHAN', marginX + 5, 21.5)

  doc.setFontSize(9.5)
  doc.setTextColor(65, 82, 74)
  doc.setFont('helvetica', 'bold')
  doc.text('Tanggal Acara:', marginX + 5, 28.5)
  doc.setFont('helvetica', 'normal')
  doc.text(eventDateText, marginX + 34, 28.5)

  doc.setFont('helvetica', 'bold')
  doc.text('Lokasi Acara:', marginX + 5, 34.5)
  doc.setFont('helvetica', 'normal')
  doc.text(locationLines, marginX + 34, 34.5)

  let y = 14 + headerBoxHeight + 6

  // 1. Size Chart — Dedicated columns for every group & every measurement field
  y = drawSectionHeading(y, 'Size Chart (Detail Ukuran)', 30)

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
      head: [[group.label, 'Ukuran']],
      body,
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 1.9,
        textColor: [35, 48, 42],
        lineColor: [223, 231, 227],
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [38, 32, 28],
        textColor: [246, 239, 227],
        fontStyle: 'bold',
        fontSize: 8.2,
      },
      columnStyles: {
        0: { cellWidth: width * 0.48, fontStyle: 'bold', fillColor: [250, 248, 244] },
        1: { cellWidth: width * 0.52, halign: 'right' },
      },
    })
    return getAutoTableFinalY(doc, startY)
  }

  // Render pairs: [Bride, Groom], [Ibu, Ayah], [Kembar Mayang Ce, Kembar Mayang Co]
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

  // Render Terima Tamu full width cleanly
  const terimaTamuGroup = measurementGroupMeta[6]
  y = ensureSpace(y, 18)
  y = renderGroupTable(terimaTamuGroup, marginX, y, contentWidth) + 7

  // 2. Acara & Pemilihan Busana
  y = drawSectionHeading(y, 'Acara & Pilihan Busana', 45)

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
        { label: 'Busana', value: attire ? `${attire.name} (${attire.code} · Size ${attire.size})` : 'Belum dipilih' },
        { label: 'Look', value: detail.look?.trim() || '-' },
        { label: 'Aksesori', value: detail.accessories?.trim() || '-' },
        { label: 'Sepatu', value: detail.shoes?.trim() || '-' },
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

    // Event banner
    doc.setFillColor(38, 32, 28)
    doc.roundedRect(marginX, y, contentWidth, eventHeaderHeight, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(255, 255, 255)
    const titleStr = `Acara ${event.number}${event.name?.trim() ? ` — ${event.name.trim()}` : ''}`
    doc.text(titleStr, marginX + 4, y + 5.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.3)
    doc.setTextColor(225, 238, 231)
    const timePart = `Pukul: ${event.readyTime?.trim() || '-'}`
    const notePart = event.timeNote?.trim() ? `Keterangan Waktu: ${event.timeNote.trim()}` : 'Keterangan Waktu: -'
    const timeLine = doc.splitTextToSize(`${timePart}   |   ${notePart}`, contentWidth - 8)
    doc.text(timeLine[0] ?? timePart, marginX + 4, y + 10.8)

    const cardsY = y + eventHeaderHeight + 2.5

    const drawCoupleCard = (
      x: number,
      info: ReturnType<typeof buildCoupleLines>,
      img: LoadedImage | null,
    ) => {
      doc.setFillColor(251, 252, 251)
      doc.setDrawColor(216, 226, 220)
      doc.roundedRect(x, cardsY, cardW, coupleBodyHeight, 2, 2, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(92, 70, 54)
      doc.text(info.roleLabel, x + 3.5, cardsY + 5.5)

      const boxX = x + 3.5
      const boxY = cardsY + 8
      doc.setFillColor(238, 243, 240)
      doc.setDrawColor(215, 224, 219)
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
        doc.setTextColor(125, 138, 131)
        doc.text('Tanpa Foto', boxX + imgBoxW / 2, boxY + imgBoxH / 2 + 1, { align: 'center' })
      }

      let cursorY = cardsY + 11.5
      const textStartX = x + 3.5 + textXOffset
      doc.setFontSize(8)
      for (const row of info.wrapped) {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(36, 49, 43)
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

  // 3. Keluarga & Tambahan — clean side-by-side grouped tables kept together on one page
  y = drawSectionHeading(y + 2, 'Keluarga & Tambahan (Seragam dan Detail)', 92)

  const domasManggoloRows: Array<[string, string]> = [
    ['Domas (Seragam & Detail)', form.uniforms.domas?.trim() || '-'],
    ['Manggolo (Seragam & Detail)', form.uniforms.manggolo?.trim() || '-'],
    ['Manggolo — Jumlah Blangkon', form.manggoloBlangkon !== null && form.manggoloBlangkon !== undefined ? `${form.manggoloBlangkon} pcs` : '-'],
    ['Manggolo — Jumlah Slop', form.manggoloSlop !== null && form.manggoloSlop !== undefined ? `${form.manggoloSlop} pasang` : '-'],
    ['Softlens', form.uniforms.softlens?.trim() || '-'],
  ]

  const keluargaTambahanRows: Array<[string, string]> = [
    ['Ibu & Besan', form.uniforms.ibuBesan?.trim() || '-'],
    ['Bapak & Besan', form.uniforms.bapakBesan?.trim() || '-'],
    ['Terima Tamu', form.uniforms.terimaTamu?.trim() || '-'],
    ['Melati', form.uniforms.melati?.trim() || '-'],
    ['Henna', form.uniforms.henna?.trim() || '-'],
    ['Tambahan Lain', form.uniforms.tambahan?.trim() || '-'],
  ]

  const famStartY = y
  autoTable(doc, {
    startY: famStartY,
    margin: { left: marginX, right: pageWidth - (marginX + pairTableWidth), bottom: 16 },
    tableWidth: pairTableWidth,
    head: [['Domas, Manggolo & Softlens', 'Keterangan / Jumlah']],
    body: domasManggoloRows,
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.1,
      textColor: [35, 48, 42],
      lineColor: [223, 231, 227],
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [38, 32, 28],
      textColor: [246, 239, 227],
      fontStyle: 'bold',
      fontSize: 8.2,
    },
    columnStyles: {
      0: { cellWidth: pairTableWidth * 0.54, fontStyle: 'bold', fillColor: [250, 248, 244] },
      1: { cellWidth: pairTableWidth * 0.46 },
    },
  })
  const famLeftEndY = getAutoTableFinalY(doc, famStartY)

  autoTable(doc, {
    startY: famStartY,
    margin: { left: marginX + pairTableWidth + pairColGap, right: marginX, bottom: 16 },
    tableWidth: pairTableWidth,
    head: [['Keluarga & Tambahan Lain', 'Keterangan']],
    body: keluargaTambahanRows,
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.1,
      textColor: [35, 48, 42],
      lineColor: [223, 231, 227],
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [38, 32, 28],
      textColor: [246, 239, 227],
      fontStyle: 'bold',
      fontSize: 8.2,
    },
    columnStyles: {
      0: { cellWidth: pairTableWidth * 0.46, fontStyle: 'bold', fillColor: [250, 248, 244] },
      1: { cellWidth: pairTableWidth * 0.54 },
    },
  })
  const famRightEndY = getAutoTableFinalY(doc, famStartY)

  y = Math.max(famLeftEndY, famRightEndY) + 7

  // 4. Vendor Pernikahan — reserve full height so heading never orphans
  y = drawSectionHeading(y, 'Vendor Pernikahan', 76)
  const vendorRows = vendorMeta.map(([key, label]) => [label, form.vendors[key]?.trim() || '-'])

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX, bottom: 16 },
    tableWidth: contentWidth,
    head: [['Kategori Vendor', 'Nama Vendor / Kontak / Catatan']],
    body: vendorRows,
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8.2,
      cellPadding: 2.2,
      textColor: [35, 48, 42],
      lineColor: [223, 231, 227],
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [38, 32, 28],
      textColor: [246, 239, 227],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: 'bold', fillColor: [250, 248, 244] },
      1: { cellWidth: contentWidth - 46 },
    },
  })

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    doc.setTextColor(122, 112, 102)
    doc.text(
      `Hak Cipta © ${new Date().getFullYear()} Daysheet.id`,
      marginX,
      pageHeight - 8,
    )
    doc.text(
      `Halaman ${p} dari ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 8,
      { align: 'right' },
    )
  }

  return doc
}

export const generateWeddingFittingPdf = async (params: {
  form: WeddingFittingForm
  booking: Booking
  attireList: WeddingAttire[]
}) => {
  const doc = await buildWeddingFittingPdfDoc(params)
  doc.save(`Form-Fitting-${params.booking.poNumber}.pdf`)
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

export const buildWeddingAttireReportPdfDoc = (input: WeddingAttireReportInput): jsPDF => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 12
  const contentWidth = pageWidth - marginX * 2

  const brandName = (input.businessProfile?.name || 'AZURA').toUpperCase()
  const brandTagline = (input.businessProfile?.tagline || 'MAKEUP ARTIST').toUpperCase()
  const fromDate = input.fromDate?.trim() || ''
  const toDate = input.toDate?.trim() || ''

  const localNow = new Date()
  const todayIso = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`

  const findCustomer = (id: string) => input.customers.find((c) => c.id === id)
  const findAttire = (id?: string) => (id ? input.attireList.find((a) => a.id === id) : undefined)

  // Collect all attire schedule rows across bookings within the chosen date range
  interface ScheduleRow {
    eventDate: string
    poNumber: string
    customerName: string
    customerPhone: string
    location: string
    eventLabel: string
    role: string
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
        ? 'Batal'
        : booking.eventDate < todayIso
          ? 'Selesai'
          : 'Terpakai'

    if (form?.events?.length) {
      let hasAssignedAttire = false
      for (const [i, ev] of form.events.entries()) {
        const eventTitle = `Acara ${ev.number || i + 1}${ev.name ? ` · ${ev.name}` : ''}${ev.readyTime ? ` (${ev.readyTime})` : ''}`
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
            attireLabel: `${att.name} (${att.code} · Size ${att.size})`,
            statusLabel:
              statusLabel === 'Terpakai' && att.status === 'Laundry'
                ? 'Laundry (Perlu Disiapkan)'
                : statusLabel,
          })
        }
        pushRole(ev.bride?.attireId, 'Bride')
        pushRole(ev.groom?.attireId, 'Groom')
      }

      if (!hasAssignedAttire) {
        rows.push({
          eventDate: booking.eventDate,
          poNumber: booking.poNumber,
          customerName,
          customerPhone,
          location: booking.location || '-',
          eventLabel: form.events[0]?.name || 'Form Fitting Tersimpan',
          role: '-',
          attireLabel: 'Belum memilih busana dari katalog',
          statusLabel: booking.status === 'Dibatalkan' ? 'Batal' : 'Draft Fitting',
        })
      }
    }
  }

  // Header Banner
  doc.setFillColor(30, 26, 23)
  doc.roundedRect(marginX, 11, contentWidth, 24, 2.5, 2.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  doc.setTextColor(250, 248, 244)
  doc.text(`${brandName} ${brandTagline}`, marginX + 5, 19.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(232, 214, 185)
  doc.text('Laporan Jadwal Pemakaian Busana Pernikahan', marginX + 5, 25.8)

  const periodLabel = fromDate || toDate
    ? `Periode: ${fromDate ? formatDate(fromDate) : 'Awal'} s/d ${toDate ? formatDate(toDate) : 'Sekarang'}`
    : 'Periode: Semua Tanggal'
  doc.setTextColor(250, 248, 244)
  doc.setFontSize(8.5)
  doc.text(periodLabel, pageWidth - marginX - 5, 19.5, { align: 'right' })
  doc.text(
    `Total Jadwal Busana: ${rows.length} baris · Dicetak ${formatDate(todayIso)}`,
    pageWidth - marginX - 5,
    25.8,
    { align: 'right' },
  )

  const tableBody = rows.length
    ? rows.map((row, idx) => [
        String(idx + 1),
        formatDate(row.eventDate),
        row.poNumber,
        row.customerPhone ? `${row.customerName}\n${row.customerPhone}` : row.customerName,
        row.location,
        row.attireLabel,
        `${row.role}\n${row.eventLabel}`,
        row.statusLabel,
      ])
    : [['-', '-', '-', 'Tidak ada jadwal pemakaian busana pada rentang tanggal ini.', '-', '-', '-', '-']]

  autoTable(doc, {
    startY: 40,
    margin: { left: marginX, right: marginX, bottom: 16 },
    tableWidth: contentWidth,
    head: [['No.', 'Tanggal Acara', 'No. PO', 'Customer', 'Lokasi Acara', 'Busana Dipakai', 'Peran & Sesi Acara', 'Status']],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.2,
      cellPadding: 2.4,
      textColor: [30, 26, 23],
      lineColor: [224, 218, 208],
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [38, 32, 28],
      textColor: [246, 239, 227],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [251, 249, 245],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 28, fontStyle: 'bold' },
      3: { cellWidth: 40 },
      4: { cellWidth: 44 },
      5: { cellWidth: 52, fontStyle: 'bold' },
      6: { cellWidth: 45 },
      7: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 7) return
      const val = String(hookData.cell.raw ?? '')
      if (val === 'Terpakai') {
        hookData.cell.styles.fillColor = [253, 240, 212]
        hookData.cell.styles.textColor = [156, 98, 22]
      } else if (val === 'Selesai') {
        hookData.cell.styles.fillColor = [225, 243, 232]
        hookData.cell.styles.textColor = [34, 102, 68]
      } else if (val.includes('Batal') || val.includes('Laundry')) {
        hookData.cell.styles.fillColor = [252, 228, 224]
        hookData.cell.styles.textColor = [176, 56, 46]
      }
    },
  })

  // Section 2: Ringkasan Status Inventaris Busana Saat Ini
  let nextY = getAutoTableFinalY(doc, 40) + 10
  if (nextY > pageHeight - 46) {
    doc.addPage()
    nextY = 16
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(30, 26, 23)
  doc.text('Ringkasan Status Inventaris Busana Saat Ini', marginX, nextY)

  const summaryRows = input.attireList.map((att, idx) => {
    const activeSchedules = input.attireSchedule(att.id)
    const nextSchedule = activeSchedules[0]
    return [
      String(idx + 1),
      att.code,
      att.name,
      att.category,
      att.size,
      input.effectiveStatus(att),
      nextSchedule
        ? `${activeSchedules.length} jadwal aktif (Terdekat: ${formatDate(nextSchedule.eventDate)} · ${nextSchedule.customerName})`
        : 'Tidak ada jadwal aktif',
    ]
  })

  autoTable(doc, {
    startY: nextY + 3,
    margin: { left: marginX, right: marginX, bottom: 16 },
    tableWidth: contentWidth,
    head: [['No.', 'Kode', 'Nama Busana', 'Kategori', 'Ukuran', 'Status Saat Ini', 'Jadwal Aktif']],
    body: summaryRows.length ? summaryRows : [['-', '-', 'Belum ada data busana', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.2,
      cellPadding: 2.3,
      textColor: [30, 26, 23],
      lineColor: [224, 218, 208],
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [38, 32, 28],
      textColor: [246, 239, 227],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 54 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 107 },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 5) return
      const val = String(hookData.cell.raw ?? '')
      if (val === 'Tersedia') {
        hookData.cell.styles.fillColor = [225, 243, 232]
        hookData.cell.styles.textColor = [34, 102, 68]
      } else if (val === 'Terpakai') {
        hookData.cell.styles.fillColor = [253, 240, 212]
        hookData.cell.styles.textColor = [156, 98, 22]
      } else if (val === 'Laundry') {
        hookData.cell.styles.fillColor = [252, 228, 224]
        hookData.cell.styles.textColor = [176, 56, 46]
      }
    },
  })

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    doc.setTextColor(122, 112, 102)
    doc.text(`Hak Cipta © ${new Date().getFullYear()} Daysheet.id`, marginX, pageHeight - 7)
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - marginX, pageHeight - 7, { align: 'right' })
  }

  return doc
}

export const downloadWeddingAttireReportPdf = (input: WeddingAttireReportInput) => {
  const doc = buildWeddingAttireReportPdfDoc(input)
  const slug = input.fromDate || input.toDate ? `${input.fromDate || 'awal'}-sd-${input.toDate || 'akhir'}` : 'semua'
  doc.save(`Laporan-Jadwal-Busana-${slug}.pdf`)
}
