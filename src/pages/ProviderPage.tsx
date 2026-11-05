import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import CompanyLogo from '../components/CompanyLogo'
import CourseCard from '../components/CourseCard'
import SEO from '../components/SEO'
import VerifiedBadge from '../components/VerifiedBadge'
import { apiGetProviderPage } from '../lib/api'
import type { Course } from '../lib/courses'
import NotFound from './NotFound'

type Provider = { id: string; name: string; logoUrl: string | null; website: string | null; description: string | null; isVerified: boolean }
type State = { id: string; provider: Provider | null; courses: Course[]; status: 'ok' | 'missing' | 'error' }

export default function ProviderPage() {
  const { id = '' } = useParams()
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGetProviderPage(id)
      .then((data: { provider: Provider; courses: Course[] }) => {
        if (!cancelled) setState({ id, provider: data.provider, courses: data.courses, status: 'ok' })
      })
      .catch((err: { status?: number }) => {
        if (!cancelled) setState({ id, provider: null, courses: [], status: err?.status === 404 ? 'missing' : 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const current = state?.id === id ? state : null

  if (current?.status === 'missing') {
    return (
      <>
        <SEO title="Provider not found" noindex />
        <NotFound />
      </>
    )
  }
  if (current?.status === 'error') {
    return (
      <div className="container pb-24 pt-28">
        <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          We could not load this provider right now. Please try again.
        </p>
      </div>
    )
  }
  if (!current?.provider) {
    return (
      <div className="container pb-24 pt-28">
        <p className="text-sm font-bold text-text-light">Loading provider...</p>
      </div>
    )
  }

  const { provider, courses } = current

  return (
    <div className="pb-24 pt-24 xl:pt-28">
      <SEO
        title={`${provider.name} - courses`}
        description={`${provider.name}: ${courses.length} ${courses.length === 1 ? 'course' : 'courses'} on JobWahala. ${provider.description ?? ''}`.slice(0, 200)}
        canonical={`https://jobwahala.com/providers/${provider.id}`}
        noindex={courses.length === 0}
      />

      <div className="container max-w-4xl">
        <header className="flex items-start gap-5">
          <CompanyLogo name={provider.name} logoUrl={provider.logoUrl} className="h-20 w-20 flex-none rounded-2xl text-2xl" />
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wider text-secondary">Training provider</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-3xl font-black tracking-tight text-text-main">
              {provider.name}
              <VerifiedBadge type="employer" status={provider.isVerified ? 'APPROVED' : 'UNVERIFIED'} hideWhenUnverified />
            </h1>
            {provider.description ? <p className="mt-3 whitespace-pre-line text-base font-medium leading-relaxed text-text-muted">{provider.description}</p> : null}
            {provider.website ? (
              <a href={provider.website} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                Website <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
        </header>

        <h2 className="mt-10 text-xl font-black tracking-tight text-text-main">Courses ({courses.length})</h2>
        {courses.length > 0 ? (
          <ul aria-label="Courses" className="mt-4 space-y-4">
            {courses.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm font-semibold text-text-muted">
            No courses are listed right now.{' '}
            <Link to="/courses" className="font-bold text-primary hover:underline">
              Browse all courses
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
