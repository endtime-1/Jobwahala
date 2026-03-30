import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CheckCheck, ClipboardList, FileCheck, Handshake, Wallet, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiGetMyNotifications, apiGetNotificationSummary, apiMarkAllNotificationsRead, apiMarkNotificationRead } from '../lib/api'
import { formatRelativeTime } from '../lib/display'
import { subscribeToRealtimeEvents } from '../lib/realtime'
import { useAuth } from '../context/AuthContext'

type NotificationCenterProps = {
  compact?: boolean
}

type NotificationRecord = {
  id: string
  type: string
  title: string
  message: string
  actionUrl?: string | null
  read: boolean
  readAt?: string | null
  createdAt: string
}

const getNotificationIcon = (type: string) => {
  if (type.includes('PROPOSAL')) return <Handshake className="h-4 w-4" />
  if (type.includes('PAYMENT')) return <Wallet className="h-4 w-4" />
  if (type.includes('MILESTONE') || type.includes('AGREEMENT')) return <FileCheck className="h-4 w-4" />
  return <ClipboardList className="h-4 w-4" />
}

export default function NotificationCenter({ compact = false }: NotificationCenterProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [error, setError] = useState('')
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const loadNotifications = async () => {
    if (!user) return

    setIsLoading(true)

    try {
      const data = await apiGetMyNotifications(12)
      setNotifications((data.notifications || []) as NotificationRecord[])
      setUnreadCount(Number(data.unreadCount || 0))
      setError('')
    } catch (err: any) {
      setError(err.message || 'Unable to load notifications right now.')
    } finally {
      setIsLoading(false)
    }
  }

  const loadNotificationSummary = async () => {
    if (!user) return

    try {
      const data = await apiGetNotificationSummary()
      setUnreadCount(Number(data.unreadCount || 0))
      setError('')
    } catch (err: any) {
      setError(err.message || 'Unable to refresh notifications right now.')
    }
  }

  useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      setIsOpen(false)
      return
    }

    void loadNotificationSummary()

    const intervalId = window.setInterval(() => {
      if (isOpen) {
        void loadNotifications()
      } else {
        void loadNotificationSummary()
      }
    }, 45000)

    return () => window.clearInterval(intervalId)
  }, [isOpen, user?.id])

  useEffect(() => {
    if (!user) return

    return subscribeToRealtimeEvents({
      onNotificationsRefresh: () => {
        if (isOpen) {
          void loadNotifications()
        } else {
          void loadNotificationSummary()
        }
      },
    })
  }, [isOpen, user?.id])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort((left, right) => {
        if (left.read !== right.read) {
          return left.read ? 1 : -1
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      }),
    [notifications],
  )

  const handleToggle = () => {
    const nextOpen = !isOpen
    setIsOpen(nextOpen)

    if (nextOpen) {
      void loadNotifications()
    }
  }

  const handleNotificationClick = async (notification: NotificationRecord) => {
    try {
      if (!notification.read) {
        const data = await apiMarkNotificationRead(notification.id)
        setUnreadCount(Number(data.unreadCount || 0))
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  read: true,
                  readAt: new Date().toISOString(),
                }
              : item,
          ),
        )
      }
    } catch (err: any) {
      setError(err.message || 'Unable to mark this notification as read.')
      return
    }

    if (notification.actionUrl) {
      navigate(notification.actionUrl)
      setIsOpen(false)
    }
  }

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true)

    try {
      await apiMarkAllNotificationsRead()
      setUnreadCount(0)
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read: true,
          readAt: notification.readAt || new Date().toISOString(),
        })),
      )
      setError('')
    } catch (err: any) {
      setError(err.message || 'Unable to mark notifications as read right now.')
    } finally {
      setIsMarkingAll(false)
    }
  }

  if (!user) return null

  if (compact) {
    return (
      <div ref={panelRef} className="relative">
        <button
          type="button"
          aria-label="Open notifications"
          onClick={handleToggle}
          className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/76 text-text-main shadow-premium-sm"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-error px-1 text-[9px] font-black text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>

        {isOpen ? (
          <div className="fixed inset-0 z-[60]">
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-[#101a2b]/28 backdrop-blur-md"
            />
            <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border-t border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(244,247,251,0.99)_100%)] px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 shadow-premium-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="mx-auto h-1.5 w-16 rounded-full bg-surface-border" />
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-surface-border bg-white text-text-light"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <NotificationPanel
                notifications={sortedNotifications}
                unreadCount={unreadCount}
                isLoading={isLoading}
                isMarkingAll={isMarkingAll}
                error={error}
                onRefresh={() => void loadNotifications()}
                onMarkAllRead={() => void handleMarkAllRead()}
                onNotificationClick={(notification) => void handleNotificationClick(notification)}
              />
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={panelRef} className="relative">
        <button
          type="button"
          aria-label="Open notifications"
          onClick={handleToggle}
          className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/76 text-text-main shadow-premium-sm"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-error px-1 text-[9px] font-black text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>

        {isOpen ? (
          <div className="absolute right-0 mt-3 w-[24rem] rounded-[1.7rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,247,251,0.98)_100%)] p-4 shadow-premium-xl">
            <NotificationPanel
              notifications={sortedNotifications}
              unreadCount={unreadCount}
              isLoading={isLoading}
              isMarkingAll={isMarkingAll}
              error={error}
              onRefresh={() => void loadNotifications()}
              onMarkAllRead={() => void handleMarkAllRead()}
                onNotificationClick={(notification) => void handleNotificationClick(notification)}
              />
          </div>
        ) : null}
    </div>
  )
}

type NotificationPanelProps = {
  notifications: NotificationRecord[]
  unreadCount: number
  isLoading: boolean
  isMarkingAll: boolean
  error: string
  onRefresh: () => void
  onMarkAllRead: () => void
  onNotificationClick: (notification: NotificationRecord) => void
}

function NotificationPanel({
  notifications,
  unreadCount,
  isLoading,
  isMarkingAll,
  error,
  onRefresh,
  onMarkAllRead,
  onNotificationClick,
}: NotificationPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 border-b border-surface-border/60 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Notification Center</p>
          <h2 className="mt-2 text-lg font-black tracking-tight text-text-main">Workflow updates</h2>
          <p className="mt-1 text-xs font-medium text-text-muted">
            {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={onRefresh}
            className="rounded-xl border border-surface-border bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted disabled:opacity-60"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={isMarkingAll || unreadCount === 0}
            onClick={onMarkAllRead}
            className="rounded-xl border border-primary/10 bg-primary/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCheck className="h-3.5 w-3.5" /> Read all
            </span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </div>
      ) : null}

      <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
        {isLoading && notifications.length === 0 ? (
          <div className="rounded-2xl border border-surface-border bg-white px-4 py-5 text-sm font-semibold text-text-light">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-surface-border bg-white px-4 py-5 text-sm font-semibold text-text-light">
            No notifications yet.
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => onNotificationClick(notification)}
              className={`w-full rounded-[1.4rem] border px-4 py-4 text-left transition-all ${
                notification.read
                  ? 'border-surface-border bg-white'
                  : 'border-primary/10 bg-primary/5 shadow-premium-sm'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${
                    notification.read ? 'bg-surface-alt text-text-muted' : 'bg-primary text-white'
                  }`}
                >
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-black text-text-main">{notification.title}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{notification.message}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
