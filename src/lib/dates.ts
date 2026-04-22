/**
 * Compute due_at as `performedOn + days` at 09:00 local time, returned as ISO UTC.
 */
export function computeDueAt(performedOnIso: string, days: number): string {
  const [y, m, d] = performedOnIso.split('-').map(Number)
  const local = new Date(y, (m - 1), d, 9, 0, 0, 0)
  local.setDate(local.getDate() + days)
  return local.toISOString()
}
