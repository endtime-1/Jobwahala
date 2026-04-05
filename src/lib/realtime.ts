const rawApiUrl = import.meta.env.VITE_API_URL?.trim()
const BASE_URL = rawApiUrl ? rawApiUrl.replace(/\/$/, '') : '/api'

export type RealtimeMessagePayload = {
  conversationId?: string
  reason?: string
  senderId?: string
  actorId?: string
  messageId?: string
  createdAt?: string
}

export type RealtimeNotificationPayload = {
  notificationId?: string
  reason?: string
}

export type RealtimeProposalPayload = {
  proposalId?: string
  reason?: string
  actorId?: string
  agreementId?: string
}

export type RealtimeAgreementPayload = {
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

const parseEventData = <T>(data: any) => {
  if (!data) return {} as T
  if (typeof data === 'string') {
    try { return JSON.parse(data) as T } catch { return {} as T }
  }
  return data as T
}

// Centralized Event Dispatcher
const listeners = {
  notifications: new Set<(p: RealtimeNotificationPayload) => void>(),
  messages: new Set<(p: RealtimeMessagePayload) => void>(),
  proposals: new Set<(p: RealtimeProposalPayload) => void>(),
  agreements: new Set<(p: RealtimeAgreementPayload) => void>(),
  connected: new Set<() => void>(),
}

export const dispatchRealtimeEvent = (event: string, data: any) => {
  if (event === 'notifications.refresh') listeners.notifications.forEach(l => l(parseEventData(data)))
  if (event === 'messages.refresh') listeners.messages.forEach(l => l(parseEventData(data)))
  if (event === 'proposals.refresh') listeners.proposals.forEach(l => l(parseEventData(data)))
  if (event === 'agreements.refresh') listeners.agreements.forEach(l => l(parseEventData(data)))
  if (event === 'connected') listeners.connected.forEach(l => l())
}

export const subscribeToRealtimeEvents = (handlers: RealtimeHandlers) => {
  if (handlers.onNotificationsRefresh) listeners.notifications.add(handlers.onNotificationsRefresh)
  if (handlers.onMessagesRefresh) listeners.messages.add(handlers.onMessagesRefresh)
  if (handlers.onProposalsRefresh) listeners.proposals.add(handlers.onProposalsRefresh)
  if (handlers.onAgreementsRefresh) listeners.agreements.add(handlers.onAgreementsRefresh)
  if (handlers.onConnected) listeners.connected.add(handlers.onConnected)

  // Side-effect: Still initialize SSE for fallback if needed, but Socket.io will also dispatch
  let source: EventSource | null = null
  if (typeof window !== 'undefined' && window.EventSource) {
     const token = localStorage.getItem('jobwahala_token')
     if (token) {
        source = new window.EventSource(`${BASE_URL}/realtime/stream?token=${encodeURIComponent(token)}`)
        source.addEventListener('connected', () => dispatchRealtimeEvent('connected', {}))
        source.addEventListener('notifications.refresh', (e) => dispatchRealtimeEvent('notifications.refresh', (e as MessageEvent).data))
        source.addEventListener('messages.refresh', (e) => dispatchRealtimeEvent('messages.refresh', (e as MessageEvent).data))
        source.addEventListener('proposals.refresh', (e) => dispatchRealtimeEvent('proposals.refresh', (e as MessageEvent).data))
        source.addEventListener('agreements.refresh', (e) => dispatchRealtimeEvent('agreements.refresh', (e as MessageEvent).data))
        if (handlers.onError) source.onerror = () => handlers.onError!()
     }
  }

  return () => {
    if (handlers.onNotificationsRefresh) listeners.notifications.delete(handlers.onNotificationsRefresh)
    if (handlers.onMessagesRefresh) listeners.messages.delete(handlers.onMessagesRefresh)
    if (handlers.onProposalsRefresh) listeners.proposals.delete(handlers.onProposalsRefresh)
    if (handlers.onAgreementsRefresh) listeners.agreements.delete(handlers.onAgreementsRefresh)
    if (handlers.onConnected) listeners.connected.delete(handlers.onConnected)
    if (source) source.close()
  }
}
