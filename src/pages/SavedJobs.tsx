import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, MapPin } from 'lucide-react'
import CompanyLogo from '../components/CompanyLogo'
import SEO from '../components/SEO'
import UnverifiedEmployerLabel from '../components/UnverifiedEmployerLabel'
import { apiGetSavedJobs, apiUnsaveJob } from '../lib/api'
import { formatShortDate } from '../lib/display'
import { getErrorMessage } from '../lib/errors'
import { closingSummary } from '../lib/jobLifecycle'
import { useSavedJobs } from '../lib/savedJobs'

type SavedJob = {
  savedAt: string
  job: {
    id: string
    title: string
    location?: string | null
    type?: string | null
    salary?: string | null
    closesAt?: string | null
    isOpen: boolean
  }
  company: { id: string; name: string; logoUrl?: string | null; isVerified?: boolean }
}

export default function SavedJobs() {
  const [saved, setSaved] = useState<SavedJob[] | null>(null)
  const [error, setError] = useState('')
  const { forget } = useSavedJobs()

  useEffect(() => {
    let cancelled = false
    apiGetSavedJobs()
      .then((res: { savedJobs?: SavedJob[] }) => {
        if (!cancelled) setSaved(Array.isArray(res.savedJobs) ? res.savedJobs : [])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'We could not load your saved jobs. Please try again.'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const remove = async (jobId: string) => {
    setError('')
    const before = saved
    setSaved((current) => current?.filter((entry) => entry.job.id !== jobId) ?? current)
    try {
      await apiUnsaveJob(jobId)
      forget(jobId)
    } catch (err) {
      setSaved(before)
      setError(getErrorMessage(err, 'We could not remove that job. Please try again.'))
    }
  }

  return (
    <div className="container pt-[calc(env(safe-area-inset-top)+8rem)] pb-12 xl:pt-[calc(env(safe-area-inset-top)+9rem)]">
      <SEO title="Saved jobs" description="Jobs you saved to come back to." canonical="https://jobwahala.com/saved-jobs" />

      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-black tracking-tight text-text-main sm:text-4xl">Saved jobs</h1>
        <p className="mt-2 text-base font-medium text-text-muted">Jobs you saved to come back to. Tap the bookmark on any job to add it here.</p>
      </header>

      {error ? (
        <p role="alert" className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {!error && saved === null ? <p className="text-sm font-bold text-text-light">Loading your saved jobs...</p> : null}

      {saved && saved.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-border bg-white p-8 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-text-light" aria-hidden />
          <p className="mt-2 text-lg font-extrabold text-text-main">You have not saved any jobs yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm font-medium text-text-muted">Found one you like but not ready to apply? Save it and it will wait here.</p>
          <Link to="/jobs" className="btn btn-gold mt-5 inline-flex px-6">
            Find a job
          </Link>
        </div>
      ) : null}

      {saved && saved.length > 0 ? (
        <ul className="space-y-4" aria-label="Your saved jobs">
          {saved.map((entry) => (
            <li key={entry.job.id} className="rounded-2xl border border-surface-border bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <CompanyLogo name={entry.company.name} logoUrl={entry.company.logoUrl} className="h-14 w-14 flex-none rounded-2xl text-lg" />
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold leading-snug text-text-main">
                      {entry.job.isOpen ? (
                        <Link to={`/jobs/${entry.job.id}`} className="hover:underline">
                          {entry.job.title}
                        </Link>
                      ) : (
                        entry.job.title
                      )}
                    </h2>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-bold text-text-muted">
                      <Link to={`/companies/${entry.company.id}`} className="hover:underline">
                        {entry.company.name}
                      </Link>
                      {entry.company.isVerified ? null : <UnverifiedEmployerLabel />}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-text-muted">
                      {entry.job.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> {entry.job.location}
                        </span>
                      ) : null}
                      {entry.job.type ? <span>{entry.job.type}</span> : null}
                      {entry.job.salary ? <span>{entry.job.salary}</span> : null}
                    </p>
                    <p className={`mt-2 text-sm font-bold ${entry.job.isOpen ? 'text-text-muted' : 'text-error'}`}>
                      {entry.job.isOpen ? closingSummary(entry.job.closesAt) : 'No longer taking applications'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <p className="text-sm font-semibold text-text-muted">Saved {formatShortDate(entry.savedAt)}</p>
                  <div className="flex gap-2">
                    {entry.job.isOpen ? (
                      <Link to={`/jobs/${entry.job.id}`} className="btn btn-primary btn-sm">
                        View job
                      </Link>
                    ) : null}
                    <button type="button" onClick={() => void remove(entry.job.id)} className="btn btn-outline btn-sm bg-white">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
