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
    vaccination: (name, doseN) => doseN != null ? `Vaccination: ${name} Dose ${doseN}` : `Vaccination: ${name}`,
    bloodTest: (name) => `Blood test: ${name}`,
    body: 'Visit Poliklinik Ng PLT when convenient. Tap to view details.\nPoliklinik Ng PLT is closed on Saturdays.',
  },
  zh: {
    vaccination: (name, doseN) => doseN != null ? `疫苗提醒: ${name} 第 ${doseN} 剂` : `疫苗提醒: ${name}`,
    bloodTest: (name) => `验血提醒: ${name}`,
    body: '请到黄氏药房就诊。点击查看详情。\n黄氏药房每逢周六休诊。',
  },
  ms: {
    vaccination: (name, doseN) => doseN != null ? `Vaksin: ${name} Dos ke-${doseN}` : `Vaksin: ${name}`,
    bloodTest: (name) => `Ujian darah: ${name}`,
    body: 'Sila ke Poliklinik Ng PLT bila senang. Ketik untuk butiran.\nPoliklinik Ng PLT tutup pada hari Sabtu.',
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
  due_at: string
  sent_count: number
  created_at: string
  record: { name: string; dose_number: number | null; total_doses: number | null } | null
}

function formatNotification(r: ReminderRow, locale: Locale): { title: string; body: string } {
  const m = MESSAGES[locale]
  const name = r.record?.name ?? r.name ?? ''
  if (!name) return { title: r.title, body: m.body }
  // Dose number appended only for a continuing series. Final-dose reminders
  // of a 1-of-1 recurring shot (annual flu, tetanus booster) skip the dose
  // suffix so the push doesn't lie about "Dose 2" when there isn't one.
  const dn = r.record?.dose_number
  const td = r.record?.total_doses
  const isBooster = dn != null && td != null && dn >= td
  const nextDoseN = dn != null && !isBooster ? dn + 1 : null
  const title = r.kind === 'next_dose' ? m.vaccination(name, nextDoseN) : m.bloodTest(name)
  return { title, body: m.body }
}

// YYYY-MM-DD in Malaysia timezone, regardless of where this function runs.
const MY_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kuala_Lumpur',
  year: 'numeric', month: '2-digit', day: '2-digit',
})
function myDateOf(input: Date | string): string {
  return MY_DATE_FMT.format(typeof input === 'string' ? new Date(input) : input)
}

// How many of today's three slots (08:00 / 12:00 / 16:00 MY) have
// elapsed in the window (sinceUtc, now] for a reminder whose due date
// is `dueDateMY` (YYYY-MM-DD). Returns 0–3. Slots strictly before
// `sinceUtc` are excluded so reminders created late in the day do not
// back-fill pushes for slots that passed before the user existed.
function slotsElapsed(now: Date, sinceUtc: Date, dueDateMY: string): number {
  const [y, m, d] = dueDateMY.split('-').map(Number)
  // MY = UTC+8, so 08/12/16 MY = 00/04/08 UTC on the same calendar day.
  const slotHoursUTC = [0, 4, 8]
  const nowMs = now.getTime()
  const sinceMs = sinceUtc.getTime()
  let n = 0
  for (const h of slotHoursUTC) {
    const slotMs = Date.UTC(y, m - 1, d, h, 0, 0, 0)
    if (slotMs >= sinceMs && slotMs <= nowMs) n++
  }
  return n
}

Deno.serve(async () => {
  const now = new Date()
  const todayMY = myDateOf(now)

  const { data: due, error } = await sb
    .from('reminders')
    .select('id, user_id, record_id, kind, title, name, due_at, sent_count, created_at, record:records(name, dose_number, total_doses)')
    .lte('due_at', now.toISOString())
    .lt('sent_count', 3)
  if (error) return new Response(error.message, { status: 500 })

  // Cache user locale per request to avoid one auth lookup per reminder.
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

  let processed = 0
  let sent = 0
  let dead = 0

  for (const row of (due ?? []) as unknown as ReminderRow[]) {
    const dueDateMY = myDateOf(row.due_at)
    // We only fire on the reminder's own due day (MY tz). Reminders that
    // are past-due but never reached sent_count=3 are intentionally skipped.
    if (dueDateMY !== todayMY) continue
    // Floor the "since" for slot elapsing to the later of the reminder's
    // creation timestamp and the due day's 08:00 MY (first slot boundary).
    // This ensures a reminder created at 14:00 MY doesn't back-fire the
    // 08:00 and 12:00 slots that had already passed.
    const [dy, dm, dd] = dueDateMY.split('-').map(Number)
    const dueDateEightAmUtcMs = Date.UTC(dy, dm - 1, dd, 0, 0, 0, 0)
    const createdAtMs = new Date(row.created_at).getTime()
    const sinceUtc = new Date(Math.max(createdAtMs, dueDateEightAmUtcMs))
    const desired = slotsElapsed(now, sinceUtc, dueDateMY)
    if (desired <= row.sent_count) continue

    processed++
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
            url: `/reminders/${row.id}`,
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
    // One slot-fire per cron tick. Late-set reminders that have multiple
    // elapsed slots catch up over subsequent ticks (15-min cadence), which
    // also naturally spaces the pushes out so the device isn't slammed.
    await sb
      .from('reminders')
      .update({ sent_at: now.toISOString(), sent_count: row.sent_count + 1 })
      .eq('id', row.id)
  }

  return new Response(JSON.stringify({ processed, sent, dead }), {
    headers: { 'content-type': 'application/json' },
  })
})
