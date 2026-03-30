import { useState, useMemo } from 'react'
import { AlertTriangle, Award, Handshake, ShieldAlert, ShieldCheck, SearchCheck, Wallet, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiCompareProposals, apiCompareAgreements, apiGenerateAgreementDecisionBrief } from '../../../lib/api'
import { formatRelativeTime, getDisplayName } from '../../../lib/display'
import type {
  EmployerJob,
  RecentApplication,
  UpcomingMilestone,
  ProposalActionItem,
  ReviewActionItem,
  DisputeActionItem,
  PaymentActionItem,
  AgreementDecisionBriefRecord,
  AgreementComparisonRecord,
  ProposalComparisonRecord,
  DashboardAgreementOption,
} from './types'
import {
  getApplicationBadgeClass,
  getProposalBadgeClass,
  getPaymentActionBadgeClass,
  getAgreementDecisionBadgeClass,
  getDisputeBadgeClass,
  getFitScoreBadgeClass,
} from './utils'

type Props = {
  jobs: EmployerJob[]
  recentApplications: RecentApplication[]
  unreadMessages: number
  shortlistedCount: number
  totalApplicants: number
  activeAgreementCount: number
  upcomingMilestones: UpcomingMilestone[]
  pendingProposalActions: number
  proposalActionItems: ProposalActionItem[]
  pendingReviewActions: number
  reviewActionItems: ReviewActionItem[]
  pendingDisputeActions: number
  disputeActionItems: DisputeActionItem[]
  pendingPaymentActions: number
  paymentActionItems: PaymentActionItem[]
  onReviewApplicants: (jobId: string, jobTitle: string) => void
}

