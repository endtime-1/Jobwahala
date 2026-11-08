import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  search: vi.fn(),
  add: vi.fn(),
  importApplicants: vi.fn(),
  open: vi.fn(),
  ask: vi.fn(),
  update: vi.fn(),
  drop: vi.fn(),
  shortlist: vi.fn(),
  hireStart: vi.fn(),
  send: vi.fn(),
  note: vi.fn(),
  setStatus: vi.fn(),
  createJob: vi.fn(),
  adminList: vi.fn(),
  assign: vi.fn(),
  staff: vi.fn(),
  terms: vi.fn(),
  payment: vi.fn(),
  removePayment: vi.fn(),
  settings: vi.fn(),
  createRecruiter: vi.fn(),
  setActive: vi.fn(),
  info: vi.fn(),
}))
const auth = vi.hoisted(() => ({ role: 'RECRUITER' as string, userName: 'Kofi' }))

vi.mock('../lib/api', () => ({
  apiStaffRequests: (...a: unknown[]) => api.list(...a),
  apiStaffRequest: (...a: unknown[]) => api.detail(...a),
  apiStaffSearch: (...a: unknown[]) => api.search(...a),
  apiStaffAddCandidate: (...a: unknown[]) => api.add(...a),
  apiStaffImportApplicants: (...a: unknown[]) => api.importApplicants(...a),
  apiStaffOpenCandidate: (...a: unknown[]) => api.open(...a),
  apiStaffAskConsent: (...a: unknown[]) => api.ask(...a),
  apiStaffUpdateCandidate: (...a: unknown[]) => api.update(...a),
  apiStaffDropCandidate: (...a: unknown[]) => api.drop(...a),
  apiStaffShortlist: (...a: unknown[]) => api.shortlist(...a),
  apiStaffHireStart: (...a: unknown[]) => api.hireStart(...a),
  apiStaffSend: (...a: unknown[]) => api.send(...a),
  apiStaffNote: (...a: unknown[]) => api.note(...a),
  apiStaffSetStatus: (...a: unknown[]) => api.setStatus(...a),
  apiStaffCreateJob: (...a: unknown[]) => api.createJob(...a),
  apiAdminHiringRequests: (...a: unknown[]) => api.adminList(...a),
  apiAdminAssignRecruiter: (...a: unknown[]) => api.assign(...a),
  apiAdminStaff: (...a: unknown[]) => api.staff(...a),
  apiAdminSaveTerms: (...a: unknown[]) => api.terms(...a),
  apiAdminRecordPayment: (...a: unknown[]) => api.payment(...a),
  apiAdminRemovePayment: (...a: unknown[]) => api.removePayment(...a),
  apiAdminHiringSettings: (...a: unknown[]) => api.settings(...a),
  apiAdminCreateRecruiter: (...a: unknown[]) => api.createRecruiter(...a),
  apiAdminSetRecruiterActive: (...a: unknown[]) => api.setActive(...a),
  apiHiringInfo: (...a: unknown[]) => api.info(...a),
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ role: auth.role, userName: auth.userName, user: { id: 'u' } }) }))
vi.mock('../components/EvidenceLink', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }))

import AdminHiringPanel from '../components/AdminHiringPanel'
import RecruiterDashboard from './dashboards/RecruiterDashboard'
import RecruiterRequest from './RecruiterRequest'

const row = (extra: Record<string, unknown> = {}) => ({
  id: 'req-1', reference: 'HS-2026-0001', roleTitle: 'Cashier', status: 'SOURCING', headcount: 1, location: 'Kumasi', deadline: '2026-12-15T00:00:00Z', sentAt: null, createdAt: '2026-11-10T00:00:00Z',
  company: 'Akoko Solutions', recruiter: 'Kofi Boateng', assignedRecruiterId: 'rec-1', guaranteeEndsAt: null, pipeline: { total: 4, shortlisted: 1 }, ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  auth.role = 'RECRUITER'
  api.info.mockResolvedValue({ info: { fromPriceGhs: 1200, guaranteeDays: 90 } })
})

