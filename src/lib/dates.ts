/**
 * All times in this app are displayed in Malaysia time (UTC+8, no DST),
 * regardless of the user's device timezone. The DB stores timestamps in UTC.
 */
export const MY_TIMEZONE = 'Asia/Kuala_Lumpur'
const MY_OFFSET_HOURS = 8

export type DueUnit = 'd' | 'w' | 'mo' | 'y'

/**
 * Compute due_at as `performedOn + value` of the given unit at 08:00 Malaysia
 * time, returned as a UTC ISO string. Aligns with the first of three daily
 * notification slots (08:00 / 12:00 / 16:00 MY) so pushes can begin the
 * moment the reminder becomes due.
 *
 * Day/week math is constant arithmetic. Month/year math is calendar-anchored
 * with end-of-month clamping: "1 month from Jan 31" lands on Feb 28/29, not
 * Mar 3; "1 year from Feb 29" lands on Feb 28 of the next year.
 */
export function computeDueAt(performedOnIso: string, value: number, unit: DueUnit = 'd'): string {
  const [y, m, d] = performedOnIso.split('-').map(Number)
  // 08:00 MY (UTC+8) == 00:00 UTC.
  const utc = new Date(Date.UTC(y, m - 1, d, 8 - MY_OFFSET_HOURS, 0, 0, 0))
  if (unit === 'd') utc.setUTCDate(utc.getUTCDate() + value)
  else if (unit === 'w') utc.setUTCDate(utc.getUTCDate() + value * 7)
  else if (unit === 'mo') addMonthsClamped(utc, value)
  else addMonthsClamped(utc, value * 12)
  return utc.toISOString()
}

function addMonthsClamped(utc: Date, months: number): void {
  const originalDay = utc.getUTCDate()
  // Park on day 1 to avoid JS's automatic overflow when the target month is
  // shorter than the source day (e.g. Jan 31 + 1mo → would overflow to Mar 3).
  utc.setUTCDate(1)
  utc.setUTCMonth(utc.getUTCMonth() + months)
  // Day 0 of the *next* month is the last day of the current month — works
  // for Feb and leap years without a lookup table.
  const lastDayOfMonth = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth() + 1, 0)).getUTCDate()
  utc.setUTCDate(Math.min(originalDay, lastDayOfMonth))
}

// Cached en-CA formatter for YYYY-MM-DD in MY — hot path (every reminder render).
const MY_ISO_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: MY_TIMEZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
})

/** Today's date as a YYYY-MM-DD string in Malaysia time. */
export function todayLocalIso(): string {
  return MY_ISO_FMT.format(new Date())
}

/** Any date/timestamp as a YYYY-MM-DD string in Malaysia time. */
export function dateInMY(input: string | Date): string {
  return MY_ISO_FMT.format(typeof input === 'string' ? new Date(input) : input)
}

/** Map the i18n locale tag to the matching BCP 47 locale used for formatting. */
export function dateFmtLocale(i18nLocale: string): string {
  return i18nLocale === 'zh' ? 'zh-CN' : i18nLocale === 'ms' ? 'ms-MY' : 'en-GB'
}

function toDate(input: string | Date): Date {
  return typeof input === 'string' ? new Date(input) : input
}

/** "23 April 2026" — always in Malaysia time. */
export function formatDateLong(input: string | Date, i18nLocale: string): string {
  return toDate(input).toLocaleDateString(dateFmtLocale(i18nLocale), {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: MY_TIMEZONE,
  })
}

/** "23 Apr 2026" — always in Malaysia time. */
export function formatDateShort(input: string | Date, i18nLocale: string): string {
  return toDate(input).toLocaleDateString(dateFmtLocale(i18nLocale), {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: MY_TIMEZONE,
  })
}

/** "23 Apr" — always in Malaysia time. */
export function formatMonthDay(input: string | Date, i18nLocale: string): string {
  return toDate(input).toLocaleDateString(dateFmtLocale(i18nLocale), {
    day: '2-digit', month: 'short', timeZone: MY_TIMEZONE,
  })
}
