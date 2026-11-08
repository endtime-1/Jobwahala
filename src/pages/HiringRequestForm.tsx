import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SEO from '../components/SEO'
import PageHero from '../components/PageHero'
import { useAuth } from '../context/AuthContext'
import { apiCreateHiringRequest } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

const input = 'mt-1 w-full rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm font-semibold text-text-main outline-none focus:border-primary'
const label = 'block text-sm font-bold text-text-main'

/** "Let JobWahala hire for you": the employer describes the role. We contact them to agree the terms. */
export default function HiringRequestForm() {
  const { role, user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({ roleTitle: '', headcount: '1', salaryMin: '', salaryMax: '', location: '', startDate: '', deadline: '', requirements: '', contactName: '', contactPhone: '' })
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      const data = (await apiCreateHiringRequest({
        roleTitle: form.roleTitle,
        headcount: Number(form.headcount) || 1,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
        location: form.location,
        startDate: form.startDate || null,
        deadline: form.deadline || null,
        requirements: form.requirements,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
      })) as { request: { id: string } }
      navigate(`/hiring-service/${data.request.id}`)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not send your request. Please try again.'))
      setIsSaving(false)
    }
  }

  if (!user || role !== 'EMPLOYER') {
    return (
      <div className="container max-w-3xl pb-20 pt-28">
        <p className="rounded-2xl border border-surface-border bg-white p-6 text-base font-semibold text-text-main">
          The Hiring Service is for employer accounts. <Link to="/signup?role=employer" className="font-black text-primary hover:underline">Sign up as an employer</Link> or <Link to="/login" className="font-black text-primary hover:underline">log in</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="pb-20 pt-24 xl:pt-28">
      <SEO title="Let JobWahala hire for you" noindex />
      <div className="container max-w-3xl">
        <PageHero eyebrow="Hiring Service" title="Let JobWahala" accent="hire for you">
          <p className="mt-4 text-base font-medium text-white/75">Tell us about the role. We will contact you to agree the terms before any work starts.</p>
        </PageHero>

        <form onSubmit={submit} aria-label="Hiring request" className="dashboard-panel mt-8 space-y-5 p-6 sm:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <label className={label}>Role<input required minLength={2} value={form.roleTitle} onChange={set('roleTitle')} className={input} /></label>
            <label className={label}>Number of hires<input type="number" min={1} max={50} value={form.headcount} onChange={set('headcount')} className={input} /></label>
            <label className={label}>Lowest salary (GHS a month)<input type="number" min={0} value={form.salaryMin} onChange={set('salaryMin')} className={input} /></label>
            <label className={label}>Highest salary (GHS a month)<input type="number" min={0} value={form.salaryMax} onChange={set('salaryMax')} className={input} /></label>
            <label className={label}>Location<input required minLength={2} value={form.location} onChange={set('location')} className={input} /></label>
            <label className={label}>Start date<input type="date" value={form.startDate} onChange={set('startDate')} className={input} /></label>
            <label className={`${label} md:col-span-2`}>Deadline (when you need the hire by)<input type="date" value={form.deadline} onChange={set('deadline')} className={input} /></label>
            <label className={`${label} md:col-span-2`}>Requirements
              <textarea required minLength={20} value={form.requirements} onChange={set('requirements')} placeholder="What will the person do? What skills and experience do they need?" className={`${input} min-h-[140px]`} />
            </label>
            <label className={label}>Contact person<input required minLength={2} value={form.contactName} onChange={set('contactName')} className={input} /></label>
            <label className={label}>Contact phone<input required minLength={7} value={form.contactPhone} onChange={set('contactPhone')} className={input} /></label>
          </div>

          {error ? <p role="alert" className="text-sm font-bold text-error">{error}</p> : null}
          <button type="submit" disabled={isSaving} className="btn btn-primary btn-lg disabled:opacity-60">{isSaving ? 'Sending...' : 'Send my request'}</button>
          <p className="text-xs font-medium text-text-muted">
            Sending a request is free and does not commit you to anything. See the <Link to="/terms" className="font-bold text-primary hover:underline">Terms</Link> for how the Hiring Service works.
          </p>
        </form>
      </div>
    </div>
  )
}
