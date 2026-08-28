const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const usdCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "+$1,240" / "-$310". The sign is load-bearing: it is the non-color encoding of polarity. */
export function fmtSignedCurrency(value: number, cents = false): string {
  const sign = value < 0 ? '-' : '+'
  return `${sign}${(cents ? usdCents : usd).format(Math.abs(value))}`
}

/** "+24.50" / "-8.25" index points, always signed. */
export function fmtSignedPoints(value: number): string {
  const sign = value < 0 ? '-' : '+'
  return `${sign}${Math.abs(value).toFixed(2)}`
}

/** "$1,240" — no sign, for magnitudes that cannot be negative. */
export function fmtCurrency(value: number): string {
  return usd.format(Math.abs(value))
}

export function fmtNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function fmtPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** 74 -> "1h 14m", 22 -> "22m", 0.5 -> "30s" */
export function fmtDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

/** "2026-07-14" -> "Tue, Jul 14" */
export function fmtDayLabel(isoDate: string): string {
  const d = parseISODate(isoDate)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "2026-07-14" -> "Jul 14" */
export function fmtShortDate(isoDate: string): string {
  const d = parseISODate(isoDate)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Parse a yyyy-mm-dd key as a *local* date, avoiding the UTC-shift footgun. */
export function parseISODate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Local Date -> yyyy-mm-dd key. */
export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
