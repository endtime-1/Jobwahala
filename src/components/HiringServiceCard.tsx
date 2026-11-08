import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Handshake } from 'lucide-react'
import { apiMyHiringRequests } from '../lib/api'
import { STATUS_LABEL, isDone, type RequestSummary } from '../lib/hiring'

/** On the employer dashboard: a button to let JobWahala hire for you, and the open requests. */
export default function HiringServiceCard() {
  const [requests, setRequests] = useState<RequestSummary[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = (await apiMyHiringRequests()) as { requests: RequestSummary[] }
        if (!cancelled) setRequests(data.requests)
      } catch {
        if (!cancelled) setRequests([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const open = (requests ?? []).filter((request) => !isDone(request.status))

  return (
    <section aria-label="Hiring Service" className="dashboard-panel mb-8 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-text-main"><Handshake className="h-4 w-4 text-secondary" aria-hidden /> Hiring Service</h2>
          <p className="mt-1 text-xs font-medium text-text-muted">No time to sift through CVs? A JobWahala recruiter finds and screens candidates for you.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/hiring-service/new" className="btn btn-primary btn-sm justify-center">Let JobWahala hire for you</Link>
          <Link to="/hiring-service" className="btn btn-outline btn-sm justify-center">How it works</Link>
        </div>
      </div>
      {open.length > 0 ? (
        <ul className="mt-4 space-y-2" aria-label="Your hiring requests">
          {open.slice(0, 3).map((request) => (
            <li key={request.id}>
              <Link to={`/hiring-service/${request.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface-alt/50 px-4 py-3 text-sm hover:bg-surface-alt">
                <span className="font-black text-text-main">{request.roleTitle}</span>
                <span className="text-xs font-black uppercase tracking-widest text-secondary">{STATUS_LABEL[request.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
