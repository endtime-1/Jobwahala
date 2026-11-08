import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Messaging from './Messaging'

const api = vi.hoisted(() => ({ sidebar: vi.fn(), messages: vi.fn(), read: vi.fn(), delta: vi.fn(), send: vi.fn() }))

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', email: 'hr@acme.example' } }) }))
vi.mock('../lib/api', () => ({
  apiGetConversationSidebar: (...a: unknown[]) => api.sidebar(...a),
  apiGetMessages: (...a: unknown[]) => api.messages(...a),
  apiMarkMessagesRead: (...a: unknown[]) => api.read(...a),
  apiGetMessageDelta: (...a: unknown[]) => api.delta(...a),
  apiSendMessage: (...a: unknown[]) => api.send(...a),
}))
vi.mock('../lib/realtime', () => ({ subscribeToRealtimeEvents: () => () => undefined }))
vi.mock('../lib/evidenceUpload', () => ({ uploadEvidenceFile: vi.fn(), evidenceUploadConstraints: { supportedContentTypes: ['application/pdf'] } }))

const NOW = Date.now()
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()

const conversation = (id: string, participant: Record<string, unknown>, text: string, minutes: number, unread = 0) => ({
  id,
  participant,
  lastMessage: { id: `m-${id}`, content: text, createdAt: ago(minutes) },
  unreadCount: unread,
})
const message = (id: string, from: 'me' | 'them', content: string, minutes: number) => ({ id, senderId: from === 'me' ? 'me' : 'u1', content, read: true, createdAt: ago(minutes), conversationId: 'c1' })

const LIST = [
  conversation('c1', { id: 'u1', email: 'hr@akoko.example', name: 'Akoko Solutions LTD', role: 'EMPLOYER' }, 'Can you start on Monday?', 5, 2),
  conversation('c2', { id: 'u2', email: 'ama@example.com', name: 'Ama Mensah', role: 'SEEKER' }, 'Thank you for the update.', 130),
  conversation('c3', { id: 'u3', email: 'yaw.owusu@example.com', name: null, role: 'SEEKER' }, 'Hello there', 9000),
]

const open = () =>
  render(
    <MemoryRouter initialEntries={['/messaging']}>
      <Routes>
        <Route path="/messaging" element={<Messaging />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 })
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { writable: true, configurable: true, value: vi.fn() })
  api.sidebar.mockResolvedValue({ conversations: LIST })
  api.messages.mockResolvedValue({ messages: [] })
  api.read.mockResolvedValue({ success: true })
  api.delta.mockResolvedValue({ messages: [] })
})

describe('the conversation list', () => {
  it('shows people by the name they go by (a company or a person), falling back to the email handle', async () => {
    open()

    const list = await screen.findByRole('complementary', { name: 'Conversations' })
    expect(within(list).getByText('Akoko Solutions LTD')).toBeInTheDocument()
    expect(within(list).getByText('Ama Mensah')).toBeInTheDocument()
    expect(within(list).getByText('yaw.owusu')).toBeInTheDocument()
  })

  it('shows the unread count on each conversation and the total at the top', async () => {
    open()

    const list = await screen.findByRole('complementary', { name: 'Conversations' })
    expect(within(list).getAllByLabelText('2 unread').length).toBeGreaterThan(0)
  })

  it('the Unread filter shows only conversations with unread messages, and says so when there are none', async () => {
    open()
    const list = await screen.findByRole('complementary', { name: 'Conversations' })

    fireEvent.click(within(list).getByRole('button', { name: 'Unread' }))

    expect(within(list).getByText('Akoko Solutions LTD')).toBeInTheDocument()
    expect(within(list).queryByText('Ama Mensah')).not.toBeInTheDocument()

    api.sidebar.mockResolvedValue({ conversations: LIST.map((item) => ({ ...item, unreadCount: 0 })) })
  })

  it('searching matches a name as well as an email', async () => {
    open()
    const list = await screen.findByRole('complementary', { name: 'Conversations' })

    fireEvent.change(within(list).getByLabelText('Search conversations'), { target: { value: 'akoko' } })

    expect(within(list).getByText('Akoko Solutions LTD')).toBeInTheDocument()
    expect(within(list).queryByText('Ama Mensah')).not.toBeInTheDocument()

    fireEvent.change(within(list).getByLabelText('Search conversations'), { target: { value: 'nobody-matches-this' } })
    expect(within(list).getByText('Nothing here')).toBeInTheDocument()
    expect(within(list).getByText('No conversation matches your search.')).toBeInTheDocument()
  })

  it('conversations are buttons, so they work with a keyboard, and the open one is marked', async () => {
    open()
    const list = await screen.findByRole('complementary', { name: 'Conversations' })

    fireEvent.click(within(list).getByRole('button', { name: /Ama Mensah/ }))

    await waitFor(() => expect(within(list).getByRole('button', { name: /Ama Mensah/ })).toHaveAttribute('aria-current', 'true'))
  })
})

