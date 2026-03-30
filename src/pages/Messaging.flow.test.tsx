import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Messaging from './Messaging'

const useAuthMock = vi.fn()
const apiGetConversationSidebarMock = vi.fn()
const apiGetMessageDeltaMock = vi.fn()
const apiGetMessagesMock = vi.fn()
const apiMarkMessagesReadMock = vi.fn()
const apiSendMessageMock = vi.fn()
const uploadEvidenceFileMock = vi.fn()
const subscribeToRealtimeEventsMock = vi.fn()
let realtimeHandlers: Record<string, ((payload?: any) => void) | undefined> = {}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../lib/api', () => ({
  apiGetConversationSidebar: (...args: unknown[]) => apiGetConversationSidebarMock(...args),
  apiGetMessageDelta: (...args: unknown[]) => apiGetMessageDeltaMock(...args),
  apiGetMessages: (...args: unknown[]) => apiGetMessagesMock(...args),
  apiMarkMessagesRead: (...args: unknown[]) =>
    apiMarkMessagesReadMock(...args),
  apiSendMessage: (...args: unknown[]) => apiSendMessageMock(...args),
}))

vi.mock('../lib/realtime', () => ({
  subscribeToRealtimeEvents: (...args: unknown[]) => subscribeToRealtimeEventsMock(...args),
}))

vi.mock('../lib/evidenceUpload', () => ({
  uploadEvidenceFile: (...args: unknown[]) => uploadEvidenceFileMock(...args),
  evidenceUploadConstraints: {
    supportedContentTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
  },
}))

