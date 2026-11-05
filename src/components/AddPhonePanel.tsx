import { useState, type FormEvent } from 'react'
import { Phone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiConfirmAddPhone, apiSendAddPhoneCode } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

/** Lets someone who signed up with an email add and confirm a phone number, so they can also log in with a text code. */
export default function AddPhonePanel() {
  const { user, refreshUser } = useAuth()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async (event?: FormEvent) => {
    event?.preventDefault()
    setError('')
    setBusy(true)
    try {
      await apiSendAddPhoneCode(phone)
      setSentTo(phone)
      setCode('')
    } catch (err) {
      setError(getErrorMessage(err, 'We could not send the code. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await apiConfirmAddPhone(sentTo ?? phone, code)
      setSentTo(null)
      setPhone('')
      setCode('')
      await refreshUser()
    } catch (err) {
      setError(getErrorMessage(err, 'That code did not work. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dashboard-panel p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3 border-b border-surface-border/50 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
          <Phone className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-black text-[10px] uppercase tracking-widest text-text-main">Phone number</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-text-muted">
            Add your mobile number to log in with a text code, as well as your email.
          </p>
        </div>
      </div>

      {user?.phone ? (
        <p className="text-sm font-bold text-text-main">
          {user.phone} <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-black uppercase text-success">Confirmed</span>
        </p>
      ) : sentTo === null ? (
        <form onSubmit={(event) => void send(event)} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="add-phone" className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
              Mobile number
            </label>
            <input
              id="add-phone"
              type="tel"
              inputMode="tel"
              placeholder="024 123 4567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              className="h-11 w-full rounded-xl border border-surface-border bg-white px-4 text-sm font-semibold outline-none focus:border-primary"
            />
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm disabled:opacity-60">
            Text me a code
          </button>
        </form>
      ) : (
        <form onSubmit={(event) => void confirm(event)} className="space-y-3">
          <p className="text-xs font-semibold text-text-muted">
            We texted <strong>{sentTo}</strong>. Enter the 6-digit code.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="add-phone-code" className="sr-only">
              6-digit code
            </label>
            <input
              id="add-phone-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-11 w-36 rounded-xl border border-surface-border bg-white px-4 text-center text-lg font-black tracking-[0.3em] outline-none focus:border-primary"
            />
            <button type="submit" disabled={busy || code.length !== 6} className="btn btn-primary btn-sm disabled:opacity-60">
              Confirm
            </button>
            <button type="button" disabled={busy} onClick={() => void send()} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline disabled:opacity-60">
              Send a new code
            </button>
            <button type="button" onClick={() => setSentTo(null)} className="text-[10px] font-black uppercase tracking-widest text-text-light hover:text-text-main">
              Change number
            </button>
          </div>
        </form>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
