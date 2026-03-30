import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Navbar from './Navbar'

const useAuthMock = vi.fn()
const apiGetWorkspaceSignalsMock = vi.fn()
const subscribeToRealtimeEventsMock = vi.fn()
let realtimeHandlers: Record<string, ((payload?: unknown) => void) | undefined> = {}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../lib/api', () => ({
  apiGetWorkspaceSignals: (...args: unknown[]) => apiGetWorkspaceSignalsMock(...args),
}))

vi.mock('../lib/realtime', () => ({
  subscribeToRealtimeEvents: (...args: unknown[]) => subscribeToRealtimeEventsMock(...args),
}))

vi.mock('./NotificationCenter', () => ({
  default: () => <div data-testid="notification-center" />,
}))

describe('Navbar live workspace badges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realtimeHandlers = {}
    subscribeToRealtimeEventsMock.mockImplementation((handlers: typeof realtimeHandlers) => {
      realtimeHandlers = handlers
      return () => undefined
    })

    useAuthMock.mockReturnValue({
      user: {
        id: 'seeker-1',
        email: 'ada@example.com',
      },
      role: 'SEEKER',
      isOnboarded: true,
      userName: 'Ada Mensah',
      userEmail: 'ada@example.com',
      logout: vi.fn(),
    })
  })

  it('shows live nav badges and refreshes them after realtime workflow events', async () => {
    apiGetWorkspaceSignalsMock
      .mockResolvedValueOnce({
        unreadMessages: 2,
        pendingProposalActions: 3,
        pendingAgreementActions: 4,
      })
      .mockResolvedValueOnce({
        unreadMessages: 1,
        pendingProposalActions: 1,
        pendingAgreementActions: 1,
      })

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByTestId('nav-badge-proposals')[0]).toHaveTextContent('3')
    })

    expect(screen.getAllByTestId('nav-badge-messaging')[0]).toHaveTextContent('2')
    expect(screen.getAllByTestId('nav-badge-agreements')[0]).toHaveTextContent('4')

    realtimeHandlers.onAgreementsRefresh?.({ agreementId: 'agreement-1' })

    await waitFor(() => {
      expect(screen.getAllByTestId('nav-badge-proposals')[0]).toHaveTextContent('1')
    })

    expect(screen.getAllByTestId('nav-badge-messaging')[0]).toHaveTextContent('1')
    expect(screen.getAllByTestId('nav-badge-agreements')[0]).toHaveTextContent('1')
  })
})
