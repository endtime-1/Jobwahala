import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGetPlans } from '../lib/api'
import { formatShortDate } from '../lib/display'
import type { PlansResponse } from '../lib/plans'

/** "Current plan and usage" on the employer dashboard. */
export default function PlanUsagePanel() {
  const [data, setData] = useState<PlansResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = (await apiGetPlans()) as PlansResponse
        if (!cancelled) setData(result)
      } catch {
        // The panel is a convenience: the dashboard works without it.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null
  const { current, usage } = data
  const subscription = current.subscription
  const late = subscription?.status === 'PAST_DUE'

  return (
    <section className="dashboard-panel mb-8 p-4 sm:p-6" aria-label="Current plan and usage">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-text-light">Current plan</p>
          <h2 className="text-xl font-black text-text-main">{current.planName}</h2>
          {subscription ? (
            <p className="text-sm font-semibold text-text-muted">
              {late && subscription.graceEndsAt
                ? `Payment problem: fix it by ${formatShortDate(subscription.graceEndsAt)} to keep this plan.`
                : subscription.cancelAtPeriodEnd
                  ? `Ends on ${formatShortDate(subscription.currentPeriodEnd)}${subscription.pendingPlanName ? `, then ${subscription.pendingPlanName} starts` : ''}.`
                  : `Renews on ${formatShortDate(subscription.currentPeriodEnd)}.`}
            </p>
          ) : (
            <p className="text-sm font-semibold text-text-muted">Posting and the applicant board are free.</p>
          )}
        </div>
        <Link to="/plans" className="btn btn-outline btn-sm bg-white">
          {current.tier === 'FREE' ? 'See plans' : 'Compare or change plan'}
        </Link>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-alt/60 p-3">
          <dt className="text-xs font-bold uppercase tracking-wider text-text-light">Featured-job credits</dt>
          <dd className="mt-1 text-2xl font-black text-text-main">{usage.featuredCredits}</dd>
          <dd className="text-xs font-semibold text-text-muted">
            {usage.planCredits.featured} from your plan this month, {usage.purchasedCredits.featured} bought
          </dd>
        </div>
        <div className="rounded-xl bg-surface-alt/60 p-3">
          <dt className="text-xs font-bold uppercase tracking-wider text-text-light">Boost credits</dt>
          <dd className="mt-1 text-2xl font-black text-text-main">{usage.boostCredits}</dd>
          <dd className="text-xs font-semibold text-text-muted">
            {usage.planCredits.boost} from your plan this month, {usage.purchasedCredits.boost} bought
          </dd>
        </div>
        <div className="rounded-xl bg-surface-alt/60 p-3">
          <dt className="text-xs font-bold uppercase tracking-wider text-text-light">Team seats</dt>
          <dd className="mt-1 text-2xl font-black text-text-main">
            {usage.teamSeatsUsed} of {usage.teamLimit}
          </dd>
          <dd className="text-xs font-semibold text-text-muted">
            <Link to="/team" className="font-bold text-primary hover:underline">
              Manage team
            </Link>
          </dd>
        </div>
      </dl>

      {current.features.cvDatabase ? (
        <p className="mt-3 text-sm font-semibold text-text-muted">
          CV database unlocks this month: {usage.unlocksUsed ?? 0} of {usage.monthlyUnlocks ?? current.features.monthlyUnlocks ?? 0} used.
        </p>
      ) : null}

      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
        {current.features.cvDatabase ? (
          <Link to="/cv-database" className="text-primary hover:underline">
            CV database
          </Link>
        ) : null}
        {current.features.hiringReports ? (
          <Link to="/hiring-reports" className="text-primary hover:underline">
            Hiring reports
          </Link>
        ) : null}
        {current.features.brandedPage ? (
          <Link to="/company-page" className="text-primary hover:underline">
            Branded company page
          </Link>
        ) : null}
      </p>
    </section>
  )
}
