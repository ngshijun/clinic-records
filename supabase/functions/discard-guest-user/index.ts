import { createClient } from 'npm:@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SB_URL, SB_SVC)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt) return json({ error: 'missing_token' }, 401)

  // Validates the JWT against the project's auth secret and returns the
  // user row. Refusing here when the token is invalid stops anyone
  // unauthenticated from probing the function.
  const { data: { user }, error: getErr } = await admin.auth.getUser(jwt)
  if (getErr || !user) return json({ error: 'invalid_token' }, 401)

  // Hard guard: this endpoint must only ever delete anonymous accounts.
  // An upgraded user with a leaked token must not be able to use this
  // path to wipe their own data.
  if (!user.is_anonymous) return json({ error: 'not_anonymous' }, 403)

  // FK cascades on profiles/records/reminders/push_subscriptions clean
  // up clinic data. The auth admin API also drops the user's sessions,
  // refresh tokens, and identities — things a raw DELETE would miss.
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
  if (delErr) return json({ error: delErr.message }, 500)

  return json({ ok: true })
})
