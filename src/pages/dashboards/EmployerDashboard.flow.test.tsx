import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerDashboard from './EmployerDashboard'

const apiCompareAgreementsMock = vi.fn()
const apiCompareProposalsMock = vi.fn()
const apiCreateJobMock = vi.fn()
const apiCreateJobProposalMock = vi.fn()
const apiCreateVerificationRequestMock = vi.fn()
const apiDeleteServiceRequestMock = vi.fn()
const apiGenerateAgreementDecisionBriefMock = vi.fn()
const apiGenerateApplicantDecisionBriefMock = vi.fn()
const apiGenerateJobApplicantComparisonMock = vi.fn()
const apiGenerateJobDraftMock = vi.fn()
const apiGenerateJobProposalDraftMock = vi.fn()
const apiGenerateJobShortlistSummaryMock = vi.fn()
const apiGetDashboardMock = vi.fn()
const apiGetDashboardOverviewMock = vi.fn()
const apiGetDashboardWorkflowSummaryMock = vi.fn()
const apiGetJobApplicantsMock = vi.fn()
const apiGetMessageSummaryMock = vi.fn()
const apiGetSentServiceRequestsMock = vi.fn()
const apiUpdateApplicationStatusMock = vi.fn()
const apiUpdateJobStatusMock = vi.fn()
const subscribeToRealtimeEventsMock = vi.fn()
let realtimeHandlers: Record<string, ((payload?: unknown) => void) | undefined> = {}

vi.mock('../../components/VerifiedBadge', () => ({
  default: () => <div>Verified Badge</div>,
}))

vi.mock('../../lib/api', () => ({
  apiCompareAgreements: (...args: unknown[]) => apiCompareAgreementsMock(...args),
  apiCompareProposals: (...args: unknown[]) => apiCompareProposalsMock(...args),
  apiCreateJob: (...args: unknown[]) => apiCreateJobMock(...args),
  apiCreateJobProposal: (...args: unknown[]) => apiCreateJobProposalMock(...args),
  apiCreateVerificationRequest: (...args: unknown[]) =>
    apiCreateVerificationRequestMock(...args),
  apiDeleteServiceRequest: (...args: unknown[]) =>
    apiDeleteServiceRequestMock(...args),
  apiGenerateAgreementDecisionBrief: (...args: unknown[]) =>
    apiGenerateAgreementDecisionBriefMock(...args),
  apiGenerateApplicantDecisionBrief: (...args: unknown[]) =>
    apiGenerateApplicantDecisionBriefMock(...args),
  apiGenerateJobApplicantComparison: (...args: unknown[]) =>
    apiGenerateJobApplicantComparisonMock(...args),
  apiGenerateJobDraft: (...args: unknown[]) =>
    apiGenerateJobDraftMock(...args),
  apiGenerateJobProposalDraft: (...args: unknown[]) =>
    apiGenerateJobProposalDraftMock(...args),
  apiGenerateJobShortlistSummary: (...args: unknown[]) =>
    apiGenerateJobShortlistSummaryMock(...args),
  apiGetDashboard: (...args: unknown[]) => apiGetDashboardMock(...args),
  apiGetDashboardOverview: (...args: unknown[]) => apiGetDashboardOverviewMock(...args),
  apiGetDashboardWorkflowSummary: (...args: unknown[]) =>
    apiGetDashboardWorkflowSummaryMock(...args),
  apiGetJobApplicants: (...args: unknown[]) => apiGetJobApplicantsMock(...args),
  apiGetMessageSummary: (...args: unknown[]) => apiGetMessageSummaryMock(...args),
  apiGetSentServiceRequests: (...args: unknown[]) =>
    apiGetSentServiceRequestsMock(...args),
  apiUpdateApplicationStatus: (...args: unknown[]) =>
    apiUpdateApplicationStatusMock(...args),
  apiUpdateJobStatus: (...args: unknown[]) => apiUpdateJobStatusMock(...args),
}))

vi.mock('../../lib/realtime', () => ({
  subscribeToRealtimeEvents: (...args: unknown[]) => subscribeToRealtimeEventsMock(...args),
}))

