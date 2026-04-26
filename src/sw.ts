/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
self.skipWaiting()
// Use event.waitUntil so activate doesn't complete until claim finishes.
// workbox-core's clientsClaim() omits waitUntil, which lets the SW reach
// 'activated' before controllerchange propagates — workbox-window then fires
// reload while the page is still controlled by the OLD SW, serving stale HTML.
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
