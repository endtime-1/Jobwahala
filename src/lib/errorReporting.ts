/**
 * Error reporting for the website (Sentry). It is built to cost nothing and reveal nothing:
 *
 *  - Off unless VITE_SENTRY_DSN is set. Then no code is downloaded at all.
 *  - Loaded after the page is up, in a separate file, so it never slows the first screen on a slow phone.
 *  - Errors only: no page-view tracing, no session replay, no breadcrumbs (they record clicks and text).
 *  - Every report is scrubbed first (emails, phone numbers, tokens, request data, local variables) and
 *    carries no user details. See sentryClient.ts.
 *  - Errors that happen before it has loaded are kept (up to 10) and sent once it starts.
 */

type Client = typeof import('./sentryClient')

let client: Client | null = null
let removeEarlyListeners: (() => void) | null = null
const pending: unknown[] = []
const MAX_PENDING = 10

const dsn = () => (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim() ?? ''

export const isErrorReportingConfigured = () => Boolean(dsn())

/** Report an error we caught ourselves (for example in an error boundary). Safe to call any time. */
export const reportError = (error: unknown) => {
  if (client) {
    client.sendError(error)
    return
  }
  if (dsn() && pending.length < MAX_PENDING) pending.push(error)
}

/** Remember crashes that happen before Sentry has loaded. */
export const installEarlyErrorCapture = () => {
  if (!dsn() || removeEarlyListeners || typeof window === 'undefined') return

  const onError = (event: ErrorEvent) => reportError(event.error ?? new Error(event.message))
  const onRejection = (event: PromiseRejectionEvent) =>
    reportError(event.reason instanceof Error ? event.reason : new Error('Unhandled promise rejection'))

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  removeEarlyListeners = () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

/** Loads and starts Sentry. Resolves to false (and loads nothing) when no DSN is set. */
export const startErrorReporting = async (): Promise<boolean> => {
  if (!dsn() || client) return Boolean(client)

  const loaded = await import('./sentryClient')
  loaded.startSentry({
    dsn: dsn(),
    environment: import.meta.env.MODE,
    release: (import.meta.env.VITE_RELEASE as string | undefined) || undefined,
  })

  client = loaded
  removeEarlyListeners?.()
  removeEarlyListeners = null
  for (const error of pending.splice(0)) loaded.sendError(error)

  return true
}

/** For tests. */
export const resetErrorReportingForTests = () => {
  client = null
  removeEarlyListeners?.()
  removeEarlyListeners = null
  pending.length = 0
}
