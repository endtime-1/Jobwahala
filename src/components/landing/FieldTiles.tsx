import {
  Banknote,
  Briefcase,
  GraduationCap,
  Headset,
  Laptop,
  Megaphone,
  Sprout,
  Stethoscope,
  Truck,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { buildFieldTiles, buildJobSearchPath } from '../../lib/jobSearch'
import type { LandingJob } from './types'

const ICONS: [RegExp, LucideIcon][] = [
  [/tech|software|it\b|engineer|data/i, Laptop],
  [/sale|business dev/i, Briefcase],
  [/customer|support|call/i, Headset],
  [/financ|account|bank|micro/i, Banknote],
  [/market|media|advert|writ|design/i, Megaphone],
  [/educat|teach|train|school/i, GraduationCap],
  [/health|medic|nurs|pharma/i, Stethoscope],
  [/hotel|hospital|restaurant|tourism|food/i, UtensilsCrossed],
  [/logist|transport|driver|delivery/i, Truck],
  [/agric|farm/i, Sprout],
]

const iconFor = (name: string) => ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? Briefcase

export default function FieldTiles({ jobs }: { jobs: Pick<LandingJob, 'category'>[] }) {
  const tiles = buildFieldTiles(jobs)

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      {tiles.map(({ name, count }) => {
        const Icon = iconFor(name)

        return (
          <Link
            key={name}
            to={buildJobSearchPath('', '', { category: name })}
            className="group flex flex-col gap-4 rounded-2xl border border-surface-border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-premium-md"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary transition-colors group-hover:bg-gold group-hover:text-primary">
              <Icon className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-lg font-extrabold leading-tight text-text-main">{name}</span>
              <span className="mt-1 block text-sm font-semibold text-text-muted">
                {count === null ? 'See open jobs' : `${count} open ${count === 1 ? 'job' : 'jobs'}`}
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
