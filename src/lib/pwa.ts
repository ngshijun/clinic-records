type UpdateFn = (reloadPage?: boolean) => Promise<void>

let updateSW: UpdateFn | null = null

if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    updateSW = registerSW({ immediate: true })
  })
}

// vite-plugin-pwa with autoUpdate often has the new SW installed (waiting)
// by the time the version banner fires, but it hasn't taken control yet.
// A plain location.reload() goes through the still-active OLD SW and
// re-serves the cached old HTML, so the page boots with the same stale
// bootVersion and the banner reappears immediately. updateSW(true) sends
// SKIP_WAITING, listens for controllerchange, then reloads — guaranteeing
// the next navigation hits the new SW's precache.
export function refreshApp() {
  if (updateSW) {
    updateSW(true)
  } else {
    window.location.reload()
  }
}
