import { describe, it, expect } from 'vitest'
import { computeDueAt } from '@/lib/dates'

// Asserting on UTC components (00:00 UTC == 08:00 MY) keeps the tests
// timezone-independent regardless of where Vitest runs.
function ymdUtc(iso: string): [number, number, number] {
  const d = new Date(iso)
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
}

describe('computeDueAt', () => {
  it('returns an ISO string in UTC at 00:00 (08:00 MY)', () => {
    const result = computeDueAt('2026-01-01', 0)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d+)?Z$/)
  })

  describe('days', () => {
    it('adds N days', () => {
      expect(ymdUtc(computeDueAt('2026-04-22', 30))).toEqual([2026, 5, 22])
    })
    it('zero days returns the same date', () => {
      expect(ymdUtc(computeDueAt('2026-04-22', 0))).toEqual([2026, 4, 22])
    })
  })

  describe('weeks', () => {
    it('adds N * 7 days', () => {
      expect(ymdUtc(computeDueAt('2026-04-22', 2, 'w'))).toEqual([2026, 5, 6])
    })
  })

  describe('months', () => {
    it('basic month advance', () => {
      expect(ymdUtc(computeDueAt('2026-04-15', 1, 'mo'))).toEqual([2026, 5, 15])
    })
    it('Jan 31 + 1 month clamps to Feb 28 in non-leap year', () => {
      expect(ymdUtc(computeDueAt('2025-01-31', 1, 'mo'))).toEqual([2025, 2, 28])
    })
    it('Jan 31 + 1 month clamps to Feb 29 in leap year', () => {
      expect(ymdUtc(computeDueAt('2024-01-31', 1, 'mo'))).toEqual([2024, 2, 29])
    })
    it('Mar 31 + 1 month clamps to Apr 30', () => {
      expect(ymdUtc(computeDueAt('2026-03-31', 1, 'mo'))).toEqual([2026, 4, 30])
    })
    it('Dec 31 + 2 months crosses year and clamps to Feb 28', () => {
      expect(ymdUtc(computeDueAt('2026-12-31', 2, 'mo'))).toEqual([2027, 2, 28])
    })
    it('6 months later preserves the day when the target month is long enough', () => {
      expect(ymdUtc(computeDueAt('2026-04-22', 6, 'mo'))).toEqual([2026, 10, 22])
    })
  })

  describe('years', () => {
    it('basic year advance preserves calendar date', () => {
      expect(ymdUtc(computeDueAt('2026-04-22', 1, 'y'))).toEqual([2027, 4, 22])
    })
    it('Feb 29 + 1 year clamps to Feb 28 in non-leap year', () => {
      expect(ymdUtc(computeDueAt('2024-02-29', 1, 'y'))).toEqual([2025, 2, 28])
    })
    it('Feb 29 + 4 years lands on next leap day', () => {
      expect(ymdUtc(computeDueAt('2024-02-29', 4, 'y'))).toEqual([2028, 2, 29])
    })
  })
})
