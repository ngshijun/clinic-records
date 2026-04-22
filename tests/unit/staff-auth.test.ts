import { describe, it, expect } from 'vitest'
import { deriveHash, verifyPassword } from '@/lib/staff-auth'

describe('staff-auth', () => {
  it('deriveHash is deterministic for the same password+salt', async () => {
    const a = await deriveHash('clinic-pass-123', 'staticsalt000000')
    const b = await deriveHash('clinic-pass-123', 'staticsalt000000')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
  it('verifyPassword succeeds on match, fails on mismatch', async () => {
    const salt = 'staticsalt000000'
    const hash = await deriveHash('hunter2', salt)
    expect(await verifyPassword('hunter2', salt, hash)).toBe(true)
    expect(await verifyPassword('wrong', salt, hash)).toBe(false)
  })
})
