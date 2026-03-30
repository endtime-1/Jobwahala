import { useEffect, useMemo, useState } from 'react'
import { Briefcase, MessageSquare, CheckCircle, ShieldCheck, Lock, FileText, Handshake, Sparkles } from 'lucide-react'
import VerifiedBadge from '../../components/VerifiedBadge'
import VerificationPanel from '../../components/VerificationPanel'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { apiCompareJobs, apiCreateVerificationRequest, apiDeleteApplication, apiDeleteServiceRequest } from '../../lib/api'
import { emailHandle, formatRelativeTime, getDisplayName } from '../../lib/display'
import { formatJobLocationWithWorkMode, getJobWorkModeBadgeClass, getJobWorkModeLabel } from '../../lib/workMode'
import { useAuth } from '../../context/AuthContext'
import { subscribeToRealtimeEvents } from '../../lib/realtime'
import WorkflowSidebar from './shared/WorkflowSidebar'
import { getApplicationBadgeClass, getMatchScoreBadgeClass } from './shared/utils'
import { useSeekerDashboard, useProfileOptimization } from './seeker/hooks'

type ComparedJob = {
  id: string; title: string; description: string; location?: string | null; salary?: string | null
  type: string; category?: string | null; createdAt: string; matchScore: number; matchReasons: string[]
  employer: { email: string; employerProfile?: { companyName?: string | null } | null }
}
type JobComparisonRecord = { summary: string; comparedCount: number; jobs: ComparedJob[] }

