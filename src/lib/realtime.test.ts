import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchRealtimeEvent, subscribeToRealtimeEvents } from './realtime'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  closed = false
  onerror: (() => void) | null = null
  listeners: Record<string, Array<(event: MessageEvent) => void>> = {}

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(name: string, handler: (event: MessageEvent) => void) {
    ;(this.listeners[name] ||= []).push(handler)
  }

  emit(name: string, data: unknown) {
    this.listeners[name]?.forEach((handler) => handler({ data: JSON.stringify(data) } as MessageEvent))
  }

  close() {
    this.closed = true
  }
}

describe('subscribeToRealtimeEvents', () => {
  const cleanups: Array<() => void> = []

  const subscribe = (handlers: Parameters<typeof subscribeToRealtimeEvents>[0]) => {
    const stop = subscribeToRealtimeEvents(handlers)
    cleanups.push(stop)
    return stop
  }

  beforeEach(() => {
    FakeEventSource.instances = []
    localStorage.setItem('jobwahala_token', 'token-a')
    vi.stubGlobal('EventSource', FakeEventSource)
    Object.defineProperty(window, 'EventSource', { value: FakeEventSource, configurable: true, writable: true })
  })

  afterEach(() => {
    cleanups.splice(0).forEach((stop) => stop())
    vi.unstubAllGlobals()
  })

  it('opens one connection no matter how many components subscribe', () => {
    subscribe({ onMessagesRefresh: vi.fn() })
    subscribe({ onNotificationsRefresh: vi.fn() })
    subscribe({ onProposalsRefresh: vi.fn() })

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0].url).toContain('/realtime/stream?token=token-a')
  })

  it('delivers each event once to each interested handler', () => {
    const messages = vi.fn()
    const otherMessages = vi.fn()
    const notifications = vi.fn()
    subscribe({ onMessagesRefresh: messages })
    subscribe({ onMessagesRefresh: otherMessages, onNotificationsRefresh: notifications })

    FakeEventSource.instances[0].emit('messages.refresh', { conversationId: 'c1' })

    expect(messages).toHaveBeenCalledTimes(1)
    expect(messages).toHaveBeenCalledWith({ conversationId: 'c1' })
    expect(otherMessages).toHaveBeenCalledTimes(1)
    expect(notifications).not.toHaveBeenCalled()
  })

  it('delivers typing events to typing handlers only, and stops after unsubscribing', () => {
    const typing = vi.fn()
    const messages = vi.fn()
    const stop = subscribe({ onTyping: typing })
    subscribe({ onMessagesRefresh: messages })

    FakeEventSource.instances[0].emit('messages.typing', { conversationId: 'c1', userId: 'u1' })

    expect(typing).toHaveBeenCalledWith({ conversationId: 'c1', userId: 'u1' })
    expect(messages).not.toHaveBeenCalled()

    stop()
    FakeEventSource.instances[0].emit('messages.typing', { conversationId: 'c1', userId: 'u1' })
    expect(typing).toHaveBeenCalledTimes(1)
  })

  it('keeps the connection until the last subscriber leaves, then closes it', () => {
    const stopA = subscribe({ onMessagesRefresh: vi.fn() })
    const stopB = subscribe({ onProposalsRefresh: vi.fn() })

    stopA()
    expect(FakeEventSource.instances[0].closed).toBe(false)

    stopB()
    expect(FakeEventSource.instances[0].closed).toBe(true)
  })

  it('stops delivering to a handler once it has unsubscribed', () => {
    const staying = vi.fn()
    const leaving = vi.fn()
    subscribe({ onAgreementsRefresh: staying })
    const stop = subscribe({ onAgreementsRefresh: leaving })

    stop()
    FakeEventSource.instances[0].emit('agreements.refresh', { agreementId: 'a1' })

    expect(staying).toHaveBeenCalledTimes(1)
    expect(leaving).not.toHaveBeenCalled()
  })

  it('opens a fresh connection after everyone left and someone subscribes again', () => {
    subscribe({ onMessagesRefresh: vi.fn() })()
    subscribe({ onMessagesRefresh: vi.fn() })

    expect(FakeEventSource.instances).toHaveLength(2)
    expect(FakeEventSource.instances[0].closed).toBe(true)
    expect(FakeEventSource.instances[1].closed).toBe(false)
  })

  it('never keeps a stream open for the previous account after the token changes', () => {
    subscribe({ onMessagesRefresh: vi.fn() })
    localStorage.setItem('jobwahala_token', 'token-b')

    subscribe({ onProposalsRefresh: vi.fn() })

    expect(FakeEventSource.instances).toHaveLength(2)
    expect(FakeEventSource.instances[0].closed).toBe(true)
    expect(FakeEventSource.instances[1].url).toContain('token=token-b')
  })

  it('opens nothing for signed-out visitors', () => {
    localStorage.removeItem('jobwahala_token')

    subscribe({ onMessagesRefresh: vi.fn() })

    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('tells every subscriber when the connection errors', () => {
    const first = vi.fn()
    const second = vi.fn()
    subscribe({ onError: first })
    subscribe({ onError: second })

    FakeEventSource.instances[0].onerror?.()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('still lets the socket layer feed the same handlers', () => {
    const connected = vi.fn()
    subscribe({ onConnected: connected })

    dispatchRealtimeEvent('connected', {})

    expect(connected).toHaveBeenCalledTimes(1)
  })
})
