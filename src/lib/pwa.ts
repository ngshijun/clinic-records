import { registerSW } from 'virtual:pwa-register'

// vite-plugin-pwa 'autoUpdate' mode: workbox-window listens for the SW's
// 'activated' event and calls window.location.reload() automatically.
//
// To surface deploys to long-lived tabs we periodically re-fetch the SW
// script per the official 'Periodic Service Worker Updates' guide:
//   https://vite-pwa-org.netlify.app/guide/periodic-sw-updates
const intervalMS = 10 * 60 * 1000

if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, r) {
      if (!r) return
      setInterval(async () => {
        if (r.installing || !navigator) return
        if ('connection' in navigator && !navigator.onLine) return
        try {
          const resp = await fetch(swUrl, {
            cache: 'no-store',
            headers: { cache: 'no-store', 'cache-control': 'no-cache' },
          })
          if (resp.status === 200) await r.update()
        } catch {}
      }, intervalMS)
    },
  })
}

// Lazy-loaded chunk 404s after a deploy mean the user is stranded on stale
// bundle metadata; reload picks up the new manifest.
export function refreshApp() {
  window.location.reload()
}
