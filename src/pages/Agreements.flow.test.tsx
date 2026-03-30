import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Agreements from './Agreements'

const useAuthMock = vi.fn()
const apiCompareAgreementsMock = vi.fn()
const apiCreateAgreementDisputeMock = vi.fn()
const apiCreateAgreementMilestoneMock = vi.fn()
const apiCreateAgreementReviewMock = vi.fn()
const apiCreateAgreementMilestonePaymentSessionMock = vi.fn()
const apiGenerateAgreementDecisionBriefMock = vi.fn()
const apiGetMyAgreementsMock = vi.fn()
const apiVerifyAgreementPaymentMock = vi.fn()
const apiUpdateAgreementPaymentStatusMock = vi.fn()
const apiUpdateAgreementMilestonePaymentStatusMock = vi.fn()
const apiUpdateAgreementMilestoneStatusMock = vi.fn()
const apiUpdateAgreementStatusMock = vi.fn()
const subscribeToRealtimeEventsMock = vi.fn()
let realtimeHandlers: Record<string, ((payload?: unknown) => void) | undefined> = {}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../lib/api', () => ({
  apiCompareAgreements: (...args: unknown[]) => apiCompareAgreementsMock(...args),
  apiCreateAgreementDispute: (...args: unknown[]) =>
    apiCreateAgreementDisputeMock(...args),
  apiCreateAgreementMilestone: (...args: unknown[]) =>
    apiCreateAgreementMilestoneMock(...args),
  apiCreateAgreementReview: (...args: unknown[]) =>
    apiCreateAgreementReviewMock(...args),
  apiCreateAgreementMilestonePaymentSession: (...args: unknown[]) =>
    apiCreateAgreementMilestonePaymentSessionMock(...args),
  apiGenerateAgreementDecisionBrief: (...args: unknown[]) =>
    apiGenerateAgreementDecisionBriefMock(...args),
  apiGetMyAgreements: (...args: unknown[]) => apiGetMyAgreementsMock(...args),
  apiVerifyAgreementPayment: (...args: unknown[]) =>
    apiVerifyAgreementPaymentMock(...args),
  apiUpdateAgreementPaymentStatus: (...args: unknown[]) =>
    apiUpdateAgreementPaymentStatusMock(...args),
  apiUpdateAgreementMilestonePaymentStatus: (...args: unknown[]) =>
    apiUpdateAgreementMilestonePaymentStatusMock(...args),
  apiUpdateAgreementMilestoneStatus: (...args: unknown[]) =>
    apiUpdateAgreementMilestoneStatusMock(...args),
  apiUpdateAgreementStatus: (...args: unknown[]) =>
    apiUpdateAgreementStatusMock(...args),
}))

vi.mock('../lib/realtime', () => ({
  subscribeToRealtimeEvents: (...args: unknown[]) => subscribeToRealtimeEventsMock(...args),
}))

