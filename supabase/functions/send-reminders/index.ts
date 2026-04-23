import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUB = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIV = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:clinic@example.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUB, VAPID_PRIV)

const sb = createClient(SB_URL, SB_SVC)

type Locale = 'en' | 'zh' | 'ms'

const MESSAGES: Record<Locale, {
  vaccination: (name: string, doseN: number | null) => string
  bloodTest: (name: string) => string
  body: string
}> = {
  en: {
    vaccination: (name, doseN) => doseN != null ? `Vaccination due: ${name} Dose ${doseN}` : `Vaccination due: ${name}`,
    bloodTest: (name) => `Blood test due: ${name}`,
    body: 'Visit Poliklinik Ng when convenient. Tap to view details.',
  },
  zh: {
    vaccination: (name, doseN) => doseN != null ? `疫苗提醒: ${name} 第 ${doseN} 剂` : `疫苗提醒: ${name}`,
    bloodTest: (name) => `验血提醒: ${name}`,
    body: '请到黄氏药房就诊。点击查看详情。',
  },
  ms: {
    vaccination: (name, doseN) => doseN != null ? `Vaksin: ${name} Dos ke-${doseN}` : `Vaksin: ${name}`,
    bloodTest: (name) => `Ujian darah: ${name}`,
    body: 'Sila ke Poliklinik Ng bila senang. Ketik untuk butiran.',
  },
}

function pickLocale(raw: string | null | undefined): Locale {
  if (raw === 'zh' || raw === 'ms') return raw
  return 'en'
}

interface ReminderRow {
  id: string
  user_id: string
  record_id: string | null
  kind: string
  title: string
  name: string | null
  record: { name: string; dose_number: number | null } | null
}

function formatNotification(r: ReminderRow, locale: Locale): { title: string; body: string } {
  const m = MESSAGES[locale]
  const name = r.record?.name ?? r.name ?? ''
  if (!name) return { title: r.title, body: m.body }
  // Four cases differ by (kind, has-record):
  //   next_dose + record  → vaccinationDue (N+1 dose)
  //   next_dose + no record → vaccinationUpcoming (reminder-only vaccination QR)
  //   followup_test + record → bloodTestDue
  //   followup_test + no record → bloodTestUpcoming (reminder-only blood-test QR)
  // Two templates, chosen by reminder kind. Dose number appended when the
  // source record has one; otherwise the vaccination template omits it.
  const nextDoseN = r.record?.dose_number != null ? r.record.dose_number + 1 : null
  const title = r.kind === 'next_dose' ? m.vaccination(name, nextDoseN) : m.bloodTest(name)
  return { title, body: m.body }
}

Deno.serve(async () => {
  const { data: due, error } = await sb
    .from('reminders')
    .select('id, user_id, record_id, kind, title, name, record:records(name, dose_number)')
    .lte('due_at', new Date().toISOString())
    .is('sent_at', null)
    .is('dismissed_at', null)
    .is('completed_at', null)
  if (error) return new Response(error.message, { status: 500 })

  // Cache user locale per request to avoid one auth lookup per reminder
  // when multiple reminders belong to the same user.
  const localeCache = new Map<string, Locale>()
  async function getUserLocale(user_id: string): Promise<Locale> {
    const cached = localeCache.get(user_id)
    if (cached) return cached
    const { data } = await sb.auth.admin.getUserById(user_id)
    const raw = data?.user?.user_metadata?.locale as string | undefined
    const loc = pickLocale(raw)
    localeCache.set(user_id, loc)
    return loc
  }

  let sent = 0
  let dead = 0

  for (const row of (due ?? []) as unknown as ReminderRow[]) {
    const locale = await getUserLocale(row.user_id)
    const { title, body } = formatNotification(row, locale)
    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', row.user_id)
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title,
            body,
            // Always land on /home with a scroll-anchor to the reminder card.
            // Linking to row.record_id would open the *prior* record
            // (e.g., Dose 1 when reminding about Dose 2), which is confusing.
            url: `/home#r-${row.id}`,
          }),
        )
        sent++
      } catch (e: unknown) {
        const err = e as { statusCode?: number }
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await sb.from('push_subscriptions').delete().eq('id', s.id)
          dead++
        }
      }
    }
    await sb.from('reminders').update({ sent_at: new Date().toISOString() }).eq('id', row.id)
  }

  return new Response(JSON.stringify({ processed: due?.length ?? 0, sent, dead }), {
    headers: { 'content-type': 'application/json' },
  })
})
