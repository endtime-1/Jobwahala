import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTestQueryClient } from '../test/queryClient'
import { isFollowUpDue, type ManagedCompany, type OutreachContact } from '../lib/growth'
import AdminGrowthPanel from './AdminGrowthPanel'

const api = vi.hoisted(() => ({
  companies: vi.fn(),
  create: vi.fn(),
  claim: vi.fn(),
  revoke: vi.fn(),
  founding: vi.fn(),
  saveSettings: vi.fn(),
  setFounding: vi.fn(),
  outreach: vi.fn(),
  saveOutreach: vi.fn(),
  deleteOutreach: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  apiAdminManagedCompanies: (...a: unknown[]) => api.companies(...a),
  apiAdminCreateManagedCompany: (...a: unknown[]) => api.create(...a),
  apiAdminClaimLink: (...a: unknown[]) => api.claim(...a),
  apiAdminRevokeClaim: (...a: unknown[]) => api.revoke(...a),
  apiAdminFounding: (...a: unknown[]) => api.founding(...a),
  apiAdminSaveFoundingSettings: (...a: unknown[]) => api.saveSettings(...a),
  apiAdminSetFounding: (...a: unknown[]) => api.setFounding(...a),
  apiAdminOutreach: (...a: unknown[]) => api.outreach(...a),
  apiAdminSaveOutreach: (...a: unknown[]) => api.saveOutreach(...a),
  apiAdminDeleteOutreach: (...a: unknown[]) => api.deleteOutreach(...a),
}))

const company = (extra: Partial<ManagedCompany> = {}): ManagedCompany => ({
  id: 'co-1',
  companyName: 'Akoko Solutions',
  industry: 'Production',
  contactPhone: '+233241234567',
  email: null,
  claimStatus: 'UNCLAIMED',
  isFoundingEmployer: false,
  foundingNumber: null,
  jobs: 2,
  claim: null,
  ...extra,
})

const contact = (extra: Partial<OutreachContact> = {}): OutreachContact => ({
  id: 'o-1',
  businessName: 'Achiba Star Hotel',
  contactName: 'Mr Mensah',
  contactPhone: '0241234567',
  contactEmail: null,
  sector: 'Hospitality',
  location: 'Kumasi',
  status: 'CONTACTED',
  notes: 'Wants 3 cleaners',
  followUpAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...extra,
})

const open = (props: Partial<Parameters<typeof AdminGrowthPanel>[0]> = {}) =>
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <AdminGrowthPanel onPostJob={vi.fn()} companies={[{ id: 'co-1', name: 'Akoko Solutions' }, { id: 'co-2', name: 'Achiba Star Hotel' }]} {...props} />
    </QueryClientProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  api.companies.mockResolvedValue({ companies: [company()] })
  api.founding.mockResolvedValue({ founding: { limit: 50, featuredCredits: 3, taken: 1, companies: [{ id: 'co-9', companyName: 'Early Bird Ltd', number: 1, since: '2026-11-02T00:00:00.000Z' }] } })
  api.outreach.mockResolvedValue({ contacts: [contact()], counts: { CONTACTED: 3, INTERESTED: 1, POSTED: 2 } })
})

