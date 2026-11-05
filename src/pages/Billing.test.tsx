import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminBillingPanel from '../components/AdminBillingPanel'
import PromotionBadge from '../components/PromotionBadge'
import { ghs, promotionLabel, promotionOf } from '../lib/billing'
import Billing from './Billing'

const api = vi.hoisted(() => ({
  catalogue: vi.fn(),
  mine: vi.fn(),
  checkout: vi.fn(),
  status: vi.fn(),
  promote: vi.fn(),
  cancel: vi.fn(),
  receipt: vi.fn(),
  adminProducts: vi.fn(),
  adminSaveProduct: vi.fn(),
  adminSettings: vi.fn(),
  adminSaveSettings: vi.fn(),
  adminRevenue: vi.fn(),
  adminPayments: vi.fn(),
  adminRefund: vi.fn(),
  adminLookup: vi.fn(),
  adminCredits: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  apiGetBillingCatalogue: (...a: unknown[]) => api.catalogue(...a),
  apiGetMyBilling: (...a: unknown[]) => api.mine(...a),
  apiStartCheckout: (...a: unknown[]) => api.checkout(...a),
  apiGetPaymentStatus: (...a: unknown[]) => api.status(...a),
  apiPromoteJob: (...a: unknown[]) => api.promote(...a),
  apiCancelSubscription: (...a: unknown[]) => api.cancel(...a),
  apiDownloadReceipt: (...a: unknown[]) => api.receipt(...a),
  apiAdminBillingProducts: (...a: unknown[]) => api.adminProducts(...a),
  apiAdminSaveProduct: (...a: unknown[]) => api.adminSaveProduct(...a),
  apiAdminBillingSettings: (...a: unknown[]) => api.adminSettings(...a),
  apiAdminSaveBillingSettings: (...a: unknown[]) => api.adminSaveSettings(...a),
  apiAdminRevenue: (...a: unknown[]) => api.adminRevenue(...a),
  apiAdminBillingPayments: (...a: unknown[]) => api.adminPayments(...a),
  apiAdminRefund: (...a: unknown[]) => api.adminRefund(...a),
  apiAdminLookupAccount: (...a: unknown[]) => api.adminLookup(...a),
  apiAdminAdjustCredits: (...a: unknown[]) => api.adminCredits(...a),
}))

const product = (overrides: Record<string, unknown> = {}) => ({
  id: 'p-feat',
  kind: 'FEATURED_JOB',
  slug: 'featured-job',
  name: 'Featured job (30 days)',
  description: 'Show one job above others.',
  audience: 'EMPLOYER',
  durationDays: 30,
  featuredCredits: 0,
  boostCredits: 0,
  interval: null,
  includes: ['Labelled "Featured"'],
  active: true,
  sortOrder: 0,
  priceGhs: 50,
  totalPesewas: 5000,
  totalLabel: 'GHS 50.00',
  vatPesewas: 652,
  pricesIncludeVat: true,
  vatRatePercent: 15,
  ...overrides,
})

const mine = (overrides: Record<string, unknown> = {}) => ({
  credits: { featuredCredits: 0, boostCredits: 0 },
  subscriptions: [],
  payments: [],
  jobs: [{ id: 'job-1', title: 'Receptionist', promotion: null }],
  courses: [{ id: 'course-1', title: 'Excel basics', featured: false }],
  ...overrides,
})

