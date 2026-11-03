// After a new release the old script files are gone from the server. A tab (or installed app) that
// still runs the previous release then fails to load the next screen and shows a blank page.
// Recovery: forget the cached copy of the app and reload once to pick up the new release.

const RELOAD_KEY = 'jobwahala_stale_reload_at'
const RELOAD_COOLDOWN_MS = 60_000

const CHUNK_ERROR_PATTERN =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to load module script/i

export const isChunkLoadError = (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : ''
  return CHUNK_ERROR_PATTERN.test(message)
}

/** Reloading again straight away would loop forever if the problem is a real outage. */
export const shouldAutoReload = (lastReloadAt: number | null, now = Date.now()) =>
  lastReloadAt === null || !Number.isFinite(lastReloadAt) || now - lastReloadAt > RELOAD_COOLDOWN_MS

const readLastReload = () => {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY)
    return raw === null ? null : Number(raw)
  } catch {
    return null
  }
}

const forgetCachedApp = async () => {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(registrations.map((registration) => registration.unregister()))
    const names = (await caches?.keys?.()) ?? []
    await Promise.all(names.map((name) => caches.delete(name)))
  } catch {
    // Reloading still helps even if the caches could not be cleared.
  }
}

export const recoverFromStaleApp = async () => {
  if (!shouldAutoReload(readLastReload())) return

  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Without storage we cannot guard against a loop, so do not reload automatically.
    return
  }

  await forgetCachedApp()
  window.location.reload()
}

export const installStaleAppRecovery = () => {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    void recoverFromStaleApp()
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      void recoverFromStaleApp()
    }
  })
}
