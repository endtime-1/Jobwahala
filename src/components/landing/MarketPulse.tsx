import { ArrowRight, Clock, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import CompanyLogo from '../CompanyLogo'
import UnverifiedEmployerLabel from '../UnverifiedEmployerLabel'
import { companyOf, logoOf, recentAge, type HiringCompany, type LandingCounts, type LandingJob } from './types'

type MarketPulseProps = {
  jobs: LandingJob[]
  counts: LandingCounts | null
  companies?: HiringCompany[]
}

export default function MarketPulse({ jobs, counts, companies = [] }: MarketPulseProps) {
  const latest = [...jobs]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 6)

  const community = counts
    ? [
        { value: counts.totalTalent, label: counts.totalTalent === 1 ? 'professional' : 'professionals' },
        { value: counts.employers, label: counts.employers === 1 ? 'employer' : 'employers' },
        { value: jobs.length, label: jobs.length === 1 ? 'open role' : 'open roles' },
      ].filter((item) => item.value > 0)
    : []

  return (
    <div>
      {community.length > 0 && (
        <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-text-muted">
          <span className="pulse-dot h-2 w-2 rounded-full bg-success" aria-hidden />
          Already here:
          {community.map((item, index) => (
            <span key={item.label}>
              <strong className="text-text-main">{item.value}</strong> {item.label}
              {index < community.length - 1 ? ',' : ''}
            </span>
          ))}
          <span>- and growing.</span>
        </p>
      )}

      {companies.length > 0 && (
        <div className="mb-8">
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-text-light">Who is hiring</p>
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {companies.map((company) => (
              <li key={company.id} className="snap-start">
                <Link
                  to={`/companies/${company.id}`}
                  className="flex min-w-[13.5rem] items-center gap-3 rounded-2xl border border-surface-border bg-white/90 p-3 pr-4 transition-all hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-premium-sm"
                >
                  <CompanyLogo name={company.companyName} logoUrl={company.logoUrl} className="h-11 w-11 rounded-xl text-sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-text-main">{company.companyName}</span>
                    <span className="block text-xs font-semibold text-text-muted">
                      {company.openRoles} open {company.openRoles === 1 ? 'role' : 'roles'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {latest.length > 0 ? (
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {latest.map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="min-w-[17rem] flex-1 snap-start rounded-3xl border border-surface-border bg-white/85 p-5 shadow-premium-sm transition-all hover:-translate-y-1 hover:shadow-premium-md"
            >
              <div className="flex items-center gap-3">
                <CompanyLogo name={companyOf(job)} logoUrl={logoOf(job)} className="h-10 w-10 rounded-xl text-sm" />
                <p className="text-[11px] font-black uppercase tracking-widest text-secondary">{job.category || job.type || 'Open role'}</p>
              </div>
              <p className="mt-2 text-lg font-black leading-snug text-text-main">{job.title}</p>
              <p className="mt-1 text-sm font-semibold text-text-muted">{companyOf(job)}</p>
              {job.employer?.isVerified === false ? <UnverifiedEmployerLabel className="mt-1.5" /> : null}
              <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-text-light">
                {job.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {job.location}
                  </span>
                )}
                {recentAge(job.createdAt) && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {recentAge(job.createdAt)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-surface-border bg-white/60 p-8 text-center">
          <p className="text-lg font-black text-text-main">Be the first employer people see.</p>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium text-text-muted">
            There are no open roles right now. Post one and it appears here straight away.
          </p>
          <Link to="/onboarding?role=employer" className="btn btn-primary mt-5 inline-flex">
            Post a job
          </Link>
        </div>
      )}

      {latest.length > 0 && (
        <Link to="/jobs" className="mt-4 inline-flex items-center gap-1 text-sm font-black text-secondary hover:underline">
          Browse every open role <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}
