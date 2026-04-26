/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// autoUpdate mode: skip waiting immediately so the new SW activates as
// soon as install completes. registerSW (in 'autoUpdate') listens for
// 'activated' and reloads the page automatically.
self.skipWaiting()

// waitUntil(claim) ensures activate doesn't end until controllerchange
// has been queued, so the auto-reload navigation goes through the new
// SW (and its new precache).
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Reminder', body: 'You have a reminder' }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Reminder', {
      body: data.body ?? '',
      icon: '/icon.png',
      badge: '/icon.png',
      data: { url: data.url ?? '/home' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/home'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return (client as WindowClient).navigate(url).then((c) => c?.focus())
      }
      return self.clients.openWindow(url)
    }),
  )
})
