import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, FileText, Mail, Phone, ShieldCheck } from 'lucide-react'
import SEO from '../components/SEO'
import PageHero from '../components/PageHero'
import EvidenceLink from '../components/EvidenceLink'
import { apiCancelHiringRequest, apiHiringDecision, apiHiringReplacement, apiHiringRequest } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { STATUS_HINT, STATUS_LABEL, fmtDate, guaranteeLabel, salaryLabel, type ClientCandidate, type ClientRequestDetail } from '../lib/hiring'

const DECISION_LABEL: Record<string, string> = { INTERVIEW: 'You invited this person to interview', NOT_SUITABLE: 'You marked this person not suitable', HIRED: 'You marked this person as hired' }

/** The employer's view of one request: progress, the deal, the shortlist we sent, and the decisions only they can make. */
export default function HiringRequestPage() {
  const { id = '' } = useParams()
  const [detail, setDetail] = useState<ClientRequestDetail | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    try {
      setDetail((await apiHiringRequest(id)) as ClientRequestDetail)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load this request.'))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: () => Promise<unknown>, done: string) => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await action()
      setNotice(done)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (error && !detail) {
    return (
      <div className="container max-w-3xl pb-20 pt-28">
        <p role="alert" className="rounded-2xl border border-error/20 bg-error/5 p-6 text-base font-semibold text-error">{error}</p>
        <Link to="/hiring-service" className="mt-4 inline-block font-bold text-primary hover:underline">Back to the Hiring Service</Link>
      </div>
    )
  }
  if (!detail) return <div className="container max-w-3xl pb-20 pt-28"><div className="h-48 animate-pulse rounded-3xl bg-surface-alt/60" aria-label="Loading" /></div>

  const { request, candidates, timeline } = detail
  const canDecide = ['SHORTLIST_SENT', 'INTERVIEWING'].includes(request.status)

  return (
    <div className="pb-20 pt-24 xl:pt-28">
      <SEO title={`${request.roleTitle}: hiring request`} noindex />
      <div className="container max-w-5xl">
        <PageHero eyebrow={`Hiring request ${request.reference}`} title={request.roleTitle}>
          <p className="mt-4 text-lg font-semibold text-white/80">{STATUS_LABEL[request.status]}</p>
          <p className="mt-1 text-sm font-medium text-white/60">{STATUS_HINT[request.status]}</p>
          <p className="mt-1 text-sm font-medium text-white/60">{request.location} · {salaryLabel(request.salaryMin, request.salaryMax)} · {request.headcount} {request.headcount === 1 ? 'hire' : 'hires'}</p>
        </PageHero>

        {error ? <p role="alert" className="mt-6 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error}</p> : null}
        {notice ? <p role="status" className="mt-6 rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-success">{notice}</p> : null}

        <section aria-label="Summary" className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="dashboard-panel p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-light">Your recruiter</p>
            <p className="mt-1 text-lg font-black text-text-main">{request.recruiter ? request.recruiter.name : 'Being assigned'}</p>
            {request.recruiter?.title ? <p className="text-sm font-medium text-text-muted">{request.recruiter.title}</p> : null}
          </div>
          <div className="dashboard-panel p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-light">The agreement</p>
            {request.fee ? (
              <dl className="mt-1 space-y-0.5 text-sm font-semibold text-text-main">
                <div className="flex justify-between gap-3"><dt>Fee</dt><dd>{request.fee.feeLabel}</dd></div>
                <div className="flex justify-between gap-3"><dt>Deposit</dt><dd>{request.fee.depositLabel}</dd></div>
                <div className="flex justify-between gap-3"><dt>Paid so far</dt><dd>{request.fee.paidLabel}</dd></div>
                <div className="flex justify-between gap-3 font-black"><dt>Still to pay</dt><dd>{request.fee.outstandingLabel}</dd></div>
              </dl>
            ) : (
              <p className="mt-1 text-sm font-semibold text-text-muted">We will contact you to agree the fee.</p>
            )}
          </div>
          <div className="dashboard-panel p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-light">Replacement guarantee</p>
            {request.guaranteeEndsAt ? (
              <>
                <p className="mt-1 flex items-center gap-2 text-lg font-black text-text-main"><ShieldCheck className="h-4 w-4 text-success" aria-hidden /> Until {fmtDate(request.guaranteeEndsAt)}</p>
                <p className="text-sm font-bold text-text-muted">{guaranteeLabel(request.guaranteeDaysLeft)}</p>
              </>
            ) : (
              <p className="mt-1 text-sm font-semibold text-text-muted">{request.guaranteeDays} days from the day your hire starts.</p>
            )}
          </div>
        </section>

        {request.job ? (
          <p className="mt-4 text-sm font-semibold text-text-muted">
            Job post: <span className="font-black text-text-main">{request.job.title}</span> ({request.job.status === 'DRAFT' ? 'a draft for you to review in your dashboard' : request.job.status.toLowerCase()})
          </p>
        ) : null}

        {request.canCancel ? (
          <button type="button" disabled={busy} onClick={() => void run(() => apiCancelHiringRequest(id), 'Request cancelled.')} className="btn btn-outline btn-sm mt-4">Cancel this request</button>
        ) : null}

        <section aria-labelledby="shortlist-heading" className="mt-10">
          <h2 id="shortlist-heading" className="text-2xl font-black text-text-main">Your shortlist</h2>
          {candidates.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-surface-border p-6 text-sm font-semibold text-text-muted">
              {request.sentAt ? 'No candidates are on the shortlist now.' : 'Nothing yet. When your recruiter sends the shortlist, the candidates appear here and we email you.'}
            </p>
          ) : (
            <ul className="mt-4 space-y-5">
              {candidates.map((candidate) => (
                <CandidateCard key={candidate.id} candidate={candidate} canDecide={canDecide && candidate.stage !== 'HIRED'} busy={busy} onDecide={(decision, note, startDate) => void run(() => apiHiringDecision(id, candidate.id, { decision, ...(note ? { note } : {}), ...(startDate ? { startDate } : {}) }), 'Thank you. We have told your recruiter.')} />
              ))}
            </ul>
          )}
        </section>

        {request.canRequestReplacement ? (
          <section aria-label="Replacement guarantee" className="dashboard-panel mt-10 p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-text-main"><ShieldCheck className="h-5 w-5 text-success" aria-hidden /> Did your hire leave?</h2>
            <p className="mt-1 text-sm font-medium text-text-muted">Until {fmtDate(request.guaranteeEndsAt)}, we search again for free.</p>
            <label className="mt-3 block text-sm font-bold text-text-main" htmlFor="replacement-reason">What happened?</label>
            <input id="replacement-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary" />
            <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => void run(() => apiHiringReplacement(id, reason.trim()), 'Replacement search started.')} className="btn btn-outline btn-sm mt-3 disabled:opacity-60">Start a free replacement</button>
          </section>
        ) : null}

        <section aria-labelledby="timeline-heading" className="mt-10">
          <h2 id="timeline-heading" className="text-2xl font-black text-text-main">Progress</h2>
          <ol className="mt-4 space-y-3 border-l-2 border-surface-border pl-5">
            {timeline.map((entry) => (
              <li key={entry.id}>
                <p className="text-sm font-semibold text-text-main">{entry.body}</p>
                <p className="text-xs font-medium text-text-light">{fmtDate(entry.createdAt)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="brief-heading" className="mt-10">
          <h2 id="brief-heading" className="text-2xl font-black text-text-main">Your request</h2>
          <p className="mt-2 whitespace-pre-line text-sm font-medium leading-6 text-text-muted">{request.requirements}</p>
          <p className="mt-3 text-sm font-semibold text-text-muted">Contact: {request.contactName}, {request.contactPhone}{request.startDate ? ` · start ${fmtDate(request.startDate)}` : ''}{request.deadline ? ` · needed by ${fmtDate(request.deadline)}` : ''}</p>
        </section>
      </div>
    </div>
  )
}

function CandidateCard({ candidate, canDecide, busy, onDecide }: { candidate: ClientCandidate; canDecide: boolean; busy: boolean; onDecide: (decision: 'INTERVIEW' | 'NOT_SUITABLE' | 'HIRED', note?: string, startDate?: string) => void }) {
  const [note, setNote] = useState('')
  const [startDate, setStartDate] = useState('')
  return (
    <li aria-label={candidate.name} className="dashboard-panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-text-main">{candidate.name}</h3>
          <p className="text-sm font-semibold text-text-muted">{[candidate.headline, candidate.location, candidate.yearsExperience != null ? `${candidate.yearsExperience} years experience` : null].filter(Boolean).join(' · ')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {candidate.verifiedCertificate ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-black text-success"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified certificate</span> : null}
            {candidate.identityVerified ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-black text-success"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Identity verified</span> : null}
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">Agreed to be put forward</span>
          </div>
        </div>
        {candidate.fitScore !== null ? (
          <div className="rounded-2xl bg-secondary/10 px-4 py-2 text-center" aria-label={`Fit score ${candidate.fitScore} out of 100`}>
            <p className="text-3xl font-black text-secondary">{candidate.fitScore}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-text-light">fit score</p>
          </div>
        ) : null}
      </div>

      {candidate.note ? (
        <div className="mt-4 rounded-2xl bg-surface-alt/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-light">Our note</p>
          <p className="mt-1 whitespace-pre-line text-sm font-medium leading-6 text-text-main">{candidate.note}</p>
        </div>
      ) : null}

      {candidate.ratings.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Rated against your requirements">
          {candidate.ratings.map((item) => (
            <li key={item.mustHave} className="flex items-center justify-between gap-3 rounded-xl bg-surface-alt/50 px-3 py-2 text-sm">
              <span className="font-semibold text-text-main">{item.mustHave}</span>
              <span className="font-black text-secondary" aria-label={`${item.rating} out of 5`}>{item.rating ?? '–'}/5</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-text-muted">
        {candidate.email ? <a href={`mailto:${candidate.email}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Mail className="h-4 w-4" aria-hidden /> {candidate.email}</a> : null}
        {candidate.phone ? <a href={`tel:${candidate.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Phone className="h-4 w-4" aria-hidden /> {candidate.phone}</a> : null}
        {candidate.cv ? <EvidenceLink href={candidate.cv.url} className="inline-flex items-center gap-1.5 font-black text-primary hover:underline"><FileText className="h-4 w-4" aria-hidden /> Open CV</EvidenceLink> : null}
      </div>

      {candidate.decision ? (
        <p className="mt-4 text-sm font-black text-secondary">
          {DECISION_LABEL[candidate.decision]}
          {candidate.decisionNote ? `: ${candidate.decisionNote}` : ''}
          {candidate.decision === 'HIRED' && candidate.startDate ? ` (starts ${fmtDate(candidate.startDate)})` : ''}
        </p>
      ) : null}

      {canDecide ? (
        <div className="mt-4 border-t border-surface-border/60 pt-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <label htmlFor={`note-${candidate.id}`} className="sr-only">Note for {candidate.name}</label>
              <input id={`note-${candidate.id}`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="A note for your recruiter (optional)" className="w-full rounded-xl border border-surface-border bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary" />
            </div>
            <div>
              <label htmlFor={`start-${candidate.id}`} className="sr-only">Start date for {candidate.name}</label>
              <input id={`start-${candidate.id}`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} title="Start date, if you hire this person" className="w-full rounded-xl border border-surface-border bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => onDecide('INTERVIEW', note)} className="btn btn-primary btn-sm">Invite to interview</button>
            <button type="button" disabled={busy} onClick={() => onDecide('HIRED', note, startDate)} className="btn btn-gold btn-sm">Hired</button>
            <button type="button" disabled={busy} onClick={() => onDecide('NOT_SUITABLE', note)} className="btn btn-outline btn-sm">Not suitable</button>
          </div>
          <p className="mt-2 text-xs font-medium text-text-light">If you mark someone as hired, enter their start date first. If you leave it empty we use today.</p>
        </div>
      ) : null}
    </li>
  )
}
