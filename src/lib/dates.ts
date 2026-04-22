/**
 * All times in this app are displayed in Malaysia time (UTC+8, no DST),
 * regardless of the user's device timezone. The DB stores timestamps in UTC.
 */
export const MY_TIMEZONE = 'Asia/Kuala_Lumpur'
const MY_OFFSET_HOURS = 8

/**
 * Compute due_at as `performedOn + days` at 09:00 Malaysia time, returned
 * as a UTC ISO string. Uses UTC-based construction so the result is
 * identical regardless of the device's timezone.
 */
export function computeDueAt(performedOnIso: string, days: number): string {
  const [y, m, d] = performedOnIso.split('-').map(Number)
  // 09:00 MY (UTC+8) == 01:00 UTC.
  const utc = new Date(Date.UTC(y, m - 1, d, 9 - MY_OFFSET_HOURS, 0, 0, 0))
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString()
}

/**
 * Today's date as a YYYY-MM-DD string in Malaysia time, regardless of
 * device timezone. `Intl.DateTimeFormat('en-CA', ...)` emits ISO date
 * format; the `timeZone` option forces MY.
 */
export function todayLocalIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MY_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}
