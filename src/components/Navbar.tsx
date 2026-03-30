import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Briefcase,
  ChevronDown,
  FileCheck,
  Handshake,
  LogOut,
  Menu,
  MessageSquare,
  Rocket,
  ShieldCheck,
  UserCircle2,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiGetWorkspaceSignals } from '../lib/api'
import { getInitials } from '../lib/display'
import { subscribeToRealtimeEvents } from '../lib/realtime'
import NotificationCenter from './NotificationCenter'

type NavLinkItem = {
  name: string
  href: string
  icon: ReactNode
}

const seekerLinks: NavLinkItem[] = [
  { name: 'Browse Jobs', href: '/jobs', icon: <Briefcase className="h-4 w-4" /> },
  { name: 'Freelancers', href: '/freelancers', icon: <Users className="h-4 w-4" /> },
  { name: 'Dashboard', href: '/dashboard', icon: <Rocket className="h-4 w-4" /> },
  { name: 'Proposals', href: '/proposals', icon: <Handshake className="h-4 w-4" /> },
  { name: 'Agreements', href: '/agreements', icon: <FileCheck className="h-4 w-4" /> },
  { name: 'CV Generator', href: '/cv-generator', icon: <Rocket className="h-4 w-4" /> },
  { name: 'Messages', href: '/messaging', icon: <MessageSquare className="h-4 w-4" /> },
]

const employerLinks: NavLinkItem[] = [
  { name: 'Browse Jobs', href: '/jobs', icon: <Briefcase className="h-4 w-4" /> },
  { name: 'Find Talent', href: '/freelancers', icon: <Users className="h-4 w-4" /> },
  { name: 'Dashboard', href: '/dashboard', icon: <Rocket className="h-4 w-4" /> },
  { name: 'Proposals', href: '/proposals', icon: <Handshake className="h-4 w-4" /> },
  { name: 'Agreements', href: '/agreements', icon: <FileCheck className="h-4 w-4" /> },
  { name: 'Messages', href: '/messaging', icon: <MessageSquare className="h-4 w-4" /> },
]

const freelancerLinks: NavLinkItem[] = [
  { name: 'Browse Jobs', href: '/jobs', icon: <Briefcase className="h-4 w-4" /> },
  { name: 'Marketplace', href: '/freelancers', icon: <Users className="h-4 w-4" /> },
  { name: 'Dashboard', href: '/dashboard', icon: <Rocket className="h-4 w-4" /> },
  { name: 'Proposals', href: '/proposals', icon: <Handshake className="h-4 w-4" /> },
  { name: 'Agreements', href: '/agreements', icon: <FileCheck className="h-4 w-4" /> },
  { name: 'Messages', href: '/messaging', icon: <MessageSquare className="h-4 w-4" /> },
]

const adminLinks: NavLinkItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: <ShieldCheck className="h-4 w-4" /> },
  { name: 'Browse Jobs', href: '/jobs', icon: <Briefcase className="h-4 w-4" /> },
  { name: 'Freelancers', href: '/freelancers', icon: <Users className="h-4 w-4" /> },
]

const guestLinks: NavLinkItem[] = [
  { name: 'Browse Jobs', href: '/jobs', icon: <Briefcase className="h-4 w-4" /> },
  { name: 'Freelancers', href: '/freelancers', icon: <Users className="h-4 w-4" /> },
]

const pendingSetupLinks: NavLinkItem[] = [
  { name: 'Complete Setup', href: '/onboarding', icon: <UserCircle2 className="h-4 w-4" /> },
]

const guestDockLinks: NavLinkItem[] = [
  { name: 'Jobs', href: '/jobs', icon: <Briefcase className="h-4 w-4" /> },
  { name: 'Talent', href: '/freelancers', icon: <Users className="h-4 w-4" /> },
  { name: 'Log In', href: '/login', icon: <MessageSquare className="h-4 w-4" /> },
  { name: 'Join', href: '/signup', icon: <Rocket className="h-4 w-4" /> },
]

const initialWorkspaceSignals = {
  unreadMessages: 0,
  pendingProposalActions: 0,
  pendingAgreementActions: 0,
}

