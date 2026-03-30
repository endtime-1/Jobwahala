import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FreelancerProfile from './FreelancerProfile'

const useAuthMock = vi.fn()
const apiGetFreelancerProfileMock = vi.fn()
const apiGetFreelancerComparisonMock = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../lib/api', () => ({
  apiGetFreelancerProfile: (...args: unknown[]) => apiGetFreelancerProfileMock(...args),
  apiGetFreelancerComparison: (...args: unknown[]) => apiGetFreelancerComparisonMock(...args),
}))

vi.mock('../components/VerifiedBadge', () => ({
  default: () => <div>Verified Badge</div>,
}))

vi.mock('../components/ReportModal', () => ({
  default: () => null,
}))

vi.mock('../components/ServiceRequestModal', () => ({
  default: () => null,
}))

describe('FreelancerProfile AI comparison flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows AI market comparison signals for a seeker viewing a freelancer', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'seeker-1',
        role: 'SEEKER',
      },
    })

    apiGetFreelancerProfileMock.mockResolvedValue({
      profile: {
        id: 'freelancer-1',
        email: 'kojo@example.com',
        createdAt: '2026-03-21T00:00:00.000Z',
        isVerified: true,
        freelancerProfile: {
          firstName: 'Kojo',
          lastName: 'Asante',
          hourlyRate: 3200,
          bio: 'Product designer for launch-ready campaigns.',
          skills: 'Landing Pages, Design Systems, Product Design',
        },
        freelanceServices: [
          {
            id: 'service-1',
            title: 'Launch Landing Page System',
            description: 'Conversion-first landing page package.',
            price: 3200,
            deliveryTime: '2 weeks',
            category: 'Design',
          },
        ],
        reviewsReceived: [],
      },
      reviewSummary: {
        reviewCount: 3,
        averageRating: 4.8,
      },
    })

    apiGetFreelancerComparisonMock.mockResolvedValue({
      comparison: {
        headline:
          'Kojo Asante currently leads with Launch Landing Page System at 92% fit, while the strongest nearby alternative is Mobile UI Sprint at 84% fit.',
        viewedFreelancerScore: 92,
        viewedServiceMatches: [
          {
            serviceId: 'service-1',
            title: 'Launch Landing Page System',
            matchScore: 92,
            matchReasons: ['Service fit: landing pages, launch funnels', 'Context overlap: growth, conversion'],
          },
        ],
        alternatives: [
          {
            id: 'service-2',
            title: 'Mobile UI Sprint',
            description: 'Rapid mobile design sprint.',
            price: 2800,
            deliveryTime: '10 days',
            category: 'Design',
            matchScore: 84,
            matchReasons: ['Category alignment for Design'],
            freelancer: {
              id: 'freelancer-2',
              email: 'esi@example.com',
              isVerified: true,
              freelancerProfile: {
                firstName: 'Esi',
                lastName: 'Owusu',
              },
            },
          },
        ],
      },
    })

    render(
      <MemoryRouter initialEntries={['/freelancers/freelancer-1']}>
        <Routes>
          <Route path="/freelancers/:id" element={<FreelancerProfile />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('AI Market Read')).toBeInTheDocument()
    expect(screen.getAllByText('92% fit').length).toBeGreaterThan(0)
    expect(screen.getByText(/Kojo Asante currently leads with Launch Landing Page System/i)).toBeInTheDocument()
    expect(screen.getByText('Strongest Service Match')).toBeInTheDocument()
    expect(screen.getAllByText('Launch Landing Page System').length).toBeGreaterThan(0)
    expect(screen.getByText('Mobile UI Sprint')).toBeInTheDocument()
    expect(screen.getByText('Esi Owusu')).toBeInTheDocument()
    expect(apiGetFreelancerComparisonMock).toHaveBeenCalledWith('freelancer-1')
  })
})
