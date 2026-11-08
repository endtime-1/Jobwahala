import { ArrowRight, Briefcase, CheckCircle2, FileText, Users, Wallet } from 'lucide-react'
import { ghs } from '../lib/billing'
import { QUEUE_ROWS, changePercent, totalWaiting, type AdminOverview, type Point } from '../lib/adminOverview'
import { formatRelativeTime } from '../lib/display'
import { useAdminOverview } from '../pages/dashboards/admin/hooks'

export type AdminTab = 'overview' | 'system' | 'reports' | 'users' | 'jobs' | 'services' | 'verifications' | 'disputes' | 'courses' | 'billing' | 'growth'

/** A tiny bar chart with no library: one bar per day, the tallest fills the box. */
function Bars({ points, label }: { points: Point[]; label: string }) {
  const max = Math.max(1, ...points.map((point) => point.count))
  const total = points.reduce((sum, point) => sum + point.count, 0)
  return (
    <div>
      <div className="flex items-end justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{label}</p>
        <p className="text-sm font-black text-text-main">{total} in 14 days</p>
      </div>
      <div className="mt-3 flex h-20 items-end gap-1" role="img" aria-label={`${label}: ${total} in the last 14 days`}>
        {points.map((point) => (
          <div key={point.day} title={`${point.day}: ${point.count}`} className="flex-1 rounded-t bg-primary/70" style={{ height: `${Math.max(point.count === 0 ? 3 : 8, (point.count / max) * 100)}%`, opacity: point.count === 0 ? 0.25 : 1 }} />
        ))}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, value, label, hint }: { icon: typeof Users; value: string | number; label: string; hint?: string }) {
  return (
    <div className="metric-card">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-black text-text-main">{value}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">{label}</p>
        </div>
      </div>
      {hint ? <p className="text-xs font-semibold text-text-muted">{hint}</p> : null}
    </div>
  )
}

/** The admin landing page: how big the platform is, how it moved, the money, and what is waiting for a decision. */
export default function AdminOverviewPanel({ onOpenTab }: { onOpenTab: (tab: AdminTab) => void }) {
  const { data, isLoading, error } = useAdminOverview()

  if (isLoading) return <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Loading overview...</p>
  if (error || !data) return <p role="alert" className="text-sm font-semibold text-error">We could not load the overview.</p>

  const overview: AdminOverview = data
  const waiting = totalWaiting(overview.queues)
  const change = changePercent(overview.revenue.thisMonthPesewas, overview.revenue.lastMonthPesewas)

  return (
    <div className="space-y-8">
      <section aria-label="Needs your attention" className="rounded-3xl border border-surface-border bg-white/80 p-5 sm:p-6">
        <h2 className="text-lg font-black text-text-main">Needs your attention</h2>
        {waiting === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Nothing is waiting for you.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-surface-border/60">
            {QUEUE_ROWS.filter((row) => overview.queues[row.key] > 0).map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm font-semibold text-text-main">
                  <span className="mr-2 inline-flex min-w-7 justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-black text-white">{overview.queues[row.key]}</span>
                  {row.label}
                </span>
                <button type="button" onClick={() => onOpenTab(row.tab)} aria-label={`Open: ${row.label}`} className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-primary hover:underline">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="The platform in numbers" className="metric-rail">
        <Stat icon={Users} value={overview.users.total} label="People" hint={`${overview.users.new7} new this week, ${overview.users.new30} this month`} />
        <Stat icon={Briefcase} value={overview.jobs.active} label="Open jobs" hint={`${overview.jobs.new7} posted this week`} />
        <Stat icon={FileText} value={overview.applications.total} label="Applications" hint={`${overview.applications.new7} this week`} />
        <Stat
          icon={Users}
          value={`${overview.employers.verified} of ${overview.employers.total}`}
          label="Employers verified"
          hint={overview.employers.unverified > 0 ? `${overview.employers.unverified} not verified yet` : 'All verified'}
        />
        <Stat
          icon={Wallet}
          value={ghs(overview.revenue.thisMonthPesewas)}
          label="Revenue this month"
          hint={`${overview.revenue.paymentsThisMonth} payment${overview.revenue.paymentsThisMonth === 1 ? '' : 's'}${change === null ? '' : `, ${change >= 0 ? '+' : ''}${change}% vs last month`}${overview.revenue.mode === 'test' ? ' (test mode)' : ''}`}
        />
      </section>

      <section aria-label="Last 14 days" className="grid gap-6 rounded-3xl border border-surface-border bg-white/80 p-5 sm:p-6 md:grid-cols-3">
        <Bars points={overview.series.signups} label="Sign-ups" />
        <Bars points={overview.series.jobs} label="Jobs posted" />
        <Bars points={overview.series.applications} label="Applications" />
      </section>

      <p className="text-xs font-semibold text-text-light">
        By role: {overview.users.seekers} job seekers, {overview.users.employers} employers, {overview.users.freelancers} freelancers, {overview.users.admins} admins. Updated {formatRelativeTime(overview.generatedAt)}.
      </p>
    </div>
  )
}
