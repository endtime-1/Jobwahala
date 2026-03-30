import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FreelancerDashboard from './FreelancerDashboard'

const useAuthMock = vi.fn()
const apiCompareAgreementsMock = vi.fn()
const apiCompareProposalsMock = vi.fn()
const apiCreateServiceMock = vi.fn()
const apiCreateServiceProposalMock = vi.fn()
const apiDeleteServiceMock = vi.fn()
const apiGenerateAgreementDecisionBriefMock = vi.fn()
const apiGenerateServiceDraftMock = vi.fn()
const apiGenerateServiceProposalDraftMock = vi.fn()
const apiGetDashboardMock = vi.fn()
const apiGetDashboardWorkflowSummaryMock = vi.fn()
const apiGetMessageSummaryMock = vi.fn()
const apiGetReceivedServiceRequestsMock = vi.fn()
const apiUpdateOwnedServiceStatusMock = vi.fn()
const apiUpdateServiceMock = vi.fn()
const apiUpdateServiceRequestStatusMock = vi.fn()
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
  apiCompareProposals: (...args: unknown[]) => apiCompareProposalsMock(...args),
  apiCreateService: (...args: unknown[]) => apiCreateServiceMock(...args),
  apiCreateServiceProposal: (...args: unknown[]) =>
    apiCreateServiceProposalMock(...args),
  apiDeleteService: (...args: unknown[]) => apiDeleteServiceMock(...args),
  apiGenerateAgreementDecisionBrief: (...args: unknown[]) =>
    apiGenerateAgreementDecisionBriefMock(...args),
  apiGenerateServiceDraft: (...args: unknown[]) =>
    apiGenerateServiceDraftMock(...args),
  apiGenerateServiceProposalDraft: (...args: unknown[]) =>
    apiGenerateServiceProposalDraftMock(...args),
  apiGetDashboard: (...args: unknown[]) => apiGetDashboardMock(...args),
  apiGetDashboardWorkflowSummary: (...args: unknown[]) =>
    apiGetDashboardWorkflowSummaryMock(...args),
  apiGetMessageSummary: (...args: unknown[]) => apiGetMessageSummaryMock(...args),
  apiGetReceivedServiceRequests: (...args: unknown[]) =>
    apiGetReceivedServiceRequestsMock(...args),
  apiUpdateOwnedServiceStatus: (...args: unknown[]) =>
    apiUpdateOwnedServiceStatusMock(...args),
  apiUpdateService: (...args: unknown[]) => apiUpdateServiceMock(...args),
  apiUpdateServiceRequestStatus: (...args: unknown[]) =>
    apiUpdateServiceRequestStatusMock(...args),
}))

vi.mock('../../lib/realtime', () => ({
  subscribeToRealtimeEvents: (...args: unknown[]) => subscribeToRealtimeEventsMock(...args),
}))

