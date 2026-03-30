import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobListings from './JobListings'

const useAuthMock = vi.fn()
const apiGetJobsMock = vi.fn()
const apiCompareJobsMock = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../components/VerifiedBadge', () => ({
  default: () => <div>Verified Badge</div>,
}))

vi.mock('../components/ReportModal', () => ({
  default: () => null,
}))

vi.mock('../lib/api', () => ({
  apiGetJobs: (...args: unknown[]) => apiGetJobsMock(...args),
  apiCompareJobs: (...args: unknown[]) => apiCompareJobsMock(...args),
}))

describe('JobListings comparison flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    apiGetJobsMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-1',
          title: 'Frontend Engineer',
          description: 'Build React product features.',
          location: 'Remote',
          salary: '5000',
          type: 'Full-time',
          category: 'Engineering',
          createdAt: '2026-03-21T00:00:00.000Z',
          employer: {
            id: 'employer-1',
            email: 'labs@example.com',
            isVerified: true,
            employerProfile: {
              companyName: 'JobWahala Labs',
            },
          },
        },
        {
          id: 'job-2',
          title: 'React Platform Engineer',
          description: 'Own TypeScript platform workflows.',
          location: 'Remote',
          salary: '6200',
          type: 'Full-time',
          category: 'Engineering',
          createdAt: '2026-03-22T00:00:00.000Z',
          employer: {
            id: 'employer-1',
            email: 'labs@example.com',
            isVerified: true,
            employerProfile: {
              companyName: 'JobWahala Labs',
            },
          },
        },
      ],
    })
  })

  it('lets seekers compare selected jobs with an AI brief', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'seeker-1', role: 'SEEKER', email: 'seeker@example.com' },
    })

    apiCompareJobsMock.mockResolvedValue({
      comparison: {
        summary:
          'React Platform Engineer currently leads the selected comparison for this seeker, while Frontend Engineer remains the cleaner alternative for broader product execution.',
        comparedCount: 2,
        jobs: [
          {
            id: 'job-2',
            title: 'React Platform Engineer',
            description: 'Own TypeScript platform workflows.',
            location: 'Remote',
            salary: '6200',
            type: 'Full-time',
            category: 'Engineering',
            createdAt: '2026-03-22T00:00:00.000Z',
            matchScore: 94,
            matchReasons: ['Skill overlap: React, TypeScript', 'Remote-friendly role'],
            employer: {
              id: 'employer-1',
              email: 'labs@example.com',
              isVerified: true,
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
            salary: '5000',
            type: 'Full-time',
            category: 'Engineering',
            createdAt: '2026-03-21T00:00:00.000Z',
            matchScore: 88,
            matchReasons: ['Skill overlap: React', 'Category fit for Engineering'],
            employer: {
              id: 'employer-1',
              email: 'labs@example.com',
              isVerified: true,
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
        <JobListings />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Frontend Engineer')).toBeInTheDocument()
    expect(screen.getByText('AI Role Comparison')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Compare Frontend Engineer'))
    fireEvent.click(screen.getByLabelText('Compare React Platform Engineer'))
    fireEvent.click(screen.getByRole('button', { name: /Generate AI Comparison/i }))

    await waitFor(() => {
      expect(apiCompareJobsMock).toHaveBeenCalledWith(['job-1', 'job-2'])
    })

    expect(
      await screen.findByText(/React Platform Engineer currently leads the selected comparison/i),
    ).toBeInTheDocument()
    expect(screen.getByText('2 roles compared')).toBeInTheDocument()
    expect(screen.getAllByText('JobWahala Labs').length).toBeGreaterThan(0)
    expect(screen.getAllByText('94% fit').length).toBeGreaterThan(0)
  })

  it('keeps comparison controls hidden for guests', async () => {
    useAuthMock.mockReturnValue({
      user: null,
    })

    render(
      <MemoryRouter>
        <JobListings />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Frontend Engineer')).toBeInTheDocument()
    expect(screen.queryByText('AI Role Comparison')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Generate AI Comparison/i })).not.toBeInTheDocument()
    expect(apiCompareJobsMock).not.toHaveBeenCalled()
  })
})