describe('Agreements lifecycle flow', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    realtimeHandlers = {}
    subscribeToRealtimeEventsMock.mockImplementation((handlers: typeof realtimeHandlers) => {
      realtimeHandlers = handlers
      return () => undefined
    })

    useAuthMock.mockReturnValue({
      user: {
        id: 'seeker-1',
        email: 'ada@example.com',
      },
    })
  })

  it('loads an active hired agreement and refreshes after completion', async () => {
    apiGetMyAgreementsMock
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-1',
            type: 'JOB',
            title: 'Backend Engineer',
            summary: 'Job agreement for Backend Engineer',
            amount: '$5,000/month',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-21T00:00:00.000Z',
            employer: {
              id: 'employer-1',
              email: 'employer@example.com',
              employerProfile: {
                companyName: 'JobWahala Labs',
              },
            },
            seeker: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            application: {
              id: 'application-2',
              status: 'HIRED',
              job: {
                id: 'job-2',
                title: 'Backend Engineer',
                salary: '$5,000/month',
              },
            },
            milestones: [],
            events: [
              {
                id: 'event-1',
                eventType: 'CREATED',
                message: 'Agreement created after the candidate was hired.',
                toStatus: 'ACTIVE',
                createdAt: '2026-03-21T00:00:00.000Z',
                actor: {
                  id: 'employer-1',
                  email: 'employer@example.com',
                  employerProfile: {
                    companyName: 'JobWahala Labs',
                  },
                },
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-1',
            type: 'JOB',
            title: 'Backend Engineer',
            summary: 'Job agreement for Backend Engineer',
            amount: '$5,000/month',
            status: 'COMPLETED',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-21T00:00:00.000Z',
            employer: {
              id: 'employer-1',
              email: 'employer@example.com',
              employerProfile: {
                companyName: 'JobWahala Labs',
              },
            },
            seeker: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            application: {
              id: 'application-2',
              status: 'COMPLETED',
              job: {
                id: 'job-2',
                title: 'Backend Engineer',
                salary: '$5,000/month',
              },
            },
            milestones: [],
            events: [
              {
                id: 'event-2',
                eventType: 'STATUS_CHANGED',
                message: 'Agreement completed.',
                fromStatus: 'ACTIVE',
                toStatus: 'COMPLETED',
                createdAt: '2026-03-21T00:00:00.000Z',
                actor: {
                  id: 'seeker-1',
                  email: 'ada@example.com',
                  jobSeekerProfile: {
                    firstName: 'Ada',
                    lastName: 'Mensah',
                  },
                },
              },
            ],
          },
        ],
      })

    apiUpdateAgreementStatusMock.mockResolvedValue({
      agreement: { id: 'agreement-1', status: 'COMPLETED' },
    })

    render(
      <MemoryRouter>
        <Agreements />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    expect(screen.getByText('View Source Job')).toBeInTheDocument()
    expect(screen.getByText('Message Counterparty')).toBeInTheDocument()
    expect(
      screen.getByText('Agreement created after the candidate was hired.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /mark completed/i }))

    expect(await screen.findByText('Agreement completed.')).toBeInTheDocument()
    expect(apiUpdateAgreementStatusMock).toHaveBeenCalledWith(
      'agreement-1',
      'COMPLETED',
    )
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThan(0)
  }, 20000)

  it('creates a milestone and updates its status through the agreements page', async () => {
    apiGetMyAgreementsMock
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-2',
            type: 'SERVICE',
            title: 'Landing Page Design',
            summary: 'Design agreement for a launch campaign.',
            amount: 'GHS 3,000',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-21T00:00:00.000Z',
            freelancer: {
              id: 'freelancer-1',
              email: 'freelancer@example.com',
              freelancerProfile: {
                firstName: 'Kojo',
                lastName: 'Asante',
              },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            serviceRequest: {
              id: 'request-1',
              status: 'ACCEPTED',
              service: {
                id: 'service-1',
                title: 'Landing Page Design',
                price: 3000,
                category: 'Design',
              },
            },
            milestones: [],
            events: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-2',
            type: 'SERVICE',
            title: 'Landing Page Design',
            summary: 'Design agreement for a launch campaign.',
            amount: 'GHS 3,000',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-21T00:00:00.000Z',
            freelancer: {
              id: 'freelancer-1',
              email: 'freelancer@example.com',
              freelancerProfile: {
                firstName: 'Kojo',
                lastName: 'Asante',
              },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            serviceRequest: {
              id: 'request-1',
              status: 'ACCEPTED',
              service: {
                id: 'service-1',
                title: 'Landing Page Design',
                price: 3000,
                category: 'Design',
              },
            },
            milestones: [
              {
                id: 'milestone-1',
                title: 'Wireframes',
                description: 'Initial wireframes and layout direction.',
                amount: 'GHS 1,000',
                dueDate: '2026-03-28T00:00:00.000Z',
                status: 'PENDING',
                paymentStatus: 'PENDING',
                paymentRequestedAt: null,
                paidAt: null,
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-21T00:00:00.000Z',
              },
            ],
            events: [
              {
                id: 'event-3',
                eventType: 'MILESTONE_CREATED',
                message: 'Milestone "Wireframes" added to the agreement.',
                toStatus: 'PENDING',
                createdAt: '2026-03-21T00:00:00.000Z',
                actor: {
                  id: 'seeker-1',
                  email: 'ada@example.com',
                  jobSeekerProfile: {
                    firstName: 'Ada',
                    lastName: 'Mensah',
                  },
                },
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-2',
            type: 'SERVICE',
            title: 'Landing Page Design',
            summary: 'Design agreement for a launch campaign.',
            amount: 'GHS 3,000',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-21T00:00:00.000Z',
            freelancer: {
              id: 'freelancer-1',
              email: 'freelancer@example.com',
              freelancerProfile: {
                firstName: 'Kojo',
                lastName: 'Asante',
              },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            serviceRequest: {
              id: 'request-1',
              status: 'ACCEPTED',
              service: {
                id: 'service-1',
                title: 'Landing Page Design',
                price: 3000,
                category: 'Design',
              },
            },
            milestones: [
              {
                id: 'milestone-1',
                title: 'Wireframes',
                description: 'Initial wireframes and layout direction.',
                amount: 'GHS 1,000',
                dueDate: '2026-03-28T00:00:00.000Z',
                status: 'COMPLETED',
                paymentStatus: 'PENDING',
                paymentRequestedAt: null,
                paidAt: null,
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-21T00:00:00.000Z',
              },
            ],
            events: [
              {
                id: 'event-4',
                eventType: 'MILESTONE_STATUS_CHANGED',
                message: 'Milestone "Wireframes" marked as completed.',
                fromStatus: 'PENDING',
                toStatus: 'COMPLETED',
                createdAt: '2026-03-21T00:00:00.000Z',
                actor: {
                  id: 'seeker-1',
                  email: 'ada@example.com',
                  jobSeekerProfile: {
                    firstName: 'Ada',
                    lastName: 'Mensah',
                  },
                },
              },
            ],
          },
        ],
      })

    apiCreateAgreementMilestoneMock.mockResolvedValue({
      milestone: { id: 'milestone-1', status: 'PENDING' },
    })
    apiUpdateAgreementMilestoneStatusMock.mockResolvedValue({
      milestone: { id: 'milestone-1', status: 'COMPLETED' },
    })

    render(
      <MemoryRouter>
        <Agreements />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Landing Page Design')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Milestone title'), {
      target: { value: 'Wireframes' },
    })
    fireEvent.change(screen.getByPlaceholderText('Amount'), {
      target: { value: 'GHS 1,000' },
    })
    fireEvent.change(screen.getByPlaceholderText('Milestone description'), {
      target: { value: 'Initial wireframes and layout direction.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /add milestone/i }))

    expect(await screen.findByText('Wireframes')).toBeInTheDocument()
    expect(apiCreateAgreementMilestoneMock).toHaveBeenCalledWith('agreement-2', {
      title: 'Wireframes',
      description: 'Initial wireframes and layout direction.',
      amount: 'GHS 1,000',
      dueDate: undefined,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))

    expect(await screen.findByText('Milestone "Wireframes" marked as completed.')).toBeInTheDocument()
    expect(apiUpdateAgreementMilestoneStatusMock).toHaveBeenCalledWith(
      'agreement-2',
      'milestone-1',
      'COMPLETED',
    )
  }, 15000)

  it('starts and completes a sandbox payment session for a requested milestone', async () => {
    apiGetMyAgreementsMock
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-3',
            type: 'SERVICE',
            title: 'Launch Campaign Design',
            summary: 'Creative rollout for a product launch.',
            amount: 'GHS 6,000',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-21T00:00:00.000Z',
            freelancer: {
              id: 'freelancer-9',
              email: 'freelancer@example.com',
              freelancerProfile: {
                firstName: 'Kojo',
                lastName: 'Asante',
              },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            milestones: [
              {
                id: 'milestone-9',
                title: 'Final UI Pack',
                description: 'Final visuals and export package.',
                amount: 'GHS 3,000',
                dueDate: '2026-03-30T00:00:00.000Z',
                status: 'COMPLETED',
                paymentStatus: 'REQUESTED',
                paymentRequestedAt: '2026-03-24T00:00:00.000Z',
                paidAt: null,
                payments: [],
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-24T00:00:00.000Z',
              },
            ],
            events: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-3',
            type: 'SERVICE',
            title: 'Launch Campaign Design',
            summary: 'Creative rollout for a product launch.',
            amount: 'GHS 6,000',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-24T06:00:00.000Z',
            freelancer: {
              id: 'freelancer-9',
              email: 'freelancer@example.com',
              freelancerProfile: {
                firstName: 'Kojo',
                lastName: 'Asante',
              },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            milestones: [
              {
                id: 'milestone-9',
                title: 'Final UI Pack',
                description: 'Final visuals and export package.',
                amount: 'GHS 3,000',
                dueDate: '2026-03-30T00:00:00.000Z',
                status: 'COMPLETED',
                paymentStatus: 'REQUESTED',
                paymentRequestedAt: '2026-03-24T00:00:00.000Z',
                paidAt: null,
                payments: [
                  {
                    id: 'payment-1',
                    provider: 'SANDBOX',
                    status: 'PENDING',
                    amount: 'GHS 3,000',
                    reference: 'JW-PAY-TEST1234',
                    checkoutUrl: '/agreements?paymentId=payment-1',
                    failureReason: null,
                    completedAt: null,
                    createdAt: '2026-03-24T06:00:00.000Z',
                    updatedAt: '2026-03-24T06:00:00.000Z',
                    payerId: 'seeker-1',
                    payeeId: 'freelancer-9',
                  },
                ],
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-24T06:00:00.000Z',
              },
            ],
            events: [
              {
                id: 'event-started',
                eventType: 'MILESTONE_PAYMENT_STARTED',
                message: 'Sandbox payment session opened for milestone "Final UI Pack".',
                fromStatus: 'REQUESTED',
                toStatus: 'PENDING',
                createdAt: '2026-03-24T06:00:00.000Z',
                actor: {
                  id: 'seeker-1',
                  email: 'ada@example.com',
                  jobSeekerProfile: {
                    firstName: 'Ada',
                    lastName: 'Mensah',
                  },
                },
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-3',
            type: 'SERVICE',
            title: 'Launch Campaign Design',
            summary: 'Creative rollout for a product launch.',
            amount: 'GHS 6,000',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-25T00:00:00.000Z',
            freelancer: {
              id: 'freelancer-9',
              email: 'freelancer@example.com',
              freelancerProfile: {
                firstName: 'Kojo',
                lastName: 'Asante',
              },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            milestones: [
              {
                id: 'milestone-9',
                title: 'Final UI Pack',
                description: 'Final visuals and export package.',
                amount: 'GHS 3,000',
                dueDate: '2026-03-30T00:00:00.000Z',
                status: 'COMPLETED',
                paymentStatus: 'PAID',
                paymentRequestedAt: '2026-03-24T00:00:00.000Z',
                paidAt: '2026-03-25T00:00:00.000Z',
                payments: [
                  {
                    id: 'payment-1',
                    provider: 'SANDBOX',
                    status: 'SUCCEEDED',
                    amount: 'GHS 3,000',
                    reference: 'JW-PAY-TEST1234',
                    checkoutUrl: '/agreements?paymentId=payment-1',
                    failureReason: null,
                    completedAt: '2026-03-25T00:00:00.000Z',
                    createdAt: '2026-03-24T06:00:00.000Z',
                    updatedAt: '2026-03-25T00:00:00.000Z',
                    payerId: 'seeker-1',
                    payeeId: 'freelancer-9',
                  },
                ],
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-25T00:00:00.000Z',
              },
            ],
            events: [
              {
                id: 'event-paid',
                eventType: 'MILESTONE_PAYMENT_MARKED_PAID',
                message: 'Milestone "Final UI Pack" marked as paid.',
                fromStatus: 'REQUESTED',
                toStatus: 'PAID',
                createdAt: '2026-03-25T00:00:00.000Z',
                actor: {
                  id: 'seeker-1',
                  email: 'ada@example.com',
                  jobSeekerProfile: {
                    firstName: 'Ada',
                    lastName: 'Mensah',
                  },
                },
              },
            ],
          },
        ],
      })

    apiCreateAgreementMilestonePaymentSessionMock.mockResolvedValue({
      payment: { id: 'payment-1', status: 'PENDING' },
    })
    apiUpdateAgreementPaymentStatusMock.mockResolvedValue({
      payment: { id: 'payment-1', status: 'SUCCEEDED' },
      milestone: { id: 'milestone-9', paymentStatus: 'PAID' },
    })

    render(
      <MemoryRouter>
        <Agreements />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Final UI Pack')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /start payment/i }))

    expect(await screen.findByText('JW-PAY-TEST1234')).toBeInTheDocument()
    expect(apiCreateAgreementMilestonePaymentSessionMock).toHaveBeenCalledWith(
      'agreement-3',
      'milestone-9',
    )

    fireEvent.click(screen.getByRole('button', { name: /complete sandbox payment/i }))

    expect(await screen.findByText('Milestone "Final UI Pack" marked as paid.')).toBeInTheDocument()
    expect(apiUpdateAgreementPaymentStatusMock).toHaveBeenCalledWith(
      'agreement-3',
      'payment-1',
      'SUCCEEDED',
    )
  })

  it('auto-verifies a Paystack callback when the agreements page opens with payment params', async () => {
    apiGetMyAgreementsMock
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-4',
            type: 'SERVICE',
            title: 'Checkout Flow',
            summary: 'Provider-backed payment flow.',
            amount: 'GHS 4,000',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-24T00:00:00.000Z',
            freelancer: {
              id: 'freelancer-4',
              email: 'freelancer@example.com',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Asante' },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
            milestones: [
              {
                id: 'milestone-4',
                title: 'Checkout Milestone',
                amount: 'GHS 2,000',
                status: 'COMPLETED',
                paymentStatus: 'REQUESTED',
                paymentRequestedAt: '2026-03-24T00:00:00.000Z',
                paidAt: null,
                payments: [
                  {
                    id: 'payment-4',
                    provider: 'PAYSTACK',
                    status: 'PENDING',
                    amount: 'GHS 2,000',
                    currency: 'GHS',
                    providerAmount: 200000,
                    reference: 'JW-PAY-PAYSTACK4',
                    checkoutUrl: 'https://checkout.paystack.com/test',
                    failureReason: null,
                    completedAt: null,
                    createdAt: '2026-03-24T00:00:00.000Z',
                    updatedAt: '2026-03-24T00:00:00.000Z',
                    payerId: 'seeker-1',
                    payeeId: 'freelancer-4',
                  },
                ],
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-24T00:00:00.000Z',
              },
            ],
            events: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-4',
            type: 'SERVICE',
            title: 'Checkout Flow',
            summary: 'Provider-backed payment flow.',
            amount: 'GHS 4,000',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-24T01:00:00.000Z',
            freelancer: {
              id: 'freelancer-4',
              email: 'freelancer@example.com',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Asante' },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
            milestones: [
              {
                id: 'milestone-4',
                title: 'Checkout Milestone',
                amount: 'GHS 2,000',
                status: 'COMPLETED',
                paymentStatus: 'PAID',
                paymentRequestedAt: '2026-03-24T00:00:00.000Z',
                paidAt: '2026-03-24T01:00:00.000Z',
                payments: [
                  {
                    id: 'payment-4',
                    provider: 'PAYSTACK',
                    status: 'SUCCEEDED',
                    amount: 'GHS 2,000',
                    currency: 'GHS',
                    providerAmount: 200000,
                    reference: 'JW-PAY-PAYSTACK4',
                    checkoutUrl: 'https://checkout.paystack.com/test',
                    failureReason: null,
                    completedAt: '2026-03-24T01:00:00.000Z',
                    createdAt: '2026-03-24T00:00:00.000Z',
                    updatedAt: '2026-03-24T01:00:00.000Z',
                    payerId: 'seeker-1',
                    payeeId: 'freelancer-4',
                  },
                ],
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-24T01:00:00.000Z',
              },
            ],
            events: [
              {
                id: 'event-verified',
                eventType: 'MILESTONE_PAYMENT_MARKED_PAID',
                message: 'Milestone "Checkout Milestone" marked as paid.',
                fromStatus: 'REQUESTED',
                toStatus: 'PAID',
                createdAt: '2026-03-24T01:00:00.000Z',
                actor: {
                  id: 'seeker-1',
                  email: 'ada@example.com',
                  jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
                },
              },
            ],
          },
        ],
      })

    apiVerifyAgreementPaymentMock.mockResolvedValue({
      payment: { id: 'payment-4', status: 'SUCCEEDED' },
      verificationStatus: 'SUCCEEDED',
    })

    render(
      <MemoryRouter initialEntries={['/agreements?agreementId=agreement-4&paymentId=payment-4&provider=PAYSTACK']}>
        <Agreements />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Milestone "Checkout Milestone" marked as paid.')).toBeInTheDocument()
    expect(apiVerifyAgreementPaymentMock).toHaveBeenCalledWith('agreement-4', 'payment-4')
  })

  it('submits a review for a completed agreement and reloads the trust ledger', async () => {
    apiGetMyAgreementsMock
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-review-1',
            type: 'SERVICE',
            title: 'Launch Site Build',
            summary: 'Completed launch build.',
            amount: 'GHS 6,000',
            status: 'COMPLETED',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-25T00:00:00.000Z',
            freelancer: {
              id: 'freelancer-7',
              email: 'freelancer@example.com',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Asante' },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
            milestones: [],
            events: [],
            reviews: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-review-1',
            type: 'SERVICE',
            title: 'Launch Site Build',
            summary: 'Completed launch build.',
            amount: 'GHS 6,000',
            status: 'COMPLETED',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-25T00:00:00.000Z',
            freelancer: {
              id: 'freelancer-7',
              email: 'freelancer@example.com',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Asante' },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
            milestones: [],
            events: [],
            reviews: [
              {
                id: 'review-1',
                rating: 5,
                comment: 'Clear communication and strong delivery quality.',
                createdAt: '2026-03-25T01:00:00.000Z',
                reviewer: {
                  id: 'seeker-1',
                  email: 'ada@example.com',
                  jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
                },
                reviewee: {
                  id: 'freelancer-7',
                  email: 'freelancer@example.com',
                  freelancerProfile: { firstName: 'Kojo', lastName: 'Asante' },
                },
              },
            ],
          },
        ],
      })

    apiCreateAgreementReviewMock.mockResolvedValue({
      review: {
        id: 'review-1',
        rating: 5,
      },
    })

    render(
      <MemoryRouter>
        <Agreements />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Launch Site Build')).toBeInTheDocument()
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '5' } })
    fireEvent.change(screen.getByPlaceholderText(/what stood out about working with kojo asante/i), {
      target: { value: 'Clear communication and strong delivery quality.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit review/i }))

    expect(apiCreateAgreementReviewMock).toHaveBeenCalledWith('agreement-review-1', {
      rating: 5,
      comment: 'Clear communication and strong delivery quality.',
    })
    expect(await screen.findByText('Your review has already been recorded for this agreement.')).toBeInTheDocument()
    expect(screen.getAllByText('5/5 stars').length).toBeGreaterThan(0)
  })

  it('opens a dispute and reloads the dispute desk for an active agreement', async () => {
    apiGetMyAgreementsMock
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-dispute-1',
            type: 'SERVICE',
            title: 'Campaign Landing Page',
            summary: 'Build and deliver a launch landing page.',
            amount: 'GHS 3,500',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-25T00:00:00.000Z',
            freelancer: {
              id: 'freelancer-2',
              email: 'freelancer@example.com',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Asante' },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
            milestones: [],
            events: [],
            reviews: [],
            disputes: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-dispute-1',
            type: 'SERVICE',
            title: 'Campaign Landing Page',
            summary: 'Build and deliver a launch landing page.',
            amount: 'GHS 3,500',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-25T01:00:00.000Z',
            freelancer: {
              id: 'freelancer-2',
              email: 'freelancer@example.com',
              freelancerProfile: { firstName: 'Kojo', lastName: 'Asante' },
            },
            client: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
            milestones: [],
            events: [
              {
                id: 'event-dispute',
                eventType: 'DISPUTE_OPENED',
                message: 'Dispute opened: Final asset delivery.',
                toStatus: 'OPEN',
                createdAt: '2026-03-25T01:00:00.000Z',
                actor: {
                  id: 'seeker-1',
                  email: 'ada@example.com',
                  jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
                },
              },
            ],
            reviews: [],
            disputes: [
              {
                id: 'dispute-1',
                type: 'DELIVERY',
                status: 'OPEN',
                title: 'Final asset delivery',
                description: 'The final packaged assets did not include the approved export set.',
                evidenceUrl: 'https://evidence.example.com/dispute-1',
                createdAt: '2026-03-25T01:00:00.000Z',
                updatedAt: '2026-03-25T01:00:00.000Z',
                creator: {
                  id: 'seeker-1',
                  email: 'ada@example.com',
                  jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
                },
                counterparty: {
                  id: 'freelancer-2',
                  email: 'freelancer@example.com',
                  freelancerProfile: { firstName: 'Kojo', lastName: 'Asante' },
                },
              },
            ],
          },
        ],
      })

    apiCreateAgreementDisputeMock.mockResolvedValue({
      dispute: { id: 'dispute-1', status: 'OPEN' },
    })

    render(
      <MemoryRouter>
        <Agreements />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Campaign Landing Page')).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue('DELIVERY'), {
      target: { value: 'QUALITY' },
    })
    fireEvent.change(screen.getByPlaceholderText('Dispute title'), {
      target: { value: 'Final asset delivery' },
    })
    fireEvent.change(screen.getByPlaceholderText('Describe the issue and what needs review'), {
      target: { value: 'The final packaged assets did not include the approved export set.' },
    })
    fireEvent.change(screen.getByPlaceholderText('Evidence link (optional)'), {
      target: { value: 'https://evidence.example.com/dispute-1' },
    })

    fireEvent.click(screen.getByRole('button', { name: /submit dispute/i }))

    expect(apiCreateAgreementDisputeMock).toHaveBeenCalledWith('agreement-dispute-1', {
      type: 'QUALITY',
      title: 'Final asset delivery',
      description: 'The final packaged assets did not include the approved export set.',
      evidenceUrl: 'https://evidence.example.com/dispute-1',
    })
    expect(await screen.findByText('This agreement already has an active dispute. Admin must resolve it before another case can be opened or the agreement can be closed.')).toBeInTheDocument()
    expect(screen.getAllByText('OPEN').length).toBeGreaterThan(0)
  })

  it('reloads the agreement desk when a realtime agreement event arrives', async () => {
    apiGetMyAgreementsMock
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-live-1',
            type: 'JOB',
            title: 'Realtime Agreement',
            summary: 'Initial agreement state.',
            amount: '$4,200',
            status: 'ACTIVE',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-22T00:00:00.000Z',
            employer: {
              id: 'employer-live-1',
              email: 'employer@example.com',
              employerProfile: { companyName: 'JobWahala Labs' },
            },
            seeker: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
            milestones: [],
            events: [],
            reviews: [],
            disputes: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        agreements: [
          {
            id: 'agreement-live-1',
            type: 'JOB',
            title: 'Realtime Agreement',
            summary: 'Initial agreement state.',
            amount: '$4,200',
            status: 'COMPLETED',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-23T00:00:00.000Z',
            employer: {
              id: 'employer-live-1',
              email: 'employer@example.com',
              employerProfile: { companyName: 'JobWahala Labs' },
            },
            seeker: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
            milestones: [],
            events: [
              {
                id: 'event-live-1',
                eventType: 'STATUS_CHANGED',
                message: 'Agreement completed in another session.',
                fromStatus: 'ACTIVE',
                toStatus: 'COMPLETED',
                createdAt: '2026-03-23T00:00:00.000Z',
                actor: {
                  id: 'employer-live-1',
                  email: 'employer@example.com',
                  employerProfile: { companyName: 'JobWahala Labs' },
                },
              },
            ],
            reviews: [],
            disputes: [],
          },
        ],
      })

    render(
      <MemoryRouter>
        <Agreements />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Realtime Agreement')).toBeInTheDocument()

    realtimeHandlers.onAgreementsRefresh?.({
      agreementId: 'agreement-live-1',
      reason: 'status_changed',
    })

    await waitFor(() => {
      expect(screen.getByText('Agreement completed in another session.')).toBeInTheDocument()
    })
    expect(apiGetMyAgreementsMock).toHaveBeenCalledTimes(2)
  })

  it('compares selected agreements and renders the AI comparison brief', async () => {
    apiGetMyAgreementsMock.mockResolvedValue({
      agreements: [
        {
          id: 'agreement-compare-1',
          type: 'JOB',
          title: 'Frontend Platform Role',
          summary: 'Own the shared frontend platform and release quality.',
          amount: '$6,200',
          status: 'ACTIVE',
          createdAt: '2026-03-21T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
          employer: {
            id: 'employer-1',
            email: 'employer@example.com',
            employerProfile: { companyName: 'JobWahala Labs' },
          },
          seeker: {
            id: 'seeker-1',
            email: 'ada@example.com',
            jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
          },
          application: {
            id: 'application-compare-1',
            status: 'HIRED',
            job: {
              id: 'job-compare-1',
              title: 'Frontend Platform Engineer',
              salary: '$6,200',
            },
          },
          milestones: [
            {
              id: 'milestone-compare-1',
              title: 'Onboarding',
              status: 'COMPLETED',
              paymentStatus: 'PAID',
              amount: '$2,000',
              createdAt: '2026-03-21T00:00:00.000Z',
              updatedAt: '2026-03-22T00:00:00.000Z',
            },
            {
              id: 'milestone-compare-2',
              title: 'Platform Sprint',
              status: 'IN_PROGRESS',
              paymentStatus: 'PENDING',
              amount: '$4,200',
              createdAt: '2026-03-22T00:00:00.000Z',
              updatedAt: '2026-03-25T00:00:00.000Z',
            },
          ],
          events: [],
          reviews: [],
          disputes: [],
        },
        {
          id: 'agreement-compare-2',
          type: 'SERVICE',
          title: 'Launch Design Sprint',
          summary: 'Delivery of final launch assets and mobile states.',
          amount: 'GHS 3,000',
          status: 'ACTIVE',
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
          freelancer: {
            id: 'freelancer-2',
            email: 'freelancer@example.com',
            freelancerProfile: { firstName: 'Kojo', lastName: 'Asante' },
          },
          client: {
            id: 'seeker-1',
            email: 'ada@example.com',
            jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
          },
          serviceRequest: {
            id: 'request-compare-1',
            status: 'ACCEPTED',
            service: {
              id: 'service-compare-1',
              title: 'Launch Design Sprint',
              price: 3000,
              category: 'Design',
            },
          },
          milestones: [
            {
              id: 'milestone-service-1',
              title: 'Wireframes',
              status: 'COMPLETED',
              paymentStatus: 'PAID',
              amount: 'GHS 1,000',
              createdAt: '2026-03-20T00:00:00.000Z',
              updatedAt: '2026-03-21T00:00:00.000Z',
            },
            {
              id: 'milestone-service-2',
              title: 'Final Assets',
              status: 'COMPLETED',
              paymentStatus: 'REQUESTED',
              amount: 'GHS 2,000',
              createdAt: '2026-03-21T00:00:00.000Z',
              updatedAt: '2026-03-25T00:00:00.000Z',
            },
          ],
          events: [],
          reviews: [],
          disputes: [
            {
              id: 'dispute-service-1',
              type: 'PAYMENT',
              status: 'UNDER_REVIEW',
              title: 'Payout timing',
              description: 'Awaiting admin review.',
              createdAt: '2026-03-25T00:00:00.000Z',
              updatedAt: '2026-03-25T00:00:00.000Z',
            },
          ],
        },
      ],
    })

    apiCompareAgreementsMock.mockResolvedValue({
      comparison: {
        summary:
          'The platform role has less delivery risk right now, while the design sprint is further along but still carrying an unresolved payout action and dispute review.',
        comparedCount: 2,
        agreements: [
          {
            id: 'agreement-compare-1',
            type: 'JOB',
            status: 'ACTIVE',
            title: 'Frontend Platform Role',
            summary: 'Own the shared frontend platform and release quality.',
            amount: '$6,200',
            updatedAt: '2026-03-25T00:00:00.000Z',
            counterpartyName: 'JobWahala Labs',
            source: {
              kind: 'APPLICATION',
              id: 'application-compare-1',
              title: 'Frontend Platform Engineer',
              status: 'HIRED',
            },
            milestoneCount: 2,
            completedMilestones: 1,
            outstandingPayments: 1,
            hasActiveDispute: false,
          },
          {
            id: 'agreement-compare-2',
            type: 'SERVICE',
            status: 'ACTIVE',
            title: 'Launch Design Sprint',
            summary: 'Delivery of final launch assets and mobile states.',
            amount: 'GHS 3,000',
            updatedAt: '2026-03-25T00:00:00.000Z',
            counterpartyName: 'Kojo Asante',
            source: {
              kind: 'SERVICE_REQUEST',
              id: 'request-compare-1',
              title: 'Launch Design Sprint',
              status: 'ACCEPTED',
            },
            milestoneCount: 2,
            completedMilestones: 2,
            outstandingPayments: 1,
            hasActiveDispute: true,
          },
        ],
      },
    })

    render(
      <MemoryRouter>
        <Agreements />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Frontend Platform Role')).toBeInTheDocument()
    expect(screen.getByText('Launch Design Sprint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Compare Frontend Platform Role' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare Launch Design Sprint' }))
    fireEvent.click(screen.getByRole('button', { name: /generate ai comparison/i }))

    await waitFor(() => {
      expect(apiCompareAgreementsMock).toHaveBeenCalledWith([
        'agreement-compare-1',
        'agreement-compare-2',
      ])
    })

    expect(
      await screen.findByText(
        'The platform role has less delivery risk right now, while the design sprint is further along but still carrying an unresolved payout action and dispute review.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('2 agreements compared')).toBeInTheDocument()
    expect(screen.getAllByText('JobWahala Labs').length).toBeGreaterThan(0)
    expect(screen.getByText('Dispute Active')).toBeInTheDocument()
  })

  it('generates an AI decision brief for an active agreement', async () => {
    apiGetMyAgreementsMock.mockResolvedValue({
      agreements: [
        {
          id: 'agreement-decision-1',
          type: 'SERVICE',
          title: 'Launch Design Sprint',
          summary: 'Delivery of final launch assets and mobile states.',
          amount: 'GHS 3,000',
          status: 'ACTIVE',
          createdAt: '2026-03-21T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
          freelancer: {
            id: 'freelancer-1',
            email: 'freelancer@example.com',
            freelancerProfile: {
              firstName: 'Kojo',
              lastName: 'Asante',
            },
          },
          client: {
            id: 'seeker-1',
            email: 'ada@example.com',
            jobSeekerProfile: {
              firstName: 'Ada',
              lastName: 'Mensah',
            },
          },
          serviceRequest: {
            id: 'request-decision-1',
            status: 'ACCEPTED',
            service: {
              id: 'service-decision-1',
              title: 'Launch Design Sprint',
              price: 3000,
              category: 'Design',
            },
          },
          milestones: [
            {
              id: 'milestone-decision-1',
              title: 'Wireframes',
              status: 'COMPLETED',
              paymentStatus: 'PAID',
              amount: 'GHS 1,000',
              createdAt: '2026-03-20T00:00:00.000Z',
              updatedAt: '2026-03-21T00:00:00.000Z',
            },
            {
              id: 'milestone-decision-2',
              title: 'Final Assets',
              status: 'COMPLETED',
              paymentStatus: 'REQUESTED',
              amount: 'GHS 2,000',
              createdAt: '2026-03-21T00:00:00.000Z',
              updatedAt: '2026-03-25T00:00:00.000Z',
            },
          ],
          events: [],
          reviews: [],
          disputes: [],
        },
      ],
    })

    apiGenerateAgreementDecisionBriefMock.mockResolvedValue({
      brief: {
        recommendation: 'HOLD',
        headline: 'Hold the agreement open until the remaining steps clear.',
        summary:
          'The work is largely complete, but one requested payout still needs to clear before the agreement should be closed.',
        strengths: [
          'All visible milestone delivery is complete.',
          'The agreement amount is clearly recorded.',
        ],
        cautions: [
          'One payout request still needs a final payment response.',
        ],
        nextAction:
          'Review the requested payout and clear the payment action if the milestone is ready.',
        suggestedMessage:
          'I want to keep this agreement active until we clear the remaining payout step on Launch Design Sprint.',
      },
    })

    render(
      <MemoryRouter>
        <Agreements />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Launch Design Sprint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /generate ai decision brief/i }))

    await waitFor(() => {
      expect(apiGenerateAgreementDecisionBriefMock).toHaveBeenCalledWith('agreement-decision-1')
    })

    expect(
      await screen.findByText('Hold the agreement open until the remaining steps clear.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('HOLD').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Review the requested payout and clear the payment action if the milestone is ready.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('I want to keep this agreement active until we clear the remaining payout step on Launch Design Sprint.'),
    ).toBeInTheDocument()
  })
})
