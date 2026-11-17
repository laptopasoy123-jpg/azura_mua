export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)

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
