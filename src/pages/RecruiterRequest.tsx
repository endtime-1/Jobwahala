import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Search, Send } from 'lucide-react'
import SEO from '../components/SEO'
import EvidenceLink from '../components/EvidenceLink'
import { useAuth } from '../context/AuthContext'
import {
  apiStaffAddCandidate,
  apiStaffAskConsent,
  apiStaffCreateJob,
  apiStaffDropCandidate,
  apiStaffHireStart,
  apiStaffImportApplicants,
  apiStaffNote,
  apiStaffOpenCandidate,
  apiStaffRequest,
  apiStaffSearch,
  apiStaffSend,
  apiStaffSetStatus,
  apiStaffShortlist,
  apiStaffUpdateCandidate,
} from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { STAGE_LABEL, STATUS_LABEL, fmtDate, guaranteeLabel, salaryLabel, type StaffCandidate, type StaffRequestDetail } from '../lib/hiring'

type SearchEntry = { id: string; headline: string; skills: string; experienceSummary: string; location: string | null; yearsExperience: number | null; hasVerifiedCertificate: boolean; relevance: number }

const input = 'mt-1 w-full rounded-xl border border-surface-border bg-white px-3 py-2 text-sm font-semibold text-text-main outline-none focus:border-primary'
const labelClass = 'block text-[10px] font-black uppercase tracking-[0.2em] text-text-light'
const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const WORK_STATUSES = ['AGREED', 'SOURCING', 'INTERVIEWING'] as const

