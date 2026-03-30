import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiDeleteServiceRequest } from '../../../lib/api'
import { emailHandle, formatRelativeTime, getDisplayName } from '../../../lib/display'
import type { SentServiceRequest } from './types'
import { getApplicationBadgeClass } from './utils'

type Props = {
  sentRequests: SentServiceRequest[]
  onRefresh: () => void
}

export default function EmployerServiceRequests({ sentRequests, onRefresh }: Props) {
  const [isManagingRequests, setIsManagingRequests] = useState(false)
  const [error, setError] = useState('')

  const handleCancelServiceRequest = async (requestId: string) => {
    if (!window.confirm('Cancel this service request?')) return
    setError('')
    setIsManagingRequests(true)
    try {
      await apiDeleteServiceRequest(requestId)
      onRefresh()
    } catch (err: any) {
      setError(err.message || 'Unable to cancel this service request right now.')
    } finally {
      setIsManagingRequests(false)
    }
  }

  return (
    <div className="dashboard-panel p-5 sm:p-6">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-surface-border/50">
        <h2 className="font-black text-xs uppercase tracking-[0.2em] text-text-main">Freelance Requests</h2>
        <span className="badge bg-secondary text-white border-none text-[9px] uppercase tracking-widest">{sentRequests.length}</span>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error}</div>
      ) : null}

      {sentRequests.length === 0 ? (
        <p className="text-sm font-semibold text-text-light">No freelance requests sent yet.</p>
      ) : (
        <div className="space-y-4">
          {sentRequests.slice(0, 4).map((request) => {
            const freelancerName = getDisplayName(
              request.service.freelancer.freelancerProfile?.firstName,
              request.service.freelancer.freelancerProfile?.lastName,
              request.service.freelancer.email,
            )

            return (
              <div key={request.id} className="rounded-2xl border border-surface-border bg-surface-alt/20 p-4">
                <p className="text-sm font-black text-text-main">{request.service.title}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                  {freelancerName || emailHandle(request.service.freelancer.email)} / {formatRelativeTime(request.createdAt)}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className={`badge ${getApplicationBadgeClass(request.status)}`}>{request.status}</span>
                  <div className="flex items-center gap-3">
                    {request.agreement ? (
                      <Link to="/agreements" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Agreement</Link>
                    ) : null}
                    <Link
                      to={`/messaging?userId=${request.service.freelancer.id}&email=${encodeURIComponent(request.service.freelancer.email)}`}
                      className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                    >
                      Message
                    </Link>
                    {request.proposals?.[0] ? (
                      <Link to="/proposals" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Proposal</Link>
                    ) : null}
                    {request.status === 'PENDING' ? (
                      <button
                        type="button"
                        disabled={isManagingRequests}
                        onClick={() => void handleCancelServiceRequest(request.id)}
                        className="text-[10px] font-black uppercase tracking-widest text-error hover:underline disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
