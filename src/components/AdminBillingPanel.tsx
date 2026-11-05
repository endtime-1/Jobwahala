import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  apiAdminAdjustCredits,
  apiAdminBillingPayments,
  apiAdminBillingProducts,
  apiAdminBillingSettings,
  apiAdminLookupAccount,
  apiAdminRefund,
  apiAdminRevenue,
  apiAdminSaveBillingSettings,
  apiAdminSaveProduct,
} from '../lib/api'
import { STATUS_LABEL, ghs, type Product } from '../lib/billing'
import { getErrorMessage } from '../lib/errors'

type Revenue = {
  byProduct: { kind: string; name: string; count: number; grossPesewas: number; vatPesewas: number; refundedPesewas: number }[]
  byMonth: { month: string; count: number; grossPesewas: number; refundedPesewas: number }[]
  totals: { count: number; grossPesewas: number; vatPesewas: number; refundedPesewas: number; netPesewas: number }
}
type AdminPayment = { id: string; reference: string; productName: string; status: string; totalPesewas: number; refundedPesewas: number; receiptNumber: string | null; billToName: string | null; billToEmail: string | null; paidAt: string | null; createdAt: string }
type Settings = { vatRatePercent: number; pricesIncludeVat: boolean; companyName: string; companyAddress: string; companyTin: string; companyEmail: string; companyPhone: string; receiptFooter: string }

type ProductForm = {
  id?: string
  kind: Product['kind']
  name: string
  description: string
  audience: 'EMPLOYER' | 'PROVIDER'
  priceGhs: string
  durationDays: string
  featuredCredits: string
  boostCredits: string
  interval: '' | 'MONTHLY' | 'YEARLY'
  includes: string
  active: boolean
  sortOrder: string
}

const KINDS: { value: Product['kind']; label: string }[] = [
  { value: 'FEATURED_JOB', label: 'Featured job' },
  { value: 'JOB_BOOST', label: 'Job boost (urgently hiring)' },
  { value: 'JOB_PACK', label: 'Job pack (credits)' },
  { value: 'FEATURED_COURSE', label: 'Featured course listing' },
  { value: 'SUBSCRIPTION', label: 'Subscription plan' },
]

const emptyProduct: ProductForm = { kind: 'FEATURED_JOB', name: '', description: '', audience: 'EMPLOYER', priceGhs: '', durationDays: '30', featuredCredits: '0', boostCredits: '0', interval: '', includes: '', active: true, sortOrder: '0' }

const toForm = (product: Product): ProductForm => ({
  id: product.id,
  kind: product.kind,
  name: product.name,
  description: product.description,
  audience: product.audience,
  priceGhs: String(product.priceGhs),
  durationDays: product.durationDays != null ? String(product.durationDays) : '',
  featuredCredits: String(product.featuredCredits),
  boostCredits: String(product.boostCredits),
  interval: product.interval ?? '',
  // Only the admin's own lines, not the credit lines the server adds.
  includes: product.includes.filter((line) => !/credits?( every| )/.test(line) && !/credit(s)? every/.test(line)).join('\n'),
  active: product.active,
  sortOrder: String(product.sortOrder),
})

const toPayload = (form: ProductForm) => ({
  kind: form.kind,
  name: form.name.trim(),
  description: form.description.trim(),
  audience: form.kind === 'FEATURED_COURSE' ? 'PROVIDER' : form.audience,
  priceGhs: Number(form.priceGhs),
  durationDays: form.durationDays.trim() === '' ? null : Number(form.durationDays),
  featuredCredits: Number(form.featuredCredits) || 0,
  boostCredits: Number(form.boostCredits) || 0,
  interval: form.kind === 'SUBSCRIPTION' && form.interval ? form.interval : null,
  includes: form.includes.split('\n').map((line) => line.trim()).filter(Boolean),
  active: form.active,
  sortOrder: Number(form.sortOrder) || 0,
})

