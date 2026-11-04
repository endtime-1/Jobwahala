import { useState } from 'react'
import { CalendarPlus, Clock, Copy, Pause, Pencil, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiDuplicateJob, apiExtendJob, apiUpdateJob, apiUpdateJobStatus } from '../../../lib/api'
import { emailHandle, formatRelativeTime } from '../../../lib/display'
import { getErrorMessage } from '../../../lib/errors'
import { closingSummary, daysUntil, formatClosingDate, latestClosingDate, toDateInputValue } from '../../../lib/jobLifecycle'
import type { EmployerJob } from './types'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Live',
  PAUSED: 'Paused',
  CLOSED: 'Closed',
  EXPIRED: 'Expired',
  FLAGGED: 'Under review',
  SUSPENDED: 'Suspended',
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-success/15 text-success',
  PAUSED: 'bg-gold/25 text-primary',
  EXPIRED: 'bg-error/10 text-error',
  FLAGGED: 'bg-error/10 text-error',
  SUSPENDED: 'bg-error/10 text-error',
}

const EXTEND_OPTIONS = [7, 14, 30, 60, 90]

type Props = {
  job: EmployerJob
  highlighted?: boolean
  onChanged: () => void
  onReviewApplicants: (jobId: string, jobTitle: string) => void
}

