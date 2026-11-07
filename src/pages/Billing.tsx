import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, CreditCard, Download, GraduationCap, Package, Receipt, Rocket, Star, Zap } from 'lucide-react'
import PageHero from '../components/PageHero'
import SEO from '../components/SEO'
import {
  apiCancelSubscription,
  apiDownloadReceipt,
  apiGetBillingCatalogue,
  apiGetMyBilling,
  apiGetPaymentStatus,
  apiPromoteJob,
  apiStartCheckout,
} from '../lib/api'
import { STATUS_LABEL, ghs, promotionLabel, type Product } from '../lib/billing'
import { formatShortDate } from '../lib/display'
import { getErrorMessage } from '../lib/errors'

type MyBilling = {
  credits: { featuredCredits: number; boostCredits: number }
  subscriptions: { id: string; name: string; interval: string | null; status: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean }[]
  payments: { id: string; reference: string; productName: string; status: string; totalPesewas: number; vatPesewas: number; refundedPesewas: number; receiptNumber: string | null; paidAt: string | null; createdAt: string }[]
  jobs: { id: string; title: string; promotion: string | null }[]
  courses: { id: string; title: string; featured: boolean }[]
}

const POLL_MS = 2000
const POLL_TRIES = 8

const KIND_ICON: Record<Product['kind'], typeof Star> = {
  FEATURED_JOB: Star,
  JOB_BOOST: Zap,
  JOB_PACK: Package,
  FEATURED_COURSE: GraduationCap,
  SUBSCRIPTION: CreditCard,
  PROFILE_BOOST: Rocket,
}

const STATUS_PILL: Record<string, string> = {
  PAID: 'bg-success/10 text-success',
  FAILED: 'bg-error/10 text-error',
  REFUNDED: 'bg-gold/20 text-gold-deep',
  PARTIALLY_REFUNDED: 'bg-gold/20 text-gold-deep',
  PENDING: 'bg-surface-alt text-text-muted',
}

