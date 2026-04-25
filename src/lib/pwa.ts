if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}

// vite-plugin-pwa's autoUpdate auto-reloads only when a NEW SW becomes
// 'activated'. But workbox-window doesn't poll — it only checks for SW
// updates on initial page load. So a PWA window kept open across a deploy
// keeps using the old SW, which serves cached old HTML on reload, leaving
// bootVersion stale and the version banner stuck.
//
// Worse: vite-plugin-pwa's exposed updateSW(true) is a no-op in autoUpdate
// mode (it only sends SKIP_WAITING when !auto). Calling it from the Refresh
// button does nothing at all — the page never reloads.
//
// Manual sequence:
//   1. registration.update() — force a fresh SW fetch from the server.
//   2. If a new SW is now waiting, post SKIP_WAITING and wait for the
//      controllerchange event before reloading, so the reload navigation
//      hits the new SW's precache (with the new HTML).
//   3. Always reload at the end as a guaranteed fallback. If a new SW
//      activated mid-sequence, autoUpdate's own 'activated' listener will
//      have already triggered a reload — ours is a no-op in that case.
export async function refreshApp() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        try { await reg.update() } catch {}
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          await new Promise<void>((resolve) => {
            const onChange = () => {
              navigator.serviceWorker.removeEventListener('controllerchange', onChange)
              resolve()
            }
            navigator.serviceWorker.addEventListener('controllerchange', onChange)
            setTimeout(resolve, 2000)
          })
        }
      }
    } catch {}
  }
  window.location.reload()
}
