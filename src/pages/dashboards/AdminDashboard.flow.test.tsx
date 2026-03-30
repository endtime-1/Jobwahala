import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminDashboard from './AdminDashboard'

const apiCreateAdminJobMock = vi.fn()
const apiDeleteAdminUserMock = vi.fn()
const apiGetAdminDisputesMock = vi.fn()
const apiGetAdminJobsMock = vi.fn()
const apiGetAdminReportsMock = vi.fn()
const apiGetAdminServicesMock = vi.fn()
const apiGetAdminUsersMock = vi.fn()
const apiGetAdminVerificationsMock = vi.fn()
const apiUpdateAdminDisputeStatusMock = vi.fn()
const apiUpdateAdminJobsStatusBulkMock = vi.fn()
const apiUpdateAdminJobStatusMock = vi.fn()
const apiUpdateAdminReportsStatusBulkMock = vi.fn()
const apiUpdateAdminReportStatusMock = vi.fn()
const apiUpdateAdminServicesStatusBulkMock = vi.fn()
const apiUpdateAdminServiceStatusMock = vi.fn()
const apiUpdateAdminUsersStatusBulkMock = vi.fn()
const apiUpdateAdminUserStatusMock = vi.fn()
const apiUpdateAdminVerificationStatusMock = vi.fn()

vi.mock('../../lib/api', () => ({
  apiCreateAdminJob: (...args: unknown[]) => apiCreateAdminJobMock(...args),
  apiDeleteAdminUser: (...args: unknown[]) => apiDeleteAdminUserMock(...args),
  apiGetAdminDisputes: (...args: unknown[]) => apiGetAdminDisputesMock(...args),
  apiGetAdminJobs: (...args: unknown[]) => apiGetAdminJobsMock(...args),
  apiGetAdminReports: (...args: unknown[]) => apiGetAdminReportsMock(...args),
  apiGetAdminServices: (...args: unknown[]) => apiGetAdminServicesMock(...args),
  apiGetAdminUsers: (...args: unknown[]) => apiGetAdminUsersMock(...args),
  apiGetAdminVerifications: (...args: unknown[]) =>
    apiGetAdminVerificationsMock(...args),
  apiUpdateAdminJobsStatusBulk: (...args: unknown[]) =>
    apiUpdateAdminJobsStatusBulkMock(...args),
  apiUpdateAdminJobStatus: (...args: unknown[]) =>
    apiUpdateAdminJobStatusMock(...args),
  apiUpdateAdminReportsStatusBulk: (...args: unknown[]) =>
    apiUpdateAdminReportsStatusBulkMock(...args),
  apiUpdateAdminDisputeStatus: (...args: unknown[]) =>
    apiUpdateAdminDisputeStatusMock(...args),
  apiUpdateAdminReportStatus: (...args: unknown[]) =>
    apiUpdateAdminReportStatusMock(...args),
  apiUpdateAdminServicesStatusBulk: (...args: unknown[]) =>
    apiUpdateAdminServicesStatusBulkMock(...args),
  apiUpdateAdminServiceStatus: (...args: unknown[]) =>
    apiUpdateAdminServiceStatusMock(...args),
  apiUpdateAdminUsersStatusBulk: (...args: unknown[]) =>
    apiUpdateAdminUsersStatusBulkMock(...args),
  apiUpdateAdminUserStatus: (...args: unknown[]) =>
    apiUpdateAdminUserStatusMock(...args),
  apiUpdateAdminVerificationStatus: (...args: unknown[]) =>
    apiUpdateAdminVerificationStatusMock(...args),
}))

