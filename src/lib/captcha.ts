import { useCallback, useState } from 'react'

/** Cloudflare Turnstile site key (public). Empty means the bot check is off for this build. */
export const getCaptchaSiteKey = () => ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '').trim()

/**
 * State for one bot-check widget on one form. When the check is off (no site key), the form is always
 * "ready". Call reset() after any failed or finished submit: a token works only once.
 */
export function useCaptcha() {
  const enabled = Boolean(getCaptchaSiteKey())
  const [token, setToken] = useState('')
  const [resetSignal, setResetSignal] = useState(0)

  const reset = useCallback(() => {
    setToken('')
    setResetSignal((count) => count + 1)
  }, [])

  return { enabled, token, setToken, resetSignal, reset, ready: !enabled || Boolean(token) }
}
