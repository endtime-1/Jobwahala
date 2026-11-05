import { Clock, Handshake } from 'lucide-react'
import { earlyCareerFacts, isEarlyCareerType, stipendLabel, type EarlyCareerDetails } from '../lib/earlyCareer'

/** Duration, hours, start and stipend for an early-career job. Shows nothing for other jobs. */
export default function EarlyCareerChips({ job }: { job: EarlyCareerDetails }) {
  if (!isEarlyCareerType(job.type)) return null

  const facts = earlyCareerFacts(job)

  return (
    <ul className="flex flex-wrap gap-2 text-sm font-bold text-text-muted" aria-label="Early-career details">
      <li className={`rounded-full px-3 py-1 ${job.unpaid ? 'bg-surface-alt text-text-main' : 'bg-success/10 text-success'}`}>
        {job.unpaid ? 'Unpaid' : job.salary?.trim() ? `Stipend: ${stipendLabel(job)}` : 'Stipend not stated'}
      </li>
      {facts.map((fact) => (
        <li key={fact} className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-3 py-1">
          <Clock className="h-3.5 w-3.5 text-secondary" aria-hidden /> {fact}
        </li>
      ))}
      {job.possibleJobOffer ? (
        <li className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-primary">
          <Handshake className="h-3.5 w-3.5" aria-hidden /> Possible job offer after
        </li>
      ) : null}
    </ul>
  )
}
