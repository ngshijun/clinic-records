import { describe, it, expect } from 'vitest'

export function isSimilar(a: { kind: string; name: string; performed_on: string }, b: { kind: string; name: string; performed_on: string }) {
  return a.kind === b.kind && a.name === b.name && a.performed_on === b.performed_on
}

describe('isSimilar', () => {
  it('matches on exact kind+name+date', () => {
    expect(isSimilar({ kind: 'vaccination', name: 'Hep B', performed_on: '2026-04-22' }, { kind: 'vaccination', name: 'Hep B', performed_on: '2026-04-22' })).toBe(true)
  })
  it('rejects when name differs', () => {
    expect(isSimilar({ kind: 'vaccination', name: 'Hep A', performed_on: '2026-04-22' }, { kind: 'vaccination', name: 'Hep B', performed_on: '2026-04-22' })).toBe(false)
  })
})
