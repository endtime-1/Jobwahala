import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FreelancerMarketplace from './FreelancerMarketplace'

const useAuthMock = vi.fn()
const apiGetServicesMock = vi.fn()
const apiGetRecommendedServicesMock = vi.fn()
const apiCompareMarketplaceFreelancersMock = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../components/VerifiedBadge', () => ({
  default: () => <div>Verified Badge</div>,
}))

vi.mock('../lib/api', () => ({
  apiGetServices: (...args: unknown[]) => apiGetServicesMock(...args),
  apiGetRecommendedServices: (...args: unknown[]) => apiGetRecommendedServicesMock(...args),
  apiCompareMarketplaceFreelancers: (...args: unknown[]) => apiCompareMarketplaceFreelancersMock(...args),
}))

describe('FreelancerMarketplace recommendation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads personalized service recommendations for seekers', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'SEEKER',
      },
    })

    apiGetRecommendedServicesMock.mockResolvedValue({
      personalized: true,
      services: [
        {
          id: 'service-1',
          title: 'Launch Landing Page System',
          description: 'Conversion-ready product launch design service.',
          price: 3200,
          deliveryTime: '2 weeks',
          category: 'Design',
          matchScore: 91,
          matchReasons: ['Service fit: landing pages, design systems', 'Context overlap: launch, conversion'],
          freelancer: {
            id: 'freelancer-1',
            email: 'kojo@example.com',
            isVerified: true,
            freelancerProfile: {
              firstName: 'Kojo',
              lastName: 'Asante',
              hourlyRate: 3200,
              bio: 'Product designer for fast-moving launch teams.',
              skills: 'Landing Pages, Design Systems, Product Design',
            },
          },
        },
      ],
    })

    render(
      <MemoryRouter>
        <FreelancerMarketplace />
      </MemoryRouter>,
    )

    expect(await screen.findByText('AI Service Picks')).toBeInTheDocument()
    expect(screen.getAllByText('91% fit').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Launch Landing Page System').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Service fit: landing pages, design systems').length).toBeGreaterThan(0)
    expect(apiGetRecommendedServicesMock).toHaveBeenCalledTimes(1)
    expect(apiGetServicesMock).not.toHaveBeenCalled()
  })

  it('compares selected marketplace freelancer options for seekers', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'SEEKER',
      },
    })

    apiGetRecommendedServicesMock.mockResolvedValue({
      personalized: true,
      services: [
        {
          id: 'service-1',
          title: 'Launch Landing Page System',
          description: 'Conversion-ready product launch design service.',
          price: 3200,
          deliveryTime: '2 weeks',
          category: 'Design',
          matchScore: 91,
          matchReasons: ['Service fit: landing pages, design systems', 'Context overlap: launch, conversion'],
          freelancer: {
            id: 'freelancer-1',
            email: 'kojo@example.com',
            isVerified: true,
            freelancerProfile: {
              firstName: 'Kojo',
              lastName: 'Asante',
              hourlyRate: 3200,
              bio: 'Product designer for fast-moving launch teams.',
              skills: 'Landing Pages, Design Systems, Product Design',
            },
          },
        },
        {
          id: 'service-2',
          title: 'Growth-Focused Product Video',
          description: 'Product launch video editing for ad and landing campaigns.',
          price: 2500,
          deliveryTime: '10 days',
          category: 'Video',
          matchScore: 84,
          matchReasons: ['Audience fit: launches, conversion', 'Delivery signal: quick video turnaround'],
          freelancer: {
            id: 'freelancer-2',
            email: 'yaa@example.com',
            isVerified: false,
            freelancerProfile: {
              firstName: 'Yaa',
              lastName: 'Mensah',
              hourlyRate: 2500,
              bio: 'Editor for product launch campaigns.',
              skills: 'Video Editing, Product Marketing',
            },
          },
        },
      ],
    })

    apiCompareMarketplaceFreelancersMock.mockResolvedValue({
      comparison: {
        summary: 'Kojo Asante currently leads for launch-focused design execution, while Yaa Mensah is the stronger adjacent pick for fast campaign video support.',
        comparedCount: 2,
        options: [
          {
            freelancer: {
              id: 'freelancer-1',
              email: 'kojo@example.com',
              isVerified: true,
              freelancerProfile: {
                firstName: 'Kojo',
                lastName: 'Asante',
              },
            },
            serviceCount: 1,
            topService: {
              serviceId: 'service-1',
              title: 'Launch Landing Page System',
              category: 'Design',
              price: 3200,
              deliveryTime: '2 weeks',
              matchScore: 91,
              matchReasons: ['Service fit: landing pages, design systems'],
            },
          },
          {
            freelancer: {
              id: 'freelancer-2',
              email: 'yaa@example.com',
              isVerified: false,
              freelancerProfile: {
                firstName: 'Yaa',
                lastName: 'Mensah',
              },
            },
            serviceCount: 1,
            topService: {
              serviceId: 'service-2',
              title: 'Growth-Focused Product Video',
              category: 'Video',
              price: 2500,
              deliveryTime: '10 days',
              matchScore: 84,
              matchReasons: ['Audience fit: launches, conversion'],
            },
          },
        ],
      },
    })

    render(
      <MemoryRouter>
        <FreelancerMarketplace />
      </MemoryRouter>,
    )

    expect(await screen.findByText('AI Service Picks')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Compare Kojo Asante'))
    fireEvent.click(screen.getByLabelText('Compare Yaa Mensah'))
    fireEvent.click(screen.getByRole('button', { name: /Generate AI Comparison/i }))

    await waitFor(() => {
      expect(apiCompareMarketplaceFreelancersMock).toHaveBeenCalledWith([
        'freelancer-1',
        'freelancer-2',
      ])
    })

    expect(await screen.findByText(/Kojo Asante currently leads for launch-focused design execution/i)).toBeInTheDocument()
    expect(screen.getByText('2 options compared')).toBeInTheDocument()
    expect(screen.getAllByText('Launch Landing Page System').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Growth-Focused Product Video').length).toBeGreaterThan(0)
  })

  it('uses the public marketplace feed for guests', async () => {
    useAuthMock.mockReturnValue({
      user: null,
    })

    apiGetServicesMock.mockResolvedValue({
      services: [
        {
          id: 'service-2',
          title: 'Mobile UI Kit',
          description: 'UI kit production for mobile apps.',
          price: 1800,
          deliveryTime: '1 week',
          category: 'Design',
          freelancer: {
            id: 'freelancer-2',
            email: 'esi@example.com',
            isVerified: false,
            freelancerProfile: {
              firstName: 'Esi',
              lastName: 'Owusu',
              hourlyRate: 1800,
              bio: 'Interface designer for startup products.',
              skills: 'Mobile UI, Figma',
            },
          },
        },
      ],
    })

    render(
      <MemoryRouter>
        <FreelancerMarketplace />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Esi Owusu')).toBeInTheDocument()
    expect(screen.queryByText('AI Service Picks')).not.toBeInTheDocument()
    expect(apiGetServicesMock).toHaveBeenCalledTimes(1)
    expect(apiGetRecommendedServicesMock).not.toHaveBeenCalled()
    expect(apiCompareMarketplaceFreelancersMock).not.toHaveBeenCalled()
  })
})
