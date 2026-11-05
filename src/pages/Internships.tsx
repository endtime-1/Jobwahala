import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  GraduationCap,
  Handshake,
  Hourglass,
  MapPin,
  Rocket,
  Search,
  SlidersHorizontal,
  Wrench,
  X,
} from 'lucide-react'
import CompanyLogo from '../components/CompanyLogo'
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
  durationLabel,
  earlyCareerTypes,
  earlyFilterParams,
  emptyEarlyFilters,
  hasEarlyFilters,
  relevanceScore,
  scheduleLabel,
  sortByRelevance,
  startFilterOptions,
  startLabel,
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

// One tile per kind of opportunity: what it is, in a few plain words.
const typeTiles = [
  { type: 'Internship', icon: GraduationCap, blurb: 'Learn on the job at a real company' },
  { type: 'National Service (NSS)', icon: Building2, blurb: 'Your service year, placed well' },
  { type: 'Industrial Attachment', icon: Wrench, blurb: 'Hands-on work for students' },
  { type: 'Graduate / Entry-level Job', icon: Rocket, blurb: 'Your first full job after school' },
] as const

const selectClass = 'h-11 w-full rounded-xl border border-surface-border bg-white px-3 text-sm font-semibold text-text-main'

/** The filters in use, as small removable chips. */
const activeChips = (filters: EarlyCareerFilters) => {
  const chips: { key: string; label: string; clear: Partial<EarlyCareerFilters> }[] = []
  for (const type of filters.types) chips.push({ key: `type-${type}`, label: type, clear: { types: filters.types.filter((value) => value !== type) } })
  if (filters.search.trim()) chips.push({ key: 'search', label: `"${filters.search.trim()}"`, clear: { search: '' } })
  if (filters.location.trim()) chips.push({ key: 'location', label: filters.location.trim(), clear: { location: '' } })
  const label = (options: readonly { value: string; label: string }[], value: string) => options.find((option) => option.value === value)?.label ?? value
  if (filters.stipend) chips.push({ key: 'stipend', label: label(stipendFilterOptions, filters.stipend), clear: { stipend: '' } })
  if (filters.duration) chips.push({ key: 'duration', label: label(durationFilterOptions, filters.duration), clear: { duration: '' } })
  if (filters.start) chips.push({ key: 'start', label: label(startFilterOptions, filters.start), clear: { start: '' } })
  if (filters.schedule) chips.push({ key: 'schedule', label: scheduleLabel(filters.schedule), clear: { schedule: '' } })
  if (filters.offer) chips.push({ key: 'offer', label: 'Possible job offer', clear: { offer: false } })
  return chips
}

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
  const [filtersOpen, setFiltersOpen] = useState(false)

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
  const chips = activeChips(filters)
  // How many filters sit inside the panel (everything except the search boxes and the type tiles).
  const panelFilterCount = chips.filter((chip) => !['search', 'location'].includes(chip.key) && !chip.key.startsWith('type-')).length

  const update = (patch: Partial<EarlyCareerFilters>) => setFilters((current) => ({ ...current, ...patch }))
  const toggleType = (type: string) =>
    update({ types: filters.types.includes(type) ? filters.types.filter((value) => value !== type) : [...filters.types, type] })

  const alertCriteria = {
    ...(filters.search.trim() ? { query: filters.search.trim() } : {}),
    ...(filters.location.trim() ? { location: filters.location.trim() } : {}),
    jobType: filters.types.length === 1 ? filters.types[0] : 'Internships & NSS',
  }

  return (
    <div className="pb-24">
      <SEO
        title="Internships, National Service and graduate jobs"
        description="Find internships, National Service (NSS) placements, industrial attachments and entry-level graduate jobs. See the stipend, duration and start date before you apply."
        canonical="https://jobwahala.com/internships"
      />

      {/* Top band: what this page is, a search, and the four kinds of opportunity as one-tap choices. */}
      <section className="relative isolate overflow-hidden bg-primary pb-10 pt-28 text-white sm:pb-14 sm:pt-32 xl:pt-36">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(900px 480px at 90% 0%, rgba(47,109,246,0.5), transparent 60%), radial-gradient(600px 380px at 0% 100%, rgba(255,197,49,0.16), transparent 60%)',
          }}
          aria-hidden
        />
        <div className="container">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-gold sm:text-[13px]">
            <GraduationCap className="h-4 w-4" aria-hidden /> For students, NSS personnel and graduates
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Internships <span className="text-gold">&amp; NSS</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-medium leading-snug text-white/80">
            Your first step into work. See the stipend, how long it lasts and when it starts before you apply.
          </p>

          <div role="search" className="mt-7 grid max-w-3xl gap-3 rounded-2xl bg-white p-3 shadow-premium-md sm:grid-cols-[1fr_1fr_auto]">
            <label className="flex items-center gap-2 rounded-xl bg-surface-alt/60 px-3">
              <Search className="h-4 w-4 flex-none text-text-light" aria-hidden />
              <input
                value={filters.search}
                onChange={(e) => update({ search: e.target.value })}
                placeholder="Keyword, e.g. marketing"
                aria-label="Keyword"
                className="h-12 w-full border-0 bg-transparent text-base font-semibold text-text-main outline-none"
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl bg-surface-alt/60 px-3">
              <MapPin className="h-4 w-4 flex-none text-text-light" aria-hidden />
              <input
                value={filters.location}
                onChange={(e) => update({ location: e.target.value })}
                placeholder="Town, e.g. Accra"
                aria-label="Location"
                className="h-12 w-full border-0 bg-transparent text-base font-semibold text-text-main outline-none"
              />
            </label>
            <span className="hidden items-center justify-center rounded-xl bg-gold px-6 text-sm font-extrabold text-primary sm:flex" aria-hidden>
              {isLoading ? 'Searching...' : `${shown.length} open`}
            </span>
          </div>

          <ul aria-label="Kinds of opportunity" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {typeTiles.map(({ type, icon: Icon, blurb }) => {
              const selected = filters.types.includes(type)
              return (
                <li key={type}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleType(type)}
                    className={`flex h-full w-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all ${
                      selected ? 'border-gold bg-white text-primary shadow-premium-md' : 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${selected ? 'text-secondary' : 'text-gold'}`} aria-hidden />
                    <span className="text-base font-extrabold leading-tight">{type}</span>
                    <span className={`hidden text-sm font-medium leading-snug sm:block ${selected ? 'text-text-muted' : 'text-white/70'}`}>{blurb}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <div className="container mt-8">
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

        <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
          {/* On a phone the filters fold away behind a button; on a computer they stay beside the list. */}
          <aside aria-label="Filters" className="self-start lg:sticky lg:top-28">
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="early-filters"
              onClick={() => setFiltersOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm font-extrabold text-text-main lg:hidden"
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters
              </span>
              {panelFilterCount > 0 ? <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-black text-white">{panelFilterCount}</span> : null}
            </button>

            <div id="early-filters" className={`${filtersOpen ? 'mt-3 block' : 'hidden'} space-y-5 rounded-2xl border border-surface-border bg-white p-5 lg:mt-0 lg:block`}>
              <fieldset>
                <legend className="mb-2 text-sm font-black text-text-main">Type</legend>
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
            </div>
          </aside>

          <section aria-label="Opportunities" className="min-w-0">
            <JobAlerts criteria={alertCriteria} isSignedIn={Boolean(user)} isSeeker={user?.role === 'SEEKER'} />

            {/* How many, and the filters in use, each removable with one tap. */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <p aria-live="polite" className="mr-2 text-sm font-extrabold text-text-main">
                {isLoading ? 'Searching...' : error ? '' : `${shown.length} ${shown.length === 1 ? 'opportunity' : 'opportunities'}`}
              </p>
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => update(chip.clear)}
                  aria-label={`Remove filter ${chip.label}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary hover:bg-secondary/20"
                >
                  {chip.label} <X className="h-3 w-3" aria-hidden />
                </button>
              ))}
              {hasEarlyFilters(filters) ? (
                <button type="button" onClick={() => setFilters(emptyEarlyFilters)} className="text-xs font-black uppercase tracking-widest text-primary hover:underline">
                  Clear filters
                </button>
              ) : null}
            </div>

            {error ? (
              <p role="alert" className="mt-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
                {error}
              </p>
            ) : null}

            {isLoading ? (
              <ul aria-label="Loading opportunities" className="mt-4 space-y-4">
                <li className="sr-only">Loading opportunities...</li>
                {[0, 1, 2].map((placeholder) => (
                  <li key={placeholder} aria-hidden className="animate-pulse rounded-2xl border border-surface-border bg-white p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-surface-alt" />
                      <div className="flex-1 space-y-3">
                        <div className="h-5 w-2/3 rounded bg-surface-alt" />
                        <div className="h-4 w-1/3 rounded bg-surface-alt" />
                      </div>
                    </div>
                    <div className="mt-5 h-12 rounded-xl bg-surface-alt" />
                  </li>
                ))}
              </ul>
            ) : null}

            {!isLoading && !error && shown.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-surface-border bg-white p-10 text-center">
                <GraduationCap className="mx-auto h-10 w-10 text-secondary" aria-hidden />
                <p className="mt-3 text-lg font-extrabold text-text-main">
                  {hasEarlyFilters(filters) ? 'Nothing matches those filters yet.' : 'No opportunities are open right now.'}
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm font-medium text-text-muted">
                  {hasEarlyFilters(filters) ? 'Try fewer filters, or save an alert and we will tell you when one is posted.' : 'Save an alert above and we will tell you when one is posted.'}
                </p>
              </div>
            ) : null}

            {!isLoading ? (
              <ul aria-label="Results" className="mt-4 space-y-4">
                {shown.map((job) => {
                  const company = job.employer.employerProfile?.companyName || emailHandle(job.employer.email)
                  const suits = stage ? relevanceScore(stage, job.type) >= 3 : false
                  const facts = [
                    { icon: Hourglass, text: durationLabel(job.durationMonths) },
                    { icon: Clock, text: scheduleLabel(job.schedule) },
                    { icon: CalendarDays, text: startLabel(job) },
                  ].filter((fact) => fact.text)

                  return (
                    <li key={job.id} className="rounded-2xl border border-surface-border bg-white p-5 transition-all hover:border-secondary/40 hover:shadow-premium-md sm:p-6">
                      <div className="flex items-start gap-4">
                        <CompanyLogo name={company} logoUrl={job.employer.employerProfile?.logoUrl} className="h-14 w-14 flex-none rounded-2xl text-lg" />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-secondary">
                            {job.type}
                            {suits ? <span className="rounded-full bg-gold px-2.5 py-0.5 text-[11px] normal-case tracking-normal text-primary">Suits you</span> : null}
                          </p>
                          <h2 className="mt-1 text-xl font-extrabold leading-snug tracking-tight text-text-main">
                            <Link to={`/jobs/${job.id}`} className="hover:text-secondary hover:underline">
                              {job.title}
                            </Link>
                          </h2>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold text-text-muted">
                            <Link to={`/companies/${job.employer.id}`} className="hover:text-secondary hover:underline">
                              {company}
                            </Link>
                            <VerifiedBadge type="employer" status={job.employer.isVerified ? 'APPROVED' : 'UNVERIFIED'} hideWhenUnverified showText={false} />
                            {job.employer.isVerified ? null : <UnverifiedEmployerLabel />}
                          </p>
                          {job.location ? (
                            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted">
                              <MapPin className="h-3.5 w-3.5 text-secondary" aria-hidden /> {job.location}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-none items-center gap-1">
                          <ShareOnWhatsApp job={{ id: job.id, title: job.title, companyName: company, location: job.location, salary: job.salary, unpaid: job.unpaid }} />
                          <SaveJobButton jobId={job.id} className="flex-none" />
                        </div>
                      </div>

                      {/* The stipend is the first thing people look for, so it gets its own strip. */}
                      <ul aria-label="Early-career details" className="mt-5 flex flex-wrap items-stretch gap-2">
                        <li
                          className={`flex items-center rounded-xl px-4 py-2 text-base font-black ${job.unpaid ? 'bg-surface-alt text-text-main' : job.salary?.trim() ? 'bg-success/10 text-success' : 'bg-surface-alt text-text-muted'}`}
                        >
                          {job.unpaid ? 'Unpaid' : job.salary?.trim() ? `Stipend: ${job.salary.trim()}` : 'Stipend not stated'}
                        </li>
                        {facts.map(({ icon: Icon, text }) => (
                          <li key={text} className="inline-flex items-center gap-1.5 rounded-xl bg-surface-alt px-3 py-2 text-sm font-bold text-text-muted">
                            <Icon className="h-3.5 w-3.5 text-secondary" aria-hidden /> {text}
                          </li>
                        ))}
                        {job.possibleJobOffer ? (
                          <li className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3 py-2 text-sm font-extrabold text-primary">
                            <Handshake className="h-3.5 w-3.5" aria-hidden /> Possible job offer after
                          </li>
                        ) : null}
                      </ul>

                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-surface-border pt-4">
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
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}
