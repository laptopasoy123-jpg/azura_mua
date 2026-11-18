import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './format'
import type { EmployeeRecord } from '../stores/crm'

export interface JobReportRow {
  poNumber: string
  eventDate: string
  eventTime?: string
  customerName: string
  stylingType?: string
  location: string
  servicesSummary: string
  assignedNames: string[]
  notes?: string
  status: string
}

export interface JobReportInput {
  fromDate: string
  toDate: string
  filterEmployeeName?: string
  rows: JobReportRow[]
  employees: EmployeeRecord[]
}

const formatPeriodLabel = (fromDate: string, toDate: string) => {
  if (fromDate && toDate) return `${formatDate(fromDate)} s.d. ${formatDate(toDate)}`
  if (fromDate) return `Mulai ${formatDate(fromDate)}`
  if (toDate) return `Sampai ${formatDate(toDate)}`
  return 'Semua Tanggal Acara'
}

export const downloadJobReportPdf = (input: JobReportInput) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 12
  const contentWidth = pageWidth - margin * 2

  // Charcoal Espresso header aligned with Azura logo
  doc.setFillColor(30, 26, 23)
  doc.rect(margin, 10, contentWidth, 24, 'F')

  doc.setTextColor(250, 248, 244)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('AZURA MAKEUP ARTIST', margin + 5, 19)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(232, 214, 185)
  doc.text('Laporan Penugasan Job Karyawan', margin + 5, 25.5)

  doc.setTextColor(250, 248, 244)
  doc.setFontSize(8.5)
  doc.text(`Periode: ${formatPeriodLabel(input.fromDate, input.toDate)}`, pageWidth - margin - 5, 18.5, { align: 'right' })
  if (input.filterEmployeeName) {
    doc.text(`Filter Karyawan: ${input.filterEmployeeName}`, pageWidth - margin - 5, 23.5, { align: 'right' })
  }
  doc.text(`Total Job: ${input.rows.length} PO · Dicetak ${formatDate(new Date().toISOString().slice(0, 10))}`, pageWidth - margin - 5, 28.5, { align: 'right' })

  const tableBody = input.rows.length
    ? input.rows.map((row, idx) => [
        String(idx + 1),
        `${formatDate(row.eventDate)}${row.eventTime ? `\nPukul ${row.eventTime}` : ''}`,
        `${row.poNumber}\n(${row.status})`,
        `${row.customerName}${row.stylingType ? `\nPenataan: ${row.stylingType}` : ''}`,
        row.location || '-',
        row.servicesSummary || '-',
        row.assignedNames.length ? row.assignedNames.join(', ') : 'Belum ditugaskan',
        row.notes || '-',
      ])
    : [['-', '-', '-', 'Tidak ada data job pada rentang tanggal yang dipilih.', '-', '-', '-', '-']]

  autoTable(doc, {
    startY: 38,
    margin: { left: margin, right: margin },
    head: [['No.', 'Tanggal Acara', 'No. PO', 'Customer & Penataan', 'Lokasi Acara', 'Layanan Pesanan', 'Pemegang Job', 'Catatan']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8.2,
      cellPadding: 2.6,
      textColor: [30, 26, 23],
      lineColor: [223, 214, 200],
      valign: 'top',
    },
    headStyles: {
      fillColor: [38, 32, 28],
      textColor: [250, 248, 244],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 247, 242],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 27 },
      3: { cellWidth: 38 },
      4: { cellWidth: 44 },
      5: { cellWidth: 48 },
      6: { cellWidth: 42 },
      7: { cellWidth: 32 },
    },
  })

  // Employee workload summary section
  const lastY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 60
  const countMap = new Map<string, number>()
  for (const row of input.rows) {
    for (const name of row.assignedNames) {
      countMap.set(name, (countMap.get(name) ?? 0) + 1)
    }
  }
  const summaryRows = input.employees.map((emp, idx) => [
    String(idx + 1),
    emp.name,
    emp.role,
    `${countMap.get(emp.name) ?? 0} job`,
  ])

  const nextStartY = lastY + 8 > doc.internal.pageSize.getHeight() - 36 ? 16 : lastY + 8
  if (nextStartY === 16) doc.addPage()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(30, 26, 23)
  doc.text('Rekap Penugasan per Karyawan (Periode Terpilih)', margin, nextStartY)

  autoTable(doc, {
    startY: nextStartY + 3,
    margin: { left: margin, right: margin },
    tableWidth: 165,
    head: [['No.', 'Nama Karyawan', 'Peran / Spesialisasi', 'Jumlah Job PO']],
    body: summaryRows.length ? summaryRows : [['-', 'Belum ada karyawan terdaftar', '-', '0 job']],
    theme: 'grid',
    styles: {
      fontSize: 8.3,
      cellPadding: 2.5,
      textColor: [30, 26, 23],
      lineColor: [223, 214, 200],
    },
    headStyles: {
      fillColor: [246, 239, 227],
      textColor: [30, 26, 23],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 63 },
      3: { cellWidth: 35, halign: 'right' },
    },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFontSize(7.8)
    doc.setTextColor(122, 112, 102)
    doc.text(
      `Hak Cipta © ${new Date().getFullYear()} Daysheet.id`,
      margin,
      doc.internal.pageSize.getHeight() - 7,
    )
    doc.text(
      `Azura Makeup Artist — Halaman ${i} dari ${pageCount}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 7,
      { align: 'right' },
    )
  }

  const slug = input.fromDate || input.toDate ? `${input.fromDate || 'awal'}-sd-${input.toDate || 'akhir'}` : 'semua'
  doc.save(`Laporan-Job-Karyawan-${slug}.pdf`)
}
