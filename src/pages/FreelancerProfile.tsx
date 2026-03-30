import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calendar, Globe, Share2, ChevronLeft, Zap, BriefcaseBusiness, Mail, AlertTriangle, Star, Sparkles, ArrowRight } from 'lucide-react'
import { apiGetFreelancerComparison, apiGetFreelancerProfile } from '../lib/api'
import { formatMoney, getDisplayName, getInitials } from '../lib/display'
import ReportModal from '../components/ReportModal'
import ServiceRequestModal from '../components/ServiceRequestModal'
import { useAuth } from '../context/AuthContext'
import VerifiedBadge from '../components/VerifiedBadge'

type Service = {
  id: string
  title: string
  description: string
  price: number
  matchScore?: number
  matchReasons?: string[]
  deliveryTime?: string | null
  category?: string | null
}

type AlternativeService = {
  id: string
  title: string
  description: string
  price: number
  matchScore?: number
  matchReasons?: string[]
  deliveryTime?: string | null
  category?: string | null
  freelancer: {
    id: string
    email: string
    verificationStatus?: string | null
    isVerified?: boolean
    freelancerProfile?: {
      firstName?: string | null
      lastName?: string | null
    } | null
  }
}

type FreelancerComparisonRecord = {
  headline: string
  viewedFreelancerScore: number
  viewedServiceMatches: Array<{
    serviceId: string
    title: string
    matchScore: number
    matchReasons: string[]
  }>
  alternatives: AlternativeService[]
}

type FreelancerProfileRecord = {
  id: string
  email: string
  createdAt: string
  reviewSummary?: {
    reviewCount: number
    averageRating: number
  }
  verificationStatus?: string | null
  isVerified?: boolean
  freelancerProfile?: {
    firstName?: string | null
    lastName?: string | null
    hourlyRate?: number | null
    portfolioUrl?: string | null
    bio?: string | null
    skills?: string | null
  } | null
  freelanceServices: Service[]
  reviewsReceived?: Array<{
    id: string
    rating: number
    comment?: string | null
    createdAt: string
    agreement: {
      id: string
      title: string
      type: string
    }
    reviewer: {
      id: string
      email: string
      employerProfile?: {
        companyName?: string | null
      } | null
      jobSeekerProfile?: {
        firstName?: string | null
        lastName?: string | null
      } | null
      freelancerProfile?: {
        firstName?: string | null
        lastName?: string | null
      } | null
    }
  }>
}

