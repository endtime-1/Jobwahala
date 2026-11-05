import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Eye, MessageSquare, MousePointerClick, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import CourseForm from '../components/CourseForm'
import type { CourseFormValues } from '../lib/courseForm'
import SEO from '../components/SEO'
import {
  apiCreateCourse,
  apiDecideCompletion,
  apiEnableProvider,
  apiGetProviderStatus,
  apiListCompletionRequests,
  apiListCourseEnquiries,
  apiListMyCourses,
  apiMarkCourseEnquiryRead,
  apiPauseCourse,
  apiRemoveCourse,
  apiResumeCourse,
  apiUpdateCourse,
} from '../lib/api'
import { categoryName, priceLabel } from '../lib/courses'
import { formatShortDate } from '../lib/display'
import { getErrorMessage } from '../lib/errors'

type Stats = { views: number; clicks: number; enquiries: number }
type MyCourse = {
  id: string
  slug: string
  title: string
  summary: string
  description: string
  category: string
  level: string
  isFree: boolean
  priceGhs: number | null
  durationWeeks: number | null
  format: string
  location: string | null
  startDates: string[]
  rollingStart: boolean
  certificateOffered: boolean
  enrolUrl: string | null
  enquiryEnabled: boolean
  skills: string[]
  status: 'ACTIVE' | 'PAUSED'
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REMOVED'
  reviewNote: string | null
  featured: boolean
  stats: { allTime: Stats; last30Days: Stats }
}
type Enquiry = { id: string; name: string; email: string | null; phone: string | null; message: string; status: string; createdAt: string; course: { id: string; title: string } }
type CompletionRequest = { id: string; courseTitle: string; learnerName: string; completedOn: string | null; certificateUrl: string | null; status: string }
type Provider = { isTrainingProvider: boolean; status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'; reviewNote?: string | null }

const toForm = (course: MyCourse): CourseFormValues => ({
  title: course.title,
  summary: course.summary,
  description: course.description,
  category: course.category,
  level: course.level,
  isFree: course.isFree,
  priceGhs: course.priceGhs != null ? String(course.priceGhs) : '',
  durationWeeks: course.durationWeeks != null ? String(course.durationWeeks) : '',
  format: course.format,
  location: course.location ?? '',
  startDates: course.startDates,
  rollingStart: course.rollingStart,
  certificateOffered: course.certificateOffered,
  enrolUrl: course.enrolUrl ?? '',
  enquiryEnabled: course.enquiryEnabled,
  skills: course.skills,
})

const REVIEW_LABEL: Record<string, string> = { PENDING: 'Waiting for approval', APPROVED: 'Live', REJECTED: 'Not approved', REMOVED: 'Removed' }

/** A training provider's home: their courses with views, clicks and enquiries, the questions learners sent, and completions to confirm. */
export default function ProviderDashboard() {
  const [provider, setProvider] = useState<Provider | null>(null)
  const [courses, setCourses] = useState<MyCourse[]>([])
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [requests, setRequests] = useState<CompletionRequest[]>([])
  const [tab, setTab] = useState<'courses' | 'enquiries' | 'completions'>('courses')
  const [editing, setEditing] = useState<MyCourse | 'new' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const status = (await apiGetProviderStatus()) as { provider: { isTrainingProvider: boolean; status: Provider['status']; reviewNote?: string | null } }
      setProvider(status.provider)
      if (status.provider.isTrainingProvider) {
        const [mine, asked, done] = await Promise.all([apiListMyCourses(), apiListCourseEnquiries(), apiListCompletionRequests()])
        setCourses(mine.courses ?? [])
        setEnquiries(asked.enquiries ?? [])
        setRequests(done.requests ?? [])
      }
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load your provider dashboard.'))
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on first show
    void load()
  }, [load])

  const act = async (action: () => Promise<unknown>, success = '') => {
    setError('')
    setNotice('')
    try {
      await action()
      if (success) setNotice(success)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work. Please try again.'))
    }
  }

  const save = async (payload: Record<string, unknown>) => {
    if (editing === 'new') {
      await apiCreateCourse(payload)
      setNotice('Saved. JobWahala will check it, then learners can see it.')
    } else if (editing) {
      const res = (await apiUpdateCourse(editing.id, payload)) as { backInReview?: boolean }
      setNotice(res.backInReview ? 'Saved. Because you changed the title, description, price or link, it is being checked again.' : 'Saved.')
    }
    setEditing(null)
    await load()
  }

  if (!loaded) {
    return (
      <div className="container pb-24 pt-28">
        <p className="text-sm font-bold text-text-light">Loading...</p>
      </div>
    )
  }

  const pendingRequests = requests.filter((request) => request.status === 'REQUESTED').length
  const unread = enquiries.filter((enquiry) => enquiry.status === 'NEW').length

  return (
    <div className="container max-w-5xl pb-24 pt-28">
      <SEO title="Training provider dashboard" noindex />
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-text-main">Your courses</h1>
        <p className="mt-2 text-base font-medium text-text-muted">List courses, see how many people look at them, and answer their questions.</p>
      </header>

      {error ? (
        <p role="alert" className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mb-4 rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-text-main">
          {notice}
        </p>
      ) : null}

      {!provider?.isTrainingProvider ? (
        <section className="rounded-2xl border border-surface-border bg-white p-8 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-secondary" aria-hidden />
          <h2 className="mt-3 text-xl font-black text-text-main">Do you run courses or training?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium text-text-muted">List them on JobWahala so job seekers can find them. We check every provider first. It takes a day or two.</p>
          <button type="button" onClick={() => void act(() => apiEnableProvider(), 'Thank you. We will check your organisation and let you know.')} className="btn btn-primary mt-5 px-6">
            We are a training provider
          </button>
        </section>
      ) : (
        <>
          {provider.status === 'PENDING' ? (
            <p className="mb-4 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-semibold text-text-main">
              We are checking your organisation. You can prepare your courses now; learners will see them once you are approved.
            </p>
          ) : null}
          {provider.status === 'REJECTED' ? (
            <p role="alert" className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
              We could not approve your organisation as a training provider{provider.reviewNote ? `: ${provider.reviewNote}` : '.'}{' '}
              <button type="button" onClick={() => void act(() => apiEnableProvider(), 'Thank you. We will look again.')} className="font-black underline">
                Ask us to look again
              </button>
            </p>
          ) : null}

          <div role="tablist" aria-label="Provider sections" className="mb-6 flex flex-wrap gap-2">
            {(
              [
                ['courses', 'Courses'],
                ['enquiries', unread ? `Enquiries (${unread} new)` : 'Enquiries'],
                ['completions', pendingRequests ? `Completions (${pendingRequests} to confirm)` : 'Completions'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`dashboard-action-chip ${tab === value ? 'border-primary/30 bg-primary/10 text-primary' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'courses' ? (
            <section aria-label="Courses" className="space-y-4">
              {editing ? (
                <CourseForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : toForm(editing)} isEditing={editing !== 'new'} onSubmit={save} onCancel={() => setEditing(null)} />
              ) : (
                <button type="button" onClick={() => setEditing('new')} className="btn btn-primary btn-sm px-5">
                  <Plus className="h-4 w-4" aria-hidden /> New course
                </button>
              )}

              {courses.length === 0 && !editing ? <p className="rounded-2xl border border-dashed border-surface-border bg-white p-8 text-center text-sm font-semibold text-text-muted">You have not listed a course yet.</p> : null}

              <ul className="space-y-4">
                {courses.map((course) => (
                  <li key={course.id} className="rounded-2xl border border-surface-border bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-extrabold text-text-main">
                          {course.reviewStatus === 'APPROVED' ? (
                            <Link to={`/courses/${course.slug}`} className="hover:underline">
                              {course.title}
                            </Link>
                          ) : (
                            course.title
                          )}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-text-muted">
                          {categoryName(course.category)} · {priceLabel(course)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`badge ${course.reviewStatus === 'APPROVED' ? 'bg-success text-white' : course.reviewStatus === 'PENDING' ? 'bg-gold text-primary' : 'bg-error text-white'}`}>{REVIEW_LABEL[course.reviewStatus]}</span>
                        {course.status === 'PAUSED' ? <span className="badge bg-surface-alt text-text-muted">Paused</span> : null}
                        {course.featured ? <span className="badge bg-secondary text-white">Featured</span> : null}
                      </div>
                    </div>

                    {course.reviewNote && course.reviewStatus !== 'APPROVED' ? <p className="mt-3 rounded-xl bg-error/5 px-3 py-2 text-sm font-semibold text-error">{course.reviewNote}</p> : null}

                    <dl aria-label={`Numbers for ${course.title}`} className="mt-4 grid grid-cols-3 gap-3">
                      {(
                        [
                          ['Views', Eye, 'views'],
                          ['Clicks to enrol', MousePointerClick, 'clicks'],
                          ['Enquiries', MessageSquare, 'enquiries'],
                        ] as const
                      ).map(([label, Icon, key]) => (
                        <div key={key} className="rounded-xl bg-surface-alt/60 p-3">
                          <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-light">
                            <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                          </dt>
                          <dd className="mt-1 text-2xl font-black text-text-main">{course.stats.allTime[key]}</dd>
                          <dd className="text-xs font-semibold text-text-muted">{course.stats.last30Days[key]} in the last 30 days</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setEditing(course)} className="btn btn-outline btn-sm bg-white">
                        <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                      </button>
                      {course.status === 'ACTIVE' ? (
                        <button type="button" onClick={() => void act(() => apiPauseCourse(course.id), 'Paused. It is hidden until you resume it.')} className="btn btn-outline btn-sm bg-white">
                          <Pause className="h-3.5 w-3.5" aria-hidden /> Pause
                        </button>
                      ) : (
                        <button type="button" onClick={() => void act(() => apiResumeCourse(course.id), 'Resumed.')} className="btn btn-outline btn-sm bg-white">
                          <Play className="h-3.5 w-3.5" aria-hidden /> Resume
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove "${course.title}"? Learners will no longer see it.`)) void act(() => apiRemoveCourse(course.id), 'Removed.')
                        }}
                        className="btn btn-outline btn-sm bg-white text-error"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {tab === 'enquiries' ? (
            <section aria-label="Enquiries">
              {enquiries.length === 0 ? <p className="rounded-2xl border border-dashed border-surface-border bg-white p-8 text-center text-sm font-semibold text-text-muted">No enquiries yet.</p> : null}
              <ul className="space-y-3">
                {enquiries.map((enquiry) => (
                  <li key={enquiry.id} className="rounded-2xl border border-surface-border bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-text-light">
                      {enquiry.course.title} · {formatShortDate(enquiry.createdAt)} {enquiry.status === 'NEW' ? <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-primary">New</span> : null}
                    </p>
                    <p className="mt-1 text-base font-extrabold text-text-main">{enquiry.name}</p>
                    <p className="mt-1 whitespace-pre-line text-sm font-medium text-text-main">{enquiry.message}</p>
                    <p className="mt-2 flex flex-wrap gap-x-4 text-sm font-bold text-primary">
                      {enquiry.email ? <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a> : null}
                      {enquiry.phone ? <a href={`tel:${enquiry.phone}`}>{enquiry.phone}</a> : null}
                    </p>
                    {enquiry.status === 'NEW' ? (
                      <button type="button" onClick={() => void act(() => apiMarkCourseEnquiryRead(enquiry.id))} className="mt-3 text-xs font-black uppercase tracking-widest text-text-muted hover:underline">
                        Mark as read
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {tab === 'completions' ? (
            <section aria-label="Completions">
              <p className="mb-4 text-sm font-medium text-text-muted">Learners who say they finished one of your courses. Confirm the ones you recognise: they get a &quot;Verified certificate&quot; badge that employers can see.</p>
              {requests.length === 0 ? <p className="rounded-2xl border border-dashed border-surface-border bg-white p-8 text-center text-sm font-semibold text-text-muted">No requests yet.</p> : null}
              <ul className="space-y-3">
                {requests.map((request) => (
                  <li key={request.id} className="rounded-2xl border border-surface-border bg-white p-5">
                    <p className="text-base font-extrabold text-text-main">{request.learnerName}</p>
                    <p className="text-sm font-semibold text-text-muted">
                      {request.courseTitle}
                      {request.completedOn ? ` · completed ${formatShortDate(request.completedOn)}` : ''}
                    </p>
                    {request.certificateUrl ? (
                      <a href={request.certificateUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-block text-sm font-bold text-primary hover:underline">
                        See their certificate
                      </a>
                    ) : null}
                    {request.status === 'REQUESTED' ? (
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => void act(() => apiDecideCompletion(request.id, 'CONFIRM'), 'Confirmed.')} className="btn btn-primary btn-sm">
                          Confirm they completed it
                        </button>
                        <button type="button" onClick={() => void act(() => apiDecideCompletion(request.id, 'DECLINE'), 'Declined.')} className="btn btn-outline btn-sm bg-white">
                          I do not recognise this
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs font-black uppercase tracking-widest text-text-light">{request.status === 'CONFIRMED' ? 'Confirmed' : 'Declined'}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
