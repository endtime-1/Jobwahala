import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import HeroSearch from './HeroSearch'
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
    sub: 'Real jobs from employers you can check. See the pay and location before you apply.',
    points: ['Company pages', 'Pay shown up front', 'Free CV builder'],
    primary: { label: 'Create my free profile', to: '/onboarding?role=seeker' },
    secondary: { label: 'Browse open jobs', to: '/jobs' },
  },
  employer: {
    sub: 'Post your jobs where serious people look, and review every applicant on one simple board.',
    points: ['Post a job free', 'Your own company page', 'Applicants scored for fit'],
    primary: { label: 'Post a job for free', to: '/onboarding?role=employer' },
    secondary: { label: 'See open jobs', to: '/jobs' },
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
      <p className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-gold sm:text-[13px]">
        <span className="pulse-dot h-2 w-2 rounded-full bg-success" aria-hidden />
        The job portal for Africa
      </p>

      <h1 className="max-w-2xl text-[2.7rem] font-black leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-[4.2rem]">
        Work without the <span className="wahala-underline italic text-gold">wahala.</span>
      </h1>

      <p className="mt-5 max-w-lg text-lg font-medium leading-snug text-white/80 sm:text-xl" aria-live="polite">
        {copy.sub}
      </p>

      <div
        role="tablist"
        aria-label="I am looking to"
        className="mt-6 inline-grid grid-cols-2 rounded-2xl border border-white/15 bg-white/10 p-1"
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
              audience === value ? 'bg-gold text-primary shadow-md' : 'text-white/75 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {audience === 'talent' ? <HeroSearch /> : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <Link to={copy.primary.to} className="btn btn-gold btn-lg justify-center px-8">
          {copy.primary.label} <ArrowRight className="h-5 w-5" />
        </Link>
        <Link
          to={copy.secondary.to}
          className="inline-flex items-center justify-center gap-1.5 text-[15px] font-bold text-white underline decoration-white/40 underline-offset-4 hover:decoration-gold"
        >
          {copy.secondary.label}
        </Link>
      </div>

      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        {copy.points.map((point) => (
          <li key={point} className="flex items-center gap-2 text-sm font-semibold text-white/75">
            <Check className="h-4 w-4 text-gold" strokeWidth={3} />
            {point}
          </li>
        ))}
      </ul>
    </div>
  )
}
