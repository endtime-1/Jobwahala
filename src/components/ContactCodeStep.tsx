import { useState, type FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { apiConfirmVerificationCode, apiRequestVerificationCode } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

type Props = {
  requestId: string
  email?: string | null
  phone?: string | null
  onConfirmed: () => void
}

/** The "enter the 6-digit code we sent you" step of business verification, by email or by text message. */
export default function ContactCodeStep({ requestId, email, phone, onConfirmed }: Props) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const confirm = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await apiConfirmVerificationCode(requestId, code.trim())
      onConfirmed()
    } catch (err) {
      setError(getErrorMessage(err, 'We could not check that code. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const resend = async (channel: 'EMAIL' | 'PHONE') => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await apiRequestVerificationCode(requestId, channel)
      setNotice(
        channel === 'PHONE'
          ? `A new code is on its way by text to ${phone}.`
          : `A new code is on its way to ${email}.`,
      )
    } catch (err) {
      setError(getErrorMessage(err, 'We could not send a new code. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const firstTarget = email || phone

  return (
    <form onSubmit={(event) => void confirm(event)} className="mt-4 rounded-2xl border border-secondary/20 bg-secondary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-black text-text-main">
        <MailCheck className="h-4 w-4 text-secondary" aria-hidden /> Confirm your company contact
      </p>
      <p className="mt-1 text-xs font-semibold text-text-muted">
        We sent a 6-digit code to <strong>{firstTarget}</strong>. Our team can only review your request once it is confirmed.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor={`code-${requestId}`} className="sr-only">
          6-digit code
        </label>
        <input
          id={`code-${requestId}`}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          className="h-11 w-36 rounded-xl border border-surface-border bg-white px-4 text-center text-lg font-black tracking-[0.3em] outline-none focus:border-primary"
        />
        <button type="submit" disabled={busy || code.length !== 6} className="btn btn-primary btn-sm disabled:opacity-60">
          Confirm
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {email ? (
          <button type="button" disabled={busy} onClick={() => void resend('EMAIL')} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline disabled:opacity-60">
            Email me a new code
          </button>
        ) : null}
        {phone ? (
          <button type="button" disabled={busy} onClick={() => void resend('PHONE')} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline disabled:opacity-60">
            Text me a new code
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-2 text-sm font-bold text-success">
          {notice}
        </p>
      ) : null}
    </form>
  )
}