export default function EmployerSidebar({
  jobs,
  recentApplications,
  unreadMessages,
  shortlistedCount,
  totalApplicants,
  activeAgreementCount,
  upcomingMilestones,
  pendingProposalActions,
  proposalActionItems,
  pendingReviewActions,
  reviewActionItems,
  pendingDisputeActions,
  disputeActionItems,
  pendingPaymentActions,
  paymentActionItems,
  onReviewApplicants,
}: Props) {
  // Proposal comparison state
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([])
  const [proposalComparison, setProposalComparison] = useState<ProposalComparisonRecord | null>(null)
  const [proposalComparisonError, setProposalComparisonError] = useState('')
  const [isComparingProposals, setIsComparingProposals] = useState(false)

  // Agreement comparison state
  const [selectedAgreementIds, setSelectedAgreementIds] = useState<string[]>([])
  const [agreementComparison, setAgreementComparison] = useState<AgreementComparisonRecord | null>(null)
  const [agreementComparisonError, setAgreementComparisonError] = useState('')
  const [isComparingAgreements, setIsComparingAgreements] = useState(false)

  // Agreement decision brief state
  const [activeAgreementDecisionId, setActiveAgreementDecisionId] = useState<string | null>(null)
  const [agreementDecisionBriefs, setAgreementDecisionBriefs] = useState<Record<string, AgreementDecisionBriefRecord>>({})
  const [agreementDecisionBriefErrors, setAgreementDecisionBriefErrors] = useState<Record<string, string>>({})
  const [agreementDecisionBriefLoadingId, setAgreementDecisionBriefLoadingId] = useState<string | null>(null)

  const selectedProposalItems = useMemo(
    () => selectedProposalIds.map((id) => proposalActionItems.find((p) => p.id === id) || null).filter(Boolean) as ProposalActionItem[],
    [proposalActionItems, selectedProposalIds],
  )

  const dashboardAgreementOptions = useMemo(() => {
    const options = new Map<string, DashboardAgreementOption>()
    upcomingMilestones.forEach((m) => {
      options.set(m.agreement.id, { id: m.agreement.id, title: m.agreement.title, type: m.agreement.type, updatedAt: m.agreement.updatedAt })
    })
    return Array.from(options.values())
  }, [upcomingMilestones])

  const selectedAgreementOptions = useMemo(
    () => selectedAgreementIds.map((id) => dashboardAgreementOptions.find((a) => a.id === id) || null).filter(Boolean) as DashboardAgreementOption[],
    [dashboardAgreementOptions, selectedAgreementIds],
  )

  const activeAgreementDecision = useMemo(
    () => activeAgreementDecisionId ? dashboardAgreementOptions.find((a) => a.id === activeAgreementDecisionId) || null : null,
    [activeAgreementDecisionId, dashboardAgreementOptions],
  )

  const toggleProposalComparisonSelection = (proposalId: string) => {
    setProposalComparison(null)
    setProposalComparisonError('')
    setSelectedProposalIds((current) => {
      if (current.includes(proposalId)) return current.filter((v) => v !== proposalId)
      if (current.length >= 3) return current
      return [...current, proposalId]
    })
  }

  const toggleAgreementComparisonSelection = (agreementId: string) => {
    setAgreementComparison(null)
    setAgreementComparisonError('')
    setSelectedAgreementIds((current) => {
      if (current.includes(agreementId)) return current.filter((v) => v !== agreementId)
      if (current.length >= 3) return current
      return [...current, agreementId]
    })
  }

  const handleGenerateProposalComparison = async () => {
    if (selectedProposalIds.length < 2) return
    setProposalComparisonError('')
    setIsComparingProposals(true)
    try {
      const data = await apiCompareProposals(selectedProposalIds)
      setProposalComparison((data.comparison || null) as ProposalComparisonRecord | null)
    } catch (err: any) {
      setProposalComparisonError(err.message || 'Unable to compare these proposal terms right now.')
    } finally {
      setIsComparingProposals(false)
    }
  }

  const handleGenerateAgreementComparison = async () => {
    if (selectedAgreementIds.length < 2) return
    setAgreementComparisonError('')
    setIsComparingAgreements(true)
    try {
      const data = await apiCompareAgreements(selectedAgreementIds)
      setAgreementComparison((data.comparison || null) as AgreementComparisonRecord | null)
    } catch (err: any) {
      setAgreementComparisonError(err.message || 'Unable to compare these agreements right now.')
    } finally {
      setIsComparingAgreements(false)
    }
  }

  const handleGenerateAgreementDecisionBrief = async (agreementId: string) => {
    setActiveAgreementDecisionId(agreementId)
    setAgreementDecisionBriefErrors((c) => ({ ...c, [agreementId]: '' }))
    setAgreementDecisionBriefLoadingId(agreementId)
    try {
      const data = await apiGenerateAgreementDecisionBrief(agreementId)
      const brief = (data.brief || null) as AgreementDecisionBriefRecord | null
      if (!brief) throw new Error('Decision brief response was empty.')
      setAgreementDecisionBriefs((c) => ({ ...c, [agreementId]: brief }))
    } catch (err: any) {
      setAgreementDecisionBriefErrors((c) => ({ ...c, [agreementId]: err.message || 'Unable to generate an agreement brief right now.' }))
    } finally {
      setAgreementDecisionBriefLoadingId((c) => (c === agreementId ? null : c))
    }
  }

  return (
    <aside className="space-y-6">
      {/* Recent Applicants */}
      <section className="dashboard-panel p-5 sm:p-7 lg:p-8">
        <div className="flex justify-between items-center mb-10 pb-6 border-b border-surface-border/50">
          <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main">Recent Applicants</h2>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <span className="text-[10px] font-black text-primary">{recentApplications.length}</span>
          </div>
        </div>
        {recentApplications.length === 0 ? (
          <p className="text-sm font-semibold text-text-light">No recent applicants yet.</p>
        ) : (
          <div className="space-y-6">
            {recentApplications.map((application) => {
              const name = getDisplayName(application.seeker.jobSeekerProfile?.firstName, application.seeker.jobSeekerProfile?.lastName, application.seeker.email)
              return (
                <div key={application.id}>
                  <div className="flex items-center justify-between gap-4 group">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-surface-border/50 bg-surface-alt text-xs font-black text-text-main shadow-sm transition-transform group-hover:scale-110">
                        {name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="mb-1.5 text-sm font-black leading-none text-text-main">{name}</h4>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{application.job.title}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <span className={`badge ${getApplicationBadgeClass(application.status)}`}>{application.status}</span>
                      {application.fitScore ? (
                        <span className={`badge border-none text-[9px] uppercase tracking-widest ${getFitScoreBadgeClass(application.fitScore)}`}>
                          {application.fitScore}% fit
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onReviewApplicants(application.job.id, application.job.title)}
                        className="text-[9px] font-black uppercase tracking-widest leading-none text-primary hover:underline"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                  {application.fitReasons?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {application.fitReasons.slice(0, 2).map((reason) => (
                        <span key={`${application.id}-${reason}`} className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
        <Link to="/messaging" className="btn btn-outline btn-sm mt-12 flex w-full items-center justify-center gap-2 border-surface-border bg-white text-[10px] font-black uppercase tracking-widest text-text-muted transition-all hover:border-primary hover:text-primary group">
          Open Inbox <span className="h-4 w-4 transform transition-transform group-hover:translate-x-1">›</span>
        </Link>
      </section>

      {/* Trusted Employer */}
      <div className="dashboard-panel border-success/20 bg-gradient-to-br from-success/5 to-white p-5 sm:p-6 overflow-hidden relative group/trust">
        <div className="absolute top-0 right-0 h-32 w-32 bg-success/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover/trust:bg-success/20 transition-colors"></div>
        <h2 className="font-black text-xs uppercase tracking-[0.2em] text-success mb-6 flex items-center gap-3">
          <ShieldCheck className="h-4 w-4" /> Trusted Employer
        </h2>
        <div className="space-y-4 relative z-10">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-text-main">
            <span>Active Roles</span>
            <span className="text-success">{jobs.length}</span>
          </div>
          <p className="text-[11px] text-text-muted font-medium leading-relaxed">
            Your live jobs and application decisions are now driving an actual hiring workflow on the platform.
          </p>
        </div>
      </div>

      {/* Inbox Status */}
      <div className="dashboard-panel bg-white border-primary/20 shadow-premium group/security p-5 sm:p-6">
        <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main mb-8 flex items-center gap-3">
          <ShieldAlert className="h-4 w-4 text-primary" /> Inbox Status
        </h2>
        <div className="space-y-6">
          <div className="p-5 bg-surface-alt/30 rounded-2xl border border-surface-border hover:bg-white transition-all">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-primary mb-2">Unread Messages</h4>
            <p className="text-[11px] text-text-muted font-medium leading-relaxed italic">
              You currently have {unreadMessages} unread conversation updates.
            </p>
          </div>
          <div className="p-5 bg-surface-alt/10 rounded-2xl border border-dashed border-surface-border opacity-70">
            <div className="flex items-center gap-3 mb-2">
              <Award className="h-4 w-4 text-accent" />
              <h4 className="font-black text-[10px] uppercase tracking-widest text-text-main">Candidate Flow</h4>
            </div>
            <p className="text-[11px] text-text-muted font-medium leading-relaxed">
              {shortlistedCount} shortlisted candidates are currently loaded for the active review job.
            </p>
          </div>
          <div className="p-5 bg-surface-alt/10 rounded-2xl border border-dashed border-surface-border opacity-70">
            <div className="flex items-center gap-3 mb-2">
              <SearchCheck className="h-4 w-4 text-secondary" />
              <h4 className="font-black text-[10px] uppercase tracking-widest text-text-main">Hiring Throughput</h4>
            </div>
            <p className="text-[11px] text-text-muted font-medium leading-relaxed">
              {totalApplicants} total applications are attached to your current job pipeline.
            </p>
          </div>
        </div>
        <Link to="/messaging" className="btn btn-primary btn-sm w-full mt-10 text-[10px] font-black uppercase tracking-widest">
          Review Messages
        </Link>
      </div>

      {/* Proposal Pulse */}
      <div className="dashboard-panel p-5 sm:p-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-surface-border/50">
          <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main flex items-center gap-2">
            <Handshake className="h-4 w-4 text-primary" /> Proposal Pulse
          </h2>
          <span className="badge bg-primary text-white border-none text-[9px] uppercase tracking-widest">{pendingProposalActions} waiting</span>
        </div>
        {proposalActionItems.length === 0 ? (
          <p className="text-sm font-semibold text-text-light">No proposal decisions are waiting on you right now.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">AI Proposal Comparison</p>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-text-main">
                    Compare the active terms on your dashboard before you jump into the full proposals workspace.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateProposalComparison()}
                  disabled={selectedProposalIds.length < 2 || isComparingProposals}
                  className="btn btn-primary btn-sm px-4 py-3 text-[10px] font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> {isComparingProposals ? 'Comparing...' : 'Generate AI Proposal Comparison'}
                </button>
              </div>

              {selectedProposalItems.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedProposalItems.map((p) => (
                    <button key={p.id} type="button" onClick={() => toggleProposalComparisonSelection(p.id)} className="rounded-full border border-primary/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-primary hover:bg-primary hover:text-white">
                      {p.title} selected
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[11px] font-medium leading-relaxed text-text-muted">Pick up to three proposals below to compare pricing, timeline, and source status.</p>
              )}

              {proposalComparisonError ? (
                <div className="mt-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3">
                  <p className="text-xs font-semibold text-error">{proposalComparisonError}</p>
                </div>
              ) : null}

              {proposalComparison ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-primary/10 bg-white px-4 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">{proposalComparison.comparedCount} proposals compared</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-text-light">Decision brief</p>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-text-main">{proposalComparison.summary}</p>
                  </div>
                  <div className="grid gap-3">
                    {proposalComparison.proposals.map((proposal) => (
                      <div key={proposal.id} className="rounded-2xl border border-surface-border bg-white px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-text-main">{proposal.title}</p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-text-light">{proposal.counterpartyName}</p>
                          </div>
                          <span className={`badge ${getProposalBadgeClass(proposal.status)}`}>{proposal.status}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {proposal.amount ? <span className="rounded-full border border-surface-border bg-surface-alt/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-main">{proposal.amount}</span> : null}
                          {proposal.timeline ? <span className="rounded-full border border-surface-border bg-surface-alt/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-main">{proposal.timeline}</span> : null}
                          {proposal.source ? <span className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">{proposal.source.title} / {proposal.source.status}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {proposalActionItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-surface-border bg-surface-alt/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-text-main">{item.title}</p>
                  <span className={`badge ${getProposalBadgeClass(item.status)}`}>{item.status}</span>
                </div>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{item.counterpartyName}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-text-muted font-medium leading-relaxed">
                    {(item.amount || 'Amount not set') + ' / ' + formatRelativeTime(item.updatedAt)}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={`Compare ${item.title}`}
                      onClick={() => toggleProposalComparisonSelection(item.id)}
                      disabled={!selectedProposalIds.includes(item.id) && selectedProposalIds.length >= 3}
                      className={`text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${selectedProposalIds.includes(item.id) ? 'text-primary' : 'text-text-light hover:text-primary'}`}
                    >
                      {selectedProposalIds.includes(item.id) ? 'Selected' : 'Compare'}
                    </button>
                    <Link to="/proposals" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Review</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispute Pulse */}
      <div className="dashboard-panel p-5 sm:p-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-surface-border/50">
          <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-error" /> Dispute Pulse
          </h2>
          <span className="badge bg-error text-white border-none text-[9px] uppercase tracking-widest">{pendingDisputeActions} open</span>
        </div>
        {disputeActionItems.length === 0 ? (
          <p className="text-sm font-semibold text-text-light">No agreement disputes need your attention right now.</p>
        ) : (
          <div className="space-y-4">
            {disputeActionItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-surface-border bg-surface-alt/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-text-main">{item.title}</p>
                  <span className={`badge ${getDisputeBadgeClass(item.status)}`}>{item.status}</span>
                </div>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                  {item.type} / {item.openedByCurrentUser ? 'Opened by you' : item.counterpartyName}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-text-muted font-medium leading-relaxed">{item.agreement.title + ' / ' + formatRelativeTime(item.updatedAt)}</p>
                  <Link to="/agreements" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Review</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Pulse */}
      <div className="dashboard-panel p-5 sm:p-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-surface-border/50">
          <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main flex items-center gap-2">
            <Award className="h-4 w-4 text-accent" /> Review Pulse
          </h2>
          <span className="badge bg-accent text-white border-none text-[9px] uppercase tracking-widest">{pendingReviewActions} waiting</span>
        </div>
        {reviewActionItems.length === 0 ? (
          <p className="text-sm font-semibold text-text-light">No completed agreements are waiting on your review right now.</p>
        ) : (
          <div className="space-y-4">
            {reviewActionItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-surface-border bg-surface-alt/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-text-main">{item.title}</p>
                  <span className="badge bg-accent text-white border-none text-[9px] uppercase tracking-widest">REVIEW</span>
                </div>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{item.counterpartyName}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-text-muted font-medium leading-relaxed">{(item.source?.title || item.title) + ' / ' + formatRelativeTime(item.updatedAt)}</p>
                  <Link to="/agreements" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Review</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Pulse */}
      <div className="dashboard-panel p-5 sm:p-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-surface-border/50">
          <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main flex items-center gap-2">
            <Wallet className="h-4 w-4 text-success" /> Payment Pulse
          </h2>
          <span className="badge bg-success text-white border-none text-[9px] uppercase tracking-widest">{pendingPaymentActions} open</span>
        </div>
        {paymentActionItems.length === 0 ? (
          <p className="text-sm font-semibold text-text-light">No milestone payout actions need your approval right now.</p>
        ) : (
          <div className="space-y-4">
            {paymentActionItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-surface-border bg-surface-alt/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-text-main">{item.title}</p>
                  <span className={`badge ${getPaymentActionBadgeClass(item.action)}`}>
                    {item.action === 'MARK_PAID' ? 'MARK PAID' : 'REQUEST'}
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{item.agreement.title}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-text-muted font-medium leading-relaxed">{(item.amount || 'Amount not set') + ' / ' + item.counterpartyName}</p>
                  <Link to="/agreements" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Open</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agreement Pulse */}
      <div className="dashboard-panel p-5 sm:p-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-surface-border/50">
          <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main flex items-center gap-2">
            <Handshake className="h-4 w-4 text-primary" /> Agreement Pulse
          </h2>
          <span className="badge bg-primary text-white border-none text-[9px] uppercase tracking-widest">{activeAgreementCount} active</span>
        </div>
        {upcomingMilestones.length === 0 ? (
          <p className="text-sm font-semibold text-text-light">No incomplete milestones are attached to your active agreements.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">AI Agreement Comparison</p>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-text-main">
                    Compare active agreements from your dashboard before deciding which workstream needs attention first.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateAgreementComparison()}
                  disabled={selectedAgreementIds.length < 2 || isComparingAgreements}
                  className="btn btn-primary btn-sm px-4 py-3 text-[10px] font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> {isComparingAgreements ? 'Comparing...' : 'Generate AI Agreement Comparison'}
                </button>
              </div>

              {selectedAgreementOptions.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedAgreementOptions.map((a) => (
                    <button key={a.id} type="button" onClick={() => toggleAgreementComparisonSelection(a.id)} className="rounded-full border border-primary/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-primary hover:bg-primary hover:text-white">
                      {a.title} selected
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[11px] font-medium leading-relaxed text-text-muted">Select up to three agreement cards below to compare scope, progress, disputes, and payout load.</p>
              )}

              {agreementComparisonError ? (
                <div className="mt-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3">
                  <p className="text-xs font-semibold text-error">{agreementComparisonError}</p>
                </div>
              ) : null}

              {agreementComparison ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-primary/10 bg-white px-4 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">{agreementComparison.comparedCount} agreements compared</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-text-light">Management brief</p>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-text-main">{agreementComparison.summary}</p>
                  </div>
                  <div className="grid gap-3">
                    {agreementComparison.agreements.map((agreement) => (
                      <div key={agreement.id} className="rounded-2xl border border-surface-border bg-white px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-text-main">{agreement.title}</p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-text-light">{agreement.counterpartyName}</p>
                          </div>
                          <span className={`badge ${getApplicationBadgeClass(agreement.status)}`}>{agreement.status}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-surface-border bg-surface-alt/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-main">{agreement.completedMilestones}/{agreement.milestoneCount} milestones</span>
                          <span className="rounded-full border border-surface-border bg-surface-alt/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-main">{agreement.outstandingPayments} payouts open</span>
                          {agreement.source ? <span className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">{agreement.source.title} / {agreement.source.status}</span> : null}
                          {agreement.hasActiveDispute ? <span className="rounded-full border border-error/10 bg-error/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-error">Active dispute</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeAgreementDecision ? (
                <div className="mt-4 rounded-2xl border border-secondary/10 bg-white px-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">AI Agreement Decision</p>
                      <p className="mt-2 text-sm font-black text-text-main">{activeAgreementDecision.title}</p>
                    </div>
                    {agreementDecisionBriefs[activeAgreementDecision.id] ? (
                      <span className={`badge ${getAgreementDecisionBadgeClass(agreementDecisionBriefs[activeAgreementDecision.id].recommendation)}`}>
                        {agreementDecisionBriefs[activeAgreementDecision.id].recommendation}
                      </span>
                    ) : null}
                  </div>
                  {agreementDecisionBriefErrors[activeAgreementDecision.id] ? (
                    <div className="mt-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3">
                      <p className="text-xs font-semibold text-error">{agreementDecisionBriefErrors[activeAgreementDecision.id]}</p>
                    </div>
                  ) : agreementDecisionBriefs[activeAgreementDecision.id] ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm font-semibold leading-6 text-text-main">{agreementDecisionBriefs[activeAgreementDecision.id].headline}</p>
                      <p className="text-sm font-medium leading-6 text-text-muted">{agreementDecisionBriefs[activeAgreementDecision.id].summary}</p>
                      <div className="rounded-2xl border border-surface-border bg-surface-alt/20 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Next action</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-text-main">{agreementDecisionBriefs[activeAgreementDecision.id].nextAction}</p>
                      </div>
                      <p className="text-xs font-medium italic leading-6 text-text-muted">{agreementDecisionBriefs[activeAgreementDecision.id].suggestedMessage}</p>
                    </div>
                  ) : (
                    <p className="mt-4 text-[11px] font-medium leading-relaxed text-text-muted">Generate a brief from one of the agreement cards below to get a direct next-step recommendation.</p>
                  )}
                </div>
              ) : null}
            </div>
            {upcomingMilestones.map((milestone) => (
              <div key={milestone.id} className="rounded-2xl border border-surface-border bg-surface-alt/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-text-main">{milestone.title}</p>
                  <span className={`badge ${getApplicationBadgeClass(milestone.status)}`}>{milestone.status}</span>
                </div>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{milestone.agreement.title}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-text-muted font-medium leading-relaxed">
                    {milestone.amount || (milestone.dueDate ? `Due ${formatRelativeTime(milestone.dueDate)}` : 'No due date set')}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={`Compare ${milestone.agreement.title}`}
                      onClick={() => toggleAgreementComparisonSelection(milestone.agreement.id)}
                      disabled={!selectedAgreementIds.includes(milestone.agreement.id) && selectedAgreementIds.length >= 3}
                      className={`text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${selectedAgreementIds.includes(milestone.agreement.id) ? 'text-primary' : 'text-text-light hover:text-primary'}`}
                    >
                      {selectedAgreementIds.includes(milestone.agreement.id) ? 'Selected' : 'Compare'}
                    </button>
                    <button
                      type="button"
                      aria-label={`Decision brief ${milestone.agreement.title}`}
                      onClick={() => void handleGenerateAgreementDecisionBrief(milestone.agreement.id)}
                      disabled={agreementDecisionBriefLoadingId === milestone.agreement.id}
                      className="text-[10px] font-black uppercase tracking-widest text-secondary hover:text-primary disabled:opacity-40"
                    >
                      {agreementDecisionBriefLoadingId === milestone.agreement.id ? 'Loading...' : 'AI Brief'}
                    </button>
                    <Link to="/agreements" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Open</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
