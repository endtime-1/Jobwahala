import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Proposals from './Proposals'

const useAuthMock = vi.fn()
const apiCompareProposalsMock = vi.fn()
const apiCounterProposalMock = vi.fn()
const apiGenerateProposalDecisionBriefMock = vi.fn()
const apiGetMyProposalsMock = vi.fn()
const apiUpdateProposalStatusMock = vi.fn()
const subscribeToRealtimeEventsMock = vi.fn()
let realtimeHandlers: Record<string, ((payload?: unknown) => void) | undefined> = {}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../lib/api', () => ({
  apiCompareProposals: (...args: unknown[]) => apiCompareProposalsMock(...args),
  apiCounterProposal: (...args: unknown[]) => apiCounterProposalMock(...args),
  apiGenerateProposalDecisionBrief: (...args: unknown[]) => apiGenerateProposalDecisionBriefMock(...args),
  apiGetMyProposals: (...args: unknown[]) => apiGetMyProposalsMock(...args),
  apiUpdateProposalStatus: (...args: unknown[]) => apiUpdateProposalStatusMock(...args),
}))

vi.mock('../lib/realtime', () => ({
  subscribeToRealtimeEvents: (...args: unknown[]) => subscribeToRealtimeEventsMock(...args),
}))

describe('Proposals negotiation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('accepts an incoming proposal and reloads the proposal workspace', async () => {
    apiGetMyProposalsMock
      .mockResolvedValueOnce({
        proposals: [
          {
            id: 'proposal-1',
            type: 'JOB',
            status: 'PENDING',
            title: 'Frontend Engineer Offer',
            summary: 'Join the team and own UI delivery.',
            amount: '$5,000',
            timeline: 'Immediate start',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-22T00:00:00.000Z',
            creatorId: 'employer-1',
            recipientId: 'seeker-1',
            creator: {
              id: 'employer-1',
              email: 'employer@example.com',
              employerProfile: {
                companyName: 'JobWahala Labs',
              },
            },
            recipient: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            application: {
              id: 'application-1',
              status: 'SUBMITTED',
              agreement: null,
              job: {
                id: 'job-1',
                title: 'Frontend Engineer',
                salary: '$5,000',
              },
            },
            revisions: [
              {
                id: 'revision-1',
                summary: 'Join the team and own UI delivery.',
                amount: '$5,000',
                timeline: 'Immediate start',
                createdAt: '2026-03-22T00:00:00.000Z',
                authorId: 'employer-1',
                author: {
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
        proposals: [
          {
            id: 'proposal-1',
            type: 'JOB',
            status: 'ACCEPTED',
            title: 'Frontend Engineer Offer',
            summary: 'Join the team and own UI delivery.',
            amount: '$5,000',
            timeline: 'Immediate start',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-22T00:00:00.000Z',
            creatorId: 'employer-1',
            recipientId: 'seeker-1',
            creator: {
              id: 'employer-1',
              email: 'employer@example.com',
              employerProfile: {
                companyName: 'JobWahala Labs',
              },
            },
            recipient: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            application: {
              id: 'application-1',
              status: 'HIRED',
              agreement: {
                id: 'agreement-1',
                status: 'ACTIVE',
                updatedAt: '2026-03-22T00:00:00.000Z',
              },
              job: {
                id: 'job-1',
                title: 'Frontend Engineer',
                salary: '$5,000',
              },
            },
            revisions: [
              {
                id: 'revision-1',
                summary: 'Join the team and own UI delivery.',
                amount: '$5,000',
                timeline: 'Immediate start',
                createdAt: '2026-03-22T00:00:00.000Z',
                authorId: 'employer-1',
                author: {
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

    apiUpdateProposalStatusMock.mockResolvedValue({
      proposal: { id: 'proposal-1', status: 'ACCEPTED' },
    })

    render(
      <MemoryRouter>
        <Proposals />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Frontend Engineer Offer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /accept terms/i }))

    await waitFor(() => {
      expect(apiUpdateProposalStatusMock).toHaveBeenCalledWith('proposal-1', 'ACCEPTED')
      expect(apiGetMyProposalsMock).toHaveBeenCalledTimes(2)
      expect(screen.getAllByText('ACCEPTED').length).toBeGreaterThan(0)
    })
  })

  it('submits a counter proposal and refreshes the revision trail', async () => {
    apiGetMyProposalsMock
      .mockResolvedValueOnce({
        proposals: [
          {
            id: 'proposal-2',
            type: 'SERVICE',
            status: 'PENDING',
            title: 'Landing Page Design Proposal',
            summary: 'Design and deliver a responsive launch landing page.',
            amount: 'GHS 3,000',
            timeline: '2 weeks',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-22T00:00:00.000Z',
            creatorId: 'freelancer-1',
            recipientId: 'seeker-1',
            creator: {
              id: 'freelancer-1',
              email: 'freelancer@example.com',
              freelancerProfile: {
                firstName: 'Kojo',
                lastName: 'Asante',
              },
            },
            recipient: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            serviceRequest: {
              id: 'request-1',
              status: 'PENDING',
              agreement: null,
              service: {
                id: 'service-1',
                title: 'Landing Page Design',
                price: 3000,
              },
            },
            revisions: [
              {
                id: 'revision-service-1',
                summary: 'Design and deliver a responsive launch landing page.',
                amount: 'GHS 3,000',
                timeline: '2 weeks',
                createdAt: '2026-03-22T00:00:00.000Z',
                authorId: 'freelancer-1',
                author: {
                  id: 'freelancer-1',
                  email: 'freelancer@example.com',
                  freelancerProfile: {
                    firstName: 'Kojo',
                    lastName: 'Asante',
                  },
                },
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        proposals: [
          {
            id: 'proposal-2',
            type: 'SERVICE',
            status: 'COUNTERED',
            title: 'Landing Page Design Proposal',
            summary: 'Scope includes launch page, mobile states, and export-ready assets.',
            amount: 'GHS 2,800',
            timeline: '12 days',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-23T00:00:00.000Z',
            creatorId: 'freelancer-1',
            recipientId: 'seeker-1',
            creator: {
              id: 'freelancer-1',
              email: 'freelancer@example.com',
              freelancerProfile: {
                firstName: 'Kojo',
                lastName: 'Asante',
              },
            },
            recipient: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: {
                firstName: 'Ada',
                lastName: 'Mensah',
              },
            },
            serviceRequest: {
              id: 'request-1',
              status: 'PENDING',
              agreement: null,
              service: {
                id: 'service-1',
                title: 'Landing Page Design',
                price: 3000,
              },
            },
            revisions: [
              {
                id: 'revision-service-2',
                summary: 'Scope includes launch page, mobile states, and export-ready assets.',
                amount: 'GHS 2,800',
                timeline: '12 days',
                message: 'Countering with a tighter budget and faster delivery window.',
                createdAt: '2026-03-23T00:00:00.000Z',
                authorId: 'seeker-1',
                author: {
                  id: 'seeker-1',
                  email: 'ada@example.com',
                  jobSeekerProfile: {
                    firstName: 'Ada',
                    lastName: 'Mensah',
                  },
                },
              },
              {
                id: 'revision-service-1',
                summary: 'Design and deliver a responsive launch landing page.',
                amount: 'GHS 3,000',
                timeline: '2 weeks',
                createdAt: '2026-03-22T00:00:00.000Z',
                authorId: 'freelancer-1',
                author: {
                  id: 'freelancer-1',
                  email: 'freelancer@example.com',
                  freelancerProfile: {
                    firstName: 'Kojo',
                    lastName: 'Asante',
                  },
                },
              },
            ],
          },
        ],
      })

    apiCounterProposalMock.mockResolvedValue({
      proposal: { id: 'proposal-2', status: 'COUNTERED' },
    })

    render(
      <MemoryRouter>
        <Proposals />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Landing Page Design Proposal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /counter terms/i }))

    fireEvent.change(screen.getByPlaceholderText('Refine the scope and terms.'), {
      target: { value: 'Scope includes launch page, mobile states, and export-ready assets.' },
    })
    fireEvent.change(screen.getByPlaceholderText('Amount'), {
      target: { value: 'GHS 2,800' },
    })
    fireEvent.change(screen.getByPlaceholderText('Timeline'), {
      target: { value: '12 days' },
    })
    fireEvent.change(screen.getByPlaceholderText('Optional note'), {
      target: { value: 'Countering with a tighter budget and faster delivery window.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /send counter/i }))

    expect(await screen.findByText('2 term updates recorded')).toBeInTheDocument()
    expect(apiCounterProposalMock).toHaveBeenCalledWith('proposal-2', {
      summary: 'Scope includes launch page, mobile states, and export-ready assets.',
      amount: 'GHS 2,800',
      timeline: '12 days',
      expiresAt: undefined,
      message: 'Countering with a tighter budget and faster delivery window.',
    })
    expect(screen.getAllByText('COUNTERED').length).toBeGreaterThan(0)
  })

  it('reloads the proposal workspace when a realtime refresh event arrives', async () => {
    apiGetMyProposalsMock
      .mockResolvedValueOnce({
        proposals: [
          {
            id: 'proposal-live-1',
            type: 'JOB',
            status: 'PENDING',
            title: 'Realtime Offer',
            summary: 'Initial terms.',
            amount: '$4,000',
            timeline: 'ASAP',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-22T00:00:00.000Z',
            creatorId: 'employer-1',
            recipientId: 'seeker-1',
            creator: {
              id: 'employer-1',
              email: 'employer@example.com',
              employerProfile: { companyName: 'JobWahala Labs' },
            },
            recipient: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
            application: {
              id: 'application-live-1',
              status: 'SUBMITTED',
              agreement: null,
              job: {
                id: 'job-live-1',
                title: 'Realtime Role',
                salary: '$4,000',
              },
            },
            revisions: [
              {
                id: 'revision-live-1',
                summary: 'Initial terms.',
                amount: '$4,000',
                timeline: 'ASAP',
                createdAt: '2026-03-22T00:00:00.000Z',
                authorId: 'employer-1',
                author: {
                  id: 'employer-1',
                  email: 'employer@example.com',
                  employerProfile: { companyName: 'JobWahala Labs' },
                },
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        proposals: [
          {
            id: 'proposal-live-1',
            type: 'JOB',
            status: 'ACCEPTED',
            title: 'Realtime Offer',
            summary: 'Initial terms.',
            amount: '$4,000',
            timeline: 'ASAP',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-23T00:00:00.000Z',
            creatorId: 'employer-1',
            recipientId: 'seeker-1',
            creator: {
              id: 'employer-1',
              email: 'employer@example.com',
              employerProfile: { companyName: 'JobWahala Labs' },
            },
            recipient: {
              id: 'seeker-1',
              email: 'ada@example.com',
              jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
            },
            application: {
              id: 'application-live-1',
              status: 'HIRED',
              agreement: {
                id: 'agreement-live-1',
                status: 'ACTIVE',
                updatedAt: '2026-03-23T00:00:00.000Z',
              },
              job: {
                id: 'job-live-1',
                title: 'Realtime Role',
                salary: '$4,000',
              },
            },
            revisions: [
              {
                id: 'revision-live-1',
                summary: 'Initial terms.',
                amount: '$4,000',
                timeline: 'ASAP',
                createdAt: '2026-03-22T00:00:00.000Z',
                authorId: 'employer-1',
                author: {
                  id: 'employer-1',
                  email: 'employer@example.com',
                  employerProfile: { companyName: 'JobWahala Labs' },
                },
              },
            ],
          },
        ],
      })

    render(
      <MemoryRouter>
        <Proposals />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Realtime Offer')).toBeInTheDocument()

    realtimeHandlers.onProposalsRefresh?.({
      proposalId: 'proposal-live-1',
      reason: 'accepted',
    })

    await waitFor(() => {
      expect(screen.getAllByText('ACCEPTED').length).toBeGreaterThan(0)
    })
    expect(apiGetMyProposalsMock).toHaveBeenCalledTimes(2)
  })

  it('compares selected proposals and renders the AI comparison brief', async () => {
    apiGetMyProposalsMock.mockResolvedValue({
      proposals: [
        {
          id: 'proposal-compare-1',
          type: 'JOB',
          status: 'PENDING',
          title: 'Frontend Engineer Offer',
          summary: 'Lead the UI roadmap and ship weekly React releases.',
          amount: '$5,000',
          timeline: 'Immediate start',
          createdAt: '2026-03-21T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z',
          creatorId: 'employer-1',
          recipientId: 'seeker-1',
          creator: {
            id: 'employer-1',
            email: 'employer@example.com',
            employerProfile: { companyName: 'JobWahala Labs' },
          },
          recipient: {
            id: 'seeker-1',
            email: 'ada@example.com',
            jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
          },
          application: {
            id: 'application-compare-1',
            status: 'INTERVIEW',
            agreement: null,
            job: {
              id: 'job-compare-1',
              title: 'Frontend Engineer',
              salary: '$5,000',
            },
          },
          revisions: [
            {
              id: 'revision-compare-1',
              summary: 'Lead the UI roadmap and ship weekly React releases.',
              amount: '$5,000',
              timeline: 'Immediate start',
              createdAt: '2026-03-22T00:00:00.000Z',
              authorId: 'employer-1',
              author: {
                id: 'employer-1',
                email: 'employer@example.com',
                employerProfile: { companyName: 'JobWahala Labs' },
              },
            },
          ],
        },
        {
          id: 'proposal-compare-2',
          type: 'SERVICE',
          status: 'COUNTERED',
          title: 'Product Launch Design Proposal',
          summary: 'Launch design sprint with mobile screens and export-ready assets.',
          amount: 'GHS 2,800',
          timeline: '12 days',
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-03-23T00:00:00.000Z',
          creatorId: 'freelancer-1',
          recipientId: 'seeker-1',
          creator: {
            id: 'freelancer-1',
            email: 'freelancer@example.com',
            freelancerProfile: { firstName: 'Kojo', lastName: 'Asante' },
          },
          recipient: {
            id: 'seeker-1',
            email: 'ada@example.com',
            jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
          },
          serviceRequest: {
            id: 'request-compare-1',
            status: 'PENDING',
            agreement: null,
            service: {
              id: 'service-compare-1',
              title: 'Launch Design Sprint',
              price: 2800,
            },
          },
          revisions: [
            {
              id: 'revision-compare-2',
              summary: 'Launch design sprint with mobile screens and export-ready assets.',
              amount: 'GHS 2,800',
              timeline: '12 days',
              createdAt: '2026-03-23T00:00:00.000Z',
              authorId: 'freelancer-1',
              author: {
                id: 'freelancer-1',
                email: 'freelancer@example.com',
                freelancerProfile: { firstName: 'Kojo', lastName: 'Asante' },
              },
            },
          ],
        },
      ],
    })

    apiCompareProposalsMock.mockResolvedValue({
      comparison: {
        summary:
          'The engineering offer is stronger on long-term product ownership, while the design proposal is faster and more fixed-scope for a short launch window.',
        comparedCount: 2,
        proposals: [
          {
            id: 'proposal-compare-1',
            type: 'JOB',
            status: 'PENDING',
            title: 'Frontend Engineer Offer',
            summary: 'Lead the UI roadmap and ship weekly React releases.',
            amount: '$5,000',
            timeline: 'Immediate start',
            updatedAt: '2026-03-22T00:00:00.000Z',
            counterpartyName: 'JobWahala Labs',
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
            title: 'Product Launch Design Proposal',
            summary: 'Launch design sprint with mobile screens and export-ready assets.',
            amount: 'GHS 2,800',
            timeline: '12 days',
            updatedAt: '2026-03-23T00:00:00.000Z',
            counterpartyName: 'Kojo Asante',
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
        <Proposals />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Frontend Engineer Offer')).toBeInTheDocument()
    expect(screen.getByText('Product Launch Design Proposal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Compare Frontend Engineer Offer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare Product Launch Design Proposal' }))
    fireEvent.click(screen.getByRole('button', { name: /generate ai comparison/i }))

    await waitFor(() => {
      expect(apiCompareProposalsMock).toHaveBeenCalledWith([
        'proposal-compare-1',
        'proposal-compare-2',
      ])
    })

    expect(
      await screen.findByText(
        'The engineering offer is stronger on long-term product ownership, while the design proposal is faster and more fixed-scope for a short launch window.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('2 proposals compared')).toBeInTheDocument()
    expect(screen.getAllByText('JobWahala Labs').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Kojo Asante').length).toBeGreaterThan(0)
  })

  it('generates an AI decision brief for the current proposal terms', async () => {
    apiGetMyProposalsMock.mockResolvedValue({
      proposals: [
        {
          id: 'proposal-decision-1',
          type: 'JOB',
          status: 'COUNTERED',
          title: 'Senior Product Engineer Offer',
          summary: 'Own the product UI roadmap, improve release quality, and partner with design on conversion flows.',
          amount: '$6,000',
          timeline: 'Start in two weeks',
          createdAt: '2026-03-21T00:00:00.000Z',
          updatedAt: '2026-03-24T00:00:00.000Z',
          creatorId: 'employer-1',
          recipientId: 'seeker-1',
          creator: {
            id: 'employer-1',
            email: 'employer@example.com',
            employerProfile: { companyName: 'JobWahala Labs' },
          },
          recipient: {
            id: 'seeker-1',
            email: 'ada@example.com',
            jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
          },
          application: {
            id: 'application-decision-1',
            status: 'INTERVIEW',
            agreement: null,
            job: {
              id: 'job-decision-1',
              title: 'Senior Product Engineer',
              salary: '$6,200',
            },
          },
          revisions: [
            {
              id: 'revision-decision-2',
              summary: 'Own the product UI roadmap, improve release quality, and partner with design on conversion flows.',
              amount: '$6,000',
              timeline: 'Start in two weeks',
              createdAt: '2026-03-24T00:00:00.000Z',
              authorId: 'employer-1',
              author: {
                id: 'employer-1',
                email: 'employer@example.com',
                employerProfile: { companyName: 'JobWahala Labs' },
              },
            },
            {
              id: 'revision-decision-1',
              summary: 'Own the UI roadmap and release quality.',
              amount: '$5,700',
              timeline: 'Start in three weeks',
              createdAt: '2026-03-22T00:00:00.000Z',
              authorId: 'seeker-1',
              author: {
                id: 'seeker-1',
                email: 'ada@example.com',
                jobSeekerProfile: { firstName: 'Ada', lastName: 'Mensah' },
              },
            },
          ],
        },
      ],
    })

    apiGenerateProposalDecisionBriefMock.mockResolvedValue({
      brief: {
        recommendation: 'COUNTER',
        headline: 'Counter once before you commit.',
        summary:
          'The offer looks close to workable, but compensation still sits a little below the original salary signal for this role.',
        strengths: [
          'The scope is specific and clearly tied to the role.',
          'The timeline is already defined.',
        ],
        cautions: [
          'The amount is slightly below the original salary signal.',
        ],
        suggestedMessage:
          'I am interested in moving forward, but I would like to tighten the compensation slightly before I accept these terms.',
      },
    })

    render(
      <MemoryRouter>
        <Proposals />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Senior Product Engineer Offer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /generate ai decision brief/i }))

    await waitFor(() => {
      expect(apiGenerateProposalDecisionBriefMock).toHaveBeenCalledWith('proposal-decision-1')
    })

    expect(await screen.findByText('Counter once before you commit.')).toBeInTheDocument()
    expect(screen.getAllByText('COUNTER').length).toBeGreaterThan(0)
    expect(screen.getByText('The amount is slightly below the original salary signal.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'I am interested in moving forward, but I would like to tighten the compensation slightly before I accept these terms.',
      ),
    ).toBeInTheDocument()
  })
})
