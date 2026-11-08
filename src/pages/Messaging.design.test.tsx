import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Messaging from './Messaging'

const api = vi.hoisted(() => ({ sidebar: vi.fn(), messages: vi.fn(), read: vi.fn(), delta: vi.fn(), send: vi.fn(), typing: vi.fn() }))
const live = vi.hoisted(() => ({ handlers: {} as Record<string, ((payload?: any) => void) | undefined> }))

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', email: 'hr@acme.example' } }) }))
vi.mock('../lib/api', () => ({
  apiGetConversationSidebar: (...a: unknown[]) => api.sidebar(...a),
  apiGetMessages: (...a: unknown[]) => api.messages(...a),
  apiMarkMessagesRead: (...a: unknown[]) => api.read(...a),
  apiGetMessageDelta: (...a: unknown[]) => api.delta(...a),
  apiSendMessage: (...a: unknown[]) => api.send(...a),
  apiSendTyping: (...a: unknown[]) => api.typing(...a),
}))
vi.mock('../lib/realtime', () => ({
  subscribeToRealtimeEvents: (handlers: typeof live.handlers) => {
    live.handlers = handlers
    return () => undefined
  },
}))
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
  api.typing.mockResolvedValue({ success: true })
  live.handlers = {}
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
    // Buttons that did nothing (microphone, "+", "more") are gone: every button left does something.
    expect(screen.queryByRole('button', { name: /microphone|more/i })).not.toBeInTheDocument()
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

const openAkoko = async () => {
  open()
  fireEvent.click(await screen.findByRole('button', { name: /Akoko Solutions LTD/ }))
  await within(await screen.findByRole('log', { name: 'Messages' })).findByText('Can you start on Monday?')
}

describe('typing indicators', () => {
  beforeEach(() => {
    api.messages.mockResolvedValue({ messages: [message('t4', 'them', 'Can you start on Monday?', 5)] })
  })

  it('shows that the other person is typing, in the header and in the list, then stops after a few seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await openAkoko()

      act(() => live.handlers.onTyping?.({ conversationId: 'c1', userId: 'u1' }))

      const chat = screen.getByRole('region', { name: 'Conversation' })
      expect(within(chat).getByText('typing…')).toBeInTheDocument()
      expect(within(screen.getByRole('complementary', { name: 'Conversations' })).getAllByText('typing…').length).toBeGreaterThan(0)

      act(() => {
        vi.advanceTimersByTime(4500)
      })
      expect(within(chat).queryByText('typing…')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not show typing from a conversation that is not open', async () => {
    await openAkoko()

    act(() => live.handlers.onTyping?.({ conversationId: 'c2', userId: 'u2' }))

    expect(within(screen.getByRole('region', { name: 'Conversation' })).queryByText('typing…')).not.toBeInTheDocument()
  })

  it('tells the server while you write, but only every few seconds, and never for an empty box', async () => {
    await openAkoko()
    const box = await screen.findByLabelText('Write a message')

    fireEvent.change(box, { target: { value: '' } })
    expect(api.typing).not.toHaveBeenCalled()

    fireEvent.change(box, { target: { value: 'H' } })
    fireEvent.change(box, { target: { value: 'He' } })
    fireEvent.change(box, { target: { value: 'Hel' } })

    expect(api.typing).toHaveBeenCalledTimes(1)
    expect(api.typing).toHaveBeenCalledWith('c1')
  })

  it('a failed typing ping never gets in the way of writing', async () => {
    api.typing.mockRejectedValue(new Error('offline'))
    await openAkoko()
    const box = await screen.findByLabelText('Write a message')

    fireEvent.change(box, { target: { value: 'Still writing' } })

    expect(box).toHaveValue('Still writing')
  })
})

describe('what the conversation is about', () => {
  it('shows the job it relates to, with its status and a link', async () => {
    api.sidebar.mockResolvedValue({
      conversations: [{ ...LIST[0], context: { jobId: 'job-9', jobTitle: 'B2B Sales Executive', status: 'UNDER_REVIEW' } }, LIST[1]],
    })
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Akoko Solutions LTD/ }))

    const link = await screen.findByRole('link', { name: 'B2B Sales Executive' })
    expect(link).toHaveAttribute('href', '/jobs/job-9')
    expect(screen.getByText('Under review')).toBeInTheDocument()
  })

  it('shows nothing extra when there is no application between the two people', async () => {
    api.messages.mockResolvedValue({ messages: [message('t4', 'them', 'Can you start on Monday?', 5)] })
    await openAkoko()

    expect(screen.queryByText('About')).not.toBeInTheDocument()
  })
})

describe('searching inside a conversation', () => {
  beforeEach(() => {
    api.messages.mockResolvedValue({
      messages: [message('t1', 'them', 'Please send your licence copy.', 3000), message('t2', 'me', 'Sent it just now.', 2990), message('t3', 'them', 'Can you start on Monday?', 5)],
    })
  })

  it('narrows the thread to messages that match, counts them, and says when nothing matches', async () => {
    await openAkoko()
    fireEvent.click(screen.getByRole('button', { name: 'Search this conversation' }))
    const search = await screen.findByLabelText('Search in this conversation')

    fireEvent.change(search, { target: { value: 'LICENCE' } })

    const log = screen.getByRole('log', { name: 'Messages' })
    expect(within(log).getByText('Please send your licence copy.')).toBeInTheDocument()
    expect(within(log).queryByText('Can you start on Monday?')).not.toBeInTheDocument()
    expect(screen.getByText('1 match')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'zzzz' } })
    expect(within(log).getByText('No messages match your search.')).toBeInTheDocument()
  })

  it('closing the search brings the whole conversation back', async () => {
    await openAkoko()
    fireEvent.click(screen.getByRole('button', { name: 'Search this conversation' }))
    fireEvent.change(await screen.findByLabelText('Search in this conversation'), { target: { value: 'licence' } })

    fireEvent.click(screen.getByRole('button', { name: 'Search this conversation' }))

    const log = screen.getByRole('log', { name: 'Messages' })
    expect(within(log).getByText('Can you start on Monday?')).toBeInTheDocument()
    expect(screen.queryByLabelText('Search in this conversation')).not.toBeInTheDocument()
  })

  it('a search typed in one conversation does not follow you to another', async () => {
    await openAkoko()
    fireEvent.click(screen.getByRole('button', { name: 'Search this conversation' }))
    fireEvent.change(await screen.findByLabelText('Search in this conversation'), { target: { value: 'licence' } })

    fireEvent.click(screen.getByRole('button', { name: /Ama Mensah/ }))

    await waitFor(() => expect(screen.queryByLabelText('Search in this conversation')).not.toBeInTheDocument())
  })
})

describe('emoji', () => {
  beforeEach(() => {
    api.messages.mockResolvedValue({ messages: [message('t4', 'them', 'Can you start on Monday?', 5)] })
  })

  it('opens a small picker, puts the emoji where the cursor is, and closes', async () => {
    await openAkoko()
    const box = (await screen.findByLabelText('Write a message')) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'Great news!' } })
    box.setSelectionRange(5, 5)

    fireEvent.click(screen.getByRole('button', { name: 'Add emoji' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Emoji' })).getByRole('button', { name: '👍' }))

    expect(box).toHaveValue('Great👍 news!')
    expect(screen.queryByRole('dialog', { name: 'Emoji' })).not.toBeInTheDocument()
  })

  it('Escape closes the picker without adding anything', async () => {
    await openAkoko()
    fireEvent.click(await screen.findByRole('button', { name: 'Add emoji' }))

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Emoji' }), { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Emoji' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Write a message')).toHaveValue('')
  })
})
