import { Search, MapPin, Clock, ChevronRight, Flag, Sparkles, Briefcase, ShieldCheck, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import ReportModal from '../components/ReportModal'
import CompanyLogo from '../components/CompanyLogo'
import VerifiedBadge from '../components/VerifiedBadge'
import UnverifiedEmployerLabel from '../components/UnverifiedEmployerLabel'
import SaveJobButton from '../components/SaveJobButton'
import ShareOnWhatsApp from '../components/ShareOnWhatsApp'
import { apiCompareJobs, apiGetJobs } from '../lib/api'
import { emailHandle, formatMoney, formatRelativeTime } from '../lib/display'
import {
  formatJobLocationWithWorkMode,
  getJobWorkModeBadgeClass,
  getJobWorkModeLabel,
  isRemoteJob,
} from '../lib/workMode'
import { useAuth } from '../context/AuthContext'
import SEO from '../components/SEO'
import JobAlerts from '../components/JobAlerts'
import { alertCriteriaFromFilters } from '../lib/jobAlerts'
import { countryFromSlug, matchesJobField, matchesSalaryFloor, parseJobType, parseSalaryFloor, salaryFloorOptions } from '../lib/jobSearch'
import { getErrorMessage } from '../lib/errors'
import { earlyCareerTypes } from '../lib/earlyCareer'
import EarlyCareerChips from '../components/EarlyCareerChips'

type JobRecord = {
  id: string
  title: string
  description: string
  location?: string | null
  salary?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  currency?: string | null
  type: string
  unpaid?: boolean
  durationMonths?: number | null
  startsImmediately?: boolean
  startDate?: string | null
  schedule?: string | null
  possibleJobOffer?: boolean
  category?: string | null
  createdAt: string
  matchScore?: number
  matchReasons?: string[]
  employer: {
    id: string
    email: string
    verificationStatus?: string | null
    isVerified?: boolean
    employerProfile?: {
      companyName?: string | null
      logoUrl?: string | null
    } | null
  }
}

type JobComparisonRecord = {
  summary: string
  comparedCount: number
  jobs: JobRecord[]
}

const jobTypes: string[] = ['Full-time', 'Part-time', 'Contract', 'Freelance', ...earlyCareerTypes]
const locationOptions = ['All of Africa', 'Ghana', 'Nigeria', 'Kenya', 'South Africa', 'Rwanda', 'Remote Only']

export default function JobListings() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null)
  const [searchParams] = useSearchParams()
  const { country } = useParams()
  const countryName = countryFromSlug(country)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [town, setTown] = useState(() => countryName || (searchParams.get('location') ?? ''))
  const [category, setCategory] = useState(() => searchParams.get('category') ?? '')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => {
    const wanted = parseJobType(searchParams.get('type'))
    return wanted ? [wanted] : jobTypes
  })
  const [selectedLocation, setSelectedLocation] = useState('All of Africa')
  const [onlyVerified, setOnlyVerified] = useState(() => searchParams.get('verified') === '1')
  const [minSalary, setMinSalary] = useState(() => parseSalaryFloor(searchParams.get('minSalary')))
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [comparison, setComparison] = useState<JobComparisonRecord | null>(null)
  const [comparisonError, setComparisonError] = useState('')
  const [isComparing, setIsComparing] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const navigate = useNavigate()

  const commonSkills = useMemo(() => [
    'React', 'Node.js', 'TypeScript', 'Python', 'UX Design', 'UI Design',
    'Product Management', 'DevOps', 'AWS', 'Mobile App', 'Backend', 'Frontend',
    'Fullstack', 'Data Analytics', 'Accra', 'Kumasi', 'Remote'
  ], [])

  const suggestions = useMemo(() => {
    if (!search || search.length < 2) return []
    return commonSkills.filter(s => s.toLowerCase().includes(search.toLowerCase()) && s.toLowerCase() !== search.toLowerCase()).slice(0, 5)
  }, [search, commonSkills])

  useEffect(() => {
    apiGetJobs()
      .then((data) => {
        setJobs(data.jobs as JobRecord[])
        setError('')
      })
      .catch((err: any) => {
        setError(err.message || 'Unable to load jobs right now.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((value) => value !== type) : [...prev, type],
    )
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const companyName = job.employer.employerProfile?.companyName || emailHandle(job.employer.email)
      const q = search.toLowerCase()
      const location = formatJobLocationWithWorkMode(job.location)
      const workMode = getJobWorkModeLabel(job.location)
      const matchesSearch =
        !search ||
        job.title.toLowerCase().includes(q) ||
        companyName.toLowerCase().includes(q) ||
        location.toLowerCase().includes(q) ||
        workMode.toLowerCase().includes(q) ||
        (job.category || '').toLowerCase().includes(q)

      const matchesTown = !town.trim() || location.toLowerCase().includes(town.trim().toLowerCase())

      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(job.type)
      const matchesField = matchesJobField(job.category, category)

      const matchesLocation =
        selectedLocation === 'All of Africa' ||
        (selectedLocation === 'Remote Only' && isRemoteJob(job.location)) ||
        location.toLowerCase().includes(selectedLocation.toLowerCase())

      const matchesVerified = !onlyVerified || Boolean(job.employer.isVerified)
      const matchesPay = matchesSalaryFloor(job, minSalary)

      return matchesSearch && matchesType && matchesLocation && matchesTown && matchesField && matchesVerified && matchesPay
    })
  }, [jobs, search, selectedLocation, selectedTypes, town, category, onlyVerified, minSalary])

  const remoteCount = useMemo(
    () => jobs.filter((job) => isRemoteJob(job.location)).length,
    [jobs],
  )
  const canCompareJobs = user?.role === 'SEEKER'

  const freshCount = useMemo(
    () => jobs.filter((job) => Date.now() - new Date(job.createdAt).getTime() < 1000 * 60 * 60 * 72).length,
    [jobs],
  )

  const selectedComparisonJobs = useMemo(
    () =>
      selectedJobIds
        .map((jobId) => jobs.find((job) => job.id === jobId) || null)
        .filter(Boolean) as JobRecord[],
    [jobs, selectedJobIds],
  )

  useEffect(() => {
    const availableJobIds = new Set(jobs.map((job) => job.id))
    setSelectedJobIds((current) => current.filter((jobId) => availableJobIds.has(jobId)))
  }, [jobs])

  const toggleComparisonSelection = (jobId: string) => {
    setComparison(null)
    setComparisonError('')
    setSelectedJobIds((current) => {
      if (current.includes(jobId)) {
        return current.filter((value) => value !== jobId)
      }

      if (current.length >= 3) {
        return current
      }

      return [...current, jobId]
    })
  }

  const handleGenerateComparison = async () => {
    if (selectedJobIds.length < 2) {
      return
    }

    setComparisonError('')
    setIsComparing(true)

    try {
      const data = await apiCompareJobs(selectedJobIds)
      setComparison((data.comparison || null) as JobComparisonRecord | null)
    } catch (err) {
      setComparisonError(getErrorMessage(err, 'Unable to compare these job options right now.'))
    } finally {
      setIsComparing(false)
    }
  }

  const hasActiveFilters =
    Boolean(search.trim()) ||
    Boolean(town.trim()) ||
    Boolean(category.trim()) ||
    selectedLocation !== 'All of Africa' ||
    onlyVerified ||
    minSalary > 0 ||
    selectedTypes.length !== jobTypes.length

  const clearFilters = () => {
    setSearch('')
    setTown('')
    setCategory('')
    setSelectedLocation('All of Africa')
    setOnlyVerified(false)
    setMinSalary(0)
    setSelectedTypes(jobTypes)
  }

  return (
    <div className="pb-24 pt-24 xl:pt-28">
      <SEO
        title={countryName ? `Jobs in ${countryName} - real jobs from employers you can check` : 'Find Jobs Across Africa'}
        description={
          countryName
            ? `Browse and apply for real jobs in ${countryName}. See the pay and location before you apply, and track every application.`
            : 'Browse and apply for real jobs across Africa. See the pay and location before you apply, and track every application.'
        }
        keywords={`jobs in ${countryName || 'africa'}, apply for jobs, hiring in ${countryName || 'africa'}, jobwahala`}
      />

      <div className="container">
        <header
          className="relative overflow-hidden rounded-[2rem] px-5 py-8 text-white sm:px-9 sm:py-11"
          style={{
            background:
              'radial-gradient(700px 360px at 100% 0%, rgba(47,109,246,0.5), transparent 60%), radial-gradient(500px 300px at 0% 100%, rgba(255,197,49,0.16), transparent 60%), #101a2b',
          }}
        >
          <div className="heritage-strip absolute inset-x-0 top-0" aria-hidden />
          <p className="page-eyebrow">{countryName ? `Jobs in ${countryName}` : 'Find your next job'}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {countryName ? `Real jobs in ${countryName}.` : 'Real jobs across Africa.'} <span className="text-gold">Apply in minutes.</span>
          </h1>

          <div className="relative mt-7 rounded-2xl bg-white p-2 shadow-premium-xl sm:flex sm:items-center sm:gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-light" />
              <input
                type="text"
                aria-label="Job title or keyword"
                placeholder="Job title, skill or company"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full rounded-xl border-none bg-transparent py-4 pl-12 pr-4 text-base font-semibold text-text-main focus:ring-2 focus:ring-secondary/25"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-surface-border bg-white p-3 shadow-premium-lg">
                  <p className="mb-2 px-2 text-xs font-bold text-text-light">Suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setSearch(suggestion)
                          setShowSuggestions(false)
                        }}
                        className="rounded-xl border border-surface-border px-4 py-2 text-sm font-bold text-text-muted transition-colors hover:bg-secondary/10 hover:text-secondary"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative mt-1 flex-1 border-t border-surface-border sm:mt-0 sm:border-l sm:border-t-0">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-light" />
              <input
                id="town-filter"
                type="text"
                aria-label="Town or city"
                placeholder="Town or city"
                value={town}
                onChange={(event) => setTown(event.target.value)}
                className="w-full rounded-xl border-none bg-transparent py-4 pl-12 pr-4 text-base font-semibold text-text-main focus:ring-2 focus:ring-secondary/25"
              />
            </div>
            <a href="#results" className="btn btn-gold btn-lg mt-2 w-full justify-center px-8 sm:mt-0 sm:w-auto">
              Search jobs
            </a>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Country">
            {locationOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSelectedLocation(option)}
                aria-pressed={selectedLocation === option}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                  selectedLocation === option
                    ? 'border-gold bg-gold text-primary'
                    : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {!isLoading && !error ? (
            <p className="mt-5 text-sm font-semibold text-white/70">
              {jobs.length} open {jobs.length === 1 ? 'role' : 'roles'}
              {jobs.length < 10 ? ' · more appear as employers post them' : ''}
              {freshCount > 0 ? ` · ${freshCount} new in the last 3 days` : ''}
              {remoteCount > 0 ? ` · ${remoteCount} remote` : ''}
            </p>
          ) : null}
        </header>

        <div id="results" className="mt-6 scroll-mt-28 space-y-5">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-surface-border bg-white p-3 sm:p-4">
            {category.trim() ? (
              <button
                type="button"
                onClick={() => setCategory('')}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-2 text-sm font-extrabold text-primary"
                aria-label={`Remove field filter ${category}`}
              >
                {category} <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <span className="mr-1 hidden text-sm font-bold text-text-muted sm:inline">Job type</span>
            {jobTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                aria-pressed={selectedTypes.includes(type)}
                className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                  selectedTypes.includes(type)
                    ? 'border-secondary bg-secondary/10 text-secondary'
                    : 'border-surface-border bg-white text-text-muted hover:border-secondary/40'
                }`}
              >
                {type}
              </button>
            ))}
            <label className="inline-flex items-center gap-2 text-sm font-bold text-text-muted">
              <span>Pay from</span>
              <select
                value={minSalary}
                onChange={(event) => setMinSalary(Number(event.target.value))}
                aria-label="Pay from"
                className="h-10 rounded-full border border-surface-border bg-white px-3 text-sm font-bold text-text-main"
              >
                {salaryFloorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="sr-only">a month. Jobs that do not show pay as numbers are hidden while this is on.</span>
            </label>
            <button
              type="button"
              onClick={() => setOnlyVerified((value) => !value)}
              aria-pressed={onlyVerified}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                onlyVerified
                  ? 'border-success bg-success/10 text-success'
                  : 'border-surface-border bg-white text-text-muted hover:border-success/40'
              }`}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden /> Verified employers only
            </button>
            <div className="ml-auto flex items-center gap-3">
              <p className="text-sm font-bold text-text-main">
                {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-3 py-1.5 text-sm font-bold text-text-muted hover:text-text-main"
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              ) : null}
            </div>
          </div>

          <JobAlerts
            criteria={alertCriteriaFromFilters({ search, selectedTypes, allTypes: jobTypes, selectedLocation, town })}
            isSignedIn={Boolean(user)}
            isSeeker={user?.role === 'SEEKER'}
          />

          {canCompareJobs ? (
            <section className="dashboard-panel overflow-hidden p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">AI Role Comparison</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-text-main">
                    Compare your strongest job options.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm font-medium text-text-muted">
                    Select two or three roles below and generate a decision brief around role fit, location signal, and the strongest visible match reasons.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateComparison}
                  disabled={selectedJobIds.length < 2 || isComparing}
                  className="btn btn-primary btn-sm px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> {isComparing ? 'Comparing...' : 'Generate AI Comparison'}
                </button>
              </div>

              {selectedComparisonJobs.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {selectedComparisonJobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => toggleComparisonSelection(job.id)}
                      className="rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary hover:text-white"
                    >
                      {job.title} selected
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.8rem] border border-dashed border-surface-border bg-surface-alt/30 px-5 py-6">
                  <p className="text-sm font-bold text-text-main">No role options selected yet.</p>
                  <p className="mt-2 text-sm font-medium text-text-muted">
                    Pick up to three roles from the listing cards to generate a side-by-side comparison brief.
                  </p>
                </div>
              )}

              {comparisonError ? (
                <div className="mt-5 rounded-[1.6rem] border border-error/10 bg-error/5 px-5 py-4">
                  <p className="text-sm font-semibold text-error">{comparisonError}</p>
                </div>
              ) : null}

              {comparison ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.8rem] border border-primary/10 bg-primary/5 px-5 py-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                        {comparison.comparedCount} roles compared
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-light">
                        Ranked by current seeker fit
                      </p>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-7 text-text-main">{comparison.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    {comparison.jobs.map((job) => {
                      const companyName = job.employer.employerProfile?.companyName || emailHandle(job.employer.email)
                      const workModeLabel = getJobWorkModeLabel(job.location)

                      return (
                        <div key={job.id} className="rounded-[1.8rem] border border-surface-border bg-surface-alt/35 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-black tracking-tight text-text-main">{job.title}</p>
                              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-text-light">
                                {companyName}
                              </p>
                            </div>
                            <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                              {job.matchScore ?? 0}% fit
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className={`badge border-none text-[9px] uppercase tracking-widest ${getJobWorkModeBadgeClass(job.location)}`}>
                              {workModeLabel}
                            </span>
                            <p className="text-sm font-bold text-text-main">
                              {formatJobLocationWithWorkMode(job.location)} / {job.type}
                            </p>
                          </div>
                          <p className="mt-2 text-sm font-medium text-text-muted">
                            {job.salary ? formatMoney(job.salary, job.currency || 'GHS') : 'Salary on request'}{job.category ? ` / ${job.category}` : ''}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {(job.matchReasons || []).slice(0, 3).map((reason) => (
                              <span
                                key={`${job.id}-${reason}`}
                                className="rounded-full border border-surface-border bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-muted"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {isLoading ? (
            <div className="grid gap-4 xl:grid-cols-2" aria-label="Loading jobs">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-56 animate-pulse rounded-2xl border border-surface-border bg-white" />
              ))}
              <p className="sr-only">Loading live opportunities...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-error/20 bg-white p-6 sm:p-10">
              <p className="text-sm font-semibold text-error">{error}</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-border bg-white px-6 py-16 text-center">
              <Briefcase className="mx-auto h-10 w-10 text-text-light" />
              <p className="mt-4 text-2xl font-black text-text-main">No positions found</p>
              <p className="mx-auto mt-2 max-w-md font-medium text-text-muted">
                Try adjusting your search or filters, or set an alert and we will tell you when a matching job is posted.
              </p>
              {hasActiveFilters ? (
                <button type="button" onClick={clearFilters} className="btn btn-primary mt-6 px-6">
                  Clear all filters
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredJobs.map((job) => {
                const companyName = job.employer.employerProfile?.companyName || emailHandle(job.employer.email)
                const location = formatJobLocationWithWorkMode(job.location)
                const workModeLabel = getJobWorkModeLabel(job.location)
                const isNew = Date.now() - new Date(job.createdAt).getTime() < 1000 * 60 * 60 * 72

                return (
                  <article
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="group relative flex cursor-pointer flex-col gap-4 rounded-2xl border border-surface-border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-premium-md sm:p-6"
                  >
                    <div className="flex items-start gap-4">
                      <CompanyLogo
                        name={companyName}
                        logoUrl={job.employer.employerProfile?.logoUrl}
                        className="h-14 w-14 flex-none rounded-2xl text-lg sm:h-16 sm:w-16 sm:text-xl"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-extrabold leading-snug tracking-tight text-text-main transition-colors group-hover:text-secondary">
                            {job.title}
                          </h3>
                          {isNew ? <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-extrabold text-primary">New</span> : null}
                          <VerifiedBadge
                            type="employer"
                            status={job.employer.isVerified ? 'APPROVED' : 'UNVERIFIED'}
                            hideWhenUnverified
                            showText={false}
                          />
                          {job.employer.isVerified ? null : <UnverifiedEmployerLabel />}
                        </div>
                        <Link
                          to={`/companies/${job.employer.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="mt-0.5 inline-block text-sm font-bold text-text-muted hover:text-secondary hover:underline"
                        >
                          {companyName}
                        </Link>
                      </div>
                      <ShareOnWhatsApp job={{ id: job.id, title: job.title, companyName, location: job.location, salary: job.salary, unpaid: job.unpaid }} />
                      <SaveJobButton jobId={job.id} className="flex-none" />
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          setReportTarget({ id: job.id, name: companyName })
                        }}
                        className="rounded-lg border border-transparent p-2 text-text-light transition-all hover:border-error/10 hover:bg-error/5 hover:text-error"
                        title="Report this job"
                        aria-label="Report this job"
                      >
                        <Flag className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="line-clamp-2 text-sm font-medium leading-relaxed text-text-muted">{job.description}</p>

                    <div className="flex flex-wrap gap-2 text-sm font-bold text-text-muted">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-3 py-1">
                        <MapPin className="h-3.5 w-3.5 text-secondary" /> {location}
                      </span>
                      <span className="rounded-full bg-surface-alt px-3 py-1">{job.type}</span>
                      <span className={`rounded-full px-3 py-1 ${getJobWorkModeBadgeClass(job.location)}`}>{workModeLabel}</span>
                      {job.category ? <span className="rounded-full bg-surface-alt px-3 py-1">{job.category}</span> : null}
                    </div>

                    <EarlyCareerChips job={job} />

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-4">
                      <div>
                        <p className="text-lg font-black tracking-tight text-text-main">{job.salary || 'Salary on request'}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-text-light">
                          <Clock className="h-3.5 w-3.5" /> Posted {formatRelativeTime(job.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canCompareJobs ? (
                          <button
                            type="button"
                            aria-label={`Compare ${job.title}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleComparisonSelection(job.id)
                            }}
                            disabled={!selectedJobIds.includes(job.id) && selectedJobIds.length >= 3}
                            className={`btn btn-sm px-4 ${
                              selectedJobIds.includes(job.id)
                                ? 'border-primary/20 bg-primary text-white hover:bg-primary-dark'
                                : 'btn-outline border-surface-border text-text-main'
                            } disabled:cursor-not-allowed disabled:opacity-40`}
                          >
                            {selectedJobIds.includes(job.id) ? 'Selected' : 'Compare'}
                          </button>
                        ) : null}
                        <span className="btn btn-primary btn-sm px-4">
                          View job <ChevronRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          {!isLoading && !error && filteredJobs.length < 10 ? (
            <aside className="rounded-2xl bg-primary p-6 text-white sm:p-8">
              <p className="text-sm font-extrabold uppercase tracking-wide text-gold">For employers</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Be among the first employers here</h2>
              <p className="mt-2 max-w-xl font-medium text-white/75">
                Post your job free and it shows here straight away. Your company gets its own page, and you review every applicant on one board.
              </p>
              <Link to="/onboarding?role=employer" className="btn btn-gold btn-lg mt-5 inline-flex justify-center px-8">
                Post a job for free
              </Link>
            </aside>
          ) : null}
        </div>
      </div>

      <ReportModal
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        type="job"
        targetId={reportTarget?.id || ''}
        targetName={reportTarget?.name || ''}
      />
    </div>
  )
}
