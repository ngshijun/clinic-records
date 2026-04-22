import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUB = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIV = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:clinic@example.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUB, VAPID_PRIV)

const sb = createClient(SB_URL, SB_SVC)

Deno.serve(async () => {
  const { data: due, error } = await sb
    .from('reminders')
    .select('id, user_id, title, record_id')
    .lte('due_at', new Date().toISOString())
    .is('sent_at', null)
    .is('dismissed_at', null)
    .is('completed_at', null)
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  let dead = 0

  for (const r of due ?? []) {
    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', r.user_id)
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: r.title,
            body: 'Open your records',
            url: r.record_id ? `/records/${r.record_id}` : '/home',
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
    await sb.from('reminders').update({ sent_at: new Date().toISOString() }).eq('id', r.id)
  }

  return new Response(JSON.stringify({ processed: due?.length ?? 0, sent, dead }), {
    headers: { 'content-type': 'application/json' },
  })
})