export default function FreelancerProfile() {
  const { user } = useAuth()
  const { id } = useParams()
  const [profile, setProfile] = useState<FreelancerProfileRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [comparison, setComparison] = useState<FreelancerComparisonRecord | null>(null)
  const [isComparisonLoading, setIsComparisonLoading] = useState(false)
  const [comparisonError, setComparisonError] = useState('')

  useEffect(() => {
    if (!id) {
      setError('Freelancer id is missing.')
      setIsLoading(false)
      return
    }

    apiGetFreelancerProfile(id)
      .then((data) => {
        setProfile({
          ...(data.profile as FreelancerProfileRecord),
          reviewSummary: data.reviewSummary,
        })
        setError('')
      })
      .catch((err: any) => {
        setError(err.message || 'Unable to load this freelancer profile.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [id])

  useEffect(() => {
    if (!id || !user || !['SEEKER', 'EMPLOYER'].includes(user.role) || user.id === id) {
      setComparison(null)
      setComparisonError('')
      setIsComparisonLoading(false)
      return
    }

    let cancelled = false
    setIsComparisonLoading(true)
    setComparisonError('')

    apiGetFreelancerComparison(id)
      .then((data) => {
        if (cancelled) return
        setComparison((data.comparison || null) as FreelancerComparisonRecord | null)
      })
      .catch((err: any) => {
        if (cancelled) return
        setComparisonError(err.message || 'Unable to load AI comparison signals right now.')
      })
      .finally(() => {
        if (!cancelled) {
          setIsComparisonLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [id, user])

  const name = useMemo(() => {
    return getDisplayName(
      profile?.freelancerProfile?.firstName,
      profile?.freelancerProfile?.lastName,
      profile?.email,
    )
  }, [profile])

  const skills = useMemo(() => {
    return (profile?.freelancerProfile?.skills || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }, [profile])

  const reviews = profile?.reviewsReceived || []
  const serviceMatchMap = useMemo(
    () =>
      new Map(
        (comparison?.viewedServiceMatches || []).map((service) => [service.serviceId, service]),
      ),
    [comparison],
  )
  const topViewedService = comparison?.viewedServiceMatches?.[0] || null

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="container py-24">
        <div className="dashboard-panel p-6 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading live freelancer profile...</p>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="container py-24">
        <div className="dashboard-panel border-error/10 p-6 sm:p-10">
          <p className="text-sm font-semibold text-error">{error || 'Freelancer not found.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container animate-in fade-in slide-in-from-bottom-4 pt-24 pb-24 duration-1000 md:pt-28 xl:pt-32">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/freelancers" className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted transition-all hover:text-secondary">
          <ChevronLeft className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" /> Marketplace
        </Link>
        <div className="flex items-center gap-3">
          {user && user.id !== profile.id ? (
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="h-10 px-4 flex items-center justify-center gap-2 rounded-xl bg-error/5 border border-error/10 text-error hover:bg-error/10 transition-all shadow-sm text-[10px] font-black uppercase tracking-widest"
            >
              <AlertTriangle className="h-4 w-4" /> Report
            </button>
          ) : null}
          <button onClick={handleCopy} className="h-10 w-10 flex items-center justify-center rounded-xl bg-surface border border-surface-border text-text-muted hover:text-secondary hover:border-secondary transition-all shadow-sm">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        type="user"
        targetId={profile.id}
        targetName={name}
      />

      {selectedService ? (
        <ServiceRequestModal
          isOpen={Boolean(selectedService)}
          onClose={() => setSelectedService(null)}
          serviceId={selectedService.id}
          serviceTitle={selectedService.title}
          freelancerName={name}
        />
      ) : null}

      {copied ? (
        <div className="mb-6 rounded-2xl border border-success/10 bg-success/5 px-4 py-3 text-sm font-semibold text-success">
          Profile link copied.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-6 lg:col-span-4">
          <div className="dashboard-panel relative overflow-hidden p-6 text-center sm:p-8 lg:p-10">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-secondary to-accent"></div>

            <div className="relative mb-10 inline-block">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-secondary to-secondary-dark text-4xl font-black text-white shadow-2xl sm:h-32 sm:w-32 sm:rounded-[2.5rem] sm:text-5xl">
                {getInitials(name)}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <h1 className="text-4xl font-black text-text-main tracking-tighter mb-2">{name}</h1>
              <VerifiedBadge
                type="freelancer"
                status={profile.isVerified ? 'APPROVED' : 'UNVERIFIED'}
                hideWhenUnverified
              />
            </div>
            <p className="text-secondary font-black text-xs uppercase tracking-[0.2em] mb-8">
              {profile.freelanceServices[0]?.category || 'Independent Professional'}
            </p>

            <div className="flex justify-center items-center gap-8 mb-12">
              <div>
                <p className="text-2xl font-black text-text-main tracking-tighter">
                  {formatMoney(profile.freelancerProfile?.hourlyRate || profile.freelanceServices[0]?.price)}
                  <span className="text-[10px] text-text-light ml-1">/hr</span>
                </p>
                <p className="text-[9px] font-black text-text-light uppercase tracking-widest">Rate</p>
              </div>
              <div className="h-10 w-px bg-surface-border"></div>
              <div className="text-center">
                <p className="text-2xl font-black text-text-main tracking-tighter">
                  {profile.reviewSummary?.reviewCount ? profile.reviewSummary.averageRating.toFixed(1) : 'New'}
                </p>
                <p className="text-[9px] font-black text-text-light uppercase tracking-widest">
                  {profile.reviewSummary?.reviewCount ? `${profile.reviewSummary.reviewCount} reviews` : 'No reviews'}
                </p>
              </div>
              <div className="h-10 w-px bg-surface-border"></div>
              <div className="text-center">
                <p className="font-black text-sm text-text-main flex items-center justify-center gap-1">
                  <Star className="h-4 w-4 text-accent fill-current" />
                  <span>{profile.freelanceServices.length}</span>
                </p>
                <p className="text-[9px] font-black text-text-light uppercase tracking-widest">Services</p>
              </div>
            </div>

            <div className="space-y-4">
              <Link
                to={`/messaging?userId=${profile.id}&email=${encodeURIComponent(profile.email)}`}
                className="btn btn-primary bg-secondary border-secondary text-white btn-lg w-full rounded-2xl shadow-secondary/20 flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest"
              >
                Open Messaging <Zap className="h-5 w-5" />
              </Link>
              {!user ? (
                <Link
                  to="/login"
                  className="btn btn-outline border-surface-border text-text-muted btn-lg w-full rounded-2xl bg-white flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest hover:border-secondary hover:text-secondary"
                >
                  Login To Request
                </Link>
              ) : null}
              {profile.freelancerProfile?.portfolioUrl ? (
                <a
                  href={profile.freelancerProfile.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline border-surface-border text-text-muted btn-lg w-full rounded-2xl bg-white flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest hover:border-secondary hover:text-secondary"
                >
                  Visit Portfolio <Globe className="h-5 w-5" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="dashboard-panel space-y-8 bg-surface-alt/30 p-5 sm:p-6">
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-text-light flex items-center gap-3">
              <Globe className="h-4 w-4" /> Parameters
            </h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 flex items-center justify-center bg-white rounded-xl border border-surface-border shadow-sm">
                  <Calendar className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-tight text-text-light">Member Since</p>
                  <p className="text-sm font-bold text-text-main">
                    {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 flex items-center justify-center bg-white rounded-xl border border-surface-border shadow-sm">
                  <Mail className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-tight text-text-light">Contact</p>
                  <p className="text-sm font-bold text-text-main">{profile.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <section className="dashboard-panel p-5 sm:p-7 lg:p-8">
            <h2 className="mb-10 border-b border-surface-border pb-4 text-xs font-black uppercase tracking-[0.3em] text-text-light italic">
              Professional Synthesis
            </h2>
            <p className="text-2xl font-medium leading-relaxed text-text-main tracking-tight italic">
              &quot;{profile.freelancerProfile?.bio || 'This freelancer has not added a long-form bio yet.'}&quot;
            </p>
          </section>

          {user && user.id !== profile.id && ['SEEKER', 'EMPLOYER'].includes(user.role) ? (
            <section className="dashboard-panel overflow-hidden p-5 sm:p-7 lg:p-8">
              <div className="flex flex-col gap-4 border-b border-surface-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-secondary">
                    <Sparkles className="h-4 w-4" /> AI Market Read
                  </p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-text-main">
                    How this freelancer compares for your current needs.
                  </h2>
                </div>
                {comparison ? (
                  <span className="badge bg-secondary text-white border-none text-[9px] uppercase tracking-widest">
                    {comparison.viewedFreelancerScore}% fit
                  </span>
                ) : null}
              </div>

              {isComparisonLoading ? (
                <p className="mt-5 text-sm font-semibold text-text-light">
                  Loading comparison signals for this freelancer...
                </p>
              ) : comparison ? (
                <div className="mt-6 space-y-6">
                  <div className="rounded-[1.75rem] border border-secondary/15 bg-secondary/5 p-5 sm:p-6">
                    <p className="text-sm font-semibold leading-relaxed text-text-main">
                      {comparison.headline}
                    </p>
                    {topViewedService ? (
                      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                        <div className="rounded-2xl border border-surface-border bg-white/80 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-light">
                            Strongest Service Match
                          </p>
                          <p className="mt-2 text-lg font-black tracking-tight text-text-main">
                            {topViewedService.title}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {topViewedService.matchReasons.slice(0, 3).map((reason) => (
                              <span
                                key={reason}
                                className="rounded-full border border-secondary/10 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-muted"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-surface-border bg-white/80 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-light">
                            Alternative Picks
                          </p>
                          {comparison.alternatives.length === 0 ? (
                            <p className="mt-3 text-sm font-semibold text-text-muted">
                              No close alternative services are visible right now.
                            </p>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {comparison.alternatives.map((service) => {
                                const alternativeName = getDisplayName(
                                  service.freelancer.freelancerProfile?.firstName,
                                  service.freelancer.freelancerProfile?.lastName,
                                  service.freelancer.email,
                                )

                                return (
                                  <Link
                                    key={service.id}
                                    to={`/freelancers/${service.freelancer.id}`}
                                    className="flex items-start justify-between gap-3 rounded-2xl border border-surface-border bg-surface-alt/20 px-4 py-4 transition-all hover:bg-white"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-black tracking-tight text-text-main">
                                        {service.title}
                                      </p>
                                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                                        {alternativeName}
                                      </p>
                                      <p className="mt-2 text-xs font-semibold text-text-muted">
                                        {(service.matchReasons || []).slice(0, 1).join('')}
                                      </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <p className="rounded-full border border-secondary/15 bg-secondary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-secondary">
                                        {service.matchScore}% fit
                                      </p>
                                      <ArrowRight className="ml-auto mt-3 h-4 w-4 text-text-light" />
                                    </div>
                                  </Link>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : comparisonError ? (
                <p className="mt-5 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
                  {comparisonError}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="dashboard-panel p-5 sm:p-7 lg:p-8">
            <h2 className="mb-10 border-b border-surface-border pb-4 text-xs font-black uppercase tracking-[0.3em] text-text-light">
              Technical Stack
            </h2>
            <div className="flex flex-wrap gap-4">
              {(skills.length > 0 ? skills : ['Profile setup in progress']).map((skill) => (
                <span key={skill} className="px-8 py-4 bg-white border border-surface-border rounded-3xl text-sm font-black text-text-main uppercase tracking-widest hover:border-secondary transition-all shadow-sm">
                  {skill}
                </span>
              ))}
            </div>
          </section>

          <section className="dashboard-panel p-5 sm:p-7 lg:p-8">
            <h2 className="mb-10 border-b border-surface-border pb-4 text-xs font-black uppercase tracking-[0.3em] text-text-light">
              Active Services
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {profile.freelanceServices.map((service) => {
                const matchedService = serviceMatchMap.get(service.id)

                return (
                <div key={service.id} className="group rounded-[1.75rem] border border-surface-border bg-surface-alt/20 p-5 transition-all hover:bg-white hover:shadow-premium sm:p-8">
                  <div className="h-14 w-14 flex items-center justify-center bg-white rounded-2xl mb-8 shadow-sm group-hover:bg-secondary group-hover:text-white transition-all">
                    <BriefcaseBusiness className="h-7 w-7 text-secondary group-hover:text-white" />
                  </div>
                  {matchedService ? (
                    <div className="mb-5 inline-flex rounded-full border border-secondary/15 bg-secondary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-secondary">
                      {matchedService.matchScore}% fit
                    </div>
                  ) : null}
                  <h4 className="text-2xl font-black text-text-main tracking-tight mb-4 group-hover:text-secondary transition-colors">{service.title}</h4>
                  <p className="text-text-muted text-sm font-bold leading-relaxed mb-6">{service.description}</p>
                  {matchedService?.matchReasons?.length ? (
                    <div className="mb-6 flex flex-wrap gap-2">
                      {matchedService.matchReasons.slice(0, 3).map((reason) => (
                        <span
                          key={`${service.id}-${reason}`}
                          className="rounded-full border border-secondary/10 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-muted"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-4 pt-6 border-t border-surface-border mb-6">
                    <span className="text-sm font-black text-text-main">{formatMoney(service.price)}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">
                      {service.deliveryTime || 'Custom timeline'}
                    </span>
                  </div>
                  {user && user.id !== profile.id ? (
                    <button
                      type="button"
                      onClick={() => setSelectedService(service)}
                      className="btn btn-primary btn-sm w-full bg-secondary border-secondary text-white font-black uppercase tracking-widest text-[10px]"
                    >
                      Request Service
                    </button>
                  ) : null}
                </div>
                )
              })}
            </div>
          </section>

          <section className="dashboard-panel p-5 sm:p-7 lg:p-8">
            <h2 className="mb-10 border-b border-surface-border pb-4 text-xs font-black uppercase tracking-[0.3em] text-text-light">
              Client Reviews
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm font-semibold text-text-light">
                No reviews have been published for this freelancer yet.
              </p>
            ) : (
              <div className="space-y-5">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-[1.5rem] border border-surface-border bg-surface-alt/20 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-text-main">
                          {review.reviewer.employerProfile?.companyName ||
                            getDisplayName(
                              review.reviewer.jobSeekerProfile?.firstName || review.reviewer.freelancerProfile?.firstName,
                              review.reviewer.jobSeekerProfile?.lastName || review.reviewer.freelancerProfile?.lastName,
                              review.reviewer.email,
                            )}
                        </p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                          {review.agreement.title} / {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="badge bg-accent text-white border-none text-[9px] uppercase tracking-widest">
                        {review.rating}/5 stars
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-medium leading-relaxed text-text-muted">
                      {review.comment || 'This reviewer left a rating without a written note.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
