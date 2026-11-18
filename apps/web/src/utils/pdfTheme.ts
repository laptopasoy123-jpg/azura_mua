import jsPDF from 'jspdf'
import type { BusinessProfile } from '../stores/crm'
import { formatDate } from './format'

export interface LoadedPdfImage {
  dataUrl: string
  format: 'JPEG' | 'PNG'
  width: number
  height: number
}

export const PDF_PALETTE = {
  espresso: [33, 29, 26] as [number, number, number],
  espressoSoft: [48, 41, 35] as [number, number, number],
  gold: [196, 167, 125] as [number, number, number],
  goldDark: [140, 109, 69] as [number, number, number],
  cream: [246, 239, 227] as [number, number, number],
  ivory: [250, 248, 244] as [number, number, number],
  linen: [243, 236, 224] as [number, number, number],
  border: [226, 218, 206] as [number, number, number],
  ink: [33, 29, 26] as [number, number, number],
  muted: [110, 99, 88] as [number, number, number],
  successBg: [225, 243, 232] as [number, number, number],
  successFg: [31, 102, 66] as [number, number, number],
  warningBg: [253, 240, 212] as [number, number, number],
  warningFg: [152, 92, 20] as [number, number, number],
  dangerBg: [252, 228, 224] as [number, number, number],
  dangerFg: [170, 52, 44] as [number, number, number],
  infoBg: [232, 241, 249] as [number, number, number],
  infoFg: [49, 92, 134] as [number, number, number],
}

export const loadImageForPdf = async (url?: string): Promise<LoadedPdfImage | null> => {
  if (!url) return null
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Image timeout')), 2500)
      img.onload = () => {
        clearTimeout(timer)
        resolve(img)
      }
      img.onerror = () => {
        clearTimeout(timer)
        reject(new Error('Image load failed'))
      }
      img.src = url
    })
    const w = loaded.naturalWidth || loaded.width
    const h = loaded.naturalHeight || loaded.height
    if (!w || !h) return null

    const maxDim = 260
    const ratio = Math.min(1, maxDim / Math.max(w, h))
    const targetW = Math.max(1, Math.round(w * ratio))
    const targetH = Math.max(1, Math.round(h * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetW, targetH)
    ctx.drawImage(loaded, 0, 0, targetW, targetH)
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.88),
      format: 'JPEG',
      width: targetW,
      height: targetH,
    }
  } catch {
    return null
  }
}

export const drawEditorialBanner = (
  doc: jsPDF,
  opts: {
    marginX: number
    docTitle: string
    docSubtitle: string
    rightMetaTop?: string
    rightMetaBottom?: string
    businessProfile?: Partial<BusinessProfile>
  },
): number => {
  const { marginX, docTitle, docSubtitle, rightMetaTop, rightMetaBottom, businessProfile } = opts
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - marginX * 2
  const bannerY = 12
  const bannerH = 29

  const brandName = (businessProfile?.name || 'AZURA').toUpperCase()
  const brandTagline = (businessProfile?.tagline || 'MAKEUP ARTIST').toUpperCase()
  const brandAddress = businessProfile?.address || 'South Jakarta, Indonesia'
  const brandEmail = businessProfile?.email || 'hello@azuramakeup.id'
  const brandPhone = businessProfile?.phone || '0812 9000 2026'

  doc.setFillColor(...PDF_PALETTE.espresso)
  doc.roundedRect(marginX, bannerY, contentWidth, bannerH, 3, 3, 'F')

  // Top & bottom champagne gold accents
  doc.setFillColor(...PDF_PALETTE.gold)
  doc.rect(marginX + 6, bannerY, contentWidth - 12, 1.1, 'F')
  doc.rect(marginX, bannerY + bannerH - 1, contentWidth, 1, 'F')

  // Logo badge or initial monogram
  const logoX = marginX + 6
  const logoY = bannerY + 6.5
  const logoSize = 15.5
  let renderedLogo = false

  if (businessProfile?.logoUrl && businessProfile.logoUrl.startsWith('data:image/')) {
    try {
      const fmt = businessProfile.logoUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.setFillColor(...PDF_PALETTE.ivory)
      doc.roundedRect(logoX, logoY, logoSize, logoSize, 2.2, 2.2, 'F')
      doc.addImage(businessProfile.logoUrl, fmt, logoX + 0.8, logoY + 0.8, logoSize - 1.6, logoSize - 1.6)
      renderedLogo = true
    } catch {
      renderedLogo = false
    }
  }

  if (!renderedLogo) {
    doc.setFillColor(...PDF_PALETTE.cream)
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 2.2, 2.2, 'F')
    doc.setDrawColor(...PDF_PALETTE.gold)
    doc.setLineWidth(0.35)
    doc.roundedRect(logoX + 0.8, logoY + 0.8, logoSize - 1.6, logoSize - 1.6, 1.6, 1.6, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...PDF_PALETTE.ink)
    doc.text(brandName.slice(0, 1), logoX + logoSize / 2, logoY + 10.6, { align: 'center' })
  }

  const textX = logoX + logoSize + 4.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.setTextColor(...PDF_PALETTE.ivory)
  doc.text(`${brandName} ${brandTagline}`, textX, bannerY + 11.2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.8)
  doc.setTextColor(214, 200, 180)
  doc.text(`${brandAddress}  |  ${brandEmail}  |  ${brandPhone}`, textX, bannerY + 17.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...PDF_PALETTE.gold)
  doc.text(docSubtitle, textX, bannerY + 23.2)

  // Right document metadata
  const rightX = pageWidth - marginX - 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...PDF_PALETTE.cream)
  doc.text(docTitle, rightX, bannerY + 11.2, { align: 'right' })

  if (rightMetaTop) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.8)
    doc.setTextColor(232, 214, 185)
    doc.text(rightMetaTop, rightX, bannerY + 17.5, { align: 'right' })
  }

  if (rightMetaBottom) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    doc.setTextColor(196, 184, 170)
    doc.text(rightMetaBottom, rightX, bannerY + 23.2, { align: 'right' })
  }

  return bannerY + bannerH + 5.5
}

