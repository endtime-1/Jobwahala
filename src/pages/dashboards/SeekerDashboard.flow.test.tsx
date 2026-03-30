import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SeekerDashboard from './SeekerDashboard'

const useAuthMock = vi.fn()
const apiCompareAgreementsMock = vi.fn()
const apiCompareJobsMock = vi.fn()
const apiCompareProposalsMock = vi.fn()
const apiCreateVerificationRequestMock = vi.fn()
const apiDeleteApplicationMock = vi.fn()
const apiDeleteServiceRequestMock = vi.fn()
const apiGenerateAgreementDecisionBriefMock = vi.fn()
const apiGetDashboardMock = vi.fn()
const apiGetDashboardOverviewMock = vi.fn()
const apiGetDashboardWorkflowSummaryMock = vi.fn()
const apiGetMessageSummaryMock = vi.fn()
const apiGetProfileOptimizationMock = vi.fn()
const apiGetSentServiceRequestsMock = vi.fn()
const subscribeToRealtimeEventsMock = vi.fn()
let realtimeHandlers: Record<string, ((payload?: unknown) => void) | undefined> = {}

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../../components/VerifiedBadge', () => ({
  default: () => <div>Verified Badge</div>,
}))

vi.mock('../../lib/api', () => ({
  apiCompareAgreements: (...args: unknown[]) => apiCompareAgreementsMock(...args),
  apiCompareJobs: (...args: unknown[]) => apiCompareJobsMock(...args),
  apiCompareProposals: (...args: unknown[]) => apiCompareProposalsMock(...args),
  apiCreateVerificationRequest: (...args: unknown[]) =>
    apiCreateVerificationRequestMock(...args),
  apiDeleteApplication: (...args: unknown[]) => apiDeleteApplicationMock(...args),
  apiDeleteServiceRequest: (...args: unknown[]) =>
    apiDeleteServiceRequestMock(...args),
  apiGenerateAgreementDecisionBrief: (...args: unknown[]) =>
    apiGenerateAgreementDecisionBriefMock(...args),
  apiGetDashboard: (...args: unknown[]) => apiGetDashboardMock(...args),
  apiGetDashboardOverview: (...args: unknown[]) => apiGetDashboardOverviewMock(...args),
  apiGetDashboardWorkflowSummary: (...args: unknown[]) =>
    apiGetDashboardWorkflowSummaryMock(...args),
  apiGetMessageSummary: (...args: unknown[]) => apiGetMessageSummaryMock(...args),
  apiGetProfileOptimization: (...args: unknown[]) =>
    apiGetProfileOptimizationMock(...args),
  apiGetSentServiceRequests: (...args: unknown[]) =>
    apiGetSentServiceRequestsMock(...args),
}))

vi.mock('../../lib/realtime', () => ({
  subscribeToRealtimeEvents: (...args: unknown[]) => subscribeToRealtimeEventsMock(...args),
}))

