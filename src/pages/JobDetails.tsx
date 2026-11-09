import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { CalendarClock, MapPin, CheckCircle, ChevronLeft, Send, Clock, Share2, AlertTriangle, Building2, Globe, ChevronRight, BriefcaseBusiness, Sparkles, ShieldCheck, MessageCircle } from 'lucide-react'
import ReportModal from '../components/ReportModal'
import CompanyLogo from '../components/CompanyLogo'
import VerifiedBadge from '../components/VerifiedBadge'
import UnverifiedEmployerLabel from '../components/UnverifiedEmployerLabel'
import SaveJobButton from '../components/SaveJobButton'
import ShareOnWhatsApp from '../components/ShareOnWhatsApp'
import { linkContacts } from '../lib/applyInstructions'
import { apiApplyForJob, apiDeleteApplication, apiGetJobApplicationCoaching, apiGetJobById, apiGetMyJobApplication, apiTrackJobView } from '../lib/api'
import { emailHandle, formatRelativeTime } from '../lib/display'
import { closingSummary } from '../lib/jobLifecycle'
import EarlyCareerChips from '../components/EarlyCareerChips'
import PromotionBadge from '../components/PromotionBadge'
import CoursesForJob from '../components/CoursesForJob'
import { isEarlyCareerType } from '../lib/earlyCareer'
import CvChoice, { type CvChoiceValue } from '../components/CvChoice'
import {
  formatJobLocationWithWorkMode,
  getJobWorkModeLabel,
} from '../lib/workMode'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../lib/errors'
import SEO from '../components/SEO'

type JobDetail = {
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
  promotion?: string | null
  category?: string | null
  createdAt: string
  closesAt?: string | null
  /** An admin posted this for the company (it sent the vacancy by WhatsApp). */
  postedOnBehalf?: boolean
  /** How to apply outside JobWahala (WhatsApp, email). When set it replaces the Apply form. */
  applyInstructions?: string | null
  employer: {
    id: string
    email: string
    verificationStatus?: string | null
    isVerified?: boolean
    employerProfile?: {
      companyName?: string | null
      logoUrl?: string | null
      website?: string | null
      description?: string | null
    } | null
  }
}

type JobApplication = {
  id: string
  status: string
  createdAt: string
  coverLetter?: string | null
  agreement?: {
    id: string
    status: string
    updatedAt: string
  } | null
}

type JobApplicationCoaching = {
  score: number
  headline: string
  strengths: string[]
  gaps: string[]
  suggestedCoverLetter: string
  cvPrompt: string
}

