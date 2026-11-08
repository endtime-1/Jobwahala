import { ArrowDown, Check, CheckCheck, ChevronLeft, LoaderCircle, MessageSquare, Paperclip, Search, Send, Smile, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import EvidenceLink, { ProtectedImage } from '../components/EvidenceLink'
import { apiGetConversationSidebar, apiGetMessageDelta, apiGetMessages, apiMarkMessagesRead, apiSendMessage, apiSendTyping, type MessageAttachmentPayload } from '../lib/api'
import { emailHandle, formatRelativeTime, getInitials } from '../lib/display'
import { uploadEvidenceFile, evidenceUploadConstraints } from '../lib/evidenceUpload'
import { subscribeToRealtimeEvents } from '../lib/realtime'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../lib/errors'

type ContactRecord = {
  id: string
  email: string
  /** A name people recognise: the company for an employer, otherwise the person's own name. */
  name?: string | null
  role?: string | null
}

type ConversationRecord = {
  id: string
  participant: ContactRecord
  lastMessage: {
    id: string
    content: string | null
    attachmentUrl?: string | null
    attachmentName?: string | null
    attachmentContentType?: string | null
    attachmentSizeBytes?: number | null
    createdAt: string
  } | null
  unreadCount: number
  /** The job this conversation is about, from the latest application between the two people. */
  context?: { jobId: string; jobTitle: string; status: string } | null
}

type MessageRecord = {
  id: string
  senderId: string
  content: string | null
  attachmentUrl?: string | null
  attachmentName?: string | null
  attachmentContentType?: string | null
  attachmentSizeBytes?: number | null
  read: boolean
  createdAt: string
  deliveryState?: 'sending' | 'failed'
}

type PendingAttachment = MessageAttachmentPayload
type ServerMessageRecord = Omit<MessageRecord, 'deliveryState'> & {
  conversationId: string
}
type DraftMap = Record<string, string>

const MESSAGE_DRAFTS_STORAGE_KEY = 'jobwahala_message_drafts'

const formatFileSize = (sizeBytes?: number | null) => {
  if (!sizeBytes) return ''
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

const getMessagePreview = (
  message?: {
    content: string | null
    attachmentName?: string | null
  } | null,
) => {
  if (!message) return 'No messages yet'
  if (message.content?.trim()) return message.content
  if (message.attachmentName) return `Attachment: ${message.attachmentName}`
  return 'Sent an attachment'
}

const nameOf = (person: { email: string; name?: string | null }) => person.name?.trim() || emailHandle(person.email)

const statusLabel = (status: string) => status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ')

const EMOJIS = ['😀', '😊', '😂', '🙂', '😉', '😍', '🙏', '👍', '👏', '🎉', '🔥', '💯', '✅', '❤️', '🤝', '🙌', '😅', '🤔', '👋', '🌟', '📎', '📅', '💼', '📞']

const ROLE_LABEL: Record<string, string> = { EMPLOYER: 'Employer', SEEKER: 'Job seeker', FREELANCER: 'Freelancer', ADMIN: 'JobWahala team' }

// A steady colour per person, so the same person always looks the same in the list and in the chat.
const AVATAR_TONES = ['bg-secondary text-white', 'bg-primary text-white', 'bg-success text-white', 'bg-accent text-white', 'bg-gold text-primary']
const toneFor = (id: string) => AVATAR_TONES[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TONES.length]

const isSameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString()

const dayLabel = (iso: string, now = new Date()) => {
  const date = new Date(iso)
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 7) return date.toLocaleDateString('en-GB', { weekday: 'long' })
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

type FeedItem = { kind: 'day'; key: string; label: string } | { kind: 'message'; message: MessageRecord; first: boolean; last: boolean }

const GROUP_GAP_MS = 5 * 60 * 1000

/** The thread as it is drawn: a date label when the day changes, and runs of messages from one person grouped together. */
const buildFeed = (messages: MessageRecord[]): FeedItem[] => {
  const items: FeedItem[] = []
  const joins = (a: MessageRecord, b: MessageRecord) => isSameDay(a.createdAt, b.createdAt) && a.senderId === b.senderId && Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < GROUP_GAP_MS

  messages.forEach((message, index) => {
    const previous = messages[index - 1]
    const next = messages[index + 1]
    if (!previous || !isSameDay(previous.createdAt, message.createdAt)) items.push({ kind: 'day', key: `day-${message.id}`, label: dayLabel(message.createdAt) })
    items.push({ kind: 'message', message, first: !previous || !joins(previous, message), last: !next || !joins(message, next) })
  })
  return items
}

const getDraftKeyForConversation = (conversationId: string) => `conversation:${conversationId}`
const getDraftKeyForRecipient = (recipientId: string) => `recipient:${recipientId}`

const getStoredDrafts = (userId: string): DraftMap => {
  try {
    const raw = window.localStorage.getItem(`${MESSAGE_DRAFTS_STORAGE_KEY}:${userId}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as DraftMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const saveStoredDrafts = (userId: string, drafts: DraftMap) => {
  try {
    window.localStorage.setItem(`${MESSAGE_DRAFTS_STORAGE_KEY}:${userId}`, JSON.stringify(drafts))
  } catch {
    // Ignore draft persistence failures and keep the in-memory state working.
  }
}

const mergeMessages = (current: MessageRecord[], incoming: MessageRecord[]) => {
  const byId = new Map<string, MessageRecord>()

  for (const message of current) {
    byId.set(message.id, message)
  }

  for (const message of incoming) {
    byId.set(message.id, message)
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  )
}

const mergeServerThreadMessages = (current: MessageRecord[], incoming: MessageRecord[]) => {
  const localOnlyMessages = current.filter(
    (message) => message.deliveryState === 'sending' || message.deliveryState === 'failed',
  )

  return mergeMessages(localOnlyMessages, incoming)
}

const toConversationPreview = (
  message: Pick<
    MessageRecord,
    'id' | 'content' | 'attachmentUrl' | 'attachmentName' | 'attachmentContentType' | 'attachmentSizeBytes' | 'createdAt'
  >,
) => ({
  id: message.id,
  content: message.content,
  attachmentUrl: message.attachmentUrl ?? null,
  attachmentName: message.attachmentName ?? null,
  attachmentContentType: message.attachmentContentType ?? null,
  attachmentSizeBytes: message.attachmentSizeBytes ?? null,
  createdAt: message.createdAt,
})

const upsertConversationPreview = (
  current: ConversationRecord[],
  conversationId: string,
  participant: ContactRecord,
  message: Pick<
    MessageRecord,
    'id' | 'content' | 'attachmentUrl' | 'attachmentName' | 'attachmentContentType' | 'attachmentSizeBytes' | 'createdAt'
  >,
) => {
  const preview = toConversationPreview(message)
  const existingConversation = current.find((conversation) => conversation.id === conversationId)

  if (existingConversation) {
    return [
      {
        ...existingConversation,
        participant,
        lastMessage: preview,
      },
      ...current.filter((conversation) => conversation.id !== conversationId),
    ]
  }

  return [
    {
      id: conversationId,
      participant,
      lastMessage: preview,
      unreadCount: 0,
    },
    ...current,
  ]
}

const reconcileOptimisticMessage = (
  current: MessageRecord[],
  optimisticId: string,
  serverMessage: ServerMessageRecord,
) => {
  const withoutOptimistic = current.filter((message) => message.id !== optimisticId)
  return mergeMessages(withoutOptimistic, [serverMessage])
}

const toAttachmentPayload = (
  message: Pick<
    MessageRecord,
    'attachmentUrl' | 'attachmentName' | 'attachmentContentType' | 'attachmentSizeBytes'
  >,
): PendingAttachment | null => {
  if (
    !message.attachmentUrl ||
    !message.attachmentName ||
    !message.attachmentContentType ||
    !message.attachmentSizeBytes
  ) {
    return null
  }

  return {
    url: message.attachmentUrl,
    name: message.attachmentName,
    contentType: message.attachmentContentType,
    sizeBytes: message.attachmentSizeBytes,
  }
}

export default function Messaging() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [conversations, setConversations] = useState<ConversationRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [draft, setDraft] = useState('')
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [pendingRecipient, setPendingRecipient] = useState<ContactRecord | null>(null)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottomRef = useRef(true)
  const [scrolledUp, setScrolledUp] = useState(false)
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [typingIn, setTypingIn] = useState<string | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const lastTypingSentRef = useRef(0)
  const [threadSearch, setThreadSearch] = useState<{ conversationId: string | null; open: boolean; query: string }>({ conversationId: null, open: false, query: '' })
  const [emojiOpen, setEmojiOpen] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<MessageRecord[]>([])
  const selectedIdRef = useRef<string | null>(null)
  const targetUserIdRef = useRef<string | null>(null)
  const conversationsRef = useRef<ConversationRecord[]>([])

  const targetUserId = searchParams.get('userId')
  const targetEmail = searchParams.get('email') || 'new.contact@jobwahala.local'

  const activeDraftKey = useMemo(() => {
    if (selectedId) return getDraftKeyForConversation(selectedId)
    if (pendingRecipient) return getDraftKeyForRecipient(pendingRecipient.id)
    return null
  }, [pendingRecipient, selectedId])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    targetUserIdRef.current = targetUserId
  }, [targetUserId])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  useEffect(() => {
    if (!user?.id) {
      setDrafts({})
      setDraft('')
      return
    }

    setDrafts(getStoredDrafts(user.id))
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    saveStoredDrafts(user.id, drafts)
  }, [drafts, user?.id])

  useEffect(() => {
    if (!activeDraftKey) {
      setDraft('')
      return
    }

    setDraft(drafts[activeDraftKey] || '')
  }, [activeDraftKey, drafts])

  const loadConversations = async (preferredUserId?: string) => {
    const data = await apiGetConversationSidebar()
    const nextConversations = data.conversations as ConversationRecord[]
    setConversations(nextConversations)

    const requestedUserId = preferredUserId
    if (requestedUserId && requestedUserId !== user?.id) {
      const directConversation = nextConversations.find((conversation) => conversation.participant.id === requestedUserId)

      if (directConversation) {
        const recipientDraftKey = getDraftKeyForRecipient(requestedUserId)
        const conversationDraftKey = getDraftKeyForConversation(directConversation.id)
        setDrafts((current) => {
          const recipientDraft = current[recipientDraftKey]
          if (!recipientDraft || current[conversationDraftKey]) {
            return current
          }

          const nextDrafts = { ...current, [conversationDraftKey]: recipientDraft }
          delete nextDrafts[recipientDraftKey]
          return nextDrafts
        })
        setSelectedId(directConversation.id)
        setPendingRecipient(null)
        if (isMobile) setShowChat(true)
        return
      }

      setSelectedId(null)
      setPendingRecipient({ id: requestedUserId, email: targetEmail })
      if (isMobile) setShowChat(true)
      return
    }

    if (!selectedId && nextConversations.length > 0) {
      setSelectedId(nextConversations[0].id)
    }

    if (selectedId && !nextConversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(nextConversations[0]?.id || null)
    }
  }

  useEffect(() => {
    loadConversations(targetUserId || undefined)
      .catch((err: any) => {
        setError(err.message || 'Unable to load conversations right now.')
      })
      .finally(() => {
        setIsLoadingConversations(false)
      })
  }, [targetUserId, targetEmail, user?.id])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }

    setIsLoadingMessages(true)
    apiGetMessages(selectedId)
      .then(async (data) => {
        setMessages((current) =>
          mergeServerThreadMessages(current, data.messages as MessageRecord[]),
        )
        await apiMarkMessagesRead(selectedId)
        await loadConversations()
      })
      .catch((err: any) => {
        setError(err.message || 'Unable to load messages right now.')
      })
      .finally(() => {
        setIsLoadingMessages(false)
      })
  }, [selectedId])

  useEffect(() => {
    if (!user) return

    return subscribeToRealtimeEvents({
      onTyping: (payload) => {
        if (!payload.conversationId) return
        setTypingIn(payload.conversationId)
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
        typingTimerRef.current = window.setTimeout(() => setTypingIn(null), 4000)
      },
      onMessagesRefresh: (payload) => {
        // A new message means they are no longer just typing.
        setTypingIn(null)
        void (async () => {
          try {
            const latestSelectedId = selectedIdRef.current
            const preferredUserId = targetUserIdRef.current || undefined
            const currentConversations = conversationsRef.current
            await loadConversations(preferredUserId)

            const conversationId =
              typeof payload.conversationId === 'string'
                ? payload.conversationId
                : latestSelectedId
            const activeConversation =
              currentConversations.find((conversation) => conversation.id === conversationId) || null
            const matchesPreferredUser = Boolean(
              conversationId &&
              preferredUserId &&
              activeConversation?.participant.id === preferredUserId,
            )

            const shouldReloadThread =
              Boolean(conversationId) &&
              (conversationId === latestSelectedId || (!latestSelectedId && matchesPreferredUser))

            if (!conversationId || !shouldReloadThread) {
              return
            }

            const currentMessages = messagesRef.current
            const deltaCursor =
              currentMessages.length > 0
                ? currentMessages[currentMessages.length - 1]?.createdAt
                : activeConversation?.lastMessage?.createdAt || undefined

            if (payload.reason === 'created' && deltaCursor) {
              const data = await apiGetMessageDelta(conversationId, deltaCursor)
              setMessages((existing) => mergeMessages(existing, data.messages as MessageRecord[]))
            } else if (payload.reason === 'read' && conversationId === latestSelectedId && payload.actorId && payload.actorId !== user.id) {
              setMessages((existing) =>
                existing.map((message) =>
                  message.senderId === user.id ? { ...message, read: true } : message,
                ),
              )
            } else {
              const data = await apiGetMessages(conversationId)
              setMessages((current) =>
                mergeServerThreadMessages(current, data.messages as MessageRecord[]),
              )
            }

            if (payload.reason === 'created' && payload.senderId !== user.id) {
              await apiMarkMessagesRead(conversationId)
              await loadConversations(preferredUserId)
            }
          } catch (err) {
            setError(getErrorMessage(err, 'Unable to refresh messages right now.'))
          }
        })()
      },
    })
  }, [user?.id, selectedId, targetUserId, targetEmail])

  // The message list scrolls inside its own box. (Scrolling the whole page here is what threw people down to the footer.)
  const scrollListToBottom = () => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }

  const handleListScroll = () => {
    const list = listRef.current
    if (!list) return
    const distance = list.scrollHeight - list.scrollTop - list.clientHeight
    stickToBottomRef.current = distance < 80
    setScrolledUp(distance > 240)
  }

  const jumpToLatest = () => {
    stickToBottomRef.current = true
    scrollListToBottom()
  }

  // A different conversation starts at its newest message.
  useEffect(() => {
    stickToBottomRef.current = true
    scrollListToBottom()
  }, [selectedId, pendingRecipient])

  // New messages: follow them if the reader is at the bottom or wrote the last one; otherwise leave the reader where they are.
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last) return
    if (stickToBottomRef.current || last.senderId === user?.id) scrollListToBottom()
  }, [messages, isLoadingMessages, user?.id])

  // The message box grows with what is typed, up to a few lines.
  useEffect(() => {
    const box = composerRef.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, 144)}px`
  }, [draft])

  const selectedConversation = useMemo(() => {
    return conversations.find((conversation) => conversation.id === selectedId) || null
  }, [conversations, selectedId])

  const activeParticipant = selectedConversation ? selectedConversation.participant : pendingRecipient

  const filteredContacts = useMemo(() => {
    return conversations.filter((conversation) => {
      const participant = conversation.participant
      const q = contactSearch.toLowerCase()
      return !contactSearch || participant.email.toLowerCase().includes(q) || emailHandle(participant.email).toLowerCase().includes(q) || (participant.name ?? '').toLowerCase().includes(q)
    })
  }, [contactSearch, conversations])

  const showPendingRecipient = useMemo(() => {
    if (!pendingRecipient) return false
    if (!contactSearch) return true
    const q = contactSearch.toLowerCase()
    return pendingRecipient.email.toLowerCase().includes(q) || emailHandle(pendingRecipient.email).toLowerCase().includes(q)
  }, [contactSearch, pendingRecipient])

  const getSidebarPreviewLabel = (conversation: ConversationRecord) => {
    if (typingIn === conversation.id) return 'typing…'
    const draftValue = drafts[getDraftKeyForConversation(conversation.id)]?.trim()
    if (draftValue) {
      return `Draft: ${draftValue}`
    }

    return getMessagePreview(conversation.lastMessage)
  }

  const handleSelectConversation = (conversationId: string) => {
    setSelectedId(conversationId)
    setPendingRecipient(null)
    if (isMobile) setShowChat(true)
  }

  const handleAttachmentClick = () => {
    if (!isUploadingAttachment) {
      attachmentInputRef.current?.click()
    }
  }

  const handleAttachmentSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setError('')
    setIsUploadingAttachment(true)

    try {
      const response = await uploadEvidenceFile('message', file)
      setPendingAttachment({
        url: response.file.url,
        name: response.file.originalFileName || file.name,
        contentType: response.file.contentType || file.type,
        sizeBytes: response.file.sizeBytes || file.size,
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to upload this attachment right now.'))
    } finally {
      setIsUploadingAttachment(false)
    }
  }

  const clearPendingAttachment = () => {
    setPendingAttachment(null)
  }

  const submitMessage = async ({
    optimisticId,
    recipient,
    content,
    attachment,
    existingConversationId,
  }: {
    optimisticId: string
    recipient: ContactRecord
    content: string
    attachment: PendingAttachment | null
    existingConversationId: string | null
  }) => {
    try {
      const response = await apiSendMessage(recipient.id, content, attachment || undefined)
      const serverMessage = (response.message || null) as ServerMessageRecord | null

      if (!serverMessage) {
        if (existingConversationId) {
          const data = await apiGetMessages(existingConversationId)
          setMessages((current) =>
            mergeServerThreadMessages(current, data.messages as MessageRecord[]),
          )
          await loadConversations(recipient.id)
        } else {
          await loadConversations(recipient.id)
        }
        return
      }

      setMessages((existing) => reconcileOptimisticMessage(existing, optimisticId, serverMessage))
      setConversations((current) =>
        upsertConversationPreview(current, serverMessage.conversationId, recipient, serverMessage),
      )

      if (!existingConversationId) {
        setPendingRecipient(null)
        setSelectedId(serverMessage.conversationId)
      }
    } catch (err) {
      setMessages((existing) =>
        existing.map((message) =>
          message.id === optimisticId ? { ...message, deliveryState: 'failed' } : message,
        ),
      )

      try {
        await loadConversations(recipient.id)
      } catch {
        // Keep the original send error visible if the recovery refresh also fails.
      }

      setError(getErrorMessage(err, 'Unable to send this message right now.'))
    }
  }

  const handleSend = async () => {
    if ((!draft.trim() && !pendingAttachment) || !activeParticipant || isUploadingAttachment || !user) return

    setError('')
    const recipient = activeParticipant
    const content = draft.trim()
    const attachment = pendingAttachment ? { ...pendingAttachment } : null
    const existingConversationId = selectedConversation?.id || null
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimisticMessage: MessageRecord = {
      id: optimisticId,
      senderId: user.id,
      content: content || null,
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      attachmentContentType: attachment?.contentType ?? null,
      attachmentSizeBytes: attachment?.sizeBytes ?? null,
      read: false,
      createdAt: new Date().toISOString(),
      deliveryState: 'sending',
    }

    setDraft('')
    if (activeDraftKey) {
      setDrafts((current) => {
        if (!(activeDraftKey in current)) return current
        const nextDrafts = { ...current }
        delete nextDrafts[activeDraftKey]
        return nextDrafts
      })
    }
    setPendingAttachment(null)
    setMessages((existing) => mergeMessages(existing, [optimisticMessage]))

    if (existingConversationId) {
      setConversations((current) =>
        upsertConversationPreview(current, existingConversationId, recipient, optimisticMessage),
      )
    }

    await submitMessage({
      optimisticId,
      recipient,
      content,
      attachment,
      existingConversationId,
    })
  }

  const handleRetry = async (message: MessageRecord) => {
    if (!activeParticipant || !user || isUploadingAttachment) return

    const existingConversationId = selectedConversation?.id || null
    const attachment = toAttachmentPayload(message)

    setError('')
    setMessages((existing) =>
      existing.map((entry) =>
        entry.id === message.id ? { ...entry, deliveryState: 'sending' } : entry,
      ),
    )

    if (existingConversationId) {
      setConversations((current) =>
        upsertConversationPreview(current, existingConversationId, activeParticipant, message),
      )
    }

    await submitMessage({
      optimisticId: message.id,
      recipient: activeParticipant,
      content: message.content || '',
      attachment,
      existingConversationId,
    })
  }

  const renderDeliveryState = (message: MessageRecord) => {
    if (message.deliveryState === 'sending') {
      return <LoaderCircle className="h-3 w-3 animate-spin" />
    }

    if (message.deliveryState === 'failed') {
      return <X className="h-3 w-3 text-error" />
    }

    if (message.read) {
      return <CheckCheck className="h-3 w-3" />
    }

    return <Check className="h-3 w-3" />
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  const unreadTotal = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0)
  const listedContacts = onlyUnread ? filteredContacts.filter((conversation) => conversation.unreadCount > 0) : filteredContacts
  const participantName = activeParticipant ? nameOf(activeParticipant) : ''
  // Searching inside a conversation only applies to the conversation it was typed in.
  const searchHere = threadSearch.conversationId === selectedId ? threadSearch : null
  const threadQuery = searchHere?.query.trim().toLowerCase() ?? ''
  const visibleMessages = useMemo(
    () => (threadQuery ? messages.filter((message) => (message.content ?? '').toLowerCase().includes(threadQuery) || (message.attachmentName ?? '').toLowerCase().includes(threadQuery)) : messages),
    [messages, threadQuery],
  )
  const feed = useMemo(() => buildFeed(visibleMessages), [visibleMessages])

  const updateDraft = (nextDraft: string) => {
    setDraft(nextDraft)
    if (nextDraft.trim() && selectedId && Date.now() - lastTypingSentRef.current > 3000) {
      lastTypingSentRef.current = Date.now()
      try {
        void apiSendTyping(selectedId)?.catch?.(() => undefined)
      } catch {
        // "Typing" is a nicety: it must never get in the way of writing.
      }
    }
    if (!activeDraftKey) return
    setDrafts((current) => {
      if (!nextDraft.trim()) {
        if (!(activeDraftKey in current)) return current
        const nextDrafts = { ...current }
        delete nextDrafts[activeDraftKey]
        return nextDrafts
      }

      return { ...current, [activeDraftKey]: nextDraft }
    })
  }

  const insertEmoji = (emoji: string) => {
    const box = composerRef.current
    const start = box?.selectionStart ?? draft.length
    const end = box?.selectionEnd ?? start
    updateDraft(draft.slice(0, start) + emoji + draft.slice(end))
    setEmojiOpen(false)
    window.requestAnimationFrame(() => {
      box?.focus()
      box?.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  const renderAvatar = (id: string, name: string, size: 'md' | 'lg' = 'md') => (
    <span className={`flex flex-none items-center justify-center rounded-full font-black ${toneFor(id)} ${size === 'lg' ? 'h-12 w-12 text-base' : 'h-12 w-12 text-sm'}`} aria-hidden>
      {getInitials(name)}
    </span>
  )

  const renderSidebar = () => (
    <aside aria-label="Conversations" className="flex h-full w-full flex-col border-r border-surface-border bg-white md:w-[360px] xl:w-[400px]">
      <header className="shrink-0 border-b border-surface-border/60 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight text-text-main">Messages</h1>
          {unreadTotal > 0 ? (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-black text-white" aria-label={`${unreadTotal} unread`}>
              {unreadTotal}
            </span>
          ) : null}
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" aria-hidden />
          <input
            type="search"
            aria-label="Search conversations"
            placeholder="Search conversations"
            value={contactSearch}
            onChange={(event) => setContactSearch(event.target.value)}
            className="h-11 w-full rounded-xl border border-surface-border bg-surface-alt/50 pl-11 pr-4 text-sm font-semibold placeholder:text-text-light/70 focus:bg-white"
          />
        </div>
        <div role="group" aria-label="Filter conversations" className="mt-3 flex gap-2">
          {[
            { label: 'All', value: false },
            { label: 'Unread', value: true },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              aria-pressed={onlyUnread === chip.value}
              onClick={() => setOnlyUnread(chip.value)}
              className={`rounded-full px-4 py-1.5 text-xs font-black transition-colors ${onlyUnread === chip.value ? 'bg-primary text-white' : 'bg-surface-alt text-text-muted hover:text-text-main'}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </header>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {showPendingRecipient && pendingRecipient ? (
          <li>
            <button
              type="button"
              aria-current={!selectedId ? 'true' : undefined}
              onClick={() => {
                setSelectedId(null)
                if (isMobile) setShowChat(true)
              }}
              className={`flex w-full gap-3 rounded-2xl p-3 text-left transition-colors ${!selectedId ? 'bg-secondary/10' : 'hover:bg-surface-alt/60'}`}
            >
              {renderAvatar(pendingRecipient.id, nameOf(pendingRecipient))}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-extrabold text-text-main">{nameOf(pendingRecipient)}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-secondary">New</span>
                </span>
                <span className="mt-0.5 block truncate text-xs font-medium text-text-muted">
                  {drafts[getDraftKeyForRecipient(pendingRecipient.id)]?.trim() ? `Draft: ${drafts[getDraftKeyForRecipient(pendingRecipient.id)]?.trim()}` : 'Start a new conversation'}
                </span>
              </span>
            </button>
          </li>
        ) : null}

        {isLoadingConversations ? (
          <li className="px-4 py-6 text-sm font-semibold text-text-light">Loading conversations...</li>
        ) : listedContacts.length === 0 && !showPendingRecipient ? (
          <li className="px-4 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
              <MessageSquare className="h-7 w-7" aria-hidden />
            </span>
            {onlyUnread || contactSearch ? (
              <>
                <p className="mt-4 text-lg font-extrabold text-text-main">Nothing here</p>
                <p className="mt-1 text-sm font-medium text-text-muted">{onlyUnread ? 'You have no unread conversations.' : 'No conversation matches your search.'}</p>
              </>
            ) : (
              <>
                <p className="mt-4 text-lg font-extrabold text-text-main">No conversations yet</p>
                <p className="mt-1 text-sm font-medium text-text-muted">Chats start when you apply to a job, send a proposal or contact a freelancer.</p>
                <div className="mt-5 flex flex-col gap-2">
                  <Link to="/jobs" className="btn btn-primary btn-sm justify-center">Browse jobs</Link>
                  <Link to="/freelancers" className="btn btn-outline btn-sm justify-center">Find freelancers</Link>
                </div>
              </>
            )}
          </li>
        ) : (
          listedContacts.map((conversation) => {
            const participant = conversation.participant
            const preview = conversation.lastMessage
            const selected = selectedId === conversation.id
            const unread = conversation.unreadCount > 0

            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => handleSelectConversation(conversation.id)}
                  className={`flex w-full gap-3 rounded-2xl p-3 text-left transition-colors ${selected ? 'bg-secondary/10' : 'hover:bg-surface-alt/60'}`}
                >
                  {renderAvatar(participant.id, nameOf(participant))}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm text-text-main ${unread ? 'font-black' : 'font-bold'}`}>{nameOf(participant)}</span>
                      <span className="flex-none text-[11px] font-semibold text-text-light">{preview ? formatRelativeTime(preview.createdAt) : 'New'}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-xs ${unread ? 'font-extrabold text-text-main' : 'font-medium text-text-muted'}`}>{getSidebarPreviewLabel(conversation)}</span>
                      {unread ? (
                        <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-secondary px-1.5 text-[11px] font-black text-white" aria-label={`${conversation.unreadCount} unread`}>
                          {conversation.unreadCount}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </aside>
  )

  const renderBubble = (message: MessageRecord, isMine: boolean, first: boolean, last: boolean) => (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${first ? 'mt-3' : 'mt-1'}`}>
      <div className={`flex max-w-[85%] flex-col md:max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
        <div
          className={`flex flex-col gap-1 px-4 py-2.5 text-sm leading-relaxed ${
            isMine ? 'bg-secondary text-white' : 'border border-surface-border bg-white text-text-main'
          } ${message.deliveryState === 'failed' ? 'ring-2 ring-error/60' : ''} ${
            isMine ? `rounded-2xl ${last ? 'rounded-br-md' : ''}` : `rounded-2xl ${last ? 'rounded-bl-md' : ''}`
          } ${message.deliveryState === 'sending' ? 'opacity-70' : ''}`}
        >
          {message.attachmentUrl ? (
            message.attachmentContentType?.startsWith('image/') ? (
              <EvidenceLink href={message.attachmentUrl} className="block">
                <ProtectedImage src={message.attachmentUrl} alt={message.attachmentName || 'Attachment'} className="mb-1 max-h-64 w-full rounded-xl object-cover" />
              </EvidenceLink>
            ) : (
              <EvidenceLink
                href={message.attachmentUrl}
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${isMine ? 'bg-white/15 hover:bg-white/20' : 'bg-surface-alt hover:bg-surface-alt/70'}`}
              >
                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${isMine ? 'bg-white/15' : 'bg-white'}`}>
                  <Paperclip className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-extrabold">{message.attachmentName || 'Attachment'}</span>
                  <span className={`block text-[11px] font-semibold ${isMine ? 'text-white/75' : 'text-text-light'}`}>
                    {message.attachmentSizeBytes ? `${formatFileSize(message.attachmentSizeBytes)} · ` : ''}Open
                  </span>
                </span>
              </EvidenceLink>
            )
          ) : null}
          {message.content ? <p className="whitespace-pre-wrap break-words font-medium">{message.content}</p> : null}
        </div>
        {last ? (
          <div className="mt-1 flex items-center gap-2 px-1">
            <span className="text-[11px] font-semibold text-text-light">{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {isMine && message.deliveryState === 'failed' ? (
              <button type="button" onClick={() => void handleRetry(message)} className="text-[11px] font-black uppercase tracking-wider text-error hover:underline">
                Retry
              </button>
            ) : null}
            {isMine ? (
              <span className="text-secondary" title={message.deliveryState === 'sending' ? 'Sending' : message.deliveryState === 'failed' ? 'Not sent' : message.read ? 'Seen' : 'Sent'}>
                {renderDeliveryState(message)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )

  const renderChat = () => {
    if (!activeParticipant) {
      return (
        <section aria-label="Conversation" className="flex h-full flex-1 flex-col items-center justify-center bg-surface-alt/30 px-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary/10 text-secondary">
            <MessageSquare className="h-8 w-8" aria-hidden />
          </span>
          <h2 className="mt-5 text-xl font-black text-text-main">Select a conversation</h2>
          <p className="mt-2 max-w-sm text-sm font-medium text-text-muted">Pick someone from the list to read your messages and reply.</p>
        </section>
      )
    }

    return (
      <section aria-label="Conversation" className="flex h-full min-w-0 flex-1 flex-col bg-white">
        <header className="flex shrink-0 items-center gap-3 border-b border-surface-border/60 px-4 py-3 sm:px-6">
          {isMobile ? (
            <button type="button" aria-label="Back to conversations" onClick={() => setShowChat(false)} className="-ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-text-main hover:bg-surface-alt">
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}
          {renderAvatar(activeParticipant.id, participantName, 'lg')}
          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-text-main">{participantName}</h2>
            <p className="truncate text-xs font-semibold text-text-light" aria-live="polite">
              {typingIn && typingIn === selectedId ? (
                <span className="font-bold text-secondary">typing…</span>
              ) : (
                <>
                  {activeParticipant.role && ROLE_LABEL[activeParticipant.role] ? `${ROLE_LABEL[activeParticipant.role]} · ` : ''}
                  {activeParticipant.email}
                </>
              )}
            </p>
          </div>
          {selectedConversation ? (
            <button
              type="button"
              aria-label="Search this conversation"
              aria-pressed={Boolean(searchHere?.open)}
              onClick={() => setThreadSearch({ conversationId: selectedId, open: !searchHere?.open, query: '' })}
              className={`ml-auto flex h-10 w-10 flex-none items-center justify-center rounded-xl transition-colors ${searchHere?.open ? 'bg-secondary/10 text-secondary' : 'text-text-muted hover:bg-surface-alt'}`}
            >
              <Search className="h-5 w-5" />
            </button>
          ) : null}
        </header>

        {searchHere?.open ? (
          <div className="flex shrink-0 items-center gap-3 border-b border-surface-border/60 bg-white px-4 py-2.5 sm:px-6">
            <input
              type="search"
              autoFocus
              aria-label="Search in this conversation"
              placeholder="Search in this conversation"
              value={searchHere.query}
              onChange={(event) => setThreadSearch({ conversationId: selectedId, open: true, query: event.target.value })}
              className="h-10 min-w-0 flex-1 rounded-xl border border-surface-border bg-surface-alt/50 px-4 text-sm font-semibold"
            />
            <span className="flex-none text-xs font-bold text-text-light" aria-live="polite">
              {threadQuery ? `${visibleMessages.length} ${visibleMessages.length === 1 ? 'match' : 'matches'}` : ''}
            </span>
          </div>
        ) : null}

        {selectedConversation?.context ? (
          <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-surface-border/60 bg-surface-alt/40 px-4 py-2 text-xs sm:px-6">
            <span className="font-bold text-text-light">About</span>
            <Link to={`/jobs/${selectedConversation.context.jobId}`} className="min-w-0 truncate font-extrabold text-primary hover:underline">
              {selectedConversation.context.jobTitle}
            </Link>
            <span className="rounded-full bg-white px-2 py-0.5 font-bold text-text-muted">{statusLabel(selectedConversation.context.status)}</span>
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 bg-surface-alt/30">
          <div ref={listRef} onScroll={handleListScroll} role="log" aria-live="polite" aria-label="Messages" className="h-full overflow-y-auto px-4 py-4 sm:px-8">
            {pendingRecipient && !selectedConversation ? (
              <div className="mx-auto mb-4 max-w-md rounded-2xl border border-surface-border bg-white p-4 text-center text-sm font-semibold text-text-muted">
                This will start a new conversation with {pendingRecipient.email}.
              </div>
            ) : null}

            {isLoadingMessages ? (
              <p className="py-6 text-center text-sm font-semibold text-text-light">Loading messages...</p>
            ) : threadQuery && visibleMessages.length === 0 ? (
              <p className="py-10 text-center text-sm font-semibold text-text-light">No messages match your search.</p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm font-semibold text-text-light">{pendingRecipient ? 'No messages yet. Send the first message.' : 'No messages in this thread yet.'}</p>
            ) : (
              feed.map((item) =>
                item.kind === 'day' ? (
                  <div key={item.key} className="my-4 flex justify-center">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wider text-text-light shadow-sm">{item.label}</span>
                  </div>
                ) : (
                  <div key={item.message.id}>{renderBubble(item.message, item.message.senderId === user?.id, item.first, item.last)}</div>
                ),
              )
            )}
          </div>
          {scrolledUp ? (
            <button type="button" onClick={jumpToLatest} aria-label="Jump to latest message" className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-black text-white shadow-premium">
              <ArrowDown className="h-3.5 w-3.5" aria-hidden /> New messages
            </button>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-surface-border/60 bg-white p-3 sm:p-4">
          {error ? <p role="alert" className="mb-3 text-sm font-semibold text-error">{error}</p> : null}
          {pendingAttachment ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-alt/50 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-light">Attachment Ready</p>
                <p className="truncate text-sm font-semibold text-text-main">{pendingAttachment.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-text-light">{formatFileSize(pendingAttachment.sizeBytes)}</span>
                <button type="button" aria-label="Remove attachment" onClick={clearPendingAttachment} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-text-light shadow-sm hover:text-error">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex items-end gap-2 sm:gap-3">
            <input ref={attachmentInputRef} type="file" aria-label="Message attachment" accept={evidenceUploadConstraints.supportedContentTypes.join(',')} className="hidden" onChange={(event) => void handleAttachmentSelected(event)} />
            <div className="relative flex-none">
              <button type="button" aria-label="Add emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((open) => !open)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-alt text-text-muted transition hover:bg-surface-alt/70 hover:text-text-main">
                <Smile className="h-5 w-5" />
              </button>
              {emojiOpen ? (
                <div role="dialog" aria-label="Emoji" onKeyDown={(event) => event.key === 'Escape' && setEmojiOpen(false)} className="absolute bottom-14 left-0 z-20 grid w-64 grid-cols-6 gap-1 rounded-2xl border border-surface-border bg-white p-2 shadow-premium">
                  {EMOJIS.map((emoji) => (
                    <button key={emoji} type="button" aria-label={emoji} onClick={() => insertEmoji(emoji)} className="flex h-9 w-9 items-center justify-center rounded-lg text-xl hover:bg-surface-alt">
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button type="button" aria-label="Attach file" onClick={handleAttachmentClick} disabled={isUploadingAttachment} className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-surface-alt text-text-muted transition hover:bg-surface-alt/70 hover:text-text-main disabled:opacity-60">
              {isUploadingAttachment ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </button>
            <textarea
              ref={composerRef}
              rows={1}
              maxLength={5000}
              aria-label="Write a message"
              placeholder={`Message ${participantName.length > 20 ? `${participantName.slice(0, 19)}…` : participantName}...`}
              value={draft}
              onChange={(event) => updateDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              className="max-h-36 min-h-11 flex-1 resize-none rounded-xl border border-surface-border bg-surface-alt/50 px-4 py-2.5 text-sm font-semibold leading-relaxed placeholder:text-text-light/70 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              aria-label="Send message"
              disabled={(!draft.trim() && !pendingAttachment) || isUploadingAttachment}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-secondary text-white shadow-premium-sm transition hover:bg-secondary-dark disabled:opacity-40"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 hidden px-1 text-[11px] font-medium text-text-light sm:block">Press Enter to send, Shift+Enter for a new line.</p>
        </footer>
      </section>
    )
  }

  return (
    <div className="bg-surface-alt/30 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-24 md:pb-8 xl:pt-28">
      <div className="container mx-auto max-w-7xl">
        <div className="flex h-[calc(100dvh-13rem)] min-h-[32rem] overflow-hidden rounded-3xl border border-surface-border bg-white shadow-premium md:h-[calc(100dvh-11rem)]">
          {(isMobile && !showChat) || !isMobile ? renderSidebar() : null}
          {(isMobile && showChat) || !isMobile ? renderChat() : null}
        </div>
      </div>
    </div>
  )
}