export default function EmployerJobCard({ job, highlighted = false, onChanged, onReviewApplicants }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [extendDays, setExtendDays] = useState(30)
  const [form, setForm] = useState({
    title: job.title,
    description: job.description ?? '',
    location: job.location ?? '',
    type: job.type ?? 'Full-time',
    salary: job.salary ?? '',
    category: job.category ?? '',
    closesAt: toDateInputValue(new Date(job.closesAt ?? Date.now())),
  })

  const status = job.status
  const ownerManaged = ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'].includes(status)
  const daysLeft = daysUntil(job.closesAt)
  const pastClosing = daysLeft !== null && daysLeft <= 0
  const closingSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 14
  const showExtend = ownerManaged && (status === 'EXPIRED' || pastClosing || (status !== 'CLOSED' && closingSoon) || highlighted)

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    setBusy(true)
    try {
      await action()
      onChanged()
      return true
    } catch (err) {
      setError(getErrorMessage(err, fallback))
      return false
    } finally {
      setBusy(false)
    }
  }

  const setStatus = (next: string) => run(() => apiUpdateJobStatus(job.id, next), 'Unable to update this job right now.')

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault()
    const saved = await run(
      () =>
        apiUpdateJob(job.id, {
          title: form.title,
          description: form.description,
          location: form.location,
          type: form.type,
          salary: form.salary,
          category: form.category,
          // An expired job gets a new date through Extend.
          ...(status === 'EXPIRED' ? {} : { closesAt: form.closesAt }),
        }),
      'Unable to save your changes right now.',
    )
    if (saved) setEditing(false)
  }

  return (
    <div
      id={`job-${job.id}`}
      className={`rounded-2xl border bg-white p-5 transition-all hover:border-secondary/40 sm:p-6 ${
        highlighted ? 'border-secondary ring-2 ring-secondary/30' : 'border-surface-border'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-extrabold leading-snug tracking-tight text-text-main">{job.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${STATUS_STYLE[status] ?? 'bg-surface-alt text-text-muted'}`}>
              {STATUS_LABEL[status] ?? status}
            </span>
            {job.postedByAdmin ? (
              <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-extrabold text-secondary">Admin assisted</span>
            ) : null}
            <span className="flex items-center gap-1.5 text-sm font-semibold text-text-muted">
              <Clock className="h-3.5 w-3.5" /> {formatRelativeTime(job.createdAt)}
            </span>
          </div>
          {job.closesAt ? (
            <p className={`mt-2 text-sm font-semibold ${pastClosing ? 'text-error' : closingSoon ? 'text-primary' : 'text-text-muted'}`}>
              {status === 'DRAFT' ? `Closing date: ${formatClosingDate(job.closesAt)}` : closingSummary(job.closesAt)}
            </p>
          ) : null}
          {status === 'PAUSED' ? (
            <p className="mt-1 text-sm font-medium text-text-muted">Paused: hidden from search. Your applicants are kept.</p>
          ) : null}
          {status === 'EXPIRED' ? (
            <p className="mt-1 text-sm font-medium text-text-muted">Closed to new applicants. Your applicants are kept. Extend it to hire again.</p>
          ) : null}
          {status === 'DRAFT' ? <p className="mt-1 text-sm font-medium text-text-muted">Draft: only you can see it until you publish.</p> : null}
          {!ownerManaged ? (
            <p className="mt-1 text-sm font-medium text-text-muted">This job is under review by JobWahala, so it cannot be changed right now.</p>
          ) : null}
          {job.postedByAdmin ? (
            <p className="mt-2 text-sm font-semibold text-text-muted">Posted by JobWahala admin / {emailHandle(job.postedByAdmin.email)}</p>
          ) : null}
        </div>
        <div className="rounded-xl bg-surface-alt/70 px-6 py-3 text-center">
          <p className="text-2xl font-black leading-none text-text-main">{job._count.applications}</p>
          <p className="mt-1 text-xs font-bold text-text-muted">Applicants</p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-error/5 px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-surface-border pt-4">
        <button type="button" onClick={() => onReviewApplicants(job.id, job.title)} className="btn btn-primary btn-sm">
          Review Applicants
        </button>
        {status === 'ACTIVE' ? (
          <Link to={`/jobs/${job.id}`} className="btn btn-outline btn-sm bg-white">
            View Role
          </Link>
        ) : null}

        {ownerManaged ? (
          <>
            {status === 'DRAFT' && !pastClosing ? (
              <button type="button" disabled={busy} onClick={() => void setStatus('ACTIVE')} className="btn btn-gold btn-sm disabled:opacity-60">
                Publish
              </button>
            ) : null}
            {status === 'ACTIVE' ? (
              <button type="button" disabled={busy} onClick={() => void setStatus('PAUSED')} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
                <Pause className="h-3.5 w-3.5" /> Pause
              </button>
            ) : null}
            {status === 'PAUSED' && !pastClosing ? (
              <button type="button" disabled={busy} onClick={() => void setStatus('ACTIVE')} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
                <Play className="h-3.5 w-3.5" /> Resume
              </button>
            ) : null}
            {status === 'ACTIVE' || status === 'PAUSED' ? (
              <button type="button" disabled={busy} onClick={() => void setStatus('CLOSED')} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
                Close Role
              </button>
            ) : null}
            {status === 'CLOSED' && !pastClosing ? (
              <button type="button" disabled={busy} onClick={() => void setStatus('ACTIVE')} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
                Reopen Role
              </button>
            ) : null}
            <button type="button" onClick={() => setEditing((open) => !open)} className="btn btn-outline btn-sm bg-white">
              <Pencil className="h-3.5 w-3.5" /> {editing ? 'Cancel edit' : 'Edit'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => apiDuplicateJob(job.id), 'Unable to duplicate this job right now.')}
              className="btn btn-outline btn-sm bg-white disabled:opacity-60"
            >
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </button>
          </>
        ) : null}
      </div>

      {showExtend ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-secondary/5 p-3">
          <CalendarPlus className="h-4 w-4 text-secondary" aria-hidden />
          <label htmlFor={`extend-${job.id}`} className="text-sm font-bold text-text-main">
            Keep it open for
          </label>
          <select
            id={`extend-${job.id}`}
            value={extendDays}
            onChange={(event) => setExtendDays(Number(event.target.value))}
            className="h-10 rounded-lg text-sm font-semibold"
          >
            {EXTEND_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days} more days
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => apiExtendJob(job.id, extendDays), 'Unable to extend this job right now.')}
            className="btn btn-primary btn-sm disabled:opacity-60"
          >
            Extend
          </button>
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={saveEdit} className="mt-4 space-y-4 rounded-xl border border-surface-border bg-surface-alt/30 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm font-bold text-text-main">
              Job title
              <input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} className="h-12 text-base font-semibold" required />
            </label>
            <label className="space-y-1.5 text-sm font-bold text-text-main">
              Where is the job?
              <input value={form.location} onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))} className="h-12 text-base font-semibold" />
            </label>
            <label className="space-y-1.5 text-sm font-bold text-text-main">
              Type of work
              <select value={form.type} onChange={(e) => setForm((c) => ({ ...c, type: e.target.value }))} className="h-12 text-base font-semibold">
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Freelance</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-bold text-text-main">
              Pay
              <input value={form.salary} onChange={(e) => setForm((c) => ({ ...c, salary: e.target.value }))} className="h-12 text-base font-semibold" />
            </label>
            <label className="space-y-1.5 text-sm font-bold text-text-main">
              Field
              <input value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} className="h-12 text-base font-semibold" />
            </label>
            {status === 'EXPIRED' ? null : (
              <label className="space-y-1.5 text-sm font-bold text-text-main">
                Closing date
                <input
                  type="date"
                  value={form.closesAt}
                  min={toDateInputValue(new Date())}
                  max={latestClosingDate()}
                  onChange={(e) => setForm((c) => ({ ...c, closesAt: e.target.value }))}
                  className="h-12 text-base font-semibold"
                  required
                />
              </label>
            )}
          </div>
          <label className="block space-y-1.5 text-sm font-bold text-text-main">
            About the job
            <textarea
              value={form.description}
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
              className="min-h-[140px] py-3 text-base font-semibold"
              required
            />
          </label>
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="btn btn-primary btn-sm px-6 disabled:opacity-60">
              {busy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
