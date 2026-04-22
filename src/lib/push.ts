import { supabase } from '@/lib/supabase'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buf = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function requestAndSubscribe(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false

  const reg = await navigator.serviceWorker.ready
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid),
  })

  const raw = sub.toJSON()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return false

  await supabase.from('push_subscriptions').upsert({
    user_id: user.user.id,
    endpoint: raw.endpoint!,
    p256dh: raw.keys!.p256dh!,
    auth: raw.keys!.auth!,
    user_agent: navigator.userAgent,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  return true
}

export async function unsubscribeCurrent(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function isSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}
