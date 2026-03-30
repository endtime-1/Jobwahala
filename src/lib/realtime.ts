const rawApiUrl = import.meta.env.VITE_API_URL?.trim()
const BASE_URL = rawApiUrl ? rawApiUrl.replace(/\/$/, '') : '/api'

type RealtimeMessagePayload = {
  conversationId?: string
  reason?: string
  senderId?: string
  actorId?: string
  messageId?: string
  createdAt?: string
}

type RealtimeNotificationPayload = {
  notificationId?: string
  reason?: string
}

type RealtimeProposalPayload = {
  proposalId?: string
  reason?: string
  actorId?: string
  agreementId?: string
}

type RealtimeAgreementPayload = {
  agreementId?: string
  reason?: string
  actorId?: string
  milestoneId?: string
  paymentId?: string
  disputeId?: string
  reviewId?: string
  proposalId?: string
}

type RealtimeHandlers = {
  onNotificationsRefresh?: (payload: RealtimeNotificationPayload) => void
  onMessagesRefresh?: (payload: RealtimeMessagePayload) => void
  onProposalsRefresh?: (payload: RealtimeProposalPayload) => void
  onAgreementsRefresh?: (payload: RealtimeAgreementPayload) => void
  onConnected?: () => void
  onError?: () => void
}

const parseEventData = <T>(event: MessageEvent<string>) => {
  if (!event.data) {
    return {} as T
  }

  try {
    return JSON.parse(event.data) as T
  } catch {
    return {} as T
  }
}

export const subscribeToRealtimeEvents = ({
  onNotificationsRefresh,
  onMessagesRefresh,
  onProposalsRefresh,
  onAgreementsRefresh,
  onConnected,
  onError,
}: RealtimeHandlers) => {
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
    return () => undefined
  }

  const token = localStorage.getItem('jobwahala_token')
  if (!token) {
    return () => undefined
  }

  const url = `${BASE_URL}/realtime/stream?token=${encodeURIComponent(token)}`
  const source = new window.EventSource(url)

  if (onConnected) {
    source.addEventListener('connected', () => {
      onConnected()
    })
  }

  if (onNotificationsRefresh) {
    source.addEventListener('notifications.refresh', (event) => {
      onNotificationsRefresh(parseEventData<RealtimeNotificationPayload>(event as MessageEvent<string>))
    })
  }

  if (onMessagesRefresh) {
    source.addEventListener('messages.refresh', (event) => {
      onMessagesRefresh(parseEventData<RealtimeMessagePayload>(event as MessageEvent<string>))
    })
  }

  if (onProposalsRefresh) {
    source.addEventListener('proposals.refresh', (event) => {
      onProposalsRefresh(parseEventData<RealtimeProposalPayload>(event as MessageEvent<string>))
    })
  }

  if (onAgreementsRefresh) {
    source.addEventListener('agreements.refresh', (event) => {
      onAgreementsRefresh(parseEventData<RealtimeAgreementPayload>(event as MessageEvent<string>))
    })
  }

  if (onError) {
    source.onerror = () => {
      onError()
    }
  }

  return () => {
    source.close()
  }
}