const renderAt = (url = '/billing') =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[url]}>
        <Billing />
      </MemoryRouter>
    </HelmetProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  api.catalogue.mockResolvedValue({ mode: 'live', products: [product()] })
  api.mine.mockResolvedValue(mine())
  api.checkout.mockResolvedValue({ authorizationUrl: 'https://checkout.paystack.com/abc' })
  api.promote.mockResolvedValue({ success: true })
  api.cancel.mockResolvedValue({ success: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the helpers', () => {
  it('say the labels, with "Urgently hiring" ahead of "Featured", and ending by themselves', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const past = new Date(Date.now() - 86_400_000).toISOString()

    expect(promotionLabel('URGENT')).toBe('Urgently hiring')
    expect(promotionLabel('FEATURED')).toBe('Featured')
    expect(promotionLabel(null)).toBe('')
    expect(promotionOf({ featuredUntil: future, boostedUntil: future })).toBe('URGENT')
    expect(promotionOf({ featuredUntil: future })).toBe('FEATURED')
    expect(promotionOf({ featuredUntil: past, boostedUntil: past })).toBeNull()
    expect(ghs(125050)).toBe('GHS 1,250.50')
  })

  it('the badge shows the label on promoted jobs and nothing on others', () => {
    const { container, rerender } = render(<PromotionBadge promotion="URGENT" />)
    expect(screen.getByText('Urgently hiring')).toBeInTheDocument()

    rerender(<PromotionBadge promotion="FEATURED" />)
    expect(screen.getByText('Featured')).toBeInTheDocument()

    rerender(<PromotionBadge promotion={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('the billing page', () => {
  it('shows each product with the price the customer pays, the VAT in it, and what it includes', async () => {
    renderAt()

    expect(await screen.findByRole('heading', { name: 'Featured job (30 days)' })).toBeInTheDocument()
    expect(screen.getByText('GHS 50.00')).toBeInTheDocument()
    expect(screen.getByText('Includes VAT of GHS 6.52')).toBeInTheDocument()
    expect(screen.getByText(/Labelled "Featured"/)).toBeInTheDocument()
  })

  it('a plan shows its repeat period; a plan with no VAT says so', async () => {
    api.catalogue.mockResolvedValue({ mode: 'live', products: [product({ id: 'sub', kind: 'SUBSCRIPTION', name: 'Employer plan (monthly)', interval: 'MONTHLY', vatRatePercent: 0, vatPesewas: 0 })] })

    renderAt()

    expect(await screen.findByText('/ month')).toBeInTheDocument()
    expect(screen.getByText('No VAT')).toBeInTheDocument()
  })

  it('says "Test mode" while the keys are test keys, and offers nothing to buy with no keys', async () => {
    api.catalogue.mockResolvedValue({ mode: 'test', products: [product()] })
    const { unmount } = renderAt()
    expect(await screen.findByText(/test mode/i)).toBeInTheDocument()
    unmount()

    api.catalogue.mockResolvedValue({ mode: 'off', products: [product({ kind: 'JOB_PACK', id: 'pack', name: 'Job pack' })] })
    renderAt()
    expect(await screen.findByText(/payments are not switched on yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buy Job pack' })).toBeDisabled()
  })

  it('a pack can be bought straight away: the browser is sent to Paystack, and the price is never sent', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign } as unknown as Location)
    api.catalogue.mockResolvedValue({ mode: 'live', products: [product({ id: 'pack', kind: 'JOB_PACK', name: 'Job pack: 5 featured jobs', featuredCredits: 5 })] })
    renderAt()

    fireEvent.click(await screen.findByRole('button', { name: 'Buy Job pack: 5 featured jobs' }))

    await waitFor(() => expect(api.checkout).toHaveBeenCalledWith('pack', undefined))
    expect(assign).toHaveBeenCalledWith('https://checkout.paystack.com/abc')
    vi.restoreAllMocks()
  })

  it('a job promotion needs a job chosen first, and sends that job', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign } as unknown as Location)
    renderAt()

    const buy = await screen.findByRole('button', { name: 'Buy Featured job (30 days)' })
    expect(buy).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/featured job \(30 days\): choose a job/i), { target: { value: 'job-1' } })
    expect(buy).toBeEnabled()
    fireEvent.click(buy)

    await waitFor(() => expect(api.checkout).toHaveBeenCalledWith('p-feat', 'job-1'))
    vi.restoreAllMocks()
  })

  it('a training provider chooses a course for a featured listing', async () => {
    api.catalogue.mockResolvedValue({ mode: 'live', products: [product({ id: 'fc', kind: 'FEATURED_COURSE', name: 'Featured course listing', audience: 'PROVIDER' })] })
    renderAt()

    const select = await screen.findByLabelText(/featured course listing: choose a course/i)
    expect(within(select).getByRole('option', { name: 'Excel basics' })).toBeInTheDocument()
  })

  it('shows the credits, and lets one be used on a job, in place of paying', async () => {
    api.mine.mockResolvedValue(mine({ credits: { featuredCredits: 3, boostCredits: 1 } }))
    renderAt()

    expect(await screen.findByText('3')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/choose a job/i), { target: { value: 'job-1' } })
    fireEvent.click(screen.getByRole('button', { name: /use a credit for featured job/i }))

    await waitFor(() => expect(api.promote).toHaveBeenCalledWith('job-1', 'FEATURE'))
    expect(await screen.findByRole('status')).toHaveTextContent(/now featured/i)
  })

  it('offers no credit button when there are none', async () => {
    renderAt()

    await screen.findByRole('heading', { name: 'Featured job (30 days)' })
    expect(screen.queryByRole('button', { name: /use a credit/i })).not.toBeInTheDocument()
  })

  it('shows a plan with its renewal date, and cancelling asks first', async () => {
    api.mine.mockResolvedValue(mine({ subscriptions: [{ id: 'sub-1', name: 'Employer plan (monthly)', interval: 'MONTHLY', status: 'ACTIVE', currentPeriodEnd: '2026-12-10T00:00:00.000Z', cancelAtPeriodEnd: false }] }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderAt()

    expect(await screen.findByText(/renews on/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel plan/i }))
    expect(api.cancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /cancel plan/i }))
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('sub-1'))
    expect(await screen.findByText(/will not renew/i)).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('a plan that is already cancelled says when it ends and has no cancel button; a failed renewal is flagged', async () => {
    api.mine.mockResolvedValue(mine({ subscriptions: [{ id: 's1', name: 'Ending plan', interval: 'MONTHLY', status: 'ACTIVE', currentPeriodEnd: '2026-12-10T00:00:00.000Z', cancelAtPeriodEnd: true }, { id: 's2', name: 'Late plan', interval: 'YEARLY', status: 'PAST_DUE', currentPeriodEnd: '2026-12-10T00:00:00.000Z', cancelAtPeriodEnd: false }] }))
    renderAt()

    expect(await screen.findByText(/ends on/i)).toBeInTheDocument()
    expect(screen.getByText('Payment problem')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /cancel plan/i })).toHaveLength(1)
  })

  describe('payment history and receipts', () => {
    const history = [
      { id: 'pay-1', reference: 'R1', productName: 'Featured job (30 days)', status: 'PAID', totalPesewas: 5000, vatPesewas: 652, refundedPesewas: 0, receiptNumber: 'JW-2026-000007', paidAt: '2026-11-02T10:00:00.000Z', createdAt: '2026-11-02T10:00:00.000Z' },
      { id: 'pay-2', reference: 'R2', productName: 'Job boost (7 days)', status: 'FAILED', totalPesewas: 2500, vatPesewas: 326, refundedPesewas: 0, receiptNumber: null, paidAt: null, createdAt: '2026-11-03T10:00:00.000Z' },
      { id: 'pay-3', reference: 'R3', productName: 'Job pack', status: 'PARTIALLY_REFUNDED', totalPesewas: 20000, vatPesewas: 2609, refundedPesewas: 5000, receiptNumber: 'JW-2026-000008', paidAt: '2026-11-04T10:00:00.000Z', createdAt: '2026-11-04T10:00:00.000Z' },
    ]

    it('lists each payment with its total, VAT and status, and a receipt only where there is one', async () => {
      api.mine.mockResolvedValue(mine({ payments: history }))
      renderAt()

      const table = within(await screen.findByRole('table'))
      expect(table.getByText('Featured job (30 days)')).toBeInTheDocument()
      expect(table.getByText('GHS 6.52')).toBeInTheDocument()
      expect(table.getByText('Paid')).toBeInTheDocument()
      expect(table.getByText('Failed')).toBeInTheDocument()
      expect(table.getByText('Partly refunded')).toBeInTheDocument()
      expect(table.getByRole('button', { name: 'Download receipt JW-2026-000007' })).toBeInTheDocument()
      expect(table.getAllByRole('button')).toHaveLength(2)
    })

    it('downloads a receipt as a file', async () => {
      api.mine.mockResolvedValue(mine({ payments: history }))
      api.receipt.mockResolvedValue({ blob: new Blob(['<html></html>'], { type: 'text/html' }), name: 'receipt-JW-2026-000007.html' })
      const createUrl = vi.fn(() => 'blob:receipt')
      Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() })
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
      renderAt()

      fireEvent.click(await screen.findByRole('button', { name: 'Download receipt JW-2026-000007' }))

      await waitFor(() => expect(api.receipt).toHaveBeenCalledWith('pay-1'))
      await waitFor(() => expect(click).toHaveBeenCalled())
      click.mockRestore()
    })

    it('says so when there is no history yet', async () => {
      renderAt()

      expect(await screen.findByText(/no payments yet/i)).toBeInTheDocument()
    })
  })

  describe('coming back from Paystack', () => {
    it('asks the server whether it went through, and says so when it did', async () => {
      api.status.mockResolvedValue({ status: 'PAID', receiptNumber: 'JW-2026-000007' })

      renderAt('/billing?reference=JWB-REF-1')

      expect(await screen.findByText(/payment received. thank you. receipt JW-2026-000007/i)).toBeInTheDocument()
      expect(api.status).toHaveBeenCalledWith('JWB-REF-1')
    })

    it('says plainly when it failed, and that nothing was charged', async () => {
      api.status.mockResolvedValue({ status: 'FAILED' })

      renderAt('/billing?reference=JWB-REF-2')

      expect(await screen.findByRole('alert')).toHaveTextContent(/did not go through.*nothing was charged/i)
    })

    it('keeps checking while the payment is still being confirmed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      api.status.mockResolvedValueOnce({ status: 'PENDING' }).mockResolvedValue({ status: 'PAID', receiptNumber: 'JW-2026-000009' })

      renderAt('/billing?reference=JWB-REF-3')

      expect(await screen.findByText(/waiting for your payment to be confirmed/i)).toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(2100)
      expect(await screen.findByText(/receipt JW-2026-000009/i)).toBeInTheDocument()
      expect(api.status).toHaveBeenCalledTimes(2)
    })
  })

  it('says why when buying fails', async () => {
    api.catalogue.mockResolvedValue({ mode: 'live', products: [product({ id: 'pack', kind: 'JOB_PACK', name: 'Job pack' })] })
    api.checkout.mockRejectedValue(new Error('We could not reach the payment provider. Nothing was charged.'))
    renderAt()

    fireEvent.click(await screen.findByRole('button', { name: 'Buy Job pack' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing was charged/i)
  })
})

