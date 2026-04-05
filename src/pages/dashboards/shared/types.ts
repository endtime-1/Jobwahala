// Shared types that are reused across Seeker, Freelancer, and Employer dashboards.
// Dashboard-specific types (e.g. SeekerApplication, RecommendedJob) remain in each dashboard's own type file.

export type UpcomingMilestone = {
  id: string
  title: string
  amount?: string | null
  currency?: string | null
  dueDate?: string | null
  status: string
  agreement: {
    id: string
    title: string
    type: string
    updatedAt: string
  }
}

export type AgreementComparisonRecord = {
  summary: string
  comparedCount: number
  agreements: Array<{
    id: string
    type: 'JOB' | 'SERVICE'
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
    title: string
    summary?: string | null
    amount?: string | null
    currency?: string | null
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

export type AgreementDecisionBriefRecord = {
  recommendation: 'COMPLETE' | 'HOLD' | 'ESCALATE'
  headline: string
  summary: string
  strengths: string[]
  cautions: string[]
  nextAction: string
  suggestedMessage: string
}

export type DashboardAgreementOption = {
  id: string
  title: string
  type: string
  updatedAt: string
}

export type PaymentActionItem = {
  id: string
  title: string
  amount?: string | null
  currency?: string | null
  dueDate?: string | null
  status: string
  paymentStatus: string
  paymentRequestedAt?: string | null
  paidAt?: string | null
  action: 'REQUEST_PAYMENT' | 'MARK_PAID'
  counterpartyName: string
  agreement: {
    id: string
    title: string
    type: string
    updatedAt: string
  }
}

export type ProposalActionItem = {
  id: string
  type: string
  status: string
  title: string
  amount?: string | null
  currency?: string | null
  timeline?: string | null
  expiresAt?: string | null
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
    } | null
  } | null
}

export type ProposalComparisonRecord = {
  summary: string
  comparedCount: number
  proposals: ProposalActionItem[]
}

export type ReviewActionItem = {
  id: string
  title: string
  type: string
  updatedAt: string
  counterpartyName: string
  source: {
    kind: 'APPLICATION' | 'SERVICE_REQUEST'
    id: string
    title: string
  } | null
}

export type DisputeActionItem = {
  id: string
  title: string
  type: string
  status: string
  createdAt: string
  updatedAt: string
  openedByCurrentUser: boolean
  counterpartyName: string
  agreement: {
    id: string
    title: string
    type: string
    status: string
    updatedAt: string
  }
}

export type VerificationState = {
  requiredType?: string | null
  verificationStatus?: string | null
  isVerified?: boolean
  latestVerificationRequest?: {
    id?: string
    type?: string
    status?: string
    details?: string
    documentUrl?: string | null
    reviewNote?: string | null
    reviewedAt?: string | null
    createdAt?: string
  } | null
  verificationHistory?: Array<{
    id?: string
    type?: string
    status?: string
    details?: string
    documentUrl?: string | null
    reviewNote?: string | null
    reviewedAt?: string | null
    createdAt?: string
  }>
}

export type SentServiceRequest = {
  id: string
  status: string
  createdAt: string
  agreement?: {
    id: string
    status: string
    updatedAt: string
  } | null
  proposals?: Array<{
    id: string
    status: string
    title: string
    updatedAt: string
    creatorId: string
    recipientId: string
  }>
  service: {
    id: string
    title: string
    freelancer: {
      id: string
      email: string
      freelancerProfile?: {
        firstName?: string | null
        lastName?: string | null
      } | null
    }
  }
}
