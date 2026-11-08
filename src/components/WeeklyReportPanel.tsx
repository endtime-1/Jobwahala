import { useEffect, useState } from 'react'
import { BarChart3, MessageCircle } from 'lucide-react'
import { apiGetWeeklyReport } from '../lib/api'
import { weekRangeLabel, type WeeklyReport } from '../lib/growth'

/** "Last week" on the employer dashboard: views, new applicants and who is waiting for an answer, for each active job. It is also emailed every Monday. */
export default function WeeklyReportPanel() {
  const [data, setData] = useState<{ report: WeeklyReport; whatsappUrl: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = (await apiGetWeeklyReport()) as { report: WeeklyReport; whatsappUrl: string }
        if (!cancelled) setData(result)
      } catch {
        // A convenience: the dashboard works without it.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data || data.report.jobs.length === 0) return null
  const { report, whatsappUrl } = data

  return (
    <section aria-label="Weekly report" className="dashboard-panel mb-8 p-5 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-surface-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-text-main">
            <BarChart3 className="h-4 w-4 text-secondary" aria-hidden /> Your week on JobWahala
          </h2>
          <p className="mt-1 text-xs font-medium text-text-muted">{weekRangeLabel(report)}. We also email this every Monday.</p>
        </div>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#25d366] bg-white px-4 py-2 text-sm font-extrabold text-[#128c4a] transition-colors hover:bg-[#25d366] hover:text-white">
          <MessageCircle className="h-4 w-4" aria-hidden /> Share on WhatsApp
        </a>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-surface-alt/50 p-3">
          <dd className="text-2xl font-black text-text-main">{report.totals.views}</dd>
          <dt className="text-[10px] font-black uppercase tracking-widest text-text-light">Views</dt>
        </div>
        <div className="rounded-xl bg-surface-alt/50 p-3">
          <dd className="text-2xl font-black text-text-main">{report.totals.newApplicants}</dd>
          <dt className="text-[10px] font-black uppercase tracking-widest text-text-light">New applicants</dt>
        </div>
        <div className="rounded-xl bg-surface-alt/50 p-3">
          <dd className="text-2xl font-black text-text-main">{report.totals.awaitingReview}</dd>
          <dt className="text-[10px] font-black uppercase tracking-widest text-text-light">To review</dt>
        </div>
      </dl>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-widest text-text-light">
              <th className="py-2 pr-3">Job</th>
              <th className="px-3 py-2 text-center">Views</th>
              <th className="px-3 py-2 text-center">New applicants</th>
              <th className="px-3 py-2 text-center">To review</th>
            </tr>
          </thead>
          <tbody>
            {report.jobs.map((job) => (
              <tr key={job.jobId} className="border-t border-surface-border/50">
                <td className="py-2.5 pr-3 font-bold text-text-main">{job.title}</td>
                <td className="px-3 py-2.5 text-center font-semibold">{job.views}</td>
                <td className="px-3 py-2.5 text-center font-semibold">{job.newApplicants}</td>
                <td className="px-3 py-2.5 text-center font-semibold">{job.awaitingReview}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
