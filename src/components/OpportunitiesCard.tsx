import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserCheck } from 'lucide-react'
import { apiOpportunities } from '../lib/api'
import type { Opportunity } from '../lib/hiring'

/** On the job seeker dashboard: shown only when a recruiter is waiting for an answer. */
export default function OpportunitiesCard() {
  const [waiting, setWaiting] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = (await apiOpportunities()) as { opportunities: Opportunity[] }
        if (!cancelled) setWaiting(data.opportunities.filter((item) => !item.answered).length)
      } catch {
        // Optional.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (waiting === 0) return null
  return (
    <section aria-label="Recruiter requests" className="dashboard-panel flex flex-col gap-3 border-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <p className="flex items-center gap-2 text-sm font-black text-text-main">
        <UserCheck className="h-5 w-5 text-secondary" aria-hidden /> {waiting === 1 ? 'A recruiter has a role for you' : `${waiting} recruiters have roles for you`}
      </p>
      <Link to="/opportunities" className="btn btn-primary btn-sm justify-center">Read and answer</Link>
    </section>
  )
}
