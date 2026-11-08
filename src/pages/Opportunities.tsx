import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, MapPin } from 'lucide-react'
import SEO from '../components/SEO'
import PageHero from '../components/PageHero'
import { apiOpportunities, apiRespondToOpportunity } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { salaryLabel, type Opportunity } from '../lib/hiring'

/**
 * Roles a JobWahala recruiter has asked this person about. Nothing about them reaches the hiring company until they say yes here.
 */
export default function Opportunities() {
  const [items, setItems] = useState<Opportunity[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const data = (await apiOpportunities()) as { opportunities: Opportunity[] }
      setItems(data.opportunities)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load your opportunities.'))
      setItems([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const respond = async (id: string, accept: boolean) => {
    setError('')
    setBusy(id)
    try {
      await apiRespondToOpportunity(id, { accept, ...(accept ? {} : { reason: reasons[id] || undefined }) })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'We could not save your answer. Please try again.'))
    } finally {
      setBusy('')
    }
  }

  const waiting = (items ?? []).filter((item) => !item.answered)
  const answered = (items ?? []).filter((item) => item.answered)

  return (
    <div className="pb-20 pt-24 xl:pt-28">
      <SEO title="Opportunities from recruiters" noindex />
      <div className="container max-w-4xl">
        <PageHero eyebrow="Recruiters" title="A recruiter has a role for you">
          <p className="mt-4 max-w-2xl text-base font-medium text-white/75">Say yes and we put you forward. Say no and nothing is shared. You are always in control.</p>
        </PageHero>

        {error ? <p role="alert" className="mt-6 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">{error}</p> : null}

        {items === null ? <div className="mt-8 h-40 animate-pulse rounded-3xl bg-surface-alt/60" aria-label="Loading" /> : null}

        {items && waiting.length === 0 && answered.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-surface-border p-8 text-center">
            <p className="text-base font-semibold text-text-main">No recruiter has asked about a role yet.</p>
            <p className="mt-1 text-sm font-medium text-text-muted">To be found, set your profile to visible to verified employers.</p>
            <Link to="/dashboard" className="btn btn-outline btn-sm mt-4 inline-flex">Go to my dashboard</Link>
          </div>
        ) : null}

        {waiting.length > 0 ? (
          <section aria-labelledby="waiting-heading" className="mt-8">
            <h2 id="waiting-heading" className="text-2xl font-black text-text-main">Waiting for your answer</h2>
            <ul className="mt-4 space-y-5">
              {waiting.map((item) => (
                <li key={item.id} aria-label={item.roleTitle} className="dashboard-panel p-6">
                  <h3 className="text-xl font-black text-text-main">{item.roleTitle}</h3>
                  <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold text-text-muted">
                    <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4" aria-hidden /> {item.company}</span>
                    <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden /> {item.location}</span>
                    <span>{salaryLabel(item.salaryMin, item.salaryMax)}</span>
                  </p>
                  <p className="mt-4 whitespace-pre-line text-sm font-medium leading-6 text-text-main">{item.description}</p>
                  {item.recruiter ? <p className="mt-3 text-xs font-semibold text-text-light">Recruiter: {item.recruiter.name}{item.recruiter.title ? `, ${item.recruiter.title}` : ''}</p> : null}

                  <div className="mt-5 rounded-2xl bg-surface-alt/60 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-text-light">What saying yes means</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-text-main">{item.consentText}</p>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button type="button" disabled={busy === item.id} onClick={() => void respond(item.id, true)} className="btn btn-primary justify-center">Yes, put me forward</button>
                    <div className="flex flex-1 gap-2">
                      <label className="sr-only" htmlFor={`reason-${item.id}`}>Why not (optional)</label>
                      <input id={`reason-${item.id}`} value={reasons[item.id] || ''} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Why not? (optional)" className="min-w-0 flex-1 rounded-xl border border-surface-border bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary" />
                      <button type="button" disabled={busy === item.id} onClick={() => void respond(item.id, false)} className="btn btn-outline">No thanks</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {answered.length > 0 ? (
          <section aria-labelledby="answered-heading" className="mt-10">
            <h2 id="answered-heading" className="text-xl font-black text-text-main">Your answers</h2>
            <ul className="mt-3 space-y-2">
              {answered.map((item) => (
                <li key={item.id} className="dashboard-panel flex items-center justify-between gap-3 p-4">
                  <span>
                    <span className="block text-sm font-black text-text-main">{item.roleTitle}</span>
                    <span className="text-xs font-semibold text-text-muted">{item.company}</span>
                  </span>
                  <span className={`text-xs font-black uppercase tracking-widest ${item.stage === 'DECLINED' ? 'text-text-light' : 'text-success'}`}>{item.stage === 'DECLINED' ? 'You said no' : 'You said yes'}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
