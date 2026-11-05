import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Phone } from 'lucide-react'
import { useAuth, type UserRole } from '../context/AuthContext'
import { apiSendPhoneCode } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

type Props = {
  mode: 'login' | 'signup'
  /** Sign-up only: which kind of account to create. */
  role?: UserRole
  onDone: () => void
}

const inputClass =
  'w-full h-[50px] rounded-xl border border-[#dde3ec] bg-[#f7f9fc] text-base text-[#111c2d] placeholder:text-[#9caab8] outline-none transition-all focus:bg-white focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/10'

/**
 * Phone + one-time code, for logging in or signing up. Two steps: type the number and get a text,
 * then type the 6-digit code. The server decides what is a valid Ghanaian number.
 */
export default function PhoneCodeFlow({ mode, role = 'SEEKER', onDone }: Props) {
  const { loginWithPhone, signupWithPhone } = useAuth()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Count down the "wait before asking again" the server asked for.
  useEffect(() => {
    if (wait <= 0) return
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  const purpose = mode === 'login' ? 'LOGIN' : 'SIGNUP'

  const sendCode = async () => {
    setError('')
    setBusy(true)
    try {
      await apiSendPhoneCode(phone, purpose)
      setSentTo(phone)
      setCode('')
      setWait(60)
    } catch (err) {
      const seconds = (err as { retryAfterSeconds?: number }).retryAfterSeconds
      if (seconds) setWait(seconds)
      setError(getErrorMessage(err, 'We could not send the code. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const submitPhone = (event: FormEvent) => {
    event.preventDefault()
    void sendCode()
  }

  const submitCode = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await loginWithPhone(sentTo ?? phone, code)
      else await signupWithPhone(sentTo ?? phone, code, role)
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return sentTo === null ? (
    <form onSubmit={submitPhone} className="space-y-4">
      <div>
        <label htmlFor="phone-number" className="block text-[13px] font-semibold text-[#374151] mb-1.5">
          Mobile number
        </label>
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9caab8]" />
          <input
            id="phone-number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="024 123 4567"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={`${inputClass} pl-10 pr-4`}
            required
          />
        </div>
        <p className="mt-1.5 text-xs font-medium text-[#6b7a8d]">We will text you a 6-digit code. Ghana mobile numbers only for now.</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-[13px] leading-snug text-red-600">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={busy || wait > 0} className="btn btn-gold btn-lg w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? 'Sending…' : wait > 0 ? `Wait ${wait}s` : <>Text me a code <ArrowRight className="h-4 w-4" /></>}
      </button>
    </form>
  ) : (
    <form onSubmit={(event) => void submitCode(event)} className="space-y-4">
      <div>
        <label htmlFor="phone-code" className="block text-[13px] font-semibold text-[#374151] mb-1.5">
          6-digit code
        </label>
        <input
          id="phone-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          className={`${inputClass} px-4 text-center text-xl font-black tracking-[0.4em]`}
          required
        />
        <p className="mt-1.5 text-xs font-medium text-[#6b7a8d]">
          We texted <strong>{sentTo}</strong>. The code works for 5 minutes.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-[13px] leading-snug text-red-600">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={busy || code.length !== 6} className="btn btn-gold btn-lg w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? 'Checking…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>

      <div className="flex items-center justify-between text-[12px] font-semibold">
        <button type="button" onClick={() => { setSentTo(null); setError('') }} className="text-[#6b7a8d] hover:text-[#111c2d]">
          Use a different number
        </button>
        <button type="button" disabled={busy || wait > 0} onClick={() => void sendCode()} className="text-[#2f6df6] hover:underline disabled:cursor-not-allowed disabled:opacity-50">
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </button>
      </div>
    </form>
  )
}
