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
  new Intl.DateTimeFormat('id-ID', options ?? { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(`${value}${value.length === 10 ? 'T00:00:00' : ''}`),
  )

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
