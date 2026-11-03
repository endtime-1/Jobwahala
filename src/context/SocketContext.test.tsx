import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SocketProvider } from './SocketContext'

const useAuthMock = vi.fn()
const dispatchRealtimeEventMock = vi.fn()

type Handler = (data?: unknown) => void

const handlers: Record<string, Handler> = {}
const fakeSocket = {
  on: vi.fn((event: string, handler: Handler) => {
    handlers[event] = handler
  }),
  disconnect: vi.fn(),
}
const ioMock = vi.fn(() => fakeSocket)

vi.mock('socket.io-client', () => ({ io: (...args: unknown[]) => ioMock(...(args as [])) }))

vi.mock('./AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../lib/realtime', () => ({
  dispatchRealtimeEvent: (...args: unknown[]) => dispatchRealtimeEventMock(...args),
}))

describe('SocketProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(handlers).forEach((key) => delete handlers[key])
    localStorage.setItem('jobwahala_token', 'test-token')
  })

  it('does not open a connection for logged-out visitors', async () => {
    useAuthMock.mockReturnValue({ user: null })

    render(
      <SocketProvider>
        <div>child</div>
      </SocketProvider>,
    )

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(ioMock).not.toHaveBeenCalled()
  })

  it('connects with the saved token once someone is signed in', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } })

    render(
      <SocketProvider>
        <div>child</div>
      </SocketProvider>,
    )

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1))
    expect(ioMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ auth: { token: 'test-token' } }))
  })

  it('forwards realtime refresh events to the app', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } })

    render(
      <SocketProvider>
        <div>child</div>
      </SocketProvider>,
    )
    await waitFor(() => expect(handlers['messages.refresh']).toBeDefined())

    handlers['messages.refresh']({ conversationId: 'c1' })
    handlers['connect']()

    expect(dispatchRealtimeEventMock).toHaveBeenCalledWith('messages.refresh', { conversationId: 'c1' })
    expect(dispatchRealtimeEventMock).toHaveBeenCalledWith('connected', {})
  })

  it('disconnects when the provider goes away', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } })

    const { unmount } = render(
      <SocketProvider>
        <div>child</div>
      </SocketProvider>,
    )
    await waitFor(() => expect(ioMock).toHaveBeenCalled())

    unmount()

    expect(fakeSocket.disconnect).toHaveBeenCalled()
  })
})
