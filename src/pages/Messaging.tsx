import { Search, Send, MoreVertical, PlusCircle, Smile, ChevronLeft, Check, CheckCheck, Paperclip, Mic, LoaderCircle, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGetConversationSidebar, apiGetMessageDelta, apiGetMessages, apiMarkMessagesRead, apiSendMessage, type MessageAttachmentPayload } from '../lib/api'
import { emailHandle, formatRelativeTime, getInitials } from '../lib/display'
import { uploadEvidenceFile, evidenceUploadConstraints } from '../lib/evidenceUpload'
import { subscribeToRealtimeEvents } from '../lib/realtime'
import { useAuth } from '../context/AuthContext'

type ContactRecord = {
  id: string
  email: string
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
      onMessagesRefresh: (payload) => {
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
          } catch (err: any) {
            setError(err.message || 'Unable to refresh messages right now.')
          }
        })()
      },
    })
  }, [user?.id, selectedId, targetUserId, targetEmail])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedId, pendingRecipient])

  const selectedConversation = useMemo(() => {
    return conversations.find((conversation) => conversation.id === selectedId) || null
  }, [conversations, selectedId])

  const activeParticipant = selectedConversation ? selectedConversation.participant : pendingRecipient

  const filteredContacts = useMemo(() => {
    return conversations.filter((conversation) => {
      const participant = conversation.participant
      const q = contactSearch.toLowerCase()
      return !contactSearch || participant.email.toLowerCase().includes(q) || emailHandle(participant.email).toLowerCase().includes(q)
    })
  }, [contactSearch, conversations])

  const showPendingRecipient = useMemo(() => {
    if (!pendingRecipient) return false
    if (!contactSearch) return true
    const q = contactSearch.toLowerCase()
    return pendingRecipient.email.toLowerCase().includes(q) || emailHandle(pendingRecipient.email).toLowerCase().includes(q)
  }, [contactSearch, pendingRecipient])

  const getSidebarPreviewLabel = (conversation: ConversationRecord) => {
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
    } catch (err: any) {
      setError(err.message || 'Unable to upload this attachment right now.')
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
    } catch (err: any) {
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

      setError(err.message || 'Unable to send this message right now.')
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

  const renderSidebar = () => (
    <div className="relative z-20 flex h-full w-full flex-col border-r border-surface-border bg-surface-alt/5 md:w-[360px] xl:w-[400px]">
      <header className="shrink-0 bg-white/50 p-5 pb-5 backdrop-blur-3xl sm:p-8 sm:pb-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Messaging</p>
            <h2 className="text-3xl font-black tracking-tighter text-text-main italic sm:text-4xl">Workspace</h2>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <PlusCircle className="h-5 w-5" />
          </div>
        </div>
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-light group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search active sessions..."
            value={contactSearch}
            onChange={(event) => setContactSearch(event.target.value)}
            className="w-full h-14 rounded-2xl border-none bg-white py-3 pl-14 pr-4 text-sm font-bold focus:ring-2 focus:ring-primary/10 shadow-premium-sm placeholder:text-text-light/50"
          />
        </div>
      </header>

      <div className="flex-grow overflow-y-auto px-4 pb-8 space-y-2 custom-scrollbar">
        <p className="px-4 text-[10px] font-black uppercase tracking-[0.3em] text-text-light/60 mb-4 mt-2">Active Channels</p>

        {showPendingRecipient ? (
          <div
            className={`p-6 flex gap-5 cursor-pointer transition-all rounded-3xl group relative ${
              !selectedId && pendingRecipient ? 'bg-white shadow-premium-md' : 'hover:bg-white/40'
            }`}
            onClick={() => {
              setSelectedId(null)
              if (isMobile) setShowChat(true)
            }}
          >
            {!selectedId && pendingRecipient ? (
              <div className="absolute left-2 top-6 bottom-6 w-1 bg-primary rounded-full shadow-lg shadow-primary/50"></div>
            ) : null}
            <div className="h-14 w-14 rounded-2xl bg-secondary text-white flex items-center justify-center font-black text-lg shadow-premium-sm">
              {getInitials(emailHandle(pendingRecipient?.email || 'N'))}
            </div>
            <div className="flex-grow overflow-hidden">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className={`font-black text-sm tracking-tight truncate ${!selectedId && pendingRecipient ? 'text-primary' : 'text-text-main'}`}>
                  {emailHandle(pendingRecipient?.email || targetEmail)}
                </h3>
                <span className="text-[9px] font-black text-text-light/50 whitespace-nowrap uppercase tracking-widest">New</span>
              </div>
              <p className="text-xs italic text-text-muted font-medium">
                {pendingRecipient && drafts[getDraftKeyForRecipient(pendingRecipient.id)]?.trim()
                  ? `Draft: ${drafts[getDraftKeyForRecipient(pendingRecipient.id)]?.trim()}`
                  : 'Start a new conversation'}
              </p>
            </div>
          </div>
        ) : null}

        {isLoadingConversations ? (
          <div className="px-4 py-6 text-sm font-semibold text-text-light">Loading conversations...</div>
        ) : filteredContacts.length === 0 && !showPendingRecipient ? (
          <div className="px-4 py-6 text-sm font-semibold text-text-light">No conversations yet.</div>
        ) : (
          filteredContacts.map((conversation) => {
            const participant = conversation.participant
            const preview = conversation.lastMessage

            return (
              <div
                key={conversation.id}
                className={`p-6 flex gap-5 cursor-pointer transition-all rounded-3xl group relative ${
                  selectedId === conversation.id ? 'bg-white shadow-premium-md' : 'hover:bg-white/40'
                }`}
                onClick={() => handleSelectConversation(conversation.id)}
              >
                {selectedId === conversation.id ? (
                  <div className="absolute left-2 top-6 bottom-6 w-1 bg-primary rounded-full shadow-lg shadow-primary/50"></div>
                ) : null}

                <div className="relative flex-shrink-0">
                  <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-lg shadow-premium-sm group-hover:scale-105 transition-transform">
                    {getInitials(emailHandle(participant.email))}
                  </div>
                </div>

                <div className="flex-grow overflow-hidden">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className={`font-black text-sm tracking-tight truncate ${selectedId === conversation.id ? 'text-primary' : 'text-text-main'}`}>
                      {emailHandle(participant.email)}
                    </h3>
                    <span className="text-[9px] font-black text-text-light/50 whitespace-nowrap uppercase tracking-widest">
                      {preview ? formatRelativeTime(preview.createdAt) : 'New'}
                    </span>
                  </div>
                  <p className={`text-xs truncate italic ${conversation.unreadCount > 0 ? 'text-text-main font-black' : 'text-text-muted font-medium'}`}>
                    {getSidebarPreviewLabel(conversation)}
                  </p>
                  {conversation.unreadCount > 0 ? (
                    <div className="mt-2 flex">
                      <span className="bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-primary/20">
                        {conversation.unreadCount} NEW
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )

  const renderChat = () => (
    <div className="flex-grow flex flex-col bg-white relative h-full overflow-hidden">
      <header className="z-10 flex h-[92px] shrink-0 items-center justify-between border-b border-surface-border/50 bg-white/80 px-5 backdrop-blur-3xl shadow-premium-sm sm:h-[100px] sm:px-8">
        <div className="flex items-center gap-6">
          {isMobile ? (
            <button onClick={() => setShowChat(false)} className="p-3 bg-surface-alt rounded-2xl text-text-main hover:bg-white transition-all shadow-sm">
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}

          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-xl shadow-premium-md">
              {getInitials(activeParticipant ? emailHandle(activeParticipant.email) : 'U')}
            </div>
          </div>

          <div>
            <h3 className="font-black text-xl text-text-main leading-none mb-1 tracking-tighter uppercase">
              {activeParticipant ? emailHandle(activeParticipant.email) : 'No Conversation'}
            </h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-text-light/60">
              {activeParticipant?.email || 'Select a conversation to begin'}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="h-12 w-12 rounded-2xl bg-surface-alt flex items-center justify-center text-text-light hover:text-primary hover:bg-primary/5 transition-all shadow-sm">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="custom-scrollbar flex flex-grow flex-col gap-8 overflow-y-auto bg-surface-alt/5 p-5 scroll-smooth sm:p-10">
        {pendingRecipient && !selectedConversation ? (
          <div className="rounded-3xl border border-surface-border bg-white p-6 text-sm font-semibold text-text-muted">
            This will start a new conversation with {pendingRecipient.email}.
          </div>
        ) : null}

        {isLoadingMessages ? (
          <div className="text-sm font-semibold text-text-light">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-sm font-semibold text-text-light">
            {pendingRecipient ? 'No messages yet. Send the first message.' : 'No messages in this thread yet.'}
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === user?.id

            return (
              <div
                key={message.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} gap-2 max-w-[85%] md:max-w-[70%] ${isMine ? 'ml-auto' : ''}`}
              >
                <div
                  className={`px-6 py-4 rounded-3xl text-sm leading-relaxed shadow-premium-md flex flex-col gap-1 ${
                    isMine
                      ? 'bg-text-main text-white rounded-tr-none shadow-text-main/10'
                      : 'bg-white text-text-main border border-surface-border/50 rounded-tl-none'
                  }`}
                >
                  {message.attachmentUrl ? (
                    message.attachmentContentType?.startsWith('image/') ? (
                      <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={message.attachmentUrl}
                          alt={message.attachmentName || 'Attachment'}
                          className="mb-2 max-h-64 w-full rounded-2xl object-cover"
                        />
                      </a>
                    ) : (
                      <a
                        href={message.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`mb-2 flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition ${
                          isMine
                            ? 'border-white/15 bg-white/10 hover:bg-white/15'
                            : 'border-surface-border bg-surface-alt/40 hover:bg-surface-alt'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isMine ? 'bg-white/10' : 'bg-white'}`}>
                            <Paperclip className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black uppercase tracking-[0.16em]">
                              {message.attachmentName || 'Attachment'}
                            </p>
                            {message.attachmentSizeBytes ? (
                              <p className={`text-[10px] font-bold ${isMine ? 'text-white/70' : 'text-text-light'}`}>
                                {formatFileSize(message.attachmentSizeBytes)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-[0.16em] ${isMine ? 'text-white/70' : 'text-primary'}`}>
                          Open
                        </span>
                      </a>
                    )
                  ) : null}
                  {message.content ? (
                    <p className="font-medium tracking-tight">{message.content}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 px-2">
                  <span className="text-[9px] font-black text-text-light/40 uppercase tracking-widest">
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMine && message.deliveryState === 'failed' ? (
                    <button
                      type="button"
                      onClick={() => void handleRetry(message)}
                      className="text-[9px] font-black uppercase tracking-widest text-error hover:underline"
                    >
                      Retry
                    </button>
                  ) : null}
                  {isMine ? (
                    <div className="text-primary">
                      {renderDeliveryState(message)}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <footer className="shrink-0 border-t border-surface-border/30 bg-white p-5 sm:p-8">
        {error ? <p className="mb-4 text-sm font-semibold text-error">{error}</p> : null}
        {pendingAttachment ? (
          <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-4 rounded-3xl border border-surface-border bg-surface-alt/40 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-text-main">
                Attachment Ready
              </p>
              <p className="truncate text-sm font-semibold text-text-muted">
                {pendingAttachment.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-text-light">
                {formatFileSize(pendingAttachment.sizeBytes)}
              </span>
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={clearPendingAttachment}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-text-light transition hover:text-error shadow-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex max-w-4xl items-center gap-3 sm:gap-4">
          <input
            ref={attachmentInputRef}
            type="file"
            aria-label="Message attachment"
            accept={evidenceUploadConstraints.supportedContentTypes.join(',')}
            className="hidden"
            onChange={(event) => void handleAttachmentSelected(event)}
          />

          <button
            type="button"
            aria-label="Attach file"
            onClick={handleAttachmentClick}
            disabled={isUploadingAttachment}
            className="h-14 w-14 rounded-2xl bg-surface-alt flex items-center justify-center text-text-light hover:bg-white border border-transparent hover:border-surface-border transition-all shadow-sm disabled:opacity-60"
          >
            {isUploadingAttachment ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </button>

          <div className="flex-grow relative">
            <input
              type="text"
              placeholder={activeParticipant ? `Message ${emailHandle(activeParticipant.email)}...` : 'Type a message...'}
              value={draft}
              onChange={(event) => {
                const nextDraft = event.target.value
                setDraft(nextDraft)
                if (!activeDraftKey) return
                setDrafts((current) => {
                  if (!nextDraft.trim()) {
                    if (!(activeDraftKey in current)) return current
                    const nextDrafts = { ...current }
                    delete nextDrafts[activeDraftKey]
                    return nextDrafts
                  }

                  return {
                    ...current,
                    [activeDraftKey]: nextDraft,
                  }
                })
              }}
              onKeyDown={handleKeyDown}
              className="w-full h-14 rounded-2xl border-none bg-surface-alt/50 px-8 text-sm font-bold focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-text-light/60"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-4 text-text-light/50">
              <Smile className="h-5 w-5 hover:text-primary cursor-pointer transition-colors" />
              <Mic className="h-5 w-5 hover:text-primary cursor-pointer transition-colors" />
            </div>
          </div>

          <button
            onClick={() => void handleSend()}
            aria-label="Send message"
            disabled={(!draft.trim() && !pendingAttachment) || !activeParticipant || isUploadingAttachment}
            className="h-14 w-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all shrink-0 disabled:opacity-40 disabled:hover:scale-100"
          >
            <Send className="h-6 w-6 ml-0.5" />
          </button>
        </div>
      </footer>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-alt/10 pt-24 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] md:pt-28 md:pb-10">
      <div className="container mx-auto h-[calc(100vh-156px)] max-w-7xl overflow-hidden md:h-[calc(100vh-172px)]">
        <div className="flex h-full overflow-hidden rounded-[2rem] border border-surface-border/50 bg-white shadow-premium-2xl md:rounded-[3rem]">
          {(isMobile && !showChat) || !isMobile ? renderSidebar() : null}
          {(isMobile && showChat) || !isMobile ? renderChat() : null}
        </div>
      </div>
    </div>
  )
}
