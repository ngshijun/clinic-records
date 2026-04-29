import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { isValidNric, normalizeNric, deriveDobFromNric } from '@/lib/nric'

describe('normalizeNric', () => {
  it('strips hyphens and whitespace', () => {
    expect(normalizeNric(' 900101-08-5678 ')).toBe('900101085678')
    expect(normalizeNric('900101085678')).toBe('900101085678')
  })
})

describe('isValidNric', () => {
  it('accepts hyphenated input but treats it as 12 digits', () => {
    expect(isValidNric('900101-08-5678')).toBe(true)
    expect(isValidNric('900101085678')).toBe(true)
  })
  it('rejects wrong length and non-digits', () => {
    expect(isValidNric('900101-08-567')).toBe(false)
    expect(isValidNric('90010108567X')).toBe(false)
    expect(isValidNric('')).toBe(false)
  })
})

describe('deriveDobFromNric', () => {
  beforeAll(() => {
    // Pin "now" so the rolling pivot is deterministic. With current year
    // 2026, YY <= 26 maps to 2000+, YY > 26 maps to 1900+.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-30T00:00:00Z'))
  })
  afterAll(() => { vi.useRealTimers() })

  it('parses a 1990 birthdate (YY=90 → 1990)', () => {
    expect(deriveDobFromNric('900101-08-5678')).toBe('1990-01-01')
  })
  it('parses a 2010 birthdate (YY=10 ≤ 26 → 2010)', () => {
    expect(deriveDobFromNric('100315-14-1234')).toBe('2010-03-15')
  })
  it('parses YY exactly at the pivot (YY=26 → 2026)', () => {
    expect(deriveDobFromNric('260101-08-5678')).toBe('2026-01-01')
  })
  it('parses YY just past the pivot (YY=27 → 1927)', () => {
    expect(deriveDobFromNric('270101-08-5678')).toBe('1927-01-01')
  })
  it('rejects malformed inputs', () => {
    expect(deriveDobFromNric('abc')).toBeNull()
    expect(deriveDobFromNric('12345')).toBeNull()
  })
  it('rejects invalid month/day', () => {
    expect(deriveDobFromNric('991301085678')).toBeNull()
    expect(deriveDobFromNric('990230085678')).toBeNull() // Feb 30
  })
})
