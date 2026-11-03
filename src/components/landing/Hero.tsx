import { ArrowRight, Check, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Audience } from './types'

const COPY: Record<
  Audience,
  {
    sub: string
    points: string[]
    primary: { label: string; to: string }
    secondary: { label: string; to: string }
  }
> = {
  talent: {
    sub: 'Find jobs and freelance gigs across Africa. Every paid project is held in escrow before you start, then paid out to your mobile money or bank.',
    points: [
      'Payment is secured before you lift a finger',
      'Cash out to mobile money or your bank',
      'Free AI CV builder and proposal help',
    ],
    primary: { label: 'Create my free profile', to: '/onboarding?role=seeker' },
    secondary: { label: 'Browse open jobs', to: '/jobs' },
  },
  employer: {
    sub: 'Hire people you can trust. Fund a milestone, watch the work happen, and release payment only when you are happy.',
    points: [
      'Pay only for work you approve',
      'ID-verified professionals, with reviews you can read',
      'Post a role in minutes - AI drafts it for you',
    ],
    primary: { label: 'Post a job for free', to: '/onboarding?role=employer' },
    secondary: { label: 'Find freelancers', to: '/freelancers' },
  },
}

type HeroProps = {
  audience: Audience
  onAudienceChange: (audience: Audience) => void
}

export default function Hero({ audience, onAudienceChange }: HeroProps) {
  const copy = COPY[audience]

  return (
    <div>
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-surface-border bg-white/80 px-3 py-1.5 text-[11px] font-bold tracking-wide text-text-muted shadow-premium-sm">
        <span className="pulse-dot h-2 w-2 rounded-full bg-success" aria-hidden />
        Built for Africa · escrow-protected payments
      </div>

      <h1 className="max-w-2xl text-[2.6rem] font-black leading-[1.02] tracking-tight text-text-main sm:text-6xl lg:text-[4.25rem]">
        Work without the <span className="wahala-underline italic text-secondary">wahala.</span>
      </h1>

      <div
        role="tablist"
        aria-label="I am looking to"
        className="mt-7 inline-grid grid-cols-2 rounded-2xl border border-surface-border bg-white/80 p-1 shadow-premium-sm"
      >
        {(
          [
            ['talent', 'I want work'],
            ['employer', 'I want to hire'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={audience === value}
            onClick={() => onAudienceChange(value)}
            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-bold transition-all sm:px-6 ${
              audience === value ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-main'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-text-muted sm:text-lg" aria-live="polite">
        {copy.sub}
      </p>

      <ul className="mt-6 space-y-2.5">
        {copy.points.map((point) => (
          <li key={point} className="flex items-start gap-3 text-sm font-semibold text-text-main sm:text-[15px]">
            <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {point}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link to={copy.primary.to} className="btn btn-primary btn-lg justify-center px-8">
          {copy.primary.label} <ArrowRight className="h-5 w-5" />
        </Link>
        <Link to={copy.secondary.to} className="btn btn-outline btn-lg justify-center px-8">
          {copy.secondary.label}
        </Link>
      </div>

      <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-text-light">
        <Smartphone className="h-4 w-4" /> Free to join · works on any phone · installs like an app
      </p>
    </div>
  )
}
