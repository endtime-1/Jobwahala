import { useEffect, useState } from 'react'
import { ArrowRight, Download, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buildWhatsAppInvite } from './types'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function FinalCta() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }
    const onInstalled = () => setInstallEvent(null)

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }

  return (
    <div className="overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary via-[#14306b] to-secondary-dark text-white shadow-premium-2xl">
      <div className="heritage-strip" aria-hidden />
      <div className="px-6 py-12 text-center sm:px-12 sm:py-16">
        <h2 className="mx-auto max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
          Your next job - or your next hire - shouldn&apos;t cost you sleep.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base font-medium text-white/75">
          Join free in about a minute. Money stays protected until the work is done.
        </p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            to="/onboarding?role=seeker"
            className="btn btn-lg justify-center bg-white px-8 text-primary shadow-premium-lg hover:bg-white/90"
          >
            I want work <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            to="/onboarding?role=employer"
            className="btn btn-lg justify-center border border-white/30 bg-white/10 px-8 text-white hover:bg-white/20"
          >
            I want to hire
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={buildWhatsAppInvite(typeof window === 'undefined' ? 'https://www.jobwahala.com' : window.location.origin)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-bold text-white/90 hover:bg-white/10"
          >
            <Share2 className="h-4 w-4" /> Invite a friend on WhatsApp
          </a>
          {installEvent && (
            <button
              type="button"
              onClick={() => void install()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-bold text-white/90 hover:bg-white/10"
            >
              <Download className="h-4 w-4" /> Install the app
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function LegalLinks() {
  return (
    <nav aria-label="Legal and help" className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-text-muted">
      <Link to="/terms" className="hover:text-text-main">Terms</Link>
      <Link to="/privacy" className="hover:text-text-main">Privacy</Link>
      <Link to="/support" className="hover:text-text-main">Support</Link>
      <Link to="/blog" className="hover:text-text-main">Blog</Link>
    </nav>
  )
}
