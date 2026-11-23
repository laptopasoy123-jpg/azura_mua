import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './format'
import type { BusinessProfile, EmployeeRecord } from '../stores/crm'
import { drawEditorialBanner, drawEditorialFooter, drawEditorialKpiStrip, PDF_PALETTE } from './pdfTheme'

export interface JobReportRow {
  poNumber: string
  eventDate: string
  eventTime?: string
  customerName: string
  customerPhone?: string
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
  businessProfile?: BusinessProfile
}

const formatPeriodLabel = (fromDate: string, toDate: string) => {
  if (fromDate && toDate) return `${formatDate(fromDate)} – ${formatDate(toDate)}`
  if (fromDate) return `From ${formatDate(fromDate)}`
  if (toDate) return `Until ${formatDate(toDate)}`
  return 'All Event Dates'
}

export const downloadJobReportPdf = (input: JobReportInput) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  let y = drawEditorialBanner(doc, {
    marginX: margin,
    docTitle: 'TEAM JOB ASSIGNMENTS',
    docSubtitle: input.filterEmployeeName
      ? `STAFF FILTER · ${input.filterEmployeeName.toUpperCase()}`
      : 'EVENT CREW ROSTER & SCHEDULE',
    rightMetaTop: formatPeriodLabel(input.fromDate, input.toDate),
    rightMetaBottom: `${input.rows.length} PO · Printed ${formatDate(new Date().toISOString().slice(0, 10))}`,
    businessProfile: input.businessProfile,
  })

  const assignedCount = input.rows.filter((r) => r.assignedNames.length > 0).length
  const unassignedCount = input.rows.length - assignedCount

  y = drawEditorialKpiStrip(doc, y, margin, contentWidth, [
    { label: 'Total Scheduled Jobs', value: `${input.rows.length} PO`, accent: 'espresso' },
    { label: 'Staff Assigned', value: `${assignedCount} PO`, accent: 'success' },
    { label: 'Pending Assignment', value: `${unassignedCount} PO`, accent: 'warning' },
    { label: 'Active Crew Pool', value: `${input.employees.filter((e) => e.active).length} Staff`, accent: 'info' },
  ])

  const tableBody = input.rows.length
    ? input.rows.map((row, idx) => [
      String(idx + 1),
      `${row.customerName}${row.customerPhone ? `\nTel: ${row.customerPhone}` : ''}`,
      `${formatDate(row.eventDate)}${row.eventTime ? `\nPukul: ${row.eventTime}` : ''}`,
      row.assignedNames.length ? row.assignedNames.map((n, i) => `${i + 1}. ${n}`).join('\n') : 'Unassigned',
      row.notes ? `Catatan: ${row.notes}` : '-',
    ])
    : [['-', 'No job assignments found in the selected date range.', '-', '-', '-']]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 18 },
    tableWidth: contentWidth,
    head: [['NO.', 'ATAS NAMA (CUSTOMER)', 'TANGGAL ACARA', 'TIM YANG BERTUGAS', 'CATATAN']],
    body: tableBody,
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      fontSize: 8.6,
      cellPadding: 3.2,
      textColor: PDF_PALETTE.ink,
      lineColor: [204, 192, 176],
      lineWidth: 0.3,
      valign: 'middle',
    },
    headStyles: {
      fillColor: PDF_PALETTE.espresso,
      textColor: PDF_PALETTE.cream,
      fontStyle: 'bold',
      fontSize: 8.1,
      cellPadding: 3.2,
      lineColor: [90, 78, 66],
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: [251, 248, 243],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 60, fontStyle: 'bold' },
      2: { cellWidth: 42, fontStyle: 'bold' },
      3: { cellWidth: 75, fontStyle: 'bold', fillColor: PDF_PALETTE.ivory },
      4: { cellWidth: contentWidth - 189 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        if (String(hookData.cell.raw) === 'Unassigned') {
          hookData.cell.styles.textColor = PDF_PALETTE.dangerFg
          hookData.cell.styles.fillColor = PDF_PALETTE.dangerBg
        } else {
          hookData.cell.styles.textColor = PDF_PALETTE.espresso
        }
      }
    },
  })

  // Employee Workload Summary Table (focus on name only, without Role)
  if (input.filterEmployeeName !== 'Unassigned') {
    const counts = new Map<string, number>()
    const targetEmployees = input.filterEmployeeName
      ? input.employees.filter((emp) => emp.name === input.filterEmployeeName)
      : input.employees

    for (const emp of targetEmployees) counts.set(emp.name, 0)
    for (const row of input.rows) {
      for (const name of row.assignedNames) {
        if (input.filterEmployeeName && name !== input.filterEmployeeName) continue
        counts.set(name, (counts.get(name) ?? 0) + 1)
      }
    }

    const summaryRows = [...counts.entries()].map(([name, total]) => [
      name,
      `${total} job(s)`,
    ])

    if (summaryRows.length) {
      const lastY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 110
      autoTable(doc, {
        startY: lastY + 8,
        margin: { left: margin, right: margin, bottom: 18 },
        tableWidth: contentWidth,
        head: [[input.filterEmployeeName ? 'NAMA TIM (FILTERED)' : 'REKAP NAMA TIM', 'TOTAL JOB']],
        body: summaryRows,
        theme: 'grid',
        rowPageBreak: 'avoid',
        styles: {
          fontSize: 8.3,
          cellPadding: 2.8,
          textColor: PDF_PALETTE.ink,
          lineColor: [212, 202, 188],
          lineWidth: 0.3,
        },
        alternateRowStyles: {
          fillColor: [252, 250, 246],
        },
        headStyles: {
          fillColor: PDF_PALETTE.espresso,
          textColor: PDF_PALETTE.cream,
          fontStyle: 'bold',
          fontSize: 7.9,
          lineColor: [90, 78, 66],
          lineWidth: 0.3,
        },
        columnStyles: {
          0: { cellWidth: contentWidth - 55, fontStyle: 'bold' },
          1: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
        },
      })
    }
  }

  drawEditorialFooter(doc, {
    marginX: margin,
    showPageNumbers: true,
    framed: true,
  })

  const suffix = input.filterEmployeeName ? `-${input.filterEmployeeName.replace(/\s+/g, '-')}` : ''
  doc.save(`Team-Job-Assignments${suffix}.pdf`)
}
