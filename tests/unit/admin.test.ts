import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture insert payloads via a mocked supabase client.
const insertSpy = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (payload: unknown) => {
        insertSpy(payload)
        return { select: () => ({ single: () => Promise.resolve({ data: payload, error: null }) }) }
      },
    }),
  },
}))

import { buildSearchFilter, adminCreateRecord, adminCreateReminder } from '@/lib/admin'

beforeEach(() => insertSpy.mockClear())

describe('buildSearchFilter', () => {
  it('strips PostgREST-breaking characters and builds name/nric ilike', () => {
    expect(buildSearchFilter('a,b%(c)*')).toBe('name.ilike.%abc%,nric.ilike.%abc%')
  })
  it('trims surrounding whitespace', () => {
    expect(buildSearchFilter('  Tan  ')).toBe('name.ilike.%Tan%,nric.ilike.%Tan%')
  })
})

describe('admin insert ownership', () => {
  it('adminCreateRecord stamps the patient owner user_id, never the admin', async () => {
    await adminCreateRecord('owner-123', 'profile-9', {
      kind: 'vaccination', name: 'Hep B', performed_on: '2026-06-01',
      dose_number: 1, total_doses: 3, notes: null,
    })
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'owner-123', profile_id: 'profile-9', kind: 'vaccination',
    }))
  })

  it('adminCreateRecord nulls dose fields for blood tests', async () => {
    await adminCreateRecord('owner-123', 'profile-9', {
      kind: 'blood_test', name: 'FBC', performed_on: '2026-06-01',
      dose_number: 2, total_doses: 4, notes: null,
    })
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      dose_number: null, total_doses: null,
    }))
  })

  it('adminCreateReminder stamps owner user_id and a null record_id', async () => {
    await adminCreateReminder('owner-123', 'profile-9', {
      kind: 'next_dose', name: 'Hep B', due_at: '2026-07-01T00:00:00Z',
    })
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'owner-123', profile_id: 'profile-9', record_id: null, kind: 'next_dose',
    }))
  })
})
