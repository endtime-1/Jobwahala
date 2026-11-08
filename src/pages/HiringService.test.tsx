import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { guaranteeLabel, salaryLabel } from '../lib/hiring'

const api = vi.hoisted(() => ({
  info: vi.fn(),
  create: vi.fn(),
  mine: vi.fn(),
  detail: vi.fn(),
  cancel: vi.fn(),
  decision: vi.fn(),
  replacement: vi.fn(),
  opportunities: vi.fn(),
  respond: vi.fn(),
}))
const auth = vi.hoisted(() => ({ user: null as Record<string, unknown> | null, role: null as string | null }))

vi.mock('../lib/api', () => ({
  apiHiringInfo: (...a: unknown[]) => api.info(...a),
  apiCreateHiringRequest: (...a: unknown[]) => api.create(...a),
  apiMyHiringRequests: (...a: unknown[]) => api.mine(...a),
  apiHiringRequest: (...a: unknown[]) => api.detail(...a),
  apiCancelHiringRequest: (...a: unknown[]) => api.cancel(...a),
  apiHiringDecision: (...a: unknown[]) => api.decision(...a),
  apiHiringReplacement: (...a: unknown[]) => api.replacement(...a),
  apiOpportunities: (...a: unknown[]) => api.opportunities(...a),
  apiRespondToOpportunity: (...a: unknown[]) => api.respond(...a),
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, role: auth.role }) }))
vi.mock('../components/EvidenceLink', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }))

import HiringRequestForm from './HiringRequestForm'
import HiringRequestPage from './HiringRequest'
import HiringService from './HiringService'
import Opportunities from './Opportunities'

const page = (ui: React.ReactElement, path = '/', route = '/') =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={ui} />
          <Route path="/hiring-service/:id" element={<p>Request page</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  auth.user = null
  auth.role = null
  api.info.mockResolvedValue({ info: { fromPriceGhs: 1200, guaranteeDays: 90 } })
  api.mine.mockResolvedValue({ requests: [] })
})

describe('the public Hiring Service page', () => {
  it('explains the service, the steps and the replacement guarantee, with the price set by the admin', async () => {
    page(<HiringService />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('We recruit. You hire.')
    expect(await screen.findByText('From GHS 1,200')).toBeInTheDocument()
    for (const title of ['Tell us the role', 'We agree the terms', 'We find and screen', 'You choose']) expect(screen.getByText(title)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /replacement guarantee/i })).toBeInTheDocument()
    expect(screen.getAllByText(/90 days/).length).toBeGreaterThan(0)
  })

  it('says "ask us for a quote" when no price is set, and uses the guarantee length the admin set', async () => {
    api.info.mockResolvedValue({ info: { fromPriceGhs: null, guaranteeDays: 60 } })
    page(<HiringService />)

    expect(await screen.findByText('Ask us for a quote')).toBeInTheDocument()
    expect((await screen.findAllByText(/60 days/)).length).toBeGreaterThan(0)
  })

  it('offers a visitor sign-up, an employer the request form, and a job seeker an explanation', async () => {
    const first = page(<HiringService />)
    expect(await screen.findByRole('link', { name: /sign up to start a request/i })).toHaveAttribute('href', '/signup?role=employer')
    first.unmount()

    auth.user = { id: 'e' }
    auth.role = 'EMPLOYER'
    const second = page(<HiringService />)
    expect(await screen.findByRole('link', { name: 'Let JobWahala hire for you' })).toHaveAttribute('href', '/hiring-service/new')
    second.unmount()

    auth.role = 'SEEKER'
    page(<HiringService />)
    expect(await screen.findByText(/for employer accounts/i)).toBeInTheDocument()
  })

  it('lists the employer’s requests with their status', async () => {
    auth.user = { id: 'e' }
    auth.role = 'EMPLOYER'
    api.mine.mockResolvedValue({ requests: [{ id: 'req-1', reference: 'HS-2026-0001', roleTitle: 'Cashier', status: 'SOURCING', headcount: 1, location: 'Kumasi', deadline: null, sentAt: null, createdAt: '2026-11-01T00:00:00Z' }] })
    page(<HiringService />)

    const link = await screen.findByRole('link', { name: /cashier/i })
    expect(link).toHaveAttribute('href', '/hiring-service/req-1')
    expect(link).toHaveTextContent('Sourcing')
  })

  it('words the guarantee and pay plainly', () => {
    expect(guaranteeLabel(12)).toBe('12 days left')
    expect(guaranteeLabel(1)).toBe('1 day left')
    expect(guaranteeLabel(0)).toBe('Ends today')
    expect(guaranteeLabel(-3)).toBe('Ended 3 days ago')
    expect(guaranteeLabel(null)).toBe('')
    expect(salaryLabel(1500, 2000)).toBe('GHS 1,500 to GHS 2,000 a month')
    expect(salaryLabel(null, null)).toBe('Salary not stated')
  })
})

