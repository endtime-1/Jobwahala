import { ShieldQuestion } from 'lucide-react'

/**
 * Shown beside jobs from companies that have no approved business verification.
 * Plain on purpose: it informs rather than accuses.
 */
export default function UnverifiedEmployerLabel({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-extrabold text-text-muted ${className}`}
      title="This company has not been verified by JobWahala yet. Take the usual care before sharing personal details."
    >
      <ShieldQuestion className="h-3.5 w-3.5" aria-hidden /> Unverified employer
    </span>
  )
}
