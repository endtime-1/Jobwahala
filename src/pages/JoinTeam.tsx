import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SEO from '../components/SEO'
import { apiAcceptTeamInvite } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

/** The page an invitation email links to. Needs a signed-in employer account with the invited email. */
export default function JoinTeam() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [busy, setBusy] = useState(false)
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')

  const join = async () => {
    setError('')
    setBusy(true)
    try {
      const result = (await apiAcceptTeamInvite(token)) as { company: string }
      setCompany(result.company)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not accept that invitation.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container max-w-xl pb-24 pt-28">
      <SEO title="Join a team" noindex />
      <h1 className="text-3xl font-black tracking-tight text-text-main">Join a company team</h1>
      {company ? (
        <div className="mt-6 rounded-2xl border border-success/20 bg-success/5 p-6">
          <p className="text-base font-bold text-text-main">You now work with {company}.</p>
          <p className="mt-1 text-sm font-medium text-text-muted">Their jobs and applicants are on your employer dashboard.</p>
          <Link to="/dashboard" className="btn btn-primary btn-sm mt-4 inline-flex">
            Go to the dashboard
          </Link>
        </div>
      ) : !token ? (
        <p role="alert" className="mt-6 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          This link is missing its invitation code. Open the link from your email again.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-base font-medium text-text-muted">
            You were invited to work on a company&apos;s jobs and applicants. Sign in with the email the invitation was sent to, then accept.
          </p>
          {error ? (
            <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
              {error}
            </p>
          ) : null}
          <button type="button" disabled={busy} onClick={() => void join()} className="btn btn-primary disabled:opacity-60">
            {busy ? 'Joining...' : 'Accept invitation'}
          </button>
        </div>
      )}
    </div>
  )
}