describe('the request form', () => {
  const open = () => {
    auth.user = { id: 'e' }
    auth.role = 'EMPLOYER'
    return page(<HiringRequestForm />, '/hiring-service/new', '/hiring-service/new')
  }

  it('asks for the role, number of hires, salary range, location, start date, deadline, requirements and a contact person and phone', () => {
    open()
    const form = screen.getByRole('form', { name: 'Hiring request' })
    for (const field of ['Role', 'Number of hires', 'Lowest salary (GHS a month)', 'Highest salary (GHS a month)', 'Location', 'Start date', /Deadline/, 'Requirements', 'Contact person', 'Contact phone']) {
      expect(within(form).getByLabelText(field)).toBeInTheDocument()
    }
  })

  it('sends the request and opens its page', async () => {
    api.create.mockResolvedValue({ request: { id: 'req-9', reference: 'HS-2026-0009' } })
    open()

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Cashier' } })
    fireEvent.change(screen.getByLabelText('Number of hires'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Lowest salary (GHS a month)'), { target: { value: '1500' } })
    fireEvent.change(screen.getByLabelText('Highest salary (GHS a month)'), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Kumasi' } })
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-12-01' } })
    fireEvent.change(screen.getByLabelText(/Deadline/), { target: { value: '2026-11-30' } })
    fireEvent.change(screen.getByLabelText('Requirements'), { target: { value: 'Run the till and count cash every day.' } })
    fireEvent.change(screen.getByLabelText('Contact person'), { target: { value: 'Mr Mensah' } })
    fireEvent.change(screen.getByLabelText('Contact phone'), { target: { value: '0241234567' } })
    fireEvent.click(screen.getByRole('button', { name: /send my request/i }))

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1))
    expect(api.create.mock.calls[0][0]).toEqual({ roleTitle: 'Cashier', headcount: 2, salaryMin: 1500, salaryMax: 2000, location: 'Kumasi', startDate: '2026-12-01', deadline: '2026-11-30', requirements: 'Run the till and count cash every day.', contactName: 'Mr Mensah', contactPhone: '0241234567' })
    expect(await screen.findByText('Request page')).toBeInTheDocument()
  })

  it('shows the server message and stays on the form when the request is refused', async () => {
    api.create.mockRejectedValue(new Error('The lowest salary is higher than the highest.'))
    open()
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Cashier' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Kumasi' } })
    fireEvent.change(screen.getByLabelText('Requirements'), { target: { value: 'Run the till and count cash every day.' } })
    fireEvent.change(screen.getByLabelText('Contact person'), { target: { value: 'Mr Mensah' } })
    fireEvent.change(screen.getByLabelText('Contact phone'), { target: { value: '0241234567' } })
    fireEvent.click(screen.getByRole('button', { name: /send my request/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('lowest salary is higher')
    expect(screen.getByRole('form', { name: 'Hiring request' })).toBeInTheDocument()
  })

  it('is only for employer accounts', () => {
    auth.user = { id: 's' }
    auth.role = 'SEEKER'
    page(<HiringRequestForm />, '/hiring-service/new', '/hiring-service/new')
    expect(screen.getByText(/for employer accounts/i)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Hiring request' })).not.toBeInTheDocument()
  })
})

describe('the employer’s request page', () => {
  const candidate = (extra: Record<string, unknown> = {}) => ({
    id: 'c-1', stage: 'SHORTLISTED', name: 'Ama Mensah', headline: 'Cashier', skills: 'POS', experience: 'Five years', location: 'Kumasi', educationLevel: 'DIPLOMA', yearsExperience: 5,
    verifiedCertificate: true, identityVerified: false, fitScore: null, ratings: [], note: 'A strong cashier with five years in busy shops.', email: 'ama@example.com', phone: '+233241234567',
    cv: { url: '/api/uploads/cv/ama.pdf', fileName: 'ama.pdf' }, decision: null, decisionNote: null, startDate: null, ...extra,
  })
  const detail = (request: Record<string, unknown> = {}, candidates: unknown[] = [candidate()]) => ({
    request: {
      id: 'req-1', reference: 'HS-2026-0001', roleTitle: 'Cashier', status: 'SHORTLIST_SENT', headcount: 1, location: 'Kumasi', deadline: '2026-12-15T00:00:00Z', sentAt: '2026-11-15T00:00:00Z', createdAt: '2026-11-10T00:00:00Z',
      salaryMin: 1500, salaryMax: 2000, startDate: null, requirements: 'Run the till.', contactName: 'Mr Mensah', contactPhone: '0241234567', mustHaves: [], guaranteeDays: 90, guaranteeEndsAt: null, guaranteeDaysLeft: null,
      closeReason: null, recruiter: { name: 'Kofi Boateng', title: 'Recruiter' }, job: null, fee: null, canCancel: false, canRequestReplacement: false, ...request,
    },
    candidates,
    timeline: [{ id: 'e1', kind: 'DELIVERY', body: 'Our shortlist is ready: 1 candidate.', createdAt: '2026-11-15T00:00:00Z' }],
  })
  const open = () => page(<HiringRequestPage />, '/hiring-service/req-1', '/hiring-service/:id')

  it('shows the status in words, the recruiter, the shortlist with our note and CV, and the progress', async () => {
    api.detail.mockResolvedValue(detail())
    open()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Cashier')
    expect(screen.getByText('Shortlist sent')).toBeInTheDocument()
    expect(screen.getByText('Kofi Boateng')).toBeInTheDocument()
    const card = screen.getByRole('listitem', { name: 'Ama Mensah' })
    expect(card).toHaveTextContent('Our note')
    expect(card).toHaveTextContent('A strong cashier with five years in busy shops.')
    expect(card).toHaveTextContent('Verified certificate')
    expect(within(card).getByRole('link', { name: /ama@example.com/ })).toHaveAttribute('href', 'mailto:ama@example.com')
    expect(within(card).getByRole('link', { name: /open cv/i })).toHaveAttribute('href', '/api/uploads/cv/ama.pdf')
    expect(screen.getByText('Our shortlist is ready: 1 candidate.')).toBeInTheDocument()
  })

  it('shows the agreed fee, the deposit, what is paid and what is still to pay, read-only', async () => {
    api.detail.mockResolvedValue(detail({ fee: { agreed: true, feeLabel: 'GHS 3,000.00', depositLabel: 'GHS 1,000.00', balanceLabel: 'GHS 2,000.00', paidLabel: 'GHS 1,000.00', outstandingLabel: 'GHS 2,000.00', depositDuePesewas: 0, balanceDuePesewas: 200000, outstandingPesewas: 200000, settled: false } }))
    open()

    const box = (await screen.findByText('The agreement')).closest('div')!
    expect(box).toHaveTextContent('GHS 3,000.00')
    expect(box).toHaveTextContent('Paid so farGHS 1,000.00')
    expect(box).toHaveTextContent('Still to payGHS 2,000.00')
  })

  it('says the fee will be agreed when none is set yet, and shows no shortlist before it is sent', async () => {
    api.detail.mockResolvedValue(detail({ status: 'NEW', sentAt: null }, []))
    open()

    expect(await screen.findByText(/We will contact you to agree the fee/)).toBeInTheDocument()
    expect(screen.getByText(/When your recruiter sends the shortlist/)).toBeInTheDocument()
  })

  it('lets the employer invite to interview, mark not suitable, or mark hired with a start date', async () => {
    api.detail.mockResolvedValue(detail())
    api.decision.mockResolvedValue({ status: 'INTERVIEWING' })
    open()

    const card = await screen.findByRole('listitem', { name: 'Ama Mensah' })
    fireEvent.change(within(card).getByLabelText('Note for Ama Mensah'), { target: { value: 'Call Monday' } })
    fireEvent.click(within(card).getByRole('button', { name: 'Invite to interview' }))
    await waitFor(() => expect(api.decision).toHaveBeenCalledWith('req-1', 'c-1', { decision: 'INTERVIEW', note: 'Call Monday' }))
    expect(await screen.findByText('Thank you. We have told your recruiter.')).toBeInTheDocument()

    fireEvent.click(within(card).getByRole('button', { name: 'Not suitable' }))
    await waitFor(() => expect(api.decision).toHaveBeenLastCalledWith('req-1', 'c-1', { decision: 'NOT_SUITABLE', note: 'Call Monday' }))

    fireEvent.change(within(card).getByLabelText('Start date for Ama Mensah'), { target: { value: '2026-12-01' } })
    fireEvent.click(within(card).getByRole('button', { name: 'Hired' }))
    await waitFor(() => expect(api.decision).toHaveBeenLastCalledWith('req-1', 'c-1', { decision: 'HIRED', note: 'Call Monday', startDate: '2026-12-01' }))
  })

  it('shows what was decided, and offers no buttons before the shortlist is sent or on someone already hired', async () => {
    api.detail.mockResolvedValue(detail({ status: 'SOURCING', sentAt: null }, [candidate()]))
    const first = open()
    const card = await screen.findByRole('listitem', { name: 'Ama Mensah' })
    expect(within(card).queryByRole('button', { name: 'Hired' })).not.toBeInTheDocument()
    first.unmount()

    api.detail.mockResolvedValue(detail({ status: 'FILLED', guaranteeEndsAt: '2027-03-01T00:00:00Z', guaranteeDaysLeft: 80 }, [candidate({ stage: 'HIRED', decision: 'HIRED', startDate: '2026-12-01T00:00:00Z' })]))
    open()
    const hired = await screen.findByRole('listitem', { name: 'Ama Mensah' })
    expect(hired).toHaveTextContent('You marked this person as hired')
    expect(hired).toHaveTextContent('starts 1 Dec 2026')
    expect(within(hired).queryByRole('button', { name: 'Hired' })).not.toBeInTheDocument()
    expect(screen.getByText('Until 1 Mar 2027')).toBeInTheDocument()
    expect(screen.getByText('80 days left')).toBeInTheDocument()
  })

  it('shows the job post we made, a draft for the employer to review', async () => {
    api.detail.mockResolvedValue(detail({ job: { id: 'job-1', title: 'Cashier', status: 'DRAFT' } }))
    open()
    expect(await screen.findByText(/a draft for you to review in your dashboard/)).toBeInTheDocument()
  })

  it('lets the employer cancel before work starts', async () => {
    api.detail.mockResolvedValue(detail({ status: 'AGREED', sentAt: null, canCancel: true }, []))
    api.cancel.mockResolvedValue({ success: true })
    open()

    fireEvent.click(await screen.findByRole('button', { name: /cancel this request/i }))
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('req-1'))
  })

  it('offers a free replacement inside the guarantee, needing a reason', async () => {
    api.detail.mockResolvedValue(detail({ status: 'FILLED', canRequestReplacement: true, guaranteeEndsAt: '2027-03-01T00:00:00Z', guaranteeDaysLeft: 20 }))
    api.replacement.mockResolvedValue({ success: true })
    open()

    const button = await screen.findByRole('button', { name: /start a free replacement/i })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText('What happened?'), { target: { value: 'Left after two weeks' } })
    fireEvent.click(button)
    await waitFor(() => expect(api.replacement).toHaveBeenCalledWith('req-1', 'Left after two weeks'))
  })

  it('says so when the request is not theirs', async () => {
    api.detail.mockRejectedValue(new Error('No such hiring request.'))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('No such hiring request.')
  })
})

