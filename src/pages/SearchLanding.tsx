import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import SEO from '../components/SEO'
import { apiGetLandingPage } from '../lib/api'
import { formatRelativeTime } from '../lib/display'
import { looksLikeLandingSlug } from '../lib/landingSlug'
import NotFound from './NotFound'

type LandingJob = {
  id: string
  title: string
  employerName: string
  location?: string | null
  type: string
  salary?: string | null
  createdAt: string
}

type LandingPageData = {
  slug: string
  path: string
  kind: string
  h1: string
  title: string
  description: string
  intro: string
  count: number
  indexable: boolean
  jobs: LandingJob[]
  related: { title: string; links: { label: string; path: string; count: number }[] }[]
  breadcrumbs: { label: string; path: string }[]
}

type State = { slug: string; page: LandingPageData | null; status: 'ok' | 'missing' | 'error' }

/**
 * "Jobs in Accra", "Banking jobs", "Banking jobs in Accra", "Part-time jobs" and the Jobs by location /
 * Jobs by category directories. The wording and the list of jobs come from the server, which also decides
 * whether the page is thin (fewer than 3 jobs) and must not be indexed.
 */
export default function SearchLanding() {
  const { slug = '' } = useParams()
  const valid = looksLikeLandingSlug(slug)
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    if (!valid) return
    let cancelled = false
    apiGetLandingPage(slug)
      .then((data: { page: LandingPageData }) => {
        if (!cancelled) setState({ slug, page: data.page, status: 'ok' })
      })
      .catch((err: { status?: number }) => {
        if (!cancelled) setState({ slug, page: null, status: err?.status === 404 ? 'missing' : 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [slug, valid])

  if (!valid || (state?.slug === slug && state.status === 'missing')) {
    return (
      <>
        <SEO title="Page not found" noindex />
        <NotFound />
      </>
    )
  }

  const page = state?.slug === slug ? state.page : null

  if (state?.slug === slug && state.status === 'error') {
    return (
      <div className="container pb-24 pt-28">
        <SEO title="Jobs" noindex />
        <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          We could not load this page right now. Please try again.
        </p>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="container pb-24 pt-28">
        <SEO title="Jobs" noindex />
        <p className="text-sm font-bold text-text-light">Loading jobs...</p>
      </div>
    )
  }

  const isDirectory = page.kind === 'directory'

  return (
    <div className="pb-24 pt-24 xl:pt-28">
      <SEO title={page.title} description={page.description} canonical={`https://jobwahala.com${page.path}`} noindex={!page.indexable} />

      <div className="container max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm font-semibold text-text-muted">
          {page.breadcrumbs.map((crumb, index) => (
            <span key={crumb.path} className="inline-flex items-center gap-1">
              {index > 0 ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : null}
              {index === page.breadcrumbs.length - 1 ? (
                <span aria-current="page" className="text-text-main">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.path} className="hover:underline">
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <h1 className="text-3xl font-black tracking-tight text-text-main sm:text-4xl">{page.h1}</h1>
        <p className="mt-3 text-base font-medium leading-relaxed text-text-muted">{page.intro}</p>

        {isDirectory ? null : page.jobs.length > 0 ? (
          <ul aria-label="Open jobs" className="mt-8 space-y-3">
            {page.jobs.map((job) => (
              <li key={job.id} className="rounded-2xl border border-surface-border bg-white p-4 transition-all hover:border-secondary/40 sm:p-5">
                <h2 className="text-lg font-extrabold leading-snug text-text-main">
                  <Link to={`/jobs/${job.id}`} className="hover:text-secondary hover:underline">
                    {job.title}
                  </Link>
                </h2>
                <p className="mt-0.5 text-sm font-bold text-text-muted">{job.employerName}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-text-muted">
                  {job.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-secondary" aria-hidden /> {job.location}
                    </span>
                  ) : null}
                  <span>{job.type}</span>
                  {job.salary ? <span>{job.salary}</span> : null}
                  <span className="text-text-light">Posted {formatRelativeTime(job.createdAt)}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-surface-border bg-white p-6 text-center">
            <p className="text-base font-extrabold text-text-main">No open jobs right now.</p>
            <Link to="/jobs" className="btn btn-gold mt-4 inline-flex px-6">
              See every open job
            </Link>
          </div>
        )}

        {page.related.map((group) => (
          <section key={group.title} aria-label={group.title} className="mt-10">
            <h2 className="text-xl font-black tracking-tight text-text-main">{group.title}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {group.links.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-white px-4 py-2 text-sm font-bold text-text-main hover:border-secondary hover:text-secondary">
                    {link.label} <span className="text-text-light">({link.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {isDirectory || page.jobs.length === 0 ? null : (
          <p className="mt-10">
            <Link to="/jobs" className="text-sm font-bold text-primary hover:underline">
              See every open job
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