describe('SeekerDashboard application monitoring flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realtimeHandlers = {}
    subscribeToRealtimeEventsMock.mockImplementation((handlers: typeof realtimeHandlers) => {
      realtimeHandlers = handlers
      return () => undefined
    })

    useAuthMock.mockReturnValue({
      userName: 'Ada',
      user: {
        id: 'seeker-1',
        jobSeekerProfile: {
          firstName: 'Ada',
          lastName: 'Mensah',
          experience: 'Frontend engineer',
          skills: 'React, TypeScript',
          resumeFileUrl: null,
        },
      },
    })

    apiGetSentServiceRequestsMock.mockResolvedValue({ requests: [] })
    apiGetDashboardOverviewMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [],
      cvCount: 1,
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
    apiGetProfileOptimizationMock.mockResolvedValue({
      optimization: {
        score: 82,
        headline: 'Ada is currently best positioned for Frontend Engineer opportunities.',
        strengths: [
          'Your skill stack is already specific enough to support stronger job matching: React, TypeScript.',
        ],
        improvements: [
          'Upload a resume link or keep generating CV drafts so employers can quickly review a polished candidate record.',
        ],
        suggestedSummary:
          'Ada is a results-oriented frontend engineer with strong React and TypeScript delivery experience.',
        suggestedSkills: ['React', 'TypeScript', 'UI Engineering'],
        nextCvPrompt: 'Create an ATS-friendly CV for Ada targeting Frontend Engineer roles.',
        targetRoles: ['Frontend Engineer', 'React Product Engineer'],
      },
    })

    Object.defineProperty(window, 'confirm', {
      writable: true,
      value: vi.fn(() => true),
    })
  })

  it('shows employer-updated application status in the seeker dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [
        {
          id: 'application-1',
          status: 'INTERVIEW',
          createdAt: '2026-03-21T00:00:00.000Z',
          agreement: null,
          job: {
            id: 'job-1',
            title: 'Frontend Engineer',
            location: 'Remote',
            salary: '$4,000/month',
            employer: {
              email: 'employer@example.com',
              employerProfile: {
                companyName: 'JobWahala Labs',
              },
            },
          },
        },
      ],
      recommendedJobs: [],
      unreadMessages: 3,
      cvCount: 2,
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('INTERVIEW')).toBeInTheDocument()
    expect(screen.getAllByText('Frontend Engineer').length).toBeGreaterThan(0)
    expect(screen.getByText('JobWahala Labs')).toBeInTheDocument()
  })

  it('shows scored recommendation reasons in the seeker dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [
        {
          id: 'job-recommended-1',
          title: 'React Product Engineer',
          location: 'Remote',
          salary: '$6,000/month',
          matchScore: 92,
          matchReasons: ['Skill overlap: React, TypeScript', 'Remote-friendly role'],
          employer: {
            email: 'employer@example.com',
            employerProfile: {
              companyName: 'JobWahala Labs',
            },
          },
        },
      ],
      unreadMessages: 0,
      cvCount: 2,
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect((await screen.findAllByText('React Product Engineer')).length).toBeGreaterThan(0)
    expect(screen.getByText('92% match')).toBeInTheDocument()
    expect(screen.getByText('Skill overlap: React, TypeScript')).toBeInTheDocument()
    expect(screen.getByText('Remote-friendly role')).toBeInTheDocument()
  })

  it('compares selected applied and recommended roles from the seeker dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [
        {
          id: 'application-1',
          status: 'INTERVIEW',
          createdAt: '2026-03-21T00:00:00.000Z',
          agreement: null,
          job: {
            id: 'job-1',
            title: 'Frontend Engineer',
            location: 'Remote',
            salary: '$4,000/month',
            employer: {
              email: 'employer@example.com',
              employerProfile: {
                companyName: 'JobWahala Labs',
              },
            },
          },
        },
      ],
      recommendedJobs: [
        {
          id: 'job-2',
          title: 'React Product Engineer',
          location: 'Remote',
          salary: '$6,000/month',
          matchScore: 92,
          matchReasons: ['Skill overlap: React, TypeScript', 'Remote-friendly role'],
          employer: {
            email: 'employer@example.com',
            employerProfile: {
              companyName: 'JobWahala Labs',
            },
          },
        },
      ],
      unreadMessages: 0,
      cvCount: 2,
    })

    apiCompareJobsMock.mockResolvedValue({
      comparison: {
        summary:
          'React Product Engineer currently leads the workspace comparison for Ada, while Frontend Engineer remains the cleaner alternative for broader product execution.',
        comparedCount: 2,
        jobs: [
          {
            id: 'job-2',
            title: 'React Product Engineer',
            description: 'Own TypeScript platform workflows.',
            location: 'Remote',
            salary: '$6,000/month',
            type: 'Full-time',
            category: 'Engineering',
            createdAt: '2026-03-22T00:00:00.000Z',
            matchScore: 94,
            matchReasons: ['Skill overlap: React, TypeScript', 'Remote-friendly role'],
            employer: {
              email: 'employer@example.com',
              employerProfile: {
                companyName: 'JobWahala Labs',
              },
            },
          },
          {
            id: 'job-1',
            title: 'Frontend Engineer',
            description: 'Build React product features.',
            location: 'Remote',
            salary: '$4,000/month',
            type: 'Full-time',
            category: 'Engineering',
            createdAt: '2026-03-21T00:00:00.000Z',
            matchScore: 88,
            matchReasons: ['Skill overlap: React', 'Category fit for Engineering'],
            employer: {
              email: 'employer@example.com',
              employerProfile: {
                companyName: 'JobWahala Labs',
              },
            },
          },
        ],
      },
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('AI Role Comparison')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Compare Frontend Engineer'))
    fireEvent.click(screen.getByLabelText('Compare React Product Engineer'))
    fireEvent.click(screen.getByRole('button', { name: /Generate AI Comparison/i }))

    await waitFor(() => {
      expect(apiCompareJobsMock).toHaveBeenCalledWith(['job-1', 'job-2'])
    })

    expect(
      await screen.findByText(/React Product Engineer currently leads the workspace comparison/i),
    ).toBeInTheDocument()
    expect(screen.getByText('2 roles compared')).toBeInTheDocument()
    expect(screen.getAllByText('JobWahala Labs').length).toBeGreaterThan(0)
    expect(screen.getAllByText('94% match').length).toBeGreaterThan(0)
  })

  it('compares proposal terms directly from the seeker dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [],
      unreadMessages: 0,
      cvCount: 2,
      pendingProposalActions: 2,
      proposalActionItems: [
        {
          id: 'proposal-compare-1',
          type: 'JOB',
          status: 'PENDING',
          title: 'Frontend Engineer Offer',
          amount: '$5,000',
          timeline: 'Immediate start',
          counterpartyName: 'JobWahala Labs',
          updatedAt: '2026-03-22T00:00:00.000Z',
          source: {
            kind: 'APPLICATION',
            id: 'application-compare-1',
            title: 'Frontend Engineer',
            status: 'INTERVIEW',
            agreement: null,
          },
        },
        {
          id: 'proposal-compare-2',
          type: 'SERVICE',
          status: 'COUNTERED',
          title: 'Launch Design Proposal',
          amount: 'GHS 2,800',
          timeline: '12 days',
          counterpartyName: 'Kojo Asante',
          updatedAt: '2026-03-23T00:00:00.000Z',
          source: {
            kind: 'SERVICE_REQUEST',
            id: 'request-compare-1',
            title: 'Launch Design Sprint',
            status: 'PENDING',
            agreement: null,
          },
        },
      ],
    })

    apiCompareProposalsMock.mockResolvedValue({
      comparison: {
        summary:
          'The engineering offer is better for long-term ownership, while the design proposal is faster and more fixed-scope for a short launch window.',
        comparedCount: 2,
        proposals: [
          {
            id: 'proposal-compare-1',
            type: 'JOB',
            status: 'PENDING',
            title: 'Frontend Engineer Offer',
            amount: '$5,000',
            timeline: 'Immediate start',
            counterpartyName: 'JobWahala Labs',
            updatedAt: '2026-03-22T00:00:00.000Z',
            source: {
              kind: 'APPLICATION',
              id: 'application-compare-1',
              title: 'Frontend Engineer',
              status: 'INTERVIEW',
              agreement: null,
            },
          },
          {
            id: 'proposal-compare-2',
            type: 'SERVICE',
            status: 'COUNTERED',
            title: 'Launch Design Proposal',
            amount: 'GHS 2,800',
            timeline: '12 days',
            counterpartyName: 'Kojo Asante',
            updatedAt: '2026-03-23T00:00:00.000Z',
            source: {
              kind: 'SERVICE_REQUEST',
              id: 'request-compare-1',
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
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Proposal Pulse')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Compare Frontend Engineer Offer' }))
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
        'The engineering offer is better for long-term ownership, while the design proposal is faster and more fixed-scope for a short launch window.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('2 proposals compared')).toBeInTheDocument()
    expect(screen.getAllByText('JobWahala Labs').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Kojo Asante').length).toBeGreaterThan(0)
  })

  it('compares active agreements directly from the seeker dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [],
      unreadMessages: 0,
      cvCount: 2,
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
          title: 'API Delivery',
          amount: '$2,000',
          status: 'PENDING',
          agreement: {
            id: 'agreement-compare-2',
            title: 'Backend Engineer Contract',
            type: 'JOB',
            updatedAt: '2026-03-23T00:00:00.000Z',
          },
        },
      ],
    })

    apiCompareAgreementsMock.mockResolvedValue({
      comparison: {
        summary:
          'The design sprint is closer to completion, while the backend contract carries more open payouts and longer remaining delivery depth.',
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
            title: 'Backend Engineer Contract',
            counterpartyName: 'JobWahala Labs',
            updatedAt: '2026-03-23T00:00:00.000Z',
            source: {
              kind: 'APPLICATION',
              id: 'application-compare-2',
              title: 'Backend Engineer',
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
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Work Pulse')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Compare Launch Design Sprint' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare Backend Engineer Contract' }))
    fireEvent.click(screen.getByRole('button', { name: /generate ai agreement comparison/i }))

    await waitFor(() => {
      expect(apiCompareAgreementsMock).toHaveBeenCalledWith([
        'agreement-compare-1',
        'agreement-compare-2',
      ])
    })

    expect(
      await screen.findByText(
        'The design sprint is closer to completion, while the backend contract carries more open payouts and longer remaining delivery depth.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('2 agreements compared')).toBeInTheDocument()
    expect(screen.getAllByText('Kojo Asante').length).toBeGreaterThan(0)
    expect(screen.getAllByText('JobWahala Labs').length).toBeGreaterThan(0)
    expect(screen.getByText('Active dispute')).toBeInTheDocument()
  })

  it('generates an agreement decision brief directly from the seeker dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [],
      unreadMessages: 0,
      cvCount: 2,
      activeAgreementCount: 1,
      upcomingMilestones: [
        {
          id: 'milestone-decision-1',
          title: 'Final QA',
          amount: 'GHS 900',
          status: 'IN_PROGRESS',
          agreement: {
            id: 'agreement-decision-1',
            title: 'Launch Design Sprint',
            type: 'SERVICE',
            updatedAt: '2026-03-24T00:00:00.000Z',
          },
        },
      ],
    })

    apiGenerateAgreementDecisionBriefMock.mockResolvedValue({
      brief: {
        recommendation: 'HOLD',
        headline: 'Pause completion until the final payout checkpoint is cleared.',
        summary:
          'This agreement is close to the finish line, but one last delivery checkpoint and payout confirmation still need attention before closing it.',
        strengths: ['Most milestones are already moving toward completion.'],
        cautions: ['The final payout has not been fully cleared yet.'],
        nextAction:
          'Confirm the last milestone payment and close the remaining QA checkpoint before marking the agreement complete.',
        suggestedMessage:
          'We are nearly done here. Once the last payout is confirmed and QA is signed off, I can close the agreement cleanly.',
      },
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Launch Design Sprint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Decision brief Launch Design Sprint' }))

    await waitFor(() => {
      expect(apiGenerateAgreementDecisionBriefMock).toHaveBeenCalledWith('agreement-decision-1')
    })

    expect(
      await screen.findByText('Pause completion until the final payout checkpoint is cleared.'),
    ).toBeInTheDocument()
    expect(screen.getByText('HOLD')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Confirm the last milestone payment and close the remaining QA checkpoint before marking the agreement complete.',
      ),
    ).toBeInTheDocument()
  })

  it('shows AI seeker coaching for profile and CV optimization', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [],
      unreadMessages: 0,
      cvCount: 2,
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('AI Profile Coach')).toBeInTheDocument()
    expect(screen.getByText('82% ready')).toBeInTheDocument()
    expect(
      screen.getByText('Ada is currently best positioned for Frontend Engineer opportunities.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Frontend Engineer').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /open cv studio/i }).length).toBeGreaterThan(0)
  })

  it('withdraws an open application and refreshes the seeker dashboard', async () => {
    apiGetDashboardMock
      .mockResolvedValueOnce({
        applications: [
          {
            id: 'application-1',
            status: 'SUBMITTED',
            createdAt: '2026-03-21T00:00:00.000Z',
            agreement: null,
            job: {
              id: 'job-1',
              title: 'Frontend Engineer',
              location: 'Remote',
              salary: '$4,000/month',
              employer: {
                email: 'employer@example.com',
                employerProfile: {
                  companyName: 'JobWahala Labs',
                },
              },
            },
          },
        ],
        recommendedJobs: [],
        unreadMessages: 1,
        cvCount: 1,
      })
      .mockResolvedValueOnce({
        applications: [],
        recommendedJobs: [],
        unreadMessages: 1,
        cvCount: 1,
      })

    apiDeleteApplicationMock.mockResolvedValue({
      success: true,
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect((await screen.findAllByText('Frontend Engineer')).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /withdraw/i }))

    expect(
      await screen.findByText('No applications yet. Start from the live jobs board.'),
    ).toBeInTheDocument()
    expect(apiDeleteApplicationMock).toHaveBeenCalledWith('application-1')
  })

  it('shows the agreement link for a hired application on the seeker dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [
        {
          id: 'application-2',
          status: 'HIRED',
          createdAt: '2026-03-21T00:00:00.000Z',
          agreement: {
            id: 'agreement-1',
            status: 'ACTIVE',
            updatedAt: '2026-03-21T00:00:00.000Z',
          },
          job: {
            id: 'job-2',
            title: 'Backend Engineer',
            location: 'Remote',
            salary: '$5,000/month',
            employer: {
              email: 'employer@example.com',
              employerProfile: {
                companyName: 'JobWahala Labs',
              },
            },
          },
        },
      ],
      recommendedJobs: [],
      unreadMessages: 0,
      cvCount: 1,
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Agreement Live')).toBeInTheDocument()
    expect(screen.getByText('HIRED')).toBeInTheDocument()
  })

  it('cancels a pending freelance service request and refreshes the seeker dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [],
      unreadMessages: 0,
      cvCount: 1,
    })

    apiGetSentServiceRequestsMock
      .mockResolvedValueOnce({
        requests: [
          {
            id: 'request-1',
            status: 'PENDING',
            createdAt: '2026-03-21T00:00:00.000Z',
            agreement: null,
            service: {
              id: 'service-1',
              title: 'Landing Page Design',
              freelancer: {
                id: 'freelancer-1',
                email: 'freelancer@example.com',
                freelancerProfile: {
                  firstName: 'Kojo',
                  lastName: 'Asante',
                },
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        requests: [],
      })

    apiDeleteServiceRequestMock.mockResolvedValue({
      success: true,
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Landing Page Design')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(
      await screen.findByText('No freelance service requests sent yet.'),
    ).toBeInTheDocument()
    expect(apiDeleteServiceRequestMock).toHaveBeenCalledWith('request-1')
  })

  it('shows the agreement link for an accepted freelance service request', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [],
      unreadMessages: 0,
      activeAgreementCount: 1,
      upcomingMilestones: [],
      cvCount: 1,
    })

    apiGetSentServiceRequestsMock.mockResolvedValue({
      requests: [
        {
          id: 'request-2',
          status: 'ACCEPTED',
          createdAt: '2026-03-21T00:00:00.000Z',
          agreement: {
            id: 'agreement-2',
            status: 'ACTIVE',
            updatedAt: '2026-03-21T00:00:00.000Z',
          },
          service: {
            id: 'service-2',
            title: 'Mobile UI Kit',
            freelancer: {
              id: 'freelancer-2',
              email: 'designer@example.com',
              freelancerProfile: {
                firstName: 'Esi',
                lastName: 'Owusu',
              },
            },
          },
        },
      ],
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Mobile UI Kit')).toBeInTheDocument()
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument()
    expect(screen.getByText('Agreement')).toBeInTheDocument()
  })

  it('shows upcoming agreement milestones in the seeker dashboard pulse', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [],
      unreadMessages: 0,
      activeAgreementCount: 1,
      upcomingMilestones: [
        {
          id: 'milestone-1',
          title: 'Wireframes',
          amount: 'GHS 1,500',
          dueDate: '2026-03-28T00:00:00.000Z',
          status: 'IN_PROGRESS',
          agreement: {
            id: 'agreement-1',
            title: 'Landing Page Design',
            type: 'SERVICE',
            updatedAt: '2026-03-21T00:00:00.000Z',
          },
        },
      ],
      cvCount: 1,
    })

    apiGetSentServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Wireframes')).toBeInTheDocument()
    expect(screen.getByText('1 active')).toBeInTheDocument()
    expect(screen.getByText('Landing Page Design')).toBeInTheDocument()
  })

  it('shows milestone payout actions in the seeker payment pulse', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [],
      unreadMessages: 0,
      activeAgreementCount: 1,
      upcomingMilestones: [],
      pendingPaymentActions: 1,
      paymentActionItems: [
        {
          id: 'milestone-payment-1',
          title: 'Final UI Pack',
          amount: 'GHS 3,000',
          dueDate: '2026-03-30T00:00:00.000Z',
          status: 'COMPLETED',
          paymentStatus: 'REQUESTED',
          action: 'MARK_PAID',
          counterpartyName: 'Kojo Asante',
          agreement: {
            id: 'agreement-9',
            title: 'Launch Campaign Design',
            type: 'SERVICE',
            updatedAt: '2026-03-25T00:00:00.000Z',
          },
        },
      ],
      cvCount: 1,
    })

    apiGetSentServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Payment Pulse')).toBeInTheDocument()
    expect(screen.getByText('MARK PAID')).toBeInTheDocument()
    expect(screen.getByText('Kojo Asante', { exact: false })).toBeInTheDocument()
  })

  it('submits a seeker verification request and refreshes the trust panel', async () => {
    apiGetDashboardMock
      .mockResolvedValueOnce({
        applications: [],
        recommendedJobs: [],
        unreadMessages: 0,
        cvCount: 1,
        verification: {
          requiredType: 'IDENTITY',
          verificationStatus: 'UNVERIFIED',
          isVerified: false,
          latestVerificationRequest: null,
        },
      })
      .mockResolvedValueOnce({
        applications: [],
        recommendedJobs: [],
        unreadMessages: 0,
        cvCount: 1,
        verification: {
          requiredType: 'IDENTITY',
          verificationStatus: 'PENDING',
          isVerified: false,
          latestVerificationRequest: {
            id: 'verification-1',
            type: 'IDENTITY',
            status: 'PENDING',
            createdAt: '2026-03-22T00:00:00.000Z',
            documentUrl: 'https://docs.example.com/identity',
          },
        },
      })

    apiGetSentServiceRequestsMock.mockResolvedValue({
      requests: [],
    })
    apiCreateVerificationRequestMock.mockResolvedValue({
      verification: { id: 'verification-1', status: 'PENDING' },
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Verification has not been requested yet.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /request verification/i }))
    fireEvent.change(screen.getByPlaceholderText(/explain how the team can verify your identity/i), {
      target: { value: 'Government ID shared through a secure drive along with a matching profile record.' },
    })
    fireEvent.change(screen.getByPlaceholderText('https://...'), {
      target: { value: 'https://docs.example.com/identity' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    expect(apiCreateVerificationRequestMock).toHaveBeenCalledWith({
      details: 'Government ID shared through a secure drive along with a matching profile record.',
      documentUrl: 'https://docs.example.com/identity',
    })
    expect(await screen.findByText('Verification is under review.')).toBeInTheDocument()
  })

  it('shows admin feedback for verification and lets the seeker resubmit', async () => {
    apiGetDashboardMock
      .mockResolvedValueOnce({
        applications: [],
        recommendedJobs: [],
        unreadMessages: 0,
        cvCount: 1,
        verification: {
          requiredType: 'IDENTITY',
          verificationStatus: 'NEEDS_INFO',
          isVerified: false,
          latestVerificationRequest: {
            id: 'verification-2',
            type: 'IDENTITY',
            status: 'NEEDS_INFO',
            createdAt: '2026-03-22T00:00:00.000Z',
            reviewNote: 'Please attach a clearer identity evidence link with your name visible.',
            documentUrl: 'https://docs.example.com/old-identity',
          },
          verificationHistory: [
            {
              id: 'verification-2',
              type: 'IDENTITY',
              status: 'NEEDS_INFO',
              createdAt: '2026-03-22T00:00:00.000Z',
              reviewNote: 'Please attach a clearer identity evidence link with your name visible.',
              documentUrl: 'https://docs.example.com/old-identity',
              details: 'Initial ID upload with a blurry scan.',
            },
            {
              id: 'verification-1',
              type: 'IDENTITY',
              status: 'REJECTED',
              createdAt: '2026-03-20T00:00:00.000Z',
              reviewNote: 'The first submission did not include a matching legal name.',
              documentUrl: 'https://docs.example.com/first-identity',
              details: 'Original identity submission without a matching profile name.',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        applications: [],
        recommendedJobs: [],
        unreadMessages: 0,
        cvCount: 1,
        verification: {
          requiredType: 'IDENTITY',
          verificationStatus: 'PENDING',
          isVerified: false,
          latestVerificationRequest: {
            id: 'verification-3',
            type: 'IDENTITY',
            status: 'PENDING',
            createdAt: '2026-03-23T00:00:00.000Z',
            documentUrl: 'https://docs.example.com/new-identity',
          },
        },
      })

    apiGetSentServiceRequestsMock.mockResolvedValue({
      requests: [],
    })
    apiCreateVerificationRequestMock.mockResolvedValue({
      verification: { id: 'verification-3', status: 'PENDING' },
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('More verification detail is required.')).toBeInTheDocument()
    expect(screen.getByText(/please attach a clearer identity evidence link/i)).toBeInTheDocument()
    expect(screen.getByText('Previous verification submissions')).toBeInTheDocument()
    expect(screen.getByText(/matching legal name/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /update verification/i }))
    fireEvent.change(screen.getByPlaceholderText(/explain how the team can verify your identity/i), {
      target: { value: 'Updated government ID evidence with a clearer scan and matching public profile link.' },
    })
    fireEvent.change(screen.getByPlaceholderText('https://...'), {
      target: { value: 'https://docs.example.com/new-identity' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    expect(apiCreateVerificationRequestMock).toHaveBeenCalledWith({
      details: 'Updated government ID evidence with a clearer scan and matching public profile link.',
      documentUrl: 'https://docs.example.com/new-identity',
    })
    expect(await screen.findByText('Verification is under review.')).toBeInTheDocument()
  }, 10000)

  it('reloads the seeker dashboard pulse when a realtime proposal event arrives', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [],
      unreadMessages: 0,
      pendingProposalActions: 0,
      proposalActionItems: [],
      cvCount: 1,
    })

    apiGetDashboardWorkflowSummaryMock.mockResolvedValue({
      activeAgreementCount: 0,
      upcomingMilestones: [],
      pendingProposalActions: 1,
      proposalActionItems: [
        {
          id: 'proposal-action-1',
          title: 'Frontend Engineer Counter',
          amount: '$5,000',
          timeline: 'Immediate start',
          status: 'COUNTERED',
          counterpartyName: 'JobWahala Labs',
          updatedAt: '2026-03-23T00:00:00.000Z',
          source: null,
        },
      ],
      pendingReviewActions: 0,
      reviewActionItems: [],
      pendingDisputeActions: 0,
      disputeActionItems: [],
      pendingPaymentActions: 0,
      paymentActionItems: [],
    })

    apiGetSentServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Proposal Pulse')).toBeInTheDocument()
    expect(
      screen.getByText('No proposal decisions are waiting on you right now.'),
    ).toBeInTheDocument()

    realtimeHandlers.onProposalsRefresh?.({ proposalId: 'proposal-1' })

    expect(await screen.findByText('Frontend Engineer Counter')).toBeInTheDocument()
    expect(screen.getByText('COUNTERED')).toBeInTheDocument()
    expect(apiGetDashboardWorkflowSummaryMock).toHaveBeenCalledTimes(1)
    expect(apiGetDashboardOverviewMock).toHaveBeenCalledTimes(1)
    expect(apiGetDashboardMock).toHaveBeenCalledTimes(1)
  })

  it('reloads only the seeker message pulse when a realtime message event arrives', async () => {
    apiGetDashboardMock.mockResolvedValue({
      applications: [],
      recommendedJobs: [],
      unreadMessages: 0,
      cvCount: 1,
    })

    apiGetSentServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    apiGetMessageSummaryMock.mockResolvedValue({
      unreadMessages: 4,
      recentMessages: [],
    })

    render(
      <MemoryRouter>
        <SeekerDashboard />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('You currently have 0 unread conversation updates.'),
    ).toBeInTheDocument()

    realtimeHandlers.onMessagesRefresh?.({ conversationId: 'conversation-1' })

    expect(
      await screen.findByText('You currently have 4 unread conversation updates.'),
    ).toBeInTheDocument()
    expect(apiGetMessageSummaryMock).toHaveBeenCalledTimes(1)
    expect(apiGetDashboardMock).toHaveBeenCalledTimes(1)
  })
})
