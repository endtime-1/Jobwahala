import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import {
  apiAdminAssignRecruiter,
  apiAdminCreateRecruiter,
  apiAdminHiringRequests,
  apiAdminHiringSettings,
  apiAdminRecordPayment,
  apiAdminRemovePayment,
  apiAdminSaveTerms,
  apiAdminSetRecruiterActive,
  apiAdminStaff,
  apiHiringInfo,
  apiStaffRequest,
} from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { STATUS_LABEL, STATUS_ORDER, fmtDate, type HiringInfo, type StaffMember, type StaffRequestDetail, type StaffRequestRow } from '../lib/hiring'

const input = 'mt-1 w-full rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm font-semibold text-text-main outline-none focus:border-primary'
const label = 'block text-[10px] font-black uppercase tracking-[0.2em] text-text-light'
const today = () => new Date().toISOString().slice(0, 10)

/** Admin: every Hiring Service request, filters, who is working on it, the agreed fee and the payments, and the recruiter accounts. */
export default function AdminHiringPanel() {
  const [rows, setRows] = useState<StaffRequestRow[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [info, setInfo] = useState<HiringInfo>({ fromPriceGhs: null, guaranteeDays: 90 })
  const [price, setPrice] = useState('')
  const [guarantee, setGuarantee] = useState('90')
  const [status, setStatus] = useState('ALL')
  const [recruiterId, setRecruiterId] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [dealOpen, setDealOpen] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ email: '', displayName: '', title: '', phone: '' })

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = { status }
      if (recruiterId !== 'ALL') params.recruiterId = recruiterId
      if (from) params.from = from
      if (to) params.to = to
      const [requests, team, hiringInfo] = await Promise.all([
        apiAdminHiringRequests(params) as Promise<{ requests: StaffRequestRow[] }>,
        apiAdminStaff() as Promise<{ staff: StaffMember[] }>,
        apiHiringInfo() as Promise<{ info: HiringInfo }>,
      ])
      setRows(requests.requests)
      setStaff(team.staff)
      setInfo(hiringInfo.info)
      setPrice(hiringInfo.info.fromPriceGhs ? String(hiringInfo.info.fromPriceGhs) : '')
      setGuarantee(String(hiringInfo.info.guaranteeDays))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the Hiring Service.'))
    }
  }, [status, recruiterId, from, to])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const run = async (action: () => Promise<unknown>, done: string) => {
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(done)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work. Please try again.'))
    }
  }

  const create = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await apiAdminCreateRecruiter({ email: form.email, displayName: form.displayName, ...(form.title ? { title: form.title } : {}), ...(form.phone ? { phone: form.phone } : {}) })
      setForm({ email: '', displayName: '', title: '', phone: '' })
    }, 'Recruiter created. They have been emailed a link to choose a password.')
  }

  const active = staff.filter((member) => member.active)
  const countNew = rows.filter((row) => row.status === 'NEW').length

  return (
    <div className="space-y-8">
      <section aria-label="Hiring Service settings" className="rounded-3xl border border-surface-border bg-white/80 p-5 sm:p-6">
        <p className={label}>Hiring Service</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-text-main">Public price and guarantee</h2>
        <p className="mt-1 text-sm font-medium text-text-muted">Shown on the public Hiring Service page. Currently: {info.fromPriceGhs ? `from GHS ${info.fromPriceGhs.toLocaleString('en-GH')}` : 'no price (it says "ask us for a quote")'}, {info.guaranteeDays} days guarantee.</p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            void run(() => apiAdminHiringSettings({ fromPriceGhs: price.trim() ? Number(price) : null, guaranteeDays: Number(guarantee) || 0 }), 'Saved.')
          }}
        >
          <div><label className={label} htmlFor="hs-price">&quot;From&quot; price (GHS, empty to hide)</label><input id="hs-price" type="number" min={0} value={price} onChange={(event) => setPrice(event.target.value)} className={input} /></div>
          <div><label className={label} htmlFor="hs-guarantee">Default replacement guarantee (days)</label><input id="hs-guarantee" type="number" min={0} max={730} value={guarantee} onChange={(event) => setGuarantee(event.target.value)} className={input} /></div>
          <button type="submit" className="btn btn-primary">Save</button>
        </form>
      </section>

      <section aria-label="Requests" className="space-y-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-text-main">{rows.length} {rows.length === 1 ? 'request' : 'requests'}{countNew ? `, ${countNew} new` : ''}</h2>
        </div>

        <div className="grid gap-3 rounded-3xl border border-surface-border bg-surface-alt/10 p-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <p className={label}>Status</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              <button type="button" aria-pressed={status === 'ALL'} onClick={() => setStatus('ALL')} className={`dashboard-action-chip ${status === 'ALL' ? 'border-primary/30 bg-primary/10 text-primary' : ''}`}>All</button>
              {STATUS_ORDER.map((value) => (
                <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`dashboard-action-chip ${status === value ? 'border-primary/30 bg-primary/10 text-primary' : ''}`}>{STATUS_LABEL[value]}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={label} htmlFor="filter-recruiter">Recruiter</label>
            <select id="filter-recruiter" value={recruiterId} onChange={(event) => setRecruiterId(event.target.value)} className={input}>
              <option value="ALL">Anyone</option>
              <option value="NONE">Not assigned</option>
              {staff.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
            </select>
          </div>
          <div><label className={label} htmlFor="filter-from">From date</label><input id="filter-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={input} /></div>
          <div><label className={label} htmlFor="filter-to">To date</label><input id="filter-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className={input} /></div>
        </div>

        {error ? <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error}</p> : null}
        {notice ? <p role="status" className="rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-success">{notice}</p> : null}

        {rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-surface-border p-6 text-sm font-semibold text-text-light">No requests here yet.</div>
        ) : (
          <ul className="space-y-3" aria-label="Hiring requests">
            {rows.map((row) => (
              <li key={row.id} className="rounded-3xl border border-surface-border bg-surface-alt/20 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <Link to={`/recruiter/requests/${row.id}`} className="text-lg font-black text-text-main hover:text-primary hover:underline">{row.roleTitle}</Link>
                    <p className="text-xs font-semibold text-text-muted">{row.reference} · {row.company} · {row.location} · sent {fmtDate(row.createdAt)}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-secondary">
                      {STATUS_LABEL[row.status]} · {row.pipeline.shortlisted} shortlisted
                      {row.guaranteeEndsAt ? <span className="text-text-light"> · guarantee until {fmtDate(row.guaranteeEndsAt)}</span> : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {['NEW', 'AGREED', 'SOURCING', 'SHORTLIST_SENT', 'INTERVIEWING', 'FILLED'].includes(row.status) ? (
                      <>
                        <label className="sr-only" htmlFor={`assign-${row.id}`}>Recruiter for {row.roleTitle}</label>
                        <select id={`assign-${row.id}`} value={row.assignedRecruiterId ?? ''} onChange={(event) => event.target.value && void run(() => apiAdminAssignRecruiter(row.id, event.target.value), 'Recruiter assigned.')} className="rounded-xl border border-surface-border bg-white px-3 py-2 text-sm font-semibold">
                          <option value="">{row.recruiter ?? 'Choose a recruiter'}</option>
                          {active.filter((member) => member.userId !== row.assignedRecruiterId).map((member) => (
                            <option key={member.userId} value={member.userId}>{member.displayName} ({member.openRequests} open)</option>
                          ))}
                        </select>
                      </>
                    ) : null}
                    <button type="button" aria-expanded={dealOpen === row.id} onClick={() => setDealOpen(dealOpen === row.id ? null : row.id)} className="btn btn-outline btn-sm">{dealOpen === row.id ? 'Close the deal' : 'Fee and payments'}</button>
                  </div>
                </div>
                {dealOpen === row.id ? <DealPanel requestId={row.id} defaultGuarantee={info.guaranteeDays} onChanged={load} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Recruiters" className="space-y-4">
        <h2 className="text-2xl font-black tracking-tight text-text-main">Recruiters</h2>
        <p className="text-sm font-medium text-text-muted">A recruiter can see and work on only the requests assigned to them. They have no other admin access and never see fees or payments.</p>
        <form onSubmit={create} aria-label="Add a recruiter" className="rounded-3xl border border-surface-border bg-white/80 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className={label} htmlFor="rec-name">Name</label><input id="rec-name" required minLength={2} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className={input} /></div>
            <div><label className={label} htmlFor="rec-email">Email</label><input id="rec-email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={input} /></div>
            <div><label className={label} htmlFor="rec-title">Title (employers see this)</label><input id="rec-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={input} /></div>
            <div><label className={label} htmlFor="rec-phone">Phone</label><input id="rec-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={input} /></div>
          </div>
          <button type="submit" className="btn btn-primary mt-4"><Plus className="h-4 w-4" aria-hidden /> Add recruiter</button>
        </form>

        {staff.length === 0 ? <p className="text-sm font-semibold text-text-light">No recruiters yet.</p> : (
          <ul className="space-y-2" aria-label="Recruiter accounts">
            {staff.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-alt/20 p-4">
                <span>
                  <span className="block text-sm font-black text-text-main">{member.displayName}{member.active ? '' : ' (deactivated)'}</span>
                  <span className="text-xs font-semibold text-text-muted">{[member.title, member.email].filter(Boolean).join(' · ')} · {member.openRequests} open</span>
                </span>
                <button type="button" onClick={() => void run(() => apiAdminSetRecruiterActive(member.userId, !member.active), member.active ? 'Recruiter deactivated and signed out.' : 'Recruiter reactivated.')} className="text-xs font-black uppercase tracking-widest text-primary hover:underline">
                  {member.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** The agreed fee, the deposit, what has been paid and what is due, with manual payment entries. */
function DealPanel({ requestId, defaultGuarantee, onChanged }: { requestId: string; defaultGuarantee: number; onChanged: () => Promise<void> }) {
  const [detail, setDetail] = useState<StaffRequestDetail | null>(null)
  const [fee, setFee] = useState('')
  const [deposit, setDeposit] = useState('')
  const [guarantee, setGuarantee] = useState(String(defaultGuarantee))
  const [pay, setPay] = useState({ kind: 'DEPOSIT', amountGhs: '', paidAt: today(), method: '', reference: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const reload = useCallback(async () => {
    try {
      const data = (await apiStaffRequest(requestId)) as StaffRequestDetail
      setDetail(data)
      setFee(data.request.feePesewas != null ? String(data.request.feePesewas / 100) : '')
      setDeposit(data.request.depositPesewas != null ? String(data.request.depositPesewas / 100) : '')
      setGuarantee(String(data.request.guaranteeDays))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the deal.'))
    }
  }, [requestId])

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  const run = async (action: () => Promise<unknown>, done: string) => {
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(done)
      await reload()
      await onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work. Please try again.'))
    }
  }

  if (!detail) return <div className="mt-4 h-20 animate-pulse rounded-xl bg-surface-alt/60" aria-label="Loading the deal" />
  const { request } = detail
  const money = request.fee

  return (
    <div className="mt-5 space-y-5 border-t border-surface-border/60 pt-5">
      {error ? <p role="alert" className="text-sm font-bold text-error">{error}</p> : null}
      {notice ? <p role="status" className="text-sm font-bold text-success">{notice}</p> : null}

      <form
        aria-label="Agreed terms"
        className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          void run(() => apiAdminSaveTerms(requestId, { feeGhs: fee.trim() ? Number(fee) : null, depositGhs: deposit.trim() ? Number(deposit) : null, guaranteeDays: Number(guarantee) || 0 }), request.status === 'NEW' && fee.trim() ? 'Terms saved. The request is now Agreed and the employer has been told.' : 'Terms saved.')
        }}
      >
        <div><label className={label} htmlFor={`fee-${requestId}`}>Agreed fee (GHS)</label><input id={`fee-${requestId}`} type="number" min={0} step="0.01" value={fee} onChange={(event) => setFee(event.target.value)} className={input} /></div>
        <div><label className={label} htmlFor={`dep-${requestId}`}>Deposit (GHS)</label><input id={`dep-${requestId}`} type="number" min={0} step="0.01" value={deposit} onChange={(event) => setDeposit(event.target.value)} className={input} /></div>
        <div><label className={label} htmlFor={`gua-${requestId}`}>Guarantee (days)</label><input id={`gua-${requestId}`} type="number" min={0} max={730} value={guarantee} onChange={(event) => setGuarantee(event.target.value)} className={input} /></div>
        <button type="submit" className="btn btn-primary">Save terms</button>
      </form>

      {money && money.agreed ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-4" aria-label="What is due">
          <div className="rounded-xl bg-surface-alt/50 p-3"><dt className={label}>Fee</dt><dd className="font-black text-text-main">{money.feeLabel}</dd></div>
          <div className="rounded-xl bg-surface-alt/50 p-3"><dt className={label}>Deposit / balance</dt><dd className="font-black text-text-main">{money.depositLabel} / {money.balanceLabel}</dd></div>
          <div className="rounded-xl bg-surface-alt/50 p-3"><dt className={label}>Paid</dt><dd className="font-black text-success">{money.paidLabel}</dd></div>
          <div className="rounded-xl bg-surface-alt/50 p-3"><dt className={label}>Still due</dt><dd className="font-black text-text-main">{money.outstandingLabel}{money.settled ? ' (settled)' : ''}</dd></div>
        </dl>
      ) : null}

      <div>
        <p className={label}>Payments recorded by hand</p>
        {request.payments && request.payments.length > 0 ? (
          <ul className="mt-2 space-y-2" aria-label="Payments">
            {request.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-white px-4 py-2 text-sm">
                <span><strong>{payment.amountLabel}</strong> {payment.kind.toLowerCase()} · {fmtDate(payment.paidAt)}{payment.method ? ` · ${payment.method}` : ''}{payment.reference ? ` · ${payment.reference}` : ''}</span>
                <button type="button" onClick={() => { const reason = window.prompt('Why are you removing this payment?'); if (reason && reason.trim().length >= 3) void run(() => apiAdminRemovePayment(requestId, payment.id, reason.trim()), 'Payment removed.') }} className="text-xs font-black uppercase tracking-widest text-error hover:underline">Remove</button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-sm font-semibold text-text-muted">No payments yet.</p>}
      </div>

      <form
        aria-label="Record a payment"
        className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          void run(async () => {
            await apiAdminRecordPayment(requestId, { kind: pay.kind as 'DEPOSIT' | 'BALANCE' | 'OTHER', amountGhs: Number(pay.amountGhs), paidAt: pay.paidAt, ...(pay.method ? { method: pay.method } : {}), ...(pay.reference ? { reference: pay.reference } : {}) })
            setPay({ kind: 'BALANCE', amountGhs: '', paidAt: today(), method: '', reference: '' })
          }, 'Payment recorded.')
        }}
      >
        <div>
          <label className={label} htmlFor={`pk-${requestId}`}>Type</label>
          <select id={`pk-${requestId}`} value={pay.kind} onChange={(event) => setPay({ ...pay, kind: event.target.value })} className={input}>
            <option value="DEPOSIT">Deposit</option>
            <option value="BALANCE">Balance</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div><label className={label} htmlFor={`pa-${requestId}`}>Amount (GHS)</label><input id={`pa-${requestId}`} type="number" min={0.01} step="0.01" required value={pay.amountGhs} onChange={(event) => setPay({ ...pay, amountGhs: event.target.value })} className={input} /></div>
        <div><label className={label} htmlFor={`pd-${requestId}`}>Date paid</label><input id={`pd-${requestId}`} type="date" required value={pay.paidAt} onChange={(event) => setPay({ ...pay, paidAt: event.target.value })} className={input} /></div>
        <div><label className={label} htmlFor={`pm-${requestId}`}>Method</label><input id={`pm-${requestId}`} value={pay.method} onChange={(event) => setPay({ ...pay, method: event.target.value })} placeholder="Mobile money" className={input} /></div>
        <div><label className={label} htmlFor={`pr-${requestId}`}>Reference</label><input id={`pr-${requestId}`} value={pay.reference} onChange={(event) => setPay({ ...pay, reference: event.target.value })} className={input} /></div>
        <button type="submit" className="btn btn-outline">Record</button>
      </form>
    </div>
  )
}