function queueLoadAll(states: Array<{
  reports?: unknown[]
  users?: unknown[]
  jobs?: unknown[]
  services?: unknown[]
  verifications?: unknown[]
  disputes?: unknown[]
}>) {
  for (const state of states) {
    apiGetAdminReportsMock.mockResolvedValueOnce({ reports: state.reports || [] })
    apiGetAdminUsersMock.mockResolvedValueOnce({ users: state.users || [] })
    apiGetAdminJobsMock.mockResolvedValueOnce({ jobs: state.jobs || [] })
    apiGetAdminServicesMock.mockResolvedValueOnce({ services: state.services || [] })
    apiGetAdminVerificationsMock.mockResolvedValueOnce({ verifications: state.verifications || [] })
    apiGetAdminDisputesMock.mockResolvedValueOnce({ disputes: state.disputes || [] })
  }
}

describe('AdminDashboard moderation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves a report through the existing moderation UI', async () => {
    queueLoadAll([
      {
        reports: [
          {
            id: 'report-1',
            reason: 'Spam listing with suspicious requirements.',
            status: 'PENDING',
            createdAt: '2026-03-21T00:00:00.000Z',
            reporter: { email: 'reporter@example.com' },
            job: { id: 'job-1', title: 'Suspicious Listing', status: 'ACTIVE' },
          },
        ],
      },
      {
        reports: [
          {
            id: 'report-1',
            reason: 'Spam listing with suspicious requirements.',
            status: 'RESOLVED',
            createdAt: '2026-03-21T00:00:00.000Z',
            reporter: { email: 'reporter@example.com' },
            job: { id: 'job-1', title: 'Suspicious Listing', status: 'ACTIVE' },
          },
        ],
      },
    ])

    apiUpdateAdminReportStatusMock.mockResolvedValue({
      report: { id: 'report-1', status: 'RESOLVED' },
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Suspicious Listing')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'RESOLVED' }))

    expect(await screen.findByRole('button', { name: 'RESOLVED' })).toBeDisabled()
    expect(apiUpdateAdminReportStatusMock).toHaveBeenCalledWith(
      'report-1',
      'RESOLVED',
    )
  })

  it('applies a bulk report moderation action from the reports tab', async () => {
    queueLoadAll([
      {
        reports: [
          {
            id: 'report-10',
            reason: 'Duplicate listing.',
            status: 'PENDING',
            createdAt: '2026-03-21T00:00:00.000Z',
            reporter: { email: 'reporter@example.com' },
            job: { id: 'job-10', title: 'Operations Lead', status: 'ACTIVE' },
          },
          {
            id: 'report-11',
            reason: 'Misleading service offer.',
            status: 'PENDING',
            createdAt: '2026-03-21T00:00:00.000Z',
            reporter: { email: 'reporter-two@example.com' },
            service: { id: 'service-10', title: 'Web Design Sprint', status: 'ACTIVE' },
          },
        ],
      },
      {
        reports: [
          {
            id: 'report-10',
            reason: 'Duplicate listing.',
            status: 'RESOLVED',
            createdAt: '2026-03-21T00:00:00.000Z',
            reporter: { email: 'reporter@example.com' },
            job: { id: 'job-10', title: 'Operations Lead', status: 'ACTIVE' },
          },
          {
            id: 'report-11',
            reason: 'Misleading service offer.',
            status: 'RESOLVED',
            createdAt: '2026-03-21T00:00:00.000Z',
            reporter: { email: 'reporter-two@example.com' },
            service: { id: 'service-10', title: 'Web Design Sprint', status: 'ACTIVE' },
          },
        ],
      },
    ])

    apiUpdateAdminReportsStatusBulkMock.mockResolvedValue({
      updatedCount: 2,
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Operations Lead')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Select Visible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set RESOLVED' }))

    expect(apiUpdateAdminReportsStatusBulkMock).toHaveBeenCalledWith(
      ['report-10', 'report-11'],
      'RESOLVED',
    )
    expect(await screen.findAllByRole('button', { name: 'RESOLVED' })).toHaveLength(2)
  })

  it('updates a user status from the users tab', async () => {
    queueLoadAll([
      {
        users: [
          {
            id: 'user-1',
            email: 'candidate@example.com',
            role: 'SEEKER',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
        ],
      },
      {
        users: [
          {
            id: 'user-1',
            email: 'candidate@example.com',
            role: 'SEEKER',
            status: 'FLAGGED',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
        ],
      },
    ])

    apiUpdateAdminUserStatusMock.mockResolvedValue({
      user: { id: 'user-1', status: 'FLAGGED' },
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Users' }))
    expect(await screen.findByText('candidate@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'FLAGGED' }))

    expect(await screen.findByRole('button', { name: 'FLAGGED' })).toBeDisabled()
    expect(apiUpdateAdminUserStatusMock).toHaveBeenCalledWith(
      'user-1',
      'FLAGGED',
    )
  })

  it('applies a bulk user moderation action from the users tab', async () => {
    queueLoadAll([
      {
        users: [
          {
            id: 'user-10',
            email: 'seeker-one@example.com',
            role: 'SEEKER',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
          {
            id: 'user-11',
            email: 'seeker-two@example.com',
            role: 'SEEKER',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
        ],
      },
      {
        users: [
          {
            id: 'user-10',
            email: 'seeker-one@example.com',
            role: 'SEEKER',
            status: 'SUSPENDED',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
          {
            id: 'user-11',
            email: 'seeker-two@example.com',
            role: 'SEEKER',
            status: 'SUSPENDED',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
        ],
      },
    ])

    apiUpdateAdminUsersStatusBulkMock.mockResolvedValue({
      updatedCount: 2,
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Users' }))
    expect(await screen.findByText('seeker-one@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Select Visible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set SUSPENDED' }))

    expect(apiUpdateAdminUsersStatusBulkMock).toHaveBeenCalledWith(
      ['user-10', 'user-11'],
      'SUSPENDED',
    )
    expect(await screen.findAllByRole('button', { name: 'SUSPENDED' })).toHaveLength(2)
  })

  it('updates a job status from the jobs tab', async () => {
    queueLoadAll([
      {
        jobs: [
          {
            id: 'job-2',
            title: 'Backend Engineer',
            status: 'ACTIVE',
            salary: '$5,000/month',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 3 },
            employer: {
              email: 'employer@example.com',
              employerProfile: { companyName: 'JobWahala Labs' },
            },
          },
        ],
      },
      {
        jobs: [
          {
            id: 'job-2',
            title: 'Backend Engineer',
            status: 'SUSPENDED',
            salary: '$5,000/month',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 3 },
            employer: {
              email: 'employer@example.com',
              employerProfile: { companyName: 'JobWahala Labs' },
            },
          },
        ],
      },
    ])

    apiUpdateAdminJobStatusMock.mockResolvedValue({
      job: { id: 'job-2', status: 'SUSPENDED' },
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Jobs' }))
    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'SUSPENDED' }))

    expect(await screen.findByRole('button', { name: 'SUSPENDED' })).toBeDisabled()
    expect(apiUpdateAdminJobStatusMock).toHaveBeenCalledWith(
      'job-2',
      'SUSPENDED',
    )
  })

  it('posts a job on behalf of an employer company from the jobs tab', async () => {
    queueLoadAll([
      {
        users: [
          {
            id: 'employer-1',
            email: 'company@example.com',
            role: 'EMPLOYER',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            employerProfile: { companyName: 'Acme Logistics' },
          },
        ],
        jobs: [],
      },
      {
        users: [
          {
            id: 'employer-1',
            email: 'company@example.com',
            role: 'EMPLOYER',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            employerProfile: { companyName: 'Acme Logistics' },
          },
        ],
        jobs: [
          {
            id: 'job-3',
            title: 'Operations Lead',
            status: 'ACTIVE',
            salary: 'GHS 8,000 / month',
            postedByAdminAt: '2026-03-21T00:00:00.000Z',
            createdAt: '2026-03-21T00:00:00.000Z',
            postedByAdmin: {
              id: 'admin-1',
              email: 'admin@example.com',
            },
            _count: { applications: 0 },
            employer: {
              email: 'company@example.com',
              employerProfile: { companyName: 'Acme Logistics' },
            },
          },
        ],
      },
    ])

    apiCreateAdminJobMock.mockResolvedValue({
      job: { id: 'job-3', title: 'Operations Lead' },
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Jobs' }))

    fireEvent.change(screen.getByLabelText('Company'), {
      target: { value: 'employer-1' },
    })
    fireEvent.change(screen.getByLabelText('Role title'), {
      target: { value: 'Operations Lead' },
    })
    fireEvent.change(screen.getByLabelText('Job type'), {
      target: { value: 'Full-time' },
    })
    fireEvent.change(screen.getByLabelText('Location / work mode'), {
      target: { value: 'Hybrid - Accra' },
    })
    fireEvent.change(screen.getByLabelText('Salary'), {
      target: { value: 'GHS 8,000 / month' },
    })
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'Operations' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Lead the company operations team across logistics and fulfillment.' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Post Job' }))

    expect(apiCreateAdminJobMock).toHaveBeenCalledWith({
      employerId: 'employer-1',
      title: 'Operations Lead',
      description: 'Lead the company operations team across logistics and fulfillment.',
      location: 'Hybrid - Accra',
      type: 'Full-time',
      salary: 'GHS 8,000 / month',
      category: 'Operations',
    })
    expect(await screen.findByText('Operations Lead')).toBeInTheDocument()
    expect(screen.getByText(/Admin posted on behalf/i)).toBeInTheDocument()
  })

  it('filters admin jobs by search text and posting origin', async () => {
    queueLoadAll([
      {
        jobs: [
          {
            id: 'job-10',
            title: 'Operations Lead',
            status: 'ACTIVE',
            salary: 'GHS 8,000 / month',
            createdAt: '2026-03-21T00:00:00.000Z',
            postedByAdminAt: '2026-03-21T00:00:00.000Z',
            postedByAdmin: {
              id: 'admin-1',
              email: 'admin@example.com',
            },
            _count: { applications: 0 },
            employer: {
              email: 'acme@example.com',
              employerProfile: { companyName: 'Acme Logistics' },
            },
          },
          {
            id: 'job-11',
            title: 'Frontend Engineer',
            status: 'ACTIVE',
            salary: 'GHS 7,000 / month',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 2 },
            employer: {
              email: 'beta@example.com',
              employerProfile: { companyName: 'Beta Freight' },
            },
          },
        ],
      },
    ])

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Jobs' }))
    expect(await screen.findByText('Operations Lead')).toBeInTheDocument()
    expect(screen.getByText('Frontend Engineer')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search jobs'), {
      target: { value: 'Acme' },
    })

    expect(screen.getByText('Operations Lead')).toBeInTheDocument()
    expect(screen.queryByText('Frontend Engineer')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search jobs'), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByLabelText('Posting origin'), {
      target: { value: 'ADMIN' },
    })

    expect(screen.getByText('Operations Lead')).toBeInTheDocument()
    expect(screen.queryByText('Frontend Engineer')).not.toBeInTheDocument()
  })

  it('applies a bulk job moderation action from the jobs tab', async () => {
    queueLoadAll([
      {
        jobs: [
          {
            id: 'job-20',
            title: 'Operations Lead',
            status: 'ACTIVE',
            salary: 'GHS 8,000 / month',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 0 },
            employer: {
              email: 'acme@example.com',
              employerProfile: { companyName: 'Acme Logistics' },
            },
          },
          {
            id: 'job-21',
            title: 'Support Specialist',
            status: 'ACTIVE',
            salary: 'GHS 4,000 / month',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 1 },
            employer: {
              email: 'acme@example.com',
              employerProfile: { companyName: 'Acme Logistics' },
            },
          },
        ],
      },
      {
        jobs: [
          {
            id: 'job-20',
            title: 'Operations Lead',
            status: 'FLAGGED',
            salary: 'GHS 8,000 / month',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 0 },
            employer: {
              email: 'acme@example.com',
              employerProfile: { companyName: 'Acme Logistics' },
            },
          },
          {
            id: 'job-21',
            title: 'Support Specialist',
            status: 'FLAGGED',
            salary: 'GHS 4,000 / month',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 1 },
            employer: {
              email: 'acme@example.com',
              employerProfile: { companyName: 'Acme Logistics' },
            },
          },
        ],
      },
    ])

    apiUpdateAdminJobsStatusBulkMock.mockResolvedValue({
      updatedCount: 2,
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Jobs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select Visible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set FLAGGED' }))

    expect(apiUpdateAdminJobsStatusBulkMock).toHaveBeenCalledWith(
      ['job-20', 'job-21'],
      'FLAGGED',
    )
    expect(await screen.findAllByRole('button', { name: 'FLAGGED' })).toHaveLength(2)
  })

  it('updates a service status from the services tab', async () => {
    queueLoadAll([
      {
        services: [
          {
            id: 'service-1',
            title: 'Portfolio Website Build',
            status: 'ACTIVE',
            price: 1500,
            category: 'Development',
            createdAt: '2026-03-21T00:00:00.000Z',
            freelancer: {
              email: 'freelancer@example.com',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Mensah' },
            },
          },
        ],
      },
      {
        services: [
          {
            id: 'service-1',
            title: 'Portfolio Website Build',
            status: 'FLAGGED',
            price: 1500,
            category: 'Development',
            createdAt: '2026-03-21T00:00:00.000Z',
            freelancer: {
              email: 'freelancer@example.com',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Mensah' },
            },
          },
        ],
      },
    ])

    apiUpdateAdminServiceStatusMock.mockResolvedValue({
      service: { id: 'service-1', status: 'FLAGGED' },
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Services' }))
    expect(await screen.findByText('Portfolio Website Build')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'FLAGGED' }))

    expect(await screen.findByRole('button', { name: 'FLAGGED' })).toBeDisabled()
    expect(apiUpdateAdminServiceStatusMock).toHaveBeenCalledWith(
      'service-1',
      'FLAGGED',
    )
  })

  it('applies a bulk service moderation action from the services tab', async () => {
    queueLoadAll([
      {
        services: [
          {
            id: 'service-10',
            title: 'Portfolio Website Build',
            status: 'ACTIVE',
            price: 1500,
            category: 'Development',
            createdAt: '2026-03-21T00:00:00.000Z',
            freelancer: {
              email: 'freelancer@example.com',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Mensah' },
            },
          },
          {
            id: 'service-11',
            title: 'Brand Identity Sprint',
            status: 'ACTIVE',
            price: 2200,
            category: 'Design',
            createdAt: '2026-03-21T00:00:00.000Z',
            freelancer: {
              email: 'designer@example.com',
              freelancerProfile: { firstName: 'Efua', lastName: 'Owusu' },
            },
          },
        ],
      },
      {
        services: [
          {
            id: 'service-10',
            title: 'Portfolio Website Build',
            status: 'FLAGGED',
            price: 1500,
            category: 'Development',
            createdAt: '2026-03-21T00:00:00.000Z',
            freelancer: {
              email: 'freelancer@example.com',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Mensah' },
            },
          },
          {
            id: 'service-11',
            title: 'Brand Identity Sprint',
            status: 'FLAGGED',
            price: 2200,
            category: 'Design',
            createdAt: '2026-03-21T00:00:00.000Z',
            freelancer: {
              email: 'designer@example.com',
              freelancerProfile: { firstName: 'Efua', lastName: 'Owusu' },
            },
          },
        ],
      },
    ])

    apiUpdateAdminServicesStatusBulkMock.mockResolvedValue({
      updatedCount: 2,
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Services' }))
    expect(await screen.findByText('Portfolio Website Build')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Select Visible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set FLAGGED' }))

    expect(apiUpdateAdminServicesStatusBulkMock).toHaveBeenCalledWith(
      ['service-10', 'service-11'],
      'FLAGGED',
    )
    expect(await screen.findAllByRole('button', { name: 'FLAGGED' })).toHaveLength(2)
  })

  it('approves a verification request from the verifications tab', async () => {
    queueLoadAll([
      {
        verifications: [
          {
            id: 'verification-1',
            type: 'BUSINESS',
            status: 'PENDING',
            details: 'Registered hiring company with a public website.',
            createdAt: '2026-03-21T00:00:00.000Z',
            user: {
              id: 'user-2',
              email: 'employer@example.com',
              role: 'EMPLOYER',
              employerProfile: { companyName: 'JobWahala Labs' },
            },
          },
        ],
      },
      {
        verifications: [
          {
            id: 'verification-1',
            type: 'BUSINESS',
            status: 'APPROVED',
            details: 'Registered hiring company with a public website.',
            createdAt: '2026-03-21T00:00:00.000Z',
            reviewedAt: '2026-03-22T00:00:00.000Z',
            user: {
              id: 'user-2',
              email: 'employer@example.com',
              role: 'EMPLOYER',
              employerProfile: { companyName: 'JobWahala Labs' },
            },
            reviewer: {
              id: 'admin-1',
              email: 'admin@example.com',
            },
          },
        ],
      },
    ])

    apiUpdateAdminVerificationStatusMock.mockResolvedValue({
      verification: { id: 'verification-1', status: 'APPROVED' },
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Verifications' }))
    expect(await screen.findByText('JobWahala Labs')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'APPROVED' }))

    expect(await screen.findByRole('button', { name: 'APPROVED' })).toBeDisabled()
    expect(apiUpdateAdminVerificationStatusMock).toHaveBeenCalledWith(
      'verification-1',
      'APPROVED',
      undefined,
      undefined,
    )
  })

  it('requests more info for a verification from the verifications tab', async () => {
    queueLoadAll([
      {
        verifications: [
          {
            id: 'verification-2',
            type: 'PROFESSIONAL',
            status: 'PENDING',
            details: 'Professional portfolio with incomplete public evidence.',
            submissionCount: 2,
            history: [
              {
                id: 'verification-1',
                type: 'PROFESSIONAL',
                status: 'REJECTED',
                details: 'Previous portfolio submission with incomplete evidence.',
                reviewNote: 'Missing client-ready case studies.',
                internalNote: 'Prior attempt failed due to anonymous sample work.',
                createdAt: '2026-03-20T00:00:00.000Z',
                reviewedAt: '2026-03-20T12:00:00.000Z',
                reviewer: {
                  id: 'admin-1',
                  email: 'admin@example.com',
                },
              },
            ],
            createdAt: '2026-03-21T00:00:00.000Z',
            user: {
              id: 'user-3',
              email: 'freelancer@example.com',
              role: 'FREELANCER',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Mensah' },
            },
          },
        ],
      },
      {
        verifications: [
          {
            id: 'verification-2',
            type: 'PROFESSIONAL',
            status: 'NEEDS_INFO',
            details: 'Professional portfolio with incomplete public evidence.',
            reviewNote: 'Please add a clearer public portfolio link.',
            createdAt: '2026-03-21T00:00:00.000Z',
            reviewedAt: '2026-03-22T00:00:00.000Z',
            user: {
              id: 'user-3',
              email: 'freelancer@example.com',
              role: 'FREELANCER',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Mensah' },
            },
            reviewer: {
              id: 'admin-1',
              email: 'admin@example.com',
            },
            submissionCount: 2,
            history: [
              {
                id: 'verification-1',
                type: 'PROFESSIONAL',
                status: 'REJECTED',
                details: 'Previous portfolio submission with incomplete evidence.',
                reviewNote: 'Missing client-ready case studies.',
                internalNote: 'Prior attempt failed due to anonymous sample work.',
                createdAt: '2026-03-20T00:00:00.000Z',
                reviewedAt: '2026-03-20T12:00:00.000Z',
                reviewer: {
                  id: 'admin-1',
                  email: 'admin@example.com',
                },
              },
            ],
          },
        ],
      },
    ])

    apiUpdateAdminVerificationStatusMock.mockResolvedValue({
      verification: { id: 'verification-2', status: 'NEEDS_INFO' },
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Verifications' }))
    expect(await screen.findByText('freelancer@example.com')).toBeInTheDocument()
    expect(screen.getByText('Previous submissions')).toBeInTheDocument()

    fireEvent.change(
      screen.getByLabelText('Requester-facing note'),
      {
        target: { value: 'Please add a clearer public portfolio link.' },
      },
    )
    fireEvent.change(
      screen.getByLabelText('Internal admin note'),
      {
        target: { value: 'Flag for manual identity cross-check after resubmission.' },
      },
    )

    fireEvent.click(screen.getByRole('button', { name: 'NEEDS_INFO' }))

    expect(await screen.findByRole('button', { name: 'NEEDS_INFO' })).toBeDisabled()
    expect(apiUpdateAdminVerificationStatusMock).toHaveBeenCalledWith(
      'verification-2',
      'NEEDS_INFO',
      'Please add a clearer public portfolio link.',
      'Flag for manual identity cross-check after resubmission.',
    )
  })

  it('resolves a dispute from the disputes tab', async () => {
    queueLoadAll([
      {
        disputes: [
          {
            id: 'dispute-1',
            type: 'PAYMENT',
            status: 'OPEN',
            title: 'Final milestone payout blocked',
            description: 'Payment was requested but not released after delivery.',
            createdAt: '2026-03-21T00:00:00.000Z',
            agreement: {
              id: 'agreement-1',
              title: 'Launch Build',
              type: 'SERVICE',
              status: 'ACTIVE',
            },
            creator: {
              id: 'freelancer-1',
              email: 'freelancer@example.com',
              role: 'FREELANCER',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Mensah' },
            },
            counterparty: {
              id: 'client-1',
              email: 'client@example.com',
              role: 'SEEKER',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
          },
        ],
      },
      {
        disputes: [
          {
            id: 'dispute-1',
            type: 'PAYMENT',
            status: 'RESOLVED',
            title: 'Final milestone payout blocked',
            description: 'Payment was requested but not released after delivery.',
            resolutionNote: 'Payout confirmed and dispute closed.',
            createdAt: '2026-03-21T00:00:00.000Z',
            resolvedAt: '2026-03-22T00:00:00.000Z',
            agreement: {
              id: 'agreement-1',
              title: 'Launch Build',
              type: 'SERVICE',
              status: 'ACTIVE',
            },
            creator: {
              id: 'freelancer-1',
              email: 'freelancer@example.com',
              role: 'FREELANCER',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Mensah' },
            },
            counterparty: {
              id: 'client-1',
              email: 'client@example.com',
              role: 'SEEKER',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
            resolver: {
              id: 'admin-1',
              email: 'admin@example.com',
            },
          },
        ],
      },
    ])

    apiUpdateAdminDisputeStatusMock.mockResolvedValue({
      dispute: { id: 'dispute-1', status: 'RESOLVED' },
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Disputes' }))
    fireEvent.click((await screen.findAllByRole('button', { name: 'RESOLVED' }))[0])

    expect(await screen.findByRole('button', { name: 'RESOLVED' })).toBeDisabled()
    expect(apiUpdateAdminDisputeStatusMock).toHaveBeenCalledWith(
      'dispute-1',
      'RESOLVED',
    )
  })
})
