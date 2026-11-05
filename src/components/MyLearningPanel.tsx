import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Award, BadgeCheck, GraduationCap } from 'lucide-react'
import { apiAddLearnerCourse, apiListLearnerCourses, apiRemoveLearnerCourse, apiRequestCourseConfirmation } from '../lib/api'
import type { LearnerCourse } from '../lib/courses'
import { formatShortDate } from '../lib/display'
import { getErrorMessage } from '../lib/errors'

/** Courses a job seeker has completed. A provider can confirm one, which shows a "Verified certificate" badge to employers. */
export default function MyLearningPanel() {
  const [courses, setCourses] = useState<LearnerCourse[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [providerName, setProviderName] = useState('')
  const [completedOn, setCompletedOn] = useState('')
  const [certificateUrl, setCertificateUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = (await apiListLearnerCourses()) as { courses?: LearnerCourse[] }
      setCourses(data.courses ?? [])
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load your courses.'))
      setCourses([])
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on first show
    void load()
  }, [load])

  const run = async (action: () => Promise<unknown>) => {
    setError('')
    setBusy(true)
    try {
      await action()
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const add = async (event: FormEvent) => {
    event.preventDefault()
    await run(async () => {
      await apiAddLearnerCourse({
        title: title.trim(),
        ...(providerName.trim() ? { providerName: providerName.trim() } : {}),
        ...(completedOn ? { completedOn } : {}),
        ...(certificateUrl.trim() ? { certificateUrl: certificateUrl.trim() } : {}),
      })
      setTitle('')
      setProviderName('')
      setCompletedOn('')
      setCertificateUrl('')
      setAdding(false)
    })
  }

  return (
    <section aria-label="My courses and certificates" className="dashboard-panel p-5 sm:p-6">
      <div className="mb-4 border-b border-surface-border/50 pb-4">
        <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-main">
          <GraduationCap className="h-4 w-4 text-secondary" aria-hidden /> My courses and certificates
        </h3>
        <p className="mt-1 text-xs font-medium leading-relaxed text-text-muted">
          Add courses you completed. If it was one from JobWahala, ask the provider to confirm it: employers then see a &quot;Verified certificate&quot; badge.{' '}
          <Link to="/courses" className="font-bold text-primary hover:underline">
            Find a course
          </Link>
        </p>
      </div>

      {courses === null ? <p className="text-sm font-bold text-text-light">Loading...</p> : null}

      <ul className="space-y-3">
        {(courses ?? []).map((course) => (
          <li key={course.id} className="rounded-xl border border-surface-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-text-main">{course.courseSlug ? <Link to={`/courses/${course.courseSlug}`} className="hover:underline">{course.title}</Link> : course.title}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {[course.providerName, course.completedOn ? `completed ${formatShortDate(course.completedOn)}` : ''].filter(Boolean).join(' · ')}
                </p>
              </div>
              {course.status === 'CONFIRMED' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-extrabold text-success">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified certificate
                </span>
              ) : course.status === 'REQUESTED' ? (
                <span className="rounded-full bg-gold/30 px-2.5 py-1 text-xs font-extrabold text-primary">Waiting for the provider</span>
              ) : null}
            </div>

            {course.status === 'DECLINED' ? <p className="mt-2 text-xs font-semibold text-error">The provider could not confirm this.{course.decisionNote ? ` ${course.decisionNote}` : ''}</p> : null}

            <div className="mt-3 flex flex-wrap gap-3">
              {course.courseId && (course.status === 'SELF' || course.status === 'DECLINED') ? (
                <button
                  type="button"
                  disabled={busy || !course.completedOn}
                  title={course.completedOn ? undefined : 'Add the date you completed it first'}
                  onClick={() => void run(() => apiRequestCourseConfirmation(course.id))}
                  className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary hover:underline disabled:opacity-50"
                >
                  <Award className="h-3.5 w-3.5" aria-hidden /> Ask the provider to confirm
                </button>
              ) : null}
              <button type="button" disabled={busy} onClick={() => void run(() => apiRemoveLearnerCourse(course.id))} aria-label={`Remove ${course.title}`} className="text-xs font-black uppercase tracking-widest text-error hover:underline disabled:opacity-50">
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {adding ? (
        <form onSubmit={add} className="mt-4 space-y-3 rounded-xl border border-surface-border bg-surface-alt/40 p-4">
          <label className="block text-sm font-bold text-text-main">
            Course name
            <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={160} className="mt-1 h-11 w-full text-sm font-semibold" />
          </label>
          <label className="block text-sm font-bold text-text-main">
            Who ran it
            <input value={providerName} onChange={(e) => setProviderName(e.target.value)} maxLength={120} className="mt-1 h-11 w-full text-sm font-semibold" />
          </label>
          <label className="block text-sm font-bold text-text-main">
            Date completed
            <input type="date" value={completedOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setCompletedOn(e.target.value)} className="mt-1 h-11 w-full text-sm font-semibold" />
          </label>
          <label className="block text-sm font-bold text-text-main">
            Link to your certificate (optional)
            <input type="url" value={certificateUrl} onChange={(e) => setCertificateUrl(e.target.value)} placeholder="https://" className="mt-1 h-11 w-full text-sm font-semibold" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary btn-sm disabled:opacity-60">
              Add course
            </button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn-outline btn-sm bg-white">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn btn-outline btn-sm mt-4 bg-white">
          Add a completed course
        </button>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </section>
  )
}
