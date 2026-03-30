import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, Briefcase, ClipboardList, FileCheck, Handshake, PlusCircle, Sparkles, Star, Wallet } from 'lucide-react'
import {
  apiCompareAgreements,
  apiCreateAgreementDispute,
  apiCreateAgreementMilestone,
  apiCreateAgreementReview,
  apiCreateAgreementMilestonePaymentSession,
  apiGenerateAgreementDecisionBrief,
  apiGetMyAgreements,
  apiVerifyAgreementPayment,
  apiUpdateAgreementPaymentStatus,
  apiUpdateAgreementMilestonePaymentStatus,
  apiUpdateAgreementMilestoneStatus,
  apiUpdateAgreementStatus,
} from '../lib/api'
import { emailHandle, formatRelativeTime, getDisplayName } from '../lib/display'
import { useAuth } from '../context/AuthContext'
import EvidenceUploadField from '../components/EvidenceUploadField'
import { subscribeToRealtimeEvents } from '../lib/realtime'

type AgreementUser = {
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

type AgreementEvent = {
  id: string
  eventType: string
  message: string
  fromStatus?: string | null
  toStatus?: string | null
  createdAt: string
  actor?: AgreementUser | null
}

type AgreementMilestone = {
  id: string
  title: string
  description?: string | null
  amount?: string | null
  dueDate?: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  paymentStatus?: 'PENDING' | 'REQUESTED' | 'PAID'
  paymentRequestedAt?: string | null
  paidAt?: string | null
  payments?: AgreementPayment[]
  createdAt: string
  updatedAt: string
}

type AgreementPayment = {
  id: string
  provider: 'SANDBOX' | 'PAYSTACK' | string
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  amount: string
  currency?: string | null
  providerAmount?: number | null
  reference: string
  checkoutUrl?: string | null
  failureReason?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  payerId: string
  payeeId: string
}

type AgreementReview = {
  id: string
  rating: number
  comment?: string | null
  createdAt: string
  reviewer?: AgreementUser | null
  reviewee?: AgreementUser | null
}

type AgreementDispute = {
  id: string
  type: 'PAYMENT' | 'DELIVERY' | 'QUALITY' | 'COMMUNICATION' | 'OTHER' | string
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED' | string
  title: string
  description: string
  evidenceUrl?: string | null
  resolutionNote?: string | null
  resolvedAt?: string | null
  createdAt: string
  updatedAt: string
  creator?: AgreementUser | null
  counterparty?: AgreementUser | null
  resolver?: {
    id: string
    email: string
  } | null
}

type AgreementRecord = {
  id: string
  type: 'JOB' | 'SERVICE'
  title: string
  summary?: string | null
  amount?: string | null
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  updatedAt: string
  employer?: AgreementUser | null
  seeker?: AgreementUser | null
  freelancer?: AgreementUser | null
  client?: AgreementUser | null
  application?: {
    id: string
    status: string
    job?: {
      id: string
      title: string
      salary?: string | null
    } | null
  } | null
  serviceRequest?: {
    id: string
    status: string
    service?: {
      id: string
      title: string
      price: number
      category?: string | null
    } | null
  } | null
  milestones?: AgreementMilestone[]
  events?: AgreementEvent[]
  reviews?: AgreementReview[]
  disputes?: AgreementDispute[]
}

type MilestoneDraft = {
  title: string
  description: string
  amount: string
  dueDate: string
}

type ReviewDraft = {
  rating: string
  comment: string
}

type DisputeDraft = {
  type: 'PAYMENT' | 'DELIVERY' | 'QUALITY' | 'COMMUNICATION' | 'OTHER'
  title: string
  description: string
  evidenceUrl: string
}

type AgreementComparisonRecord = {
  summary: string
  comparedCount: number
  agreements: Array<{
    id: string
    type: AgreementRecord['type']
    status: AgreementRecord['status']
    title: string
    summary?: string | null
    amount?: string | null
    updatedAt: string
    counterpartyName: string
    source: {
      kind: 'APPLICATION' | 'SERVICE_REQUEST'
      id: string
      title: string
      status: string
    } | null
    milestoneCount: number
    completedMilestones: number
    outstandingPayments: number
    hasActiveDispute: boolean
  }>
}

type AgreementDecisionBriefRecord = {
  recommendation: 'COMPLETE' | 'HOLD' | 'ESCALATE'
  headline: string
  summary: string
  strengths: string[]
  cautions: string[]
  nextAction: string
  suggestedMessage: string
}

const getAgreementBadgeClass = (status: string) => {
  if (status === 'COMPLETED') return 'bg-success text-white'
  if (status === 'CANCELLED') return 'bg-error text-white'
  return 'bg-primary text-white'
}

const getAgreementDecisionBadgeClass = (
  recommendation: AgreementDecisionBriefRecord['recommendation'],
) => {
  if (recommendation === 'COMPLETE') return 'bg-success text-white'
  if (recommendation === 'ESCALATE') return 'bg-error text-white'
  return 'bg-secondary text-white'
}

const getMilestoneBadgeClass = (status: string) => {
  if (status === 'COMPLETED') return 'bg-success text-white'
  if (status === 'IN_PROGRESS') return 'bg-secondary text-white'
  return 'bg-accent text-white'
}

const getPaymentBadgeClass = (status: string) => {
  if (status === 'PAID') return 'bg-success text-white'
  if (status === 'REQUESTED') return 'bg-primary text-white'
  return 'bg-surface-alt text-text-main'
}

const getPaymentSessionBadgeClass = (status: AgreementPayment['status']) => {
  if (status === 'SUCCEEDED') return 'bg-success text-white'
  if (status === 'FAILED' || status === 'CANCELLED') return 'bg-error text-white'
  if (status === 'PROCESSING') return 'bg-secondary text-white'
  return 'bg-accent text-white'
}

const initialMilestoneDraft: MilestoneDraft = {
  title: '',
  description: '',
  amount: '',
  dueDate: '',
}

const initialReviewDraft: ReviewDraft = {
  rating: '5',
  comment: '',
}

const initialDisputeDraft: DisputeDraft = {
  type: 'DELIVERY',
  title: '',
  description: '',
  evidenceUrl: '',
}

const getAgreementUserName = (user?: AgreementUser | null) => {
  if (!user) return 'Unknown'
  return (
    user.employerProfile?.companyName ||
    getDisplayName(
      user.jobSeekerProfile?.firstName || user.freelancerProfile?.firstName,
      user.jobSeekerProfile?.lastName || user.freelancerProfile?.lastName,
      user.email,
    )
  )
}

export default function Agreements() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState('')
  const [milestoneDrafts, setMilestoneDrafts] = useState<Record<string, MilestoneDraft>>({})
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({})
  const [disputeDrafts, setDisputeDrafts] = useState<Record<string, DisputeDraft>>({})
  const [selectedAgreementIds, setSelectedAgreementIds] = useState<string[]>([])
  const [comparison, setComparison] = useState<AgreementComparisonRecord | null>(null)
  const [comparisonError, setComparisonError] = useState('')
  const [isComparing, setIsComparing] = useState(false)
  const [decisionBriefs, setDecisionBriefs] = useState<Record<string, AgreementDecisionBriefRecord>>({})
  const [decisionBriefErrors, setDecisionBriefErrors] = useState<Record<string, string>>({})
  const [decisionBriefLoadingId, setDecisionBriefLoadingId] = useState<string | null>(null)

  const loadAgreements = async () => {
    try {
      const data = await apiGetMyAgreements()
      setAgreements((data.agreements || []) as AgreementRecord[])
      setError('')
      setDecisionBriefs({})
      setDecisionBriefErrors({})
      setDecisionBriefLoadingId(null)
    } catch (err: any) {
      setError(err.message || 'Unable to load agreements right now.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAgreements()
  }, [])

  useEffect(() => {
    if (!user) return

    return subscribeToRealtimeEvents({
      onAgreementsRefresh: () => {
        void loadAgreements()
      },
    })
  }, [user?.id])

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const agreementId = searchParams.get('agreementId')
    const paymentId = searchParams.get('paymentId')
    const provider = searchParams.get('provider')

    if (!agreementId || !paymentId || provider !== 'PAYSTACK') {
      return
    }

    let isCancelled = false

    const verifyPayment = async () => {
      setError('')
      setIsActing(true)

      try {
        await apiVerifyAgreementPayment(agreementId, paymentId)
        if (!isCancelled) {
          await loadAgreements()
          navigate('/agreements', { replace: true })
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Unable to verify this payment right now.')
        }
      } finally {
        if (!isCancelled) {
          setIsActing(false)
        }
      }
    }

    void verifyPayment()

    return () => {
      isCancelled = true
    }
  }, [location.search, navigate])

  const handleStatusUpdate = async (agreementId: string, status: 'COMPLETED' | 'CANCELLED') => {
    setError('')
    setIsActing(true)

    try {
      await apiUpdateAgreementStatus(agreementId, status)
      await loadAgreements()
    } catch (err: any) {
      setError(err.message || 'Unable to update this agreement right now.')
    } finally {
      setIsActing(false)
    }
  }

  const handleMilestoneDraftChange = (
    agreementId: string,
    field: keyof MilestoneDraft,
    value: string,
  ) => {
    setMilestoneDrafts((current) => ({
      ...current,
      [agreementId]: {
        ...(current[agreementId] || initialMilestoneDraft),
        [field]: value,
      },
    }))
  }

  const resetMilestoneDraft = (agreementId: string) => {
    setMilestoneDrafts((current) => ({
      ...current,
      [agreementId]: initialMilestoneDraft,
    }))
  }

  const handleReviewDraftChange = (
    agreementId: string,
    field: keyof ReviewDraft,
    value: string,
  ) => {
    setReviewDrafts((current) => ({
      ...current,
      [agreementId]: {
        ...(current[agreementId] || initialReviewDraft),
        [field]: value,
      },
    }))
  }

  const resetReviewDraft = (agreementId: string) => {
    setReviewDrafts((current) => ({
      ...current,
      [agreementId]: initialReviewDraft,
    }))
  }

  const handleDisputeDraftChange = (
    agreementId: string,
    field: keyof DisputeDraft,
    value: string,
  ) => {
    setDisputeDrafts((current) => ({
      ...current,
      [agreementId]: {
        ...(current[agreementId] || initialDisputeDraft),
        [field]: value,
      },
    }))
  }

  const resetDisputeDraft = (agreementId: string) => {
    setDisputeDrafts((current) => ({
      ...current,
      [agreementId]: initialDisputeDraft,
    }))
  }

  const handleCreateMilestone = async (
    event: FormEvent<HTMLFormElement>,
    agreementId: string,
  ) => {
    event.preventDefault()
    const draft = milestoneDrafts[agreementId] || initialMilestoneDraft

    setError('')
    setIsActing(true)

    try {
      await apiCreateAgreementMilestone(agreementId, {
        title: draft.title,
        description: draft.description || undefined,
        amount: draft.amount || undefined,
        dueDate: draft.dueDate
          ? new Date(`${draft.dueDate}T00:00:00.000Z`).toISOString()
          : undefined,
      })
      resetMilestoneDraft(agreementId)
      await loadAgreements()
    } catch (err: any) {
      setError(err.message || 'Unable to add this milestone right now.')
    } finally {
      setIsActing(false)
    }
  }

  const handleCreateReview = async (
    event: FormEvent<HTMLFormElement>,
    agreementId: string,
  ) => {
    event.preventDefault()
    const draft = reviewDrafts[agreementId] || initialReviewDraft

    setError('')
    setIsActing(true)

    try {
      await apiCreateAgreementReview(agreementId, {
        rating: Number(draft.rating),
        comment: draft.comment || undefined,
      })
      resetReviewDraft(agreementId)
      await loadAgreements()
    } catch (err: any) {
      setError(err.message || 'Unable to submit this review right now.')
    } finally {
      setIsActing(false)
    }
  }

  const handleCreateDispute = async (
    event: FormEvent<HTMLFormElement>,
    agreementId: string,
  ) => {
    event.preventDefault()
    const draft = disputeDrafts[agreementId] || initialDisputeDraft

    setError('')
    setIsActing(true)

    try {
      await apiCreateAgreementDispute(agreementId, {
        type: draft.type,
        title: draft.title,
        description: draft.description,
        evidenceUrl: draft.evidenceUrl || undefined,
      })
      resetDisputeDraft(agreementId)
      await loadAgreements()
    } catch (err: any) {
      setError(err.message || 'Unable to open this dispute right now.')
    } finally {
      setIsActing(false)
    }
  }

  const handleMilestoneStatusUpdate = async (
    agreementId: string,
    milestoneId: string,
    status: AgreementMilestone['status'],
  ) => {
    setError('')
    setIsActing(true)

    try {
      await apiUpdateAgreementMilestoneStatus(agreementId, milestoneId, status)
      await loadAgreements()
    } catch (err: any) {
      setError(err.message || 'Unable to update this milestone right now.')
    } finally {
      setIsActing(false)
    }
  }

  const handleMilestonePaymentStatusUpdate = async (
    agreementId: string,
    milestoneId: string,
    status: 'REQUESTED' | 'PAID',
  ) => {
    setError('')
    setIsActing(true)

    try {
      await apiUpdateAgreementMilestonePaymentStatus(agreementId, milestoneId, status)
      await loadAgreements()
    } catch (err: any) {
      setError(err.message || 'Unable to update this milestone payment right now.')
    } finally {
      setIsActing(false)
    }
  }

  const handleCreatePaymentSession = async (agreementId: string, milestoneId: string) => {
    setError('')
    setIsActing(true)

    try {
      const data = await apiCreateAgreementMilestonePaymentSession(agreementId, milestoneId)
      if (data.payment?.provider === 'PAYSTACK' && data.payment?.checkoutUrl) {
        window.location.assign(data.payment.checkoutUrl)
        return
      }
      await loadAgreements()
    } catch (err: any) {
      setError(err.message || 'Unable to start this payment session right now.')
    } finally {
      setIsActing(false)
    }
  }

  const handleVerifyPayment = async (agreementId: string, paymentId: string) => {
    setError('')
    setIsActing(true)

    try {
      await apiVerifyAgreementPayment(agreementId, paymentId)
      await loadAgreements()
    } catch (err: any) {
      setError(err.message || 'Unable to verify this payment right now.')
    } finally {
      setIsActing(false)
    }
  }

  const handleUpdatePaymentStatus = async (
    agreementId: string,
    paymentId: string,
    status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED',
  ) => {
    setError('')
    setIsActing(true)

    try {
      await apiUpdateAgreementPaymentStatus(agreementId, paymentId, status)
      await loadAgreements()
    } catch (err: any) {
      setError(err.message || 'Unable to update this payment session right now.')
    } finally {
      setIsActing(false)
    }
  }

  const toggleAgreementSelection = (agreementId: string) => {
    setComparison(null)
    setComparisonError('')
    setSelectedAgreementIds((current) => {
      if (current.includes(agreementId)) {
        return current.filter((value) => value !== agreementId)
      }

      if (current.length >= 3) {
        return current
      }

      return [...current, agreementId]
    })
  }

  const handleGenerateComparison = async () => {
    if (selectedAgreementIds.length < 2) {
      return
    }

    setComparisonError('')
    setIsComparing(true)

    try {
      const data = await apiCompareAgreements(selectedAgreementIds)
      setComparison((data.comparison || null) as AgreementComparisonRecord | null)
    } catch (err: any) {
      setComparisonError(err.message || 'Unable to compare these agreements right now.')
    } finally {
      setIsComparing(false)
    }
  }

  const activeAgreements = useMemo(() => agreements.filter((agreement) => agreement.status === 'ACTIVE'), [agreements])
  const closedAgreements = useMemo(() => agreements.filter((agreement) => agreement.status !== 'ACTIVE'), [agreements])
  const selectedAgreements = useMemo(
    () =>
      selectedAgreementIds
        .map((agreementId) => agreements.find((agreement) => agreement.id === agreementId) || null)
        .filter(Boolean) as AgreementRecord[],
    [agreements, selectedAgreementIds],
  )

  useEffect(() => {
    const availableAgreementIds = new Set(agreements.map((agreement) => agreement.id))
    setSelectedAgreementIds((current) => current.filter((agreementId) => availableAgreementIds.has(agreementId)))
    setDecisionBriefs((current) =>
      Object.fromEntries(Object.entries(current).filter(([agreementId]) => availableAgreementIds.has(agreementId))),
    )
    setDecisionBriefErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([agreementId]) => availableAgreementIds.has(agreementId))),
    )
  }, [agreements])

  const handleGenerateDecisionBrief = async (agreementId: string) => {
    setDecisionBriefErrors((current) => ({
      ...current,
      [agreementId]: '',
    }))
    setDecisionBriefLoadingId(agreementId)

    try {
      const data = await apiGenerateAgreementDecisionBrief(agreementId)
      const brief = (data.brief || null) as AgreementDecisionBriefRecord | null
      if (!brief) {
        throw new Error('Decision brief response was empty.')
      }

      setDecisionBriefs((current) => ({
        ...current,
        [agreementId]: brief,
      }))
    } catch (err: any) {
      setDecisionBriefErrors((current) => ({
        ...current,
        [agreementId]: err.message || 'Unable to generate an agreement decision brief right now.',
      }))
    } finally {
      setDecisionBriefLoadingId((current) => (current === agreementId ? null : current))
    }
  }

  const getCounterparty = (agreement: AgreementRecord) => {
    if (!user) return null
    const candidates = [agreement.employer, agreement.seeker, agreement.freelancer, agreement.client].filter(Boolean) as AgreementUser[]
    return candidates.find((candidate) => candidate.id !== user.id) || null
  }

  const getPaymentActors = (agreement: AgreementRecord) => {
    if (agreement.type === 'JOB') {
      return {
        payerId: agreement.employer?.id || '',
        payeeId: agreement.seeker?.id || '',
      }
    }

    return {
      payerId: agreement.client?.id || '',
      payeeId: agreement.freelancer?.id || '',
    }
  }

  const renderAgreementCard = (agreement: AgreementRecord) => {
    const counterparty = getCounterparty(agreement)
    const counterpartyName = getAgreementUserName(counterparty)
    const counterpartyEmail = counterparty?.email || ''
    const milestones = agreement.milestones || []
    const completedMilestones = milestones.filter((milestone) => milestone.status === 'COMPLETED').length
    const paidMilestones = milestones.filter(
      (milestone) => !milestone.amount || milestone.paymentStatus === 'PAID',
    ).length
    const hasIncompleteWork = milestones.some((milestone) => milestone.status !== 'COMPLETED')
    const hasOutstandingPayouts = milestones.some(
      (milestone) => Boolean(milestone.amount) && milestone.paymentStatus !== 'PAID',
    )
    const draft = milestoneDrafts[agreement.id] || initialMilestoneDraft
    const events = agreement.events || []
    const reviews = agreement.reviews || []
    const disputes = agreement.disputes || []
    const reviewDraft = reviewDrafts[agreement.id] || initialReviewDraft
    const disputeDraft = disputeDrafts[agreement.id] || initialDisputeDraft
    const decisionBrief = decisionBriefs[agreement.id]
    const decisionBriefError = decisionBriefErrors[agreement.id]
    const hasSubmittedReview = reviews.some((review) => review.reviewer?.id === user?.id)
    const hasActiveDispute = disputes.some((dispute) => ['OPEN', 'UNDER_REVIEW'].includes(dispute.status))
    const canReview =
      agreement.status === 'COMPLETED' &&
      Boolean(counterparty) &&
      !hasSubmittedReview &&
      !hasActiveDispute
    const canOpenDispute = agreement.status !== 'CANCELLED' && !hasActiveDispute
    const { payerId, payeeId } = getPaymentActors(agreement)

    return (
      <div key={agreement.id} className="dashboard-panel p-5 sm:p-7 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="badge bg-secondary text-white border-none text-[9px] uppercase tracking-widest">{agreement.type}</span>
                <span className={`badge ${getAgreementBadgeClass(agreement.status)}`}>{agreement.status}</span>
              </div>
              <h2 className="text-2xl font-black text-text-main tracking-tight">{agreement.title}</h2>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                {counterpartyName} / updated {formatRelativeTime(agreement.updatedAt)}
              </p>
            </div>

            {agreement.summary ? (
              <p className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap">{agreement.summary}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {agreement.amount ? (
                <span className="rounded-xl bg-surface-alt/30 border border-surface-border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                  {agreement.amount}
                </span>
              ) : null}
              <span className="rounded-xl bg-surface-alt/30 border border-surface-border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                Created {formatRelativeTime(agreement.createdAt)}
              </span>
              {agreement.application?.job?.id ? (
                <Link
                  to={`/jobs/${agreement.application.job.id}`}
                  className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/10"
                >
                  View Source Job
                </Link>
              ) : null}
              {counterparty ? (
                <Link
                  to={`/messaging?userId=${counterparty.id}&email=${encodeURIComponent(counterpartyEmail)}`}
                  className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/10"
                >
                  Message Counterparty
                </Link>
              ) : null}
            </div>

            {agreement.status === 'ACTIVE' || decisionBrief || decisionBriefError ? (
              <div className="rounded-[1.5rem] border border-primary/10 bg-primary/5 p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AI Agreement Brief</p>
                    <p className="mt-2 text-sm font-semibold text-text-main">
                      Get a direct read on whether to keep this work active, close it, or escalate the blocker.
                    </p>
                  </div>
                  {decisionBrief ? (
                    <span className={`badge ${getAgreementDecisionBadgeClass(decisionBrief.recommendation)}`}>
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

                    <div className="rounded-2xl border border-dashed border-primary/15 bg-white px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Next action</p>
                      <p className="mt-3 text-sm font-semibold leading-7 text-text-main">
                        {decisionBrief.nextAction}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-surface-border bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-success">What is working</p>
                        <div className="mt-3 space-y-2">
                          {decisionBrief.strengths.length > 0 ? (
                            decisionBrief.strengths.map((strength, index) => (
                              <p key={`${agreement.id}-decision-strength-${index}`} className="text-sm font-medium leading-6 text-text-muted">
                                {strength}
                              </p>
                            ))
                          ) : (
                            <p className="text-sm font-medium leading-6 text-text-muted">
                              No specific strength was flagged beyond the visible agreement record.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-surface-border bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-error">Watch before moving</p>
                        <div className="mt-3 space-y-2">
                          {decisionBrief.cautions.length > 0 ? (
                            decisionBrief.cautions.map((caution, index) => (
                              <p key={`${agreement.id}-decision-caution-${index}`} className="text-sm font-medium leading-6 text-text-muted">
                                {caution}
                              </p>
                            ))
                          ) : (
                            <p className="text-sm font-medium leading-6 text-text-muted">
                              No major blocker was flagged from the visible workflow record.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-primary/15 bg-white px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Suggested message</p>
                      <p className="mt-3 text-sm font-medium italic leading-7 text-text-muted">
                        {decisionBrief.suggestedMessage}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-surface-border bg-white px-4 py-4 text-sm font-medium text-text-muted">
                    Generate a brief to get a direct operational read on the current state of this agreement.
                  </p>
                )}

                {decisionBriefError ? (
                  <div className="mt-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3">
                    <p className="text-sm font-semibold text-error">{decisionBriefError}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-[1.5rem] border border-surface-border bg-surface-alt/10 p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main">Milestone Plan</p>
                    <p className="text-xs text-text-light font-semibold">
                      {completedMilestones} of {milestones.length} milestones completed
                    </p>
                    <p className="text-xs text-text-light font-semibold">
                      {paidMilestones} of {milestones.length} milestone payouts cleared
                    </p>
                  </div>
                </div>
              </div>

              {milestones.length === 0 ? (
                <p className="text-sm text-text-light font-semibold">No milestones added yet.</p>
              ) : (
                <div className="space-y-4">
                  {milestones.map((milestone) => {
                    const paymentStatus = milestone.paymentStatus || 'PENDING'
                    const payments = milestone.payments || []
                    const latestPayment = payments[0] || null
                    const isSandboxPayment = latestPayment?.provider !== 'PAYSTACK'
                    const isPaystackPayment = latestPayment?.provider === 'PAYSTACK'
                    const canRequestPayment =
                      Boolean(milestone.amount) &&
                      agreement.status === 'ACTIVE' &&
                      milestone.status === 'COMPLETED' &&
                      paymentStatus === 'PENDING' &&
                      user?.id === payeeId
                    const canStartPaymentSession =
                      Boolean(milestone.amount) &&
                      agreement.status === 'ACTIVE' &&
                      milestone.status === 'COMPLETED' &&
                      paymentStatus === 'REQUESTED' &&
                      user?.id === payerId &&
                      (!latestPayment || ['FAILED', 'CANCELLED'].includes(latestPayment.status))
                    const canCompleteSandboxPayment =
                      Boolean(milestone.amount) &&
                      agreement.status === 'ACTIVE' &&
                      milestone.status === 'COMPLETED' &&
                      paymentStatus === 'REQUESTED' &&
                      user?.id === payerId &&
                      Boolean(latestPayment) &&
                      ['PENDING', 'PROCESSING'].includes(latestPayment.status) &&
                      isSandboxPayment
                    const canVerifyProviderPayment =
                      Boolean(milestone.amount) &&
                      agreement.status === 'ACTIVE' &&
                      milestone.status === 'COMPLETED' &&
                      paymentStatus === 'REQUESTED' &&
                      user?.id === payerId &&
                      Boolean(latestPayment) &&
                      ['PENDING', 'PROCESSING'].includes(latestPayment.status) &&
                      isPaystackPayment
                    const canCancelSandboxPayment =
                      Boolean(latestPayment) &&
                      user?.id === payerId &&
                      latestPayment.status === 'PENDING' &&
                      isSandboxPayment

                    return (
                      <div key={milestone.id} className="rounded-2xl border border-surface-border bg-white p-4">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <p className="text-sm font-black text-text-main">{milestone.title}</p>
                            <span className={`badge ${getMilestoneBadgeClass(milestone.status)}`}>{milestone.status}</span>
                            {milestone.amount ? (
                              <span className={`badge ${getPaymentBadgeClass(paymentStatus)}`}>
                                {paymentStatus === 'PENDING' ? 'PAYMENT PENDING' : paymentStatus}
                              </span>
                            ) : null}
                          </div>
                          {milestone.description ? (
                            <p className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap">
                              {milestone.description}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-3">
                            {milestone.amount ? (
                              <span className="rounded-xl bg-surface-alt/30 border border-surface-border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                                {milestone.amount}
                              </span>
                            ) : null}
                            {milestone.dueDate ? (
                              <span className="rounded-xl bg-surface-alt/30 border border-surface-border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                                Due {new Date(milestone.dueDate).toLocaleDateString()}
                              </span>
                            ) : null}
                            {milestone.amount && milestone.paymentRequestedAt ? (
                              <span className="rounded-xl bg-surface-alt/30 border border-surface-border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                                Requested {new Date(milestone.paymentRequestedAt).toLocaleDateString()}
                              </span>
                            ) : null}
                            {milestone.amount && milestone.paidAt ? (
                              <span className="rounded-xl bg-surface-alt/30 border border-surface-border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-success">
                                Paid {new Date(milestone.paidAt).toLocaleDateString()}
                              </span>
                            ) : null}
                            {latestPayment ? (
                              <span className="rounded-xl bg-surface-alt/30 border border-surface-border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                                Ref {latestPayment.reference}
                              </span>
                            ) : null}
                          </div>

                          {payments.length > 0 ? (
                            <div className="mt-4 rounded-2xl border border-surface-border bg-surface-alt/20 p-4">
                              <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
                                <Wallet className="h-4 w-4 text-primary" /> Payment History
                              </div>
                              <div className="space-y-3">
                                {payments.slice(0, 3).map((payment) => (
                                  <div key={payment.id} className="rounded-xl border border-surface-border bg-white px-4 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <p className="text-sm font-black text-text-main">{payment.reference}</p>
                                      <span className={`badge ${getPaymentSessionBadgeClass(payment.status)}`}>
                                        {payment.status}
                                      </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                                      <span>{payment.amount}</span>
                                      <span>{payment.provider}</span>
                                      <span>{formatRelativeTime(payment.createdAt)}</span>
                                      {payment.completedAt ? <span>Settled {formatRelativeTime(payment.completedAt)}</span> : null}
                                    </div>
                                    {payment.failureReason ? (
                                      <p className="mt-2 text-xs font-semibold text-error">{payment.failureReason}</p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {agreement.status === 'ACTIVE' && milestone.status !== 'COMPLETED' ? (
                            <>
                              {milestone.status !== 'IN_PROGRESS' ? (
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() =>
                                  void handleMilestoneStatusUpdate(agreement.id, milestone.id, 'IN_PROGRESS')
                                }
                                className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] bg-white border border-surface-border text-text-muted hover:border-secondary hover:text-secondary disabled:opacity-60"
                              >
                                Start
                              </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() =>
                                  void handleMilestoneStatusUpdate(agreement.id, milestone.id, 'COMPLETED')
                                }
                                className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] bg-secondary text-white disabled:opacity-60"
                              >
                                Complete
                              </button>
                            </>
                          ) : null}

                          {canRequestPayment ? (
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() =>
                                void handleMilestonePaymentStatusUpdate(
                                  agreement.id,
                                  milestone.id,
                                  'REQUESTED',
                                )
                              }
                              className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] bg-primary text-white disabled:opacity-60"
                            >
                              Request Payment
                            </button>
                          ) : null}

                          {canStartPaymentSession ? (
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => void handleCreatePaymentSession(agreement.id, milestone.id)}
                              className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] bg-success text-white disabled:opacity-60"
                            >
                              Start Payment
                            </button>
                          ) : null}

                          {canCompleteSandboxPayment && latestPayment ? (
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() =>
                                void handleUpdatePaymentStatus(
                                  agreement.id,
                                  latestPayment.id,
                                  'SUCCEEDED',
                                )
                              }
                              className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] bg-success text-white disabled:opacity-60"
                            >
                              Complete Sandbox Payment
                            </button>
                          ) : null}

                          {canVerifyProviderPayment && latestPayment ? (
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => void handleVerifyPayment(agreement.id, latestPayment.id)}
                              className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] bg-success text-white disabled:opacity-60"
                            >
                              Verify Payment
                            </button>
                          ) : null}

                          {canCancelSandboxPayment && latestPayment ? (
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() =>
                                void handleUpdatePaymentStatus(
                                  agreement.id,
                                  latestPayment.id,
                                  'CANCELLED',
                                )
                              }
                              className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] bg-white border border-surface-border text-text-muted hover:border-error hover:text-error disabled:opacity-60"
                            >
                              Cancel Session
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}

              {agreement.status === 'ACTIVE' && (hasIncompleteWork || hasOutstandingPayouts) ? (
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                  Complete every milestone and clear each payout before closing this agreement.
                </p>
              ) : null}

              {agreement.status === 'ACTIVE' ? (
                <form
                  onSubmit={(event) => void handleCreateMilestone(event, agreement.id)}
                  className="mt-5 rounded-2xl border border-dashed border-surface-border bg-white p-4 space-y-4"
                >
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-secondary">
                    <PlusCircle className="h-4 w-4" /> Add Milestone
                  </div>
                  <input
                    type="text"
                    placeholder="Milestone title"
                    value={draft.title}
                    onChange={(event) =>
                      handleMilestoneDraftChange(agreement.id, 'title', event.target.value)
                    }
                    className="h-12 font-bold"
                    required
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Amount"
                      value={draft.amount}
                      onChange={(event) =>
                        handleMilestoneDraftChange(agreement.id, 'amount', event.target.value)
                      }
                      className="h-12 font-bold"
                    />
                    <input
                      type="date"
                      value={draft.dueDate}
                      onChange={(event) =>
                        handleMilestoneDraftChange(agreement.id, 'dueDate', event.target.value)
                      }
                      className="h-12 font-bold"
                    />
                  </div>
                  <textarea
                    placeholder="Milestone description"
                    value={draft.description}
                    onChange={(event) =>
                      handleMilestoneDraftChange(agreement.id, 'description', event.target.value)
                    }
                    className="min-h-[120px] font-bold py-4"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isActing}
                      className="btn btn-primary btn-sm font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
                    >
                      Add Milestone
                    </button>
                  </div>
                </form>
              ) : null}
              </div>

              <div className="rounded-[1.5rem] border border-surface-border bg-surface-alt/10 p-5">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-error/10 text-error">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main">Dispute Desk</p>
                      <p className="text-xs font-semibold text-text-light">
                        {disputes.length} dispute{disputes.length === 1 ? '' : 's'} recorded for this agreement
                      </p>
                    </div>
                  </div>
                  {hasActiveDispute ? (
                    <span className="badge bg-error text-white border-none text-[9px] uppercase tracking-widest">
                      Case Open
                    </span>
                  ) : (
                    <span className="badge bg-surface-alt text-text-main border-none text-[9px] uppercase tracking-widest">
                      No active case
                    </span>
                  )}
                </div>

                {disputes.length === 0 ? (
                  <p className="text-sm font-semibold text-text-light">No disputes have been opened on this agreement.</p>
                ) : (
                  <div className="space-y-4">
                    {disputes.map((dispute) => (
                      <div key={dispute.id} className="rounded-2xl border border-surface-border bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-text-main">{dispute.title}</p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                              {dispute.type} / opened by {dispute.creator ? getAgreementUserName(dispute.creator) : 'Unknown'} / {formatRelativeTime(dispute.createdAt)}
                            </p>
                          </div>
                          <span
                            className={`badge border-none text-[9px] uppercase tracking-widest ${
                              dispute.status === 'RESOLVED'
                                ? 'bg-success text-white'
                                : dispute.status === 'DISMISSED'
                                  ? 'bg-surface-alt text-text-main'
                                  : dispute.status === 'UNDER_REVIEW'
                                    ? 'bg-secondary text-white'
                                    : 'bg-error text-white'
                            }`}
                          >
                            {dispute.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-medium leading-relaxed text-text-muted whitespace-pre-wrap">{dispute.description}</p>
                        {dispute.evidenceUrl ? (
                          <a
                            href={dispute.evidenceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:underline"
                          >
                            Open Evidence Link
                          </a>
                        ) : null}
                        {dispute.resolutionNote ? (
                          <p className="mt-3 rounded-2xl border border-surface-border bg-surface px-4 py-3 text-xs font-semibold text-text-muted">
                            Resolution note: {dispute.resolutionNote}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {canOpenDispute ? (
                  <form
                    onSubmit={(event) => void handleCreateDispute(event, agreement.id)}
                    className="mt-5 rounded-2xl border border-dashed border-error/20 bg-white p-4 space-y-4"
                  >
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-error">
                      <AlertTriangle className="h-4 w-4" /> Open Dispute
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <select
                        value={disputeDraft.type}
                        onChange={(event) =>
                          handleDisputeDraftChange(agreement.id, 'type', event.target.value)
                        }
                        className="h-12 rounded-2xl border border-surface-border bg-surface px-4 text-sm font-black text-text-main outline-none focus:border-error"
                      >
                        {['PAYMENT', 'DELIVERY', 'QUALITY', 'COMMUNICATION', 'OTHER'].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Dispute title"
                        value={disputeDraft.title}
                        onChange={(event) =>
                          handleDisputeDraftChange(agreement.id, 'title', event.target.value)
                        }
                        className="h-12 font-bold"
                        required
                      />
                    </div>
                    <textarea
                      placeholder="Describe the issue and what needs review"
                      value={disputeDraft.description}
                      onChange={(event) =>
                        handleDisputeDraftChange(agreement.id, 'description', event.target.value)
                      }
                      className="min-h-[120px] font-bold py-4"
                      required
                    />
                    <EvidenceUploadField
                      category="dispute"
                      label="Evidence Link"
                      value={disputeDraft.evidenceUrl}
                      onChange={(value) =>
                        handleDisputeDraftChange(agreement.id, 'evidenceUrl', value)
                      }
                      disabled={isActing}
                      placeholder="Evidence link (optional)"
                      helperText="Attach a document or screenshot if the dispute needs supporting proof."
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                        One active dispute at a time per agreement
                      </p>
                      <button
                        type="submit"
                        disabled={isActing}
                        className="rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] bg-error text-white disabled:opacity-60"
                      >
                        Submit Dispute
                      </button>
                    </div>
                  </form>
                ) : hasActiveDispute ? (
                  <p className="mt-4 text-xs font-semibold text-error">
                    This agreement already has an active dispute. Admin must resolve it before another case can be opened or the agreement can be closed.
                  </p>
                ) : null}
              </div>

              <div className="rounded-[1.5rem] border border-surface-border bg-surface-alt/10 p-5">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                      <Star className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main">Trust Ledger</p>
                      <p className="text-xs font-semibold text-text-light">
                        {reviews.length} review{reviews.length === 1 ? '' : 's'} recorded for this agreement
                      </p>
                    </div>
                  </div>
                  {agreement.status === 'COMPLETED' ? (
                    <span className="badge bg-success text-white border-none text-[9px] uppercase tracking-widest">
                      Review Window Open
                    </span>
                  ) : (
                    <span className="badge bg-surface-alt text-text-main border-none text-[9px] uppercase tracking-widest">
                      Reviews unlock on completion
                    </span>
                  )}
                </div>

                {reviews.length === 0 ? (
                  <p className="text-sm font-semibold text-text-light">No reviews have been submitted for this agreement yet.</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="rounded-2xl border border-surface-border bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-text-main">
                              {review.reviewer ? getAgreementUserName(review.reviewer) : 'Unknown reviewer'}
                            </p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                              {formatRelativeTime(review.createdAt)}
                            </p>
                          </div>
                          <span className="badge bg-accent text-white border-none text-[9px] uppercase tracking-widest">
                            {review.rating}/5 stars
                          </span>
                        </div>
                        {review.comment ? (
                          <p className="mt-3 text-sm font-medium leading-relaxed text-text-muted">{review.comment}</p>
                        ) : (
                          <p className="mt-3 text-xs font-semibold text-text-light">No written note was left with this rating.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {canReview ? (
                  <form onSubmit={(event) => void handleCreateReview(event, agreement.id)} className="mt-5 rounded-2xl border border-accent/15 bg-white p-4 sm:p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main">Leave A Review</p>
                        <p className="mt-1 text-xs font-semibold text-text-light">
                          Share a rating for {counterpartyName} now that this agreement is complete.
                        </p>
                      </div>
                      <select
                        value={reviewDraft.rating}
                        onChange={(event) => handleReviewDraftChange(agreement.id, 'rating', event.target.value)}
                        className="h-11 rounded-2xl border border-surface-border bg-surface px-4 text-sm font-black text-text-main outline-none focus:border-accent"
                      >
                        {[5, 4, 3, 2, 1].map((value) => (
                          <option key={value} value={value}>
                            {value} Star{value === 1 ? '' : 's'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={reviewDraft.comment}
                      onChange={(event) => handleReviewDraftChange(agreement.id, 'comment', event.target.value)}
                      className="min-h-[110px] w-full rounded-3xl border border-surface-border bg-surface px-4 py-3 text-sm text-text-main outline-none focus:border-accent"
                      placeholder={`What stood out about working with ${counterpartyName}?`}
                    />
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                        One review per participant for this agreement
                      </p>
                      <button
                        type="submit"
                        disabled={isActing}
                        className="btn btn-primary btn-sm font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
                      >
                        Submit Review
                      </button>
                    </div>
                  </form>
                ) : agreement.status === 'COMPLETED' && hasActiveDispute ? (
                  <p className="mt-4 text-xs font-semibold text-error">Reviews are locked while an active dispute is open on this agreement.</p>
                ) : agreement.status === 'COMPLETED' && hasSubmittedReview ? (
                  <p className="mt-4 text-xs font-semibold text-success">Your review has already been recorded for this agreement.</p>
                ) : null}
              </div>

              <div className="rounded-[1.5rem] border border-surface-border bg-surface-alt/10 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main">Activity Trail</p>
                  <p className="text-xs text-text-light font-semibold">Agreement lifecycle history</p>
                </div>
              </div>

              {events.length === 0 ? (
                <p className="text-sm text-text-light font-semibold">No agreement events have been recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="mt-1 h-3 w-3 rounded-full bg-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-main">{event.message}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                          {(event.actor ? getAgreementUserName(event.actor) : 'System') + ' / ' + formatRelativeTime(event.createdAt)}
                        </p>
                        {(event.fromStatus || event.toStatus) ? (
                          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                            {(event.fromStatus || 'NONE') + ' -> ' + (event.toStatus || 'NONE')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:w-[220px]">
            <button
              type="button"
              aria-label={`Compare ${agreement.title}`}
              onClick={() => toggleAgreementSelection(agreement.id)}
              disabled={!selectedAgreementIds.includes(agreement.id) && selectedAgreementIds.length >= 3}
              className={`btn btn-sm w-full disabled:opacity-40 ${
                selectedAgreementIds.includes(agreement.id)
                  ? 'border-primary/20 bg-primary text-white hover:bg-primary-dark'
                  : 'btn-outline'
              }`}
            >
              {selectedAgreementIds.includes(agreement.id) ? 'Selected' : 'Compare'}
            </button>
            {agreement.status === 'ACTIVE' ? (
              <button
                type="button"
                disabled={decisionBriefLoadingId === agreement.id}
                onClick={() => void handleGenerateDecisionBrief(agreement.id)}
                className="btn btn-outline btn-sm w-full disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {decisionBriefLoadingId === agreement.id ? 'Generating Brief...' : 'Generate AI Decision Brief'}
              </button>
            ) : null}
            {agreement.status === 'ACTIVE' ? (
              <>
              <button
                type="button"
                disabled={isActing || hasIncompleteWork || hasOutstandingPayouts || hasActiveDispute}
                onClick={() => void handleStatusUpdate(agreement.id, 'COMPLETED')}
                className="btn btn-primary btn-sm w-full font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
              >
                Mark Completed
              </button>
              <button
                type="button"
                disabled={isActing || hasActiveDispute}
                onClick={() => void handleStatusUpdate(agreement.id, 'CANCELLED')}
                className="btn btn-sm w-full bg-error/10 text-error border border-error/10 hover:bg-error/20 font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
              >
                Cancel Agreement
              </button>
              </>
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
              <Handshake className="h-3.5 w-3.5" /> Work agreements
            </div>
            <h1 className="mb-3 text-4xl font-black leading-tight tracking-tighter text-text-main md:text-5xl">
              Active work records, milestones, and payouts.
            </h1>
            <p className="text-base font-medium tracking-tight text-text-muted md:text-lg">
              Agreements are created automatically when a candidate is hired or a service request is accepted. Manage live work, completion, cancellation, and milestone payment actions here.
            </p>
          </div>

          <div className="dashboard-panel grid min-w-0 grid-cols-3 gap-3 px-5 py-5 sm:min-w-[20rem] sm:px-6">
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{agreements.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Total</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{activeAgreements.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Active</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{closedAgreements.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">History</p>
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
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AI Agreement Comparison</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-text-main">
              Compare live work records before you prioritize the next move.
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void handleGenerateComparison()}
            disabled={selectedAgreementIds.length < 2 || isComparing}
            className="btn btn-primary btn-sm px-5 py-3 text-[10px] font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> {isComparing ? 'Comparing...' : 'Generate AI Comparison'}
          </button>
        </div>

        {selectedAgreements.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {selectedAgreements.map((agreement) => (
              <button
                key={agreement.id}
                type="button"
                onClick={() => toggleAgreementSelection(agreement.id)}
                className="rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary hover:text-white"
              >
                {agreement.title} selected
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.8rem] border border-dashed border-surface-border bg-surface-alt/30 px-5 py-6">
            <p className="text-sm font-bold text-text-main">No agreements selected yet.</p>
            <p className="mt-2 text-sm font-medium text-text-muted">
              Pick up to three agreements below to compare progress, payout readiness, and dispute risk side by side.
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
                  {comparison.comparedCount} agreements compared
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-light">
                  Progress, payout, and risk
                </p>
              </div>
              <p className="mt-3 text-sm font-semibold leading-7 text-text-main">{comparison.summary}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {comparison.agreements.map((agreement) => (
                <div key={agreement.id} className="rounded-[1.8rem] border border-surface-border bg-surface-alt/35 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black tracking-tight text-text-main">{agreement.title}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-text-light">
                        {agreement.counterpartyName}
                      </p>
                    </div>
                    <span className={`badge ${getAgreementBadgeClass(agreement.status)}`}>{agreement.status}</span>
                  </div>

                  {agreement.summary ? (
                    <p className="mt-4 text-sm leading-relaxed text-text-muted whitespace-pre-wrap">
                      {agreement.summary}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {agreement.amount ? (
                      <span className="rounded-full border border-surface-border bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-main">
                        {agreement.amount}
                      </span>
                    ) : null}
                    {agreement.source ? (
                      <span className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                        {agreement.source.title} / {agreement.source.status}
                      </span>
                    ) : null}
                    {agreement.hasActiveDispute ? (
                      <span className="rounded-full border border-error/10 bg-error/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-error">
                        Dispute Active
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-surface-border bg-white px-3 py-3 text-center">
                      <p className="text-lg font-black text-text-main">{agreement.milestoneCount}</p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-text-light">Milestones</p>
                    </div>
                    <div className="rounded-2xl border border-surface-border bg-white px-3 py-3 text-center">
                      <p className="text-lg font-black text-text-main">{agreement.completedMilestones}</p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-text-light">Done</p>
                    </div>
                    <div className="rounded-2xl border border-surface-border bg-white px-3 py-3 text-center">
                      <p className="text-lg font-black text-text-main">{agreement.outstandingPayments}</p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-text-light">Payouts</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div className="metric-rail mb-10 md:mb-14 xl:grid-cols-3">
        <div className="metric-card metric-card--solid">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Handshake className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-black text-text-main">{agreements.length}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Total</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-success/10 text-success flex items-center justify-center">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-black text-text-main">{activeAgreements.length}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Active</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-black text-text-main">{closedAgreements.length}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">History</p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="dashboard-panel p-6 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading agreements...</p>
        </div>
      ) : (
        <div className="space-y-12">
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-text-light">Active Agreements</h2>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{activeAgreements.length}</span>
            </div>
            {activeAgreements.length === 0 ? (
              <div className="dashboard-panel p-6 sm:p-8">
                <p className="text-sm font-semibold text-text-light">No active agreements yet.</p>
              </div>
            ) : (
              <div className="space-y-6">{activeAgreements.map(renderAgreementCard)}</div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-text-light">Agreement History</h2>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{closedAgreements.length}</span>
            </div>
            {closedAgreements.length === 0 ? (
              <div className="dashboard-panel p-6 sm:p-8">
                <p className="text-sm font-semibold text-text-light">No completed or cancelled agreements yet.</p>
              </div>
            ) : (
              <div className="space-y-6">{closedAgreements.map(renderAgreementCard)}</div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
