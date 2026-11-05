import { useCallback, useEffect, useState } from 'react'
import { apiGetCourseQueue, apiReviewCourse, apiReviewCourseProvider, apiSetCourseFeatured } from '../lib/api'
import { categoryName, priceLabel, skillLabel } from '../lib/courses'
import { getErrorMessage } from '../lib/errors'

type QueueProvider = { userId: string; companyName: string; description: string | null; website: string | null; email: string | null; isVerified: boolean }
type QueueCourse = {
  id: string
  slug: string
  title: string
  summary: string
  description: string
  category: string
  isFree: boolean
  priceGhs: number | null
  enrolUrl: string | null
  skills: string[]
  status: string
  reviewStatus: string
  reviewNote: string | null
  featured: boolean
  featuredUntil: string | null
  providerId: string
  providerName: string
  providerStatus: string
}

/** The admin's view of courses: providers and listings waiting, approve, reject or remove (with a reason), and feature a listing. */
export default function AdminCoursesPanel() {
  const [providers, setProviders] = useState<QueueProvider[]>([])
  const [pending, setPending] = useState<QueueCourse[]>([])
  const [recent, setRecent] = useState<QueueCourse[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [days, setDays] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = (await apiGetCourseQueue()) as { providers: QueueProvider[]; pending: QueueCourse[]; recent: QueueCourse[] }
      setProviders(data.providers)
      setPending(data.pending)
      setRecent(data.recent)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load the course queue.'))
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on first show
    void load()
  }, [load])

  const act = async (action: () => Promise<unknown>) => {
    setError('')
    try {
      await action()
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work.'))
    }
  }

  const reason = (key: string) => reasons[key] ?? ''
  const reasonBox = (key: string) => (
    <input
      value={reason(key)}
      onChange={(e) => setReasons((current) => ({ ...current, [key]: e.target.value }))}
      placeholder="Reason (needed to reject or remove)"
      aria-label={`Reason for ${key}`}
      className="h-10 w-full text-sm font-semibold"
    />
  )

  const courseRow = (course: QueueCourse, withReview: boolean) => (
    <li key={course.id} className="rounded-2xl border border-surface-border bg-white p-4">
      <p className="text-base font-extrabold text-text-main">{course.title}</p>
      <p className="text-sm font-semibold text-text-muted">
        {course.providerName} ({course.providerStatus.toLowerCase()}) · {categoryName(course.category)} · {priceLabel(course)} · {course.reviewStatus.toLowerCase()}
        {course.status === 'PAUSED' ? ' · paused' : ''}
        {course.featured ? ' · featured' : ''}
      </p>
      <p className="mt-2 text-sm font-medium text-text-main">{course.summary}</p>
      {withReview ? <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs font-medium text-text-muted">{course.description}</p> : null}
      <p className="mt-1 text-xs font-semibold text-text-light">
        Skills: {course.skills.map(skillLabel).join(', ') || 'none'}
        {course.enrolUrl ? ` · Link: ${course.enrolUrl}` : ''}
      </p>
      {course.reviewNote ? <p className="mt-1 text-xs font-semibold text-error">Note: {course.reviewNote}</p> : null}

      <div className="mt-3 space-y-2">
        {reasonBox(course.id)}
        <div className="flex flex-wrap items-center gap-2">
          {course.reviewStatus !== 'APPROVED' ? (
            <button type="button" onClick={() => void act(() => apiReviewCourse(course.id, 'APPROVE'))} className="btn btn-primary btn-sm">
              Approve {course.title}
            </button>
          ) : null}
          {course.reviewStatus === 'PENDING' ? (
            <button type="button" onClick={() => void act(() => apiReviewCourse(course.id, 'REJECT', reason(course.id)))} className="btn btn-outline btn-sm bg-white">
              Reject {course.title}
            </button>
          ) : null}
          {course.reviewStatus !== 'REMOVED' ? (
            <button type="button" onClick={() => void act(() => apiReviewCourse(course.id, 'REMOVE', reason(course.id)))} className="btn btn-outline btn-sm bg-white text-error">
              Remove {course.title}
            </button>
          ) : null}
        </div>

        {course.reviewStatus === 'APPROVED' ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-text-muted">
              Feature for (days)
              <input
                type="number"
                min={0}
                max={365}
                value={days[course.id] ?? '30'}
                onChange={(e) => setDays((current) => ({ ...current, [course.id]: e.target.value }))}
                className="ml-2 h-9 w-20 text-sm font-semibold"
              />
            </label>
            <button type="button" onClick={() => void act(() => apiSetCourseFeatured(course.id, Number(days[course.id] ?? '30')))} className="btn btn-outline btn-sm bg-white">
              Set featured
            </button>
            {course.featured ? <span className="text-xs font-semibold text-text-muted">until {course.featuredUntil ? new Date(course.featuredUntil).toLocaleDateString('en-GB') : ''} (0 days stops it)</span> : null}
          </div>
        ) : null}
      </div>
    </li>
  )

  if (!loaded) return <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading courses...</p>

  return (
    <div className="space-y-8">
      {error ? (
        <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      <section aria-label="Training providers waiting">
        <h3 className="mb-3 text-lg font-black text-text-main">Training providers waiting ({providers.length})</h3>
        {providers.length === 0 ? <p className="text-sm font-semibold text-text-muted">None waiting.</p> : null}
        <ul className="space-y-3">
          {providers.map((provider) => (
            <li key={provider.userId} className="rounded-2xl border border-surface-border bg-white p-4">
              <p className="text-base font-extrabold text-text-main">
                {provider.companyName} {provider.isVerified ? <span className="ml-1 text-xs font-bold text-success">verified business</span> : <span className="ml-1 text-xs font-bold text-text-light">not verified</span>}
              </p>
              <p className="text-sm font-semibold text-text-muted">{[provider.email, provider.website].filter(Boolean).join(' · ')}</p>
              {provider.description ? <p className="mt-1 text-sm font-medium text-text-main">{provider.description}</p> : null}
              <div className="mt-3 space-y-2">
                {reasonBox(provider.userId)}
                <div className="flex gap-2">
                  <button type="button" onClick={() => void act(() => apiReviewCourseProvider(provider.userId, 'APPROVE'))} className="btn btn-primary btn-sm">
                    Approve {provider.companyName}
                  </button>
                  <button type="button" onClick={() => void act(() => apiReviewCourseProvider(provider.userId, 'REJECT', reason(provider.userId)))} className="btn btn-outline btn-sm bg-white">
                    Reject {provider.companyName}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Course listings waiting">
        <h3 className="mb-3 text-lg font-black text-text-main">Course listings waiting ({pending.length})</h3>
        {pending.length === 0 ? <p className="text-sm font-semibold text-text-muted">None waiting.</p> : null}
        <ul className="space-y-3">{pending.map((course) => courseRow(course, true))}</ul>
      </section>

      <section aria-label="Recent course decisions">
        <h3 className="mb-3 text-lg font-black text-text-main">Recent listings</h3>
        <ul className="space-y-3">{recent.map((course) => courseRow(course, false))}</ul>
      </section>
    </div>
  )
}
