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

export type RealtimeTypingPayload = {
  conversationId?: string
  userId?: string
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
  onTyping?: (payload: RealtimeTypingPayload) => void
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
  typing: new Set<(p: RealtimeTypingPayload) => void>(),
  proposals: new Set<(p: RealtimeProposalPayload) => void>(),
  agreements: new Set<(p: RealtimeAgreementPayload) => void>(),
  connected: new Set<() => void>(),
}

export const dispatchRealtimeEvent = (event: string, data: any) => {
  if (event === 'notifications.refresh') listeners.notifications.forEach(l => l(parseEventData(data)))
  if (event === 'messages.refresh') listeners.messages.forEach(l => l(parseEventData(data)))
  if (event === 'messages.typing') listeners.typing.forEach(l => l(parseEventData(data)))
  if (event === 'proposals.refresh') listeners.proposals.forEach(l => l(parseEventData(data)))
  if (event === 'agreements.refresh') listeners.agreements.forEach(l => l(parseEventData(data)))
  if (event === 'connected') listeners.connected.forEach(l => l())
}

// One live-updates connection per browser tab, shared by every component that subscribes.
// Before this, each subscriber opened its own stream: a signed-in page held 3-4 permanent
// connections, used up the browser's per-site limit on plain HTTP/1.1, multiplied server load
// and fired every handler once per connection for each event.
let sharedSource: EventSource | null = null
let sharedToken: string | null = null
let subscriberCount = 0
const errorHandlers = new Set<() => void>()

const closeSharedSource = () => {
  if (sharedSource) sharedSource.close()
  sharedSource = null
  sharedToken = null
}

const openSharedSource = (token: string) => {
  const source = new window.EventSource(`${BASE_URL}/realtime/stream?token=${encodeURIComponent(token)}`)
  source.addEventListener('connected', () => dispatchRealtimeEvent('connected', {}))
  source.addEventListener('notifications.refresh', (e) => dispatchRealtimeEvent('notifications.refresh', (e as MessageEvent).data))
  source.addEventListener('messages.refresh', (e) => dispatchRealtimeEvent('messages.refresh', (e as MessageEvent).data))
  source.addEventListener('messages.typing', (e) => dispatchRealtimeEvent('messages.typing', (e as MessageEvent).data))
  source.addEventListener('proposals.refresh', (e) => dispatchRealtimeEvent('proposals.refresh', (e as MessageEvent).data))
  source.addEventListener('agreements.refresh', (e) => dispatchRealtimeEvent('agreements.refresh', (e as MessageEvent).data))
  source.onerror = () => errorHandlers.forEach((handler) => handler())
  sharedSource = source
  sharedToken = token
}

const ensureSharedSource = () => {
  if (typeof window === 'undefined' || !window.EventSource) return

  const token = localStorage.getItem('jobwahala_token')

  // Signed out, or signed in as someone else: never keep a stream open on the old identity.
  if (sharedSource && sharedToken !== token) closeSharedSource()
  if (!sharedSource && token) openSharedSource(token)
}

export const subscribeToRealtimeEvents = (handlers: RealtimeHandlers) => {
  if (handlers.onNotificationsRefresh) listeners.notifications.add(handlers.onNotificationsRefresh)
  if (handlers.onMessagesRefresh) listeners.messages.add(handlers.onMessagesRefresh)
  if (handlers.onTyping) listeners.typing.add(handlers.onTyping)
  if (handlers.onProposalsRefresh) listeners.proposals.add(handlers.onProposalsRefresh)
  if (handlers.onAgreementsRefresh) listeners.agreements.add(handlers.onAgreementsRefresh)
  if (handlers.onConnected) listeners.connected.add(handlers.onConnected)
  if (handlers.onError) errorHandlers.add(handlers.onError)

  subscriberCount += 1
  ensureSharedSource()

  return () => {
    if (handlers.onNotificationsRefresh) listeners.notifications.delete(handlers.onNotificationsRefresh)
    if (handlers.onMessagesRefresh) listeners.messages.delete(handlers.onMessagesRefresh)
    if (handlers.onTyping) listeners.typing.delete(handlers.onTyping)
    if (handlers.onProposalsRefresh) listeners.proposals.delete(handlers.onProposalsRefresh)
    if (handlers.onAgreementsRefresh) listeners.agreements.delete(handlers.onAgreementsRefresh)
    if (handlers.onConnected) listeners.connected.delete(handlers.onConnected)
    if (handlers.onError) errorHandlers.delete(handlers.onError)

    subscriberCount = Math.max(0, subscriberCount - 1)
    if (subscriberCount === 0) closeSharedSource()
  }
}