/** Credits, your plan, one-off promotions, and payment history with receipts. */
export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [mode, setMode] = useState<'test' | 'live' | 'off'>('off')
  const [mine, setMine] = useState<MyBilling | null>(null)
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const [catalogue, billing] = await Promise.all([apiGetBillingCatalogue(), apiGetMyBilling()])
      setProducts(catalogue.products ?? [])
      setMode(catalogue.mode ?? 'off')
      setMine(billing)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load your billing page.'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Coming back from Paystack: ask the server (which asks Paystack) whether the payment went through.
  const reference = searchParams.get('reference')
  useEffect(() => {
    if (!reference) return
    let cancelled = false

    const check = async (attempt: number) => {
      try {
        const result = (await apiGetPaymentStatus(reference)) as { status: string; receiptNumber?: string | null }
        if (cancelled) return
        if (result.status === 'PAID') {
          setNotice(`Payment received. Thank you.${result.receiptNumber ? ` Receipt ${result.receiptNumber}.` : ''}`)
          setSearchParams({}, { replace: true })
          void load()
        } else if (result.status === 'FAILED') {
          setError('That payment did not go through. Nothing was charged. You can try again.')
          setSearchParams({}, { replace: true })
          void load()
        } else if (attempt < POLL_TRIES) {
          setNotice('Waiting for your payment to be confirmed...')
          window.setTimeout(() => void check(attempt + 1), POLL_MS)
        } else {
          setNotice('We are still waiting for confirmation. If you paid, it will appear here shortly.')
          setSearchParams({}, { replace: true })
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'We could not check that payment.'))
      }
    }

    void check(1)
    return () => {
      cancelled = true
    }
  }, [reference, setSearchParams, load])

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

  const buy = (product: Product) =>
    run(product.id, async () => {
      const result = (await apiStartCheckout(product.id, targets[product.id])) as { authorizationUrl: string }
      window.location.assign(result.authorizationUrl)
    })

  const spendJobCredit = (product: Product) =>
    run(`credit-${product.id}`, async () => {
      await apiPromoteJob(targets[product.id], product.kind === 'FEATURED_JOB' ? 'FEATURE' : 'BOOST')
      setNotice(`Done. Your job is now ${product.kind === 'FEATURED_JOB' ? 'featured' : 'marked "Urgently hiring"'}.`)
      await load()
    })

  const cancel = (id: string) => {
    if (!window.confirm('Cancel this plan? It keeps working until the end of the period you paid for.')) return
    void run(`cancel-${id}`, async () => {
      await apiCancelSubscription(id)
      setNotice('Your plan will not renew. It keeps working until the end of the period you paid for.')
      await load()
    })
  }

  const download = (id: string) =>
    run(`receipt-${id}`, async () => {
      const { blob, name } = await apiDownloadReceipt(id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      URL.revokeObjectURL(url)
    })

  const needsJob = (product: Product) => product.kind === 'FEATURED_JOB' || product.kind === 'JOB_BOOST'
  const needsCourse = (product: Product) => product.kind === 'FEATURED_COURSE'
  const targetOptions = (product: Product) => (needsJob(product) ? mine?.jobs ?? [] : needsCourse(product) ? mine?.courses ?? [] : [])
  const hasCredit = (product: Product) =>
    (product.kind === 'FEATURED_JOB' && (mine?.credits.featuredCredits ?? 0) > 0) || (product.kind === 'JOB_BOOST' && (mine?.credits.boostCredits ?? 0) > 0)

  // Plans (and the Free plan) are chosen on the Plans page. This page sells one-off promotions.
  const shopProducts = products.filter((product) => product.kind !== 'SUBSCRIPTION')
  const offersPlans = products.some((product) => product.kind === 'SUBSCRIPTION')
  const livePlans = mine?.subscriptions ?? []

  return (
    <div className="container max-w-5xl pb-24 pt-24 xl:pt-28">
      <SEO title="Billing" noindex />

      <PageHero eyebrow="Billing" title="Your credits," accent="plan and receipts.">
        <p className="mt-5 max-w-2xl text-base font-medium text-white/75 sm:text-lg">Promote your jobs, buy credits, and download your receipts. Pay by card or mobile money.</p>
        <Link to="/plans" className="btn btn-gold btn-lg mt-6 inline-flex px-7">
          Compare employer plans <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
      </PageHero>

      <div className="mt-8 space-y-3">
        {mode === 'test' ? (
          <p role="status" className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-semibold text-text-main">
            Test mode: payments here are practice payments and no real money moves.
          </p>
        ) : null}
        {mode === 'off' && products.length > 0 ? (
          <p role="alert" className="rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
            Payments are not switched on yet. You can look around, but you cannot buy anything right now.
          </p>
        ) : null}
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
      </div>

      {mine ? (
        <section aria-label="Your credits and plan" className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-surface-border bg-white p-7 shadow-premium-sm">
            <h2 className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-text-main">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <Rocket className="h-4 w-4" aria-hidden />
              </span>
              Your credits
            </h2>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-secondary/10 to-transparent p-4">
                <dt className="text-xs font-bold uppercase tracking-wider text-text-light">Featured job</dt>
                <dd className="mt-1 text-4xl font-black text-text-main">{mine.credits.featuredCredits}</dd>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-gold/20 to-transparent p-4">
                <dt className="text-xs font-bold uppercase tracking-wider text-text-light">Urgently hiring</dt>
                <dd className="mt-1 text-4xl font-black text-text-main">{mine.credits.boostCredits}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs font-medium text-text-muted">Use a credit on any open job from the promotions below. Credits you buy never expire.</p>
          </div>

          <div className="rounded-3xl border border-surface-border bg-white p-7 shadow-premium-sm">
            <h2 className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-text-main">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <CreditCard className="h-4 w-4" aria-hidden />
              </span>
              Your plan
            </h2>
            {livePlans.length === 0 ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-text-muted">You are not on a plan.</p>
                {offersPlans ? (
                  <Link to="/plans" className="mt-3 inline-flex items-center gap-1.5 text-sm font-black text-primary hover:underline">
                    See what a plan adds <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : null}
              </div>
            ) : null}
            <ul className="mt-5 space-y-4">
              {livePlans.map((plan) => (
                <li key={plan.id} className="rounded-2xl bg-surface-alt/60 p-4">
                  <p className="flex flex-wrap items-center gap-2 text-lg font-black text-text-main">
                    {plan.name}
                    {plan.status === 'PAST_DUE' ? <span className="rounded-full bg-error/10 px-2.5 py-0.5 text-xs font-extrabold text-error">Payment problem</span> : null}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-muted">
                    {plan.cancelAtPeriodEnd ? 'Ends' : 'Renews'} on {formatShortDate(plan.currentPeriodEnd)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <Link to="/plans" className="text-xs font-black uppercase tracking-widest text-primary hover:underline">
                      Change plan
                    </Link>
                    {plan.cancelAtPeriodEnd ? null : (
                      <button type="button" disabled={busy === `cancel-${plan.id}`} onClick={() => cancel(plan.id)} className="text-xs font-black uppercase tracking-widest text-error hover:underline disabled:opacity-60">
                        Cancel plan
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section aria-label="Buy" className="mt-14">
        <h2 className="text-2xl font-black tracking-tight text-text-main">Promote and buy</h2>
        <p className="mt-1 text-sm font-medium text-text-muted">One-off promotions. Each is paid once, with no subscription.</p>
        {shopProducts.length === 0 && mine ? <p className="mt-5 text-sm font-semibold text-text-muted">Nothing is on sale right now.</p> : null}
        <ul className="mt-6 grid gap-5 md:grid-cols-2">
          {shopProducts.map((product) => {
            const options = targetOptions(product)
            const needsTarget = needsJob(product) || needsCourse(product)
            const chosen = targets[product.id]
            const Icon = KIND_ICON[product.kind] ?? Package
            return (
              <li key={product.id} className="flex flex-col rounded-3xl border border-surface-border bg-white p-7 shadow-premium-sm transition-shadow hover:shadow-premium">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black tracking-tight text-text-main">{product.name}</h3>
                    <p className="mt-1 text-sm font-medium text-text-muted">{product.description}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black tracking-tight text-text-main">{product.totalLabel}</span>
                    {product.interval ? <span className="text-sm font-bold text-text-muted">/ {product.interval === 'YEARLY' ? 'year' : 'month'}</span> : null}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-text-light">{product.vatRatePercent > 0 ? `Includes VAT of ${ghs(product.vatPesewas)}` : 'No VAT'}</p>
                </div>

                {product.includes.length > 0 ? (
                  <ul className="mt-4 space-y-2 text-sm font-semibold text-text-main">
                    {product.includes.map((line) => (
                      <li key={line} className="flex gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden /> {line}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {needsTarget ? (
                  <label className="mt-5 block text-sm font-bold text-text-main">
                    {needsCourse(product) ? 'Which course?' : 'Which job?'}
                    <select value={chosen ?? ''} onChange={(e) => setTargets((current) => ({ ...current, [product.id]: e.target.value }))} className="mt-1 h-11 w-full text-sm font-semibold" aria-label={`${product.name}: choose ${needsCourse(product) ? 'a course' : 'a job'}`}>
                      <option value="">{options.length ? 'Choose one' : needsCourse(product) ? 'You have no live courses' : 'You have no open jobs'}</option>
                      {options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.title}
                          {'promotion' in option && option.promotion ? ` (${promotionLabel(option.promotion)})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2 pt-6">
                  <button
                    type="button"
                    disabled={mode === 'off' || busy === product.id || (needsTarget && !chosen)}
                    onClick={() => void buy(product)}
                    className="btn btn-primary btn-md px-6 disabled:opacity-60"
                    aria-label={`Buy ${product.name}`}
                  >
                    {busy === product.id ? 'Opening Paystack...' : 'Buy now'}
                  </button>
                  {hasCredit(product) ? (
                    <button type="button" disabled={!chosen || busy === `credit-${product.id}`} onClick={() => void spendJobCredit(product)} className="btn btn-outline btn-md bg-white disabled:opacity-60" aria-label={`Use a credit for ${product.name}`}>
                      <Zap className="h-4 w-4" aria-hidden /> Use a credit
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-label="Payment history" className="mt-14">
        <h2 className="text-2xl font-black tracking-tight text-text-main">Payment history</h2>
        {mine && mine.payments.length === 0 ? (
          <div className="mt-5 flex flex-col items-center rounded-3xl border border-dashed border-surface-border bg-white p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-alt text-text-light">
              <Receipt className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-4 text-sm font-semibold text-text-muted">No payments yet.</p>
            <p className="mt-1 text-xs font-medium text-text-light">Your receipts will appear here after your first purchase.</p>
          </div>
        ) : null}
        {mine && mine.payments.length > 0 ? (
          <div className="mt-5 overflow-x-auto rounded-3xl border border-surface-border bg-white shadow-premium-sm">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs font-bold uppercase tracking-wider text-text-light">
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Item</th>
                  <th className="px-5 py-4">Total</th>
                  <th className="px-5 py-4">VAT</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {mine.payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-alt/30">
                    <td className="px-5 py-4 font-semibold text-text-muted">{formatShortDate(payment.paidAt ?? payment.createdAt)}</td>
                    <td className="px-5 py-4 font-bold text-text-main">{payment.productName}</td>
                    <td className="px-5 py-4 font-bold text-text-main">{ghs(payment.totalPesewas)}</td>
                    <td className="px-5 py-4 font-semibold text-text-muted">{ghs(payment.vatPesewas)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold ${STATUS_PILL[payment.status] ?? 'bg-surface-alt text-text-muted'}`}>{STATUS_LABEL[payment.status] ?? payment.status}</span>
                    </td>
                    <td className="px-5 py-4">
                      {payment.receiptNumber ? (
                        <button type="button" disabled={busy === `receipt-${payment.id}`} onClick={() => void download(payment.id)} aria-label={`Download receipt ${payment.receiptNumber}`} className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline disabled:opacity-60">
                          <Download className="h-3.5 w-3.5" aria-hidden /> {payment.receiptNumber}
                        </button>
                      ) : (
                        <span className="text-text-light">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="mt-5 text-xs font-medium text-text-light">
          Questions about a payment?{' '}
          <Link to="/support" className="font-bold text-primary hover:underline">
            Contact support
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
