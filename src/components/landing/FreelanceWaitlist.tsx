import { useState, type FormEvent } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { apiCreateInterestSignup } from '../../lib/api'
import { useCaptcha } from '../../lib/captcha'
import TurnstileWidget from '../TurnstileWidget'

const FREELANCE_SOURCE = 'landing_freelance_gigs'

type Status = 'idle' | 'sending' | 'done' | 'error'

// One box for "email or phone": an "@" means email, anything else is treated as a phone number.
const splitContact = (raw: string): { email?: string; phone?: string } => {
  const value = raw.trim()
  if (!value) return {}
  return value.includes('@') ? { email: value } : { phone: value }
}

export default function FreelanceWaitlist() {
  const [contact, setContact] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const captcha = useCaptcha()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const parts = splitContact(contact)
    const valid = parts.email
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parts.email)
      : /^\+?\d{9,15}$/.test((parts.phone ?? '').replace(/[\s\-().]/g, ''))
    if (!valid) {
      setStatus('error')
      setMessage('Enter a valid email or phone number.')
      return
    }

    setStatus('sending')
    try {
      await apiCreateInterestSignup({ ...parts, source: FREELANCE_SOURCE, website, ...(captcha.token ? { captchaToken: captcha.token } : {}) })
      setStatus('done')
    } catch (error) {
      captcha.reset()
      setStatus('error')
      setMessage(error instanceof Error && error.message ? error.message : 'Could not save that. Please try again.')
    }
  }

  return (
    <div
      id="freelance-gigs"
      className="scroll-mt-24 rounded-[2rem] border border-surface-border bg-white/85 p-6 shadow-premium-sm sm:p-8"
    >
      <p className="inline-block rounded-full bg-gold/25 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-primary">
        Coming soon
      </p>
      <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight text-text-main sm:text-3xl">
        Freelance gigs
      </h2>
      <p className="mt-2 max-w-xl text-base font-medium leading-relaxed text-text-muted">
        One-off projects for freelancers are on the way. Leave your email or phone number and we will tell you the day
        they open. We will not use it for anything else.
      </p>

      {status === 'done' ? (
        <p
          role="status"
          className="mt-5 flex items-center gap-2 rounded-2xl bg-success/12 px-4 py-3 text-[15px] font-bold text-success"
        >
          <Check className="h-5 w-5 flex-none" strokeWidth={3} /> Thanks, you are on the list.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Email or phone number</span>
            <input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              type="text"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
              placeholder="Email or phone number"
              aria-describedby={status === 'error' ? 'freelance-waitlist-error' : undefined}
              className="h-12 w-full rounded-2xl border border-surface-border bg-white px-4 text-[15px] font-semibold text-text-main"
            />
          </label>
          {/* Hidden from people; bots fill it in. */}
          <input
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          <button type="submit" disabled={status === 'sending' || !captcha.ready} className="btn btn-primary h-12 justify-center px-6">
            {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Tell me when it opens
          </button>
        </form>
      )}

      <div className="mt-3">
        <TurnstileWidget onToken={captcha.setToken} resetSignal={captcha.resetSignal} />
      </div>

      {status === 'error' && (
        <p id="freelance-waitlist-error" role="alert" className="mt-3 text-sm font-bold text-error">
          {message}
        </p>
      )}
    </div>
  )
}
