import { ArrowRight, Check, Smartphone } from 'lucide-react'
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
    sub: 'Find real jobs from employers you can check. See the pay and location before you apply, then track every application in one place.',
    points: [
      'Jobs from companies with real profiles',
      'Know the pay and location before you apply',
      'Free CV builder to help you get noticed',
    ],
    primary: { label: 'Create my free profile', to: '/onboarding?role=seeker' },
    secondary: { label: 'Browse open jobs', to: '/jobs' },
  },
  employer: {
    sub: 'Post your jobs where serious people look. Build a company page people trust, and review every applicant on one simple board.',
    points: [
      'Post a job free and reach people across Africa',
      'A company page that shows candidates who you are',
      'Review applicants in one place, with a fit score',
    ],
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
      <div className="mb-6 hidden items-center gap-2 rounded-full sm:inline-flex border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] font-bold text-white/85">
        <span className="pulse-dot h-2 w-2 rounded-full bg-success" aria-hidden />
        Real jobs · employers you can check · across Africa
      </div>

      <h1 className="max-w-2xl text-[2.7rem] font-black leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-[4.4rem]">
        Work without the <span className="wahala-underline italic text-gold">wahala.</span>
      </h1>

      <div
        role="tablist"
        aria-label="I am looking to"
        className="mt-7 inline-grid grid-cols-2 rounded-2xl border border-white/15 bg-white/10 p-1"
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

      <p className="mt-4 max-w-xl text-base font-medium sm:mt-6 leading-relaxed text-white/75 sm:text-lg" aria-live="polite">
        {copy.sub}
      </p>

      {audience === 'talent' ? <HeroSearch /> : null}

      <ul className="mt-6 space-y-2.5">
        {copy.points.map((point, index) => (
          <li
            key={point}
            className={`items-start gap-3 text-sm font-semibold text-white/90 sm:text-[15px] ${index === 2 ? 'hidden sm:flex' : 'flex'}`}
          >
            <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-gold text-primary">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {point}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link to={copy.primary.to} className="btn btn-gold btn-lg justify-center px-8">
          {copy.primary.label} <ArrowRight className="h-5 w-5" />
        </Link>
        <Link to={copy.secondary.to} className="btn btn-lg justify-center border-white/25 bg-white/10 px-8 text-white hover:bg-white/20">
          {copy.secondary.label}
        </Link>
      </div>

      <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-white/55">
        <Smartphone className="h-4 w-4" /> Free to join · works on any phone · installs like an app
      </p>
    </div>
  )
}
