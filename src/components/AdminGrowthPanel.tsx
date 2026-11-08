import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Award, CalendarClock, Copy, Link2, MessageCircle, Pencil, Plus, Trash2, XCircle } from 'lucide-react'
import {
  apiAdminClaimLink,
  apiAdminCreateManagedCompany,
  apiAdminDeleteOutreach,
  apiAdminFounding,
  apiAdminManagedCompanies,
  apiAdminOutreach,
  apiAdminRevokeClaim,
  apiAdminSaveFoundingSettings,
  apiAdminSaveOutreach,
  apiAdminSetFounding,
} from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { OUTREACH_STATUSES, isFollowUpDue, type ManagedCompany, type OutreachContact, type OutreachStatus } from '../lib/growth'

type Section = 'companies' | 'founding' | 'outreach'
type CompanyOption = { id: string; name: string }
type IssuedLink = { companyId: string; url: string; whatsappUrl: string | null; emailed: boolean; expiresAt: string }
type FoundingData = { limit: number; featuredCredits: number; taken: number; companies: { id: string; companyName: string; number: number; since: string | null }[] }

const input = 'mt-1 w-full rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm font-semibold text-text-main outline-none focus:border-primary'
const label = 'block text-[10px] font-black uppercase tracking-[0.2em] text-text-light'
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

const CLAIM_TEXT: Record<string, string> = { ACTIVE: 'Link sent, waiting', CLAIMED: 'Taken over', REVOKED: 'Link cancelled', EXPIRED: 'Link expired' }

/** Admin: companies set up for employers (with claim links), the Founding Employer programme and the outreach tracker. */
export default function AdminGrowthPanel({ onPostJob, companies = [] }: { onPostJob: (companyId: string) => void; companies?: CompanyOption[] }) {
  const [section, setSection] = useState<Section>('companies')
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Employer growth">
        {(
          [
            ['companies', 'Companies and claim links'],
            ['founding', 'Founding Employers'],
            ['outreach', 'Outreach tracker'],
          ] as const
        ).map(([key, text]) => (
          <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => setSection(key)} className={`dashboard-action-chip ${section === key ? 'border-primary/30 bg-primary/10 text-primary' : ''}`}>
            {text}
          </button>
        ))}
      </div>
      {section === 'companies' ? <CompaniesSection onPostJob={onPostJob} /> : null}
      {section === 'founding' ? <FoundingSection companies={companies} /> : null}
      {section === 'outreach' ? <OutreachSection /> : null}
    </div>
  )
}

// ------------------------------------------------------------------ companies and claim links