const getBadgeKeyForHref = (href: string) => {
  if (href === '/messaging') return 'messaging'
  if (href === '/proposals') return 'proposals'
  if (href === '/agreements') return 'agreements'
  return null
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [workspaceSignals, setWorkspaceSignals] = useState(initialWorkspaceSignals)
  const { user, role, logout, isOnboarded, userName, userEmail } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const accountMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setIsOpen(false)
    setShowAccountMenu(false)
  }, [location.pathname])

  const loadWorkspaceSignals = async () => {
    if (!user || !isOnboarded || role === 'ADMIN') {
      setWorkspaceSignals(initialWorkspaceSignals)
      return
    }

    try {
      const data = await apiGetWorkspaceSignals()
      setWorkspaceSignals({
        unreadMessages: Number(data.unreadMessages || 0),
        pendingProposalActions: Number(data.pendingProposalActions || 0),
        pendingAgreementActions: Number(data.pendingAgreementActions || 0),
      })
    } catch {
      setWorkspaceSignals(initialWorkspaceSignals)
    }
  }

  useEffect(() => {
    void loadWorkspaceSignals()
  }, [user?.id, isOnboarded, role])

  useEffect(() => {
    if (!user || !isOnboarded || role === 'ADMIN') return

    return subscribeToRealtimeEvents({
      onMessagesRefresh: () => {
        void loadWorkspaceSignals()
      },
      onProposalsRefresh: () => {
        void loadWorkspaceSignals()
      },
      onAgreementsRefresh: () => {
        void loadWorkspaceSignals()
      },
    })
  }, [user?.id, isOnboarded, role])

  const initials = getInitials(userName)
  const roleLabel = role ? role.replace('_', ' ') : 'Guest'
  const shellAttentionCount =
    workspaceSignals.unreadMessages +
    workspaceSignals.pendingProposalActions +
    workspaceSignals.pendingAgreementActions

  const getLinkBadgeCount = (href: string) => {
    if (href === '/messaging') return workspaceSignals.unreadMessages
    if (href === '/proposals') return workspaceSignals.pendingProposalActions
    if (href === '/agreements') return workspaceSignals.pendingAgreementActions
    return 0
  }

  const currentLinks = useMemo(() => {
    if (!user) return guestLinks
    if (!isOnboarded) return pendingSetupLinks
    if (role === 'SEEKER') return seekerLinks
    if (role === 'EMPLOYER') return employerLinks
    if (role === 'FREELANCER') return freelancerLinks
    if (role === 'ADMIN') return adminLinks
    return guestLinks
  }, [isOnboarded, role, user])

  const mobileDockLinks = useMemo(() => {
    if (!user) return guestDockLinks
    if (!isOnboarded) return pendingSetupLinks
    if (role === 'SEEKER') {
      return [
        { name: 'Jobs', href: '/jobs', icon: <Briefcase className="h-4 w-4" /> },
        { name: 'Talent', href: '/freelancers', icon: <Users className="h-4 w-4" /> },
        { name: 'Hub', href: '/dashboard', icon: <Rocket className="h-4 w-4" /> },
        { name: 'Deals', href: '/proposals', icon: <Handshake className="h-4 w-4" /> },
      ]
    }

    if (role === 'EMPLOYER') {
      return [
        { name: 'Jobs', href: '/jobs', icon: <Briefcase className="h-4 w-4" /> },
        { name: 'Talent', href: '/freelancers', icon: <Users className="h-4 w-4" /> },
        { name: 'Hub', href: '/dashboard', icon: <Rocket className="h-4 w-4" /> },
        { name: 'Deals', href: '/proposals', icon: <Handshake className="h-4 w-4" /> },
      ]
    }

    if (role === 'FREELANCER') {
      return [
        { name: 'Jobs', href: '/jobs', icon: <Briefcase className="h-4 w-4" /> },
        { name: 'Hub', href: '/dashboard', icon: <Rocket className="h-4 w-4" /> },
        { name: 'Deals', href: '/proposals', icon: <Handshake className="h-4 w-4" /> },
        { name: 'Work', href: '/agreements', icon: <FileCheck className="h-4 w-4" /> },
      ]
    }

    if (role === 'ADMIN') {
      return [
        { name: 'Hub', href: '/dashboard', icon: <ShieldCheck className="h-4 w-4" /> },
        { name: 'Jobs', href: '/jobs', icon: <Briefcase className="h-4 w-4" /> },
        { name: 'Talent', href: '/freelancers', icon: <Users className="h-4 w-4" /> },
      ]
    }

    return guestDockLinks
  }, [isOnboarded, role, user])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const renderLinkBadge = (href: string) => {
    const badgeKey = getBadgeKeyForHref(href)
    const count = getLinkBadgeCount(href)

    if (!badgeKey || count <= 0) return null

    return (
      <span
        data-testid={`nav-badge-${badgeKey}`}
        className="inline-flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-error px-1.5 text-[9px] font-black text-white"
      >
        {count > 99 ? '99+' : count}
      </span>
    )
  }

  const renderDockBadge = (href: string) => {
    const badgeKey = getBadgeKeyForHref(href)
    const count = getLinkBadgeCount(href)

    if (!badgeKey || count <= 0) return null

    return (
      <span
        data-testid={`nav-badge-${badgeKey}`}
        className="absolute -right-1 -top-1 inline-flex min-h-[1rem] min-w-[1rem] items-center justify-center rounded-full bg-error px-1 text-[8px] font-black text-white"
      >
        {count > 99 ? '99+' : count}
      </span>
    )
  }

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-5 xl:px-8">
        <div className="container">
          <div className="glass rounded-[1.9rem] border border-white/50 shadow-premium px-4 py-3 md:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex shrink-0 items-center gap-3 overflow-hidden">
                <Link to="/" className="flex min-w-0 shrink-0 items-center gap-3 group">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#101a2b_0%,#2f6df6_100%)] text-white shadow-premium-md transition-transform group-hover:-rotate-6">
                    <Rocket className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="whitespace-nowrap text-base font-black tracking-tight text-text-main md:text-lg">
                      Job<span className="text-secondary">Wahala</span>
                    </p>
                    <p className="hidden whitespace-nowrap text-[10px] font-black uppercase tracking-[0.24em] text-text-light sm:block">
                      {user ? (isOnboarded ? roleLabel : 'Setup in progress') : 'AI talent workspace'}
                    </p>
                  </div>
                </Link>
              </div>

              <div className="hidden xl:flex xl:min-w-0 xl:flex-1 xl:items-center xl:justify-end xl:gap-2">
                <div className="nav-links-rail mr-2 flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-white/55 p-1">
                  {currentLinks.map((link) => (
                    <Link
                      key={link.name}
                      to={link.href}
                      className={`nav-link ${location.pathname === link.href ? 'active shadow-premium-sm' : ''}`}
                    >
                      {link.icon}
                      <span>{link.name}</span>
                      {renderLinkBadge(link.href)}
                    </Link>
                  ))}
                </div>

                {!user ? (
                  <div className="flex items-center gap-2">
                    <Link to="/login" className="btn btn-outline btn-sm">
                      Log In
                    </Link>
                    <Link to="/signup" className="btn btn-primary btn-sm">
                      Sign Up
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <NotificationCenter />
                    <div className="relative" ref={accountMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowAccountMenu((current) => !current)}
                        className="flex items-center gap-3 rounded-full border border-white/60 bg-white/76 px-2 py-1.5 shadow-premium-sm transition-transform hover:-translate-y-0.5"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#101a2b_0%,#2f6df6_100%)] text-[11px] font-black text-white">
                          {initials}
                        </div>
                        <div className="text-left">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-text-main">
                            {userName || 'Workspace'}
                          </p>
                          <p className="text-[10px] font-bold text-text-light">{roleLabel}</p>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-text-light transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} />
                      </button>

                      {showAccountMenu ? (
                        <div className="absolute right-0 mt-3 nav-dropdown border border-white/60 shadow-premium-lg">
                          <div className="border-b border-surface-border bg-white/70 px-5 py-4">
                            <p className="text-sm font-black text-text-main">{userName || 'User'}</p>
                            <p className="mt-1 text-xs font-medium text-text-muted">{userEmail}</p>
                            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.22em] text-secondary">{roleLabel}</p>
                          </div>

                          <div className="p-2">
                            {!isOnboarded ? (
                              <Link
                                to="/onboarding"
                                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-black text-text-main transition-colors hover:bg-surface-alt/70"
                              >
                                <UserCircle2 className="h-4 w-4" /> Complete Setup
                              </Link>
                            ) : (
                              <Link
                                to="/dashboard"
                                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-black text-text-main transition-colors hover:bg-surface-alt/70"
                              >
                                <Rocket className="h-4 w-4" /> Open Dashboard
                              </Link>
                            )}
                          </div>

                          <div className="border-t border-surface-border bg-white/66 p-2">
                            <button
                              type="button"
                              onClick={handleLogout}
                              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-black text-error transition-colors hover:bg-error/8"
                            >
                              <LogOut className="h-4 w-4" /> Logout
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 xl:hidden">
                {user ? (
                  <>
                    <NotificationCenter compact />
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#101a2b_0%,#2f6df6_100%)] text-[11px] font-black text-white shadow-premium-sm">
                      {initials}
                    </div>
                  </>
                ) : (
                  <Link to="/login" className="btn btn-outline btn-sm px-4">
                    Log In
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen((current) => !current)}
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/76 text-text-main shadow-premium-sm"
                >
                  {shellAttentionCount > 0 ? (
                    <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-error" />
                  ) : null}
                  {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {isOpen ? (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-[#101a2b]/24 backdrop-blur-md"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border-t border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,247,251,0.98)_100%)] px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 shadow-premium-xl">
            <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-surface-border" />

            <div className="mb-6 flex items-center justify-between gap-3 rounded-[1.6rem] border border-white/60 bg-white/78 px-4 py-4 shadow-premium-sm">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-light">
                  {user ? roleLabel : 'Guest mode'}
                </p>
                <p className="mt-1 truncate text-base font-black text-text-main">
                  {user ? userName || userEmail || 'Workspace' : 'Explore the network'}
                </p>
              </div>
              {user ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#101a2b_0%,#2f6df6_100%)] text-sm font-black text-white shadow-premium-sm">
                  {initials}
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-secondary">
                  <Rocket className="h-5 w-5" />
                </div>
              )}
            </div>

            <div className="mb-6 rounded-[1.6rem] border border-white/60 bg-white/74 p-2 shadow-premium-sm">
              <div className="grid grid-cols-2 gap-2">
                {currentLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.href}
                    className={`flex items-center gap-3 rounded-[1.15rem] px-4 py-4 text-sm font-bold transition-all ${
                      location.pathname === link.href
                        ? 'bg-[linear-gradient(135deg,#101a2b_0%,#2f6df6_100%)] text-white shadow-premium-sm'
                        : 'bg-surface-alt/45 text-text-main'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${location.pathname === link.href ? 'bg-white/16' : 'bg-white'}`}>
                      {link.icon}
                    </div>
                    <span className="leading-tight">{link.name}</span>
                    {renderLinkBadge(link.href)}
                  </Link>
                ))}
              </div>
            </div>

            {!user ? (
              <div className="grid grid-cols-2 gap-3">
                <Link to="/login" className="btn btn-outline w-full">
                  Log In
                </Link>
                <Link to="/signup" className="btn btn-primary w-full">
                  Sign Up
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {!isOnboarded ? (
                  <Link to="/onboarding" className="btn btn-outline w-full">
                    Complete Setup
                  </Link>
                ) : null}
                <button type="button" onClick={handleLogout} className="btn w-full bg-error/10 text-error">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.65rem)] z-40 xl:hidden">
        <div className="mx-auto w-[min(calc(100%-1rem),36rem)]">
          <div className="glass rounded-[1.8rem] border border-white/60 px-2 py-2 shadow-premium-lg">
            <div
              className={`grid gap-1 ${
                mobileDockLinks.length === 1
                  ? 'grid-cols-1'
                  : mobileDockLinks.length === 3
                    ? 'grid-cols-3'
                    : 'grid-cols-4'
              }`}
            >
              {mobileDockLinks.map((link) => {
                const active = location.pathname === link.href

                return (
                  <Link
                    key={link.name}
                    to={link.href}
                    className={`flex flex-col items-center justify-center gap-1 rounded-[1.1rem] px-2 py-3 text-center transition-all ${
                      active
                        ? 'bg-[linear-gradient(135deg,#101a2b_0%,#2f6df6_100%)] text-white shadow-premium-sm'
                        : 'text-text-muted'
                    }`}
                  >
                    <span className={`relative flex h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-white/14' : 'bg-white/74'}`}>
                      {link.icon}
                      {renderDockBadge(link.href)}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.16em]">{link.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
