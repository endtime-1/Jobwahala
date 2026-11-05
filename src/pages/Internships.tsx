import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Clock, GraduationCap, MapPin } from 'lucide-react'
import CompanyLogo from '../components/CompanyLogo'
import EarlyCareerChips from '../components/EarlyCareerChips'
import JobAlerts from '../components/JobAlerts'
import SEO from '../components/SEO'
import SaveJobButton from '../components/SaveJobButton'
import ShareOnWhatsApp from '../components/ShareOnWhatsApp'
import UnverifiedEmployerLabel from '../components/UnverifiedEmployerLabel'
import VerifiedBadge from '../components/VerifiedBadge'
import { useAuth } from '../context/AuthContext'
import { apiGetJobs } from '../lib/api'
import { emailHandle, formatRelativeTime } from '../lib/display'
import {
  careerStageLabel,
  durationFilterOptions,
  earlyCareerTypes,
  earlyFilterParams,
  emptyEarlyFilters,
  hasEarlyFilters,
  relevanceScore,
  sortByRelevance,
  startFilterOptions,
  stipendFilterOptions,
  type EarlyCareerFilters,
} from '../lib/earlyCareer'
import { getErrorMessage } from '../lib/errors'

type EarlyJob = {
  id: string
  title: string
  description: string
  location?: string | null
  salary?: string | null
  type: string
  unpaid?: boolean
  durationMonths?: number | null
  startsImmediately?: boolean
  startDate?: string | null
  schedule?: string | null
  possibleJobOffer?: boolean
  createdAt: string
  employer: {
    id: string
    email: string
    isVerified?: boolean
    employerProfile?: { companyName?: string | null; logoUrl?: string | null } | null
  }
}

const selectClass = 'h-11 w-full rounded-xl border border-surface-border bg-white px-3 text-sm font-semibold text-text-main'

