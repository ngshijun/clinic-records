import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { QrPayload } from '@/lib/qr-payload'
import { computeDueAt } from '@/lib/dates'

export interface Record {
  id: string
  user_id: string
  profile_id: string
  kind: 'vaccination' | 'blood_test'
  name: string
  performed_on: string
  dose_number: number | null
  total_doses: number | null
  notes: string | null
  qr_fingerprint: string | null
  created_at: string
}

export interface Reminder {
  id: string
  user_id: string
  profile_id: string
  record_id: string | null
  kind: 'next_dose' | 'followup_test' | 'other'
  title: string
  name: string | null
  due_at: string
  sent_at: string | null
  created_at: string
}

export interface InsertInput {
  profile_id: string
  payload: QrPayload
  fingerprint: string
  notes?: string
}

export const useRecordsStore = defineStore('records', () => {
  const records = ref<Record[]>([])
  const reminders = ref<Reminder[]>([])

  async function fetchForProfile(profile_id: string) {
    const [{ data: recs, error: re }, { data: rems, error: me }] = await Promise.all([
      supabase.from('records').select('*').eq('profile_id', profile_id).order('performed_on', { ascending: false }),
      supabase.from('reminders').select('*').eq('profile_id', profile_id).order('due_at'),
    ])
    if (re) throw re
    if (me) throw me
    records.value = recs ?? []
    reminders.value = rems ?? []
  }

  async function findSimilar(profile_id: string, kind: string, name: string, performed_on: string) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('profile_id', profile_id)
      .eq('kind', kind)
      .eq('name', name)
      .eq('performed_on', performed_on)
      .gte('created_at', since)
      .limit(1)
    if (error) throw error
    return data?.[0] ?? null
  }

  async function closePriorSeriesReminders(rec: Record) {
    const reminderKind = rec.kind === 'vaccination' ? 'next_dose' : 'followup_test'
    const { data: priors, error: pe } = await supabase
      .from('records')
      .select('id')
      .eq('profile_id', rec.profile_id)
      .eq('kind', rec.kind)
      .eq('name', rec.name)
      .neq('id', rec.id)
    if (pe) throw pe
    const priorIds = (priors ?? []).map(p => p.id)
    if (priorIds.length > 0) {
      const { error: de } = await supabase
        .from('reminders')
        .delete()
        .in('record_id', priorIds)
        .eq('kind', reminderKind)
      if (de) throw de
    }
    // Reminder-only entries (record_id IS NULL) carry the series identity in
    // `name`, so the priors-id sweep above can't reach them.
    const { error: oe } = await supabase
      .from('reminders')
      .delete()
      .is('record_id', null)
      .eq('profile_id', rec.profile_id)
      .eq('kind', reminderKind)
      .eq('name', rec.name)
    if (oe) throw oe
  }

  async function createReminderForRecord(user_id: string, rec: Record, payload: QrPayload) {
    if (payload.nd === undefined) return
    // If staff set a next-due, schedule — including the final dose of a
    // series, since recurring shots (annual flu, tetanus booster every 10y)
    // are modeled as 1-of-1 with a next_due and should still generate
    // reminders.
    const isBooster = rec.kind === 'vaccination'
      && payload.dn != null && payload.td != null
      && payload.dn >= payload.td
    const title = rec.kind === 'vaccination' && payload.dn && payload.td && !isBooster
      ? `${payload.n} Dose ${payload.dn + 1} due`
      : rec.kind === 'vaccination'
      ? `${payload.n} reminder`
      : `Follow-up ${payload.n} due`
    const { error } = await supabase.from('reminders').insert({
      user_id,
      profile_id: rec.profile_id,
      record_id: rec.id,
      kind: rec.kind === 'vaccination' ? 'next_dose' : 'followup_test',
      title,
      due_at: computeDueAt(payload.d, payload.nd, payload.nu),
    })
    if (error) throw error
  }

  async function insertWithReminder(input: InsertInput) {
    const { data: userData } = await supabase.auth.getUser()
    const user_id = userData.user?.id
    if (!user_id) throw new Error('not authenticated')
    const { payload } = input
    const kind = payload.k === 'v' ? 'vaccination' : 'blood_test'

    const { data: rec, error: e1 } = await supabase.from('records').insert({
      user_id,
      profile_id: input.profile_id,
      kind,
      name: payload.n,
      performed_on: payload.d,
      dose_number: payload.dn ?? null,
      total_doses: payload.td ?? null,
      notes: input.notes ?? null,
      qr_fingerprint: input.fingerprint,
    }).select().single()
    if (e1) throw e1

    await Promise.all([
      closePriorSeriesReminders(rec as Record),
      createReminderForRecord(user_id, rec as Record, payload),
    ])
    return rec as Record
  }

  async function replaceRecord(oldId: string, input: InsertInput) {
    const { data: userData } = await supabase.auth.getUser()
    const user_id = userData.user?.id
    if (!user_id) throw new Error('not authenticated')
    const { payload } = input
    const kind = payload.k === 'v' ? 'vaccination' : 'blood_test'
    const { data, error } = await supabase.rpc('replace_record', {
      old_id: oldId,
      new_record: {
        profile_id: input.profile_id,
        kind,
        name: payload.n,
        performed_on: payload.d,
        dose_number: payload.dn ?? null,
        total_doses: payload.td ?? null,
        notes: input.notes ?? null,
        qr_fingerprint: input.fingerprint,
      },
    })
    if (error) throw error
    await Promise.all([
      closePriorSeriesReminders(data as Record),
      createReminderForRecord(user_id, data as Record, payload),
    ])
    return data as Record
  }

  async function insertReminderOnly(input: { profile_id: string; payload: QrPayload }) {
    const { data: userData } = await supabase.auth.getUser()
    const user_id = userData.user?.id
    if (!user_id) throw new Error('not authenticated')
    const { payload } = input
    if (payload.nd === undefined) throw new Error('reminder requires nd (days)')
    // payload.k is 'r' here; payload.ok carries the original v/b choice.
    // Legacy QRs without `ok` fall back to 'b' to match prior behavior.
    const originalKind = payload.ok ?? 'b'
    const { data, error } = await supabase.from('reminders').insert({
      user_id,
      profile_id: input.profile_id,
      record_id: null,
      kind: originalKind === 'v' ? 'next_dose' : 'followup_test',
      title: `${payload.n} reminder`,
      name: payload.n,
      due_at: computeDueAt(payload.d, payload.nd, payload.nu),
    }).select().single()
    if (error) throw error
    return data as Reminder
  }

  async function updateRecord(id: string, patch: Partial<Record>) {
    const { data, error } = await supabase.from('records').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data as Record
  }

  async function deleteRecord(id: string) {
    const { error } = await supabase.from('records').delete().eq('id', id)
    if (error) throw error
  }

  async function deleteReminder(id: string) {
    const { error } = await supabase.from('reminders').delete().eq('id', id)
    if (error) throw error
  }

  return { records, reminders, fetchForProfile, findSimilar, insertWithReminder, insertReminderOnly, replaceRecord, updateRecord, deleteRecord, deleteReminder }
})
