import { describe, it, expect } from 'vitest'
import { computeDueAt } from '@/lib/dates'

describe('computeDueAt', () => {
  it('adds N days and sets 09:00 in the local timezone', () => {
    const result = computeDueAt('2026-04-22', 30)
    const d = new Date(result)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4)       // May (0-indexed)
    expect(d.getDate()).toBe(22)
    expect(d.getHours()).toBe(9)
    expect(d.getMinutes()).toBe(0)
  })

  it('returns an ISO string in UTC', () => {
    const result = computeDueAt('2026-01-01', 0)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
  })
})
