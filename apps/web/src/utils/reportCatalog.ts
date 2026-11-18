export type ReportKey =
  | 'customers'
  | 'bookings'
  | 'orders'
  | 'invoices'
  | 'payments'
  | 'receivables'
  | 'expenses'
  | 'cashflow'
  | 'stock-in'
  | 'stock-out'
  | 'stock-opname'
  | 'inventory'

export interface ReportCatalogEntry {
  key: ReportKey
  title: string
  description: string
}

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  { key: 'customers', title: 'Customer Directory', description: 'Complete list of clients, WhatsApp contact numbers, and booking counts.' },
  { key: 'bookings', title: 'Bookings & PO Schedule', description: 'Event dates, venues, styling types, and Purchase Order statuses.' },
  { key: 'orders', title: 'Orders & Add-on Services', description: 'Detailed breakdown of initial orders and add-on service packages by date.' },
  { key: 'invoices', title: 'Invoices Summary', description: 'Invoice numbers, issue dates, billed totals, paid amounts, and balances.' },
  { key: 'payments', title: 'Payment Receipts', description: 'All received installment transactions with receipt numbers and payment methods.' },
  { key: 'receivables', title: 'Accounts Receivable', description: 'Outstanding PO balances awaiting settlement from clients.' },
  { key: 'expenses', title: 'Expenses & Cancel Payouts', description: 'Detailed PO expenses, studio overhead, and automated cancel refund expenses.' },
  { key: 'cashflow', title: 'Cashflow & Net Summary', description: 'Revenue inflows versus total expenses and net cash position.' },
  { key: 'stock-in', title: 'Inventory Stock In', description: 'Incoming inventory restock batches with dates, PIC, and suppliers.' },
  { key: 'stock-out', title: 'Inventory Stock Out', description: 'Inventory usage records with dates, PIC, and event notes.' },
  { key: 'stock-opname', title: 'Stock Opname & Audits', description: 'Physical count reconciliations versus system stock balances.' },
  { key: 'inventory', title: 'Current Inventory Stock', description: 'Real-time item balances with photos and In Stock / Low Stock / Out of Stock indicators.' },
]