describe('Messaging flow from hiring links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realtimeHandlers = {}
    window.localStorage.clear()
    subscribeToRealtimeEventsMock.mockImplementation((handlers: typeof realtimeHandlers) => {
      realtimeHandlers = handlers
      return () => undefined
    })

    useAuthMock.mockReturnValue({
      user: {
        id: 'employer-1',
        email: 'employer@example.com',
      },
    })

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280,
    })

    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      writable: true,
      configurable: true,
      value: vi.fn(),
    })
  })

  it('starts a new conversation from a linked user and sends the first message', async () => {
    apiGetConversationSidebarMock
      .mockResolvedValueOnce({ conversations: [] })
      .mockResolvedValueOnce({
        conversations: [
          {
            id: 'conversation-1',
            participant: { id: 'seeker-1', email: 'seeker@example.com' },
            lastMessage: {
              id: 'message-1',
              content: 'Let us discuss next steps.',
              createdAt: '2026-03-21T00:00:00.000Z',
            },
            unreadCount: 0,
          },
        ],
      })
      .mockResolvedValue({
        conversations: [
          {
            id: 'conversation-1',
            participant: { id: 'seeker-1', email: 'seeker@example.com' },
            lastMessage: {
              id: 'message-1',
              content: 'Let us discuss next steps.',
              createdAt: '2026-03-21T00:00:00.000Z',
            },
            unreadCount: 0,
          },
        ],
      })

    apiSendMessageMock.mockResolvedValue({ success: true })
    apiGetMessagesMock.mockResolvedValue({
      messages: [
        {
          id: 'message-1',
          senderId: 'employer-1',
          content: 'Let us discuss next steps.',
          read: true,
          createdAt: '2026-03-21T00:00:00.000Z',
        },
      ],
    })
    apiMarkMessagesReadMock.mockResolvedValue({ success: true })
    uploadEvidenceFileMock.mockReset()

    render(
      <MemoryRouter
        initialEntries={['/messaging?userId=seeker-1&email=seeker@example.com']}
      >
        <Routes>
          <Route path="/messaging" element={<Messaging />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Start a new conversation')).toBeInTheDocument()

    const draftInput = screen.getByPlaceholderText('Message seeker...')
    fireEvent.change(draftInput, {
      target: { value: 'Let us discuss next steps.' },
    })
    fireEvent.keyDown(draftInput, {
      key: 'Enter',
      code: 'Enter',
      charCode: 13,
    })

    await waitFor(() => {
      expect(apiSendMessageMock).toHaveBeenCalledWith(
        'seeker-1',
        'Let us discuss next steps.',
        undefined,
      )
    })

    await waitFor(() => {
      expect(screen.getAllByText('Let us discuss next steps.').length).toBeGreaterThan(0)
    })
    expect(apiGetMessagesMock).toHaveBeenCalledWith('conversation-1')
  })

  it('keeps drafts per conversation and restores them after remount', async () => {
    apiGetConversationSidebarMock.mockResolvedValue({
      conversations: [
        {
          id: 'conversation-alpha',
          participant: { id: 'seeker-alpha', email: 'alpha@example.com' },
          lastMessage: {
            id: 'message-alpha-1',
            content: 'Alpha thread',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
          unreadCount: 0,
        },
        {
          id: 'conversation-beta',
          participant: { id: 'seeker-beta', email: 'beta@example.com' },
          lastMessage: {
            id: 'message-beta-1',
            content: 'Beta thread',
            createdAt: '2026-03-21T00:30:00.000Z',
          },
          unreadCount: 0,
        },
      ],
    })

    apiGetMessagesMock.mockImplementation(async (conversationId: string) => ({
      messages:
        conversationId === 'conversation-alpha'
          ? [
              {
                id: 'message-alpha-1',
                senderId: 'seeker-alpha',
                content: 'Alpha thread',
                read: true,
                createdAt: '2026-03-21T00:00:00.000Z',
              },
            ]
          : [
              {
                id: 'message-beta-1',
                senderId: 'seeker-beta',
                content: 'Beta thread',
                read: true,
                createdAt: '2026-03-21T00:30:00.000Z',
              },
            ],
    }))
    apiMarkMessagesReadMock.mockResolvedValue({ success: true })

    const route = '/messaging?userId=seeker-alpha&email=alpha@example.com'
    const firstRender = render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/messaging" element={<Messaging />} />
        </Routes>
      </MemoryRouter>,
    )

    const alphaInput = await screen.findByPlaceholderText('Message alpha...')
    fireEvent.change(alphaInput, {
      target: { value: 'Draft for Alpha' },
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('Draft for Alpha')).toBeInTheDocument()
      expect(screen.getAllByText('Draft: Draft for Alpha').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByText('beta'))

    const betaInput = await screen.findByPlaceholderText('Message beta...')
    expect(betaInput).toHaveValue('')

    fireEvent.change(betaInput, {
      target: { value: 'Draft for Beta' },
    })

    await waitFor(() => {
      expect(screen.getAllByText('Draft: Draft for Beta').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByText('alpha'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Message alpha...')).toHaveValue('Draft for Alpha')
    })

    firstRender.unmount()

    render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/messaging" element={<Messaging />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Message alpha...')).toHaveValue('Draft for Alpha')
    })
  })

  it('opens an existing direct conversation from a linked user query', async () => {
    apiGetConversationSidebarMock.mockResolvedValue({
      conversations: [
        {
          id: 'conversation-2',
          participant: { id: 'seeker-2', email: 'kwame@example.com' },
          lastMessage: {
            id: 'message-2',
            content: 'Can we schedule the interview?',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
          unreadCount: 1,
        },
      ],
    })

    apiGetMessagesMock.mockResolvedValue({
      messages: [
        {
          id: 'message-2',
          senderId: 'seeker-2',
          content: 'Can we schedule the interview?',
          read: false,
          createdAt: '2026-03-21T00:00:00.000Z',
        },
      ],
    })
    apiMarkMessagesReadMock.mockResolvedValue({ success: true })

    render(
      <MemoryRouter
        initialEntries={['/messaging?userId=seeker-2&email=kwame@example.com']}
      >
        <Routes>
          <Route path="/messaging" element={<Messaging />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Can we schedule the interview?').length).toBeGreaterThan(0)
    })
    expect(
      screen.getByPlaceholderText('Message kwame...'),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(apiGetMessagesMock).toHaveBeenCalledWith('conversation-2')
      expect(apiMarkMessagesReadMock).toHaveBeenCalledWith('conversation-2')
    })
  })

  it('renders an optimistic outgoing message and reconciles it with the server response', async () => {
    let resolveSend: ((value: unknown) => void) | undefined
    const pendingSend = new Promise((resolve) => {
      resolveSend = resolve
    })

    apiGetConversationSidebarMock.mockResolvedValue({
      conversations: [
        {
          id: 'conversation-optimistic-1',
          participant: { id: 'seeker-opt', email: 'optimistic@example.com' },
          lastMessage: {
            id: 'message-existing-1',
            content: 'Current thread note',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
          unreadCount: 0,
        },
      ],
    })

    apiGetMessagesMock.mockResolvedValueOnce({
      messages: [
        {
          id: 'message-existing-1',
          senderId: 'seeker-opt',
          content: 'Current thread note',
          read: true,
          createdAt: '2026-03-21T00:00:00.000Z',
        },
      ],
    })
    apiMarkMessagesReadMock.mockResolvedValue({ success: true })
    apiSendMessageMock.mockReturnValue(pendingSend)

    render(
      <MemoryRouter
        initialEntries={['/messaging?userId=seeker-opt&email=optimistic@example.com']}
      >
        <Routes>
          <Route path="/messaging" element={<Messaging />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Current thread note')).toBeInTheDocument()

    const draftInput = screen.getByPlaceholderText('Message optimistic...')
    fireEvent.change(draftInput, {
      target: { value: 'Shipping the update now.' },
    })
    fireEvent.keyDown(draftInput, {
      key: 'Enter',
      code: 'Enter',
      charCode: 13,
    })

    await waitFor(() => {
      expect(apiSendMessageMock).toHaveBeenCalledWith(
        'seeker-opt',
        'Shipping the update now.',
        undefined,
      )
      expect(screen.getAllByText('Shipping the update now.').length).toBe(2)
    })
    expect(document.querySelectorAll('svg.lucide-loader-circle').length).toBeGreaterThan(0)

    resolveSend?.({
      success: true,
      message: {
        id: 'message-server-1',
        conversationId: 'conversation-optimistic-1',
        senderId: 'employer-1',
        content: 'Shipping the update now.',
        read: false,
        createdAt: '2026-03-21T02:00:00.000Z',
      },
    })

    await waitFor(() => {
      expect(document.querySelectorAll('svg.lucide-loader-circle').length).toBe(0)
      expect(screen.getAllByText('Shipping the update now.').length).toBe(2)
    })
    expect(apiGetMessagesMock).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed outgoing message in the thread and retries it', async () => {
    apiGetConversationSidebarMock.mockResolvedValue({
      conversations: [
        {
          id: 'conversation-failed-1',
          participant: { id: 'seeker-failed', email: 'failed@example.com' },
          lastMessage: {
            id: 'message-failed-existing',
            content: 'Initial delivery note',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
          unreadCount: 0,
        },
      ],
    })

    apiGetMessagesMock.mockResolvedValueOnce({
      messages: [
        {
          id: 'message-failed-existing',
          senderId: 'seeker-failed',
          content: 'Initial delivery note',
          read: true,
          createdAt: '2026-03-21T00:00:00.000Z',
        },
      ],
    })
    apiMarkMessagesReadMock.mockResolvedValue({ success: true })
    apiSendMessageMock
      .mockRejectedValueOnce(new Error('Temporary outage'))
      .mockResolvedValueOnce({
        success: true,
        message: {
          id: 'message-failed-server-1',
          conversationId: 'conversation-failed-1',
          senderId: 'employer-1',
          content: 'Retry the brief please.',
          read: false,
          createdAt: '2026-03-21T02:00:00.000Z',
        },
      })

    render(
      <MemoryRouter
        initialEntries={['/messaging?userId=seeker-failed&email=failed@example.com']}
      >
        <Routes>
          <Route path="/messaging" element={<Messaging />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Initial delivery note')).toBeInTheDocument()

    const draftInput = screen.getByPlaceholderText('Message failed...')
    fireEvent.change(draftInput, {
      target: { value: 'Retry the brief please.' },
    })
    fireEvent.keyDown(draftInput, {
      key: 'Enter',
      code: 'Enter',
      charCode: 13,
    })

    await waitFor(() => {
      expect(apiSendMessageMock).toHaveBeenNthCalledWith(
        1,
        'seeker-failed',
        'Retry the brief please.',
        undefined,
      )
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      expect(screen.getByText('Temporary outage')).toBeInTheDocument()
      expect(screen.getAllByText('Retry the brief please.').length).toBe(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(apiSendMessageMock).toHaveBeenNthCalledWith(
        2,
        'seeker-failed',
        'Retry the brief please.',
        undefined,
      )
    })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
      expect(screen.queryByText('Temporary outage')).not.toBeInTheDocument()
      expect(screen.getAllByText('Retry the brief please.').length).toBe(2)
    })
    expect(apiGetMessagesMock).toHaveBeenCalledTimes(1)
  })

  it('reloads the active thread when a realtime message refresh event arrives', async () => {
    apiGetConversationSidebarMock
      .mockResolvedValueOnce({
        conversations: [
          {
            id: 'conversation-live-1',
            participant: { id: 'seeker-5', email: 'live@example.com' },
            lastMessage: {
              id: 'message-live-1',
              content: 'Initial hello',
              createdAt: '2026-03-21T00:00:00.000Z',
            },
            unreadCount: 0,
          },
        ],
      })
      .mockResolvedValueOnce({
        conversations: [
          {
            id: 'conversation-live-1',
            participant: { id: 'seeker-5', email: 'live@example.com' },
            lastMessage: {
              id: 'message-live-2',
              content: 'Realtime update',
              createdAt: '2026-03-21T01:00:00.000Z',
            },
            unreadCount: 1,
          },
        ],
      })
      .mockResolvedValue({
        conversations: [
          {
            id: 'conversation-live-1',
            participant: { id: 'seeker-5', email: 'live@example.com' },
            lastMessage: {
              id: 'message-live-2',
              content: 'Realtime update',
              createdAt: '2026-03-21T01:00:00.000Z',
            },
            unreadCount: 0,
          },
        ],
      })

    apiGetMessagesMock
      .mockResolvedValueOnce({
        messages: [
          {
            id: 'message-live-1',
            senderId: 'seeker-5',
            content: 'Initial hello',
            read: true,
            createdAt: '2026-03-21T00:00:00.000Z',
          },
        ],
      })
    apiGetMessageDeltaMock.mockResolvedValue({
      messages: [
        {
          id: 'message-live-2',
          senderId: 'seeker-5',
          content: 'Realtime update',
          read: false,
          createdAt: '2026-03-21T01:00:00.000Z',
        },
      ],
    })
    apiMarkMessagesReadMock.mockResolvedValue({ success: true })

    render(
      <MemoryRouter initialEntries={['/messaging?userId=seeker-5&email=live@example.com']}>
        <Routes>
          <Route path="/messaging" element={<Messaging />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Initial hello')).toBeInTheDocument()

    realtimeHandlers.onMessagesRefresh?.({
      conversationId: 'conversation-live-1',
      reason: 'created',
      senderId: 'seeker-5',
      messageId: 'message-live-2',
      createdAt: '2026-03-21T01:00:00.000Z',
    })

    await waitFor(() => {
      expect(screen.getAllByText('Realtime update').length).toBeGreaterThan(0)
    })
  })

  it('marks outgoing messages as read locally when the other participant reads the active thread', async () => {
    apiGetConversationSidebarMock.mockResolvedValue({
      conversations: [
        {
          id: 'conversation-read-1',
          participant: { id: 'seeker-read-1', email: 'reader@example.com' },
          lastMessage: {
            id: 'message-read-2',
            content: 'Thanks, reviewing now.',
            createdAt: '2026-03-21T01:00:00.000Z',
          },
          unreadCount: 0,
        },
      ],
    })

    apiGetMessagesMock.mockResolvedValueOnce({
      messages: [
        {
          id: 'message-read-1',
          senderId: 'employer-1',
          content: 'Please review the brief.',
          read: false,
          createdAt: '2026-03-21T00:00:00.000Z',
        },
        {
          id: 'message-read-2',
          senderId: 'seeker-read-1',
          content: 'Thanks, reviewing now.',
          read: false,
          createdAt: '2026-03-21T01:00:00.000Z',
        },
      ],
    })
    apiMarkMessagesReadMock.mockResolvedValue({ success: true })

    render(
      <MemoryRouter initialEntries={['/messaging?userId=seeker-read-1&email=reader@example.com']}>
        <Routes>
          <Route path="/messaging" element={<Messaging />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Please review the brief.')).toBeInTheDocument()

    realtimeHandlers.onMessagesRefresh?.({
      conversationId: 'conversation-read-1',
      reason: 'read',
      actorId: 'seeker-read-1',
    })

    await waitFor(() => {
      expect(document.querySelectorAll('svg.lucide-check-check').length).toBeGreaterThan(0)
    })
    expect(apiGetMessageDeltaMock).not.toHaveBeenCalled()
    expect(apiGetMessagesMock).toHaveBeenCalledTimes(1)
  })

  it('uploads and sends an attachment-only message', async () => {
    apiGetConversationSidebarMock
      .mockResolvedValueOnce({ conversations: [] })
      .mockResolvedValueOnce({
        conversations: [
          {
            id: 'conversation-attachment-1',
            participant: { id: 'seeker-attachment', email: 'briefs@example.com' },
            lastMessage: {
              id: 'message-attachment-1',
              content: null,
              attachmentName: 'launch-brief.pdf',
              attachmentUrl: 'https://files.example.com/launch-brief.pdf',
              attachmentContentType: 'application/pdf',
              attachmentSizeBytes: 102400,
              createdAt: '2026-03-21T02:00:00.000Z',
            },
            unreadCount: 0,
          },
        ],
      })
      .mockResolvedValue({
        conversations: [
          {
            id: 'conversation-attachment-1',
            participant: { id: 'seeker-attachment', email: 'briefs@example.com' },
            lastMessage: {
              id: 'message-attachment-1',
              content: null,
              attachmentName: 'launch-brief.pdf',
              attachmentUrl: 'https://files.example.com/launch-brief.pdf',
              attachmentContentType: 'application/pdf',
              attachmentSizeBytes: 102400,
              createdAt: '2026-03-21T02:00:00.000Z',
            },
            unreadCount: 0,
          },
        ],
      })

    apiGetMessagesMock.mockResolvedValue({
      messages: [
        {
          id: 'message-attachment-1',
          senderId: 'employer-1',
          content: null,
          attachmentName: 'launch-brief.pdf',
          attachmentUrl: 'https://files.example.com/launch-brief.pdf',
          attachmentContentType: 'application/pdf',
          attachmentSizeBytes: 102400,
          read: true,
          createdAt: '2026-03-21T02:00:00.000Z',
        },
      ],
    })
    apiMarkMessagesReadMock.mockResolvedValue({ success: true })
    apiSendMessageMock.mockResolvedValue({ success: true })
    uploadEvidenceFileMock.mockResolvedValue({
      file: {
        url: 'https://files.example.com/launch-brief.pdf',
        originalFileName: 'launch-brief.pdf',
        contentType: 'application/pdf',
        sizeBytes: 102400,
      },
    })

    render(
      <MemoryRouter initialEntries={['/messaging?userId=seeker-attachment&email=briefs@example.com']}>
        <Routes>
          <Route path="/messaging" element={<Messaging />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Start a new conversation')).toBeInTheDocument()

    const file = new File(['launch brief'], 'launch-brief.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Message attachment'), {
      target: { files: [file] },
    })

    expect(await screen.findByText('Attachment Ready')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(apiSendMessageMock).toHaveBeenCalledWith('seeker-attachment', '', {
        url: 'https://files.example.com/launch-brief.pdf',
        name: 'launch-brief.pdf',
        contentType: 'application/pdf',
        sizeBytes: 102400,
      })
    })
  })
})