describe('an open conversation', () => {
  beforeEach(() => {
    api.messages.mockResolvedValue({
      messages: [
        message('t1', 'them', 'Hello, thank you for applying.', 2900),
        message('t2', 'them', 'We liked your profile.', 2897),
        message('t3', 'me', 'Thank you!', 2880),
        message('t4', 'them', 'Can you start on Monday?', 5),
      ],
    })
  })

  it('shows the name, who they are and their email in the header', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Akoko Solutions LTD/ }))

    const chat = await screen.findByRole('region', { name: 'Conversation' })
    expect(within(chat).getByRole('heading', { name: 'Akoko Solutions LTD' })).toBeInTheDocument()
    expect(within(chat).getByText('Employer · hr@akoko.example')).toBeInTheDocument()
  })

  it('puts a date label where the day changes, and groups runs of messages from one person', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Akoko Solutions LTD/ }))

    const log = await screen.findByRole('log', { name: 'Messages' })
    await within(log).findByText('Can you start on Monday?')
    expect(within(log).getByText('Today')).toBeInTheDocument()
    // The two messages sent within minutes of each other share one time stamp, not one each.
    const stamps = within(log).getAllByText(/^\d{2}:\d{2}/)
    expect(stamps).toHaveLength(3)
  })

  it('does not scroll the whole page, only the message list', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { writable: true, configurable: true, value: scrollIntoView })
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Akoko Solutions LTD/ }))
    await within(await screen.findByRole('log', { name: 'Messages' })).findByText('Can you start on Monday?')

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('the message box is a multi-line box: Enter sends, Shift+Enter does not', async () => {
    api.send.mockResolvedValue({ success: true })
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Akoko Solutions LTD/ }))
    const box = await screen.findByLabelText('Write a message')

    expect(box.tagName).toBe('TEXTAREA')
    fireEvent.change(box, { target: { value: 'Line one' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(api.send).not.toHaveBeenCalled()

    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(api.send).toHaveBeenCalledWith('u1', 'Line one', undefined))
  })

  it('keeps line breaks in a message, and has no buttons that do nothing', async () => {
    api.messages.mockResolvedValue({ messages: [message('t1', 'them', 'First line\nSecond line', 5)] })
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Akoko Solutions LTD/ }))

    const text = await screen.findByText(/First line/)
    expect(text.className).toMatch(/whitespace-pre-wrap/)
    // The emoji, microphone, "+" and "more" buttons were removed: every button left does something.
    expect(screen.queryByRole('button', { name: /emoji|microphone|more/i })).not.toBeInTheDocument()
  })

  it('tells people how to send', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Ama Mensah/ }))

    expect(await screen.findByText('Press Enter to send, Shift+Enter for a new line.')).toBeInTheDocument()
  })
})

describe('someone with no conversations yet', () => {
  it('sees what to do next', async () => {
    api.sidebar.mockResolvedValue({ conversations: [] })
    open()

    expect(await screen.findByText('No conversations yet')).toBeInTheDocument()
    // The reading pane says what to do rather than sitting blank.
    expect(screen.getByText('Select a conversation')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse jobs' })).toBeInTheDocument()
  })
})