describe('the recruiter dashboard', () => {
  it('lists only the assigned requests, folding finished ones away', async () => {
    api.list.mockResolvedValue({ requests: [row({ id: 'a', roleTitle: 'Open one' }), row({ id: 'b', roleTitle: 'Done', status: 'FILLED' })] })
    render(<MemoryRouter><RecruiterDashboard /></MemoryRouter>)

    const list = await screen.findByRole('list', { name: 'Requests' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(within(list).getByRole('link', { name: /open one/i })).toHaveAttribute('href', '/recruiter/requests/a')
    expect(list).toHaveTextContent('1 shortlisted · 4 in pipeline')
    expect(screen.getByText(/You see only the requests assigned to you/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show 1 finished request/i }))
    expect(within(screen.getByRole('list', { name: 'Requests' })).getAllByRole('listitem')).toHaveLength(2)
  })

  it('says so when nothing is assigned', async () => {
    api.list.mockResolvedValue({ requests: [] })
    render(<MemoryRouter><RecruiterDashboard /></MemoryRouter>)
    expect(await screen.findByText(/No requests are assigned to you yet/)).toBeInTheDocument()
  })
})

describe('the recruiter’s workbench', () => {
  const candidate = (extra: Record<string, unknown> = {}) => ({
    id: 'c-1', stage: 'SOURCED', source: 'CV_DATABASE', consentAt: null, consentAskedAt: null, declineReason: null, fitScore: null, ratings: [], note: null, staffNotes: null, shortlistedAt: null,
    decision: null, decisionNote: null, startDate: null, detailsOpen: false, name: 'Candidate (profile not open yet)', headline: 'Cashier', skills: null, experience: null, location: 'Kumasi',
    educationLevel: null, yearsExperience: 5, verifiedCertificate: false, identityVerified: false, email: null, phone: null, cv: null, ...extra,
  })
  const detail = (request: Record<string, unknown> = {}, candidates: unknown[] = [candidate()]) => ({
    request: {
      ...row(), company: 'Akoko Solutions', industry: 'Retail', salaryMin: 1500, salaryMax: 2000, startDate: null, requirements: 'Run the till and count cash.', contactName: 'Mr Mensah', contactPhone: '0241234567',
      mustHaves: [], assignedRecruiterId: 'rec-1', guaranteeDays: 90, guaranteeEndsAt: null, guaranteeDaysLeft: null, replacementCount: 0, closeReason: null, job: null, ...request,
    },
    candidates,
    events: [{ id: 'e1', candidateId: null, actorRole: 'SYSTEM', kind: 'STATUS', body: 'Request received.', visibility: 'CLIENT', createdAt: '2026-11-10T10:00:00Z' }],
  })
  const open = () =>
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/recruiter/requests/req-1']}>
          <Routes><Route path="/recruiter/requests/:id" element={<RecruiterRequest />} /></Routes>
        </MemoryRouter>
      </HelmetProvider>,
    )

  it('shows the request with its contact, and never any money', async () => {
    api.detail.mockResolvedValue(detail())
    open()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Cashier')
    expect(screen.getByRole('region', { name: 'The request' })).toHaveTextContent('Mr Mensah, 0241234567')
    expect(screen.queryByText(/GHS 3,000/)).not.toBeInTheDocument()
    expect(screen.queryByText(/deposit/i)).not.toBeInTheDocument()
  })

  it('switches sourcing off while the request is New (terms not agreed)', async () => {
    api.detail.mockResolvedValue(detail({ status: 'NEW' }, []))
    open()

    expect(await screen.findByText(/This request is New/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /find candidates/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send shortlist/i })).not.toBeInTheDocument()
  })

  it('changes the status, and only an admin is offered Cancel', async () => {
    api.detail.mockResolvedValue(detail({ status: 'AGREED' }))
    api.setStatus.mockResolvedValue({ success: true })
    open()

    const select = await screen.findByLabelText('Status')
    expect(within(select).queryByRole('option', { name: 'Cancel request' })).not.toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'SOURCING' } })
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith('req-1', 'SOURCING'))
  })

  it('offers an admin Cancel, which asks for a reason', async () => {
    auth.role = 'ADMIN'
    api.detail.mockResolvedValue(detail())
    api.setStatus.mockResolvedValue({ success: true })
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Employer asked us to stop')
    open()

    fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'CANCELLED' } })
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith('req-1', 'CANCELLED', 'Employer asked us to stop'))
    prompt.mockRestore()
  })

  it('creates the job post in one click (a draft, or published if ticked), then adds its applicants', async () => {
    api.detail.mockResolvedValue(detail())
    api.createJob.mockResolvedValue({ jobId: 'job-1' })
    const first = open()

    fireEvent.click(await screen.findByRole('button', { name: /create job post/i }))
    await waitFor(() => expect(api.createJob).toHaveBeenCalledWith('req-1', false))
    expect(await screen.findByText(/Draft job post created/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/publish now/i))
    fireEvent.click(screen.getByRole('button', { name: /create job post/i }))
    await waitFor(() => expect(api.createJob).toHaveBeenLastCalledWith('req-1', true))
    first.unmount()

    api.detail.mockResolvedValue(detail({ job: { id: 'job-1', title: 'Cashier', status: 'ACTIVE' } }))
    api.importApplicants.mockResolvedValue({ added: 3 })
    open()
    fireEvent.click(await screen.findByRole('button', { name: /add the job's applicants/i }))
    await waitFor(() => expect(api.importApplicants).toHaveBeenCalledWith('req-1'))
  })

  it('asks a found candidate to be put forward, and says nothing is shared until they agree', async () => {
    api.detail.mockResolvedValue(detail())
    api.ask.mockResolvedValue({ success: true })
    open()

    const person = await screen.findByRole('listitem', { name: 'Candidate (profile not open yet)' })
    fireEvent.click(within(person).getByRole('button', { name: /ask to be put forward/i }))
    await waitFor(() => expect(api.ask).toHaveBeenCalledWith('req-1', 'c-1'))
  })

  it('shows an agreed candidate with a Shortlist button, and a waiting one as waiting', async () => {
    api.detail.mockResolvedValue(detail({}, [candidate({ stage: 'CONSENT_ASKED' }), candidate({ id: 'c-2', stage: 'CONSENTED', consentAt: '2026-11-12T00:00:00Z', detailsOpen: true, name: 'Ama Mensah' })]))
    api.shortlist.mockResolvedValue({ success: true })
    open()

    expect(await screen.findByText(/Waiting for their answer/)).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('listitem', { name: 'Ama Mensah' })).getByRole('button', { name: 'Shortlist' }))
    await waitFor(() => expect(api.shortlist).toHaveBeenCalledWith('req-1', 'c-2'))
  })

  it('opens a private profile with no name, contact or CV, and records the opening on the server', async () => {
    api.detail.mockResolvedValue(detail())
    api.open.mockResolvedValue({ candidate: candidate() })
    open()

    fireEvent.click(await screen.findByRole('button', { name: 'Open' }))
    await waitFor(() => expect(api.open).toHaveBeenCalledWith('req-1', 'c-1'))
    expect(await screen.findByText(/This profile is private/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /open cv/i })).not.toBeInTheDocument()
  })

  it('saves a short note for the employer and private notes; ratings appear only when the request has must-haves', async () => {
    api.detail.mockResolvedValue(detail({}, [candidate({ stage: 'CONSENTED', consentAt: '2026-11-12T00:00:00Z', detailsOpen: true, name: 'Ama Mensah' })]))
    api.open.mockResolvedValue({ candidate: candidate({ stage: 'CONSENTED', consentAt: '2026-11-12T00:00:00Z', detailsOpen: true, name: 'Ama Mensah', skills: 'POS', email: 'ama@example.com', phone: '+233241234567', cv: { url: '/api/uploads/cv/ama.pdf', fileName: 'ama.pdf' } }) })
    api.update.mockResolvedValue({ candidate: {} })
    open()

    fireEvent.click(await screen.findByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('link', { name: /open cv/i })).toHaveAttribute('href', '/api/uploads/cv/ama.pdf')
    expect(screen.queryByText(/Rate against the must-haves/)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Short note for the employer/), { target: { value: 'Strong cashier with five years in busy shops.' } })
    fireEvent.change(screen.getByLabelText(/Private notes/), { target: { value: 'Call after 5pm' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('req-1', 'c-1', { note: 'Strong cashier with five years in busy shops.', staffNotes: 'Call after 5pm' }))
  })

  it('searches the CV database ranked by the request, and adds a person; or adds someone by email', async () => {
    api.detail.mockResolvedValue(detail())
    api.search.mockResolvedValue({ entries: [{ id: 'p-1', headline: 'Cashier with POS experience', skills: 'POS, cash', experienceSummary: '', location: 'Kumasi', yearsExperience: 4, hasVerifiedCertificate: true, relevance: 100 }] })
    api.add.mockResolvedValue({ candidate: { id: 'c-9' } })
    open()

    fireEvent.change(await screen.findByLabelText(/Skills \(every word/), { target: { value: 'cash' } })
    fireEvent.change(screen.getByLabelText('Years at least'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => expect(api.search).toHaveBeenCalledWith('req-1', { skills: 'cash', minYears: '3' }))
    const results = await screen.findByRole('list', { name: 'Search results' })
    expect(results).toHaveTextContent('100% of request')
    fireEvent.click(within(results).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(api.add).toHaveBeenCalledWith('req-1', { profileId: 'p-1' }))

    fireEvent.change(screen.getByLabelText(/Someone you already know/), { target: { value: 'ama@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /add by email/i }))
    await waitFor(() => expect(api.add).toHaveBeenLastCalledWith('req-1', { email: 'ama@example.com' }))
  })

  it('sends the shortlist to the employer', async () => {
    api.detail.mockResolvedValue(detail({}, [candidate({ id: 'c-1', stage: 'SHORTLISTED', shortlistedAt: '2026-11-13T00:00:00Z', consentAt: '2026-11-12T00:00:00Z', name: 'Ama Mensah', detailsOpen: true })]))
    api.send.mockResolvedValue({ shortlisted: 1 })
    open()

    fireEvent.click(await screen.findByRole('button', { name: /send shortlist \(1\)/i }))
    await waitFor(() => expect(api.send).toHaveBeenCalledWith('req-1'))
    expect(await screen.findByText('Shortlist sent to the employer.')).toBeInTheDocument()
  })

  it('lets staff correct the start date of a hire, and tells them the guarantee follows it', async () => {
    api.detail.mockResolvedValue(detail({ status: 'FILLED', guaranteeEndsAt: '2027-03-01T00:00:00Z', guaranteeDaysLeft: 80 }, [candidate({ stage: 'HIRED', name: 'Ama Mensah', startDate: '2026-12-01T00:00:00Z', detailsOpen: true })]))
    api.hireStart.mockResolvedValue({ success: true })
    open()

    expect(await screen.findByText(/Replacement guarantee until 1 Mar 2027 \(80 days left\)/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Correct the start date for Ama Mensah/), { target: { value: '2027-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: /save start date/i }))
    await waitFor(() => expect(api.hireStart).toHaveBeenCalledWith('req-1', 'c-1', '2027-01-01'))
  })

  it('writes notes that are staff-only or visible to the employer, and shows the history', async () => {
    api.detail.mockResolvedValue(detail())
    api.note.mockResolvedValue({ success: true })
    open()

    fireEvent.change(await screen.findByLabelText('Note'), { target: { value: 'Employer prefers weekdays' } })
    fireEvent.change(screen.getByLabelText('Who can read it'), { target: { value: 'CLIENT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    await waitFor(() => expect(api.note).toHaveBeenCalledWith('req-1', 'Employer prefers weekdays', 'CLIENT'))
    expect(screen.getByText(/system · employer can see/)).toBeInTheDocument()
  })

  it('says why when a request cannot be opened (another recruiter’s)', async () => {
    api.detail.mockRejectedValue(new Error('No such hiring request.'))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('No such hiring request.')
  })

  it('stops the work when the request is cancelled', async () => {
    api.detail.mockResolvedValue(detail({ status: 'CANCELLED' }, [candidate()]))
    open()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: /ask to be put forward/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /find candidates/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
  })
})

describe('the admin Hiring tab', () => {
  const staff = [
    { userId: 'rec-1', displayName: 'Kofi Boateng', title: 'Recruiter', phone: null, active: true, email: 'kofi@jobwahala.com', openRequests: 2 },
    { userId: 'rec-2', displayName: 'Efua Asante', title: null, phone: null, active: false, email: 'efua@jobwahala.com', openRequests: 0 },
  ]
  beforeEach(() => {
    auth.role = 'ADMIN'
    api.adminList.mockResolvedValue({ requests: [row({ status: 'NEW', assignedRecruiterId: null, recruiter: null, id: 'req-2', roleTitle: 'Driver' }), row()] })
    api.staff.mockResolvedValue({ staff })
  })

  it('counts the requests and the new ones', async () => {
    render(<MemoryRouter><AdminHiringPanel /></MemoryRouter>)
    expect(await screen.findByText(/2 requests, 1 new/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Driver' })).toHaveAttribute('href', '/recruiter/requests/req-2')
  })

  it('filters by status, recruiter and date', async () => {
    render(<MemoryRouter><AdminHiringPanel /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Sourcing' }))
    await waitFor(() => expect(api.adminList).toHaveBeenLastCalledWith({ status: 'SOURCING' }))
    fireEvent.change(screen.getByLabelText('Recruiter'), { target: { value: 'rec-1' } })
    await waitFor(() => expect(api.adminList).toHaveBeenLastCalledWith({ status: 'SOURCING', recruiterId: 'rec-1' }))
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-11-30' } })
    await waitFor(() => expect(api.adminList).toHaveBeenLastCalledWith({ status: 'SOURCING', recruiterId: 'rec-1', from: '2026-11-01', to: '2026-11-30' }))
    expect(within(screen.getByLabelText('Recruiter')).getByRole('option', { name: 'Not assigned' })).toBeInTheDocument()
  })

  it('assigns an active recruiter (deactivated ones are not offered)', async () => {
    api.assign.mockResolvedValue({ success: true })
    render(<MemoryRouter><AdminHiringPanel /></MemoryRouter>)

    const select = await screen.findByLabelText('Recruiter for Driver')
    expect(within(select).queryByRole('option', { name: /Efua/ })).not.toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'rec-1' } })
    await waitFor(() => expect(api.assign).toHaveBeenCalledWith('req-2', 'rec-1'))
  })

  it('saves the public "from" price and the default guarantee', async () => {
    api.settings.mockResolvedValue({ info: {} })
    render(<MemoryRouter><AdminHiringPanel /></MemoryRouter>)

    fireEvent.change(await screen.findByLabelText(/"From" price/), { target: { value: '1500' } })
    fireEvent.change(screen.getByLabelText(/Default replacement guarantee/), { target: { value: '60' } })
    fireEvent.click(within(screen.getByRole('region', { name: 'Hiring Service settings' })).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.settings).toHaveBeenCalledWith({ fromPriceGhs: 1500, guaranteeDays: 60 }))
  })

  const openDeal = async (payments: unknown[] = []) => {
    api.detail.mockResolvedValue({
      request: { ...row({ status: 'AGREED' }), company: 'Akoko', industry: null, salaryMin: null, salaryMax: null, startDate: null, requirements: 'x', contactName: 'M', contactPhone: '1', mustHaves: [], assignedRecruiterId: null, guaranteeDays: 90, guaranteeEndsAt: null, guaranteeDaysLeft: null, replacementCount: 0, closeReason: null, job: null,
        feePesewas: 300000, depositPesewas: 100000, fee: { agreed: true, feeLabel: 'GHS 3,000.00', depositLabel: 'GHS 1,000.00', balanceLabel: 'GHS 2,000.00', paidLabel: 'GHS 1,000.00', outstandingLabel: 'GHS 2,000.00', depositDuePesewas: 0, balanceDuePesewas: 200000, outstandingPesewas: 200000, settled: false }, payments },
      candidates: [],
      events: [],
    })
    render(<MemoryRouter><AdminHiringPanel /></MemoryRouter>)
    const item = (await screen.findByRole('link', { name: 'Cashier' })).closest('li')!
    fireEvent.click(within(item).getByRole('button', { name: /fee and payments/i }))
    await screen.findByRole('form', { name: 'Agreed terms' })
    return item
  }

  it('shows the agreed fee, the deposit and balance, and what is paid and due', async () => {
    const item = await openDeal([{ id: 'p-1', kind: 'DEPOSIT', amountPesewas: 100000, amountLabel: 'GHS 1,000.00', paidAt: '2026-11-10T00:00:00Z', method: 'mobile money', reference: 'MM1', note: null }])
    const due = within(item).getByLabelText('What is due')
    expect(due).toHaveTextContent('GHS 3,000.00')
    expect(due).toHaveTextContent('GHS 1,000.00 / GHS 2,000.00')
    expect(due).toHaveTextContent('Still dueGHS 2,000.00')
    expect(within(item).getByLabelText('Agreed fee (GHS)')).toHaveValue(3000)
    expect(within(item).getByRole('list', { name: 'Payments' })).toHaveTextContent('mobile money')
  })

  it('saves the fee, deposit and guarantee days', async () => {
    api.terms.mockResolvedValue({ success: true })
    const item = await openDeal()
    fireEvent.change(within(item).getByLabelText('Agreed fee (GHS)'), { target: { value: '3500' } })
    fireEvent.change(within(item).getByLabelText('Deposit (GHS)'), { target: { value: '1500' } })
    fireEvent.change(within(item).getByLabelText('Guarantee (days)'), { target: { value: '120' } })
    fireEvent.click(within(item).getByRole('button', { name: 'Save terms' }))
    await waitFor(() => expect(api.terms).toHaveBeenCalledWith('req-1', { feeGhs: 3500, depositGhs: 1500, guaranteeDays: 120 }))
  })

  it('records a payment by hand, and removes a mistaken one with a reason', async () => {
    api.payment.mockResolvedValue({ success: true })
    api.removePayment.mockResolvedValue({ success: true })
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Entered twice')
    const item = await openDeal([{ id: 'p-1', kind: 'DEPOSIT', amountPesewas: 100000, amountLabel: 'GHS 1,000.00', paidAt: '2026-11-10T00:00:00Z', method: null, reference: null, note: null }])

    const form = within(item).getByRole('form', { name: 'Record a payment' })
    fireEvent.change(within(form).getByLabelText('Type'), { target: { value: 'BALANCE' } })
    fireEvent.change(within(form).getByLabelText('Amount (GHS)'), { target: { value: '2000' } })
    fireEvent.change(within(form).getByLabelText('Date paid'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Method'), { target: { value: 'cash' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Record' }))
    await waitFor(() => expect(api.payment).toHaveBeenCalledWith('req-1', { kind: 'BALANCE', amountGhs: 2000, paidAt: '2026-11-20', method: 'cash' }))

    fireEvent.click(await within(item).findByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(api.removePayment).toHaveBeenCalledWith('req-1', 'p-1', 'Entered twice'))
    prompt.mockRestore()
  })

  it('creates a recruiter account, and deactivates or reactivates one', async () => {
    api.createRecruiter.mockResolvedValue({ userId: 'rec-9' })
    api.setActive.mockResolvedValue({ success: true })
    render(<MemoryRouter><AdminHiringPanel /></MemoryRouter>)

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Yaw Owusu' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'yaw@jobwahala.com' } })
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Senior recruiter' } })
    fireEvent.click(screen.getByRole('button', { name: /add recruiter/i }))
    await waitFor(() => expect(api.createRecruiter).toHaveBeenCalledWith({ email: 'yaw@jobwahala.com', displayName: 'Yaw Owusu', title: 'Senior recruiter' }))
    expect(await screen.findByText(/emailed a link to choose a password/)).toBeInTheDocument()

    const accounts = screen.getByRole('list', { name: 'Recruiter accounts' })
    fireEvent.click(within(accounts).getAllByRole('button', { name: 'Deactivate' })[0])
    await waitFor(() => expect(api.setActive).toHaveBeenCalledWith('rec-1', false))
    fireEvent.click(within(accounts).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(api.setActive).toHaveBeenCalledWith('rec-2', true))
  })
})