describe('EmployerDashboard job posting flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realtimeHandlers = {}
    subscribeToRealtimeEventsMock.mockImplementation((handlers: typeof realtimeHandlers) => {
      realtimeHandlers = handlers
      return () => undefined
    })
    apiGetSentServiceRequestsMock.mockResolvedValue({ requests: [] })
    apiGetDashboardOverviewMock.mockResolvedValue({
      jobs: [],
      recentApplications: [],
    })
    apiGetDashboardWorkflowSummaryMock.mockResolvedValue({
      activeAgreementCount: 0,
      upcomingMilestones: [],
      pendingProposalActions: 0,
      proposalActionItems: [],
      pendingReviewActions: 0,
      reviewActionItems: [],
      pendingDisputeActions: 0,
      disputeActionItems: [],
      pendingPaymentActions: 0,
      paymentActionItems: [],
    })
  })

  it('creates a job through the existing employer form and reloads dashboard data', async () => {
    apiGetDashboardMock
      .mockResolvedValueOnce({
        jobs: [],
        recentApplications: [],
        unreadMessages: 0,
      })
      .mockResolvedValueOnce({
        jobs: [
          {
            id: 'job-1',
            title: 'Product Designer',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 0 },
          },
        ],
        recentApplications: [],
        unreadMessages: 0,
      })
    apiGetJobApplicantsMock.mockResolvedValue({ applications: [] })
    apiCreateJobMock.mockResolvedValue({
      job: { id: 'job-1' },
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('No jobs posted yet.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /post new role/i }))

    fireEvent.change(screen.getByPlaceholderText('Job title'), {
      target: { value: 'Product Designer' },
    })
    fireEvent.change(screen.getByPlaceholderText('Location'), {
      target: { value: 'Remote' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Contract' },
    })
    fireEvent.change(screen.getByPlaceholderText('Salary'), {
      target: { value: '$3,000/month' },
    })
    fireEvent.change(screen.getByPlaceholderText('Category'), {
      target: { value: 'Design' },
    })
    fireEvent.change(
      screen.getByPlaceholderText(
        'Describe the role, responsibilities, and expectations...',
      ),
      {
        target: { value: 'Lead product design across core marketplace flows.' },
      },
    )

    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    await waitFor(() => {
      expect(apiCreateJobMock).toHaveBeenCalledWith({
        title: 'Product Designer',
        description: 'Lead product design across core marketplace flows.',
        location: 'Remote',
        type: 'Contract',
        salary: '$3,000/month',
        category: 'Design',
      })
    })
    await waitFor(() => {
      expect(apiGetJobApplicantsMock).toHaveBeenCalledWith('job-1')
    })
    await waitFor(() => {
      expect(screen.getAllByText('Product Designer').length).toBeGreaterThan(0)
    })
  }, 25000)

  it('generates an AI job draft from the employer job form', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [],
      recentApplications: [],
      unreadMessages: 0,
    })
    apiGetJobApplicantsMock.mockResolvedValue({ applications: [] })

    apiGenerateJobDraftMock.mockResolvedValue({
      draft: {
        title: 'Senior Product Designer',
        description: 'Own end-to-end product design across the marketplace, tighten core conversion flows, and partner closely with product and engineering on measurable release outcomes.',
        location: 'Remote, Ghana',
        type: 'Contract',
        salary: '$4,000/month',
        category: 'Design',
        positioning: 'Frame this as a high-ownership design role with direct influence on marketplace growth and user trust.',
        hiringNote: 'Keep the salary and scope specific so senior applicants can self-qualify quickly.',
      },
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('No jobs posted yet.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /post new role/i }))

    fireEvent.change(screen.getByPlaceholderText('Job title'), {
      target: { value: 'Product Designer' },
    })
    fireEvent.change(screen.getByPlaceholderText('Location'), {
      target: { value: 'Remote' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Contract' },
    })
    fireEvent.change(screen.getByPlaceholderText('Salary'), {
      target: { value: '$3,000/month' },
    })
    fireEvent.change(screen.getByPlaceholderText('Category'), {
      target: { value: 'Design' },
    })
    fireEvent.change(
      screen.getByPlaceholderText(
        'Describe the role, responsibilities, and expectations...',
      ),
      {
        target: { value: 'Lead product design across core marketplace flows.' },
      },
    )

    fireEvent.click(screen.getByRole('button', { name: /generate ai job draft/i }))

    expect(apiGenerateJobDraftMock).toHaveBeenCalledWith({
      title: 'Product Designer',
      description: 'Lead product design across core marketplace flows.',
      location: 'Remote',
      type: 'Contract',
      salary: '$3,000/month',
      category: 'Design',
      focus: 'Lead product design across core marketplace flows.',
    })

    expect(await screen.findByDisplayValue('Senior Product Designer')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Own end-to-end product design across the marketplace, tighten core conversion flows, and partner closely with product and engineering on measurable release outcomes.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Remote, Ghana')).toBeInTheDocument()
    expect(screen.getByDisplayValue('$4,000/month')).toBeInTheDocument()
    expect(screen.getByText('Frame this as a high-ownership design role with direct influence on marketplace growth and user trust.')).toBeInTheDocument()
    expect(screen.getByText('Keep the salary and scope specific so senior applicants can self-qualify quickly.')).toBeInTheDocument()
  }, 15000)

  it('sends a job proposal from the existing applicant review card', async () => {
    apiGetDashboardMock
      .mockResolvedValueOnce({
        jobs: [
          {
            id: 'job-proposal-1',
            title: 'Frontend Engineer',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 1 },
          },
        ],
        recentApplications: [],
        unreadMessages: 0,
        pendingProposalActions: 0,
        proposalActionItems: [],
      })
      .mockResolvedValueOnce({
        jobs: [
          {
            id: 'job-proposal-1',
            title: 'Frontend Engineer',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 1 },
          },
        ],
        recentApplications: [],
        unreadMessages: 0,
        pendingProposalActions: 0,
        proposalActionItems: [],
      })

    apiGetJobApplicantsMock
      .mockResolvedValueOnce({
        applications: [
          {
            id: 'application-proposal-1',
            status: 'SUBMITTED',
            createdAt: '2026-03-21T00:00:00.000Z',
            coverLetter: 'I can own the frontend roadmap and execution.',
            agreement: null,
            proposals: [],
            seeker: {
              id: 'seeker-proposal-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
                skills: 'React, TypeScript',
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        applications: [
          {
            id: 'application-proposal-1',
            status: 'SUBMITTED',
            createdAt: '2026-03-21T00:00:00.000Z',
            coverLetter: 'I can own the frontend roadmap and execution.',
            agreement: null,
            proposals: [
              {
                id: 'proposal-1',
                status: 'PENDING',
                title: 'Frontend Engineer proposal',
                updatedAt: '2026-03-22T00:00:00.000Z',
                creatorId: 'employer-1',
                recipientId: 'seeker-proposal-1',
              },
            ],
            seeker: {
              id: 'seeker-proposal-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
                skills: 'React, TypeScript',
              },
            },
          },
        ],
      })

    apiCreateJobProposalMock.mockResolvedValue({
      proposal: { id: 'proposal-1', status: 'PENDING' },
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('I can own the frontend roadmap and execution.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /send proposal/i }))

    fireEvent.change(screen.getByPlaceholderText('Project proposal title'), {
      target: { value: 'Frontend Engineer proposal' },
    })
    fireEvent.change(
      screen.getByPlaceholderText('Outline the scope, deliverables, and expectations.'),
      {
        target: { value: 'Join the team to own UI delivery, release quality, and cross-functional implementation.' },
      },
    )

    fireEvent.click(screen.getAllByRole('button', { name: /^send proposal$/i }).at(-1)!)

    expect(await screen.findByText('Active Proposal')).toBeInTheDocument()
    expect(apiCreateJobProposalMock).toHaveBeenCalledWith('application-proposal-1', {
      title: 'Frontend Engineer proposal',
      summary: 'Join the team to own UI delivery, release quality, and cross-functional implementation.',
      amount: undefined,
      timeline: undefined,
      expiresAt: undefined,
      message: undefined,
    })
  })

  it('generates a proposal draft from the employer composer', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-ai-1',
          title: 'Frontend Engineer',
          status: 'ACTIVE',
          createdAt: '2026-03-21T00:00:00.000Z',
          _count: { applications: 1 },
        },
      ],
      recentApplications: [],
      unreadMessages: 0,
    })

    apiGetJobApplicantsMock.mockResolvedValue({
      applications: [
        {
          id: 'application-ai-1',
          status: 'SUBMITTED',
          createdAt: '2026-03-21T00:00:00.000Z',
          coverLetter: 'I can own the frontend roadmap and execution.',
          agreement: null,
          proposals: [],
          seeker: {
            id: 'seeker-ai-1',
            email: 'ada@example.com',
            jobSeekerProfile: {
              firstName: 'Ada',
              lastName: 'Mensah',
              skills: 'React, TypeScript',
            },
          },
        },
      ],
    })

    apiGenerateJobProposalDraftMock.mockResolvedValue({
      draft: {
        title: 'Frontend Engineer proposal',
        summary: 'Take ownership of the React product roadmap, release quality, and cross-team UI delivery.',
        amount: 'GHS 18,000',
        timeline: '30 days',
        message: 'Happy to refine the scope once we align on immediate priorities.',
      },
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('I can own the frontend roadmap and execution.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /send proposal/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate ai draft/i }))

    expect(apiGenerateJobProposalDraftMock).toHaveBeenCalledWith('application-ai-1', {
      title: 'Frontend Engineer proposal',
      amount: undefined,
      timeline: undefined,
      focus: undefined,
    })
    expect(await screen.findByDisplayValue('Frontend Engineer proposal')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Take ownership of the React product roadmap, release quality, and cross-team UI delivery.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('GHS 18,000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('30 days')).toBeInTheDocument()
  })

  it('loads applicants for a job and persists status updates through the existing review UI', async () => {
    apiGetDashboardMock
      .mockResolvedValueOnce({
        jobs: [
          {
            id: 'job-2',
            title: 'Frontend Engineer',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 1 },
          },
        ],
        recentApplications: [
          {
            id: 'application-1',
            status: 'SUBMITTED',
            createdAt: '2026-03-21T00:00:00.000Z',
            job: {
              id: 'job-2',
              title: 'Frontend Engineer',
            },
            seeker: {
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
                skills: 'React, TypeScript',
              },
            },
          },
        ],
        unreadMessages: 2,
      })
      .mockResolvedValueOnce({
        jobs: [
          {
            id: 'job-2',
            title: 'Frontend Engineer',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 1 },
          },
        ],
        recentApplications: [
          {
            id: 'application-1',
            status: 'SHORTLISTED',
            createdAt: '2026-03-21T00:00:00.000Z',
            job: {
              id: 'job-2',
              title: 'Frontend Engineer',
            },
            seeker: {
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
                skills: 'React, TypeScript',
              },
            },
          },
        ],
        unreadMessages: 2,
      })

    apiGetJobApplicantsMock
      .mockResolvedValueOnce({
        applications: [
          {
            id: 'application-1',
            status: 'SUBMITTED',
            createdAt: '2026-03-21T00:00:00.000Z',
            coverLetter: 'I have shipped hiring and onboarding flows before.',
            agreement: null,
            seeker: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
                skills: 'React, TypeScript',
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        applications: [
          {
            id: 'application-1',
            status: 'SHORTLISTED',
            createdAt: '2026-03-21T00:00:00.000Z',
            coverLetter: 'I have shipped hiring and onboarding flows before.',
            agreement: null,
            seeker: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
                skills: 'React, TypeScript',
              },
            },
          },
        ],
      })

    apiUpdateApplicationStatusMock.mockResolvedValue({
      application: { id: 'application-1', status: 'SHORTLISTED' },
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('0 shortlisted')).toBeInTheDocument()

    fireEvent.click((await screen.findAllByRole('button', { name: 'SHORTLISTED' }))[0])

    expect(await screen.findByText('1 shortlisted')).toBeInTheDocument()
    expect(apiUpdateApplicationStatusMock).toHaveBeenCalledWith(
      'application-1',
      'SHORTLISTED',
    )
    expect(screen.getAllByText('SHORTLISTED').length).toBeGreaterThan(0)
  })

  it('shows applicant fit scores and reasons in employer review surfaces', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-fit-1',
          title: 'Frontend Engineer',
          status: 'ACTIVE',
          createdAt: '2026-03-21T00:00:00.000Z',
          _count: { applications: 1 },
        },
      ],
      recentApplications: [
        {
          id: 'application-fit-1',
          status: 'SUBMITTED',
          createdAt: '2026-03-21T00:00:00.000Z',
          fitScore: 88,
          fitReasons: ['Skills matched: React, TypeScript', 'Role alignment: frontend, engineer'],
          job: {
            id: 'job-fit-1',
            title: 'Frontend Engineer',
          },
          seeker: {
            email: 'ada@example.com',
            jobSeekerProfile: {
              firstName: 'Ada',
              lastName: 'Mensah',
              skills: 'React, TypeScript',
            },
          },
        },
      ],
      unreadMessages: 0,
    })

    apiGetJobApplicantsMock.mockResolvedValue({
      applications: [
        {
          id: 'application-fit-1',
          status: 'SUBMITTED',
          createdAt: '2026-03-21T00:00:00.000Z',
          coverLetter: 'I can own the frontend roadmap and UI quality.',
          fitScore: 88,
          fitReasons: ['Skills matched: React, TypeScript', 'Role alignment: frontend, engineer'],
          agreement: null,
          seeker: {
            id: 'seeker-fit-1',
            email: 'ada@example.com',
            jobSeekerProfile: {
              firstName: 'Ada',
              lastName: 'Mensah',
              skills: 'React, TypeScript',
            },
          },
        },
      ],
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findAllByText('88% fit')).toHaveLength(2)
    expect(screen.getAllByText('Skills matched: React, TypeScript').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Role alignment: frontend, engineer').length).toBeGreaterThan(0)
  })

  it('generates a shortlist brief for the active role from applicant review', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-shortlist-1',
          title: 'Frontend Engineer',
          status: 'ACTIVE',
          createdAt: '2026-03-21T00:00:00.000Z',
          _count: { applications: 1 },
        },
      ],
      recentApplications: [],
      unreadMessages: 0,
    })

    apiGetJobApplicantsMock.mockResolvedValue({
      applications: [
        {
          id: 'application-shortlist-1',
          status: 'SHORTLISTED',
          createdAt: '2026-03-21T00:00:00.000Z',
          coverLetter: 'I can lead the React roadmap and mentor a small frontend squad.',
          fitScore: 91,
          fitReasons: ['Skills matched: React, TypeScript', 'Leadership signal: mentor, lead'],
          agreement: null,
          proposals: [],
          seeker: {
            id: 'seeker-shortlist-1',
            email: 'ada@example.com',
            jobSeekerProfile: {
              firstName: 'Ada',
              lastName: 'Mensah',
              skills: 'React, TypeScript, Leadership',
            },
          },
        },
      ],
    })

    apiGenerateJobShortlistSummaryMock.mockResolvedValue({
      summary:
        'Ada Mensah stands out as the strongest shortlist option because her React depth and leadership signal align with the role priorities.',
      candidatesConsidered: 1,
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('I can lead the React roadmap and mentor a small frontend squad.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/focus brief on/i), {
      target: { value: 'Prioritize leadership and React delivery ownership.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /generate shortlist brief/i }))

    await waitFor(() => {
      expect(apiGenerateJobShortlistSummaryMock).toHaveBeenCalledWith('job-shortlist-1', {
        focus: 'Prioritize leadership and React delivery ownership.',
      })
    })
    expect(await screen.findByText('AI Shortlist Brief')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Ada Mensah stands out as the strongest shortlist option because her React depth and leadership signal align with the role priorities.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Built from 1 ranked candidate.')).toBeInTheDocument()
  })

  it('generates an applicant comparison brief for the active role from applicant review', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-compare-1',
          title: 'Frontend Engineer',
          status: 'ACTIVE',
          createdAt: '2026-03-21T00:00:00.000Z',
          _count: { applications: 2 },
        },
      ],
      recentApplications: [],
      unreadMessages: 0,
    })

    apiGetJobApplicantsMock.mockResolvedValue({
      applications: [
        {
          id: 'application-compare-1',
          status: 'SHORTLISTED',
          createdAt: '2026-03-21T00:00:00.000Z',
          coverLetter: 'I can lead the React roadmap and mentor a small frontend squad.',
          fitScore: 91,
          fitReasons: ['Skills matched: React, TypeScript', 'Leadership signal: mentor, lead'],
          agreement: null,
          proposals: [],
          seeker: {
            id: 'seeker-compare-1',
            email: 'ada@example.com',
            jobSeekerProfile: {
              firstName: 'Ada',
              lastName: 'Mensah',
              skills: 'React, TypeScript, Leadership',
            },
          },
        },
        {
          id: 'application-compare-2',
          status: 'SUBMITTED',
          createdAt: '2026-03-21T00:00:00.000Z',
          coverLetter: 'I build resilient React interfaces with strong QA habits.',
          fitScore: 84,
          fitReasons: ['Skills matched: React, Testing', 'Execution signal: delivery, quality'],
          agreement: null,
          proposals: [],
          seeker: {
            id: 'seeker-compare-2',
            email: 'kwame@example.com',
            jobSeekerProfile: {
              firstName: 'Kwame',
              lastName: 'Asare',
              skills: 'React, Testing, Delivery',
            },
          },
        },
      ],
    })

    apiGenerateJobApplicantComparisonMock.mockResolvedValue({
      summary:
        'Ada Mensah currently leads this comparison because her React depth and leadership signal are stronger, while Kwame Asare remains a solid alternative with steadier execution and QA emphasis.',
      candidatesConsidered: 2,
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('I can lead the React roadmap and mentor a small frontend squad.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/focus brief on/i), {
      target: { value: 'Compare leadership against execution strength.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /compare applicants/i }))

    await waitFor(() => {
      expect(apiGenerateJobApplicantComparisonMock).toHaveBeenCalledWith('job-compare-1', {
        focus: 'Compare leadership against execution strength.',
      })
    })
    expect(await screen.findByText('AI Applicant Comparison')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Ada Mensah currently leads this comparison because her React depth and leadership signal are stronger, while Kwame Asare remains a solid alternative with steadier execution and QA emphasis.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Built from the top 2 ranked candidates.')).toBeInTheDocument()
  })

  it('generates an applicant decision brief from the employer applicant card', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-decision-1',
          title: 'Frontend Engineer',
          status: 'ACTIVE',
          createdAt: '2026-03-21T00:00:00.000Z',
          _count: { applications: 1 },
        },
      ],
      recentApplications: [],
      unreadMessages: 0,
    })

    apiGetJobApplicantsMock.mockResolvedValue({
      applications: [
        {
          id: 'application-decision-1',
          status: 'INTERVIEW',
          createdAt: '2026-03-21T00:00:00.000Z',
          coverLetter: 'I can lead the React roadmap and partner closely with product on delivery quality.',
          fitScore: 93,
          fitReasons: ['Skills matched: React, TypeScript', 'Leadership signal: mentor, lead'],
          agreement: null,
          proposals: [],
          seeker: {
            id: 'seeker-decision-1',
            email: 'ada@example.com',
            jobSeekerProfile: {
              firstName: 'Ada',
              lastName: 'Mensah',
              skills: 'React, TypeScript, Leadership',
            },
          },
        },
      ],
    })

    apiGenerateApplicantDecisionBriefMock.mockResolvedValue({
      brief: {
        recommendation: 'SEND_PROPOSAL',
        headline: 'Ada Mensah is ready for offer-stage terms.',
        summary:
          'The interview-stage signal is already strong enough to move into concrete proposal terms instead of keeping the applicant in a passive review state.',
        strengths: ['Strong React signal', 'Leadership fit'],
        cautions: ['Final terms still need to be aligned in writing.'],
        nextAction:
          'Open a proposal with clear scope, start timing, and compensation so you can convert the interview momentum into real terms.',
        suggestedMessage:
          'Your application is moving well. I want to move this into concrete proposal terms so we can align on scope, timing, and compensation.',
      },
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Ada Mensah')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/focus brief on/i), {
      target: { value: 'Decide whether to move to proposal terms now.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ai decision/i }))

    await waitFor(() => {
      expect(apiGenerateApplicantDecisionBriefMock).toHaveBeenCalledWith(
        'application-decision-1',
        {
          focus: 'Decide whether to move to proposal terms now.',
        },
      )
    })

    expect(await screen.findByText('AI Applicant Decision')).toBeInTheDocument()
    expect(screen.getByText('SEND_PROPOSAL')).toBeInTheDocument()
    expect(screen.getByText('Ada Mensah is ready for offer-stage terms.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Open a proposal with clear scope, start timing, and compensation so you can convert the interview momentum into real terms.',
      ),
    ).toBeInTheDocument()
  })

  it('compares proposal terms directly from the employer dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [],
      recentApplications: [],
      unreadMessages: 0,
      pendingProposalActions: 2,
      proposalActionItems: [
        {
          id: 'proposal-compare-1',
          type: 'JOB',
          status: 'COUNTERED',
          title: 'Frontend Engineer Counter',
          amount: '$5,000',
          timeline: 'Immediate start',
          counterpartyName: 'Ada Mensah',
          updatedAt: '2026-03-23T00:00:00.000Z',
          source: {
            kind: 'APPLICATION',
            id: 'application-compare-1',
            title: 'Frontend Engineer',
            status: 'SHORTLISTED',
            agreement: null,
          },
        },
        {
          id: 'proposal-compare-2',
          type: 'SERVICE',
          status: 'PENDING',
          title: 'Launch Design Proposal',
          amount: 'GHS 2,800',
          timeline: '12 days',
          counterpartyName: 'Kojo Asante',
          updatedAt: '2026-03-22T00:00:00.000Z',
          source: {
            kind: 'SERVICE_REQUEST',
            id: 'request-compare-2',
            title: 'Launch Design Sprint',
            status: 'PENDING',
            agreement: null,
          },
        },
      ],
    })

    apiGetJobApplicantsMock.mockResolvedValue({ applications: [] })

    apiCompareProposalsMock.mockResolvedValue({
      comparison: {
        summary:
          'Ada Mensah has the cleaner hire-ready counter, while the freelance launch proposal stays faster and more fixed-scope for short campaign work.',
        comparedCount: 2,
        proposals: [
          {
            id: 'proposal-compare-1',
            type: 'JOB',
            status: 'COUNTERED',
            title: 'Frontend Engineer Counter',
            amount: '$5,000',
            timeline: 'Immediate start',
            counterpartyName: 'Ada Mensah',
            updatedAt: '2026-03-23T00:00:00.000Z',
            source: {
              kind: 'APPLICATION',
              id: 'application-compare-1',
              title: 'Frontend Engineer',
              status: 'SHORTLISTED',
              agreement: null,
            },
          },
          {
            id: 'proposal-compare-2',
            type: 'SERVICE',
            status: 'PENDING',
            title: 'Launch Design Proposal',
            amount: 'GHS 2,800',
            timeline: '12 days',
            counterpartyName: 'Kojo Asante',
            updatedAt: '2026-03-22T00:00:00.000Z',
            source: {
              kind: 'SERVICE_REQUEST',
              id: 'request-compare-2',
              title: 'Launch Design Sprint',
              status: 'PENDING',
              agreement: null,
            },
          },
        ],
      },
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Proposal Pulse')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Compare Frontend Engineer Counter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare Launch Design Proposal' }))
    fireEvent.click(screen.getByRole('button', { name: /generate ai proposal comparison/i }))

    await waitFor(() => {
      expect(apiCompareProposalsMock).toHaveBeenCalledWith([
        'proposal-compare-1',
        'proposal-compare-2',
      ])
    })

    expect(
      await screen.findByText(
        'Ada Mensah has the cleaner hire-ready counter, while the freelance launch proposal stays faster and more fixed-scope for short campaign work.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('2 proposals compared')).toBeInTheDocument()
    expect(screen.getAllByText('Ada Mensah').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Kojo Asante').length).toBeGreaterThan(0)
  })

  it('compares active agreements directly from the employer dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [],
      recentApplications: [],
      unreadMessages: 0,
      activeAgreementCount: 2,
      upcomingMilestones: [
        {
          id: 'milestone-compare-1',
          title: 'Wireframes',
          amount: 'GHS 1,500',
          status: 'IN_PROGRESS',
          agreement: {
            id: 'agreement-compare-1',
            title: 'Launch Design Sprint',
            type: 'SERVICE',
            updatedAt: '2026-03-24T00:00:00.000Z',
          },
        },
        {
          id: 'milestone-compare-2',
          title: 'Offer Signing',
          amount: '$500',
          status: 'PENDING',
          agreement: {
            id: 'agreement-compare-2',
            title: 'Frontend Engineer Contract',
            type: 'JOB',
            updatedAt: '2026-03-23T00:00:00.000Z',
          },
        },
      ],
    })

    apiGetJobApplicantsMock.mockResolvedValue({ applications: [] })

    apiCompareAgreementsMock.mockResolvedValue({
      comparison: {
        summary:
          'The design sprint is further along, while the frontend hiring agreement carries more open payout exposure and less completed work.',
        comparedCount: 2,
        agreements: [
          {
            id: 'agreement-compare-1',
            type: 'SERVICE',
            status: 'ACTIVE',
            title: 'Launch Design Sprint',
            counterpartyName: 'Kojo Asante',
            updatedAt: '2026-03-24T00:00:00.000Z',
            source: {
              kind: 'SERVICE_REQUEST',
              id: 'request-compare-1',
              title: 'Launch Design Sprint',
              status: 'ACCEPTED',
            },
            milestoneCount: 3,
            completedMilestones: 2,
            outstandingPayments: 1,
            hasActiveDispute: false,
          },
          {
            id: 'agreement-compare-2',
            type: 'JOB',
            status: 'ACTIVE',
            title: 'Frontend Engineer Contract',
            counterpartyName: 'Ada Mensah',
            updatedAt: '2026-03-23T00:00:00.000Z',
            source: {
              kind: 'APPLICATION',
              id: 'application-compare-2',
              title: 'Frontend Engineer',
              status: 'HIRED',
            },
            milestoneCount: 4,
            completedMilestones: 1,
            outstandingPayments: 2,
            hasActiveDispute: true,
          },
        ],
      },
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Agreement Pulse')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Compare Launch Design Sprint' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare Frontend Engineer Contract' }))
    fireEvent.click(screen.getByRole('button', { name: /generate ai agreement comparison/i }))

    await waitFor(() => {
      expect(apiCompareAgreementsMock).toHaveBeenCalledWith([
        'agreement-compare-1',
        'agreement-compare-2',
      ])
    })

    expect(
      await screen.findByText(
        'The design sprint is further along, while the frontend hiring agreement carries more open payout exposure and less completed work.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('2 agreements compared')).toBeInTheDocument()
    expect(screen.getAllByText('Kojo Asante').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ada Mensah').length).toBeGreaterThan(0)
    expect(screen.getByText('Active dispute')).toBeInTheDocument()
  })

  it('generates an agreement decision brief directly from the employer dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [],
      recentApplications: [],
      unreadMessages: 0,
      activeAgreementCount: 1,
      upcomingMilestones: [
        {
          id: 'milestone-decision-1',
          title: 'Final QA',
          amount: '$900',
          status: 'IN_PROGRESS',
          agreement: {
            id: 'agreement-decision-1',
            title: 'Frontend Engineer Contract',
            type: 'JOB',
            updatedAt: '2026-03-24T00:00:00.000Z',
          },
        },
      ],
    })

    apiGetJobApplicantsMock.mockResolvedValue({ applications: [] })
    apiGenerateAgreementDecisionBriefMock.mockResolvedValue({
      brief: {
        recommendation: 'COMPLETE',
        headline: 'This agreement is in a clean position to close once the final sign-off lands.',
        summary:
          'Most delivery and payout risk is already behind this agreement, so the final close-out decision mainly depends on the last confirmation step.',
        strengths: ['Delivery is already near completion.'],
        cautions: ['You still need the final approval to avoid closing too early.'],
        nextAction:
          'Confirm the last sign-off with the candidate and then mark the agreement complete.',
        suggestedMessage:
          'Everything looks aligned on our side. Once you confirm the final sign-off, I will close the agreement.',
      },
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Frontend Engineer Contract')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Decision brief Frontend Engineer Contract' }),
    )

    await waitFor(() => {
      expect(apiGenerateAgreementDecisionBriefMock).toHaveBeenCalledWith('agreement-decision-1')
    })

    expect(
      await screen.findByText(
        'This agreement is in a clean position to close once the final sign-off lands.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('COMPLETE')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Confirm the last sign-off with the candidate and then mark the agreement complete.',
      ),
    ).toBeInTheDocument()
  })

  it('shows an agreement link after an employer moves an applicant to HIRED', async () => {
    apiGetDashboardMock
      .mockResolvedValueOnce({
        jobs: [
          {
            id: 'job-3',
            title: 'Backend Engineer',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 1 },
          },
        ],
        recentApplications: [
          {
            id: 'application-2',
            status: 'SUBMITTED',
            createdAt: '2026-03-21T00:00:00.000Z',
            job: {
              id: 'job-3',
              title: 'Backend Engineer',
            },
            seeker: {
              email: 'kwame@example.com',
              jobSeekerProfile: {
                firstName: 'Kwame',
                lastName: 'Asare',
              },
            },
          },
        ],
        unreadMessages: 0,
      })
      .mockResolvedValueOnce({
        jobs: [
          {
            id: 'job-3',
            title: 'Backend Engineer',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            _count: { applications: 1 },
          },
        ],
        recentApplications: [
          {
            id: 'application-2',
            status: 'HIRED',
            createdAt: '2026-03-21T00:00:00.000Z',
            job: {
              id: 'job-3',
              title: 'Backend Engineer',
            },
            seeker: {
              email: 'kwame@example.com',
              jobSeekerProfile: {
                firstName: 'Kwame',
                lastName: 'Asare',
              },
            },
          },
        ],
        unreadMessages: 0,
      })

    apiGetJobApplicantsMock
      .mockResolvedValueOnce({
        applications: [
          {
            id: 'application-2',
            status: 'SUBMITTED',
            createdAt: '2026-03-21T00:00:00.000Z',
            coverLetter: 'I can own the API and hiring workflow.',
            agreement: null,
            seeker: {
              id: 'seeker-2',
              email: 'kwame@example.com',
              jobSeekerProfile: {
                firstName: 'Kwame',
                lastName: 'Asare',
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        applications: [
          {
            id: 'application-2',
            status: 'HIRED',
            createdAt: '2026-03-21T00:00:00.000Z',
            coverLetter: 'I can own the API and hiring workflow.',
            agreement: {
              id: 'agreement-1',
              status: 'ACTIVE',
              updatedAt: '2026-03-21T00:00:00.000Z',
            },
            seeker: {
              id: 'seeker-2',
              email: 'kwame@example.com',
              jobSeekerProfile: {
                firstName: 'Kwame',
                lastName: 'Asare',
              },
            },
          },
        ],
      })

    apiUpdateApplicationStatusMock.mockResolvedValue({
      application: { id: 'application-2', status: 'HIRED' },
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    fireEvent.click((await screen.findAllByRole('button', { name: 'HIRED' }))[0])

    expect((await screen.findAllByText('Agreement')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('HIRED').length).toBeGreaterThan(0)
    expect(apiUpdateApplicationStatusMock).toHaveBeenCalledWith(
      'application-2',
      'HIRED',
    )
  })

  it('shows milestone payout approvals in the employer payment pulse', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [],
      recentApplications: [],
      unreadMessages: 0,
      activeAgreementCount: 1,
      upcomingMilestones: [],
      pendingPaymentActions: 1,
      paymentActionItems: [
        {
          id: 'milestone-pay-1',
          title: 'Month 1 Payroll',
          amount: '$5,000',
          status: 'COMPLETED',
          paymentStatus: 'REQUESTED',
          action: 'MARK_PAID',
          counterpartyName: 'Ada Mensah',
          agreement: {
            id: 'agreement-pay-1',
            title: 'Backend Engineer',
            type: 'JOB',
            updatedAt: '2026-03-25T00:00:00.000Z',
          },
        },
      ],
    })
    apiGetSentServiceRequestsMock.mockResolvedValue({ requests: [] })
    apiGetJobApplicantsMock.mockResolvedValue({ applications: [] })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Payment Pulse')).toBeInTheDocument()
    expect(await screen.findByText('MARK PAID')).toBeInTheDocument()
    expect(screen.getAllByText(/Ada Mensah/).length).toBeGreaterThan(0)
  })

  it('reloads employer dashboard and keeps the selected applicant review open after a realtime agreement event', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-rt-1',
          title: 'Frontend Engineer',
          status: 'ACTIVE',
          createdAt: '2026-03-21T00:00:00.000Z',
          _count: { applications: 1 },
        },
      ],
      recentApplications: [
        {
          id: 'application-rt-1',
          status: 'HIRED',
          createdAt: '2026-03-21T00:00:00.000Z',
          job: {
            id: 'job-rt-1',
            title: 'Frontend Engineer',
          },
          seeker: {
            email: 'ada@example.com',
            jobSeekerProfile: {
              firstName: 'Ada',
              lastName: 'Mensah',
            },
          },
        },
      ],
      unreadMessages: 0,
      pendingPaymentActions: 0,
      paymentActionItems: [],
    })

    apiGetDashboardOverviewMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-rt-1',
          title: 'Frontend Engineer',
          status: 'ACTIVE',
          createdAt: '2026-03-21T00:00:00.000Z',
          _count: { applications: 1 },
        },
      ],
      recentApplications: [
        {
          id: 'application-rt-1',
          status: 'HIRED',
          createdAt: '2026-03-21T00:00:00.000Z',
          job: {
            id: 'job-rt-1',
            title: 'Frontend Engineer',
          },
          seeker: {
            email: 'ada@example.com',
            jobSeekerProfile: {
              firstName: 'Ada',
              lastName: 'Mensah',
            },
          },
        },
      ],
    })

    apiGetDashboardWorkflowSummaryMock.mockResolvedValue({
      activeAgreementCount: 0,
      upcomingMilestones: [],
      pendingProposalActions: 0,
      proposalActionItems: [],
      pendingReviewActions: 0,
      reviewActionItems: [],
      pendingDisputeActions: 0,
      disputeActionItems: [],
      pendingPaymentActions: 1,
      paymentActionItems: [
        {
          id: 'milestone-pay-rt-1',
          title: 'Offer Signing Bonus',
          amount: '$500',
          status: 'COMPLETED',
          paymentStatus: 'REQUESTED',
          action: 'MARK_PAID',
          counterpartyName: 'Ada Mensah',
          agreement: {
            id: 'agreement-rt-1',
            title: 'Frontend Engineer',
            type: 'JOB',
            updatedAt: '2026-03-23T00:00:00.000Z',
          },
        },
      ],
    })

    apiGetJobApplicantsMock
      .mockResolvedValueOnce({
        applications: [
          {
            id: 'application-rt-1',
            status: 'HIRED',
            createdAt: '2026-03-21T00:00:00.000Z',
            coverLetter: 'I can own the frontend roadmap.',
            agreement: {
              id: 'agreement-rt-1',
              status: 'ACTIVE',
              updatedAt: '2026-03-21T00:00:00.000Z',
            },
            seeker: {
              id: 'seeker-rt-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        applications: [
          {
            id: 'application-rt-1',
            status: 'HIRED',
            createdAt: '2026-03-21T00:00:00.000Z',
            coverLetter: 'I can own the frontend roadmap.',
            agreement: {
              id: 'agreement-rt-1',
              status: 'ACTIVE',
              updatedAt: '2026-03-23T00:00:00.000Z',
            },
            seeker: {
              id: 'seeker-rt-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
          },
        ],
      })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('I can own the frontend roadmap.')).toBeInTheDocument()
    expect(screen.getAllByText('Agreement').length).toBeGreaterThan(0)

    realtimeHandlers.onAgreementsRefresh?.({ agreementId: 'agreement-rt-1' })

    expect(await screen.findByText('Offer Signing Bonus')).toBeInTheDocument()
    expect(screen.getByText('MARK PAID')).toBeInTheDocument()
    await waitFor(() => {
      expect(apiGetJobApplicantsMock).toHaveBeenNthCalledWith(2, 'job-rt-1')
    })
    expect(apiGetDashboardWorkflowSummaryMock).toHaveBeenCalledTimes(1)
    expect(apiGetDashboardOverviewMock).toHaveBeenCalledTimes(1)
    expect(apiGetDashboardMock).toHaveBeenCalledTimes(1)
  }, 10000)

  it('reloads only the employer message pulse when a realtime message event arrives', async () => {
    apiGetDashboardMock.mockResolvedValue({
      jobs: [],
      recentApplications: [],
      unreadMessages: 0,
    })
    apiGetSentServiceRequestsMock.mockResolvedValue({ requests: [] })
    apiGetJobApplicantsMock.mockResolvedValue({ applications: [] })
    apiGetMessageSummaryMock.mockResolvedValue({
      unreadMessages: 3,
      recentMessages: [],
    })

    render(
      <MemoryRouter>
        <EmployerDashboard />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('You currently have 0 unread conversation updates.'),
    ).toBeInTheDocument()

    realtimeHandlers.onMessagesRefresh?.({ conversationId: 'conversation-2' })

    expect(
      await screen.findByText('You currently have 3 unread conversation updates.'),
    ).toBeInTheDocument()
    expect(apiGetMessageSummaryMock).toHaveBeenCalledTimes(1)
    expect(apiGetDashboardMock).toHaveBeenCalledTimes(1)
  })
})
