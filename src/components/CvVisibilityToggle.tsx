import { useEffect, useState, type FormEvent } from 'react'
import { Rocket } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiBlockCompany, apiGetBillingCatalogue, apiGetCvActivity, apiStartCheckout, apiUnblockCompany, apiUpdateProfile } from '../lib/api'
import { AVAILABILITY_OPTIONS, EDUCATION_OPTIONS } from '../lib/cvDatabase'
import { formatShortDate } from '../lib/display'
import { getErrorMessage } from '../lib/errors'
import type { Product } from '../lib/billing'

type Activity = { kind: 'VIEWED' | 'UNLOCKED'; employerId: string; company: string; at: string }
type Blocked = { employerId: string; company: string; at: string }

/**
 * The job seeker's side of the CV database: whether verified employers can find them, what employers see, who looked, which
 * companies are blocked, and the paid profile boost. Hidden unless they choose otherwise.
 */
export default function CvVisibilityToggle() {
  const { user, refreshUser } = useAuth()
  const profile = user?.jobSeekerProfile
  const visible = profile?.cvVisibility === 'VERIFIED_EMPLOYERS'

  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activity, setActivity] = useState<Activity[]>([])
  const [blocked, setBlocked] = useState<Blocked[]>([])
  const [boost, setBoost] = useState<Product | null>(null)
  const [headline, setHeadline] = useState(profile?.headline ?? '')
  const [location, setLocation] = useState(profile?.location ?? '')
  const [education, setEducation] = useState(profile?.educationLevel ?? '')
  const [availability, setAvailability] = useState(profile?.availability ?? '')
  const [years, setYears] = useState(profile?.yearsExperience != null ? String(profile.yearsExperience) : '')
  const [category, setCategory] = useState(profile?.jobCategory ?? '')

  const loadActivity = async () => {
    try {
      const data = (await apiGetCvActivity()) as { activity: Activity[]; blocked: Blocked[] }
      setActivity(data.activity)
      setBlocked(data.blocked)
    } catch {
      // The panel still works without the list.
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = (await apiGetCvActivity()) as { activity: Activity[]; blocked: Blocked[] }
        if (!cancelled) {
          setActivity(data.activity)
          setBlocked(data.blocked)
        }
        const catalogue = (await apiGetBillingCatalogue()) as { products: Product[] }
        if (!cancelled) setBoost(catalogue.products.find((item) => item.kind === 'PROFILE_BOOST') ?? null)
      } catch {
        // Not worth an error on the dashboard.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const run = async (key: string, action: () => Promise<void>) => {
    setError('')
    setNotice('')
    setBusy(key)
    try {
      await action()
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work. Please try again.'))
    } finally {
      setBusy('')
    }
  }

  const choose = (next: 'HIDDEN' | 'VERIFIED_EMPLOYERS') =>
    run('visibility', async () => {
      await apiUpdateProfile({ cvVisibility: next })
      await refreshUser()
    })

  const saveDetails = (event: FormEvent) => {
    event.preventDefault()
    void run('details', async () => {
      await apiUpdateProfile({ headline: headline.trim(), location: location.trim(), educationLevel: education, availability, yearsExperience: years === '' ? null : Number(years), jobCategory: category.trim() })
      await refreshUser()
      setNotice('Saved.')
    })
  }

  const buyBoost = () =>
    run('boost', async () => {
      if (!boost) return
      const result = (await apiStartCheckout(boost.id)) as { authorizationUrl: string }
      window.location.assign(result.authorizationUrl)
    })

  const block = (company: Blocked | Activity) =>
    run(`block-${company.employerId}`, async () => {
      await apiBlockCompany(company.employerId)
      await loadActivity()
    })
  const unblock = (company: Blocked) =>
    run(`block-${company.employerId}`, async () => {
      await apiUnblockCompany(company.employerId)
      await loadActivity()
    })

  if (!user) return null

  const boostedUntil = profile?.profileBoostedUntil && new Date(profile.profileBoostedUntil).getTime() > Date.now() ? profile.profileBoostedUntil : null
  const blockedIds = new Set(blocked.map((item) => item.employerId))
  const seen = activity.filter((item, index, all) => all.findIndex((other) => other.employerId === item.employerId && other.kind === item.kind) === index)

  return (
    <section className="dashboard-panel mb-8 p-4 sm:p-6" aria-label="Let employers find me">
      <h2 className="text-base font-black text-text-main">Can employers find your profile?</h2>
      <fieldset className="mt-3 space-y-2" disabled={busy === 'visibility'}>
        <legend className="sr-only">Who can find your profile</legend>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="radio" name="cv-visibility" checked={!visible} onChange={() => void choose('HIDDEN')} className="mt-1" />
          <span className="text-sm font-medium text-text-muted">
            <strong className="text-text-main">Hidden</strong>: nobody can find you in the CV database.
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="radio" name="cv-visibility" checked={visible} onChange={() => void choose('VERIFIED_EMPLOYERS')} className="mt-1" />
          <span className="text-sm font-medium text-text-muted">
            <strong className="text-text-main">Visible to verified employers</strong>: verified employers on a paid plan see your headline, skills, experience summary, location, education level and availability. Your name, phone, email and CV stay hidden until an employer unlocks your profile.
          </span>
        </label>
      </fieldset>

      {visible ? (
        <form onSubmit={saveDetails} className="mt-5 grid gap-3 border-t border-surface-border/60 pt-5 sm:grid-cols-2">
          <label className="block text-sm font-bold text-text-main sm:col-span-2">
            Headline
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} className="mt-1 w-full" placeholder="e.g. Accountant with 3 years in retail" />
          </label>
          <label className="block text-sm font-bold text-text-main">
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} className="mt-1 w-full" placeholder="e.g. Accra" />
          </label>
          <label className="block text-sm font-bold text-text-main">
            Job category
            <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80} className="mt-1 w-full" placeholder="e.g. Finance" />
          </label>
          <label className="block text-sm font-bold text-text-main">
            Education level
            <select value={education} onChange={(e) => setEducation(e.target.value)} className="mt-1 h-11 w-full">
              <option value="">Not saying</option>
              {EDUCATION_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold text-text-main">
            Availability
            <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="mt-1 h-11 w-full">
              <option value="">Not saying</option>
              {AVAILABILITY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold text-text-main">
            Years of experience
            <input type="number" min={0} max={60} value={years} onChange={(e) => setYears(e.target.value)} className="mt-1 w-full" />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={busy === 'details'} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
              Save these details
            </button>
          </div>
        </form>
      ) : null}

      {visible && boost ? (
        <div className="mt-5 rounded-xl bg-gold/10 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-text-main">
            <Rocket className="h-4 w-4" aria-hidden /> Profile boost
          </p>
          <p className="mt-1 text-sm font-medium text-text-muted">
            {boostedUntil ? `Your profile is boosted until ${formatShortDate(boostedUntil)}. ` : ''}
            Show your profile higher in CV database results for {boost.durationDays ?? 30} days, marked &quot;Boosted&quot; for employers. It does not show your contact details to anyone.
          </p>
          <button type="button" disabled={busy === 'boost'} onClick={() => void buyBoost()} className="btn btn-primary btn-sm mt-3 disabled:opacity-60">
            {busy === 'boost' ? 'Opening Paystack...' : boostedUntil ? `Extend for ${boost.totalLabel}` : `Boost for ${boost.totalLabel}`}
          </button>
        </div>
      ) : null}

      {seen.length > 0 || blocked.length > 0 ? (
        <div className="mt-5 border-t border-surface-border/60 pt-5">
          <h3 className="text-sm font-black text-text-main">Who looked at your profile</h3>
          {seen.length === 0 ? <p className="mt-1 text-sm font-medium text-text-muted">Nobody yet.</p> : null}
          <ul className="mt-2 divide-y divide-surface-border/60">
            {seen.map((item) => (
              <li key={`${item.kind}-${item.employerId}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-semibold text-text-main">
                  {item.company} <span className="font-medium text-text-muted">{item.kind === 'UNLOCKED' ? 'unlocked your profile' : 'viewed your profile'} on {formatShortDate(item.at)}</span>
                </span>
                {blockedIds.has(item.employerId) ? null : (
                  <button type="button" disabled={busy === `block-${item.employerId}`} onClick={() => void block(item)} aria-label={`Block ${item.company}`} className="text-xs font-black uppercase tracking-widest text-error hover:underline disabled:opacity-60">
                    Block
                  </button>
                )}
              </li>
            ))}
          </ul>
          {blocked.length > 0 ? (
            <>
              <h3 className="mt-4 text-sm font-black text-text-main">Blocked companies</h3>
              <ul className="mt-2 divide-y divide-surface-border/60">
                {blocked.map((item) => (
                  <li key={item.employerId} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-semibold text-text-main">{item.company}</span>
                    <button type="button" disabled={busy === `block-${item.employerId}`} onClick={() => void unblock(item)} aria-label={`Unblock ${item.company}`} className="text-xs font-black uppercase tracking-widest text-primary hover:underline disabled:opacity-60">
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <p role="status" className="mt-3 text-sm font-bold text-success">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </section>
  )
}
