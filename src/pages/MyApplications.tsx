import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Clock, MapPin } from 'lucide-react'
import CompanyLogo from '../components/CompanyLogo'
import SEO from '../components/SEO'
import { apiGetMyApplications } from '../lib/api'
import { formatRelativeTime, formatShortDate } from '../lib/display'
import { getErrorMessage } from '../lib/errors'
import { getApplicationBadgeClass } from './dashboards/shared/utils'

type MyApplication = {
  id: string
  status: string
  statusLabel: string
  appliedAt: string
  lastChangedAt: string
  job: { id: string; title: string; location?: string | null; type?: string | null; isOpen: boolean }
  company: { id: string; name: string; logoUrl?: string | null }
  cv?: { source: string; fileName?: string | null } | null
}

// What each stage means for the person who applied.
const STAGE_HINT: Record<string, string> = {
  SUBMITTED: 'Sent. The employer has not moved it yet.',
  SHORTLISTED: 'The employer likes your application and is taking a closer look.',
  INTERVIEW: 'They would like to talk to you. Check your messages and email.',
  OFFERED: 'You have an offer. Check your messages and email for the details.',
  HIRED: 'You got the job. Congratulations!',
  REJECTED: 'The employer chose to go another way this time. Keep going: new roles are added every day.',
}

// A "not selected" result is shown calmly, not in alarm red.
const badgeClass = (status: string) =>
  status === 'REJECTED' ? 'bg-surface-alt text-text-muted' : status === 'OFFERED' ? 'bg-gold text-primary' : getApplicationBadgeClass(status)

export default function MyApplications() {
  const [applications, setApplications] = useState<MyApplication[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiGetMyApplications()
      .then((res: { applications?: MyApplication[] }) => {
        if (!cancelled) setApplications(Array.isArray(res.applications) ? res.applications : [])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'We could not load your applications. Please try again.'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="container pt-[calc(env(safe-area-inset-top)+8rem)] pb-12 xl:pt-[calc(env(safe-area-inset-top)+9rem)]">
      <SEO title="My applications" description="Every job you have applied for, with where it stands." canonical="https://www.jobwahala.com/applications" />

      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-black tracking-tight text-text-main sm:text-4xl">My applications</h1>
        <p className="mt-2 text-base font-medium text-text-muted">
          Every job you have applied for, where it stands, and when it last changed. We also email you when an employer moves your application.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {!error && applications === null ? <p className="text-sm font-bold text-text-light">Loading your applications...</p> : null}

      {applications && applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-border bg-white p-8 text-center">
          <p className="text-lg font-extrabold text-text-main">You have not applied for anything yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm font-medium text-text-muted">Find a role you like and apply in a few minutes.</p>
          <Link to="/jobs" className="btn btn-gold mt-5 inline-flex px-6">
            Find a job
          </Link>
        </div>
      ) : null}

      {applications && applications.length > 0 ? (
        <ul className="space-y-4" aria-label="Your applications">
          {applications.map((application) => (
            <li key={application.id} className="rounded-2xl border border-surface-border bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <CompanyLogo name={application.company.name} logoUrl={application.company.logoUrl} className="h-14 w-14 flex-none rounded-2xl text-lg" />
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold leading-snug text-text-main">
                      {application.job.isOpen ? (
                        <Link to={`/jobs/${application.job.id}`} className="hover:underline">
                          {application.job.title}
                        </Link>
                      ) : (
                        application.job.title
                      )}
                    </h2>
                    <p className="mt-0.5 text-sm font-bold text-text-muted">
                      <Link to={`/companies/${application.company.id}`} className="hover:underline">
                        {application.company.name}
                      </Link>
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-text-muted">
                      {application.job.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> {application.job.location}
                        </span>
                      ) : null}
                      {application.job.type ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5" /> {application.job.type}
                        </span>
                      ) : null}
                      {application.job.isOpen ? null : <span>No longer taking applications</span>}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end sm:text-right">
                  <span className={`badge self-start sm:self-end ${badgeClass(application.status)}`}>{application.statusLabel}</span>
                  <p className="text-sm font-semibold text-text-muted">Applied {formatShortDate(application.appliedAt)}</p>
                  <p className="text-sm font-semibold text-text-muted">
                    {application.cv ? `CV sent: ${application.cv.source === 'BUILDER' ? 'CV builder version' : 'uploaded CV'}` : 'No CV sent'}
                  </p>
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted">
                    <Clock className="h-3.5 w-3.5" /> Updated {formatRelativeTime(application.lastChangedAt)}
                  </p>
                </div>
              </div>
              {STAGE_HINT[application.status] ? (
                <p className="mt-4 border-t border-surface-border pt-3 text-sm font-medium text-text-muted">{STAGE_HINT[application.status]}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
