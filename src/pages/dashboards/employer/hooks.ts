import { useQuery } from '@tanstack/react-query'
import {
  apiGetDashboard,
  apiGetDashboardOverview,
  apiGetDashboardWorkflowSummary,
  apiGetMessageSummary,
  apiGetSentServiceRequests,
  apiGetJobApplicants,
} from '../../../lib/api'
import type {
  EmployerJob,
  RecentApplication,
  SentServiceRequest,
  JobApplicant,
  UpcomingMilestone,
  ProposalActionItem,
  ReviewActionItem,
  DisputeActionItem,
  PaymentActionItem,
  VerificationState,
} from './types'

// --- Full initial dashboard load ---

export function useEmployerDashboard() {
  return useQuery({
    queryKey: ['employer', 'dashboard'],
    queryFn: async () => {
      const [data, requestsData] = await Promise.all([
        apiGetDashboard(),
        apiGetSentServiceRequests(),
      ])

      return {
        jobs: (data.jobs || []) as EmployerJob[],
        recentApplications: (data.recentApplications || []) as RecentApplication[],
        sentRequests: (requestsData.requests || []) as SentServiceRequest[],
        unreadMessages: Number(data.unreadMessages || 0),
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

// --- Lightweight refresh queries ---

export function useEmployerOverview(enabled = true) {
  return useQuery({
    queryKey: ['employer', 'overview'],
    queryFn: async () => {
      const data = await apiGetDashboardOverview()
      return {
        jobs: (data.jobs || []) as EmployerJob[],
        recentApplications: (data.recentApplications || []) as RecentApplication[],
      }
    },
    enabled,
  })
}

export function useEmployerWorkflow(enabled = true) {
  return useQuery({
    queryKey: ['employer', 'workflow'],
    queryFn: async () => {
      const data = await apiGetDashboardWorkflowSummary()
      return {
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
      }
    },
    enabled,
  })
}

export function useMessageSummary(enabled = true) {
  return useQuery({
    queryKey: ['employer', 'messages'],
    queryFn: async () => {
      const data = await apiGetMessageSummary()
      return {
        unreadMessages: Number(data.unreadMessages || 0),
      }
    },
    enabled,
  })
}

export function useSentServiceRequests(enabled = true) {
  return useQuery({
    queryKey: ['employer', 'sentRequests'],
    queryFn: async () => {
      const data = await apiGetSentServiceRequests()
      return (data.requests || []) as SentServiceRequest[]
    },
    enabled,
  })
}

export function useJobApplicants(jobId: string | null) {
  return useQuery({
    queryKey: ['employer', 'applicants', jobId],
    queryFn: async () => {
      if (!jobId) return []
      const data = await apiGetJobApplicants(jobId)
      return (data.applications || []) as JobApplicant[]
    },
    enabled: Boolean(jobId),
  })
}
