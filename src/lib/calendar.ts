export interface MonthCell {
  iso: string // YYYY-MM-DD, a plain calendar date (MY-local date space)
  day: number // 1..31
  inMonth: boolean // false for leading/trailing days from adjacent months
}

/**
 * Build a fixed 6-row (42-cell) month grid for `year`/`month` (month is
 * 1-based), weeks starting on Sunday. Leading cells come from the previous
 * month and trailing cells from the next, so every week is full. Cells carry
 * plain calendar dates with no timezone — callers bucket reminders by MY-local
 * date via `dateInMY()`, so grid cells and buckets share the same date space.
 * UTC arithmetic is used purely as a timezone-free calendar calculator.
 */
export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const startDow = first.getUTCDay() // 0 = Sunday
  const start = new Date(first)
  start.setUTCDate(1 - startDow) // back up to the Sunday on/before the 1st
  const cells: MonthCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ iso, day, inMonth: y === year && m === month })
  }
  return cells
}

/** Group items into a Map keyed by `dateKey(item)`, preserving input order. */
export function bucketByDate<T>(items: T[], dateKey: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = dateKey(item)
    const arr = map.get(k)
    if (arr) arr.push(item)
    else map.set(k, [item])
  }
  return map
}