/** Admin billing: revenue, payments and refunds, credit adjustments, the product catalogue, and VAT and company settings. */
export default function AdminBillingPanel() {
  const [section, setSection] = useState<'revenue' | 'payments' | 'products' | 'settings'>('revenue')
  const [revenue, setRevenue] = useState<Revenue | null>(null)
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [editing, setEditing] = useState<ProductForm | null>(null)
  const [search, setSearch] = useState('')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [credit, setCredit] = useState({ email: '', type: 'FEATURE' as 'FEATURE' | 'BOOST', delta: '', reason: '' })
  const [account, setAccount] = useState<{ email: string; featuredCredits: number; boostCredits: number; plans: { name: string; status: string }[] } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadAll = useCallback(async (q = '') => {
    try {
      const [rev, pay, prod, set] = await Promise.all([apiAdminRevenue(12), apiAdminBillingPayments(q ? { q } : {}), apiAdminBillingProducts(), apiAdminBillingSettings()])
      setRevenue(rev)
      setPayments(pay.payments ?? [])
      setProducts(prod.products ?? [])
      setSettings(set.settings)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load billing.'))
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on first show
    void loadAll()
  }, [loadAll])

  const act = async (action: () => Promise<unknown>, success: string) => {
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(success)
      await loadAll(search)
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work.'))
    }
  }

  const saveProduct = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    void act(async () => {
      await apiAdminSaveProduct(toPayload(editing), editing.id)
      setEditing(null)
    }, 'Saved. New prices apply to new purchases only.')
  }

  const field = 'mt-1 h-10 w-full text-sm font-semibold'

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Billing sections" className="flex flex-wrap gap-2">
        {(['revenue', 'payments', 'products', 'settings'] as const).map((value) => (
          <button key={value} type="button" role="tab" aria-selected={section === value} onClick={() => setSection(value)} className={`dashboard-action-chip ${section === value ? 'border-primary/30 bg-primary/10 text-primary' : ''}`}>
            {value === 'products' ? 'Products and prices' : value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

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

      {section === 'revenue' && revenue ? (
        <section aria-label="Revenue" className="space-y-6">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                ['Payments', String(revenue.totals.count)],
                ['Money in', ghs(revenue.totals.grossPesewas)],
                ['VAT collected', ghs(revenue.totals.vatPesewas)],
                ['Net after refunds', ghs(revenue.totals.netPesewas)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-alt/60 p-4">
                <dt className="text-xs font-bold uppercase tracking-wider text-text-light">{label}</dt>
                <dd className="mt-1 text-2xl font-black text-text-main">{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <h3 className="mb-2 text-lg font-black text-text-main">By product</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wider text-text-light">
                  <th className="py-2">Product</th>
                  <th>Payments</th>
                  <th>Money in</th>
                  <th>VAT</th>
                  <th>Refunded</th>
                </tr>
              </thead>
              <tbody>
                {revenue.byProduct.map((row) => (
                  <tr key={row.kind} className="border-t border-surface-border/60">
                    <td className="py-2 font-bold text-text-main">{row.name}</td>
                    <td>{row.count}</td>
                    <td>{ghs(row.grossPesewas)}</td>
                    <td>{ghs(row.vatPesewas)}</td>
                    <td>{ghs(row.refundedPesewas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-black text-text-main">By month</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wider text-text-light">
                  <th className="py-2">Month</th>
                  <th>Payments</th>
                  <th>Money in</th>
                  <th>Refunded</th>
                </tr>
              </thead>
              <tbody>
                {revenue.byMonth.map((row) => (
                  <tr key={row.month} className="border-t border-surface-border/60">
                    <td className="py-2 font-bold text-text-main">{row.month}</td>
                    <td>{row.count}</td>
                    <td>{ghs(row.grossPesewas)}</td>
                    <td>{ghs(row.refundedPesewas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {section === 'payments' ? (
        <section aria-label="Payments" className="space-y-6">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void loadAll(search)
            }}
            className="flex gap-2"
          >
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email, name, reference or receipt" aria-label="Search payments" className="h-10 w-full max-w-md text-sm font-semibold" />
            <button type="submit" className="btn btn-outline btn-sm bg-white">
              Search
            </button>
          </form>

          <ul className="space-y-3">
            {payments.map((payment) => {
              const refundable = ['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status) && payment.refundedPesewas < payment.totalPesewas
              return (
                <li key={payment.id} className="rounded-2xl border border-surface-border bg-white p-4">
                  <p className="text-base font-extrabold text-text-main">
                    {payment.productName} · {ghs(payment.totalPesewas)} <span className="ml-2 text-xs font-bold uppercase tracking-wider text-text-light">{STATUS_LABEL[payment.status] ?? payment.status}</span>
                  </p>
                  <p className="text-sm font-semibold text-text-muted">
                    {[payment.billToName, payment.billToEmail, payment.receiptNumber, payment.reference].filter(Boolean).join(' · ')}
                    {payment.refundedPesewas > 0 ? ` · refunded ${ghs(payment.refundedPesewas)}` : ''}
                  </p>
                  {refundable ? (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <input value={reasons[payment.id] ?? ''} onChange={(e) => setReasons((current) => ({ ...current, [payment.id]: e.target.value }))} placeholder="Reason for the refund" aria-label={`Refund reason for ${payment.reference}`} className="h-10 w-64 text-sm font-semibold" />
                      <input value={amounts[payment.id] ?? ''} onChange={(e) => setAmounts((current) => ({ ...current, [payment.id]: e.target.value }))} placeholder="Amount (all if empty)" aria-label={`Refund amount for ${payment.reference}`} inputMode="decimal" className="h-10 w-40 text-sm font-semibold" />
                      <button
                        type="button"
                        onClick={() =>
                          void act(
                            () => apiAdminRefund(payment.id, { reason: reasons[payment.id] ?? '', reverseBenefits: true, ...(amounts[payment.id] ? { amountGhs: Number(amounts[payment.id]) } : {}) }),
                            'Refunded. The customer has been told.',
                          )
                        }
                        className="btn btn-outline btn-sm bg-white text-error"
                        aria-label={`Refund ${payment.reference}`}
                      >
                        Refund
                      </button>
                    </div>
                  ) : null}
                </li>
              )
            })}
            {payments.length === 0 ? <li className="text-sm font-semibold text-text-muted">No payments found.</li> : null}
          </ul>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void act(async () => {
                await apiAdminAdjustCredits({ email: credit.email, type: credit.type, delta: Number(credit.delta), reason: credit.reason })
                setAccount(null)
              }, 'Credits changed.')
            }}
            className="space-y-3 rounded-2xl border border-surface-border bg-white p-5"
            aria-label="Adjust credits"
          >
            <h3 className="text-lg font-black text-text-main">Adjust credits</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-bold text-text-main">
                Account email
                <input value={credit.email} onChange={(e) => setCredit((c) => ({ ...c, email: e.target.value }))} type="email" required className={field} />
              </label>
              <label className="block text-sm font-bold text-text-main">
                Kind
                <select value={credit.type} onChange={(e) => setCredit((c) => ({ ...c, type: e.target.value as 'FEATURE' | 'BOOST' }))} className={field}>
                  <option value="FEATURE">Featured job credits</option>
                  <option value="BOOST">Boost credits</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-text-main">
                Change by (use a minus to take away)
                <input value={credit.delta} onChange={(e) => setCredit((c) => ({ ...c, delta: e.target.value }))} inputMode="numeric" required className={field} />
              </label>
              <label className="block text-sm font-bold text-text-main">
                Reason
                <input value={credit.reason} onChange={(e) => setCredit((c) => ({ ...c, reason: e.target.value }))} required minLength={5} className={field} />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    setError('')
                    try {
                      const found = await apiAdminLookupAccount(credit.email)
                      setAccount(found.account)
                    } catch (err) {
                      setAccount(null)
                      setError(getErrorMessage(err, 'No account with that email.'))
                    }
                  })()
                }
                className="btn btn-outline btn-sm bg-white"
              >
                Look up account
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Change credits
              </button>
            </div>
            {account ? (
              <p className="text-sm font-semibold text-text-muted">
                {account.email}: {account.featuredCredits} featured credits, {account.boostCredits} boost credits{account.plans.length ? `, plan: ${account.plans.map((plan) => plan.name).join(', ')}` : ''}.
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      {section === 'products' ? (
        <section aria-label="Products and prices" className="space-y-4">
          {editing ? (
            <form onSubmit={saveProduct} className="space-y-4 rounded-2xl border border-surface-border bg-white p-5" aria-label="Product form">
              <h3 className="text-lg font-black text-text-main">{editing.id ? 'Edit product' : 'New product'}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-bold text-text-main">
                  Kind
                  <select value={editing.kind} disabled={Boolean(editing.id)} onChange={(e) => setEditing({ ...editing, kind: e.target.value as Product['kind'] })} className={field}>
                    {KINDS.map((kind) => (
                      <option key={kind.value} value={kind.value}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-bold text-text-main">
                  Name
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required minLength={3} className={field} />
                </label>
                <label className="block text-sm font-bold text-text-main sm:col-span-2">
                  Description
                  <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} maxLength={300} className={field} />
                </label>
                <label className="block text-sm font-bold text-text-main">
                  Price (GHS)
                  <input value={editing.priceGhs} onChange={(e) => setEditing({ ...editing, priceGhs: e.target.value })} inputMode="decimal" required className={field} />
                </label>
                {editing.kind === 'JOB_PACK' || editing.kind === 'SUBSCRIPTION' ? null : (
                  <label className="block text-sm font-bold text-text-main">
                    Lasts (days)
                    <input value={editing.durationDays} onChange={(e) => setEditing({ ...editing, durationDays: e.target.value })} inputMode="numeric" required className={field} />
                  </label>
                )}
                {editing.kind === 'JOB_PACK' || editing.kind === 'SUBSCRIPTION' ? (
                  <>
                    <label className="block text-sm font-bold text-text-main">
                      Featured job credits
                      <input value={editing.featuredCredits} onChange={(e) => setEditing({ ...editing, featuredCredits: e.target.value })} inputMode="numeric" className={field} />
                    </label>
                    <label className="block text-sm font-bold text-text-main">
                      Boost credits
                      <input value={editing.boostCredits} onChange={(e) => setEditing({ ...editing, boostCredits: e.target.value })} inputMode="numeric" className={field} />
                    </label>
                  </>
                ) : null}
                {editing.kind === 'SUBSCRIPTION' ? (
                  <label className="block text-sm font-bold text-text-main">
                    Repeats
                    <select value={editing.interval} onChange={(e) => setEditing({ ...editing, interval: e.target.value as ProductForm['interval'] })} required className={field}>
                      <option value="">Choose</option>
                      <option value="MONTHLY">Every month</option>
                      <option value="YEARLY">Every year</option>
                    </select>
                  </label>
                ) : null}
                {editing.kind === 'FEATURED_COURSE' ? null : (
                  <label className="block text-sm font-bold text-text-main">
                    For
                    <select value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value as 'EMPLOYER' | 'PROVIDER' })} className={field}>
                      <option value="EMPLOYER">Employers</option>
                      <option value="PROVIDER">Training providers</option>
                    </select>
                  </label>
                )}
                <label className="block text-sm font-bold text-text-main sm:col-span-2">
                  What is included (one line each)
                  <textarea value={editing.includes} onChange={(e) => setEditing({ ...editing, includes: e.target.value })} rows={3} className="mt-1 w-full text-sm font-semibold" />
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-text-main">
                  <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                  On sale
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm">
                  Save product
                </button>
                <button type="button" onClick={() => setEditing(null)} className="btn btn-outline btn-sm bg-white">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setEditing(emptyProduct)} className="btn btn-primary btn-sm">
              New product
            </button>
          )}

          <ul className="space-y-3">
            {products.map((product) => (
              <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-border bg-white p-4">
                <div>
                  <p className="text-base font-extrabold text-text-main">
                    {product.name} {product.active ? null : <span className="ml-2 text-xs font-bold uppercase tracking-wider text-text-light">Off sale</span>}
                  </p>
                  <p className="text-sm font-semibold text-text-muted">
                    {ghs(Math.round(product.priceGhs * 100))} {product.pricesIncludeVat ? '(VAT included)' : '(plus VAT)'} · customer pays {product.totalLabel}
                  </p>
                </div>
                <button type="button" onClick={() => setEditing(toForm(product))} className="btn btn-outline btn-sm bg-white" aria-label={`Edit ${product.name}`}>
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {section === 'settings' && settings ? (
        <form
          aria-label="Billing settings"
          onSubmit={(event) => {
            event.preventDefault()
            void act(() => apiAdminSaveBillingSettings(settings as unknown as Record<string, unknown>), 'Saved. New receipts use these details.')
          }}
          className="space-y-4 rounded-2xl border border-surface-border bg-white p-5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-bold text-text-main">
              VAT rate (%)
              <input value={settings.vatRatePercent} onChange={(e) => setSettings({ ...settings, vatRatePercent: Number(e.target.value) })} inputMode="decimal" className={field} />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm font-bold text-text-main">
              <input type="checkbox" checked={settings.pricesIncludeVat} onChange={(e) => setSettings({ ...settings, pricesIncludeVat: e.target.checked })} />
              Prices already include VAT
            </label>
            <label className="block text-sm font-bold text-text-main">
              Company name
              <input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} required className={field} />
            </label>
            <label className="block text-sm font-bold text-text-main">
              TIN / VAT number
              <input value={settings.companyTin} onChange={(e) => setSettings({ ...settings, companyTin: e.target.value })} className={field} />
            </label>
            <label className="block text-sm font-bold text-text-main sm:col-span-2">
              Address
              <input value={settings.companyAddress} onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })} className={field} />
            </label>
            <label className="block text-sm font-bold text-text-main">
              Email on receipts
              <input value={settings.companyEmail} onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })} className={field} />
            </label>
            <label className="block text-sm font-bold text-text-main">
              Phone on receipts
              <input value={settings.companyPhone} onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })} className={field} />
            </label>
            <label className="block text-sm font-bold text-text-main sm:col-span-2">
              Line at the bottom of receipts
              <input value={settings.receiptFooter} onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })} className={field} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary btn-sm">
            Save settings
          </button>
        </form>
      ) : null}
    </div>
  )
}