describe('the admin billing panel', () => {
  const revenue = {
    byProduct: [{ kind: 'FEATURED_JOB', name: 'Featured job', count: 2, grossPesewas: 10000, vatPesewas: 1304, refundedPesewas: 5000 }],
    byMonth: [{ month: '2026-11', count: 2, grossPesewas: 10000, refundedPesewas: 5000 }],
    totals: { count: 2, grossPesewas: 10000, vatPesewas: 1304, refundedPesewas: 5000, netPesewas: 5000 },
  }
  const settings = { vatRatePercent: 15, pricesIncludeVat: true, companyName: 'JobWahala Ltd', companyAddress: 'Accra', companyTin: 'C001', companyEmail: '', companyPhone: '', receiptFooter: 'Thanks' }
  const payment = { id: 'pay-1', reference: 'JWB-R1', productName: 'Featured job (30 days)', status: 'PAID', totalPesewas: 5000, refundedPesewas: 0, receiptNumber: 'JW-2026-000007', billToName: 'Acme Ltd', billToEmail: 'hr@acme.example', paidAt: '2026-11-02T10:00:00.000Z', createdAt: '2026-11-02T10:00:00.000Z' }

  beforeEach(() => {
    api.adminRevenue.mockResolvedValue(revenue)
    api.adminPayments.mockResolvedValue({ payments: [payment] })
    api.adminProducts.mockResolvedValue({ products: [product()] })
    api.adminSettings.mockResolvedValue({ settings })
    api.adminSaveProduct.mockResolvedValue({ success: true })
    api.adminSaveSettings.mockResolvedValue({ success: true })
    api.adminRefund.mockResolvedValue({ success: true })
    api.adminCredits.mockResolvedValue({ success: true })
  })

  it('shows money in, VAT, refunds and net, by product and by month', async () => {
    render(<AdminBillingPanel />)

    expect((await screen.findAllByText('GHS 100.00')).length).toBeGreaterThan(0)
    expect(screen.getByText('VAT collected')).toBeInTheDocument()
    expect(screen.getByText('Net after refunds')).toBeInTheDocument()
    expect(screen.getAllByText('GHS 50.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Featured job')).toBeInTheDocument()
    expect(screen.getByText('2026-11')).toBeInTheDocument()
  })

  it('refunds a payment with a reason (and an amount if partial)', async () => {
    render(<AdminBillingPanel />)
    fireEvent.click(await screen.findByRole('tab', { name: /payments/i }))

    fireEvent.change(await screen.findByLabelText('Refund reason for JWB-R1'), { target: { value: 'Posted by mistake' } })
    fireEvent.change(screen.getByLabelText('Refund amount for JWB-R1'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Refund JWB-R1' }))

    await waitFor(() => expect(api.adminRefund).toHaveBeenCalledWith('pay-1', { reason: 'Posted by mistake', reverseBenefits: true, amountGhs: 20 }))
    expect(await screen.findByRole('status')).toHaveTextContent(/refunded/i)
  })

  it('a refund with no amount refunds the lot, and a refunded payment has no refund button', async () => {
    api.adminPayments.mockResolvedValue({ payments: [payment, { ...payment, id: 'pay-2', reference: 'JWB-R2', status: 'REFUNDED', refundedPesewas: 5000 }] })
    render(<AdminBillingPanel />)
    fireEvent.click(await screen.findByRole('tab', { name: /payments/i }))

    fireEvent.change(await screen.findByLabelText('Refund reason for JWB-R1'), { target: { value: 'Customer paid twice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Refund JWB-R1' }))

    await waitFor(() => expect(api.adminRefund).toHaveBeenCalledWith('pay-1', { reason: 'Customer paid twice', reverseBenefits: true }))
    expect(screen.queryByRole('button', { name: 'Refund JWB-R2' })).not.toBeInTheDocument()
  })

  it('searches payments', async () => {
    render(<AdminBillingPanel />)
    fireEvent.click(await screen.findByRole('tab', { name: /payments/i }))

    fireEvent.change(await screen.findByLabelText('Search payments'), { target: { value: 'acme' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(api.adminPayments).toHaveBeenLastCalledWith({ q: 'acme' }))
  })

  it('adjusts credits with a reason, and can look the account up first', async () => {
    api.adminLookup.mockResolvedValue({ account: { id: 'u1', email: 'hr@acme.example', featuredCredits: 2, boostCredits: 0, plans: [] } })
    render(<AdminBillingPanel />)
    fireEvent.click(await screen.findByRole('tab', { name: /payments/i }))

    fireEvent.change(await screen.findByLabelText('Account email'), { target: { value: 'hr@acme.example' } })
    fireEvent.change(screen.getByLabelText(/change by/i), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Goodwill after an outage' } })
    fireEvent.click(screen.getByRole('button', { name: /look up account/i }))
    expect(await screen.findByText(/2 featured credits/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /change credits/i }))
    await waitFor(() => expect(api.adminCredits).toHaveBeenCalledWith({ email: 'hr@acme.example', type: 'FEATURE', delta: 3, reason: 'Goodwill after an outage' }))
  })

  it('edits a product\'s price and what it includes, without code', async () => {
    render(<AdminBillingPanel />)
    fireEvent.click(await screen.findByRole('tab', { name: /products and prices/i }))

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Featured job (30 days)' }))
    fireEvent.change(screen.getByLabelText('Price (GHS)'), { target: { value: '65.50' } })
    fireEvent.change(screen.getByLabelText('Lasts (days)'), { target: { value: '21' } })
    fireEvent.change(screen.getByLabelText(/what is included/i), { target: { value: 'Labelled "Featured"\nShown first' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }))

    await waitFor(() => expect(api.adminSaveProduct).toHaveBeenCalled())
    const [payload, id] = api.adminSaveProduct.mock.calls[0]
    expect(id).toBe('p-feat')
    expect(payload).toMatchObject({ kind: 'FEATURED_JOB', priceGhs: 65.5, durationDays: 21, includes: ['Labelled "Featured"', 'Shown first'], active: true })
  })

  it('creates a plan, which needs monthly or yearly, and a pack, which asks for credits', async () => {
    render(<AdminBillingPanel />)
    fireEvent.click(await screen.findByRole('tab', { name: /products and prices/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'New product' }))

    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'SUBSCRIPTION' } })
    expect(screen.getByLabelText('Repeats')).toBeInTheDocument()
    expect(screen.getByLabelText('Featured job credits')).toBeInTheDocument()
    expect(screen.queryByLabelText('Lasts (days)')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Agency plan' } })
    fireEvent.change(screen.getByLabelText('Price (GHS)'), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText('Repeats'), { target: { value: 'MONTHLY' } })
    fireEvent.change(screen.getByLabelText('Featured job credits'), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }))

    await waitFor(() => expect(api.adminSaveProduct).toHaveBeenCalled())
    const [payload, id] = api.adminSaveProduct.mock.calls[0]
    expect(id).toBeUndefined()
    expect(payload).toMatchObject({ kind: 'SUBSCRIPTION', name: 'Agency plan', priceGhs: 300, interval: 'MONTHLY', featuredCredits: 6 })
  })

  it('changes the VAT rate and the company details on receipts', async () => {
    render(<AdminBillingPanel />)
    fireEvent.click(await screen.findByRole('tab', { name: /settings/i }))

    fireEvent.change(await screen.findByLabelText('VAT rate (%)'), { target: { value: '12.5' } })
    fireEvent.change(screen.getByLabelText('TIN / VAT number'), { target: { value: 'C0099999999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => expect(api.adminSaveSettings).toHaveBeenCalledWith(expect.objectContaining({ vatRatePercent: 12.5, companyTin: 'C0099999999', companyName: 'JobWahala Ltd' })))
  })

  it('says so when it cannot load', async () => {
    api.adminRevenue.mockRejectedValue(new Error('Network down'))
    render(<AdminBillingPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/network down/i)
  })
})