describe('companies and claim links', () => {
  it('creates a company for an employer who sends vacancies on WhatsApp', async () => {
    api.create.mockResolvedValue({ company: { id: 'co-2' } })
    open()

    fireEvent.change(await screen.findByLabelText('Company name'), { target: { value: 'Achiba Star Hotel' } })
    fireEvent.change(screen.getByLabelText('WhatsApp number'), { target: { value: '0241234567' } })
    fireEvent.click(screen.getByRole('button', { name: /create company/i }))

    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ companyName: 'Achiba Star Hotel', industry: '', contactPhone: '0241234567', website: '' }))
    expect(await screen.findByText(/Company created/)).toBeInTheDocument()
  })

  it('sends a claim link by email, and shows the new link once with a copy button', async () => {
    api.claim.mockResolvedValue({ link: { url: 'https://www.jobwahala.com/claim/abc', whatsappUrl: null, emailed: true, expiresAt: '2026-11-25T00:00:00.000Z' } })
    open()

    fireEvent.change(await screen.findByLabelText('Email for Akoko Solutions'), { target: { value: 'owner@akoko.com' } })
    fireEvent.click(screen.getByRole('button', { name: /email claim link/i }))

    await waitFor(() => expect(api.claim).toHaveBeenCalledWith('co-1', { channel: 'EMAIL', email: 'owner@akoko.com' }))
    expect(await screen.findByText(/Email sent to owner@akoko.com/)).toBeInTheDocument()
    const box = screen.getByLabelText('New claim link')
    expect(within(box).getByText('https://www.jobwahala.com/claim/abc')).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: /copy link/i })).toBeInTheDocument()
  })

  it('makes a WhatsApp claim link that opens WhatsApp with the message ready', async () => {
    api.claim.mockResolvedValue({ link: { url: 'https://www.jobwahala.com/claim/abc', whatsappUrl: 'https://wa.me/233241234567?text=Hello', emailed: false, expiresAt: '2026-11-25T00:00:00.000Z' } })
    open()

    fireEvent.click(await screen.findByRole('button', { name: /whatsapp claim link/i }))

    await waitFor(() => expect(api.claim).toHaveBeenCalledWith('co-1', { channel: 'WHATSAPP', phone: '+233241234567' }))
    expect(await screen.findByRole('link', { name: /open whatsapp with the message/i })).toHaveAttribute('href', 'https://wa.me/233241234567?text=Hello')
  })

  it('offers resend and revoke once a link is out, and revoking asks the server', async () => {
    api.companies.mockResolvedValue({ companies: [company({ claim: { id: 'claim-1', state: 'ACTIVE', channel: 'EMAIL', sentTo: 'owner@akoko.com', sendCount: 2, lastSentAt: '2026-11-08T00:00:00.000Z', expiresAt: '2026-11-22T00:00:00.000Z' } })] })
    api.revoke.mockResolvedValue({ success: true })
    open()

    expect(await screen.findByText(/Link sent, waiting · sent 2 times by email to owner@akoko.com/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend by email/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /revoke link/i }))

    await waitFor(() => expect(api.revoke).toHaveBeenCalledWith('claim-1'))
    expect(await screen.findByText(/Link cancelled/)).toBeInTheDocument()
  })

  it('shows a company its owner has taken over without any claim buttons, and posts a job for a company', async () => {
    api.companies.mockResolvedValue({ companies: [company({ claimStatus: 'CLAIMED', email: 'owner@akoko.com', claim: { id: 'c', state: 'CLAIMED', channel: 'EMAIL', sentTo: null, sendCount: 1, lastSentAt: '2026-11-08T00:00:00.000Z', expiresAt: '2026-11-22T00:00:00.000Z' } })] })
    const onPostJob = vi.fn()
    open({ onPostJob })

    expect(await screen.findByText('Taken over by its owner')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /claim link/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Post a job' }))
    expect(onPostJob).toHaveBeenCalledWith('co-1')
  })
})

