import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Building2, CalendarClock, Check, Minus, Rocket, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import PageHero from '../components/PageHero'
import SEO from '../components/SEO'
import { apiChangePlan, apiGetPlans, apiStartCheckout } from '../lib/api'
import { ghs } from '../lib/billing'
import { formatShortDate } from '../lib/display'
import { getErrorMessage } from '../lib/errors'
import { featureLines, planLevel, plansFor, yearlySavingPercent, type Plan, type PlanTier, type PlansResponse } from '../lib/plans'

const TIER_LOOK: Record<PlanTier, { icon: typeof Sparkles; circle: string; tagline: string }> = {
  FREE: { icon: Sparkles, circle: 'bg-surface-alt text-text-main', tagline: 'Everything to post and hire' },
  STARTER: { icon: Rocket, circle: 'bg-secondary/10 text-secondary', tagline: 'Stand out and grow your team' },
  BUSINESS: { icon: Building2, circle: 'bg-gold/25 text-gold-deep', tagline: 'For companies that hire all year' },
}

/** "Starter (monthly)" -> "Starter". The billing period is shown by the switch above the cards. */
const baseName = (plan: Plan) => plan.name.replace(/\s*\((monthly|yearly)\)\s*$/i, '')

type Cell = string | boolean

/** One row per thing a plan can include, with what each plan in view gets. */
const comparisonRows = (plans: Plan[]): { label: string; cells: Cell[] }[] => {
  const credits = (plan: Plan, value: number) => (value > 0 ? `${value} / month` : false)
  return [
    { label: 'Standard job posts', cells: plans.map(() => 'Unlimited') },
    { label: 'Applicant board', cells: plans.map(() => true) },
    { label: 'Team members', cells: plans.map((plan) => (plan.teamLimit === 1 ? '1 (you)' : `Up to ${plan.teamLimit}`)) },
    { label: 'Featured-job credits', cells: plans.map((plan) => credits(plan, plan.featuredCredits)) },
    { label: '"Urgently hiring" boosts', cells: plans.map((plan) => credits(plan, plan.boostCredits)) },
    { label: 'Branded company page', cells: plans.map((plan) => plan.brandedPage) },
    { label: 'CV database', cells: plans.map((plan) => (plan.cvDatabase ? (plan.monthlyUnlocks > 0 ? `${plan.monthlyUnlocks} unlocks / month` : true) : false)) },
    { label: 'Hiring reports', cells: plans.map((plan) => plan.hiringReports) },
    { label: 'Priority in "Top employers"', cells: plans.map((plan) => plan.topEmployers) },
  ]
}