export default function Internships() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const stage = user?.role === 'SEEKER' ? user.jobSeekerProfile?.careerStage ?? '' : ''

  const [filters, setFilters] = useState<EarlyCareerFilters>(() => {
    const wanted = earlyCareerTypes.find((type) => type.toLowerCase() === (searchParams.get('type') ?? '').trim().toLowerCase())
    return { ...emptyEarlyFilters, types: wanted ? [wanted] : [], search: searchParams.get('search') ?? '', location: searchParams.get('location') ?? '' }
  })
  const [jobs, setJobs] = useState<EarlyJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const params = useMemo(() => earlyFilterParams(filters), [filters])

  useEffect(() => {
    let cancelled = false
    // A short pause so typing in a box does not search on every letter.
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      apiGetJobs(params)
        .then((data: { jobs?: EarlyJob[] }) => {
          if (cancelled) return
          setJobs(Array.isArray(data.jobs) ? data.jobs : [])
          setError('')
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(getErrorMessage(err, 'We could not load opportunities right now. Please try again.'))
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [params])

  const shown = useMemo(() => sortByRelevance(jobs, stage), [jobs, stage])
  const update = (patch: Partial<EarlyCareerFilters>) => setFilters((current) => ({ ...current, ...patch }))
  const toggleType = (type: string) =>
    update({ types: filters.types.includes(type) ? filters.types.filter((value) => value !== type) : [...filters.types, type] })

  const alertCriteria = {
    ...(filters.search.trim() ? { query: filters.search.trim() } : {}),
    ...(filters.location.trim() ? { location: filters.location.trim() } : {}),
    jobType: filters.types.length === 1 ? filters.types[0] : 'Internships & NSS',
  }

  return (
    <div className="pb-24 pt-24 xl:pt-28">
      <SEO
        title="Internships, National Service and graduate jobs"
        description="Find internships, National Service (NSS) placements, industrial attachments and entry-level graduate jobs. See the stipend, duration and start date before you apply."
        canonical="https://jobwahala.com/internships"
      />

      <div className="container">
        <header className="mb-8 max-w-3xl">
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-secondary">
            <GraduationCap className="h-4 w-4" aria-hidden /> For students, NSS personnel and graduates
          </p>
          <h1 className="text-3xl font-black tracking-tight text-text-main sm:text-4xl">Internships &amp; NSS</h1>
          <p className="mt-2 text-base font-medium text-text-muted">
            Internships, National Service placements, industrial attachments and entry-level jobs. The stipend, how long it lasts and when it
            starts are shown up front.
          </p>
        </header>

        {user?.role === 'SEEKER' ? (
          stage ? (
            <p className="mb-6 rounded-2xl border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm font-semibold text-text-main">
              You are set as: {careerStageLabel(stage)}. We show the opportunities that suit you first.
            </p>
          ) : (
            <p className="mb-6 rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-semibold text-text-muted">
              Are you a student, doing National Service, or a graduate?{' '}
              <Link to="/dashboard" className="font-bold text-primary hover:underline">
                Tell us on your dashboard
              </Link>{' '}
              and we will show the most relevant opportunities first.
            </p>
          )
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
          <aside aria-label="Filters" className="space-y-5 self-start rounded-2xl border border-surface-border bg-white p-5">
            <label className="block text-sm font-bold text-text-main">
              Keyword
              <input
                value={filters.search}
                onChange={(e) => update({ search: e.target.value })}
                placeholder="e.g. marketing, accounting"
                className="mt-1 h-11 w-full text-sm font-semibold"
              />
            </label>

            <fieldset>
              <legend className="mb-2 text-sm font-bold text-text-main">Type</legend>
              <div className="space-y-2">
                {earlyCareerTypes.map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm font-semibold text-text-main">
                    <input type="checkbox" checked={filters.types.includes(type)} onChange={() => toggleType(type)} />
                    {type}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm font-bold text-text-main">
              Location
              <input value={filters.location} onChange={(e) => update({ location: e.target.value })} placeholder="e.g. Accra, Kumasi, Remote" className="mt-1 h-11 w-full text-sm font-semibold" />
            </label>

            <label className="block text-sm font-bold text-text-main">
              Stipend
              <select value={filters.stipend} onChange={(e) => update({ stipend: e.target.value })} className={`mt-1 ${selectClass}`}>
                {stipendFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-text-main">
              Duration
              <select value={filters.duration} onChange={(e) => update({ duration: e.target.value })} className={`mt-1 ${selectClass}`}>
                {durationFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-text-main">
              Start date
              <select value={filters.start} onChange={(e) => update({ start: e.target.value })} className={`mt-1 ${selectClass}`}>
                {startFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-text-main">
              Hours
              <select value={filters.schedule} onChange={(e) => update({ schedule: e.target.value })} className={`mt-1 ${selectClass}`}>
                <option value="">Part-time or full-time</option>
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm font-bold text-text-main">
              <input type="checkbox" checked={filters.offer} onChange={(e) => update({ offer: e.target.checked })} />
              Possible job offer after
            </label>

            {hasEarlyFilters(filters) ? (
              <button type="button" onClick={() => setFilters(emptyEarlyFilters)} className="text-xs font-black uppercase tracking-widest text-primary hover:underline">
                Clear filters
              </button>
            ) : null}
          </aside>

          <section aria-label="Opportunities" className="min-w-0">
            <JobAlerts criteria={alertCriteria} isSignedIn={Boolean(user)} isSeeker={user?.role === 'SEEKER'} />

            {error ? (
              <p role="alert" className="mt-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
                {error}
              </p>
            ) : null}

            {isLoading ? <p className="mt-6 text-sm font-bold text-text-light">Loading opportunities...</p> : null}

            {!isLoading && !error && shown.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-surface-border bg-white p-8 text-center">
                <p className="text-lg font-extrabold text-text-main">
                  {hasEarlyFilters(filters) ? 'Nothing matches those filters yet.' : 'No opportunities are open right now.'}
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm font-medium text-text-muted">
                  {hasEarlyFilters(filters) ? 'Try fewer filters, or save an alert and we will tell you when one is posted.' : 'Save an alert above and we will tell you when one is posted.'}
                </p>
              </div>
            ) : null}

            <ul aria-label="Results" className="mt-4 space-y-4">
              {shown.map((job) => {
                const company = job.employer.employerProfile?.companyName || emailHandle(job.employer.email)
                const suits = stage ? relevanceScore(stage, job.type) >= 3 : false

                return (
                  <li key={job.id} className="relative rounded-2xl border border-surface-border bg-white p-5 transition-all hover:border-secondary/40 hover:shadow-premium-md sm:p-6">
                    <div className="flex items-start gap-4">
                      <CompanyLogo name={company} logoUrl={job.employer.employerProfile?.logoUrl} className="h-14 w-14 flex-none rounded-2xl text-lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-extrabold leading-snug tracking-tight text-text-main">
                            <Link to={`/jobs/${job.id}`} className="hover:text-secondary hover:underline">
                              {job.title}
                            </Link>
                          </h2>
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-extrabold text-primary">{job.type}</span>
                          {suits ? <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-extrabold text-primary">Suits you</span> : null}
                          <VerifiedBadge type="employer" status={job.employer.isVerified ? 'APPROVED' : 'UNVERIFIED'} hideWhenUnverified showText={false} />
                          {job.employer.isVerified ? null : <UnverifiedEmployerLabel />}
                        </div>
                        <Link to={`/companies/${job.employer.id}`} className="mt-0.5 inline-block text-sm font-bold text-text-muted hover:text-secondary hover:underline">
                          {company}
                        </Link>
                      </div>
                      <ShareOnWhatsApp job={{ id: job.id, title: job.title, companyName: company, location: job.location, salary: job.salary, unpaid: job.unpaid }} />
                      <SaveJobButton jobId={job.id} className="flex-none" />
                    </div>

                    <div className="mt-4 space-y-3">
                      {job.location ? (
                        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-text-muted">
                          <MapPin className="h-3.5 w-3.5 text-secondary" aria-hidden /> {job.location}
                        </p>
                      ) : null}
                      <EarlyCareerChips job={job} />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-surface-border pt-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-text-light">
                        <Clock className="h-3.5 w-3.5" aria-hidden /> Posted {formatRelativeTime(job.createdAt)}
                      </p>
                      <Link to={`/jobs/${job.id}`} className="btn btn-primary btn-sm px-4">
                        View and apply <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
