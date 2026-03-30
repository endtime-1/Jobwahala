import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { checkApiHealth, getApiStatus, subscribeApiStatus } from '../lib/apiStatus'

export default function ApiStatusBanner() {
  const status = useSyncExternalStore(subscribeApiStatus, getApiStatus, getApiStatus)
  const location = useLocation()
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    if (status.kind !== 'unreachable') return

    const interval = window.setInterval(() => {
      void checkApiHealth()
    }, 5000)

    return () => window.clearInterval(interval)
  }, [status.kind])

  if (status.kind !== 'unreachable') {
    return null
  }

  const isAuthScreen =
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/signup') ||
    location.pathname.startsWith('/onboarding')

  return (
    <div
      className={`fixed inset-x-0 z-[70] px-3 md:px-5 xl:px-8 ${
        isAuthScreen
          ? 'top-[calc(env(safe-area-inset-top)+0.75rem)]'
          : 'top-[calc(env(safe-area-inset-top)+5.75rem)] xl:top-[calc(env(safe-area-inset-top)+6.15rem)]'
      }`}
    >
      <div className="container">
        <div className="rounded-[1.55rem] border border-accent/35 bg-[#101a2b]/92 px-4 py-3 text-white shadow-premium-lg backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/16 text-accent">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-accent/90">
                  Backend Unavailable
                </p>
                <p className="mt-1 text-sm font-medium text-white/88">{status.message}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setIsRetrying(true)
                try {
                  const isHealthy = await checkApiHealth()
                  if (isHealthy) {
                    window.location.reload()
                  }
                } finally {
                  setIsRetrying(false)
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/14 bg-white/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/14"
            >
              <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Checking' : 'Retry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
