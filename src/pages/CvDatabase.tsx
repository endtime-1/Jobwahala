import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Lock, Rocket, Send } from 'lucide-react'
import EvidenceLink from '../components/EvidenceLink'
import SEO from '../components/SEO'
import {
  apiDeleteSavedCandidateSearch,
  apiGetCandidate,
  apiGetMyBilling,
  apiGetSavedCandidateSearches,
  apiInviteCandidate,
  apiSaveCandidateSearch,
  apiSearchCvDatabase,
  apiSetSavedSearchAlerts,
  apiUnlockCandidate,
} from '../lib/api'
import {
  ACTIVE_OPTIONS,
  AVAILABILITY_OPTIONS,
  EDUCATION_OPTIONS,
  availabilityLabel,
  compactFilters,
  educationLabel,
  type Allowance,
  type Candidate,
  type CandidateFilters,
  type Contact,
} from '../lib/cvDatabase'
import { formatShortDate } from '../lib/display'
import { getErrorMessage } from '../lib/errors'

type Result = { total: number; matching: number; page: number; pageSize: number; entries: Candidate[]; allowance: Allowance }
type Saved = { id: string; name: string; alertsEnabled: boolean; filters: CandidateFilters }
type Blocked = null | 'PLAN_REQUIRED' | 'VERIFICATION_REQUIRED'

const field = 'mt-1 h-11 w-full text-sm font-semibold'

