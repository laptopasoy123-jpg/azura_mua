import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { displayBookingStatus, formatDate } from './format'
import type { BusinessProfile, EmployeeRecord } from '../stores/crm'
import { drawEditorialBanner, drawEditorialFooter, drawEditorialKpiStrip, PDF_PALETTE } from './pdfTheme'

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
  const margin = 12
  const contentWidth = pageWidth - margin * 2

  let y = drawEditorialBanner(doc, {
    marginX: margin,
    docTitle: 'TEAM JOB ASSIGNMENTS',
    docSubtitle: input.filterEmployeeName
      ? `STAFF FILTER · ${input.filterEmployeeName.toUpperCase()}`
      : 'EVENT CREW ROSTER & SCHEDULE',
    rightMetaTop: formatPeriodLabel(input.fromDate, input.toDate),
    rightMetaBottom: `${input.rows.length} POs · Printed ${formatDate(new Date().toISOString().slice(0, 10))}`,
    businessProfile: input.businessProfile,
  })

  const assignedCount = input.rows.filter((r) => r.assignedNames.length > 0).length
  const unassignedCount = input.rows.length - assignedCount

  y = drawEditorialKpiStrip(doc, y, margin, contentWidth, [
    { label: 'Total Scheduled Jobs', value: `${input.rows.length} POs`, accent: 'espresso' },
    { label: 'Staff Assigned', value: `${assignedCount} POs`, accent: 'success' },
    { label: 'Pending Assignment', value: `${unassignedCount} POs`, accent: 'warning' },
    { label: 'Active Crew Pool', value: `${input.employees.filter((e) => e.active).length} Staff`, accent: 'info' },
  ])

  const tableBody = input.rows.length
    ? input.rows.map((row, idx) => [
        String(idx + 1),
        `${formatDate(row.eventDate)}${row.eventTime ? `\nAt ${row.eventTime}` : ''}`,
        `${row.poNumber}\n(${displayBookingStatus(row.status)})`,
        `${row.customerName}${row.stylingType ? `\nStyling: ${row.stylingType}` : ''}`,
        row.location || '-',
        row.servicesSummary || '-',
        row.assignedNames.length ? row.assignedNames.join(', ') : 'Unassigned',
        row.notes || '-',
      ])
    : [['-', '-', '-', 'No job assignments found in the selected date range.', '-', '-', '-', '-']]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 16 },
    head: [['No.', 'Event Date', 'PO No.', 'Customer & Styling', 'Event Venue', 'Ordered Services', 'Assigned Staff', 'Notes']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8.2,
      cellPadding: 2.6,
      textColor: PDF_PALETTE.ink,
      lineColor: PDF_PALETTE.border,
      valign: 'top',
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
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 27, fontStyle: 'bold' },
      3: { cellWidth: 38 },
      4: { cellWidth: 44 },
      5: { cellWidth: 52 },
      6: { cellWidth: 42, fontStyle: 'bold' },
      7: { cellWidth: 28 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 6 && String(hookData.cell.raw) === 'Unassigned') {
        hookData.cell.styles.textColor = PDF_PALETTE.dangerFg
      }
    },
  })

  // Employee Workload Summary Table (scoped strictly to the selected employee when filtered)
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
      input.employees.find((e) => e.name === name)?.role ?? 'MUA / Team',
      `${total} job(s)`,
    ])

    if (summaryRows.length) {
      const lastY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 110
      autoTable(doc, {
        startY: lastY + 8,
        margin: { left: margin, right: margin, bottom: 16 },
        head: [[input.filterEmployeeName ? 'Selected Staff Summary' : 'Staff Workload Summary (Filtered Period)', 'Role', 'Total POs Assigned']],
        body: summaryRows,
        theme: 'plain',
        styles: {
          fontSize: 8.2,
          cellPadding: 2.6,
          textColor: PDF_PALETTE.ink,
          lineColor: PDF_PALETTE.border,
          lineWidth: { top: 0, right: 0, bottom: 0.25, left: 0 },
        },
        headStyles: { fillColor: PDF_PALETTE.espresso, textColor: PDF_PALETTE.cream, fontStyle: 'bold', lineWidth: 0 },
        columnStyles: { 0: { cellWidth: 82, fontStyle: 'bold' }, 1: { cellWidth: 82 }, 2: { cellWidth: 45, halign: 'right' } },
      })
    }
  }

  drawEditorialFooter(doc, {
    marginX: margin,
    showPageNumbers: true,
  })

  const suffix = input.filterEmployeeName ? `-${input.filterEmployeeName.replace(/\s+/g, '-')}` : ''
  doc.save(`Team-Job-Assignments${suffix}.pdf`)
}
