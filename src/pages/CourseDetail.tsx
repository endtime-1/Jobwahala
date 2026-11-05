import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Award, CalendarDays, ChevronLeft, ExternalLink, Hourglass, MapPin, Signal } from 'lucide-react'
import CourseCard from '../components/CourseCard'
import CompanyLogo from '../components/CompanyLogo'
import SEO from '../components/SEO'
import TurnstileWidget from '../components/TurnstileWidget'
import VerifiedBadge from '../components/VerifiedBadge'
import { apiCreateCourseEnquiry, apiGetCourse, apiTrackCourseEvent } from '../lib/api'
import { useCaptcha } from '../lib/captcha'
import {
  categoryName,
  durationText,
  formatLabel,
  levelLabel,
  priceLabel,
  skillCoursesPath,
  skillLabel,
  startText,
  type Course,
} from '../lib/courses'
import { getErrorMessage } from '../lib/errors'
import NotFound from './NotFound'

type CourseDetailData = Course & { description: string }

export default function CourseDetail() {
  const { slug = '' } = useParams()
  const [state, setState] = useState<{ slug: string; course: CourseDetailData | null; related: Course[]; status: 'ok' | 'missing' | 'error' } | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGetCourse(slug)
      .then((data: { course: CourseDetailData; related?: Course[] }) => {
        if (cancelled) return
        setState({ slug, course: data.course, related: data.related ?? [], status: 'ok' })
        // Counted once a day per visitor; never allowed to get in the way.
        void apiTrackCourseEvent(data.course.id, 'VIEW')
      })
      .catch((err: { status?: number }) => {
        if (!cancelled) setState({ slug, course: null, related: [], status: err?.status === 404 ? 'missing' : 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const current = state?.slug === slug ? state : null

  if (current?.status === 'missing') {
    return (
      <>
        <SEO title="Course not found" noindex />
        <NotFound />
      </>
    )
  }
  if (current?.status === 'error') {
    return (
      <div className="container pb-24 pt-28">
        <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          We could not load this course right now. Please try again.
        </p>
      </div>
    )
  }
  if (!current?.course) {
    return (
      <div className="container pb-24 pt-28">
        <p className="text-sm font-bold text-text-light">Loading course...</p>
      </div>
    )
  }

  const { course, related } = current
  const facts = [
    { icon: Hourglass, label: 'Duration', value: durationText(course.durationWeeks) },
    { icon: MapPin, label: 'Format', value: [formatLabel(course.format), course.location].filter(Boolean).join(' · ') },
    { icon: Signal, label: 'Level', value: levelLabel(course.level) },
    { icon: CalendarDays, label: 'Starts', value: startText(course).replace('Starts ', '').replace('Next start: ', '') },
    { icon: Award, label: 'Certificate', value: course.certificateOffered ? 'Offered' : '' },
  ].filter((fact) => fact.value)

  return (
    <div className="pb-24 pt-24 xl:pt-28">
      <SEO
        title={`${course.title} - ${course.provider.name}`}
        description={`${course.title} by ${course.provider.name}. ${priceLabel(course)}. ${course.summary}`.slice(0, 200)}
        canonical={`https://www.jobwahala.com/courses/${course.slug}`}
      />

      <div className="container max-w-5xl">
        <Link to="/courses" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-text-muted hover:text-primary">
          <ChevronLeft className="h-4 w-4" aria-hidden /> All courses
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-8">
            <header>
              <p className="text-xs font-extrabold uppercase tracking-wider text-secondary">
                <Link to={`/courses/category/${course.category}`} className="hover:underline">
                  {categoryName(course.category)}
                </Link>
              </p>
              <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-text-main sm:text-4xl">{course.title}</h1>
              <p className="mt-3 text-lg font-medium text-text-muted">{course.summary}</p>
              <Link to={`/providers/${course.provider.id}`} className="mt-4 inline-flex items-center gap-3 hover:underline">
                <CompanyLogo name={course.provider.name} logoUrl={course.provider.logoUrl} className="h-10 w-10 rounded-xl text-sm" />
                <span className="text-base font-extrabold text-text-main">{course.provider.name}</span>
                <VerifiedBadge type="employer" status={course.provider.isVerified ? 'APPROVED' : 'UNVERIFIED'} hideWhenUnverified showText={false} />
              </Link>
            </header>

            <section className="rounded-2xl border border-surface-border bg-white p-6">
              <h2 className="text-xl font-black text-text-main">About this course</h2>
              <p className="mt-3 whitespace-pre-line text-base font-medium leading-relaxed text-text-main">{course.description}</p>
            </section>

            {course.skills.length > 0 ? (
              <section>
                <h2 className="text-xl font-black text-text-main">Skills you will learn</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {course.skills.map((skill) => (
                    <li key={skill}>
                      <Link to={skillCoursesPath(skill)} className="inline-flex rounded-full border border-surface-border bg-white px-4 py-2 text-sm font-bold text-text-main hover:border-secondary hover:text-secondary">
                        {skillLabel(skill)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {related.length > 0 ? (
              <section>
                <h2 className="text-xl font-black text-text-main">Similar courses</h2>
                <ul className="mt-3 space-y-3">
                  {related.map((other) => (
                    <li key={other.id}>
                      <CourseCard course={other} compact />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="space-y-5 self-start lg:sticky lg:top-28">
            <div className="rounded-2xl border border-surface-border bg-white p-6">
              <p className={`text-3xl font-black ${course.isFree ? 'text-success' : 'text-text-main'}`}>{priceLabel(course)}</p>
              <ul aria-label="Course facts" className="mt-4 space-y-3">
                {facts.map(({ icon: Icon, label, value }) => (
                  <li key={label} className="flex items-start gap-3 text-sm font-semibold text-text-main">
                    <Icon className="mt-0.5 h-4 w-4 flex-none text-secondary" aria-hidden />
                    <span>
                      <span className="block text-xs font-bold uppercase tracking-wider text-text-light">{label}</span>
                      {value}
                    </span>
                  </li>
                ))}
              </ul>

              {course.enrolUrl ? (
                <a
                  href={course.enrolUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  onClick={() => void apiTrackCourseEvent(course.id, 'CLICK')}
                  className="btn btn-primary mt-5 w-full justify-center"
                >
                  Enrol with {course.provider.name} <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              ) : null}
            </div>

            {course.enquiryEnabled ? <EnquiryForm course={course} /> : null}
          </aside>
        </div>
      </div>
    </div>
  )
}

function EnquiryForm({ course }: { course: CourseDetailData }) {
  const captcha = useCaptcha()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await apiCreateCourseEnquiry(
        course.id,
        { name, message, ...(email.trim() ? { email } : {}), ...(phone.trim() ? { phone } : {}) },
        captcha.token || undefined,
      )
      setSent(true)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not send that. Please try again.'))
      captcha.reset()
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border border-success/20 bg-success/5 p-6">
        <p className="text-base font-extrabold text-text-main">Sent</p>
        <p className="mt-1 text-sm font-medium text-text-muted">{course.provider.name} will contact you using the details you gave.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-surface-border bg-white p-6">
      <h2 className="text-lg font-black text-text-main">Ask the provider</h2>
      <div className="mt-4 space-y-3">
        <label className="block text-sm font-bold text-text-main">
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} className="mt-1 h-11 w-full text-sm font-semibold" />
        </label>
        <label className="block text-sm font-bold text-text-main">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11 w-full text-sm font-semibold" />
        </label>
        <label className="block text-sm font-bold text-text-main">
          Phone
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 123 4567" className="mt-1 h-11 w-full text-sm font-semibold" />
        </label>
        <p className="text-xs font-medium text-text-light">Give an email or a phone number so they can reply.</p>
        <label className="block text-sm font-bold text-text-main">
          Your question
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} required minLength={5} maxLength={1000} rows={3} className="mt-1 w-full text-sm font-semibold" />
        </label>
      </div>

      <TurnstileWidget onToken={captcha.setToken} resetSignal={captcha.resetSignal} />

      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-error">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={busy || !captcha.ready || !name.trim() || (!email.trim() && !phone.trim()) || message.trim().length < 5} className="btn btn-outline mt-4 w-full justify-center bg-white disabled:opacity-60">
        {busy ? 'Sending...' : 'Send enquiry'}
      </button>
    </form>
  )
}
