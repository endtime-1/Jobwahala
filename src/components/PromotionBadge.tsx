import { Flame, Star } from 'lucide-react'
import { promotionLabel } from '../lib/billing'

/** "Urgently hiring" or "Featured" on a job that has a paid promotion running. Nothing on any other job. */
export default function PromotionBadge({ promotion }: { promotion?: string | null }) {
  const label = promotionLabel(promotion)
  if (!label) return null

  const urgent = promotion === 'URGENT'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${urgent ? 'bg-error/10 text-error' : 'bg-gold text-primary'}`}>
      {urgent ? <Flame className="h-3 w-3" aria-hidden /> : <Star className="h-3 w-3" aria-hidden />}
      {label}
    </span>
  )
}