describe('FreelancerDashboard service workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realtimeHandlers = {}
    subscribeToRealtimeEventsMock.mockImplementation((handlers: typeof realtimeHandlers) => {
      realtimeHandlers = handlers
      return () => undefined
    })

    useAuthMock.mockReturnValue({
      user: {
        id: 'freelancer-1',
        email: 'freelancer@example.com',
        freelancerProfile: {
          firstName: 'Kojo',
          lastName: 'Asante',
          bio: 'Product designer',
          skills: 'Figma, Webflow',
          hourlyRate: 85,
          portfolioUrl: 'https://portfolio.example.com',
        },
      },
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

  it('creates a service through the existing freelancer form and reloads dashboard data', async () => {
    apiGetDashboardMock
      .mockResolvedValueOnce({
        services: [],
        recentMessages: [],
        unreadMessages: 0,
      })
      .mockResolvedValueOnce({
        services: [
          {
            id: 'service-1',
            title: 'Landing Page Design',
            description: 'Responsive product landing page package',
            price: 350,
            deliveryTime: '5 days',
            category: 'Design',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
        ],
        recentMessages: [],
        unreadMessages: 0,
      })

    apiGetReceivedServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    apiCreateServiceMock.mockResolvedValue({
      service: { id: 'service-1' },
    })

    render(
      <MemoryRouter>
        <FreelancerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('No services published yet.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add service/i }))

    fireEvent.change(screen.getByPlaceholderText('Service title'), {
      target: { value: 'Landing Page Design' },
    })
    fireEvent.change(screen.getByPlaceholderText('Price'), {
      target: { value: '350' },
    })
    fireEvent.change(screen.getByPlaceholderText('Delivery time'), {
      target: { value: '5 days' },
    })
    fireEvent.change(screen.getByPlaceholderText('Category'), {
      target: { value: 'Design' },
    })
    fireEvent.change(
      screen.getByPlaceholderText(
        'Describe what you deliver, your process, and expected outcome...',
      ),
      {
        target: { value: 'Responsive product landing page package' },
      },
    )

    fireEvent.click(screen.getByRole('button', { name: /publish service/i }))

    expect(await screen.findByText('Landing Page Design')).toBeInTheDocument()
    expect(apiCreateServiceMock).toHaveBeenCalledWith({
      title: 'Landing Page Design',
      description: 'Responsive product landing page package',
      price: '350',
      deliveryTime: '5 days',
      category: 'Design',
    })
  }, 10000)

  it('generates an AI service draft from the freelancer service form', async () => {
    apiGetDashboardMock.mockResolvedValue({
      services: [],
      recentMessages: [],
      unreadMessages: 0,
    })

    apiGetReceivedServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    apiGenerateServiceDraftMock.mockResolvedValue({
      draft: {
        title: 'Conversion Landing Page Sprint',
        description: 'A focused landing page package for launches, lead capture, and responsive conversion flows with clean handoff assets.',
        price: '420',
        deliveryTime: '6 days',
        category: 'Design',
        positioning: 'Position this as a conversion-focused launch service with a clear scope and handoff.',
        pricingNote: 'The updated rate reflects a tighter launch scope plus responsive delivery assets.',
      },
    })

    render(
      <MemoryRouter>
        <FreelancerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('No services published yet.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add service/i }))

    fireEvent.change(screen.getByPlaceholderText('Service title'), {
      target: { value: 'Landing Page Design' },
    })
    fireEvent.change(screen.getByPlaceholderText('Price'), {
      target: { value: '350' },
    })
    fireEvent.change(screen.getByPlaceholderText('Delivery time'), {
      target: { value: '5 days' },
    })
    fireEvent.change(screen.getByPlaceholderText('Category'), {
      target: { value: 'Design' },
    })
    fireEvent.change(
      screen.getByPlaceholderText(
        'Describe what you deliver, your process, and expected outcome...',
      ),
      {
        target: { value: 'Responsive product landing page package' },
      },
    )

    fireEvent.click(screen.getByRole('button', { name: /generate ai service draft/i }))

    expect(apiGenerateServiceDraftMock).toHaveBeenCalledWith({
      title: 'Landing Page Design',
      description: 'Responsive product landing page package',
      price: '350',
      deliveryTime: '5 days',
      category: 'Design',
      focus: 'Responsive product landing page package',
    })

    expect(await screen.findByDisplayValue('Conversion Landing Page Sprint')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A focused landing page package for launches, lead capture, and responsive conversion flows with clean handoff assets.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('420')).toBeInTheDocument()
    expect(screen.getByDisplayValue('6 days')).toBeInTheDocument()
    expect(screen.getByText('Position this as a conversion-focused launch service with a clear scope and handoff.')).toBeInTheDocument()
    expect(screen.getByText('The updated rate reflects a tighter launch scope plus responsive delivery assets.')).toBeInTheDocument()
  })

  it('sends a service proposal from the existing incoming request card', async () => {
    apiGetDashboardMock
      .mockResolvedValueOnce({
        services: [
          {
            id: 'service-proposal-1',
            title: 'Landing Page Design',
            description: 'Responsive product landing page package',
            price: 350,
            deliveryTime: '5 days',
            category: 'Design',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
        ],
        recentMessages: [],
        unreadMessages: 0,
        pendingProposalActions: 0,
        proposalActionItems: [],
      })
      .mockResolvedValueOnce({
        services: [
          {
            id: 'service-proposal-1',
            title: 'Landing Page Design',
            description: 'Responsive product landing page package',
            price: 350,
            deliveryTime: '5 days',
            category: 'Design',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
          },
        ],
        recentMessages: [],
        unreadMessages: 0,
        pendingProposalActions: 0,
        proposalActionItems: [],
      })

    apiGetReceivedServiceRequestsMock
      .mockResolvedValueOnce({
        requests: [
          {
            id: 'request-proposal-1',
            status: 'PENDING',
            message: 'Need a launch landing page for our campaign.',
            budget: 'GHS 3,000',
            timeline: '2 weeks',
            createdAt: '2026-03-21T00:00:00.000Z',
            agreement: null,
            proposals: [],
            service: {
              id: 'service-proposal-1',
              title: 'Landing Page Design',
              price: 350,
              category: 'Design',
            },
            client: {
              id: 'client-1',
              email: 'client@example.com',
              role: 'EMPLOYER',
              employerProfile: {
                companyName: 'Acme Labs',
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        requests: [
          {
            id: 'request-proposal-1',
            status: 'PENDING',
            message: 'Need a launch landing page for our campaign.',
            budget: 'GHS 3,000',
            timeline: '2 weeks',
            createdAt: '2026-03-21T00:00:00.000Z',
            agreement: null,
            proposals: [
              {
                id: 'service-proposal-1',
                status: 'PENDING',
                title: 'Landing Page Design proposal',
                updatedAt: '2026-03-22T00:00:00.000Z',
                creatorId: 'freelancer-1',
                recipientId: 'client-1',
              },
            ],
            service: {
              id: 'service-proposal-1',
              title: 'Landing Page Design',
              price: 350,
              category: 'Design',
            },
            client: {
              id: 'client-1',
              email: 'client@example.com',
              role: 'EMPLOYER',
              employerProfile: {
                companyName: 'Acme Labs',
              },
            },
          },
        ],
      })

    apiCreateServiceProposalMock.mockResolvedValue({
      proposal: { id: 'proposal-1', status: 'PENDING' },
    })

    render(
      <MemoryRouter>
        <FreelancerDashboard />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('Need a launch landing page for our campaign.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /send proposal/i }))

    fireEvent.change(screen.getByPlaceholderText('Project proposal title'), {
      target: { value: 'Landing Page Design proposal' },
    })
    fireEvent.change(
      screen.getByPlaceholderText('Outline the scope, deliverables, and expectations.'),
      {
        target: { value: 'Design and deliver a conversion-focused launch page with responsive layouts and export assets.' },
      },
    )

    fireEvent.click(screen.getAllByRole('button', { name: /^send proposal$/i }).at(-1)!)

    expect(await screen.findByText('Active Proposal')).toBeInTheDocument()
    expect(apiCreateServiceProposalMock).toHaveBeenCalledWith('request-proposal-1', {
      title: 'Landing Page Design proposal',
      summary: 'Design and deliver a conversion-focused launch page with responsive layouts and export assets.',
      amount: 'GHS 3,000',
      timeline: '2 weeks',
      expiresAt: undefined,
      message: undefined,
    })
  })

  it('generates a proposal draft from the freelancer composer', async () => {
    apiGetDashboardMock.mockResolvedValue({
      services: [
        {
          id: 'service-ai-1',
          title: 'Landing Page Design',
          description: 'Responsive landing page package',
          price: 350,
          deliveryTime: '5 days',
          category: 'Design',
          status: 'ACTIVE',
          createdAt: '2026-03-21T00:00:00.000Z',
        },
      ],
      recentMessages: [],
      unreadMessages: 0,
    })

    apiGetReceivedServiceRequestsMock.mockResolvedValue({
      requests: [
        {
          id: 'request-ai-1',
          status: 'PENDING',
          message: 'Need a launch landing page for our campaign.',
          budget: 'GHS 3,000',
          timeline: '2 weeks',
          createdAt: '2026-03-21T00:00:00.000Z',
          agreement: null,
          proposals: [],
          service: {
            id: 'service-ai-1',
            title: 'Landing Page Design',
            price: 350,
            category: 'Design',
          },
          client: {
            id: 'client-ai-1',
            email: 'client@example.com',
            role: 'EMPLOYER',
            employerProfile: {
              companyName: 'Launch Labs',
            },
          },
        },
      ],
    })

    apiGenerateServiceProposalDraftMock.mockResolvedValue({
      draft: {
        title: 'Landing Page Design proposal',
        summary: 'Design and deliver a campaign landing page with responsive sections, conversion-first layout decisions, and final export assets.',
        amount: 'GHS 3,000',
        timeline: '2 weeks',
        message: 'Open to refining the scope once launch priorities are confirmed.',
      },
    })

    render(
      <MemoryRouter>
        <FreelancerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Need a launch landing page for our campaign.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /send proposal/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate ai draft/i }))

    expect(apiGenerateServiceProposalDraftMock).toHaveBeenCalledWith('request-ai-1', {
      title: 'Landing Page Design proposal',
      amount: 'GHS 3,000',
      timeline: '2 weeks',
      focus: undefined,
    })
    expect(await screen.findByDisplayValue('Landing Page Design proposal')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Design and deliver a campaign landing page with responsive sections, conversion-first layout decisions, and final export assets.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('GHS 3,000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2 weeks')).toBeInTheDocument()
  })

  it('compares proposal terms directly from the freelancer dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      services: [],
      recentMessages: [],
      unreadMessages: 0,
      pendingProposalActions: 2,
      proposalActionItems: [
        {
          id: 'proposal-compare-1',
          type: 'SERVICE',
          status: 'COUNTERED',
          title: 'Launch Design Counter',
          amount: 'GHS 2,800',
          timeline: '12 days',
          counterpartyName: 'Acme Labs',
          updatedAt: '2026-03-23T00:00:00.000Z',
          source: {
            kind: 'SERVICE_REQUEST',
            id: 'request-compare-1',
            title: 'Launch Design Sprint',
            status: 'PENDING',
            agreement: null,
          },
        },
        {
          id: 'proposal-compare-2',
          type: 'SERVICE',
          status: 'PENDING',
          title: 'Brand Refresh Proposal',
          amount: 'GHS 4,200',
          timeline: '3 weeks',
          counterpartyName: 'Beta Commerce',
          updatedAt: '2026-03-22T00:00:00.000Z',
          source: {
            kind: 'SERVICE_REQUEST',
            id: 'request-compare-2',
            title: 'Brand Refresh Sprint',
            status: 'PENDING',
            agreement: null,
          },
        },
      ],
    })

    apiGetReceivedServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    apiCompareProposalsMock.mockResolvedValue({
      comparison: {
        summary:
          'The launch design counter is faster and tighter in scope, while the brand refresh proposal is larger and better suited for a broader delivery window.',
        comparedCount: 2,
        proposals: [
          {
            id: 'proposal-compare-1',
            type: 'SERVICE',
            status: 'COUNTERED',
            title: 'Launch Design Counter',
            amount: 'GHS 2,800',
            timeline: '12 days',
            counterpartyName: 'Acme Labs',
            updatedAt: '2026-03-23T00:00:00.000Z',
            source: {
              kind: 'SERVICE_REQUEST',
              id: 'request-compare-1',
              title: 'Launch Design Sprint',
              status: 'PENDING',
              agreement: null,
            },
          },
          {
            id: 'proposal-compare-2',
            type: 'SERVICE',
            status: 'PENDING',
            title: 'Brand Refresh Proposal',
            amount: 'GHS 4,200',
            timeline: '3 weeks',
            counterpartyName: 'Beta Commerce',
            updatedAt: '2026-03-22T00:00:00.000Z',
            source: {
              kind: 'SERVICE_REQUEST',
              id: 'request-compare-2',
              title: 'Brand Refresh Sprint',
              status: 'PENDING',
              agreement: null,
            },
          },
        ],
      },
    })

    render(
      <MemoryRouter>
        <FreelancerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Proposal Pulse')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Compare Launch Design Counter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare Brand Refresh Proposal' }))
    fireEvent.click(screen.getByRole('button', { name: /generate ai proposal comparison/i }))

    expect(
      await screen.findByText(
        'The launch design counter is faster and tighter in scope, while the brand refresh proposal is larger and better suited for a broader delivery window.',
      ),
    ).toBeInTheDocument()
    expect(apiCompareProposalsMock).toHaveBeenCalledWith([
      'proposal-compare-1',
      'proposal-compare-2',
    ])
    expect(screen.getByText('2 proposals compared')).toBeInTheDocument()
    expect(screen.getAllByText('Acme Labs').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Beta Commerce').length).toBeGreaterThan(0)
  })

  it('compares active agreements directly from the freelancer dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      services: [],
      recentMessages: [],
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
          title: 'QA Pass',
          amount: 'GHS 800',
          status: 'PENDING',
          agreement: {
            id: 'agreement-compare-2',
            title: 'Brand Refresh Retainer',
            type: 'SERVICE',
            updatedAt: '2026-03-23T00:00:00.000Z',
          },
        },
      ],
    })

    apiGetReceivedServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    apiCompareAgreementsMock.mockResolvedValue({
      comparison: {
        summary:
          'The launch design sprint is closer to payout completion, while the brand refresh retainer has a larger remaining workload and more open payout exposure.',
        comparedCount: 2,
        agreements: [
          {
            id: 'agreement-compare-1',
            type: 'SERVICE',
            status: 'ACTIVE',
            title: 'Launch Design Sprint',
            counterpartyName: 'Acme Labs',
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
            type: 'SERVICE',
            status: 'ACTIVE',
            title: 'Brand Refresh Retainer',
            counterpartyName: 'Beta Commerce',
            updatedAt: '2026-03-23T00:00:00.000Z',
            source: {
              kind: 'SERVICE_REQUEST',
              id: 'request-compare-2',
              title: 'Brand Refresh Sprint',
              status: 'ACCEPTED',
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
        <FreelancerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Agreement Pulse')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Compare Launch Design Sprint' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare Brand Refresh Retainer' }))
    fireEvent.click(screen.getByRole('button', { name: /generate ai agreement comparison/i }))

    expect(
      await screen.findByText(
        'The launch design sprint is closer to payout completion, while the brand refresh retainer has a larger remaining workload and more open payout exposure.',
      ),
    ).toBeInTheDocument()
    expect(apiCompareAgreementsMock).toHaveBeenCalledWith([
      'agreement-compare-1',
      'agreement-compare-2',
    ])
    expect(screen.getByText('2 agreements compared')).toBeInTheDocument()
    expect(screen.getAllByText('Acme Labs').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Beta Commerce').length).toBeGreaterThan(0)
    expect(screen.getByText('Active dispute')).toBeInTheDocument()
  })

  it('generates an agreement decision brief directly from the freelancer dashboard', async () => {
    apiGetDashboardMock.mockResolvedValue({
      services: [],
      recentMessages: [],
      unreadMessages: 0,
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

    apiGetReceivedServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    apiGenerateAgreementDecisionBriefMock.mockResolvedValue({
      brief: {
        recommendation: 'HOLD',
        headline: 'Hold completion until the final payout and client sign-off land together.',
        summary:
          'This agreement is nearly done, but the last payout checkpoint and close-out confirmation still need to line up before you close delivery.',
        strengths: ['Most of the delivery work is already complete.'],
        cautions: ['Final payout clearance is still outstanding.'],
        nextAction:
          'Get the final client sign-off and payout confirmation before closing the agreement.',
        suggestedMessage:
          'The work is ready to wrap. Once the last payout and sign-off are confirmed, I can mark the agreement complete.',
      },
    })

    render(
      <MemoryRouter>
        <FreelancerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Launch Design Sprint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Decision brief Launch Design Sprint' }))

    await waitFor(() => {
      expect(apiGenerateAgreementDecisionBriefMock).toHaveBeenCalledWith('agreement-decision-1')
    })

    expect(
      await screen.findByText(
        'Hold completion until the final payout and client sign-off land together.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('HOLD')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Get the final client sign-off and payout confirmation before closing the agreement.',
      ),
    ).toBeInTheDocument()
  })

  it('accepts a service request through the freelancer dashboard and exposes the agreement link', async () => {
    apiGetDashboardMock.mockResolvedValue({
      services: [
        {
          id: 'service-1',
          title: 'Landing Page Design',
          description: 'Responsive product landing page package',
          price: 350,
          deliveryTime: '5 days',
          category: 'Design',
          status: 'ACTIVE',
          createdAt: '2026-03-21T00:00:00.000Z',
        },
      ],
      recentMessages: [],
      unreadMessages: 1,
    })

    apiGetReceivedServiceRequestsMock
      .mockResolvedValueOnce({
        requests: [
          {
            id: 'request-1',
            status: 'PENDING',
            message: 'Need a launch landing page for our campaign.',
            budget: 'GHS 3,000',
            timeline: '2 weeks',
            createdAt: '2026-03-21T00:00:00.000Z',
            agreement: null,
            service: {
              id: 'service-1',
              title: 'Landing Page Design',
              price: 350,
              category: 'Design',
            },
            client: {
              id: 'client-1',
              email: 'client@example.com',
              role: 'EMPLOYER',
              employerProfile: {
                companyName: 'Acme Labs',
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        requests: [
          {
            id: 'request-1',
            status: 'ACCEPTED',
            message: 'Need a launch landing page for our campaign.',
            budget: 'GHS 3,000',
            timeline: '2 weeks',
            createdAt: '2026-03-21T00:00:00.000Z',
            agreement: {
              id: 'agreement-1',
              status: 'ACTIVE',
              updatedAt: '2026-03-21T00:00:00.000Z',
            },
            service: {
              id: 'service-1',
              title: 'Landing Page Design',
              price: 350,
              category: 'Design',
            },
            client: {
              id: 'client-1',
              email: 'client@example.com',
              role: 'EMPLOYER',
              employerProfile: {
                companyName: 'Acme Labs',
              },
            },
          },
        ],
      })

    apiUpdateServiceRequestStatusMock.mockResolvedValue({
      request: { id: 'request-1', status: 'ACCEPTED' },
    })

    render(
      <MemoryRouter>
        <FreelancerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('1 pending')).toBeInTheDocument()

    fireEvent.click((await screen.findAllByRole('button', { name: 'ACCEPTED' }))[0])

    expect((await screen.findAllByText('Agreement')).length).toBeGreaterThan(0)
    expect(apiUpdateServiceRequestStatusMock).toHaveBeenCalledWith(
      'request-1',
      'ACCEPTED',
    )
    expect(screen.getByText('0 pending')).toBeInTheDocument()
    expect(screen.getAllByText('ACCEPTED').length).toBeGreaterThan(0)
  })

  it('shows payout requests in the freelancer payment pulse', async () => {
    apiGetDashboardMock.mockResolvedValue({
      services: [],
      recentMessages: [],
      unreadMessages: 0,
      activeAgreementCount: 1,
      upcomingMilestones: [],
      pendingPaymentActions: 1,
      paymentActionItems: [
        {
          id: 'milestone-req-1',
          title: 'Wireframes',
          amount: 'GHS 1,500',
          status: 'COMPLETED',
          paymentStatus: 'PENDING',
          action: 'REQUEST_PAYMENT',
          counterpartyName: 'Acme Labs',
          agreement: {
            id: 'agreement-req-1',
            title: 'Landing Page Design',
            type: 'SERVICE',
            updatedAt: '2026-03-24T00:00:00.000Z',
          },
        },
      ],
    })

    apiGetReceivedServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    render(
      <MemoryRouter>
        <FreelancerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Payment Pulse')).toBeInTheDocument()
    expect(screen.getByText('REQUEST')).toBeInTheDocument()
    expect(screen.getAllByText(/Acme Labs/).length).toBeGreaterThan(0)
  })

  it('reloads freelancer dashboard action cards when a realtime agreement event arrives', async () => {
    apiGetDashboardMock.mockResolvedValue({
      services: [],
      recentMessages: [],
      unreadMessages: 0,
      pendingPaymentActions: 0,
      paymentActionItems: [],
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
          id: 'milestone-rt-1',
          title: 'Design QA Pass',
          amount: 'GHS 800',
          status: 'COMPLETED',
          paymentStatus: 'PENDING',
          action: 'REQUEST_PAYMENT',
          counterpartyName: 'Acme Labs',
          agreement: {
            id: 'agreement-rt-2',
            title: 'Landing Page Design',
            type: 'SERVICE',
            updatedAt: '2026-03-23T00:00:00.000Z',
          },
        },
      ],
    })

    apiGetReceivedServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    render(
      <MemoryRouter>
        <FreelancerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Payment Pulse')).toBeInTheDocument()
    expect(
      screen.getByText('No milestone payout actions are waiting on you right now.'),
    ).toBeInTheDocument()

    realtimeHandlers.onAgreementsRefresh?.({ agreementId: 'agreement-rt-2' })

    expect(await screen.findByText('Design QA Pass')).toBeInTheDocument()
    expect(screen.getByText('REQUEST')).toBeInTheDocument()
    expect(apiGetDashboardWorkflowSummaryMock).toHaveBeenCalledTimes(1)
    expect(apiGetDashboardMock).toHaveBeenCalledTimes(1)
  })

  it('reloads the freelancer inbox preview when a realtime message event arrives', async () => {
    apiGetDashboardMock.mockResolvedValue({
      services: [],
      recentMessages: [],
      unreadMessages: 0,
    })

    apiGetReceivedServiceRequestsMock.mockResolvedValue({
      requests: [],
    })

    apiGetMessageSummaryMock.mockResolvedValue({
      unreadMessages: 2,
      recentMessages: [
        {
          id: 'conversation-live-1',
          participant: {
            id: 'client-live-1',
            email: 'client@example.com',
          },
          lastMessage: {
            content: 'Need one more revision before launch.',
            createdAt: '2026-03-23T00:00:00.000Z',
          },
          unreadCount: 2,
        },
      ],
    })

    render(
      <MemoryRouter>
        <FreelancerDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('No recent messages yet.')).toBeInTheDocument()

    realtimeHandlers.onMessagesRefresh?.({ conversationId: 'conversation-live-1' })

    expect(await screen.findByText('Need one more revision before launch.')).toBeInTheDocument()
    expect(apiGetMessageSummaryMock).toHaveBeenCalledTimes(1)
    expect(apiGetDashboardMock).toHaveBeenCalledTimes(1)
  })
})
