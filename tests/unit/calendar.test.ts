import { describe, it, expect } from 'vitest'
import { buildMonthGrid, bucketByDate } from '@/lib/calendar'
import { dateInMY } from '@/lib/dates'

describe('buildMonthGrid', () => {
  it('returns 42 cells (6 weeks)', () => {
    expect(buildMonthGrid(2026, 2)).toHaveLength(42)
  })

  it('Feb 2026 starts on Sunday with no leading days', () => {
    const cells = buildMonthGrid(2026, 2)
    expect(cells[0]).toEqual({ iso: '2026-02-01', day: 1, inMonth: true })
    expect(cells[27].iso).toBe('2026-02-28')
    expect(cells[28]).toEqual({ iso: '2026-03-01', day: 1, inMonth: false })
  })

  it('in-month cell count equals days in the month', () => {
    expect(buildMonthGrid(2026, 2).filter(c => c.inMonth)).toHaveLength(28) // non-leap
    expect(buildMonthGrid(2024, 2).filter(c => c.inMonth)).toHaveLength(29) // leap
  })

  it('leap-day Feb 29 2024 is present and in-month', () => {
    const leap = buildMonthGrid(2024, 2).find(c => c.iso === '2024-02-29')
    expect(leap?.inMonth).toBe(true)
  })

  it('includes leading days from the previous month when month does not start on Sunday', () => {
    // Feb 1 2024 is a Thursday → 4 leading days from January.
    const cells = buildMonthGrid(2024, 2)
    expect(cells[0]).toEqual({ iso: '2024-01-28', day: 28, inMonth: false })
    expect(cells[4]).toEqual({ iso: '2024-02-01', day: 1, inMonth: true })
  })
})

describe('bucketByDate', () => {
  it('groups items by their MY-local due date across the UTC midnight boundary', () => {
    const rems = [
      { due_at: '2026-02-28T17:00:00Z' }, // +8h => 2026-03-01 01:00 MY
      { due_at: '2026-03-01T02:00:00Z' }, // +8h => 2026-03-01 10:00 MY
      { due_at: '2026-03-02T00:00:00Z' }, // +8h => 2026-03-02 08:00 MY
    ]
    const m = bucketByDate(rems, r => dateInMY(r.due_at))
    expect(m.get('2026-03-01')?.length).toBe(2)
    expect(m.get('2026-03-02')?.length).toBe(1)
  })
})