/** The recruiter's workbench for one request: the brief, the job post, the pipeline, screening, sourcing and sending the shortlist. Admins can use it too. */
export default function RecruiterRequest() {
  const { id = '' } = useParams()
  const { role } = useAuth()
  const [detail, setDetail] = useState<StaffRequestDetail | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [noteVisibility, setNoteVisibility] = useState<'STAFF' | 'CLIENT'>('STAFF')
  const [publish, setPublish] = useState(false)

  const load = useCallback(async () => {
    try {
      setDetail((await apiStaffRequest(id)) as StaffRequestDetail)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load this request.'))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await action()
      if (done) setNotice(done)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (error && !detail) return <div className="container max-w-3xl pb-20 pt-28"><p role="alert" className="rounded-2xl border border-error/20 bg-error/5 p-6 text-base font-semibold text-error">{error}</p></div>
  if (!detail) return <div className="container max-w-3xl pb-20 pt-28"><div className="h-48 animate-pulse rounded-3xl bg-surface-alt/60" aria-label="Loading" /></div>

  const { request, candidates, events } = detail
  const working = ['AGREED', 'SOURCING', 'SHORTLIST_SENT', 'INTERVIEWING'].includes(request.status)
  const shortlisted = candidates.filter((candidate) => candidate.shortlistedAt && !['DECLINED', 'DROPPED'].includes(candidate.stage)).length
  const canChangeStatus = ['NEW', 'AGREED', 'SOURCING', 'SHORTLIST_SENT', 'INTERVIEWING'].includes(request.status)

  const addNote = (event: FormEvent) => {
    event.preventDefault()
    if (!noteText.trim()) return
    void run(async () => {
      await apiStaffNote(id, noteText.trim(), noteVisibility)
      setNoteText('')
    })
  }

  const changeStatus = (status: string) => {
    if (status === 'CANCELLED') {
      const reason = window.prompt('Why is this request being cancelled?')
      if (!reason || reason.trim().length < 3) return
      void run(() => apiStaffSetStatus(id, status, reason.trim()), 'Request cancelled.')
      return
    }
    void run(() => apiStaffSetStatus(id, status), `Status is now ${STATUS_LABEL[status]}.`)
  }

  return (
    <div className="pb-20 pt-24 xl:pt-28">
      <SEO title={`${request.reference}: ${request.roleTitle}`} noindex />
      <div className="container max-w-6xl">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-black text-primary hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden /> All requests</Link>

        <header className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary">{request.reference} · {STATUS_LABEL[request.status]}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-text-main">{request.roleTitle}</h1>
            <p className="mt-1 text-sm font-semibold text-text-muted">{request.company} · {request.location} · {salaryLabel(request.salaryMin, request.salaryMax)} · {request.headcount} {request.headcount === 1 ? 'hire' : 'hires'}</p>
            {request.guaranteeEndsAt ? <p className="mt-1 text-sm font-black text-success">Replacement guarantee until {fmtDate(request.guaranteeEndsAt)} ({guaranteeLabel(request.guaranteeDaysLeft)})</p> : null}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {canChangeStatus ? (
              <div>
                <label className={labelClass} htmlFor="status-select">Status</label>
                <select id="status-select" value={request.status} disabled={busy} onChange={(event) => changeStatus(event.target.value)} className="mt-1 rounded-xl border border-surface-border bg-white px-3 py-2 text-sm font-bold">
                  <option value={request.status} disabled>{STATUS_LABEL[request.status]}</option>
                  {WORK_STATUSES.filter((status) => status !== request.status).map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
                  {role === 'ADMIN' ? <option value="CANCELLED">Cancel request</option> : null}
                </select>
              </div>
            ) : null}
            {working ? <button type="button" disabled={busy || shortlisted < 1} onClick={() => void run(() => apiStaffSend(id), 'Shortlist sent to the employer.')} className="btn btn-primary"><Send className="h-4 w-4" aria-hidden /> Send shortlist ({shortlisted})</button> : null}
          </div>
        </header>

        {error ? <p role="alert" className="mt-6 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error}</p> : null}
        {notice ? <p role="status" className="mt-6 rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-success">{notice}</p> : null}
        {request.status === 'NEW' ? <p className="mt-6 rounded-2xl border border-gold bg-gold/10 px-4 py-3 text-sm font-semibold text-text-main">This request is New: the terms are not agreed yet, so sourcing is switched off.</p> : null}

        <section aria-label="The request" className="dashboard-panel mt-6 p-5">
          <p className="whitespace-pre-line text-sm font-medium leading-6 text-text-main">{request.requirements}</p>
          <p className="mt-3 text-sm font-semibold text-text-muted">
            Contact: {request.contactName}, {request.contactPhone}
            {request.startDate ? ` · start ${fmtDate(request.startDate)}` : ''}
            {request.deadline ? ` · needed by ${fmtDate(request.deadline)}` : ''}
          </p>
        </section>

        <section aria-label="Job post" className="dashboard-panel mt-4 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          {request.job ? (
            <>
              <p className="text-sm font-semibold text-text-main">Job post: <strong>{request.job.title}</strong> ({request.job.status === 'DRAFT' ? 'draft, not live' : request.job.status.toLowerCase()})</p>
              {working ? <button type="button" disabled={busy} onClick={() => void run(() => apiStaffImportApplicants(id), 'Applicants added to the pipeline.')} className="btn btn-outline btn-sm">Add the job&apos;s applicants</button> : null}
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-text-main">No job post yet. Create one from this request in one click.</p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-text-muted"><input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} /> Publish now</label>
                <button type="button" disabled={busy || !['NEW', 'AGREED', 'SOURCING', 'SHORTLIST_SENT', 'INTERVIEWING'].includes(request.status)} onClick={() => void run(() => apiStaffCreateJob(id, publish), publish ? 'Job post published.' : 'Draft job post created. The employer can review it.')} className="btn btn-primary btn-sm">Create job post</button>
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="pipeline-heading" className="mt-10">
          <h2 id="pipeline-heading" className="text-2xl font-black text-text-main">Pipeline ({candidates.length})</h2>
          {candidates.length === 0 ? <p className="mt-3 rounded-2xl border border-dashed border-surface-border p-6 text-sm font-semibold text-text-muted">No candidates yet. Search the CV database below, add the job&apos;s applicants, or add someone by email.</p> : null}
          <ul className="mt-4 space-y-3">
            {candidates.map((candidate) => (
              <PipelineRow
                key={candidate.id}
                candidate={candidate}
                requestId={id}
                mustHaves={request.mustHaves}
                isOpen={openId === candidate.id}
                canWork={working}
                busy={busy}
                onToggle={() => setOpenId(openId === candidate.id ? null : candidate.id)}
                onChanged={load}
                run={run}
              />
            ))}
          </ul>
        </section>

        {working ? <SourcingPanel requestId={id} onAdded={load} /> : null}

        <section aria-labelledby="timeline-heading" className="mt-10">
          <h2 id="timeline-heading" className="text-2xl font-black text-text-main">History</h2>
          <form onSubmit={addNote} className="mt-3 flex flex-col gap-2 sm:flex-row" aria-label="Add a note">
            <label className="sr-only" htmlFor="note-text">Note</label>
            <input id="note-text" value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Write a note" className="min-w-0 flex-1 rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary" />
            <label className="sr-only" htmlFor="note-visibility">Who can read it</label>
            <select id="note-visibility" value={noteVisibility} onChange={(event) => setNoteVisibility(event.target.value as 'STAFF' | 'CLIENT')} className="rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm font-semibold">
              <option value="STAFF">Staff only</option>
              <option value="CLIENT">Visible to the employer</option>
            </select>
            <button type="submit" disabled={busy || !noteText.trim()} className="btn btn-outline">Add note</button>
          </form>
          <ol className="mt-4 space-y-3 border-l-2 border-surface-border pl-5">
            {events.map((entry) => (
              <li key={entry.id}>
                <p className="text-sm font-semibold text-text-main">{entry.body}</p>
                <p className="text-xs font-medium text-text-light">{fmtTime(entry.createdAt)} · {entry.actorRole.toLowerCase()} · {entry.visibility === 'CLIENT' ? 'employer can see' : 'staff only'}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

type RunFn = (action: () => Promise<unknown>, done?: string) => Promise<void>

function PipelineRow({ candidate, requestId, mustHaves, isOpen, canWork, busy, onToggle, onChanged, run }: { candidate: StaffCandidate; requestId: string; mustHaves: string[]; isOpen: boolean; canWork: boolean; busy: boolean; onToggle: () => void; onChanged: () => Promise<void>; run: RunFn }) {
  const out = ['DECLINED', 'DROPPED', 'NOT_SUITABLE'].includes(candidate.stage)
  const [start, setStart] = useState('')
  return (
    <li aria-label={candidate.name} className={`dashboard-panel p-4 sm:p-5 ${out ? 'opacity-60' : ''}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-base font-black text-text-main">{candidate.name}</p>
          <p className="text-xs font-semibold text-text-muted">{[candidate.headline, candidate.location, candidate.yearsExperience != null ? `${candidate.yearsExperience} yrs` : null].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-secondary">{STAGE_LABEL[candidate.stage] ?? candidate.stage}</span>
          {candidate.fitScore !== null ? <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">Fit {candidate.fitScore}</span> : null}
          <button type="button" onClick={onToggle} aria-expanded={isOpen} className="btn btn-outline btn-sm">{isOpen ? 'Close' : 'Open'}</button>
          {canWork && candidate.stage === 'SOURCED' ? <button type="button" disabled={busy} onClick={() => void run(() => apiStaffAskConsent(requestId, candidate.id), 'Asked. They will be notified and emailed.')} className="btn btn-primary btn-sm">Ask to be put forward</button> : null}
          {canWork && candidate.stage === 'CONSENTED' ? <button type="button" disabled={busy} onClick={() => void run(() => apiStaffShortlist(requestId, candidate.id), 'Shortlisted.')} className="btn btn-gold btn-sm">Shortlist</button> : null}
        </div>
      </div>
      {candidate.stage === 'CONSENT_ASKED' ? <p className="mt-2 text-xs font-semibold text-text-muted">Waiting for their answer. Nothing is shared until they say yes.</p> : null}
      {candidate.stage === 'DECLINED' && candidate.declineReason ? <p className="mt-2 text-xs font-semibold text-text-muted">Said no: {candidate.declineReason}</p> : null}
      {candidate.stage === 'HIRED' ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 text-xs font-semibold text-text-muted">
          <span>Hired{candidate.startDate ? `, starts ${fmtDate(candidate.startDate)}` : ''}.</span>
          <label className="sr-only" htmlFor={`start-${candidate.id}`}>Correct the start date for {candidate.name}</label>
          <input id={`start-${candidate.id}`} type="date" value={start} onChange={(event) => setStart(event.target.value)} className="rounded-lg border border-surface-border bg-white px-2 py-1 text-xs font-semibold" />
          <button type="button" disabled={busy || !start} onClick={() => void run(() => apiStaffHireStart(requestId, candidate.id, start), 'Start date saved. The guarantee end date follows it.')} className="btn btn-outline btn-sm">Save start date</button>
        </div>
      ) : null}
      {isOpen ? <CandidatePanel requestId={requestId} candidateId={candidate.id} mustHaves={mustHaves} canWork={canWork && !out} busy={busy} onChanged={onChanged} run={run} /> : null}
    </li>
  )
}

function CandidatePanel({ requestId, candidateId, mustHaves, canWork, busy, onChanged, run }: { requestId: string; candidateId: string; mustHaves: string[]; canWork: boolean; busy: boolean; onChanged: () => Promise<void>; run: RunFn }) {
  const [candidate, setCandidate] = useState<StaffCandidate | null>(null)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [notes, setNotes] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // Opening a person is recorded in the audit log.
        const data = (await apiStaffOpenCandidate(requestId, candidateId)) as { candidate: StaffCandidate }
        if (cancelled) return
        setCandidate(data.candidate)
        setRatings(Object.fromEntries(data.candidate.ratings.filter((item) => item.rating !== null).map((item) => [item.mustHave, item.rating as number])))
        setNote(data.candidate.note ?? '')
        setNotes(data.candidate.staffNotes ?? '')
      } catch (err) {
        if (!cancelled) setLoadError(getErrorMessage(err, 'We could not open this person.'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [requestId, candidateId])

  if (loadError) return <p role="alert" className="mt-3 text-sm font-bold text-error">{loadError}</p>
  if (!candidate) return <div className="mt-3 h-20 animate-pulse rounded-xl bg-surface-alt/60" aria-label="Opening" />

  const save = () =>
    run(async () => {
      await apiStaffUpdateCandidate(requestId, candidateId, { ...(mustHaves.length ? { ratings } : {}), note, staffNotes: notes })
      await onChanged()
    }, 'Saved.')

  return (
    <div className="mt-4 space-y-4 border-t border-surface-border/60 pt-4">
      {candidate.detailsOpen ? (
        <div className="grid gap-3 text-sm font-medium text-text-main md:grid-cols-2">
          <p><strong>Skills:</strong> {candidate.skills || 'Not stated'}</p>
          <p><strong>Experience:</strong> {candidate.experience || 'Not stated'}</p>
          <p><strong>Contact:</strong> {[candidate.email, candidate.phone].filter(Boolean).join(' · ') || 'None on file'}</p>
          {candidate.cv ? <EvidenceLink href={candidate.cv.url} className="inline-flex items-center gap-1.5 font-black text-primary hover:underline"><FileText className="h-4 w-4" aria-hidden /> Open CV</EvidenceLink> : <p>No CV on file.</p>}
        </div>
      ) : (
        <p className="rounded-xl bg-surface-alt/60 p-3 text-sm font-semibold text-text-muted">This profile is private. Name, contact details and CV open once the person agrees to be put forward.</p>
      )}

      <fieldset disabled={!canWork}>
        {mustHaves.length > 0 ? (
          <>
            <legend className={labelClass}>Rate against the must-haves (1 poor, 5 excellent)</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {mustHaves.map((item) => (
                <label key={item} className="flex items-center justify-between gap-3 rounded-xl bg-surface-alt/50 px-3 py-2 text-sm font-semibold text-text-main">
                  <span>{item}</span>
                  <select aria-label={`Rating for ${item}`} value={ratings[item] ?? ''} onChange={(event) => setRatings((current) => ({ ...current, [item]: Number(event.target.value) }))} className="rounded-lg border border-surface-border bg-white px-2 py-1 text-sm font-black">
                    <option value="">–</option>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </>
        ) : null}
        <label className={`${labelClass} mt-4`} htmlFor={`note-${candidateId}`}>Short note for the employer (they read this)</label>
        <textarea id={`note-${candidateId}`} value={note} onChange={(event) => setNote(event.target.value)} className={`${input} min-h-[90px]`} />
        <label className={`${labelClass} mt-3`} htmlFor={`staff-notes-${candidateId}`}>Private notes (staff only)</label>
        <textarea id={`staff-notes-${candidateId}`} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${input} min-h-[70px]`} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void save()} className="btn btn-primary btn-sm">Save</button>
          <button type="button" disabled={busy} onClick={() => { const reason = window.prompt('Why are you removing this person?'); if (reason && reason.trim().length >= 3) void run(() => apiStaffDropCandidate(requestId, candidateId, reason.trim()), 'Removed from the request.') }} className="btn btn-outline btn-sm text-error">Remove from request</button>
        </div>
      </fieldset>
    </div>
  )
}

function SourcingPanel({ requestId, onAdded }: { requestId: string; onAdded: () => Promise<void> }) {
  const [filters, setFilters] = useState({ skills: '', location: '', minYears: '' })
  const [entries, setEntries] = useState<SearchEntry[] | null>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const search = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const params: Record<string, string> = {}
      if (filters.skills.trim()) params.skills = filters.skills.trim()
      if (filters.location.trim()) params.location = filters.location.trim()
      if (filters.minYears.trim()) params.minYears = filters.minYears.trim()
      const data = (await apiStaffSearch(requestId, params)) as { entries: SearchEntry[] }
      setEntries(data.entries)
    } catch (err) {
      setError(getErrorMessage(err, 'The search did not work.'))
    }
  }

  const add = async (data: { profileId?: string; email?: string }, remove?: string) => {
    setError('')
    setNotice('')
    try {
      await apiStaffAddCandidate(requestId, data)
      setNotice('Added to the pipeline.')
      if (remove) setEntries((current) => (current ?? []).filter((entry) => entry.id !== remove))
      if (data.email) setEmail('')
      await onAdded()
    } catch (err) {
      setError(getErrorMessage(err, 'We could not add that person.'))
    }
  }

  return (
    <section aria-labelledby="sourcing-heading" className="dashboard-panel mt-10 p-5 sm:p-6">
      <h2 id="sourcing-heading" className="text-2xl font-black text-text-main">Find candidates</h2>
      <p className="mt-1 text-sm font-medium text-text-muted">Only people who made their profile visible appear, and never anyone who blocked this employer. Results are ranked by how much of the request they cover.</p>

      <form onSubmit={search} className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end" aria-label="Search the CV database">
        <div><label className={labelClass} htmlFor="src-skills">Skills (every word must match)</label><input id="src-skills" value={filters.skills} onChange={(event) => setFilters({ ...filters, skills: event.target.value })} className={input} /></div>
        <div><label className={labelClass} htmlFor="src-location">Location</label><input id="src-location" value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })} className={input} /></div>
        <div><label className={labelClass} htmlFor="src-years">Years at least</label><input id="src-years" type="number" min={0} value={filters.minYears} onChange={(event) => setFilters({ ...filters, minYears: event.target.value })} className={input} /></div>
        <button type="submit" className="btn btn-primary"><Search className="h-4 w-4" aria-hidden /> Search</button>
      </form>

      {error ? <p role="alert" className="mt-3 text-sm font-bold text-error">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm font-bold text-success">{notice}</p> : null}

      {entries ? (
        entries.length === 0 ? <p className="mt-4 text-sm font-semibold text-text-muted">No one matches. Try fewer words.</p> : (
          <ul className="mt-4 space-y-2" aria-label="Search results">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block text-sm font-black text-text-main">{entry.headline}</span>
                  <span className="block text-xs font-medium text-text-muted">{[entry.location, entry.yearsExperience != null ? `${entry.yearsExperience} yrs` : null, entry.hasVerifiedCertificate ? 'verified certificate' : null].filter(Boolean).join(' · ')}</span>
                  <span className="block truncate text-xs font-medium text-text-muted">{entry.skills}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs font-black uppercase tracking-widest text-secondary">{entry.relevance}% of request</span>
                  <button type="button" onClick={() => void add({ profileId: entry.id }, entry.id)} className="btn btn-outline btn-sm">Add</button>
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <form className="mt-6 flex flex-col gap-2 border-t border-surface-border/60 pt-5 sm:flex-row sm:items-end" aria-label="Add by email" onSubmit={(event) => { event.preventDefault(); if (email.trim()) void add({ email: email.trim() }) }}>
        <div className="flex-1"><label className={labelClass} htmlFor="add-email">Someone you already know (their JobWahala email)</label><input id="add-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={input} /></div>
        <button type="submit" disabled={!email.trim()} className="btn btn-outline">Add by email</button>
      </form>
    </section>
  )
}
