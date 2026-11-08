import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiStaffRequests } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { STATUS_LABEL, fmtDate, isDone, type StaffRequestRow } from '../../lib/hiring'

/** A recruiter's queue: only the requests assigned to them. */
export default function RecruiterDashboard() {
  const { userName } = useAuth()
  const [rows, setRows] = useState<StaffRequestRow[] | null>(null)
  const [error, setError] = useState('')
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = (await apiStaffRequests()) as { requests: StaffRequestRow[] }
        if (!cancelled) setRows(data.requests)
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'We could not load your requests.'))
          setRows([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const open = (rows ?? []).filter((row) => !isDone(row.status))
  const done = (rows ?? []).filter((row) => isDone(row.status))
  const shown = showDone ? [...open, ...done] : open

  return (
    <div>
      <header className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary">Recruiter</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-text-main">Your requests{userName ? `, ${userName}` : ''}</h1>
        <p className="mt-1 text-sm font-medium text-text-muted">{open.length} open. You see only the requests assigned to you.</p>
      </header>

      {error ? <p role="alert" className="mb-6 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error}</p> : null}
      {rows === null ? <div className="h-40 animate-pulse rounded-3xl bg-surface-alt/60" aria-label="Loading" /> : null}
      {rows && shown.length === 0 ? <p className="rounded-3xl border border-dashed border-surface-border p-8 text-center text-sm font-semibold text-text-muted">No requests are assigned to you yet.</p> : null}

      <ul className="space-y-3" aria-label="Requests">
        {shown.map((row) => (
          <li key={row.id}>
            <Link to={`/recruiter/requests/${row.id}`} className="dashboard-panel flex flex-col gap-3 p-5 transition-colors hover:border-primary lg:flex-row lg:items-center lg:justify-between">
              <span>
                <span className="block text-lg font-black text-text-main">{row.roleTitle}</span>
                <span className="text-xs font-semibold text-text-muted">{row.reference} · {row.company} · {row.location}</span>
              </span>
              <span className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-black uppercase tracking-widest">
                <span className="text-secondary">{STATUS_LABEL[row.status]}</span>
                <span className="text-text-light">{row.pipeline.shortlisted} shortlisted · {row.pipeline.total} in pipeline</span>
                {row.deadline ? <span className="text-text-light">needed by {fmtDate(row.deadline)}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {done.length > 0 ? (
        <button type="button" onClick={() => setShowDone((value) => !value)} className="mt-6 text-sm font-black text-primary hover:underline">
          {showDone ? 'Hide finished requests' : `Show ${done.length} finished ${done.length === 1 ? 'request' : 'requests'}`}
        </button>
      ) : null}
    </div>
  )
}