export default function JobDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const [job, setJob] = useState<JobDetail | null>(null)
  const [application, setApplication] = useState<JobApplication | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  // null until the picker knows what CVs the member has; then the CV to send, or 'NONE'.
  const [cvChoice, setCvChoice] = useState<CvChoiceValue | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [coaching, setCoaching] = useState<JobApplicationCoaching | null>(null)
  const [isCoachingLoading, setIsCoachingLoading] = useState(false)
  const [coachingError, setCoachingError] = useState('')
  const [showReportModal, setShowReportModal] = useState(false)

  useEffect(() => {
    if (!id) {
      setError('Job id is missing.')
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadJob = async () => {
      setIsCoachingLoading(Boolean(user && role === 'SEEKER'))

      try {
        const [jobData, applicationData, coachingData] = await Promise.all([
          apiGetJobById(id),
          user && role === 'SEEKER'
            ? apiGetMyJobApplication(id).catch(() => ({ application: null }))
            : Promise.resolve({ application: null }),
          user && role === 'SEEKER'
            ? apiGetJobApplicationCoaching(id).catch((err) => ({ coaching: null, error: err.message }))
            : Promise.resolve({ coaching: null }),
        ])

        if (cancelled) return

        setJob(jobData.job as JobDetail)
        try {
          apiTrackJobView(id)
        } catch {
          // Counting a view must never get in the way of the page.
        }
        setApplication((applicationData.application || null) as JobApplication | null)
        setCoaching((coachingData.coaching || null) as JobApplicationCoaching | null)
        setCoachingError((coachingData as { error?: string }).error || '')
        setError('')
      } catch (err) {
        if (cancelled) return
        setError(getErrorMessage(err, 'Unable to load this job.'))
      } finally {
        if (!cancelled) {
          setIsCoachingLoading(false)
          setIsLoading(false)
        }
      }
    }

    loadJob()

    return () => {
      cancelled = true
    }
  }, [id, role, user])

  const companyName = useMemo(() => {
    if (!job) return ''
    return job.employer.employerProfile?.companyName || emailHandle(job.employer.email)
  }, [job])

  const companyDescription = job?.employer.employerProfile?.description || 'Company profile details are still being completed.'
  const canWithdraw = Boolean(application && ['SUBMITTED', 'SHORTLISTED', 'INTERVIEW'].includes(application.status))

  const handleApply = async () => {
    if (!job) return

    if (!user) {
      navigate('/login')
      return
    }

    if (role !== 'SEEKER') {
      setError('Only job seekers can apply to roles right now.')
      return
    }

    setError('')
    setIsApplying(true)

    try {
      const data = await (cvChoice ? apiApplyForJob(job.id, coverLetter, cvChoice) : apiApplyForJob(job.id, coverLetter))
      setApplication(data.application as JobApplication)
      setCoverLetter('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      if (getErrorMessage(err)?.toLowerCase().includes('already applied')) {
        try {
          const data = await apiGetMyJobApplication(job.id)
          setApplication((data.application || null) as JobApplication | null)
        } catch {
          // Preserve the backend error if the follow-up fetch fails.
        }
      }

      setError(getErrorMessage(err, 'Unable to submit your application.'))
    } finally {
      setIsApplying(false)
    }
  }

  const handleUseSuggestedCoverLetter = () => {
    if (!coaching?.suggestedCoverLetter) return
    setCoverLetter(coaching.suggestedCoverLetter)
  }

  const handleWithdraw = async () => {
    if (!application) return
    if (!window.confirm('Withdraw this application?')) return

    setError('')
    setIsWithdrawing(true)

    try {
      await apiDeleteApplication(application.id)
      setApplication(null)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to withdraw your application.'))
    } finally {
      setIsWithdrawing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container py-24">
        <div className="dashboard-panel p-6 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading live role...</p>
        </div>
      </div>
    )
  }

  if (error && !job) {
    return (
      <div className="container py-24">
        <div className="dashboard-panel border-error/10 p-6 sm:p-10">
          <p className="text-sm font-semibold text-error">{error}</p>
        </div>
      </div>
    )
  }

  if (!job) {
    return null
  }

  const workModeLabel = getJobWorkModeLabel(job.location)
  const locationLabel = formatJobLocationWithWorkMode(job.location)

  return (
    <div className="container pt-24 pb-24 xl:pt-28">
      <SEO
        title={`${job.title} at ${companyName}`}
        description={`${[locationLabel, job.type].filter(Boolean).join(' · ')}. ${(job.description || '').replace(/\s+/g, ' ').slice(0, 150)}`}
        canonical={`https://www.jobwahala.com/jobs/${job.id}`}
        ogType="article"
      />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/jobs" className="group flex items-center gap-2 text-sm font-semibold text-text-muted transition-all hover:text-primary">
          <ChevronLeft className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" /> Back to Job Search
        </Link>
        <div className="flex items-center gap-3">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${job.title} at ${companyName} on JobWahala: ${window.location.href}`)}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Share on WhatsApp"
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-surface-border bg-white px-4 text-sm font-bold text-text-muted shadow-sm transition-all hover:border-success hover:text-success"
          >
            <MessageCircle className="h-5 w-5" /> Share
          </a>
          <button
            aria-label="Copy link"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-surface-border bg-white text-text-muted shadow-sm transition-all hover:border-primary hover:text-primary"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <ShareOnWhatsApp job={{ id: job.id, title: job.title, companyName, location: job.location, salary: job.salary, unpaid: job.unpaid }} />
          <SaveJobButton jobId={job.id} />
        </div>
      </div>

      {error ? (
        <div className="mb-8 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-8 lg:col-span-8 lg:space-y-10">
          <div
            className="relative overflow-hidden rounded-[2rem] p-6 text-white sm:p-9"
            style={{
              background:
                'radial-gradient(600px 300px at 100% 0%, rgba(47,109,246,0.5), transparent 60%), radial-gradient(420px 260px at 0% 100%, rgba(255,197,49,0.16), transparent 60%), #101a2b',
            }}
          >
            <div className="heritage-strip absolute inset-x-0 top-0" aria-hidden />
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <CompanyLogo name={companyName} logoUrl={job.employer.employerProfile?.logoUrl} className="h-20 w-20 flex-none rounded-2xl text-3xl sm:h-24 sm:w-24 sm:text-4xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">{job.title}</h1>
                  <VerifiedBadge
                    type="employer"
                    status={job.employer.isVerified ? 'APPROVED' : 'UNVERIFIED'}
                    hideWhenUnverified
                  />
                  {job.employer.isVerified ? null : <UnverifiedEmployerLabel className="bg-white/15 text-white" />}
                </div>
                {job.postedOnBehalf ? (
                  <p className="mt-3 text-sm font-bold text-white/70">Posted by JobWahala on behalf of {companyName}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-base font-semibold text-white/80">
                  <Link to={`/companies/${job.employer.id}`} className="inline-flex items-center gap-2 hover:text-gold hover:underline">
                    <Building2 className="h-4 w-4 text-gold" /> {companyName}
                  </Link>
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gold" /> {locationLabel}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gold" /> Posted {formatRelativeTime(job.createdAt)}
                  </span>
                  {job.closesAt ? (
                    <span className="inline-flex items-center gap-2" data-testid="job-closing">
                      <CalendarClock className="h-4 w-4 text-gold" /> {closingSummary(job.closesAt)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-gold px-4 py-2 text-base font-extrabold text-primary">{job.salary || 'Salary on request'}</span>
                  <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">{job.type}</span>
                  <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">{workModeLabel}</span>
                  {job.category ? <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">{job.category}</span> : null}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <PromotionBadge promotion={job.promotion} />
                  <EarlyCareerChips job={job} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
              <h2 className="text-2xl font-black tracking-tight text-text-main">About this job</h2>
              <p className="mt-4 whitespace-pre-line text-lg font-medium leading-relaxed text-text-main">{job.description}</p>
            </section>

            <CoursesForJob jobId={job.id} />

            <section className="rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
              <h2 className="text-2xl font-black tracking-tight text-text-main">The job at a glance</h2>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Work type', value: job.type, icon: <BriefcaseBusiness className="h-5 w-5 text-secondary" /> },
                  { label: 'Work mode', value: workModeLabel, icon: <Globe className="h-5 w-5 text-secondary" /> },
                  { label: 'Location', value: locationLabel, icon: <MapPin className="h-5 w-5 text-secondary" /> },
                  { label: isEarlyCareerType(job.type) ? 'Stipend' : 'Pay', value: job.unpaid ? 'Unpaid' : job.salary || (isEarlyCareerType(job.type) ? 'Not stated' : 'Salary on request'), icon: <CheckCircle className="h-5 w-5 text-secondary" /> },
                  { label: 'Category', value: job.category || 'General', icon: <Building2 className="h-5 w-5 text-secondary" /> },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-surface-alt/60 p-4">
                    {item.icon}
                    <p className="mt-3 text-sm font-semibold text-text-muted">{item.label}</p>
                    <p className="mt-0.5 text-base font-extrabold text-text-main">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-surface-border bg-white p-6 sm:p-8">
              <h2 className="text-2xl font-black tracking-tight text-text-main">About {companyName}</h2>
              <p className="mt-4 text-lg font-medium leading-relaxed text-text-main">{companyDescription}</p>
              <Link to={`/companies/${job.employer.id}`} className="mt-5 inline-flex items-center gap-1 font-extrabold text-secondary hover:underline">
                See all jobs from {companyName} <ChevronRight className="h-4 w-4" />
              </Link>
            </section>
          </div>
        </div>

        <div className="lg:col-span-4 lg:pl-2">
          <div className="space-y-6 lg:sticky lg:top-28">
            {job.applyInstructions ? (
              <section aria-label="How to apply" className="dashboard-panel border-primary/20 p-5 sm:p-7">
                <h3 className="mb-3 text-2xl font-black tracking-tight text-text-main">How to apply</h3>
                <p className="mb-3 text-sm font-semibold text-text-muted">
                  {companyName} takes applications outside JobWahala. Follow these steps to apply.
                </p>
                <div className="whitespace-pre-line rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm font-bold leading-relaxed text-text-main">{linkContacts(job.applyInstructions)}</div>
              </section>
            ) : (
            <div className="dashboard-panel relative overflow-hidden border-primary/20 p-5 sm:p-7 group/apply">
              <div className="absolute top-0 right-0 h-40 w-40 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover/apply:bg-primary/10 transition-colors"></div>

              <h3 className="relative z-10 mb-4 text-2xl font-black tracking-tight text-text-main">Apply for this job</h3>
              {user && role === 'SEEKER' ? (
                <div className="relative z-10 mb-6 rounded-[1.6rem] border border-primary/10 bg-primary/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5" /> AI Application Coach
                      </p>
                      <p className="text-sm font-semibold leading-relaxed text-text-main">
                        {coaching?.headline || 'Generating role-specific coaching from your seeker profile and this job post.'}
                      </p>
                    </div>
                    <span className="badge bg-primary text-white border-none text-[9px] uppercase tracking-widest">
                      {coaching?.score ?? '...'}% fit
                    </span>
                  </div>

                  {coaching ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mb-2">Strengths</p>
                        <div className="space-y-2">
                          {coaching.strengths.slice(0, 2).map((item) => (
                            <p key={item} className="text-sm font-medium leading-relaxed text-text-main">
                              {item}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light mb-2">Gaps to Fix</p>
                        <div className="space-y-2">
                          {coaching.gaps.slice(0, 2).map((item) => (
                            <p key={item} className="text-sm font-medium leading-relaxed text-text-main">
                              {item}
                            </p>
                          ))}
                        </div>
                      </div>
                      {!application ? (
                        <button
                          type="button"
                          onClick={handleUseSuggestedCoverLetter}
                          className="btn btn-outline btn-sm w-full rounded-2xl bg-white font-black uppercase tracking-widest text-[10px]"
                        >
                          Use Suggested Cover Note
                        </button>
                      ) : null}
                      <p className="text-[11px] font-medium leading-relaxed text-text-muted">
                        CV prompt: {coaching.cvPrompt}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm font-medium leading-relaxed text-text-muted">
                      {coachingError || (isCoachingLoading ? 'Generating coaching...' : 'Role-specific coaching is unavailable right now.')}
                    </p>
                  )}
                </div>
              ) : null}
              {application ? (
                <div className="relative z-10">
                  <div className="rounded-3xl border border-success/10 bg-success/5 p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-success/10 text-success flex items-center justify-center">
                        <CheckCircle className="h-6 w-6" />
                      </div>
                      <div className="flex-grow">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-success mb-2">Application Live</p>
                        <p className="text-lg font-black text-text-main mb-2">Status: {application.status}</p>
                        <p className="text-sm text-text-muted font-medium leading-relaxed">
                          The employer can see your application. This page updates as they review it.
                        </p>
                        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                          Applied {formatRelativeTime(application.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <Link to="/dashboard" className="btn btn-primary btn-lg flex w-full items-center justify-center gap-3 rounded-2xl font-black uppercase tracking-widest shadow-primary/20">
                      View Application Status
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                    {application.agreement ? (
                      <Link to="/agreements" className="btn btn-outline btn-lg w-full rounded-2xl font-black uppercase tracking-widest text-[10px]">
                        Open Agreement
                      </Link>
                    ) : null}
                    {canWithdraw ? (
                      <button
                        type="button"
                        onClick={handleWithdraw}
                        disabled={isWithdrawing}
                        className="btn btn-outline btn-lg w-full rounded-2xl border-error/20 text-error hover:bg-error/5 font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
                      >
                        {isWithdrawing ? 'Withdrawing...' : 'Withdraw Application'}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : !user ? (
                <div className="space-y-4 relative z-10">
                  <p className="text-text-muted font-medium leading-relaxed text-sm">
                    Create a free account or sign in to apply. It takes about a minute, and you can follow your application from your dashboard.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="btn btn-primary btn-lg w-full rounded-2xl shadow-primary/20 font-black uppercase tracking-widest flex items-center justify-center gap-3"
                  >
                    Sign In to Apply
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <Link to="/signup" className="btn btn-outline btn-lg w-full justify-center rounded-2xl">
                    Create a free account
                  </Link>
                </div>
              ) : role !== 'SEEKER' ? (
                <div className="space-y-4 relative z-10">
                  <p className="text-text-muted font-medium leading-relaxed text-sm">
                    Only seeker accounts can submit applications. Switch to a seeker profile to apply for roles.
                  </p>
                  <Link to="/dashboard" className="btn btn-outline btn-lg w-full rounded-2xl font-black uppercase tracking-widest text-[10px]">
                    Go to Dashboard
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-text-muted font-medium leading-relaxed mb-8 relative z-10 text-sm">
                    Your application goes straight to the employer. You can follow it from your dashboard.
                  </p>

                  <div className="space-y-4 relative z-10">
                    <textarea
                      value={coverLetter}
                      onChange={(event) => setCoverLetter(event.target.value)}
                      placeholder="Cover note for the employer..."
                      className="min-h-[140px] font-bold py-4"
                    />
                    {user && role === 'SEEKER' ? <CvChoice value={cvChoice} onChange={setCvChoice} /> : null}
                    <button
                      onClick={handleApply}
                      disabled={isApplying}
                      className="btn btn-primary btn-lg w-full rounded-2xl shadow-primary/20 hover:scale-[1.02] transition-all font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-60 disabled:hover:scale-100"
                    >
                      {isApplying ? 'Submitting...' : 'Apply Now'}
                      <Send className="h-5 w-5" />
                    </button>
                    <SaveJobButton jobId={job.id} variant="labelled" />
                    <ShareOnWhatsApp job={{ id: job.id, title: job.title, companyName, location: job.location, salary: job.salary, unpaid: job.unpaid }} variant="labelled" />
                  </div>
                </>
              )}

              <div className="mt-10 pt-8 border-t border-surface-border flex items-center justify-between px-2">
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-light mb-1">Posted</p>
                  <p className="font-black text-success text-[11px] uppercase tracking-wide">{formatRelativeTime(job.createdAt)}</p>
                </div>
                <div className="h-8 w-px bg-surface-border"></div>
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-light mb-1">Type</p>
                  <p className="font-black text-text-main text-[11px] uppercase tracking-wide">{job.type}</p>
                </div>
              </div>
            </div>
            )}

            <div className="dashboard-panel space-y-8 bg-surface-alt/30 p-5 sm:p-6">
              <h3 className="font-black text-xs uppercase tracking-widest text-text-light flex items-center gap-3">
                <Building2 className="h-4 w-4" /> The Employer
              </h3>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 flex items-center justify-center bg-white rounded-2xl border border-surface-border shadow-sm">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-tight text-text-light">Company</p>
                    <p className="text-sm font-bold text-text-main">{companyName}</p>
                  </div>
                </div>
                {job.employer.employerProfile?.website ? (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 flex items-center justify-center bg-white rounded-2xl border border-surface-border shadow-sm">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-tight text-text-light">Website</p>
                      <a
                        href={job.employer.employerProfile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-text-main hover:text-primary transition-colors"
                      >
                        {job.employer.employerProfile.website.replace('https://', '')}
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>

              <Link to="/jobs" className="btn btn-outline btn-sm w-full rounded-lg uppercase tracking-widest font-black text-[10px] flex items-center justify-center gap-2 border-surface-border text-text-muted hover:border-primary hover:text-primary transition-all bg-white">
                Browse More Roles <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-2xl border border-success/25 bg-success/5 p-5">
              <p className="flex items-center gap-2 font-extrabold text-text-main">
                <ShieldCheck className="h-5 w-5 text-success" /> Apply safely
              </p>
              <ul className="mt-3 space-y-2 text-sm font-medium text-text-muted">
                <li>Never pay money to apply for a job.</li>
                <li>Keep your conversations on JobWahala.</li>
                <li>Report anything that looks wrong.</li>
              </ul>
            </div>

            <button
              onClick={() => setShowReportModal(true)}
              className="group flex w-full items-center justify-center gap-2 rounded-xl py-4 text-[10px] font-black uppercase tracking-[0.2em] text-text-light transition-all hover:text-error"
            >
              <AlertTriangle className="h-3.5 w-3.5 group-hover:animate-pulse" /> Flag this Posting
            </button>
          </div>
        </div>
      </div>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        type="job"
        targetId={job.id}
        targetName={job.title}
      />
    </div>
  )
}
