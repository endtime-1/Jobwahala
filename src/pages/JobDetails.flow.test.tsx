import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JobDetails from './JobDetails'

const useAuthMock = vi.fn()
const apiApplyForJobMock = vi.fn()
const apiDeleteApplicationMock = vi.fn()
const apiGetJobApplicationCoachingMock = vi.fn()
const apiGetJobByIdMock = vi.fn()
const apiGetMyJobApplicationMock = vi.fn()

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
  apiApplyForJob: (...args: unknown[]) => apiApplyForJobMock(...args),
  apiDeleteApplication: (...args: unknown[]) =>
    apiDeleteApplicationMock(...args),
  apiGetJobApplicationCoaching: (...args: unknown[]) =>
    apiGetJobApplicationCoachingMock(...args),
  apiGetJobById: (...args: unknown[]) => apiGetJobByIdMock(...args),
  apiGetMyJobApplication: (...args: unknown[]) =>
    apiGetMyJobApplicationMock(...args),
}))

describe('JobDetails application flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuthMock.mockReturnValue({
      user: { id: 'seeker-1', email: 'seeker@example.com' },
      role: 'SEEKER',
    })

    apiGetJobByIdMock.mockResolvedValue({
      job: {
        id: 'job-1',
        title: 'Frontend Engineer',
        description: 'Build the candidate experience.',
        location: 'Remote',
        salary: '$4,000/month',
        type: 'Full-time',
        category: 'Engineering',
        createdAt: '2026-03-21T00:00:00.000Z',
        employer: {
          id: 'employer-1',
          email: 'employer@example.com',
          employerProfile: {
            companyName: 'JobWahala Labs',
            website: 'https://jobwahala.example',
            description: 'Remote-first product team.',
          },
        },
      },
    })

    apiGetJobApplicationCoachingMock.mockResolvedValue({
      coaching: {
        score: 86,
        headline: 'You already look like a strong candidate for Frontend Engineer.',
        strengths: ['Skill overlap: React, TypeScript'],
        gaps: ['Write a tailored cover note that connects your strongest skills directly to this role.'],
        suggestedCoverLetter:
          'I am applying for the Frontend Engineer role with strong React and TypeScript delivery experience and a focus on product execution.',
        cvPrompt:
          'Create an ATS-friendly CV tailored to the Frontend Engineer role.',
      },
    })

    Object.defineProperty(window, 'scrollTo', {
      writable: true,
      value: vi.fn(),
    })
    Object.defineProperty(window, 'confirm', {
      writable: true,
      value: vi.fn(() => true),
    })
  })

  it('submits a seeker application and swaps the form for stored status', async () => {
    apiGetMyJobApplicationMock.mockResolvedValue({ application: null })
    apiApplyForJobMock.mockResolvedValue({
      application: {
        id: 'application-1',
        status: 'SUBMITTED',
        createdAt: '2026-03-21T00:00:00.000Z',
      },
    })

    render(
      <MemoryRouter initialEntries={['/jobs/job-1']}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetails />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Frontend Engineer')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Cover note for the employer...'), {
      target: { value: 'I can own the frontend workflow.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply now/i }))

    expect(await screen.findByText('Application Live')).toBeInTheDocument()
    expect(screen.getByText('Status: SUBMITTED')).toBeInTheDocument()
    expect(apiApplyForJobMock).toHaveBeenCalledWith(
      'job-1',
      'I can own the frontend workflow.',
    )
  })

  it('shows the current application state and hides duplicate apply controls', async () => {
    apiGetMyJobApplicationMock.mockResolvedValue({
      application: {
        id: 'application-1',
        status: 'INTERVIEW',
        createdAt: '2026-03-21T00:00:00.000Z',
      },
    })

    render(
      <MemoryRouter initialEntries={['/jobs/job-1']}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetails />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Application Live')).toBeInTheDocument()
    expect(screen.getByText('Status: INTERVIEW')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /apply now/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /withdraw application/i }),
    ).toBeInTheDocument()
  })

  it('loads role-specific application coaching and lets the seeker use the suggested cover note', async () => {
    apiGetMyJobApplicationMock.mockResolvedValue({ application: null })

    render(
      <MemoryRouter initialEntries={['/jobs/job-1']}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetails />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('AI Application Coach')).toBeInTheDocument()
    expect(screen.getByText('86% fit')).toBeInTheDocument()
    expect(
      screen.getByText('You already look like a strong candidate for Frontend Engineer.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /use suggested cover note/i }))

    expect(
      screen.getByDisplayValue(
        'I am applying for the Frontend Engineer role with strong React and TypeScript delivery experience and a focus on product execution.',
      ),
    ).toBeInTheDocument()
  })
})
