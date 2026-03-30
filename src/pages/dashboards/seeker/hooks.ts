import { useQuery } from '@tanstack/react-query'
import { apiGetDashboard, apiGetSentServiceRequests, apiGetProfileOptimization } from '../../../lib/api'
import type { UpcomingMilestone, ProposalActionItem, ReviewActionItem, DisputeActionItem, PaymentActionItem, VerificationState, SentServiceRequest } from '../shared/types'

export type SeekerApplication = {
  id: string
  status: string
  createdAt: string
  agreement?: { id: string; status: string; updatedAt: string } | null
  job: {
    id: string
    title: string
    location?: string | null
    salary?: string | null
    employer: {
      email: string
      employerProfile?: { companyName?: string | null } | null
    }
  }
}

export type RecommendedJob = {
  id: string
  title: string
  location?: string | null
  salary?: string | null
  matchScore?: number
  matchReasons?: string[]
  employer: {
    email: string
    employerProfile?: { companyName?: string | null } | null
  }
}

export type ProfileOptimization = {
  score: number
  headline: string
  strengths: string[]
  improvements: string[]
  suggestedSummary: string
  suggestedSkills: string[]
  nextCvPrompt: string
  targetRoles: string[]
}

export function useSeekerDashboard() {
  return useQuery({
    queryKey: ['seeker', 'dashboard'],
    queryFn: async () => {
      const [data, requestsData] = await Promise.all([apiGetDashboard(), apiGetSentServiceRequests()])
      return {
        applications: (data.applications || []) as SeekerApplication[],
        recommendedJobs: (data.recommendedJobs || []) as RecommendedJob[],
        sentRequests: (requestsData.requests || []) as SentServiceRequest[],
        unreadMessages: Number(data.unreadMessages || 0),
        cvCount: Number(data.cvCount || 0),
        activeAgreementCount: Number(data.activeAgreementCount || 0),
        upcomingMilestones: (data.upcomingMilestones || []) as UpcomingMilestone[],
        pendingProposalActions: Number(data.pendingProposalActions || 0),
        proposalActionItems: (data.proposalActionItems || []) as ProposalActionItem[],
        pendingReviewActions: Number(data.pendingReviewActions || 0),
        reviewActionItems: (data.reviewActionItems || []) as ReviewActionItem[],
        pendingDisputeActions: Number(data.pendingDisputeActions || 0),
        disputeActionItems: (data.disputeActionItems || []) as DisputeActionItem[],
        pendingPaymentActions: Number(data.pendingPaymentActions || 0),
        paymentActionItems: (data.paymentActionItems || []) as PaymentActionItem[],
        verification: (data.verification || null) as VerificationState | null,
      }
    },
  })
}

export function useProfileOptimization() {
  return useQuery({
    queryKey: ['seeker', 'optimization'],
    queryFn: async () => {
      const data = await apiGetProfileOptimization()
      return (data.optimization || null) as ProfileOptimization | null
    },
  })
}