export default function SeekerDashboard() {
  const { userName, user } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading, error: dashboardError } = useSeekerDashboard()
  const { data: optimization, isLoading: isOptLoading, error: optError } = useProfileOptimization()
  const [error, setError] = useState('')
  const [isActing, setIsActing] = useState(false)
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [jobComparison, setJobComparison] = useState<JobComparisonRecord | null>(null)
  const [comparisonError, setComparisonError] = useState('')
  const [isComparingJobs, setIsComparingJobs] = useState(false)

  const applications = data?.applications ?? []
  const recommendedJobs = data?.recommendedJobs ?? []
  const sentRequests = data?.sentRequests ?? []
  const unreadMessages = data?.unreadMessages ?? 0
  const cvCount = data?.cvCount ?? 0

  const refreshDashboard = () => void queryClient.invalidateQueries({ queryKey: ['seeker'] })

  useEffect(() => {
    if (!user) return
    return subscribeToRealtimeEvents({
      onMessagesRefresh: refreshDashboard,
      onProposalsRefresh: refreshDashboard,
      onAgreementsRefresh: refreshDashboard,
    })
  }, [user?.id])

  const profileCompletion = useMemo(() => {
    const fields = [user?.jobSeekerProfile?.firstName, user?.jobSeekerProfile?.lastName, user?.jobSeekerProfile?.experience, user?.jobSeekerProfile?.skills, user?.jobSeekerProfile?.resumeFileUrl]
    return Math.max(20, Math.round((fields.filter(Boolean).length / fields.length) * 100))
  }, [user])

  const dashboardJobOptions = useMemo(() => {
    const opts = new Map<string, { id: string; title: string }>()
    applications.forEach((a) => opts.set(a.job.id, { id: a.job.id, title: a.job.title }))
    recommendedJobs.forEach((j) => opts.set(j.id, { id: j.id, title: j.title }))
    return Array.from(opts.values())
  }, [applications, recommendedJobs])

  const selectedDashboardJobs = useMemo(
    () => selectedJobIds.map((id) => dashboardJobOptions.find((j) => j.id === id) || null).filter(Boolean) as { id: string; title: string }[],
    [dashboardJobOptions, selectedJobIds],
  )

  const toggleJobComparisonSelection = (jobId: string) => {
    setJobComparison(null); setComparisonError('')
    setSelectedJobIds((c) => c.includes(jobId) ? c.filter((v) => v !== jobId) : c.length >= 3 ? c : [...c, jobId])
  }

  const handleGenerateJobComparison = async () => {
    if (selectedJobIds.length < 2) return
    setComparisonError(''); setIsComparingJobs(true)
    try {
      const data = await apiCompareJobs(selectedJobIds)
      setJobComparison((data.comparison || null) as JobComparisonRecord | null)
    } catch (err: any) { setComparisonError(err.message || 'Unable to compare.') } finally { setIsComparingJobs(false) }
  }

  const handleWithdrawApplication = async (applicationId: string) => {
    if (!window.confirm('Withdraw this application?')) return
    setError(''); setIsActing(true)
    try { await apiDeleteApplication(applicationId); refreshDashboard() } catch (err: any) { setError(err.message || 'Unable to withdraw.') } finally { setIsActing(false) }
  }

  const handleCancelServiceRequest = async (requestId: string) => {
    if (!window.confirm('Cancel this service request?')) return
    setError(''); setIsActing(true)
    try { await apiDeleteServiceRequest(requestId); refreshDashboard() } catch (err: any) { setError(err.message || 'Unable to cancel.') } finally { setIsActing(false) }
  }

  const handleSubmitVerification = async (payload: { details: string; documentUrl?: string }) => {
    setError(''); setIsActing(true)
    try { await apiCreateVerificationRequest(payload); refreshDashboard() } catch (err: any) { setError(err.message || 'Unable to submit.') } finally { setIsActing(false) }
  }

  return (
    <div className="fade-in">
      <header className="dashboard-hero mb-8 px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="dashboard-kicker mb-4"><CheckCircle className="h-3.5 w-3.5" /> Seeker workspace</div>
            <div className="mb-3 flex items-center gap-4">
              <h1 className="text-4xl font-black leading-tight tracking-tighter text-text-main md:text-5xl">Hello, {userName}</h1>
              <VerifiedBadge type="seeker" />
            </div>
            <p className="text-base font-medium tracking-tight text-text-muted md:text-lg">Live dashboard data from your recent applications, messages, and CV history.</p>
            <div className="dashboard-actions">
              <Link to="/jobs" className="dashboard-action-chip"><Briefcase className="h-4 w-4" /> Browse roles</Link>
              <Link to="/cv-generator" className="dashboard-action-chip"><FileText className="h-4 w-4" /> Open CV studio</Link>
              <Link to="/agreements" className="dashboard-action-chip"><Handshake className="h-4 w-4" /> View agreements</Link>
              <Link to="/proposals" className="dashboard-action-chip"><Handshake className="h-4 w-4" /> Proposals</Link>
            </div>
          </div>
          <div className="dashboard-panel relative flex min-w-0 items-center gap-5 px-5 py-5 sm:min-w-[20rem] sm:px-6">
            <div className="relative z-10 flex h-16 w-16 items-center justify-center">
              <svg className="h-16 w-16 -rotate-90 transform">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-surface-alt" />
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray={176} strokeDashoffset={176 - (176 * profileCompletion) / 100} className="text-primary transition-all duration-1000" />
              </svg>
              <span className="absolute text-[11px] font-black">{profileCompletion}%</span>
            </div>
            <div className="relative z-10">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Profile Health</p>
              <p className="mb-1 text-sm font-black text-text-main">{profileCompletion >= 80 ? 'Strong Profile' : 'Needs More Detail'}</p>
              <Link to="/onboarding" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Update Profile</Link>
            </div>
          </div>
        </div>
      </header>

      {(error || dashboardError) ? (
        <div className="mb-8 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error || (dashboardError instanceof Error ? dashboardError.message : 'Unable to load dashboard.')}</div>
      ) : null}

      <div className="metric-rail mb-10 md:mb-14">
        <div className="metric-card metric-card--solid flex items-center gap-5">
          <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all"><Briefcase className="h-7 w-7" /></div>
          <div><p className="text-3xl font-black leading-none mb-1">{applications.length}</p><p className="text-[10px] font-black opacity-80 uppercase tracking-widest">Recent Applications</p></div>
        </div>
        <div className="metric-card flex items-center gap-5">
          <div className="h-14 w-14 text-secondary bg-surface-alt rounded-2xl flex items-center justify-center group-hover:bg-secondary/10 transition-all"><MessageSquare className="h-7 w-7" /></div>
          <div><p className="text-3xl font-black text-text-main leading-none mb-1">{unreadMessages}</p><p className="text-[10px] font-black text-text-light uppercase tracking-widest">Unread Messages</p></div>
        </div>
        <div className="metric-card flex items-center gap-5">
          <div className="h-14 w-14 text-accent bg-surface-alt rounded-2xl flex items-center justify-center group-hover:bg-accent/10 transition-all"><FileText className="h-7 w-7" /></div>
          <div><p className="text-3xl font-black text-text-main leading-none mb-1">{cvCount}</p><p className="text-[10px] font-black text-text-light uppercase tracking-widest">Saved CV Versions</p></div>
        </div>
      </div>

      {isLoading ? (
        <div className="card bg-white border-surface-border p-10"><p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading seeker dashboard...</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.95fr)]">
          <div className="space-y-8">
            {/* AI Job Comparison */}
            <section className="dashboard-panel p-5 sm:p-7 lg:p-8">
              <div className="mb-6 flex flex-col gap-3 border-b border-surface-border/50 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AI Role Comparison</p>
                  <h2 className="mt-2 text-xl font-black tracking-tight text-text-main">Compare the roles already in your workspace.</h2>
                </div>
                <button type="button" onClick={() => void handleGenerateJobComparison()} disabled={selectedJobIds.length < 2 || isComparingJobs} className="btn btn-primary btn-sm px-5 py-3 text-[10px] font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50">
                  <Sparkles className="h-4 w-4" /> {isComparingJobs ? 'Comparing...' : 'Generate AI Comparison'}
                </button>
              </div>
              {selectedDashboardJobs.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {selectedDashboardJobs.map((j) => (
                    <button key={j.id} type="button" onClick={() => toggleJobComparisonSelection(j.id)} className="rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary hover:text-white">{j.title} selected</button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.8rem] border border-dashed border-surface-border bg-surface-alt/30 px-5 py-6">
                  <p className="text-sm font-bold text-text-main">No workspace roles selected yet.</p>
                  <p className="mt-2 text-sm font-medium text-text-muted">Select up to three roles from your applications or recommendations to generate a decision brief.</p>
                </div>
              )}
              {comparisonError ? <div className="mt-5 rounded-[1.6rem] border border-error/10 bg-error/5 px-5 py-4"><p className="text-sm font-semibold text-error">{comparisonError}</p></div> : null}
              {jobComparison ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.8rem] border border-primary/10 bg-primary/5 px-5 py-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{jobComparison.comparedCount} roles compared</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-light">Ranked by current seeker fit</p>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-7 text-text-main">{jobComparison.summary}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    {jobComparison.jobs.map((job) => {
                      const company = job.employer.employerProfile?.companyName || emailHandle(job.employer.email)
                      const workModeLabel = getJobWorkModeLabel(job.location)
                      return (
                        <div key={job.id} className="rounded-[1.8rem] border border-surface-border bg-surface-alt/35 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-black tracking-tight text-text-main">{job.title}</p>
                              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-text-light">{company}</p>
                            </div>
                            <span className={`badge border-none text-[9px] uppercase tracking-widest ${getMatchScoreBadgeClass(job.matchScore)}`}>{job.matchScore}% match</span>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className={`badge border-none text-[9px] uppercase tracking-widest ${getJobWorkModeBadgeClass(job.location)}`}>{workModeLabel}</span>
                            <p className="text-sm font-bold text-text-main">{formatJobLocationWithWorkMode(job.location)} / {job.type}</p>
                          </div>
                          <p className="mt-2 text-sm font-medium text-text-muted">{(job.salary || 'Salary on request') + (job.category ? ` / ${job.category}` : '')}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {job.matchReasons.slice(0, 3).map((reason) => (<span key={`${job.id}-${reason}`} className="rounded-full border border-primary/10 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">{reason}</span>))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </section>

            {/* Applied Positions */}
            <section className="dashboard-panel p-5 sm:p-7 lg:p-8">
              <div className="mb-8 flex flex-col gap-3 border-b border-surface-border/50 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main">Applied Positions</h2>
                <Link to="/jobs" className="text-[10px] text-primary font-black uppercase tracking-widest hover:underline flex items-center gap-2">Browse More Roles <span className="inline-block">›</span></Link>
              </div>
              {applications.length === 0 ? (
                <p className="text-sm font-semibold text-text-light">No applications yet. Start from the live jobs board.</p>
              ) : (
                <div className="flex flex-col gap-4 sm:gap-5">
                  {applications.map((application) => {
                    const company = application.job.employer.employerProfile?.companyName || emailHandle(application.job.employer.email)
                    const workModeLabel = getJobWorkModeLabel(application.job.location)
                    return (
                      <div key={application.id} className="group rounded-[1.4rem] border border-surface-border/70 bg-surface-alt/25 p-4 transition-all hover:border-primary/15 hover:bg-white sm:p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <Link to={`/jobs/${application.job.id}`} className="flex min-w-0 items-center gap-4 sm:gap-5">
                            <div className="h-14 w-14 bg-white border border-surface-border/50 rounded-2xl flex items-center justify-center font-black text-[10px] text-text-light shadow-sm group-hover:scale-110 transition-transform">JOB</div>
                            <div>
                              <p className="font-black text-text-main tracking-tight leading-none mb-1.5">{application.job.title}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs text-text-muted font-bold tracking-tight uppercase tracking-widest">{company}</p>
                                <span className={`badge border-none text-[9px] uppercase tracking-widest ${getJobWorkModeBadgeClass(application.job.location)}`}>{workModeLabel}</span>
                              </div>
                              <p className="mt-2 text-[11px] font-semibold text-text-muted">{formatJobLocationWithWorkMode(application.job.location)}</p>
                            </div>
                          </Link>
                          <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:text-right">
                            <span className={`badge ${getApplicationBadgeClass(application.status)}`}>{application.status}</span>
                            <p className="text-[9px] text-text-light font-black uppercase tracking-widest leading-none">{formatRelativeTime(application.createdAt)}</p>
                            <button type="button" aria-label={`Compare ${application.job.title}`} onClick={() => toggleJobComparisonSelection(application.job.id)} disabled={!selectedJobIds.includes(application.job.id) && selectedJobIds.length >= 3} className={`text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${selectedJobIds.includes(application.job.id) ? 'text-primary' : 'text-text-light hover:text-primary'}`}>{selectedJobIds.includes(application.job.id) ? 'Selected' : 'Compare'}</button>
                            {application.agreement ? <Link to="/agreements" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Agreement Live</Link> : null}
                            {['SUBMITTED', 'SHORTLISTED', 'INTERVIEW'].includes(application.status) ? (
                              <button type="button" disabled={isActing} onClick={() => void handleWithdrawApplication(application.id)} className="text-[10px] font-black uppercase tracking-widest text-error hover:underline disabled:opacity-60">Withdraw</button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Recommended jobs */}
            <section className="space-y-5">
              <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-light mb-8">Recommended Live Roles</h2>
              {recommendedJobs.length === 0 ? (
                <div className="dashboard-panel p-6 sm:p-8"><p className="text-sm font-semibold text-text-light">No recommendations available yet.</p></div>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {recommendedJobs.map((job) => {
                    const company = job.employer.employerProfile?.companyName || emailHandle(job.employer.email)
                    const workModeLabel = getJobWorkModeLabel(job.location)
                    return (
                      <div key={job.id} className="dashboard-panel group p-5 sm:p-6 transition-all hover:-translate-y-1">
                        <div className="mb-6 flex justify-between items-start">
                          <div className="h-12 w-12 bg-surface-alt rounded-2xl flex items-center justify-center font-black text-[10px] text-text-light group-hover:bg-primary/5 transition-colors">JOB</div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="badge bg-secondary text-white border-none text-[9px]">Live</span>
                            {job.matchScore ? <span className={`badge border-none text-[9px] uppercase tracking-widest ${getMatchScoreBadgeClass(job.matchScore)}`}>{job.matchScore}% match</span> : null}
                          </div>
                        </div>
                        <Link to={`/jobs/${job.id}`}><h3 className="font-black text-lg text-text-main mb-2 tracking-tight group-hover:text-primary transition-colors leading-none">{job.title}</h3></Link>
                        <div className="mb-8 flex flex-wrap items-center gap-2">
                          <p className="text-xs text-text-muted font-bold tracking-tight">{company}</p>
                          <span className={`badge border-none text-[9px] uppercase tracking-widest ${getJobWorkModeBadgeClass(job.location)}`}>{workModeLabel}</span>
                          <p className="text-[11px] font-semibold text-text-muted">{formatJobLocationWithWorkMode(job.location)}</p>
                        </div>
                        {job.matchReasons?.length ? (
                          <div className="mb-6 mt-4 flex flex-wrap gap-2">
                            {job.matchReasons.map((reason) => (<span key={`${job.id}-${reason}`} className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">{reason}</span>))}
                          </div>
                        ) : null}
                        <div className="flex justify-between items-center pt-6 border-t border-surface-border/50">
                          <span className="font-black text-sm text-text-main">{job.salary || 'Salary on request'}</span>
                          <div className="flex items-center gap-4">
                            <button type="button" aria-label={`Compare ${job.title}`} onClick={() => toggleJobComparisonSelection(job.id)} disabled={!selectedJobIds.includes(job.id) && selectedJobIds.length >= 3} className={`text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${selectedJobIds.includes(job.id) ? 'text-primary' : 'text-text-light hover:text-primary'}`}>{selectedJobIds.includes(job.id) ? 'Selected' : 'Compare'}</button>
                            <Link to={`/jobs/${job.id}`} className="text-[10px] font-black text-primary uppercase tracking-widest">View Role</Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            {/* AI Profile Coach */}
            <div className="dashboard-panel border-primary/20 bg-gradient-to-br from-primary/5 to-white p-5 sm:p-6 overflow-hidden relative group/sidebar">
              <div className="absolute top-0 right-0 h-32 w-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover/sidebar:bg-primary/20 transition-colors"></div>
              <div className="relative z-10">
                <h2 className="font-black text-xs uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-3"><Sparkles className="h-4 w-4" /> AI Profile Coach</h2>
                {isOptLoading ? (<p className="text-sm text-text-muted font-medium mb-8 leading-relaxed">Building your coaching brief...</p>
                ) : optimization ? (<>
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <p className="text-sm text-text-muted font-medium leading-relaxed">{optimization.headline}</p>
                    <span className="badge bg-primary text-white border-none text-[9px] uppercase tracking-widest">{optimization.score}% ready</span>
                  </div>
                  <div className="space-y-4">
                    <div className="p-5 bg-white rounded-2xl border border-surface-border shadow-sm">
                      <h4 className="font-black text-[10px] uppercase tracking-widest text-text-main mb-2">Strength Signal</h4>
                      <div className="space-y-2">{optimization.strengths.slice(0, 2).map((s) => (<p key={s} className="text-[11px] text-text-muted font-medium leading-relaxed italic">{s}</p>))}</div>
                    </div>
                    <div className="p-5 bg-white rounded-2xl border border-surface-border shadow-sm">
                      <h4 className="font-black text-[10px] uppercase tracking-widest text-text-main mb-2">Next Upgrade</h4>
                      <div className="space-y-2">{optimization.improvements.slice(0, 2).map((i) => (<p key={i} className="text-[11px] text-text-muted font-medium leading-relaxed">{i}</p>))}</div>
                    </div>
                    {optimization.targetRoles.length > 0 ? (
                      <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-4">
                        <h4 className="font-black text-[10px] uppercase tracking-widest text-primary mb-3">Best-Fit Roles</h4>
                        <div className="flex flex-wrap gap-2">{optimization.targetRoles.slice(0, 3).map((r) => (<span key={r} className="rounded-full border border-primary/10 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">{r}</span>))}</div>
                      </div>
                    ) : null}
                  </div>
                </>) : (<p className="text-sm text-text-muted font-medium mb-8 leading-relaxed">{optError instanceof Error ? optError.message : 'Add more detail to your profile to improve matching.'}</p>)}
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <Link to="/onboarding" className="btn btn-primary btn-sm uppercase tracking-widest font-black text-[10px]">Optimize Profile</Link>
                  <Link to="/cv-generator" className="btn btn-outline btn-sm bg-white uppercase tracking-widest font-black text-[10px]">Open CV Studio</Link>
                </div>
              </div>
            </div>

            <div className="dashboard-panel bg-surface-alt/20 box-shadow-none p-5">
              <h3 className="font-black text-[10px] uppercase tracking-widest text-text-light mb-4">Messaging</h3>
              <p className="text-xs text-text-main font-medium italic leading-relaxed">You currently have {unreadMessages} unread conversation updates.</p>
            </div>

            <WorkflowSidebar
              activeAgreementCount={data?.activeAgreementCount ?? 0}
              upcomingMilestones={data?.upcomingMilestones ?? []}
              pendingProposalActions={data?.pendingProposalActions ?? 0}
              proposalActionItems={data?.proposalActionItems ?? []}
              pendingReviewActions={data?.pendingReviewActions ?? 0}
              reviewActionItems={data?.reviewActionItems ?? []}
              pendingDisputeActions={data?.pendingDisputeActions ?? 0}
              disputeActionItems={data?.disputeActionItems ?? []}
              pendingPaymentActions={data?.pendingPaymentActions ?? 0}
              paymentActionItems={data?.paymentActionItems ?? []}
            />

            <VerificationPanel type="seeker" verification={data?.verification ?? null} isSubmitting={isActing} onSubmit={handleSubmitVerification} />

            {/* Freelance Requests */}
            <div className="dashboard-panel p-5 sm:p-6">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-surface-border/50">
                <h3 className="font-black text-[10px] uppercase tracking-widest text-text-main">Freelance Requests</h3>
                <span className="badge bg-secondary text-white border-none text-[9px] uppercase tracking-widest">{sentRequests.length}</span>
              </div>
              {sentRequests.length === 0 ? (
                <p className="text-xs text-text-muted font-medium leading-relaxed">No freelance service requests sent yet.</p>
              ) : (
                <div className="space-y-5">
                  {sentRequests.slice(0, 4).map((request) => {
                    const freelancerName = getDisplayName(request.service.freelancer.freelancerProfile?.firstName, request.service.freelancer.freelancerProfile?.lastName, request.service.freelancer.email)
                    return (
                      <div key={request.id} className="rounded-2xl border border-surface-border bg-surface-alt/20 p-4">
                        <p className="text-sm font-black text-text-main">{request.service.title}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{freelancerName} / {formatRelativeTime(request.createdAt)}</p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className={`badge ${getApplicationBadgeClass(request.status)}`}>{request.status}</span>
                          <div className="flex items-center gap-3">
                            {request.agreement ? <Link to="/agreements" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Agreement</Link> : null}
                            <Link to={`/messaging?userId=${request.service.freelancer.id}&email=${encodeURIComponent(request.service.freelancer.email)}`} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Message</Link>
                            {request.proposals?.[0] ? <Link to="/proposals" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Proposal</Link> : null}
                            {request.status === 'PENDING' ? (<button type="button" disabled={isActing} onClick={() => void handleCancelServiceRequest(request.id)} className="text-[10px] font-black uppercase tracking-widest text-error hover:underline disabled:opacity-60">Cancel</button>) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Trust Layer */}
            <div className="dashboard-panel bg-success/5 border-success/10 shadow-sm relative overflow-hidden group/success p-5">
              <div className="absolute top-0 right-0 h-16 w-16 bg-success/10 rounded-full -mr-8 -mt-8 blur-xl"></div>
              <h4 className="font-black text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2 text-success relative z-10"><ShieldCheck className="h-3.5 w-3.5" /> Trust Layer</h4>
              <p className="text-[11px] text-text-muted font-medium leading-relaxed mb-6 relative z-10">Keep your profile updated to stay visible in employer searches and application reviews.</p>
              <div className="flex items-center gap-2 text-[9px] font-black text-success uppercase tracking-[0.2em] relative z-10"><Lock className="h-3 w-3" /> Live Candidate Record</div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