/** Verified employers on a plan with CV access search limited profiles; contact details come one unlock at a time. */
export default function CvDatabase() {
  const [filters, setFilters] = useState<CandidateFilters>({})
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Result | null>(null)
  const [blocked, setBlocked] = useState<Blocked>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Saved[]>([])
  const [saveName, setSaveName] = useState('')
  const [saveAlerts, setSaveAlerts] = useState(true)

  const failed = useCallback((err: unknown, fallback: string) => {
    const code = (err as { code?: string }).code
    if (code === 'PLAN_REQUIRED' || code === 'VERIFICATION_REQUIRED') {
      setBlocked(code)
      setMessage(getErrorMessage(err, ''))
    } else setError(getErrorMessage(err, fallback))
  }, [])

  const run = useCallback(
    async (next: CandidateFilters, nextPage: number) => {
      try {
        const data = (await apiSearchCvDatabase({ ...compactFilters(next), page: String(nextPage) })) as Result
        setResult(data)
        setBlocked(null)
        setError('')
      } catch (err) {
        failed(err, 'We could not search the CV database.')
      }
    },
    [failed],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const first = (await apiSearchCvDatabase({ page: '1' })) as Result
        if (cancelled) return
        setResult(first)
        const list = (await apiGetSavedCandidateSearches()) as { searches: Saved[] }
        if (!cancelled) setSaved(list.searches)
      } catch (err) {
        if (!cancelled) failed(err, 'We could not search the CV database.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [failed])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    void run(filters, 1)
  }
  const go = (next: number) => {
    setPage(next)
    void run(filters, next)
  }
  const set = (key: keyof CandidateFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }))

  const saveSearch = async () => {
    setError('')
    try {
      const data = (await apiSaveCandidateSearch({ name: saveName.trim(), filters: compactFilters(filters), alertsEnabled: saveAlerts })) as { search: Saved }
      setSaved((current) => [data.search, ...current])
      setSaveName('')
    } catch (err) {
      setError(getErrorMessage(err, 'We could not save that search.'))
    }
  }
  const toggleAlerts = async (search: Saved) => {
    try {
      await apiSetSavedSearchAlerts(search.id, !search.alertsEnabled)
      setSaved((current) => current.map((item) => (item.id === search.id ? { ...item, alertsEnabled: !item.alertsEnabled } : item)))
    } catch (err) {
      setError(getErrorMessage(err, 'We could not change that.'))
    }
  }
  const removeSearch = async (search: Saved) => {
    try {
      await apiDeleteSavedCandidateSearch(search.id)
      setSaved((current) => current.filter((item) => item.id !== search.id))
    } catch (err) {
      setError(getErrorMessage(err, 'We could not delete that.'))
    }
  }
  const runSaved = (search: Saved) => {
    setFilters(search.filters)
    setPage(1)
    void run(search.filters, 1)
  }

  return (
    <div className="container max-w-5xl pb-24 pt-28">
      <SEO title="CV database" noindex />
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-text-main">CV database</h1>
        <p className="mt-2 text-base font-medium text-text-muted">
          Job seekers who chose to be found by verified employers. You see a limited profile. Name, phone, email and CV stay hidden until you unlock the profile, which uses one of your plan&apos;s monthly unlocks.
        </p>
      </header>

      {blocked ? (
        <div role="alert" className="rounded-2xl border border-gold/40 bg-gold/10 p-6">
          <p className="text-base font-bold text-text-main">{message || (blocked === 'PLAN_REQUIRED' ? 'The CV database is part of the Business plan.' : 'Only verified employers can search the CV database.')}</p>
          <Link to={blocked === 'PLAN_REQUIRED' ? '/plans' : '/dashboard'} className="btn btn-primary btn-sm mt-4 inline-flex">
            {blocked === 'PLAN_REQUIRED' ? 'See plans' : 'Verify your business'}
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="mb-6 grid gap-3 rounded-2xl border border-surface-border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm font-bold text-text-main lg:col-span-2">
              Skills
              <input value={filters.skills ?? ''} onChange={(e) => set('skills', e.target.value)} className={field} placeholder="e.g. excel bookkeeping" />
            </label>
            <label className="block text-sm font-bold text-text-main">
              Job category
              <input value={filters.category ?? ''} onChange={(e) => set('category', e.target.value)} className={field} placeholder="e.g. Finance" />
            </label>
            <label className="block text-sm font-bold text-text-main">
              Location
              <input value={filters.location ?? ''} onChange={(e) => set('location', e.target.value)} className={field} placeholder="e.g. Accra" />
            </label>
            <label className="block text-sm font-bold text-text-main">
              Years of experience (at least)
              <input type="number" min={0} max={60} value={filters.minYears ?? ''} onChange={(e) => set('minYears', e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-bold text-text-main">
              Education level (at least)
              <select value={filters.education ?? ''} onChange={(e) => set('education', e.target.value)} className={field}>
                <option value="">Any</option>
                {EDUCATION_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-text-main">
              Availability
              <select value={filters.availability ?? ''} onChange={(e) => set('availability', e.target.value)} className={field}>
                <option value="">Any</option>
                {AVAILABILITY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-text-main">
              Last active
              <select value={filters.activeWithinDays ?? ''} onChange={(e) => set('activeWithinDays', e.target.value)} className={field}>
                <option value="">Any time</option>
                {ACTIVE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-text-main sm:col-span-2">
              <input type="checkbox" checked={filters.certificate === 'true'} onChange={(e) => set('certificate', e.target.checked ? 'true' : '')} />
              Has a verified certificate
            </label>
            <div className="flex items-end sm:col-span-2 lg:justify-end">
              <button type="submit" className="btn btn-primary btn-sm px-6">
                Search
              </button>
            </div>
          </form>

          <section aria-label="Saved searches" className="mb-6 rounded-2xl border border-surface-border bg-white p-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-text-main">Saved searches</h2>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block flex-1 text-sm font-bold text-text-main">
                Name this search
                <input value={saveName} onChange={(e) => setSaveName(e.target.value)} maxLength={80} className={field} placeholder="e.g. Accra accountants" />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-text-main">
                <input type="checkbox" checked={saveAlerts} onChange={(e) => setSaveAlerts(e.target.checked)} /> Email me about new matches
              </label>
              <button type="button" disabled={!saveName.trim()} onClick={() => void saveSearch()} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
                Save search
              </button>
            </div>
            {saved.length > 0 ? (
              <ul className="mt-4 divide-y divide-surface-border/60">
                {saved.map((search) => (
                  <li key={search.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <button type="button" onClick={() => runSaved(search)} className="text-sm font-extrabold text-primary hover:underline">
                      {search.name}
                    </button>
                    <span className="flex items-center gap-4 text-xs font-bold">
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={search.alertsEnabled} onChange={() => void toggleAlerts(search)} aria-label={`Email alerts for ${search.name}`} /> Alerts
                      </label>
                      <button type="button" onClick={() => void removeSearch(search)} aria-label={`Delete ${search.name}`} className="text-error hover:underline">
                        Delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {error ? (
            <p role="alert" className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
              {error}
            </p>
          ) : null}

          {result ? (
            <>
              <p className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-text-muted">
                <span>
                  {result.matching} {result.matching === 1 ? 'person' : 'people'} found{result.matching > result.total ? `, showing the first ${result.total}` : ''}
                </span>
                <span>
                  Unlocks this month: {result.allowance.used} of {result.allowance.limit} used (renews {formatShortDate(result.allowance.resetsOn)})
                </span>
              </p>
              <ul className="space-y-3">
                {result.entries.map((entry) => (
                  <CandidateCard key={entry.id} entry={entry} onUnlocked={() => void run(filters, page)} />
                ))}
              </ul>
              {result.matching > result.pageSize ? (
                <div className="mt-6 flex gap-3">
                  <button type="button" disabled={page <= 1} onClick={() => go(page - 1)} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
                    Previous
                  </button>
                  <button type="button" disabled={page * result.pageSize >= result.total} onClick={() => go(page + 1)} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
                    Next
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  )
}

function CandidateCard({ entry, onUnlocked }: { entry: Candidate; onUnlocked: () => void }) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [jobs, setJobs] = useState<{ id: string; title: string }[] | null>(null)
  const [jobId, setJobId] = useState('')
  const [inviting, setInviting] = useState(false)

  const details = [entry.location, entry.educationLevel ? educationLabel(entry.educationLevel) : '', entry.availability ? availabilityLabel(entry.availability) : '', entry.yearsExperience !== null ? `${entry.yearsExperience} yrs experience` : '']
    .filter(Boolean)
    .join(' · ')

  const view = async () => {
    setError('')
    setBusy('view')
    try {
      const data = (await apiGetCandidate(entry.id)) as { contact: Contact | null }
      setContact(data.contact)
      setOpen(true)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not open that profile.'))
    } finally {
      setBusy('')
    }
  }

  const unlock = async () => {
    setError('')
    setBusy('unlock')
    try {
      const data = (await apiUnlockCandidate(entry.id)) as { contact: Contact | null }
      setContact(data.contact)
      onUnlocked()
    } catch (err) {
      setError(getErrorMessage(err, 'We could not unlock that profile.'))
    } finally {
      setBusy('')
    }
  }

  const startInvite = async () => {
    setInviting(true)
    if (jobs) return
    try {
      const mine = (await apiGetMyBilling()) as { jobs: { id: string; title: string }[] }
      setJobs(mine.jobs)
    } catch {
      setJobs([])
    }
  }

  const invite = async () => {
    setError('')
    setBusy('invite')
    try {
      await apiInviteCandidate(entry.id, jobId)
      setNotice('Invitation sent. They have been notified.')
      setInviting(false)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not send that invitation.'))
    } finally {
      setBusy('')
    }
  }

  return (
    <li className="rounded-2xl border border-surface-border bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-extrabold text-text-main">{entry.headline}</h2>
        {entry.boosted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-extrabold text-text-main">
            <Rocket className="h-3 w-3" aria-hidden /> Boosted
          </span>
        ) : null}
        {entry.hasVerifiedCertificate ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-extrabold text-success">
            <BadgeCheck className="h-3 w-3" aria-hidden /> Verified certificate
          </span>
        ) : null}
      </div>
      {details ? <p className="mt-1 text-sm font-semibold text-text-muted">{details}</p> : null}
      {entry.skills ? <p className="mt-2 text-sm font-semibold text-text-main">Skills: {entry.skills}</p> : null}
      {entry.experienceSummary ? <p className="mt-1 text-sm font-medium text-text-muted">{entry.experienceSummary}</p> : null}
      {entry.lastActiveAt ? <p className="mt-1 text-xs font-semibold text-text-light">Last active {formatShortDate(entry.lastActiveAt)}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!open ? (
          <button type="button" disabled={busy === 'view'} onClick={() => void view()} aria-label={`View profile: ${entry.headline}`} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
            View profile
          </button>
        ) : null}
        {open && !contact ? (
          <button type="button" disabled={busy === 'unlock'} onClick={() => void unlock()} aria-label={`Unlock profile: ${entry.headline}`} className="btn btn-primary btn-sm disabled:opacity-60">
            <Lock className="h-3.5 w-3.5" aria-hidden /> {busy === 'unlock' ? 'Unlocking...' : 'Unlock (uses 1 unlock)'}
          </button>
        ) : null}
        {open ? (
          <button type="button" onClick={() => void startInvite()} aria-label={`Invite to apply: ${entry.headline}`} className="btn btn-outline btn-sm bg-white">
            <Send className="h-3.5 w-3.5" aria-hidden /> Invite to apply
          </button>
        ) : null}
      </div>

      {contact ? (
        <dl className="mt-4 grid gap-1 rounded-xl bg-surface-alt/60 p-4 text-sm" aria-label="Unlocked contact details">
          <div className="flex gap-2">
            <dt className="font-bold text-text-light">Name</dt>
            <dd className="font-extrabold text-text-main">{contact.name}</dd>
          </div>
          {contact.email ? (
            <div className="flex gap-2">
              <dt className="font-bold text-text-light">Email</dt>
              <dd className="font-semibold text-text-main">{contact.email}</dd>
            </div>
          ) : null}
          {contact.phone ? (
            <div className="flex gap-2">
              <dt className="font-bold text-text-light">Phone</dt>
              <dd className="font-semibold text-text-main">{contact.phone}</dd>
            </div>
          ) : null}
          {contact.cv ? (
            <div>
              <EvidenceLink href={contact.cv.url} className="font-bold text-primary hover:underline">
                Open CV{contact.cv.fileName ? ` (${contact.cv.fileName})` : ''}
              </EvidenceLink>
            </div>
          ) : null}
        </dl>
      ) : null}

      {inviting ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm font-bold text-text-main">
            Which job?
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="mt-1 h-11 text-sm font-semibold" aria-label="Job to invite them to">
              <option value="">{jobs && jobs.length === 0 ? 'You have no open jobs' : 'Choose one'}</option>
              {(jobs ?? []).map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={!jobId || busy === 'invite'} onClick={() => void invite()} className="btn btn-primary btn-sm disabled:opacity-60">
            Send invitation
          </button>
        </div>
      ) : null}

      {notice ? (
        <p role="status" className="mt-3 text-sm font-bold text-success">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </li>
  )
}
