import { Award } from 'lucide-react'

/** "Founding Employer": one of the first companies to join JobWahala. Not a sign the company has been checked (that is the Verified badge). */
export default function FoundingEmployerBadge({ number, className = '' }: { number?: number | null; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-sm font-black text-primary ${className}`} title="One of the first companies on JobWahala">
      <Award className="h-4 w-4" aria-hidden /> Founding Employer{number ? ` #${number}` : ''}
    </span>
  )
}