describe('Founding Employers', () => {
  const openFounding = async () => {
    open()
    fireEvent.click(screen.getByRole('tab', { name: 'Founding Employers' }))
    await screen.findByText('1 of 50 places taken')
  }

  it('shows how many places are taken and lists the founders', async () => {
    await openFounding()
    expect(screen.getByRole('list', { name: 'Founding Employers' })).toHaveTextContent('#1 Early Bird Ltd')
  })

  it('saves the number of places and the free credits', async () => {
    api.saveSettings.mockResolvedValue({})
    await openFounding()

    fireEvent.change(screen.getByLabelText('Number of places'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Free featured credits each'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))

    await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith({ limit: 30, featuredCredits: 5 }))
  })

  it('marks a company as a Founding Employer and says what it received', async () => {
    api.setFounding.mockResolvedValue({ foundingNumber: 2, creditsGiven: 3 })
    await openFounding()

    fireEvent.change(screen.getByLabelText('Make a company a Founding Employer'), { target: { value: 'co-2' } })
    fireEvent.click(screen.getByRole('button', { name: /make founding employer/i }))

    await waitFor(() => expect(api.setFounding).toHaveBeenCalledWith('co-2', true))
    expect(await screen.findByText('Founding Employer #2. 3 free featured credits given.')).toBeInTheDocument()
  })

  it('shows the server message when every place is taken', async () => {
    api.setFounding.mockRejectedValue(new Error('All 50 Founding Employer places are taken.'))
    await openFounding()

    fireEvent.change(screen.getByLabelText('Make a company a Founding Employer'), { target: { value: 'co-2' } })
    fireEvent.click(screen.getByRole('button', { name: /make founding employer/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('All 50 Founding Employer places are taken.')
  })

  it('removes a badge', async () => {
    api.setFounding.mockResolvedValue({})
    await openFounding()

    fireEvent.click(screen.getByRole('button', { name: /remove badge/i }))

    await waitFor(() => expect(api.setFounding).toHaveBeenCalledWith('co-9', false))
  })
})

describe('the outreach tracker', () => {
  const openOutreach = async () => {
    open()
    fireEvent.click(screen.getByRole('tab', { name: 'Outreach tracker' }))
    await screen.findByText('Achiba Star Hotel')
  }

  it('lists the employers contacted, with a count for each status', async () => {
    await openOutreach()
    expect(screen.getByText('Employers we have contacted: 6 in all.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contacted (3)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Interested (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not interested (0)' })).toBeInTheDocument()
    expect(screen.getByText(/Mr Mensah · 0241234567 · Hospitality · Kumasi/)).toBeInTheDocument()
    expect(screen.getByText('Wants 3 cleaners')).toBeInTheDocument()
  })

  it('filters by status', async () => {
    await openOutreach()
    fireEvent.click(screen.getByRole('button', { name: 'Interested (1)' }))
    await waitFor(() => expect(api.outreach).toHaveBeenLastCalledWith({ status: 'INTERESTED', q: '' }))
  })

  it('adds an employer with every field, including the follow-up date', async () => {
    api.saveOutreach.mockResolvedValue({ contact: {} })
    await openOutreach()

    fireEvent.click(screen.getByRole('button', { name: /add employer/i }))
    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Akoko Solutions' } })
    fireEvent.change(screen.getByLabelText('Contact person'), { target: { value: 'Ama' } })
    fireEvent.change(screen.getByLabelText('Phone / WhatsApp'), { target: { value: '0551234567' } })
    fireEvent.change(screen.getByLabelText('Sector'), { target: { value: 'Production' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Kumasi' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'INTERESTED' } })
    fireEvent.change(screen.getByLabelText('Follow up on'), { target: { value: '2026-11-20' } })
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Call on Monday' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.saveOutreach).toHaveBeenCalledTimes(1))
    const [body, id] = api.saveOutreach.mock.calls[0]
    expect(id).toBeUndefined()
    expect(body).toMatchObject({ businessName: 'Akoko Solutions', contactName: 'Ama', contactPhone: '0551234567', sector: 'Production', location: 'Kumasi', status: 'INTERESTED', notes: 'Call on Monday', followUpAt: '2026-11-20' })
  })

  it('changes a status straight from the list', async () => {
    api.saveOutreach.mockResolvedValue({ contact: {} })
    await openOutreach()

    fireEvent.change(screen.getByLabelText('Status for Achiba Star Hotel'), { target: { value: 'POSTED' } })

    await waitFor(() => expect(api.saveOutreach).toHaveBeenCalledWith({ status: 'POSTED' }, 'o-1'))
  })

  it('highlights a follow-up that is due', async () => {
    api.outreach.mockResolvedValue({ contacts: [contact({ followUpAt: '2020-01-01T00:00:00.000Z' })], counts: { CONTACTED: 1 } })
    await openOutreach()
    expect(screen.getByText(/\(due\)/)).toBeInTheDocument()
  })

  it('deletes a contact only after asking', async () => {
    api.deleteOutreach.mockResolvedValue({ success: true })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await openOutreach()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Achiba Star Hotel' }))
    expect(api.deleteOutreach).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Achiba Star Hotel' }))
    await waitFor(() => expect(api.deleteOutreach).toHaveBeenCalledWith('o-1'))
    confirm.mockRestore()
  })
})

describe('follow-up dates', () => {
  const now = new Date('2026-11-10T12:00:00.000Z')
  it('is due today or earlier, and only while the employer is still being worked on', () => {
    expect(isFollowUpDue({ followUpAt: '2026-11-10T00:00:00.000Z', status: 'CONTACTED' }, now)).toBe(true)
    expect(isFollowUpDue({ followUpAt: '2026-11-01T00:00:00.000Z', status: 'INTERESTED' }, now)).toBe(true)
    expect(isFollowUpDue({ followUpAt: '2026-11-11T00:00:00.000Z', status: 'CONTACTED' }, now)).toBe(false)
    expect(isFollowUpDue({ followUpAt: '2026-11-01T00:00:00.000Z', status: 'POSTED' }, now)).toBe(false)
    expect(isFollowUpDue({ followUpAt: '2026-11-01T00:00:00.000Z', status: 'NOT_INTERESTED' }, now)).toBe(false)
    expect(isFollowUpDue({ followUpAt: null, status: 'CONTACTED' }, now)).toBe(false)
  })
})
