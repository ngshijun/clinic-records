import { supabase } from '@/lib/supabase'
import type { Profile } from '@/stores/profiles'
import type { Record as ClinicRecord, Reminder } from '@/stores/records'

export interface AdminPatient {
  id: string
  user_id: string
  name: string
  nric: string | null
  date_of_birth: string | null
  nationality: string
  allergies: string | null
}

export interface AdminReminder extends Reminder {
  profile: { name: string; nric: string | null; date_of_birth: string | null } | null
  record: { name: string; kind: string; dose_number: number | null; total_doses: number | null } | null
}

export interface AdminRecordInput {
  kind: 'vaccination' | 'blood_test'
  name: string
  performed_on: string
  dose_number: number | null
  total_doses: number | null
  notes: string | null
}

export interface AdminReminderInput {
  kind: 'next_dose' | 'followup_test' | 'other'
  name: string | null
  due_at: string
}

/**
 * Build the PostgREST `or` filter for a patient search. Commas, parens and the
 * `%`/`*` wildcards would break the filter grammar, so strip them and match the
 * remainder as a case-insensitive substring against both name and NRIC.
 */
export function buildSearchFilter(query: string): string {
  const safe = query.trim().replace(/[,()%*]/g, '')
  return `name.ilike.%${safe}%,nric.ilike.%${safe}%`
}

export async function searchPatients(query: string): Promise<AdminPatient[]> {
  if (query.trim().length < 2) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id,user_id,name,nric,date_of_birth,nationality,allergies')
    .or(buildSearchFilter(query))
    .order('name', { ascending: true })
    .limit(50)
  if (error) throw error
  return (data ?? []) as AdminPatient[]
}

export async function fetchUpcomingReminders(fromIso: string, toIso: string): Promise<AdminReminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*, profile:profiles(name,nric,date_of_birth), record:records(name,kind,dose_number,total_doses)')
    .gte('due_at', fromIso)
    .lt('due_at', toIso)
    .order('due_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as AdminReminder[]
}

export async function fetchPatientBundle(profileId: string): Promise<{
  profile: Profile
  records: ClinicRecord[]
  reminders: Reminder[]
}> {
  const [{ data: profile, error: pe }, { data: recs, error: re }, { data: rems, error: me }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', profileId).single(),
    supabase.from('records').select('*').eq('profile_id', profileId).order('performed_on', { ascending: false }),
    supabase.from('reminders').select('*').eq('profile_id', profileId).order('due_at', { ascending: true }),
  ])
  if (pe) throw pe
  if (re) throw re
  if (me) throw me
  return {
    profile: profile as Profile,
    records: (recs ?? []) as ClinicRecord[],
    reminders: (rems ?? []) as Reminder[],
  }
}

/**
 * Insert a record on behalf of a patient. CRITICAL: user_id is the patient's
 * OWNER id (read off their profile), not the admin's — otherwise the row would
 * be invisible to the patient (their RLS is user_id = auth.uid()).
 */
export async function adminCreateRecord(ownerUserId: string, profileId: string, input: AdminRecordInput): Promise<ClinicRecord> {
  const { data, error } = await supabase.from('records').insert({
    user_id: ownerUserId,
    profile_id: profileId,
    kind: input.kind,
    name: input.name,
    performed_on: input.performed_on,
    dose_number: input.kind === 'vaccination' ? input.dose_number : null,
    total_doses: input.kind === 'vaccination' ? input.total_doses : null,
    notes: input.notes,
  }).select().single()
  if (error) throw error
  return data as ClinicRecord
}

export async function adminCreateReminder(ownerUserId: string, profileId: string, input: AdminReminderInput): Promise<Reminder> {
  const { data, error } = await supabase.from('reminders').insert({
    user_id: ownerUserId,
    profile_id: profileId,
    record_id: null,
    kind: input.kind,
    name: input.name,
    due_at: input.due_at,
  }).select().single()
  if (error) throw error
  return data as Reminder
}

export async function adminUpdateReminder(id: string, patch: { name?: string | null; due_at?: string }): Promise<Reminder> {
  const { data, error } = await supabase.from('reminders').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as Reminder
}

export async function adminSetAllergies(profileId: string, allergies: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_allergies', { p_profile_id: profileId, p_allergies: allergies })
  if (error) throw error
}
