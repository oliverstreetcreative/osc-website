/**
 * Format a monetary amount as USD currency.
 * Handles numbers, numeric strings, Decimal-like objects, and null/undefined.
 */
export function formatCurrency(amount: any): string {
  if (amount == null) return '$0.00'

  let numeric = 0
  if (typeof amount === 'number') {
    numeric = amount
  } else if (typeof amount === 'string') {
    numeric = Number(amount)
  } else if (typeof amount === 'object' && 'toString' in amount) {
    numeric = Number(amount.toString())
  }

  if (!Number.isFinite(numeric)) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric)
}

/**
 * Format a date value for display (e.g. "Apr 14, 2026").
 */
export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return ''
  try {
    const date = dateStr instanceof Date ? dateStr : new Date(dateStr)
    if (Number.isNaN(date.getTime())) return String(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return String(dateStr)
  }
}

/**
 * Format a duration in seconds as M:SS or H:MM:SS.
 */
export function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Map a review/status string to a Tailwind-compatible CSS class suffix.
 */
export function statusVariant(
  status: string | null | undefined
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status ?? '').toLowerCase().replace(/\s+/g, '-')
  if (s === 'approved' || s === 'completed' || s === 'paid') return 'default'
  if (s === 'pending-review' || s === 'in-review') return 'secondary'
  if (s === 'changes-requested' || s === 'overdue') return 'destructive'
  return 'outline'
}

/**
 * Inline CSS color for a status badge (used where Shadcn variant isn't enough).
 */
export function statusColor(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase().replace(/\s+/g, '-')
  if (s === 'approved' || s === 'completed' || s === 'paid') return 'var(--green)'
  if (s === 'pending-review' || s === 'in-review') return 'var(--gold)'
  if (s === 'changes-requested' || s === 'overdue') return 'var(--red)'
  return 'var(--quiet)'
}
