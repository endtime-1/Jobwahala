import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { apiGetHiringReport } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

type Totals = { jobsPosted: number; views: number; applications: number; hires: number; avgFirstResponseHours: number | null }
type Report = {
  months: number
  totals: Totals
  byJob: (Omit<Totals, 'jobsPosted'> & { id: string; title: string; status: string })[]
  byMonth: (Totals & { month: string })[]
}

const hours = (value: number | null) => (value === null ? 'No replies yet' : value < 48 ? `${value} hours` : `${Math.round((value / 24) * 10) / 10} days`)

/** Business plans: jobs posted, views, applications, time to first response and hires, by job and by month. */
export default function HiringReports() {
  const [months, setMonths] = useState(6)
  const [report, setReport] = useState<Report | null>(null)
  const [needsPlan, setNeedsPlan] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = (await apiGetHiringReport(months)) as Report
        if (!cancelled) {
          setReport(result)
          setNeedsPlan(false)
        }
      } catch (err) {
        if (cancelled) return
        if ((err as { code?: string }).code === 'PLAN_REQUIRED') setNeedsPlan(true)
        else setError(getErrorMessage(err, 'We could not load your report.'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [months])

  return (
    <div className="container max-w-5xl pb-24 pt-28">
      <SEO title="Hiring reports" noindex />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-text-main">Hiring reports</h1>
          <p className="mt-2 text-base font-medium text-text-muted">How your jobs are doing. Views count each visitor once a day.</p>
        </div>
        {!needsPlan ? (
          <label className="text-sm font-bold text-text-main">
            Period
            <select value={months} onChange={(event) => setMonths(Number(event.target.value))} className="ml-2 h-10">
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </label>
        ) : null}
      </header>

      {needsPlan ? (
        <div role="alert" className="rounded-2xl border border-gold/40 bg-gold/10 p-6">
          <p className="text-base font-bold text-text-main">Hiring reports are part of the Business plan.</p>
          <Link to="/plans" className="btn btn-primary btn-sm mt-4 inline-flex">
            See plans
          </Link>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {report && !needsPlan ? (
        <>
          <dl className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ['Jobs posted', report.totals.jobsPosted],
              ['Views', report.totals.views],
              ['Applications', report.totals.applications],
              ['Hires', report.totals.hires],
              ['Time to first response', hours(report.totals.avgFirstResponseHours)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-surface-border bg-white p-4">
                <dt className="text-xs font-bold uppercase tracking-wider text-text-light">{label}</dt>
                <dd className="mt-1 text-2xl font-black text-text-main">{value}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mb-3 text-xl font-black text-text-main">By month</h2>
          <div className="mb-8 overflow-x-auto rounded-2xl border border-surface-border bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs font-bold uppercase tracking-wider text-text-light">
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Jobs posted</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Applications</th>
                  <th className="px-4 py-3">Hires</th>
                  <th className="px-4 py-3">First response</th>
                </tr>
              </thead>
              <tbody>
                {report.byMonth.map((row) => (
                  <tr key={row.month} className="border-b border-surface-border/60 last:border-0">
                    <td className="px-4 py-3 font-bold text-text-main">{row.month}</td>
                    <td className="px-4 py-3">{row.jobsPosted}</td>
                    <td className="px-4 py-3">{row.views}</td>
                    <td className="px-4 py-3">{row.applications}</td>
                    <td className="px-4 py-3">{row.hires}</td>
                    <td className="px-4 py-3">{hours(row.avgFirstResponseHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-3 text-xl font-black text-text-main">By job</h2>
          <div className="overflow-x-auto rounded-2xl border border-surface-border bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs font-bold uppercase tracking-wider text-text-light">
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Applications</th>
                  <th className="px-4 py-3">Hires</th>
                  <th className="px-4 py-3">First response</th>
                </tr>
              </thead>
              <tbody>
                {report.byJob.map((row) => (
                  <tr key={row.id} className="border-b border-surface-border/60 last:border-0">
                    <td className="px-4 py-3 font-bold text-text-main">{row.title}</td>
                    <td className="px-4 py-3">{row.views}</td>
                    <td className="px-4 py-3">{row.applications}</td>
                    <td className="px-4 py-3">{row.hires}</td>
                    <td className="px-4 py-3">{hours(row.avgFirstResponseHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
