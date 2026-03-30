import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Handshake, MessageSquare, RefreshCw, Sparkles } from 'lucide-react'
import {
  apiCompareProposals,
  apiCounterProposal,
  apiGenerateProposalDecisionBrief,
  apiGetMyProposals,
  apiUpdateProposalStatus,
} from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { emailHandle, formatRelativeTime, getDisplayName } from '../lib/display'
import { subscribeToRealtimeEvents } from '../lib/realtime'

type ProposalUser = {
  id: string
  email: string
  role?: string
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

type ProposalRevision = {
  id: string
  summary: string
  amount?: string | null
  timeline?: string | null
  message?: string | null
  createdAt: string
  authorId: string
  author?: ProposalUser | null
}

type ProposalRecord = {
  id: string
  type: 'JOB' | 'SERVICE'
  status: 'PENDING' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'
  title: string
  summary: string
  amount?: string | null
  timeline?: string | null
  expiresAt?: string | null
  acceptedAt?: string | null
  createdAt: string
  updatedAt: string
  creatorId: string
  recipientId: string
  creator: ProposalUser
  recipient: ProposalUser
  application?: {
    id: string
    status: string
    agreement?: {
      id: string
      status: string
      updatedAt: string
    } | null
    job: {
      id: string
      title: string
      salary?: string | null
    }
  } | null
  serviceRequest?: {
    id: string
    status: string
    agreement?: {
      id: string
      status: string
      updatedAt: string
    } | null
    service: {
      id: string
      title: string
      price: number
    }
  } | null
  revisions: ProposalRevision[]
}

type CounterDraft = {
  summary: string
  amount: string
  timeline: string
  expiresAt: string
  message: string
}

type ProposalComparisonRecord = {
  summary: string
  comparedCount: number
  proposals: Array<{
    id: string
    type: ProposalRecord['type']
    status: ProposalRecord['status']
    title: string
    summary: string
    amount?: string | null
    timeline?: string | null
    updatedAt: string
    counterpartyName: string
    source: {
      kind: 'APPLICATION' | 'SERVICE_REQUEST'
      id: string
      title: string
      status: string
      agreement?: {
        id: string
        status: string
        updatedAt: string
      } | null
    } | null
  }>
}

type ProposalDecisionBriefRecord = {
  recommendation: 'ACCEPT' | 'COUNTER' | 'REJECT'
  headline: string
  summary: string
  strengths: string[]
  cautions: string[]
  suggestedMessage: string
}

const initialCounterDraft: CounterDraft = {
  summary: '',
  amount: '',
  timeline: '',
  expiresAt: '',
  message: '',
}

const getProposalBadgeClass = (status: ProposalRecord['status']) => {
  if (status === 'ACCEPTED') return 'bg-success text-white'
  if (status === 'REJECTED' || status === 'CANCELLED' || status === 'EXPIRED') return 'bg-error text-white'
  if (status === 'COUNTERED') return 'bg-secondary text-white'
  return 'bg-primary text-white'
}

const getDecisionBriefBadgeClass = (
  recommendation: ProposalDecisionBriefRecord['recommendation'],
) => {
  if (recommendation === 'ACCEPT') return 'bg-success text-white'
  if (recommendation === 'REJECT') return 'bg-error text-white'
  return 'bg-secondary text-white'
}

const getUserName = (user?: ProposalUser | null) => {
  if (!user) return 'Unknown'
  return (
    user.employerProfile?.companyName ||
    getDisplayName(
      user.jobSeekerProfile?.firstName || user.freelancerProfile?.firstName,
      user.jobSeekerProfile?.lastName || user.freelancerProfile?.lastName,
      user.email,
    ) ||
    emailHandle(user.email)
  )
}

export default function Proposals() {
  const { user } = useAuth()
  const [proposals, setProposals] = useState<ProposalRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState('')
  const [expandedCounters, setExpandedCounters] = useState<Record<string, boolean>>({})
  const [counterDrafts, setCounterDrafts] = useState<Record<string, CounterDraft>>({})
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([])
  const [comparison, setComparison] = useState<ProposalComparisonRecord | null>(null)
  const [comparisonError, setComparisonError] = useState('')
  const [isComparing, setIsComparing] = useState(false)
  const [decisionBriefs, setDecisionBriefs] = useState<Record<string, ProposalDecisionBriefRecord>>({})
  const [decisionBriefErrors, setDecisionBriefErrors] = useState<Record<string, string>>({})
  const [decisionBriefLoadingId, setDecisionBriefLoadingId] = useState<string | null>(null)

  const loadProposals = async () => {
    try {
      const data = await apiGetMyProposals()
      setProposals((data.proposals || []) as ProposalRecord[])
      setError('')
      setDecisionBriefs({})
      setDecisionBriefErrors({})
      setDecisionBriefLoadingId(null)
    } catch (err: any) {
      setError(err.message || 'Unable to load proposals right now.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadProposals()
  }, [])

  useEffect(() => {
    if (!user) return

    return subscribeToRealtimeEvents({
      onProposalsRefresh: () => {
        void loadProposals()
      },
    })
  }, [user?.id])

  const incoming = useMemo(
    () => proposals.filter((proposal) => proposal.recipientId === user?.id),
    [proposals, user?.id],
  )
  const outgoing = useMemo(
    () => proposals.filter((proposal) => proposal.creatorId === user?.id),
    [proposals, user?.id],
  )
  const selectedProposals = useMemo(
    () =>
      selectedProposalIds
        .map((proposalId) => proposals.find((proposal) => proposal.id === proposalId) || null)
        .filter(Boolean) as ProposalRecord[],
    [proposals, selectedProposalIds],
  )

  useEffect(() => {
    const availableProposalIds = new Set(proposals.map((proposal) => proposal.id))
    setSelectedProposalIds((current) => current.filter((proposalId) => availableProposalIds.has(proposalId)))
    setDecisionBriefs((current) =>
      Object.fromEntries(Object.entries(current).filter(([proposalId]) => availableProposalIds.has(proposalId))),
    )
    setDecisionBriefErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([proposalId]) => availableProposalIds.has(proposalId))),
    )
  }, [proposals])

  const handleStatusUpdate = async (
    proposalId: string,
    status: 'ACCEPTED' | 'REJECTED' | 'CANCELLED',
  ) => {
    setError('')
    setIsActing(true)

    try {
      await apiUpdateProposalStatus(proposalId, status)
      await loadProposals()
    } catch (err: any) {
      setError(err.message || 'Unable to update this proposal right now.')
    } finally {
      setIsActing(false)
    }
  }

  const toggleProposalSelection = (proposalId: string) => {
    setComparison(null)
    setComparisonError('')
    setSelectedProposalIds((current) => {
      if (current.includes(proposalId)) {
        return current.filter((value) => value !== proposalId)
      }

      if (current.length >= 3) {
        return current
      }

      return [...current, proposalId]
    })
  }

  const handleGenerateComparison = async () => {
    if (selectedProposalIds.length < 2) {
      return
    }

    setComparisonError('')
    setIsComparing(true)

    try {
      const data = await apiCompareProposals(selectedProposalIds)
      setComparison((data.comparison || null) as ProposalComparisonRecord | null)
    } catch (err: any) {
      setComparisonError(err.message || 'Unable to compare these proposals right now.')
    } finally {
      setIsComparing(false)
    }
  }

  const handleGenerateDecisionBrief = async (proposalId: string) => {
    setDecisionBriefErrors((current) => ({
      ...current,
      [proposalId]: '',
    }))
    setDecisionBriefLoadingId(proposalId)

    try {
      const data = await apiGenerateProposalDecisionBrief(proposalId)
      const brief = (data.brief || null) as ProposalDecisionBriefRecord | null
      if (!brief) {
        throw new Error('Decision brief response was empty.')
      }
      setDecisionBriefs((current) => ({
        ...current,
        [proposalId]: brief,
      }))
    } catch (err: any) {
      setDecisionBriefErrors((current) => ({
        ...current,
        [proposalId]: err.message || 'Unable to generate a decision brief right now.',
      }))
    } finally {
      setDecisionBriefLoadingId((current) => (current === proposalId ? null : current))
    }
  }

  const updateCounterDraft = (proposalId: string, field: keyof CounterDraft, value: string) => {
    setCounterDrafts((current) => ({
      ...current,
      [proposalId]: {
        ...(current[proposalId] || initialCounterDraft),
        [field]: value,
      },
    }))
  }

  const handleCounterSubmit = async (event: FormEvent<HTMLFormElement>, proposal: ProposalRecord) => {
    event.preventDefault()
    const draft = counterDrafts[proposal.id] || {
      summary: proposal.summary,
      amount: proposal.amount || '',
      timeline: proposal.timeline || '',
      expiresAt: proposal.expiresAt ? new Date(proposal.expiresAt).toISOString().slice(0, 10) : '',
      message: '',
    }

    setError('')
    setIsActing(true)

    try {
      await apiCounterProposal(proposal.id, {
        summary: draft.summary,
        amount: draft.amount || undefined,
        timeline: draft.timeline || undefined,
        expiresAt: draft.expiresAt ? new Date(`${draft.expiresAt}T00:00:00.000Z`).toISOString() : undefined,
        message: draft.message || undefined,
      })
      setExpandedCounters((current) => ({ ...current, [proposal.id]: false }))
      await loadProposals()
    } catch (err: any) {
      setError(err.message || 'Unable to counter this proposal right now.')
    } finally {
      setIsActing(false)
    }
  }

  const renderProposalCard = (proposal: ProposalRecord) => {
    const latestRevision = proposal.revisions[0]
    const canRespond = proposal.status !== 'ACCEPTED' &&
      proposal.status !== 'REJECTED' &&
      proposal.status !== 'CANCELLED' &&
      proposal.status !== 'EXPIRED' &&
      latestRevision?.authorId !== user?.id
    const canCancel = proposal.creatorId === user?.id && (proposal.status === 'PENDING' || proposal.status === 'COUNTERED')
    const counterparty = proposal.creatorId === user?.id ? proposal.recipient : proposal.creator
    const source = proposal.application
      ? {
          label: proposal.application.job.title,
          href: `/jobs/${proposal.application.job.id}`,
          status: proposal.application.status,
          agreement: proposal.application.agreement,
        }
      : proposal.serviceRequest
        ? {
            label: proposal.serviceRequest.service.title,
            href: '/freelancers',
            status: proposal.serviceRequest.status,
            agreement: proposal.serviceRequest.agreement,
          }
        : null
    const draft = counterDrafts[proposal.id] || {
      summary: proposal.summary,
      amount: proposal.amount || '',
      timeline: proposal.timeline || '',
      expiresAt: proposal.expiresAt ? new Date(proposal.expiresAt).toISOString().slice(0, 10) : '',
      message: '',
    }
    const decisionBrief = decisionBriefs[proposal.id]
    const decisionBriefError = decisionBriefErrors[proposal.id]

    return (
      <div key={proposal.id} className="dashboard-panel p-5 sm:p-7 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="badge bg-secondary text-white border-none text-[9px] uppercase tracking-widest">
                  {proposal.type}
                </span>
                <span className={`badge ${getProposalBadgeClass(proposal.status)}`}>{proposal.status}</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-text-main">{proposal.title}</h2>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                {getUserName(counterparty)} / updated {formatRelativeTime(proposal.updatedAt)}
              </p>
            </div>

            <p className="text-sm leading-relaxed text-text-muted whitespace-pre-wrap">{proposal.summary}</p>

            <div className="flex flex-wrap gap-3">
              {proposal.amount ? (
                <span className="rounded-xl border border-surface-border bg-surface-alt/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                  {proposal.amount}
                </span>
              ) : null}
              {proposal.timeline ? (
                <span className="rounded-xl border border-surface-border bg-surface-alt/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                  {proposal.timeline}
                </span>
              ) : null}
              {proposal.expiresAt ? (
                <span className="rounded-xl border border-surface-border bg-surface-alt/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                  Expires {new Date(proposal.expiresAt).toLocaleDateString()}
                </span>
              ) : null}
              {source ? (
                <Link
                  to={source.href}
                  className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/10"
                >
                  Source: {source.label}
                </Link>
              ) : null}
              {source?.agreement ? (
                <Link
                  to="/agreements"
                  className="rounded-xl border border-success/10 bg-success/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-success hover:bg-success/10"
                >
                  Agreement
                </Link>
              ) : null}
              <Link
                to={`/messaging?userId=${counterparty.id}&email=${encodeURIComponent(counterparty.email)}`}
                className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/10"
              >
                Message
              </Link>
            </div>

            <div className="rounded-[1.4rem] border border-surface-border bg-surface-alt/10 p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main">Revision Trail</p>
                  <p className="text-xs font-semibold text-text-light">
                    {proposal.revisions.length} term updates recorded
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {proposal.revisions.map((revision) => (
                  <div key={revision.id} className="rounded-2xl border border-surface-border bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-black text-text-main">{getUserName(revision.author)}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                        {formatRelativeTime(revision.createdAt)}
                      </p>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-text-muted whitespace-pre-wrap">{revision.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {revision.amount ? (
                        <span className="rounded-xl border border-surface-border bg-surface-alt/30 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                          {revision.amount}
                        </span>
                      ) : null}
                      {revision.timeline ? (
                        <span className="rounded-xl border border-surface-border bg-surface-alt/30 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                          {revision.timeline}
                        </span>
                      ) : null}
                    </div>
                    {revision.message ? (
                      <p className="mt-3 text-xs font-medium italic leading-relaxed text-text-muted">
                        {revision.message}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {canRespond || decisionBrief || decisionBriefError ? (
              <div className="rounded-[1.4rem] border border-primary/10 bg-primary/5 p-4">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AI Decision Brief</p>
                    <p className="mt-2 text-sm font-semibold text-text-main">
                      Get a direct accept, counter, or reject read on the current terms.
                    </p>
                  </div>
                  {decisionBrief ? (
                    <span className={`badge ${getDecisionBriefBadgeClass(decisionBrief.recommendation)}`}>
                      {decisionBrief.recommendation}
                    </span>
                  ) : null}
                </div>

                {decisionBrief ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-primary/10 bg-white px-4 py-4">
                      <p className="text-sm font-black text-text-main">{decisionBrief.headline}</p>
                      <p className="mt-2 text-sm font-medium leading-7 text-text-muted">
                        {decisionBrief.summary}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-surface-border bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-success">What looks good</p>
                        <div className="mt-3 space-y-2">
                          {decisionBrief.strengths.length > 0 ? (
                            decisionBrief.strengths.map((strength, index) => (
                              <p key={`${proposal.id}-strength-${index}`} className="text-sm font-medium leading-6 text-text-muted">
                                {strength}
                              </p>
                            ))
                          ) : (
                            <p className="text-sm font-medium leading-6 text-text-muted">
                              The AI did not flag a specific strength beyond the visible terms.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-surface-border bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-error">Watch before you respond</p>
                        <div className="mt-3 space-y-2">
                          {decisionBrief.cautions.length > 0 ? (
                            decisionBrief.cautions.map((caution, index) => (
                              <p key={`${proposal.id}-caution-${index}`} className="text-sm font-medium leading-6 text-text-muted">
                                {caution}
                              </p>
                            ))
                          ) : (
                            <p className="text-sm font-medium leading-6 text-text-muted">
                              No major caution was flagged beyond the visible terms.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-primary/15 bg-white px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Suggested reply</p>
                      <p className="mt-3 text-sm font-medium italic leading-7 text-text-muted">
                        {decisionBrief.suggestedMessage}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-surface-border bg-white px-4 py-4 text-sm font-medium text-text-muted">
                    Generate a brief to get a fast decision read on the current version of the terms.
                  </p>
                )}

                {decisionBriefError ? (
                  <div className="mt-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3">
                    <p className="text-sm font-semibold text-error">{decisionBriefError}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {expandedCounters[proposal.id] ? (
              <form
                onSubmit={(event) => void handleCounterSubmit(event, proposal)}
                className="rounded-[1.4rem] border border-dashed border-surface-border bg-white p-4 space-y-4"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Counter Terms</p>
                <textarea
                  value={draft.summary}
                  onChange={(event) => updateCounterDraft(proposal.id, 'summary', event.target.value)}
                  className="min-h-[140px] py-4 font-bold"
                  placeholder="Refine the scope and terms."
                  required
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input
                    type="text"
                    value={draft.amount}
                    onChange={(event) => updateCounterDraft(proposal.id, 'amount', event.target.value)}
                    className="h-12 font-bold"
                    placeholder="Amount"
                  />
                  <input
                    type="text"
                    value={draft.timeline}
                    onChange={(event) => updateCounterDraft(proposal.id, 'timeline', event.target.value)}
                    className="h-12 font-bold"
                    placeholder="Timeline"
                  />
                  <input
                    type="date"
                    value={draft.expiresAt}
                    onChange={(event) => updateCounterDraft(proposal.id, 'expiresAt', event.target.value)}
                    className="h-12 font-bold"
                  />
                  <input
                    type="text"
                    value={draft.message}
                    onChange={(event) => updateCounterDraft(proposal.id, 'message', event.target.value)}
                    className="h-12 font-bold"
                    placeholder="Optional note"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedCounters((current) => ({ ...current, [proposal.id]: false }))}
                    className="btn btn-outline btn-sm"
                  >
                    Close
                  </button>
                  <button type="submit" disabled={isActing} className="btn btn-primary btn-sm disabled:opacity-60">
                    Send Counter
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          <div className="lg:w-[240px] space-y-3">
            <button
              type="button"
              aria-label={`Compare ${proposal.title}`}
              onClick={() => toggleProposalSelection(proposal.id)}
              disabled={!selectedProposalIds.includes(proposal.id) && selectedProposalIds.length >= 3}
              className={`btn btn-sm w-full disabled:opacity-40 ${
                selectedProposalIds.includes(proposal.id)
                  ? 'border-primary/20 bg-primary text-white hover:bg-primary-dark'
                  : 'btn-outline'
              }`}
            >
              {selectedProposalIds.includes(proposal.id) ? 'Selected' : 'Compare'}
            </button>
            {canRespond ? (
              <button
                type="button"
                disabled={decisionBriefLoadingId === proposal.id}
                onClick={() => void handleGenerateDecisionBrief(proposal.id)}
                className="btn btn-outline btn-sm w-full disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {decisionBriefLoadingId === proposal.id ? 'Generating Brief...' : 'Generate AI Decision Brief'}
              </button>
            ) : null}
            {canRespond ? (
              <>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => void handleStatusUpdate(proposal.id, 'ACCEPTED')}
                  className="btn btn-primary btn-sm w-full disabled:opacity-60"
                >
                  Accept Terms
                </button>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => setExpandedCounters((current) => ({ ...current, [proposal.id]: !current[proposal.id] }))}
                  className="btn btn-outline btn-sm w-full"
                >
                  Counter Terms
                </button>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => void handleStatusUpdate(proposal.id, 'REJECTED')}
                  className="btn btn-sm w-full border border-error/10 bg-error/10 text-error hover:bg-error/15 disabled:opacity-60"
                >
                  Reject Proposal
                </button>
              </>
            ) : null}

            {canCancel ? (
              <button
                type="button"
                disabled={isActing}
                onClick={() => void handleStatusUpdate(proposal.id, 'CANCELLED')}
                className="btn btn-sm w-full border border-error/10 bg-error/10 text-error hover:bg-error/15 disabled:opacity-60"
              >
                Cancel Proposal
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container animate-in fade-in pt-24 pb-24 duration-700 md:pt-28 xl:pt-32">
      <header className="dashboard-hero mb-8 px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="dashboard-kicker mb-4">
              <Handshake className="h-3.5 w-3.5" /> Proposal workspace
            </div>
            <h1 className="mb-3 text-4xl font-black leading-tight tracking-tighter text-text-main md:text-5xl">
              Negotiate terms before work starts.
            </h1>
            <p className="text-base font-medium tracking-tight text-text-muted md:text-lg">
              Proposals turn applications and service requests into structured terms. Accepting one activates the agreement flow you already use.
            </p>
          </div>

          <div className="dashboard-panel grid min-w-0 grid-cols-3 gap-3 px-5 py-5 sm:min-w-[20rem] sm:px-6">
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{proposals.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Total</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{incoming.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Incoming</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{outgoing.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Outgoing</p>
            </div>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mb-8 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </div>
      ) : null}

      <section className="dashboard-panel mb-8 p-5 sm:p-7 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 border-b border-surface-border/50 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AI Proposal Comparison</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-text-main">
              Compare live terms before you accept or counter.
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void handleGenerateComparison()}
            disabled={selectedProposalIds.length < 2 || isComparing}
            className="btn btn-primary btn-sm px-5 py-3 text-[10px] font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> {isComparing ? 'Comparing...' : 'Generate AI Comparison'}
          </button>
        </div>

        {selectedProposals.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {selectedProposals.map((proposal) => (
              <button
                key={proposal.id}
                type="button"
                onClick={() => toggleProposalSelection(proposal.id)}
                className="rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary hover:text-white"
              >
                {proposal.title} selected
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.8rem] border border-dashed border-surface-border bg-surface-alt/30 px-5 py-6">
            <p className="text-sm font-bold text-text-main">No proposal terms selected yet.</p>
            <p className="mt-2 text-sm font-medium text-text-muted">
              Pick up to three proposals below to compare pricing, timeline, and source status side by side.
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
                  {comparison.comparedCount} proposals compared
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-light">
                  Review terms before responding
                </p>
              </div>
              <p className="mt-3 text-sm font-semibold leading-7 text-text-main">{comparison.summary}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {comparison.proposals.map((proposal) => (
                <div key={proposal.id} className="rounded-[1.8rem] border border-surface-border bg-surface-alt/35 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black tracking-tight text-text-main">{proposal.title}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-text-light">
                        {proposal.counterpartyName}
                      </p>
                    </div>
                    <span className={`badge ${getProposalBadgeClass(proposal.status)}`}>{proposal.status}</span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-text-muted whitespace-pre-wrap">
                    {proposal.summary}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {proposal.amount ? (
                      <span className="rounded-full border border-surface-border bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-main">
                        {proposal.amount}
                      </span>
                    ) : null}
                    {proposal.timeline ? (
                      <span className="rounded-full border border-surface-border bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-main">
                        {proposal.timeline}
                      </span>
                    ) : null}
                    {proposal.source ? (
                      <span className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                        {proposal.source.title} / {proposal.source.status}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {isLoading ? (
        <div className="dashboard-panel p-10">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading proposals...</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="dashboard-panel p-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/8 text-primary">
            <ClipboardList className="h-7 w-7" />
          </div>
          <p className="text-lg font-black text-text-main">No proposals yet.</p>
          <p className="mt-2 text-sm font-medium text-text-muted">
            Create them from applicant review or incoming service request cards in your dashboards.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <section className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-text-light">Incoming Proposals</h2>
              <Link to="/messaging" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                Open Inbox
              </Link>
            </div>
            {incoming.length === 0 ? (
              <div className="dashboard-panel p-6">
                <p className="text-sm font-semibold text-text-light">No incoming proposals right now.</p>
              </div>
            ) : (
              <div className="space-y-6">{incoming.map(renderProposalCard)}</div>
            )}
          </section>

          <section className="space-y-5">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-text-light">Outgoing Proposals</h2>
            {outgoing.length === 0 ? (
              <div className="dashboard-panel p-6">
                <p className="text-sm font-semibold text-text-light">No outgoing proposals right now.</p>
              </div>
            ) : (
              <div className="space-y-6">{outgoing.map(renderProposalCard)}</div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
