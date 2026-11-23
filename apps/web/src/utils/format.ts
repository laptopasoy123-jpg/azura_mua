export const formatCurrency = (value: number) => {
  const safe = Number.isFinite(value) ? Math.round(value) : 0
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(Math.abs(safe))
  return safe < 0 ? `-Rp. ${formatted}` : `Rp. ${formatted}`
}

export const formatThousands = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return ''
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))
}

export const parseCurrencyInput = (raw: string): number => {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  return Number.parseInt(digits, 10)
}

export const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', options ?? { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(`${value}${value.length === 10 ? 'T00:00:00' : ''}`),
  )

export const formatCodeEventDate = (isoDate: string): string => {
  const clean = (isoDate ?? '').trim().slice(0, 10)
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return clean || '00/00/0000'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export const buildBusinessDocCode = (
  prefix: 'PO' | 'INV' | 'KWT',
  customerName: string,
  eventDate: string,
  existingCodes: Iterable<string> = [],
): string => {
  const cleanName = customerName.trim().replace(/\s+/g, ' ') || 'Customer'
  const datePart = formatCodeEventDate(eventDate)
  const base = `${prefix}-${cleanName}-${datePart}`
  const existing = new Set(Array.from(existingCodes, (code) => code.trim().toUpperCase()))
  if (!existing.has(base.toUpperCase())) return base
  let suffix = 2
  while (existing.has(`${base} (${suffix})`.toUpperCase())) suffix += 1
  return `${base} (${suffix})`
}

export const initials = (value: string) =>
  value
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')

export const uid = () => crypto.randomUUID()

const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']

const terbilangCore = (n: number): string => {
  if (n < 12) return satuan[n] ?? ''
  if (n < 20) return `${terbilangCore(n - 10)} belas`
  if (n < 100) return `${terbilangCore(Math.floor(n / 10))} puluh${n % 10 ? ` ${terbilangCore(n % 10)}` : ''}`
  if (n < 200) return `seratus${n - 100 ? ` ${terbilangCore(n - 100)}` : ''}`
  if (n < 1000) return `${terbilangCore(Math.floor(n / 100))} ratus${n % 100 ? ` ${terbilangCore(n % 100)}` : ''}`
  if (n < 2000) return `seribu${n - 1000 ? ` ${terbilangCore(n - 1000)}` : ''}`
  if (n < 1_000_000) return `${terbilangCore(Math.floor(n / 1000))} ribu${n % 1000 ? ` ${terbilangCore(n % 1000)}` : ''}`
  if (n < 1_000_000_000) return `${terbilangCore(Math.floor(n / 1_000_000))} juta${n % 1_000_000 ? ` ${terbilangCore(n % 1_000_000)}` : ''}`
  if (n < 1_000_000_000_000) return `${terbilangCore(Math.floor(n / 1_000_000_000))} miliar${n % 1_000_000_000 ? ` ${terbilangCore(n % 1_000_000_000)}` : ''}`
  return `${terbilangCore(Math.floor(n / 1_000_000_000_000))} triliun${n % 1_000_000_000_000 ? ` ${terbilangCore(n % 1_000_000_000_000)}` : ''}`
}

export const formatTerbilang = (value: number): string => {
  const safe = Number.isFinite(value) ? Math.round(Math.abs(value)) : 0
  if (safe === 0) return 'Nol rupiah'
  const words = terbilangCore(safe).replace(/\s+/g, ' ').trim()
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} rupiah`
}

const enOnes = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const enTens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

const wordsCoreEn = (n: number): string => {
  if (n < 20) return enOnes[n] ?? ''
  if (n < 100) return `${enTens[Math.floor(n / 10)]}${n % 10 ? `-${enOnes[n % 10]}` : ''}`
  if (n < 1000) return `${enOnes[Math.floor(n / 100)]} hundred${n % 100 ? ` ${wordsCoreEn(n % 100)}` : ''}`
  if (n < 1_000_000) return `${wordsCoreEn(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${wordsCoreEn(n % 1000)}` : ''}`
  if (n < 1_000_000_000) return `${wordsCoreEn(Math.floor(n / 1_000_000))} million${n % 1_000_000 ? ` ${wordsCoreEn(n % 1_000_000)}` : ''}`
  if (n < 1_000_000_000_000) return `${wordsCoreEn(Math.floor(n / 1_000_000_000))} billion${n % 1_000_000_000 ? ` ${wordsCoreEn(n % 1_000_000_000)}` : ''}`
  return `${wordsCoreEn(Math.floor(n / 1_000_000_000_000))} trillion${n % 1_000_000_000_000 ? ` ${wordsCoreEn(n % 1_000_000_000_000)}` : ''}`
}

export const formatAmountWords = (value: number): string => {
  const safe = Number.isFinite(value) ? Math.round(Math.abs(value)) : 0
  if (safe === 0) return 'Zero rupiah'
  const words = wordsCoreEn(safe).replace(/\s+/g, ' ').trim()
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} rupiah`
}

export const displayBookingStatus = (status: string): string => {
  const map: Record<string, string> = {
    Draft: 'Draft',
    Terkonfirmasi: 'Confirmed',
    Selesai: 'Completed',
    Dibatalkan: 'Cancelled',
  }
  return map[status] ?? status
}

export const displayAttireStatus = (status: string): string => {
  const map: Record<string, string> = {
    Tersedia: 'Available',
    Booked: 'Booked',
    Terpakai: 'In Use',
    Laundry: 'Laundry',
  }
  return map[status] ?? status
}

export const displayStockStatus = (status: string): string => {
  const map: Record<string, string> = {
    Aman: 'In Stock',
    Menipis: 'Low Stock',
    Habis: 'Stok Habis',
  }
  return map[status] ?? status
}

export const displayInvoiceStatus = (status: string): string => {
  const map: Record<string, string> = {
    Lunas: 'Paid',
    Sebagian: 'Partial',
    'Belum Dibayar': 'Unpaid',
    'Belum Ada Tagihan': 'Unbilled',
  }
  return map[status] ?? status
}

export const compareAlpha = (a: string, b: string): number =>
  a.trim().localeCompare(b.trim(), 'id', { sensitivity: 'base', numeric: true })

export const sortAlpha = <T>(items: readonly T[], pick: (item: T) => string, dir: 'asc' | 'desc' = 'asc'): T[] =>
  [...items].sort((a, b) => (dir === 'desc' ? -1 : 1) * compareAlpha(pick(a), pick(b)))
