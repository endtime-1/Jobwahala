import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { siteCopy } from '../../content/siteCopy'
import HeroSearch from './HeroSearch'

const POINTS = ['Company pages', 'Pay shown up front', 'Free to apply and to post']

export default function Hero() {
  return (
    <div>
      <p className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-gold sm:text-[13px]">
        <span className="pulse-dot h-2 w-2 rounded-full bg-success" aria-hidden />
        The job portal for Africa
      </p>

      <h1 className="max-w-2xl text-[2.7rem] font-black leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-[4.2rem]">
        Work without the <span className="wahala-underline italic text-gold">wahala.</span>
      </h1>

      <p className="mt-5 max-w-lg text-lg font-medium leading-snug text-white/80 sm:text-xl">
        {siteCopy.heroText}
      </p>

      <HeroSearch />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link to="/jobs" className="btn btn-gold btn-lg justify-center px-8">
          Find a job <ArrowRight className="h-5 w-5" />
        </Link>
        <Link
          to="/onboarding?role=employer"
          className="btn btn-lg justify-center border border-white/30 bg-white/10 px-8 text-white hover:bg-white/20"
        >
          Post a job free
        </Link>
      </div>

      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        {POINTS.map((point) => (
          <li key={point} className="flex items-center gap-2 text-sm font-semibold text-white/75">
            <Check className="h-4 w-4 text-gold" strokeWidth={3} />
            {point}
          </li>
        ))}
      </ul>
    </div>
  )
}
