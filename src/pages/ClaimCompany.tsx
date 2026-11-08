import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Building2, CheckCircle2, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import SEO from '../components/SEO'
import PageHero from '../components/PageHero'
import { useAuth } from '../context/AuthContext'
import { apiAcceptClaim, apiGetClaim } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

type Preview = { company: { name: string; industry: string | null }; openJobs: number; applicants: number; emailHint: string | null }

/**
 * Where a company owner lands from the private link JobWahala sent. They see the company, choose an email and password, and the
 * page becomes theirs. The link works once.
 */
export default function ClaimCompany() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [problem, setProblem] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = (await apiGetClaim(token)) as Preview
        if (cancelled) return
        setPreview(data)
        if (data.emailHint) setEmail(data.emailHint)
      } catch (err) {
        if (!cancelled) setProblem(getErrorMessage(err, 'This link is not valid. Ask JobWahala to send you a new one.'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      await apiAcceptClaim(token, { email, password })
      // Sign in with the details just chosen, so the owner lands on their dashboard.
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(getErrorMessage(err, 'We could not take over this company right now. Please try again.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="pb-20 pt-24 xl:pt-28">
      <SEO title="Take over your company page" noindex />
      <div className="container max-w-3xl">
        <PageHero eyebrow="Your company on JobWahala" title="Take over" accent={preview?.company.name ?? 'your page'}>
          <p className="mt-4 max-w-xl text-lg font-medium text-white/75">JobWahala set this page up for you. Choose an email and password and it is yours.</p>
        </PageHero>

        {problem ? (
          <div role="alert" className="mt-8 rounded-2xl border border-error/20 bg-error/5 p-6 text-base font-semibold text-error">
            {problem}
            <p className="mt-3 text-sm font-medium text-text-muted">
              Already have your account? <Link to="/login" className="font-bold text-primary hover:underline">Log in</Link>.
            </p>
          </div>
        ) : !preview ? (
          <div className="mt-8 h-40 animate-pulse rounded-2xl bg-surface-alt/60" aria-label="Loading" />
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.2fr]">
            <section aria-label="What is waiting" className="dashboard-panel p-6">
              <p className="flex items-center gap-2 text-sm font-black text-text-main">
                <Building2 className="h-5 w-5 text-primary" aria-hidden /> {preview.company.name}
              </p>
              {preview.company.industry ? <p className="mt-1 text-sm font-medium text-text-muted">{preview.company.industry}</p> : null}
              <ul className="mt-5 space-y-3 text-sm font-semibold text-text-main">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> {preview.openJobs} open {preview.openJobs === 1 ? 'job' : 'jobs'}</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> {preview.applicants} {preview.applicants === 1 ? 'applicant' : 'applicants'} waiting</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> Posting jobs is free</li>
              </ul>
            </section>

            <form onSubmit={handleSubmit} className="dashboard-panel space-y-4 p-6" aria-label="Take over this company">
              <div>
                <label htmlFor="claim-email" className="block text-sm font-bold text-text-main">Your email</label>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" aria-hidden />
                  <input id="claim-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-surface-border bg-white py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label htmlFor="claim-password" className="block text-sm font-bold text-text-main">Choose a password</label>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" aria-hidden />
                  <input id="claim-password" type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-surface-border bg-white py-3 pl-10 pr-10 text-sm font-semibold outline-none focus:border-primary" />
                  <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs font-medium text-text-muted">At least 8 characters.</p>
              </div>
              {error ? <p role="alert" className="text-sm font-bold text-error">{error}</p> : null}
              <button type="submit" disabled={isSaving} className="btn btn-primary btn-lg w-full justify-center disabled:opacity-60">
                {isSaving ? 'Taking over...' : `Take over ${preview.company.name}`}
              </button>
              <p className="text-xs font-medium text-text-muted">
                By continuing you agree to the <Link to="/terms" className="font-bold text-primary hover:underline">Terms</Link> and <Link to="/privacy" className="font-bold text-primary hover:underline">Privacy Policy</Link>.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
