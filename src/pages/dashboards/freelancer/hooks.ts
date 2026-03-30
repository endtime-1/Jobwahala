import { useQuery } from '@tanstack/react-query'
import { apiGetDashboard, apiGetReceivedServiceRequests } from '../../../lib/api'
import type { UpcomingMilestone, ProposalActionItem, ReviewActionItem, DisputeActionItem, PaymentActionItem, VerificationState } from '../shared/types'

export type ServiceRecord = {
  id: string; title: string; description: string; price: number
  deliveryTime?: string | null; category?: string | null; status: string; createdAt: string
}

export type RecentMessage = {
  id: string
  participant: { id: string; email: string }
  lastMessage: { content: string | null; createdAt: string; attachmentName?: string | null } | null
  unreadCount?: number
}

export type ReceivedServiceRequest = {
  id: string; status: string; message: string
  budget?: string | null; timeline?: string | null; createdAt: string
  agreement?: { id: string; status: string; updatedAt: string } | null
  proposals?: Array<{ id: string; status: string; title: string; updatedAt: string; creatorId: string; recipientId: string }>
  service: { id: string; title: string; price: number; category?: string | null }
  client: {
    id: string; email: string; role: string
    jobSeekerProfile?: { firstName?: string | null; lastName?: string | null } | null
    employerProfile?: { companyName?: string | null } | null
  }
}

export type ProposalTarget = {
  requestId: string; clientName: string; serviceTitle: string
  suggestedAmount?: string | null; suggestedTimeline?: string | null
}

export type ServiceCopilotDraft = { positioning: string; pricingNote: string }

export function useFreelancerDashboard() {
  return useQuery({
    queryKey: ['freelancer', 'dashboard'],
    queryFn: async () => {
      const [data, requestsData] = await Promise.all([apiGetDashboard(), apiGetReceivedServiceRequests()])
      return {
        services: (data.services || []) as ServiceRecord[],
        recentMessages: (data.recentMessages || []) as RecentMessage[],
        requests: (requestsData.requests || []) as ReceivedServiceRequest[],
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
