/**
 * Compute due_at as `performedOn + days` at 09:00 local time, returned as ISO UTC.
 */
export function computeDueAt(performedOnIso: string, days: number): string {
  const [y, m, d] = performedOnIso.split('-').map(Number)
  const local = new Date(y, (m - 1), d, 9, 0, 0, 0)
  local.setDate(local.getDate() + days)
  return local.toISOString()
}

/**
 * Today as a YYYY-MM-DD string in the device's local timezone.
 * Avoid `new Date().toISOString().slice(0,10)` — that's UTC, which is
 * yesterday for users east of UTC when local time is before the UTC offset.
 */
export function todayLocalIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
