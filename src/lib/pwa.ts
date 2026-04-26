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
// Subtle Chrome behavior: registration.update() resolves once the new worker
// enters 'installing', NOT after install completes. So checking reg.waiting
// right after update() is a race — it's usually still null. Reloading at
// that moment hits the OLD SW, which serves OLD index.html from its precache,
// re-arming the banner. We must wait for the new SW to actually take over
// (controllerchange) before reloading.
//
// Manual sequence:
//   1. Arm a controllerchange listener BEFORE reg.update() so we never miss
//      the takeover even if it fires synchronously after update resolves.
//   2. registration.update() — force a fresh SW fetch from the server.
//   3. If anything is updating (installing/waiting), wait for controllerchange
//      (or a short timeout). The new SW's clients.claim() in activate will
//      fire it once it has actually taken over — that is the safe moment.
//   4. Reload. If autoUpdate's own 'activated' listener already triggered a
//      reload mid-sequence, ours is a harmless no-op.
export async function refreshApp() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        const oldController = navigator.serviceWorker.controller
        const ctrlChanged = new Promise<void>((resolve) => {
          const onChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', onChange)
            resolve()
          }
          navigator.serviceWorker.addEventListener('controllerchange', onChange)
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('controllerchange', onChange)
            resolve()
          }, 3000)
        })
        try { await reg.update() } catch {}
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        const updating =
          reg.installing != null ||
          reg.waiting != null ||
          navigator.serviceWorker.controller !== oldController
        if (updating) await ctrlChanged
      }
    } catch {}
  }
  window.location.reload()
}