describe('the candidate’s opportunities page', () => {
  const item = (extra: Record<string, unknown> = {}) => ({
    id: 'c-1', stage: 'CONSENT_ASKED', answered: false, agreedAt: null, roleTitle: 'Cashier', location: 'Kumasi', salaryMin: 1500, salaryMax: 2000, description: 'Run the till.', company: 'Akoko Solutions',
    recruiter: { name: 'Kofi Boateng', title: 'Recruiter' }, consentText: 'I agree that JobWahala may put me forward for this role, and share my profile, CV and contact details with the hiring company.', ...extra,
  })

  it('shows the role, the recruiter and exactly what yes means', async () => {
    api.opportunities.mockResolvedValue({ opportunities: [item()] })
    page(<Opportunities />)

    const card = await screen.findByRole('listitem', { name: 'Cashier' })
    expect(card).toHaveTextContent('Akoko Solutions')
    expect(card).toHaveTextContent('Kofi Boateng')
    expect(card).toHaveTextContent('share my profile, CV and contact details')
    expect(card).toHaveTextContent('GHS 1,500 to GHS 2,000 a month')
  })

  it('says yes to be put forward, or no with an optional reason', async () => {
    api.opportunities.mockResolvedValue({ opportunities: [item()] })
    api.respond.mockResolvedValue({ success: true })
    page(<Opportunities />)

    fireEvent.click(await screen.findByRole('button', { name: /yes, put me forward/i }))
    await waitFor(() => expect(api.respond).toHaveBeenCalledWith('c-1', { accept: true }))
    fireEvent.change(screen.getByLabelText('Why not (optional)'), { target: { value: 'Happy where I am' } })
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }))
    await waitFor(() => expect(api.respond).toHaveBeenLastCalledWith('c-1', { accept: false, reason: 'Happy where I am' }))
  })

  it('lists answered ones separately, and explains when nobody has asked', async () => {
    api.opportunities.mockResolvedValue({ opportunities: [item({ id: 'c-2', stage: 'DECLINED', answered: true, roleTitle: 'Driver' }), item({ id: 'c-3', stage: 'CONSENTED', answered: true, roleTitle: 'Clerk' })] })
    const first = page(<Opportunities />)
    expect(await screen.findByText('You said no')).toBeInTheDocument()
    expect(screen.getByText('You said yes')).toBeInTheDocument()
    first.unmount()

    api.opportunities.mockResolvedValue({ opportunities: [] })
    page(<Opportunities />)
    expect(await screen.findByText(/No recruiter has asked/)).toBeInTheDocument()
  })
})
