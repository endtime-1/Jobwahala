import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, CircleSlash, RefreshCw, XCircle } from 'lucide-react'
import { formatRelativeTime } from '../lib/display'
import type { HealthItem } from '../lib/adminOverview'
import { useAdminHealth } from '../pages/dashboards/admin/hooks'

const LOOK: Record<HealthItem['status'], { icon: typeof CheckCircle2; label: string; tone: string }> = {
  ok: { icon: CheckCircle2, label: 'Working', tone: 'text-success' },
  warn: { icon: AlertTriangle, label: 'Needs a look', tone: 'text-gold' },
  error: { icon: XCircle, label: 'Broken or missing', tone: 'text-error' },
  off: { icon: CircleSlash, label: 'Off', tone: 'text-text-light' },
}

/** Is everything the site depends on set up? Shows each item with a plain sentence, never a key or password. */
export default function AdminHealthPanel() {
  const queryClient = useQueryClient()
  const { data, isLoading, error, isFetching } = useAdminHealth()

  if (isLoading) return <p className="text-sm font-black uppercase tracking-[0.2em] text-text-light">Checking the system...</p>
  if (error || !data) return <p role="alert" className="text-sm font-semibold text-error">We could not run the system check.</p>

  const { errors, warnings } = data.summary

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-text-main">System health</h2>
          <p className="text-sm font-semibold text-text-muted">
            {errors === 0 && warnings === 0 ? 'Everything is set up.' : `${errors} to fix, ${warnings} to look at.`} Checked {formatRelativeTime(data.checkedAt)}.
          </p>
        </div>
        <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin', 'health'] })} disabled={isFetching} className="btn btn-outline btn-sm bg-white disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Check again
        </button>
      </div>

      <ul className="divide-y divide-surface-border/60 rounded-3xl border border-surface-border bg-white/80">
        {[...data.items]
          .sort((a, b) => ['error', 'warn', 'ok', 'off'].indexOf(a.status) - ['error', 'warn', 'ok', 'off'].indexOf(b.status))
          .map((item) => {
            const look = LOOK[item.status]
            const Icon = look.icon
            return (
              <li key={item.key} className="flex items-start gap-4 px-5 py-4">
                <Icon className={`mt-0.5 h-5 w-5 flex-none ${look.tone}`} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-black text-text-main">
                    {item.label} <span className={`ml-2 text-[10px] font-black uppercase tracking-widest ${look.tone}`}>{look.label}</span>
                  </p>
                  <p className="mt-1 text-sm font-medium text-text-muted">{item.detail}</p>
                </div>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
