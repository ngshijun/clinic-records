import type { Reminder } from '@/stores/records'

/** The subset of a record needed to title a reminder (structural). */
export interface ReminderRecordInfo {
  kind: string
  name: string
  dose_number: number | null
  total_doses: number | null
}

export type Translate = (key: string, named?: Record<string, unknown>) => string

/**
 * Human title for a reminder. If `rec` is the linked record, derive the next
 * dose / follow-up wording; otherwise fall back to the reminder's own `name`
 * (reminder-only entries), then a generic label. Extracted verbatim from
 * Home.vue so the admin calendar and detail views share one source of truth.
 */
export function reminderTitle(r: Reminder, rec: ReminderRecordInfo | null | undefined, t: Translate): string {
  if (rec) {
    if (r.kind === 'next_dose' && rec.kind === 'vaccination' && rec.dose_number != null) {
      const booster = rec.total_doses != null && rec.dose_number >= rec.total_doses
      if (!booster) return t('home.nextDoseTitle', { name: rec.name, n: rec.dose_number + 1 })
      return rec.name
    }
    if (r.kind === 'followup_test') return t('home.followupTitle', { name: rec.name })
    return rec.name
  }
  if (r.name) {
    if (r.kind === 'next_dose') return t('home.nextDoseReminderTitle', { name: r.name })
    if (r.kind === 'followup_test') return t('home.followupTitle', { name: r.name })
    return r.name
  }
  return t('home.reminderGeneric')
}

export function reminderKindLabel(kind: string, t: Translate): string {
  if (kind === 'next_dose') return t('home.kindNextDose')
  if (kind === 'followup_test') return t('home.kindFollowupTest')
  return kind.replace('_', ' ')
}
