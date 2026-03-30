import type { ProposalDraft } from '../../../components/ProposalComposerModal'

// Re-export shared types that are used across all dashboards
export type {
  UpcomingMilestone,
  AgreementComparisonRecord,
  AgreementDecisionBriefRecord,
  DashboardAgreementOption,
  PaymentActionItem,
  ProposalActionItem,
  ProposalComparisonRecord,
  ReviewActionItem,
  DisputeActionItem,
  VerificationState,
  SentServiceRequest,
} from '../shared/types'

// --- Employer-specific types ---

export type EmployerJob = {
  id: string
  title: string
  status: string
  createdAt: string
  postedByAdminAt?: string | null
  postedByAdmin?: {
    id: string
    email: string
  } | null
  _count: {
    applications: number
  }
}

export type RecentApplication = {
  id: string
  status: string
  createdAt: string
  fitScore?: number
  fitReasons?: string[]
  job: {
    id: string
    title: string
  }
  seeker: {
    id?: string
    email: string
    jobSeekerProfile?: {
      firstName?: string | null
      lastName?: string | null
      skills?: string | null
      experience?: string | null
    } | null
  }
}

export type JobApplicant = {
  id: string
  status: string
  createdAt: string
  coverLetter?: string | null
  fitScore?: number
  fitReasons?: string[]
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
  seeker: {
    id: string
    email: string
    jobSeekerProfile?: {
      firstName?: string | null
      lastName?: string | null
      skills?: string | null
      experience?: string | null
    } | null
  }
}

export type ApplicantDecisionBriefRecord = {
  recommendation: 'SHORTLIST' | 'INTERVIEW' | 'SEND_PROPOSAL' | 'HIRE' | 'HOLD'
  headline: string
  summary: string
  strengths: string[]
  cautions: string[]
  nextAction: string
  suggestedMessage: string
}

export type ProposalTarget = {
  applicationId: string
  jobTitle: string
  applicantName: string
  suggestedAmount?: string | null
}

export type JobCopilotDraft = {
  positioning: string
  hiringNote: string
}

export type { ProposalDraft }
