import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../lib/errors'
import { getGoogleClientId, loadGoogleIdentity } from '../lib/google'

type Props = {
  /** Called once signed in. isNew is true when the account was just created. */
  onDone: (isNew: boolean) => void
}

/**
 * "Continue with Google", for both log-in and sign-up. Shows nothing when the site has no Google client id.
 * Someone with an account is logged in; someone new is asked: looking for work, or hiring?
 */
export default function GoogleSignIn({ onDone }: Props) {
  const clientId = getGoogleClientId()
  const { continueWithGoogle } = useAuth()
  const holder = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState<string | null>(null)

  // The latest callbacks, so the button (set up once) never uses stale ones.
  const latest = useRef({ onDone, continueWithGoogle })
  useEffect(() => {
    latest.current = { onDone, continueWithGoogle }
  })

  const finish = async (credential: string, chosen?: 'SEEKER' | 'EMPLOYER') => {
    setError('')
    setBusy(true)
    try {
      const { onDone: done, continueWithGoogle: signIn } = latest.current
      const result = await signIn(credential, chosen)
      setWaiting(null)
      done(result.isNew)
    } catch (err) {
      if ((err as { code?: string }).code === 'ROLE_REQUIRED') {
        setWaiting(credential)
      } else {
        setWaiting(null)
        setError(getErrorMessage(err, 'We could not sign you in with Google. Please try again.'))
      }
    } finally {
      setBusy(false)
    }
  }

  const finishRef = useRef(finish)
  useEffect(() => {
    finishRef.current = finish
  })

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !holder.current) return
        google.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) void finishRef.current(response.credential)
          },
        })
        google.renderButton(holder.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 320 })
      })
      .catch(() => {
        if (!cancelled) setError('Google sign-in could not load. You can still use your email or phone.')
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (!clientId) return null

  return (
    <div className="mb-5" data-testid="google-sign-in">
      {waiting ? (
        <div role="group" aria-label="What brings you to JobWahala?" className="rounded-xl border border-[#dde3ec] bg-[#f7f9fc] p-4">
          <p className="mb-3 text-sm font-bold text-[#111c2d]">You do not have an account yet. What brings you to JobWahala?</p>
          <div className="grid gap-2">
            <button type="button" disabled={busy} onClick={() => void finish(waiting, 'SEEKER')} className="rounded-xl border-2 border-[#dde3ec] bg-white px-3.5 py-2.5 text-left text-base font-bold text-[#111c2d] hover:border-[#2f6df6] disabled:opacity-60">
              I am looking for a job
            </button>
            <button type="button" disabled={busy} onClick={() => void finish(waiting, 'EMPLOYER')} className="rounded-xl border-2 border-[#dde3ec] bg-white px-3.5 py-2.5 text-left text-base font-bold text-[#111c2d] hover:border-[#2f6df6] disabled:opacity-60">
              I am hiring
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <div ref={holder} aria-label="Continue with Google" />
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-center text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-[#e8eef5]" />
        <span className="text-xs font-bold uppercase tracking-widest text-[#8b97a8]">or</span>
        <span className="h-px flex-1 bg-[#e8eef5]" />
      </div>
    </div>
  )
}