export interface KpiCardItem {
  label: string
  value: string
  accent?: 'espresso' | 'success' | 'warning' | 'danger' | 'info'
}

export const drawEditorialKpiStrip = (
  doc: jsPDF,
  startY: number,
  marginX: number,
  contentWidth: number,
  items: KpiCardItem[],
): number => {
  if (!items.length) return startY
  const gap = 3.5
  const cardW = (contentWidth - gap * (items.length - 1)) / items.length
  const cardH = 17.5

  items.forEach((item, idx) => {
    const x = marginX + idx * (cardW + gap)
    doc.setFillColor(...PDF_PALETTE.ivory)
    doc.setDrawColor(...PDF_PALETTE.border)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD')

    const barColor =
      item.accent === 'success' ? PDF_PALETTE.successFg
        : item.accent === 'warning' ? PDF_PALETTE.warningFg
          : item.accent === 'danger' ? PDF_PALETTE.dangerFg
            : item.accent === 'info' ? PDF_PALETTE.infoFg
              : PDF_PALETTE.goldDark
    doc.setFillColor(...barColor)
    doc.roundedRect(x, startY + 2.5, 1.5, cardH - 5, 0.7, 0.7, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...PDF_PALETTE.muted)
    doc.text(item.label.toUpperCase(), x + 4.5, startY + 6.2)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...PDF_PALETTE.ink)
    const valStr = doc.splitTextToSize(item.value, cardW - 7)[0] ?? item.value
    doc.text(valStr, x + 4.5, startY + 13.5)
  })

  return startY + cardH + 5
}

export const drawEditorialPageFrame = (doc: jsPDF) => {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  // Crisp outer champagne-gold stationery frame + inner perimeter border ("pager")
  doc.setDrawColor(...PDF_PALETTE.goldDark)
  doc.setLineWidth(0.55)
  doc.roundedRect(9, 6.5, pageWidth - 18, pageHeight - 13, 3.2, 3.2, 'S')

  doc.setDrawColor(214, 203, 187)
  doc.setLineWidth(0.3)
  doc.roundedRect(10.6, 8.1, pageWidth - 21.2, pageHeight - 16.2, 2.5, 2.5, 'S')
}

export const drawEditorialFooter = (
  doc: jsPDF,
  opts: {
    marginX: number
    note?: string
    contactLine?: string
    showPageNumbers?: boolean
    framed?: boolean
  },
) => {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const totalPages = doc.getNumberOfPages()

  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p)
    if (opts.framed) {
      drawEditorialPageFrame(doc)
    }

    const fy = opts.note ? pageHeight - 20.5 : pageHeight - 14.5
    doc.setDrawColor(...PDF_PALETTE.border)
    doc.setLineWidth(0.35)
    doc.line(opts.marginX, fy, pageWidth - opts.marginX, fy)

    if (opts.note) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.8)
      doc.setTextColor(88, 78, 68)
      const noteLine = doc.splitTextToSize(opts.note, pageWidth - opts.marginX * 2)[0] ?? opts.note
      doc.text(noteLine, opts.marginX, fy + 4.8)
    }

    const line2Y = opts.note ? fy + 9.8 : fy + 4.8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(122, 112, 102)
    doc.text(opts.contactLine || `Generated ${formatDate(new Date().toISOString().slice(0, 10))}`, opts.marginX, line2Y)

    const rightLabel = opts.showPageNumbers
      ? `Copyright © ${new Date().getFullYear()} Daysheet.id  |  Page ${p} of ${totalPages}`
      : `Copyright © ${new Date().getFullYear()} Daysheet.id`
    doc.setFont('helvetica', 'bold')
    doc.text(rightLabel, pageWidth - opts.marginX, line2Y, { align: 'right' })
  }
}
