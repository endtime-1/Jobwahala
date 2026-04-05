import { Search, MapPin, Clock, Filter, ChevronRight, Flag, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import ReportModal from '../components/ReportModal'
import VerifiedBadge from '../components/VerifiedBadge'
import { apiCompareJobs, apiGetJobs } from '../lib/api'
import { emailHandle, formatMoney, formatRelativeTime, getInitials } from '../lib/display'
import {
  formatJobLocationWithWorkMode,
  getJobWorkModeBadgeClass,
  getJobWorkModeLabel,
  isRemoteJob,
} from '../lib/workMode'
import { useAuth } from '../context/AuthContext'
import SEO from '../components/SEO'

type JobRecord = {
  id: string
  title: string
  description: string
  location?: string | null
  salary?: string | null
  currency?: string | null
  type: string
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
    } | null
  }
}

type JobComparisonRecord = {
  summary: string
  comparedCount: number
  jobs: JobRecord[]
}

const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Freelance']
const locationOptions = ['All of Africa', 'Ghana', 'Nigeria', 'Kenya', 'South Africa', 'Rwanda', 'Remote Only']

export default function JobListings() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null)
  const [search, setSearch] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(jobTypes)
  const [selectedLocation, setSelectedLocation] = useState('All of Africa')
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

      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(job.type)

      const matchesLocation =
        selectedLocation === 'All of Africa' ||
        (selectedLocation === 'Remote Only' && isRemoteJob(job.location)) ||
        location.toLowerCase().includes(selectedLocation.toLowerCase())

      return matchesSearch && matchesType && matchesLocation
    })
  }, [jobs, search, selectedLocation, selectedTypes])

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
    } catch (err: any) {
      setComparisonError(err.message || 'Unable to compare these job options right now.')
    } finally {
      setIsComparing(false)
    }
  }

  return (
    <div className="container animate-in fade-in pt-24 pb-24 duration-700 md:pt-28 xl:pt-32">
      <SEO 
        title="Find Tech & Design Jobs in Ghana"
        description="Filter and apply for elite full-time, contract, and freelance roles in Accra and across Ghana. Updated daily with high-growth global opportunities."
        keywords="jobs in ghana, accra tech careers, remote jobs africa, software engineering ghana"
      />
      <header className="dashboard-hero mb-8 px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="dashboard-kicker mb-4">
              <Filter className="h-3.5 w-3.5" /> Role discovery
            </div>
            <h1 className="mb-3 text-4xl font-black tracking-tighter text-text-main md:text-5xl">
              Find work that feels like momentum.
            </h1>
            <p className="text-base font-medium tracking-tight text-text-muted md:text-lg">
              Search live backend roles, narrow by location or work type, and move from discovery to application without leaving the app shell.
            </p>
            <div className="dashboard-actions hidden lg:flex">
              {jobTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`dashboard-action-chip ${selectedTypes.includes(type) ? 'border-primary/30 bg-primary/10 text-primary' : ''}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="dashboard-panel grid min-w-0 grid-cols-3 gap-3 px-5 py-5 sm:min-w-[20rem] sm:px-6">
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{jobs.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Open</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{freshCount}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Fresh</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{remoteCount}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Remote</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <aside className="hidden lg:block">
          <div className="dashboard-panel sticky top-28 bg-surface-alt/30 p-5 sm:p-6">
            <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-3 mb-8 text-text-main">
              <Filter className="h-4 w-4 text-primary" /> Refine Search
            </h3>
            <div className="space-y-10">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mb-5 block">Employment Type</label>
                <div className="space-y-4">
                  {jobTypes.map((type) => (
                    <label key={type} className="flex items-center gap-3 cursor-pointer group">
                      <div className="h-5 w-5 rounded-lg border border-surface-border group-hover:border-primary transition-all flex items-center justify-center bg-white shadow-sm">
                        <div className={`h-2 w-2 rounded-sm bg-primary transition-opacity ${selectedTypes.includes(type) ? 'opacity-100' : 'opacity-0'}`}></div>
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={selectedTypes.includes(type)}
                        onChange={() => toggleType(type)}
                      />
                      <span className="text-sm font-semibold text-text-muted group-hover:text-text-main transition-colors">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mb-5 block">Location Focus</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-light" />
                  <select className="appearance-none font-bold pl-10" value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)}>
                    {locationOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-3 space-y-6">
          <section className="dashboard-panel space-y-5 p-4 sm:p-5 lg:hidden">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-light transition-colors group-focus-within:text-primary" />
              <input
                type="text"
                placeholder="Design, Engineering, Marketing..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border-none bg-surface py-4 pl-12 pr-4 text-base font-medium focus:ring-2 focus:ring-primary/20 shadow-inner"
              />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {jobTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                    selectedTypes.includes(type)
                      ? 'border-primary/20 bg-primary text-white'
                      : 'border-surface-border bg-white text-text-muted'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-light" />
              <select className="appearance-none font-bold pl-10" value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)}>
                {locationOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </section>

          <div className="dashboard-panel hidden p-4 sm:p-5 lg:block">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-light transition-colors group-focus-within:text-primary" />
              <input
                type="text"
                placeholder="Design, Engineering, Marketing..."
                value={search}
                onChange={(event) => {
                   setSearch(event.target.value)
                   setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full rounded-2xl border-none bg-surface py-4 pl-12 pr-4 text-lg font-medium focus:ring-2 focus:ring-primary/20 shadow-inner"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-2xl border border-surface-border bg-white p-3 shadow-premium-lg animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-text-light">Suggested Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setSearch(s)
                          setShowSuggestions(false)
                        }}
                        className="rounded-xl border border-surface-border bg-surface-alt/20 px-4 py-2 text-xs font-bold text-text-muted hover:bg-primary/10 hover:text-primary transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

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
            <div className="dashboard-panel p-6 sm:p-10">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading live opportunities...</p>
            </div>
          ) : error ? (
            <div className="dashboard-panel border-error/10 p-6 sm:p-10">
              <p className="text-sm font-semibold text-error">{error}</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="dashboard-panel py-16 text-center sm:py-20">
              <p className="text-2xl font-black text-text-main mb-4 tracking-tighter">No positions found</p>
              <p className="text-text-muted font-medium">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJobs.map((job) => {
                const companyName = job.employer.employerProfile?.companyName || emailHandle(job.employer.email)
                const location = formatJobLocationWithWorkMode(job.location)
                const workModeLabel = getJobWorkModeLabel(job.location)
                const isNew = Date.now() - new Date(job.createdAt).getTime() < 1000 * 60 * 60 * 72

                return (
                  <div
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="dashboard-panel group relative flex cursor-pointer flex-col gap-6 overflow-hidden border-surface-border bg-white p-5 transition-all hover:shadow-premium sm:p-8 md:flex-row md:items-start"
                  >
                    <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors"></div>

                    <div className="relative z-10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-alt text-xl font-black text-text-main shadow-sm sm:h-20 sm:w-20 sm:text-2xl">
                      {getInitials(companyName)}
                    </div>

                    <div className="flex-grow relative z-10">
                      <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                        <div>
                          <div className="flex items-center flex-wrap gap-3 mb-2">
                            <h3 className="font-black text-2xl tracking-tight group-hover:text-primary transition-colors text-text-main">{job.title}</h3>
                            <div className="flex gap-2">
                              {isNew ? <span className="badge bg-primary text-white scale-90">New</span> : null}
                              <span className={`badge border-none scale-90 text-[9px] uppercase tracking-widest ${getJobWorkModeBadgeClass(job.location)}`}>
                                {workModeLabel}
                              </span>
                              <VerifiedBadge
                                type="employer"
                                status={job.employer.isVerified ? 'APPROVED' : 'UNVERIFIED'}
                                hideWhenUnverified
                                showText={false}
                              />
                            </div>
                          </div>
                          <p className="text-sm font-bold tracking-tight text-text-muted">{companyName}</p>
                        </div>
                        <div className="flex flex-col items-end gap-3 text-right">
                          <p className="text-xl font-black text-text-main tracking-tighter">{job.salary || 'Salary on request'}</p>
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              setReportTarget({ id: job.id, name: companyName })
                            }}
                            className="p-2 hover:bg-error/5 rounded-lg text-text-light hover:text-error transition-all group/report border border-transparent hover:border-error/10"
                            title="Report this job"
                          >
                            <Flag className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-text-muted leading-relaxed line-clamp-2">{job.description}</p>

                      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-surface-border/50 pt-6">
                        <div className="flex items-center gap-2 text-xs text-text-muted font-bold uppercase tracking-wider">
                          <MapPin className="h-3.5 w-3.5 text-primary" /> {location}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-muted font-bold uppercase tracking-wider">
                          <Clock className="h-3.5 w-3.5 text-primary" /> {formatRelativeTime(job.createdAt)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-muted font-bold uppercase tracking-wider">
                          {job.type}
                        </div>
                        {job.category ? (
                          <div className="flex items-center gap-2 text-xs text-text-muted font-bold uppercase tracking-wider">
                            {job.category}
                          </div>
                        ) : null}
                        <div className="ml-auto flex items-center gap-3">
                          {canCompareJobs ? (
                            <button
                              type="button"
                              aria-label={`Compare ${job.title}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleComparisonSelection(job.id)
                              }}
                              disabled={!selectedJobIds.includes(job.id) && selectedJobIds.length >= 3}
                              className={`btn btn-sm px-5 text-[10px] font-black uppercase tracking-[0.18em] ${
                                selectedJobIds.includes(job.id)
                                  ? 'border-primary/20 bg-primary text-white hover:bg-primary-dark'
                                  : 'btn-outline border-surface-border text-text-main'
                              } disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                              {selectedJobIds.includes(job.id) ? 'Selected' : 'Compare'}
                            </button>
                          ) : null}
                          <div className="flex items-center gap-1 text-primary font-black text-xs uppercase tracking-widest opacity-0 transition-all translate-x-2 group-hover:translate-x-0 group-hover:opacity-100">
                            View Position <ChevronRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
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