const TRUST = [
  { icon: ShieldCheck, title: 'Trust is not for sale', text: 'Verification comes only from checking your business. Paying for a plan never gives you the badge.' },
  { icon: CalendarClock, title: 'Change your mind any time', text: 'Upgrades start straight away. Moving to a smaller plan waits for the end of the period you paid for.' },
  { icon: Wallet, title: 'No surprises if a payment fails', text: 'You get 7 days to fix it. After that you move to Free, and your jobs, applicants and team are kept.' },
]

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
  const bestSaving = data ? Math.max(0, ...(['STARTER', 'BUSINESS'] as const).map((tier) => yearlySavingPercent(data.plans, tier))) : 0

  const action = (plan: Plan, highlighted: boolean) => {
    if (!current) return null
    const isCurrent = plan.id === current.productId || (plan.planTier === 'FREE' && current.tier === 'FREE')
    if (isCurrent) {
      return (
        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-success/10 py-3 text-sm font-black text-success">
          <Check className="h-4 w-4" aria-hidden /> Your plan
        </span>
      )
    }
    if (planLevel(plan) > currentLevel) {
      return (
        <button
          type="button"
          disabled={data?.mode === 'off' || busy === plan.id}
          onClick={() => void upgrade(plan)}
          className={`btn btn-lg w-full justify-center disabled:opacity-60 ${highlighted ? 'btn-gold' : 'btn-primary'}`}
          aria-label={`Upgrade to ${plan.name}`}
        >
          {busy === plan.id ? 'Opening Paystack...' : current.tier === 'FREE' ? 'Choose this plan' : 'Upgrade now'} {busy === plan.id ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
        </button>
      )
    }
    return (
      <button type="button" disabled={busy === plan.id} onClick={() => downgrade(plan)} className="btn btn-outline btn-lg w-full justify-center bg-white disabled:opacity-60" aria-label={`Move to ${plan.name}`}>
        Move here at renewal
      </button>
    )
  }

  const rows = comparisonRows(shown)

  return (
    <div className="container max-w-6xl pb-24 pt-24 xl:pt-28">
      <SEO title="Employer plans" noindex />

      <PageHero eyebrow="Employer plans" title="Hire better," accent="pay only for what helps.">
        <p className="mt-5 max-w-2xl text-base font-medium text-white/75 sm:text-lg">
          Posting jobs and reviewing applicants is free. Paid plans add credits, a branded company page, a bigger team and more. A plan never changes your verification status, and never ranks an unverified employer above a verified one.
        </p>
        <ul className="mt-6 flex flex-wrap gap-3">
          {['Free to post and hire', 'Pay by card or mobile money', 'Cancel any time'].map((text) => (
            <li key={text} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white">
              <BadgeCheck className="h-4 w-4 text-gold" aria-hidden /> {text}
            </li>
          ))}
        </ul>
      </PageHero>

      <div className="mt-8 space-y-3">
        {error ? (
          <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-text-main">
            {notice}
          </p>
        ) : null}
        {data?.mode === 'off' ? (
          <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
            Payments are not switched on yet, so plans cannot be bought right now.
          </p>
        ) : null}
        {data?.mode === 'test' ? (
          <p role="status" className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-semibold text-text-main">
            Test mode: payments here are practice payments and no real money moves.
          </p>
        ) : null}
        {current?.subscription?.status === 'PAST_DUE' && current.subscription.graceEndsAt ? (
          <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
            We could not take your last payment. Your plan keeps working until {formatShortDate(current.subscription.graceEndsAt)}. After that you move to Free; nothing is deleted.
          </p>
        ) : null}
      </div>

      <div className="mt-10 flex justify-center">
        <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-surface-border bg-white p-1.5 shadow-premium-sm">
          {(['MONTHLY', 'YEARLY'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-black transition-colors ${period === value ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'}`}
            >
              {value === 'MONTHLY' ? 'Monthly' : 'Yearly'}
              {value === 'YEARLY' && bestSaving > 0 ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${period === 'YEARLY' ? 'bg-gold text-primary' : 'bg-success/15 text-success'}`}>Save up to {bestSaving}%</span> : null}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
        {shown.map((plan) => {
          const look = TIER_LOOK[plan.planTier]
          const Icon = look.icon
          const saving = data && plan.interval === 'YEARLY' ? yearlySavingPercent(data.plans, plan.planTier) : 0
          const highlighted = plan.planTier === 'STARTER'
          const isCurrent = Boolean(current && (plan.id === current.productId || (plan.planTier === 'FREE' && current.tier === 'FREE')))
          return (
            <li
              key={plan.id}
              aria-label={plan.name}
              className={`relative flex flex-col rounded-3xl border bg-white p-7 shadow-premium-sm transition-shadow hover:shadow-premium ${highlighted ? 'border-secondary ring-4 ring-secondary/10 lg:-mt-4 lg:pb-10' : isCurrent ? 'border-success/50' : 'border-surface-border'}`}
            >
              {highlighted ? <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-4 py-1 text-[11px] font-black uppercase tracking-widest text-primary">Recommended</span> : null}

              <div className="flex items-center gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${look.circle}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-text-main">{baseName(plan)}</h2>
                  <p className="text-xs font-bold text-text-light">{look.tagline}</p>
                </div>
              </div>

              <p className="mt-4 text-sm font-medium text-text-muted">{plan.description}</p>

              <div className="mt-6">
                <p className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-black tracking-tight text-text-main">{plan.planTier === 'FREE' ? 'Free' : plan.totalLabel}</span>
                  {plan.interval ? <span className="text-sm font-bold text-text-muted">/ {plan.interval === 'YEARLY' ? 'year' : 'month'}</span> : null}
                </p>
                {plan.interval === 'YEARLY' ? <p className="mt-1 text-xs font-bold text-text-muted">That is {ghs(Math.round(plan.totalPesewas / 12))} a month, paid once a year</p> : null}
                {saving > 0 ? (
                  <p className="mt-2 inline-block rounded-full bg-success/10 px-3 py-1 text-xs font-extrabold text-success">Save {saving}% against paying monthly</p>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-text-light">{plan.planTier === 'FREE' ? 'No card needed' : plan.vatRatePercent > 0 ? 'Includes VAT' : 'No VAT'}</p>
                )}
              </div>

              <div className="mt-6">{action(plan, highlighted)}</div>

              <p className="mt-7 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">What you get</p>
              <ul className="mt-3 space-y-2.5 text-sm font-semibold text-text-main">
                {featureLines(plan).map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden /> {line}
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>

      {shown.length > 0 ? (
        <section aria-label="Compare plans" className="mt-16">
          <h2 className="text-2xl font-black tracking-tight text-text-main">Compare plans side by side</h2>
          <div className="mt-5 overflow-x-auto rounded-3xl border border-surface-border bg-white shadow-premium-sm">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th scope="col" className="px-5 py-4 text-xs font-black uppercase tracking-widest text-text-light">
                    What is included
                  </th>
                  {shown.map((plan) => (
                    <th key={plan.id} scope="col" className="px-5 py-4 text-sm font-black text-text-main">
                      {baseName(plan)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-surface-border/60 last:border-0">
                    <th scope="row" className="px-5 py-3.5 font-bold text-text-main">
                      {row.label}
                    </th>
                    {row.cells.map((cell, index) => (
                      <td key={`${row.label}-${shown[index].id}`} className="px-5 py-3.5 font-semibold text-text-muted">
                        {cell === true ? <Check className="h-5 w-5 text-success" aria-label="Included" /> : cell === false ? <Minus className="h-5 w-5 text-text-light/60" aria-label="Not included" /> : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section aria-label="Good to know" className="mt-16 grid gap-5 md:grid-cols-3">
        {TRUST.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-3xl border border-surface-border bg-white p-6 shadow-premium-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-4 text-base font-black text-text-main">{title}</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-text-muted">{text}</p>
          </div>
        ))}
      </section>

      <ul className="mt-10 space-y-1 text-xs font-medium text-text-light">
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
