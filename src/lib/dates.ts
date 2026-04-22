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
