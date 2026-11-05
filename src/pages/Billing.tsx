import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CreditCard, Download, Rocket, Zap } from 'lucide-react'
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

/** Plans, credits, buying, and payment history with receipts, for employers and training providers. */
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

  return (
    <div className="container max-w-5xl pb-24 pt-28">
      <SEO title="Billing" noindex />
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-text-main">Billing</h1>
        <p className="mt-2 text-base font-medium text-text-muted">Promote your jobs, buy credits or a plan, and download your receipts. Pay by card or mobile money.</p>
      </header>

      {mode === 'test' ? (
        <p role="status" className="mb-4 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-semibold text-text-main">
          Test mode: payments here are practice payments and no real money moves.
        </p>
      ) : null}
      {mode === 'off' && products.length > 0 ? (
        <p role="alert" className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          Payments are not switched on yet. You can look around, but you cannot buy anything right now.
        </p>
      ) : null}
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

      {mine ? (
        <section aria-label="Your credits and plan" className="mb-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-surface-border bg-white p-6">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-main">
              <Rocket className="h-4 w-4 text-secondary" aria-hidden /> Your credits
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-alt/60 p-3">
                <dt className="text-xs font-bold uppercase tracking-wider text-text-light">Featured job</dt>
                <dd className="mt-1 text-3xl font-black text-text-main">{mine.credits.featuredCredits}</dd>
              </div>
              <div className="rounded-xl bg-surface-alt/60 p-3">
                <dt className="text-xs font-bold uppercase tracking-wider text-text-light">Urgently hiring</dt>
                <dd className="mt-1 text-3xl font-black text-text-main">{mine.credits.boostCredits}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-surface-border bg-white p-6">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-main">
              <CreditCard className="h-4 w-4 text-secondary" aria-hidden /> Your plan
            </h2>
            {mine.subscriptions.length === 0 ? <p className="mt-4 text-sm font-semibold text-text-muted">You are not on a plan. Pick one below to get credits every {`month or year`}.</p> : null}
            <ul className="mt-4 space-y-3">
              {mine.subscriptions.map((plan) => (
                <li key={plan.id}>
                  <p className="text-base font-extrabold text-text-main">
                    {plan.name} {plan.status === 'PAST_DUE' ? <span className="ml-2 rounded-full bg-error/10 px-2 py-0.5 text-xs font-extrabold text-error">Payment problem</span> : null}
                  </p>
                  <p className="text-sm font-semibold text-text-muted">
                    {plan.cancelAtPeriodEnd ? 'Ends' : 'Renews'} on {formatShortDate(plan.currentPeriodEnd)}
                  </p>
                  {plan.cancelAtPeriodEnd ? null : (
                    <button type="button" disabled={busy === `cancel-${plan.id}`} onClick={() => cancel(plan.id)} className="mt-2 text-xs font-black uppercase tracking-widest text-error hover:underline disabled:opacity-60">
                      Cancel plan
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section aria-label="Buy" className="mb-12">
        <h2 className="mb-4 text-xl font-black tracking-tight text-text-main">Buy</h2>
        {products.length === 0 && mine ? <p className="text-sm font-semibold text-text-muted">Nothing is on sale right now.</p> : null}
        <ul className="grid gap-4 md:grid-cols-2">
          {products.map((product) => {
            const options = targetOptions(product)
            const needsTarget = needsJob(product) || needsCourse(product)
            const chosen = targets[product.id]
            return (
              <li key={product.id} className="flex flex-col rounded-2xl border border-surface-border bg-white p-6">
                <h3 className="text-lg font-extrabold text-text-main">{product.name}</h3>
                <p className="mt-1 text-sm font-medium text-text-muted">{product.description}</p>
                <p className="mt-4 text-3xl font-black text-text-main">
                  {product.totalLabel}
                  {product.interval ? <span className="text-base font-bold text-text-muted"> / {product.interval === 'YEARLY' ? 'year' : 'month'}</span> : null}
                </p>
                <p className="text-xs font-semibold text-text-light">{product.vatRatePercent > 0 ? `Includes VAT of ${ghs(product.vatPesewas)}` : 'No VAT'}</p>
                {product.includes.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm font-semibold text-text-main">
                    {product.includes.map((line) => (
                      <li key={line}>• {line}</li>
                    ))}
                  </ul>
                ) : null}

                {needsTarget ? (
                  <label className="mt-4 block text-sm font-bold text-text-main">
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

                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <button
                    type="button"
                    disabled={mode === 'off' || busy === product.id || (needsTarget && !chosen)}
                    onClick={() => void buy(product)}
                    className="btn btn-primary btn-sm px-5 disabled:opacity-60"
                    aria-label={`Buy ${product.name}`}
                  >
                    {busy === product.id ? 'Opening Paystack...' : 'Buy now'}
                  </button>
                  {hasCredit(product) ? (
                    <button type="button" disabled={!chosen || busy === `credit-${product.id}`} onClick={() => void spendJobCredit(product)} className="btn btn-outline btn-sm bg-white disabled:opacity-60" aria-label={`Use a credit for ${product.name}`}>
                      <Zap className="h-3.5 w-3.5" aria-hidden /> Use a credit
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-label="Payment history">
        <h2 className="mb-4 text-xl font-black tracking-tight text-text-main">Payment history</h2>
        {mine && mine.payments.length === 0 ? <p className="rounded-2xl border border-dashed border-surface-border bg-white p-8 text-center text-sm font-semibold text-text-muted">No payments yet.</p> : null}
        {mine && mine.payments.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-surface-border bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs font-bold uppercase tracking-wider text-text-light">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">VAT</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {mine.payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-surface-border/60 last:border-0">
                    <td className="px-4 py-3 font-semibold text-text-muted">{formatShortDate(payment.paidAt ?? payment.createdAt)}</td>
                    <td className="px-4 py-3 font-bold text-text-main">{payment.productName}</td>
                    <td className="px-4 py-3 font-bold text-text-main">{ghs(payment.totalPesewas)}</td>
                    <td className="px-4 py-3 font-semibold text-text-muted">{ghs(payment.vatPesewas)}</td>
                    <td className="px-4 py-3 font-bold text-text-main">{STATUS_LABEL[payment.status] ?? payment.status}</td>
                    <td className="px-4 py-3">
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
        <p className="mt-4 text-xs font-medium text-text-light">
          Questions about a payment? <Link to="/support" className="font-bold text-primary hover:underline">Contact support</Link>.
        </p>
      </section>
    </div>
  )
}
