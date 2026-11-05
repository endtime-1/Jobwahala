import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, ShieldAlert } from 'lucide-react'
import AddPhonePanel from '../components/AddPhonePanel'
import SEO from '../components/SEO'
import { useAuth } from '../context/AuthContext'
import {
  apiDeleteMyAccount,
  apiDownloadMyData,
  apiGetDeletionPreview,
  apiSendDeletionCode,
} from '../lib/api'
import { getErrorMessage } from '../lib/errors'

type Preview = {
  role: string
  confirmWith: 'PASSWORD' | 'SMS_CODE'
  hasPhone: boolean
  applicationsMade: number
  openJobs: number
  applicantsOnOpenJobs: number
  blockers: string[]
}

const fieldClass = 'h-12 w-full rounded-xl border border-surface-border bg-white px-4 text-base font-semibold outline-none focus:border-primary'

export default function AccountSettings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [downloaded, setDownloaded] = useState(false)

  const [preview, setPreview] = useState<Preview | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [acknowledge, setAcknowledge] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiGetDeletionPreview()
      .then((res: { preview?: Preview }) => {
        if (!cancelled && res.preview) setPreview(res.preview)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const download = async () => {
    setDownloadError('')
    setDownloaded(false)
    setDownloading(true)
    try {
      const { blob, filename } = await apiDownloadMyData()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setDownloaded(true)
    } catch (err) {
      setDownloadError(getErrorMessage(err, 'We could not prepare your file. Please try again.'))
    } finally {
      setDownloading(false)
    }
  }

  const sendCode = async () => {
    setError('')
    setBusy(true)
    try {
      await apiSendDeletionCode()
      setCodeSent(true)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not send the code. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const needsAcknowledgement = Boolean(preview && preview.role === 'EMPLOYER' && (preview.openJobs > 0 || preview.applicantsOnOpenJobs > 0))
  const blocked = Boolean(preview && preview.blockers.length > 0)
  const ready =
    typed === 'DELETE' &&
    !blocked &&
    (preview?.confirmWith === 'SMS_CODE' ? code.length === 6 : password.length > 0) &&
    (!needsAcknowledgement || acknowledge)

  const remove = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await apiDeleteMyAccount({
        confirm: 'DELETE',
        ...(preview?.confirmWith === 'SMS_CODE' ? { code } : { password }),
        ...(needsAcknowledgement ? { acknowledgeCompany: true } : {}),
      })
      logout()
      navigate('/account-deleted', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'We could not delete your account. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container max-w-3xl pb-16 pt-[calc(env(safe-area-inset-top)+8rem)] xl:pt-[calc(env(safe-area-inset-top)+9rem)]">
      <SEO title="Account settings" description="Your sign-in details, your data, and deleting your account." canonical="https://jobwahala.com/settings" />

      <h1 className="text-3xl font-black tracking-tight text-text-main sm:text-4xl">Account settings</h1>
      <p className="mt-2 text-base font-medium text-text-muted">
        Your details, a copy of your data, and the option to delete your account. See our{' '}
        <Link to="/privacy" className="font-bold text-primary hover:underline">
          Privacy Policy
        </Link>{' '}
        for how we handle your data.
      </p>

      <section className="mt-8 rounded-2xl border border-surface-border bg-white p-5 sm:p-6" aria-labelledby="signin-details">
        <h2 id="signin-details" className="text-lg font-black text-text-main">
          Sign-in details
        </h2>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Email</dt>
            <dd className="font-bold text-text-main">{user?.email || 'None added'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Phone</dt>
            <dd className="font-bold text-text-main">{user?.phone || 'None added'}</dd>
          </div>
        </dl>
        <div className="mt-5">
          <AddPhonePanel />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-surface-border bg-white p-5 sm:p-6" aria-labelledby="your-data">
        <h2 id="your-data" className="text-lg font-black text-text-main">
          Download your data
        </h2>
        <p className="mt-1 text-sm font-medium leading-relaxed text-text-muted">
          Get a copy of what we hold about you: your profile, applications, saved searches, messages you sent, verification details and more. It
          arrives as a single file you can open in any text editor. It does not include other people&apos;s details or your password.
        </p>
        <button type="button" onClick={() => void download()} disabled={downloading} className="btn btn-primary mt-4 disabled:opacity-60">
          <Download className="h-4 w-4" aria-hidden /> {downloading ? 'Preparing your file…' : 'Download my data'}
        </button>
        {downloaded ? (
          <p role="status" className="mt-3 text-sm font-bold text-success">
            Your file has been downloaded.
          </p>
        ) : null}
        {downloadError ? (
          <p role="alert" className="mt-3 text-sm font-bold text-error">
            {downloadError}
          </p>
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl border border-error/30 bg-error/5 p-5 sm:p-6" aria-labelledby="delete-account">
        <h2 id="delete-account" className="flex items-center gap-2 text-lg font-black text-error">
          <ShieldAlert className="h-5 w-5" aria-hidden /> Delete your account
        </h2>
        <p className="mt-1 text-sm font-medium leading-relaxed text-text-muted">
          This removes your personal details, profile, CVs, saved searches and job alerts, and signs you out everywhere. It cannot be undone, so
          download your data first if you want a copy. Some records, such as payments, are kept without your name where the law requires it.
        </p>

        {blocked ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm font-semibold text-error" aria-label="Why you cannot delete yet">
            {preview!.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : null}

        {!showDelete ? (
          <button type="button" onClick={() => setShowDelete(true)} disabled={blocked} className="btn mt-4 border border-error/40 bg-white text-error disabled:opacity-50">
            Delete my account
          </button>
        ) : (
          <form onSubmit={(event) => void remove(event)} className="mt-5 space-y-4">
            {needsAcknowledgement ? (
              <label className="flex items-start gap-3 rounded-xl border border-error/30 bg-white p-4 text-sm font-semibold text-text-main">
                <input type="checkbox" checked={acknowledge} onChange={(event) => setAcknowledge(event.target.checked)} className="mt-1 h-4 w-4" />
                <span>
                  I understand that my {preview!.openJobs} open {preview!.openJobs === 1 ? 'job' : 'jobs'} will be closed, my company page will be
                  removed, and the {preview!.applicantsOnOpenJobs} {preview!.applicantsOnOpenJobs === 1 ? 'person' : 'people'} waiting on them
                  will not hear from this company again.
                </span>
              </label>
            ) : null}

            {preview?.confirmWith === 'SMS_CODE' ? (
              <div>
                <label htmlFor="delete-code" className="mb-1.5 block text-sm font-bold text-text-main">
                  6-digit code
                </label>
                {codeSent ? (
                  <input
                    id="delete-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={`${fieldClass} w-48 text-center text-xl tracking-[0.4em]`}
                  />
                ) : (
                  <button type="button" onClick={() => void sendCode()} disabled={busy} className="btn btn-outline bg-white disabled:opacity-60">
                    Text me a code
                  </button>
                )}
                <p className="mt-1.5 text-xs font-medium text-text-muted">We text a code to your phone number to make sure it is really you.</p>
              </div>
            ) : (
              <div>
                <label htmlFor="delete-password" className="mb-1.5 block text-sm font-bold text-text-main">
                  Your password
                </label>
                <input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={fieldClass}
                />
              </div>
            )}

            <div>
              <label htmlFor="delete-confirm" className="mb-1.5 block text-sm font-bold text-text-main">
                Type DELETE to confirm
              </label>
              <input id="delete-confirm" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" className={`${fieldClass} w-48`} />
            </div>

            {error ? (
              <p role="alert" className="text-sm font-bold text-error">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={!ready || busy} className="btn bg-error text-white disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? 'Deleting…' : 'Permanently delete my account'}
              </button>
              <button type="button" onClick={() => setShowDelete(false)} className="text-sm font-bold text-text-muted hover:text-text-main">
                Keep my account
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
