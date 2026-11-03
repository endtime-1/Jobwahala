import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight, BadgeCheck, Briefcase, Calendar, Clock, Globe, MapPin } from 'lucide-react'
import CompanyLogo from '../components/CompanyLogo'
import SEO from '../components/SEO'
import { apiGetCompany } from '../lib/api'
import { formatRelativeTime } from '../lib/display'
import { getErrorMessage } from '../lib/errors'

type CompanyJob = {
  id: string
  title: string
  location?: string | null
  type?: string | null
  salary?: string | null
  category?: string | null
  createdAt: string
}

type Company = {
  id: string
  companyName: string
  industry?: string | null
  logoUrl?: string | null
  website?: string | null
  description?: string | null
  isVerified: boolean
  memberSince: string
  jobs: CompanyJob[]
}

export default function CompanyProfile() {
  const { id } = useParams()
  const [company, setCompany] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    apiGetCompany(id)
      .then((data) => {
        if (!cancelled) setCompany(data.company as Company)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Unable to load this company.'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  const structuredData = useMemo(() => {
    if (!company) return null
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: company.companyName,
      url: `${window.location.origin}/companies/${company.id}`,
      ...(company.description ? { description: company.description } : {}),
      ...(company.logoUrl ? { logo: new URL(company.logoUrl, window.location.origin).toString() } : {}),
      ...(company.website ? { sameAs: [company.website] } : {}),
    }
  }, [company])

  if (isLoading) {
    return (
      <div className="container pt-36 pb-24">
        <div className="h-40 animate-pulse rounded-[2rem] bg-surface-alt/60" aria-label="Loading company" />
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="container pt-36 pb-24">
        <div className="dashboard-panel p-8 text-center">
          <h1 className="text-2xl font-black text-text-main">We could not find that company</h1>
          <p className="mt-2 text-sm font-medium text-text-muted">{error || 'It may have been removed or is no longer active.'}</p>
          <Link to="/jobs" className="btn btn-primary mt-6 inline-flex">
            Browse open jobs
          </Link>
        </div>
      </div>
    )
  }

  const openRoles = company.jobs.length

  return (
    <div className="container pt-36 pb-24">
      <SEO
        title={`${company.companyName} jobs and company profile`}
        description={
          company.description?.slice(0, 180) ||
          `${company.companyName} is hiring on JobWahala${openRoles ? ` with ${openRoles} open ${openRoles === 1 ? 'role' : 'roles'}` : ''}.`
        }
        canonical={`${window.location.origin}/companies/${company.id}`}
      />
      {structuredData && (
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        </Helmet>
      )}

      <section className="dashboard-hero px-5 py-7 sm:px-8 sm:py-9">
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center">
          <CompanyLogo name={company.companyName} logoUrl={company.logoUrl} className="h-24 w-24 rounded-3xl text-3xl" />
          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-tight text-text-main sm:text-4xl">{company.companyName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-text-muted">
              {company.isVerified && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1 font-black text-success">
                  <BadgeCheck className="h-4 w-4" /> Verified business
                </span>
              )}
              {company.industry && (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" /> {company.industry}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> On JobWahala since{' '}
                {new Date(company.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </span>
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1.5 font-bold text-secondary hover:underline"
                >
                  <Globe className="h-4 w-4" /> Website
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <section aria-labelledby="open-roles">
          <h2 id="open-roles" className="text-xl font-black text-text-main">
            Open roles <span className="text-text-light">({openRoles})</span>
          </h2>

          {openRoles === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-surface-border p-6 text-sm font-semibold text-text-muted">
              {company.companyName} has no open roles right now.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {company.jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    to={`/jobs/${job.id}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-surface-border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-premium-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-text-main">{job.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-text-light">
                        {job.type && <span>{job.type}</span>}
                        {job.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {job.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatRelativeTime(job.createdAt)}
                        </span>
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 flex-none text-text-light transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside>
          <h2 className="text-xl font-black text-text-main">About</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-relaxed text-text-muted">
            {company.description || `${company.companyName} has not added a company description yet.`}
          </p>
        </aside>
      </div>
    </div>
  )
}