function CompaniesSection({ onPostJob }: { onPostJob: (companyId: string) => void }) {
  const queryClient = useQueryClient()
  const [companies, setCompanies] = useState<ManagedCompany[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ companyName: '', industry: '', contactPhone: '', website: '' })
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [issued, setIssued] = useState<IssuedLink | null>(null)

  const load = useCallback(async () => {
    try {
      const data = (await apiAdminManagedCompanies()) as { companies: ManagedCompany[] }
      setCompanies(data.companies)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the companies.'))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: () => Promise<void>) => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const create = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await apiAdminCreateManagedCompany({ companyName: form.companyName, industry: form.industry, contactPhone: form.contactPhone, website: form.website })
      setForm({ companyName: '', industry: '', contactPhone: '', website: '' })
      setNotice('Company created. Post its jobs, then send the owner a claim link.')
      await load()
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
    })
  }

  const issue = (company: ManagedCompany, channel: 'EMAIL' | 'WHATSAPP' | 'LINK') =>
    void run(async () => {
      const email = (emails[company.id] || '').trim()
      const result = (await apiAdminClaimLink(company.id, { channel, ...(channel === 'EMAIL' ? { email } : {}), ...(channel === 'WHATSAPP' ? { phone: company.contactPhone || '' } : {}) })) as { link: Omit<IssuedLink, 'companyId'> }
      setIssued({ companyId: company.id, ...result.link })
      setNotice(channel === 'EMAIL' ? (result.link.emailed ? `Email sent to ${email}.` : 'The link was made, but the email did not go. Copy the link below instead.') : 'New link ready below. Earlier links no longer work.')
      await load()
    })

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setNotice('Copied.')
    } catch {
      setError('Copying is blocked in this browser. Select the link and copy it.')
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="rounded-3xl border border-surface-border bg-white/80 p-6" aria-label="Create a company">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Employers who send vacancies on WhatsApp</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-text-main">Create a company, then post for it</h2>
        <p className="mt-2 text-sm font-semibold text-text-muted">Its jobs show &quot;Posted by JobWahala on behalf of the company&quot;. When the owner is ready, send a claim link so they can take over and see the applicants.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="growth-company-name" className={label}>Company name</label>
            <input id="growth-company-name" required minLength={2} value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} className={input} />
          </div>
          <div>
            <label htmlFor="growth-company-industry" className={label}>Sector</label>
            <input id="growth-company-industry" value={form.industry} onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value }))} className={input} />
          </div>
          <div>
            <label htmlFor="growth-company-phone" className={label}>WhatsApp number</label>
            <input id="growth-company-phone" value={form.contactPhone} onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))} placeholder="024 123 4567" className={input} />
          </div>
          <div>
            <label htmlFor="growth-company-website" className={label}>Website (optional)</label>
            <input id="growth-company-website" value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} className={input} />
          </div>
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary mt-5 disabled:opacity-60">
          <Plus className="h-4 w-4" aria-hidden /> Create company
        </button>
      </form>

      {error ? <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error}</p> : null}
      {notice ? <p role="status" className="rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-success">{notice}</p> : null}

      {companies.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-border p-6 text-sm font-semibold text-text-light">No companies set up by an admin yet.</div>
      ) : (
        companies.map((company) => {
          const claim = company.claim
          const link = issued?.companyId === company.id ? issued : null
          return (
            <article key={company.id} aria-label={company.companyName} className="rounded-3xl border border-surface-border bg-surface-alt/20 p-5 sm:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xl font-black text-text-main">
                    {company.companyName}
                    {company.isFoundingEmployer ? <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary">Founding #{company.foundingNumber}</span> : null}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-text-muted">
                    {[company.industry, company.contactPhone, company.email].filter(Boolean).join(' · ') || 'No contact details'} · {company.jobs} {company.jobs === 1 ? 'job' : 'jobs'}
                  </p>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-secondary">
                    {company.claimStatus === 'CLAIMED' ? 'Taken over by its owner' : claim ? `${CLAIM_TEXT[claim.state]} · sent ${claim.sendCount} ${claim.sendCount === 1 ? 'time' : 'times'} by ${claim.channel.toLowerCase()}${claim.sentTo ? ` to ${claim.sentTo}` : ''}${claim.state === 'ACTIVE' ? `, expires ${day(claim.expiresAt)}` : ''}` : 'Waiting for the owner · no link sent yet'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onPostJob(company.id)} className="btn btn-outline btn-sm">Post a job</button>
                </div>
              </div>

              {company.claimStatus === 'UNCLAIMED' ? (
                <div className="mt-4 grid gap-3 border-t border-surface-border/60 pt-4 lg:grid-cols-[1fr_auto]">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="sr-only" htmlFor={`claim-email-${company.id}`}>Email for {company.companyName}</label>
                    <input id={`claim-email-${company.id}`} type="email" placeholder="Owner's email" value={emails[company.id] || ''} onChange={(event) => setEmails((current) => ({ ...current, [company.id]: event.target.value }))} className="min-w-0 flex-1 rounded-xl border border-surface-border bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary" />
                    <button type="button" disabled={busy || !(emails[company.id] || '').trim()} onClick={() => issue(company, 'EMAIL')} className="btn btn-primary btn-sm disabled:opacity-60">
                      {claim ? 'Resend by email' : 'Email claim link'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy || !company.contactPhone} onClick={() => issue(company, 'WHATSAPP')} className="btn btn-outline btn-sm disabled:opacity-60" title={company.contactPhone ? undefined : 'Add a WhatsApp number when creating the company'}>
                      <MessageCircle className="h-4 w-4" aria-hidden /> {claim ? 'Resend on WhatsApp' : 'WhatsApp claim link'}
                    </button>
                    <button type="button" disabled={busy} onClick={() => issue(company, 'LINK')} className="btn btn-outline btn-sm disabled:opacity-60">
                      <Link2 className="h-4 w-4" aria-hidden /> New link only
                    </button>
                    {claim?.state === 'ACTIVE' ? (
                      <button type="button" disabled={busy} onClick={() => void run(async () => { await apiAdminRevokeClaim(claim.id); setNotice('Link cancelled. It no longer works.'); await load() })} className="btn btn-outline btn-sm text-error disabled:opacity-60">
                        <XCircle className="h-4 w-4" aria-hidden /> Revoke link
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {link ? (
                <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4" aria-label="New claim link">
                  <p className="text-xs font-black uppercase tracking-widest text-primary">New link (shown once; earlier links no longer work)</p>
                  <p className="mt-2 break-all text-sm font-semibold text-text-main">{link.url}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void copy(link.url)} className="btn btn-outline btn-sm"><Copy className="h-4 w-4" aria-hidden /> Copy link</button>
                    {link.whatsappUrl ? (
                      <a href={link.whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#1ebe5b]">
                        <MessageCircle className="h-4 w-4" aria-hidden /> Open WhatsApp with the message
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          )
        })
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Founding Employers

function FoundingSection({ companies }: { companies: CompanyOption[] }) {
  const queryClient = useQueryClient()
  const [data, setData] = useState<FoundingData | null>(null)
  const [limit, setLimit] = useState('50')
  const [credits, setCredits] = useState('3')
  const [pick, setPick] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const result = (await apiAdminFounding()) as { founding: FoundingData }
      setData(result.founding)
      setLimit(String(result.founding.limit))
      setCredits(String(result.founding.featuredCredits))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the programme.'))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: () => Promise<void>) => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await action()
      await load()
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const founderIds = new Set(data?.companies.map((company) => company.id))

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-surface-border bg-white/80 p-6" aria-label="Founding Employer settings">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Founding Employer programme</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-text-main">{data ? `${data.taken} of ${data.limit} places taken` : 'Founding Employers'}</h2>
        <p className="mt-2 text-sm font-semibold text-text-muted">A Founding Employer gets a badge on their company page and free featured-listing credits. The badge does not mean the company has been checked.</p>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              await apiAdminSaveFoundingSettings({ limit: Number(limit), featuredCredits: Number(credits) })
              setNotice('Settings saved.')
            })
          }}
        >
          <div>
            <label htmlFor="founding-limit" className={label}>Number of places</label>
            <input id="founding-limit" type="number" min={1} max={1000} value={limit} onChange={(event) => setLimit(event.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="founding-credits" className={label}>Free featured credits each</label>
            <input id="founding-credits" type="number" min={0} max={50} value={credits} onChange={(event) => setCredits(event.target.value)} className={input} />
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-60">Save settings</button>
        </form>
      </section>

      <section className="rounded-3xl border border-surface-border bg-white/80 p-6" aria-label="Add a Founding Employer">
        <label htmlFor="founding-company" className={label}>Make a company a Founding Employer</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <select id="founding-company" value={pick} onChange={(event) => setPick(event.target.value)} className={`${input} mt-0 flex-1`}>
            <option value="">Choose a company</option>
            {companies.filter((company) => !founderIds.has(company.id)).map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <button type="button" disabled={busy || !pick} onClick={() => void run(async () => { const result = (await apiAdminSetFounding(pick, true)) as { foundingNumber: number; creditsGiven: number }; setNotice(`Founding Employer #${result.foundingNumber}. ${result.creditsGiven} free featured ${result.creditsGiven === 1 ? 'credit' : 'credits'} given.`); setPick('') })} className="btn btn-primary disabled:opacity-60">
            <Award className="h-4 w-4" aria-hidden /> Make Founding Employer
          </button>
        </div>
      </section>

      {error ? <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error}</p> : null}
      {notice ? <p role="status" className="rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-success">{notice}</p> : null}

      {data && data.companies.length > 0 ? (
        <ul className="space-y-3" aria-label="Founding Employers">
          {data.companies.map((company) => (
            <li key={company.id} className="flex items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-alt/20 p-4">
              <p className="text-sm font-black text-text-main">#{company.number} {company.companyName}<span className="ml-2 text-xs font-semibold text-text-muted">since {day(company.since)}</span></p>
              <button type="button" disabled={busy} onClick={() => void run(async () => { await apiAdminSetFounding(company.id, false); setNotice('Badge removed. The credits already given stay.') })} className="text-xs font-black uppercase tracking-widest text-error hover:underline">Remove badge</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ outreach tracker

type OutreachForm = { businessName: string; contactName: string; contactPhone: string; contactEmail: string; sector: string; location: string; status: OutreachStatus; notes: string; followUpAt: string }
const emptyOutreach: OutreachForm = { businessName: '', contactName: '', contactPhone: '', contactEmail: '', sector: '', location: '', status: 'CONTACTED', notes: '', followUpAt: '' }
const toForm = (contact: OutreachContact): OutreachForm => ({
  businessName: contact.businessName,
  contactName: contact.contactName ?? '',
  contactPhone: contact.contactPhone ?? '',
  contactEmail: contact.contactEmail ?? '',
  sector: contact.sector ?? '',
  location: contact.location ?? '',
  status: contact.status,
  notes: contact.notes ?? '',
  followUpAt: contact.followUpAt ? contact.followUpAt.slice(0, 10) : '',
})

function OutreachSection() {
  const [contacts, setContacts] = useState<OutreachContact[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<'ALL' | OutreachStatus>('ALL')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<OutreachForm>(emptyOutreach)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = (await apiAdminOutreach({ status: filter, q: search })) as { contacts: OutreachContact[]; counts: Record<string, number> }
      setContacts(data.contacts)
      setCounts(data.counts)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the contacts.'))
    }
  }, [filter, search])
  // Typing in the search box waits a moment, so the list is not reloaded on every key.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [load, search])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await apiAdminSaveOutreach({ ...form, followUpAt: form.followUpAt || null }, editing && editing !== 'new' ? editing : undefined)
      setEditing(null)
      setForm(emptyOutreach)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save that contact.'))
    }
  }

  const changeStatus = async (contact: OutreachContact, status: OutreachStatus) => {
    setError('')
    try {
      await apiAdminSaveOutreach({ status }, contact.id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not change the status.'))
    }
  }

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
  const field = (key: keyof OutreachForm, text: string, type = 'text') => (
    <div>
      <label htmlFor={`outreach-${key}`} className={label}>{text}</label>
      <input id={`outreach-${key}`} type={type} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className={input} />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-surface-border bg-white/80 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Outreach tracker</p>
          <p className="mt-1 text-sm font-semibold text-text-muted">Employers we have contacted: {total} in all.</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            <button type="button" aria-pressed={filter === 'ALL'} onClick={() => setFilter('ALL')} className={`dashboard-action-chip ${filter === 'ALL' ? 'border-primary/30 bg-primary/10 text-primary' : ''}`}>All ({total})</button>
            {OUTREACH_STATUSES.map((status) => (
              <button key={status.value} type="button" aria-pressed={filter === status.value} onClick={() => setFilter(status.value)} className={`dashboard-action-chip ${filter === status.value ? 'border-primary/30 bg-primary/10 text-primary' : ''}`}>
                {status.label} ({counts[status.value] ?? 0})
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label htmlFor="outreach-search" className={label}>Search</label>
            <input id="outreach-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Business, contact, sector, place" className={input} />
          </div>
          <button type="button" onClick={() => { setEditing('new'); setForm(emptyOutreach) }} className="btn btn-primary"><Plus className="h-4 w-4" aria-hidden /> Add employer</button>
        </div>
      </div>

      {error ? <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error}</p> : null}

      {editing ? (
        <form onSubmit={save} className="rounded-3xl border border-primary/20 bg-white p-6" aria-label={editing === 'new' ? 'Add an employer' : 'Edit an employer'}>
          <div className="grid gap-4 md:grid-cols-2">
            {field('businessName', 'Business name')}
            {field('contactName', 'Contact person')}
            {field('contactPhone', 'Phone / WhatsApp')}
            {field('contactEmail', 'Email', 'email')}
            {field('sector', 'Sector')}
            {field('location', 'Location')}
            <div>
              <label htmlFor="outreach-status" className={label}>Status</label>
              <select id="outreach-status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as OutreachStatus }))} className={input}>
                {OUTREACH_STATUSES.map((status) => (<option key={status.value} value={status.value}>{status.label}</option>))}
              </select>
            </div>
            {field('followUpAt', 'Follow up on', 'date')}
            <div className="md:col-span-2">
              <label htmlFor="outreach-notes" className={label}>Notes</label>
              <textarea id="outreach-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={`${input} min-h-[90px]`} />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" className="btn btn-primary">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="btn btn-outline">Cancel</button>
          </div>
        </form>
      ) : null}

      {contacts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-border p-6 text-sm font-semibold text-text-light">No employers here yet.</div>
      ) : (
        <ul className="space-y-3" aria-label="Employers contacted">
          {contacts.map((contact) => {
            const due = isFollowUpDue(contact)
            return (
              <li key={contact.id} className={`rounded-3xl border p-5 ${due ? 'border-gold bg-gold/10' : 'border-surface-border bg-surface-alt/20'}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-text-main">{contact.businessName}</p>
                    <p className="mt-1 text-xs font-semibold text-text-muted">{[contact.contactName, contact.contactPhone, contact.contactEmail, contact.sector, contact.location].filter(Boolean).join(' · ') || 'No details'}</p>
                    {contact.notes ? <p className="mt-2 text-sm font-medium text-text-main">{contact.notes}</p> : null}
                    {contact.followUpAt ? (
                      <p className={`mt-2 inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest ${due ? 'text-primary' : 'text-text-light'}`}>
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Follow up {day(contact.followUpAt)}{due ? ' (due)' : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`status-${contact.id}`}>Status for {contact.businessName}</label>
                    <select id={`status-${contact.id}`} value={contact.status} onChange={(event) => void changeStatus(contact, event.target.value as OutreachStatus)} className="rounded-xl border border-surface-border bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-text-main">
                      {OUTREACH_STATUSES.map((status) => (<option key={status.value} value={status.value}>{status.label}</option>))}
                    </select>
                    <button type="button" aria-label={`Edit ${contact.businessName}`} onClick={() => { setEditing(contact.id); setForm(toForm(contact)) }} className="rounded-xl border border-surface-border bg-white p-2 text-text-muted hover:border-primary hover:text-primary"><Pencil className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Delete ${contact.businessName}`} onClick={() => { if (window.confirm(`Delete ${contact.businessName} from the tracker?`)) void apiAdminDeleteOutreach(contact.id).then(load).catch((err) => setError(getErrorMessage(err, 'Could not delete that contact.'))) }} className="rounded-xl border border-surface-border bg-white p-2 text-text-muted hover:border-error hover:text-error"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
