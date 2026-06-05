import { describe, it, expect } from 'vitest'
import { reminderTitle, reminderKindLabel, type ReminderRecordInfo } from '@/lib/reminders'
import type { Reminder } from '@/stores/records'

// Mock translator: echoes the key and named args so assertions are explicit.
const t = (key: string, named?: Record<string, unknown>) =>
  named ? `${key}:${JSON.stringify(named)}` : key

function rem(partial: Partial<Reminder>): Reminder {
  return {
    id: 'r', user_id: 'u', profile_id: 'p', record_id: null,
    kind: 'next_dose', name: null, due_at: '2026-06-01T00:00:00Z',
    sent_at: null, created_at: '2026-05-01T00:00:00Z', ...partial,
  }
}

describe('reminderTitle', () => {
  it('bound vaccination → next dose number', () => {
    const rec: ReminderRecordInfo = { kind: 'vaccination', name: 'Hep B', dose_number: 1, total_doses: 3 }
    expect(reminderTitle(rem({ kind: 'next_dose', record_id: 'x' }), rec, t))
      .toBe('home.nextDoseTitle:{"name":"Hep B","n":2}')
  })

  it('booster (dose >= total) → plain record name, no "dose N"', () => {
    const rec: ReminderRecordInfo = { kind: 'vaccination', name: 'Flu', dose_number: 1, total_doses: 1 }
    expect(reminderTitle(rem({ kind: 'next_dose', record_id: 'x' }), rec, t)).toBe('Flu')
  })

  it('bound follow-up test', () => {
    const rec: ReminderRecordInfo = { kind: 'blood_test', name: 'FBC', dose_number: null, total_doses: null }
    expect(reminderTitle(rem({ kind: 'followup_test', record_id: 'x' }), rec, t))
      .toBe('home.followupTitle:{"name":"FBC"}')
  })

  it('orphan reminder-only (next_dose) uses r.name', () => {
    expect(reminderTitle(rem({ kind: 'next_dose', name: 'Tetanus' }), null, t))
      .toBe('home.nextDoseReminderTitle:{"name":"Tetanus"}')
  })

  it('generic fallback when no record and no name', () => {
    expect(reminderTitle(rem({ kind: 'other', name: null }), null, t)).toBe('home.reminderGeneric')
  })
})

describe('reminderKindLabel', () => {
  it('maps known kinds', () => {
    expect(reminderKindLabel('next_dose', t)).toBe('home.kindNextDose')
    expect(reminderKindLabel('followup_test', t)).toBe('home.kindFollowupTest')
  })
  it('humanizes unknown kinds', () => {
    expect(reminderKindLabel('some_other', t)).toBe('some other')
  })
})
