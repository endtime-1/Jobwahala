import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import CourseCard from '../components/CourseCard'
import SEO from '../components/SEO'
import { apiGetCourseLanding } from '../lib/api'
import type { Course } from '../lib/courses'
import NotFound from './NotFound'

type Landing = {
  kind: 'category' | 'skill'
  slug: string
  path: string
  h1: string
  title: string
  description: string
  intro: string
  count: number
  indexable: boolean
  courses: Course[]
  related: { label: string; path: string; count: number }[]
}

type State = { key: string; page: Landing | null; status: 'ok' | 'missing' | 'error' }

/**
 * "Marketing courses" (a category) and "Excel courses in Ghana" (a skill). The wording and the list come from the
 * server, which also decides whether the page is thin (fewer than 3 courses) and must not be indexed.
 */
export default function CourseLanding({ kind, slug }: { kind: 'category' | 'skill'; slug: string }) {
  const key = `${kind}:${slug}`
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGetCourseLanding(kind, slug)
      .then((data: { page: Landing }) => {
        if (!cancelled) setState({ key, page: data.page, status: 'ok' })
      })
      .catch((err: { status?: number }) => {
        if (!cancelled) setState({ key, page: null, status: err?.status === 404 ? 'missing' : 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [kind, slug, key])

  const current = state?.key === key ? state : null

  if (current?.status === 'missing') {
    return (
      <>
        <SEO title="Page not found" noindex />
        <NotFound />
      </>
    )
  }
  if (current?.status === 'error') {
    return (
      <div className="container pb-24 pt-28">
        <SEO title="Courses" noindex />
        <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          We could not load this page right now. Please try again.
        </p>
      </div>
    )
  }
  if (!current?.page) {
    return (
      <div className="container pb-24 pt-28">
        <SEO title="Courses" noindex />
        <p className="text-sm font-bold text-text-light">Loading courses...</p>
      </div>
    )
  }

  const page = current.page

  return (
    <div className="pb-24 pt-24 xl:pt-28">
      <SEO title={page.title} description={page.description} canonical={`https://jobwahala.com${page.path}`} noindex={!page.indexable} />

      <div className="container max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm font-semibold text-text-muted">
          <Link to="/" className="hover:underline">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <Link to="/courses" className="hover:underline">
            Courses
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span aria-current="page" className="text-text-main">
            {page.h1}
          </span>
        </nav>

        <h1 className="text-3xl font-black tracking-tight text-text-main sm:text-4xl">{page.h1}</h1>
        <p className="mt-3 text-base font-medium leading-relaxed text-text-muted">{page.intro}</p>

        {page.courses.length > 0 ? (
          <ul aria-label="Courses" className="mt-8 space-y-4">
            {page.courses.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-surface-border bg-white p-6 text-center">
            <p className="text-base font-extrabold text-text-main">No courses are listed right now.</p>
            <Link to="/courses" className="btn btn-gold mt-4 inline-flex px-6">
              Browse every course
            </Link>
          </div>
        )}

        {page.related.length > 0 ? (
          <section aria-label="Related courses" className="mt-10">
            <h2 className="text-xl font-black tracking-tight text-text-main">Related courses</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {page.related.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-white px-4 py-2 text-sm font-bold text-text-main hover:border-secondary hover:text-secondary">
                    {link.label} <span className="text-text-light">({link.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
