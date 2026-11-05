import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import SEO from '../components/SEO'
import { apiChangePlan, apiGetPlans, apiStartCheckout } from '../lib/api'
import { formatShortDate } from '../lib/display'
import { getErrorMessage } from '../lib/errors'
import { featureLines, planLevel, plansFor, yearlySavingPercent, type Plan, type PlansResponse } from '../lib/plans'

/** Compare Free, Starter and Business, and move between them. Upgrades start now; smaller plans start when the period ends. */
export default function Plans() {
  const [data, setData] = useState<PlansResponse | null>(null)
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const result = (await apiGetPlans()) as PlansResponse
      setData(result)
      if (result.current.interval) setPeriod(result.current.interval)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load the plans.'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (key: string, action: () => Promise<void>) => {
    setError('')
    setNotice('')
    setBusy(key)
    try {
      await action()
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work. Please try again.'))
    } finally {
      setBusy('')
    }
  }

  const upgrade = (plan: Plan) =>
    run(plan.id, async () => {
      const result = (await apiStartCheckout(plan.id)) as { authorizationUrl: string }
      window.location.assign(result.authorizationUrl)
    })

  const downgrade = (plan: Plan) => {
    const when = data?.current.subscription ? formatShortDate(data.current.subscription.currentPeriodEnd) : 'the end of your period'
    if (!window.confirm(`Move to ${plan.name}? You keep your current plan until ${when}, then ${plan.name} starts.`)) return
    void run(plan.id, async () => {
      const result = (await apiChangePlan(plan.id)) as { scheduled: boolean; effectiveOn: string }
      setNotice(
        result.scheduled
          ? `Done. ${plan.name} starts on ${formatShortDate(result.effectiveOn)}. Until then you keep everything in your current plan.`
          : `Your current plan will not renew. It keeps working until ${formatShortDate(result.effectiveOn)}, then you are on ${plan.name}.`,
      )
      await load()
    })
  }

  const current = data?.current
  const shown = data ? plansFor(data.plans, period) : []
  const currentLevel = current ? planLevel({ planTier: current.tier, interval: current.interval }) : 0

  const action = (plan: Plan) => {
    if (!current) return null
    const isCurrent = plan.id === current.productId || (plan.planTier === 'FREE' && current.tier === 'FREE')
    if (isCurrent) {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-black text-success">
          <Check className="h-4 w-4" aria-hidden /> Your plan
        </span>
      )
    }
    if (planLevel(plan) > currentLevel) {
      return (
        <button type="button" disabled={data?.mode === 'off' || busy === plan.id} onClick={() => void upgrade(plan)} className="btn btn-primary btn-sm px-5 disabled:opacity-60" aria-label={`Upgrade to ${plan.name}`}>
          {busy === plan.id ? 'Opening Paystack...' : current.tier === 'FREE' ? 'Choose this plan' : 'Upgrade now'}
        </button>
      )
    }
    return (
      <button type="button" disabled={busy === plan.id} onClick={() => downgrade(plan)} className="btn btn-outline btn-sm bg-white px-5 disabled:opacity-60" aria-label={`Move to ${plan.name}`}>
        Move here at renewal
      </button>
    )
  }

  return (
    <div className="container max-w-6xl pb-24 pt-28">
      <SEO title="Employer plans" noindex />
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-black tracking-tight text-text-main">Plans for employers</h1>
        <p className="mt-2 text-base font-medium text-text-muted">
          Posting jobs and reviewing applicants is free. Paid plans add credits, a branded company page, a bigger team and more. A plan never changes your verification status, and never ranks an unverified employer above a verified one.
        </p>
      </header>

      {error ? (
        <p role="alert" className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mb-4 rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-text-main">
          {notice}
        </p>
      ) : null}
      {data?.mode === 'off' ? (
        <p role="alert" className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          Payments are not switched on yet, so plans cannot be bought right now.
        </p>
      ) : null}
      {current?.subscription?.status === 'PAST_DUE' && current.subscription.graceEndsAt ? (
        <p role="alert" className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          We could not take your last payment. Your plan keeps working until {formatShortDate(current.subscription.graceEndsAt)}. After that you move to Free; nothing is deleted.
        </p>
      ) : null}

      <div role="group" aria-label="Billing period" className="mb-6 inline-flex rounded-full border border-surface-border bg-white p-1">
        {(['MONTHLY', 'YEARLY'] as const).map((value) => (
          <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`rounded-full px-5 py-2 text-sm font-black ${period === value ? 'bg-primary text-white' : 'text-text-muted'}`}>
            {value === 'MONTHLY' ? 'Monthly' : 'Yearly'}
          </button>
        ))}
      </div>

      <ul className="grid gap-4 lg:grid-cols-3">
        {shown.map((plan) => {
          const saving = data && plan.interval === 'YEARLY' ? yearlySavingPercent(data.plans, plan.planTier) : 0
          return (
            <li key={plan.id} className="flex flex-col rounded-2xl border border-surface-border bg-white p-6" aria-label={plan.name}>
              <h2 className="text-lg font-extrabold text-text-main">{plan.name}</h2>
              <p className="mt-1 text-sm font-medium text-text-muted">{plan.description}</p>
              <p className="mt-4 text-3xl font-black text-text-main">
                {plan.planTier === 'FREE' ? 'Free' : plan.totalLabel}
                {plan.interval ? <span className="text-base font-bold text-text-muted"> / {plan.interval === 'YEARLY' ? 'year' : 'month'}</span> : null}
              </p>
              {saving > 0 ? (
                <p className="text-xs font-extrabold text-success">Save {saving}% against paying monthly</p>
              ) : (
                <p className="text-xs font-semibold text-text-light">{plan.planTier === 'FREE' ? 'No card needed' : plan.vatRatePercent > 0 ? 'Includes VAT' : 'No VAT'}</p>
              )}
              <ul className="mt-4 space-y-2 text-sm font-semibold text-text-main">
                {featureLines(plan).map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden /> {line}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-5">{action(plan)}</div>
            </li>
          )
        })}
      </ul>

      <ul className="mt-8 space-y-1 text-xs font-medium text-text-light">
        <li>Upgrades start immediately. Moving to a smaller plan starts when your current period ends.</li>
        <li>Monthly plan credits expire when the next month&apos;s credits arrive. Credits you bought never expire.</li>
        <li>If a payment fails you have 7 days to fix it. After that you move to Free; your jobs, applicants and team are kept.</li>
      </ul>
      <p className="mt-4 text-sm font-semibold text-text-muted">
        Want one-off promotions instead? See{' '}
        <Link to="/billing" className="font-bold text-primary hover:underline">
          Billing
        </Link>
        .
      </p>
    </div>
  )
}
