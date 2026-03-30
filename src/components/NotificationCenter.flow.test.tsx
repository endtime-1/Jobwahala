import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationCenter from './NotificationCenter'

const useAuthMock = vi.fn()
const apiGetNotificationSummaryMock = vi.fn()
const apiGetMyNotificationsMock = vi.fn()
const apiMarkAllNotificationsReadMock = vi.fn()
const apiMarkNotificationReadMock = vi.fn()
const subscribeToRealtimeEventsMock = vi.fn()
let realtimeHandlers: Record<string, ((payload?: unknown) => void) | undefined> = {}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../lib/api', () => ({
  apiGetNotificationSummary: (...args: unknown[]) => apiGetNotificationSummaryMock(...args),
  apiGetMyNotifications: (...args: unknown[]) => apiGetMyNotificationsMock(...args),
  apiMarkAllNotificationsRead: (...args: unknown[]) => apiMarkAllNotificationsReadMock(...args),
  apiMarkNotificationRead: (...args: unknown[]) => apiMarkNotificationReadMock(...args),
}))

vi.mock('../lib/realtime', () => ({
  subscribeToRealtimeEvents: (...args: unknown[]) => subscribeToRealtimeEventsMock(...args),
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-probe">{location.pathname}</div>
}

describe('NotificationCenter flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realtimeHandlers = {}
    subscribeToRealtimeEventsMock.mockImplementation((handlers: typeof realtimeHandlers) => {
      realtimeHandlers = handlers
      return () => undefined
    })

    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'ada@example.com',
        role: 'SEEKER',
      },
    })
  })

  it('loads notifications, marks one as read, and follows its action link', async () => {
    apiGetNotificationSummaryMock.mockResolvedValue({
      unreadCount: 2,
    })
    apiGetMyNotificationsMock.mockResolvedValue({
      unreadCount: 2,
      notifications: [
        {
          id: 'notification-1',
          type: 'PROPOSAL_CREATED',
          title: 'New proposal received',
          message: 'JobWahala Labs sent you a proposal for Frontend Engineer.',
          actionUrl: '/proposals',
          read: false,
          createdAt: '2026-03-22T00:00:00.000Z',
        },
        {
          id: 'notification-2',
          type: 'MILESTONE_CREATED',
          title: 'New milestone added',
          message: 'A new milestone was added to Landing Page Design.',
          actionUrl: '/agreements',
          read: false,
          createdAt: '2026-03-21T00:00:00.000Z',
        },
      ],
    })

    apiMarkNotificationReadMock.mockResolvedValue({
      unreadCount: 1,
      notification: {
        id: 'notification-1',
        read: true,
      },
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <NotificationCenter />
        <LocationProbe />
      </MemoryRouter>,
    )

    expect(await screen.findByText('2')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/open notifications/i))

    expect(await screen.findByText('New proposal received')).toBeInTheDocument()

    fireEvent.click(screen.getByText('New proposal received'))

    expect(apiMarkNotificationReadMock).toHaveBeenCalledWith('notification-1')
    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/proposals')
    })
  })

  it('marks all notifications as read from the notification center', async () => {
    apiGetNotificationSummaryMock.mockResolvedValue({
      unreadCount: 1,
    })
    apiGetMyNotificationsMock.mockResolvedValue({
      unreadCount: 1,
      notifications: [
        {
          id: 'notification-3',
          type: 'MILESTONE_PAYMENT_REQUESTED',
          title: 'Payment requested',
          message: 'Payment was requested for milestone Wireframes.',
          actionUrl: '/agreements',
          read: false,
          createdAt: '2026-03-22T00:00:00.000Z',
        },
      ],
    })

    apiMarkAllNotificationsReadMock.mockResolvedValue({
      unreadCount: 0,
    })

    render(
      <MemoryRouter>
        <NotificationCenter />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByLabelText(/open notifications/i))
    expect(await screen.findByText('Payment requested')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /read all/i }))

    expect(apiMarkAllNotificationsReadMock).toHaveBeenCalled()
    expect(await screen.findByText('0 unread notifications')).toBeInTheDocument()
  })

  it('reloads only the unread summary when a realtime refresh arrives while the panel is closed', async () => {
    apiGetNotificationSummaryMock
      .mockResolvedValueOnce({
        unreadCount: 0,
      })
      .mockResolvedValueOnce({
        unreadCount: 1,
      })

    render(
      <MemoryRouter>
        <NotificationCenter />
      </MemoryRouter>,
    )

    expect(await screen.findByLabelText(/open notifications/i)).toBeInTheDocument()

    realtimeHandlers.onNotificationsRefresh?.()

    await waitFor(() => {
      expect(apiGetNotificationSummaryMock).toHaveBeenCalledTimes(2)
    })
    expect(apiGetMyNotificationsMock).not.toHaveBeenCalled()
  })

  it('reloads the full notification list when a realtime refresh arrives while the panel is open', async () => {
    apiGetNotificationSummaryMock.mockResolvedValue({
      unreadCount: 1,
    })
    apiGetMyNotificationsMock
      .mockResolvedValueOnce({
        unreadCount: 1,
        notifications: [
          {
            id: 'notification-live-1',
            type: 'AGREEMENT_UPDATED',
            title: 'Agreement updated',
            message: 'A live agreement update just arrived.',
            actionUrl: '/agreements',
            read: false,
            createdAt: '2026-03-22T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        unreadCount: 1,
        notifications: [
          {
            id: 'notification-live-2',
            type: 'AGREEMENT_UPDATED',
            title: 'Agreement status changed',
            message: 'A second agreement update just arrived.',
            actionUrl: '/agreements',
            read: false,
            createdAt: '2026-03-23T00:00:00.000Z',
          },
        ],
      })

    render(
      <MemoryRouter>
        <NotificationCenter />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByLabelText(/open notifications/i))
    expect(await screen.findByText('Agreement updated')).toBeInTheDocument()

    realtimeHandlers.onNotificationsRefresh?.()

    await waitFor(() => {
      expect(apiGetMyNotificationsMock).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Agreement status changed')).toBeInTheDocument()
  })
})
