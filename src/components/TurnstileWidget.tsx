import { useEffect, useRef, useState } from 'react'
import { getCaptchaSiteKey } from '../lib/captcha'

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
      theme?: 'light' | 'dark' | 'auto'
    },
  ) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise: Promise<void> | null = null

// Cloudflare's script is fetched once, and only on pages that actually have a protected form.
const loadScript = () => {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    if (window.turnstile) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('The security check could not be loaded'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

type Props = {
  onToken: (token: string) => void
  /** Change this number to ask for a fresh check (after a failed or finished submit). */
  resetSignal?: number
}

/** The Cloudflare Turnstile bot check. Draws nothing when the site key is not set. */
export default function TurnstileWidget({ onToken, resetSignal = 0 }: Props) {
  const siteKey = getCaptchaSiteKey()
  const holder = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const latestOnToken = useRef(onToken)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    latestOnToken.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!siteKey) return
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(holder.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => latestOnToken.current(token),
          'expired-callback': () => latestOnToken.current(''),
          'error-callback': () => {
            latestOnToken.current('')
            setFailed(true)
          },
        })
      })
      .catch(() => setFailed(true))

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [siteKey])

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current && window.turnstile) {
      latestOnToken.current('')
      window.turnstile.reset(widgetId.current)
    }
  }, [resetSignal])

  if (!siteKey) return null

  return (
    <div className="min-h-[65px]">
      <div ref={holder} data-testid="turnstile" />
      {failed ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-error">
          We could not load the security check. Check your connection and reload the page.
        </p>
      ) : null}
    </div>
  )
}
