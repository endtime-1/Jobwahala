import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CVGenerator from './CVGenerator'

const useAuthMock = vi.fn()
const apiGetCVByIdMock = vi.fn()
const apiGetMyCVsMock = vi.fn()
const apiGetProfileOptimizationMock = vi.fn()
const apiSaveCVGenerationMock = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../lib/api', () => ({
  apiGetCVById: (...args: unknown[]) => apiGetCVByIdMock(...args),
  apiGetMyCVs: (...args: unknown[]) => apiGetMyCVsMock(...args),
  apiGetProfileOptimization: (...args: unknown[]) => apiGetProfileOptimizationMock(...args),
  apiSaveCVGeneration: (...args: unknown[]) => apiSaveCVGenerationMock(...args),
}))

describe('CVGenerator seeker coaching flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuthMock.mockReturnValue({
      role: 'SEEKER',
      userEmail: 'ada@example.com',
      user: {
        email: 'ada@example.com',
        jobSeekerProfile: {
          firstName: 'Ada',
          lastName: 'Kusi',
          experience: '',
          skills: '',
        },
      },
    })

    apiGetCVByIdMock.mockResolvedValue({
      cv: null,
    })

    apiGetMyCVsMock.mockResolvedValue({
      cvs: [],
    })

    apiGetProfileOptimizationMock.mockResolvedValue({
      optimization: {
        score: 84,
        headline: 'Ada is currently best positioned for Frontend Engineer opportunities.',
        strengths: [
          'Your skill stack is already specific enough to support stronger job matching: React, TypeScript.',
        ],
        improvements: [
          'Add a more specific experience narrative with shipped work, measurable outcomes, and collaboration scope.',
        ],
        suggestedSummary:
          'Ada is a results-oriented frontend engineer with strong React and TypeScript delivery experience across product-facing work.',
        suggestedSkills: ['React', 'TypeScript', 'UI Engineering'],
        nextCvPrompt: 'Create an ATS-friendly CV for Ada targeting Frontend Engineer roles.',
        targetRoles: ['Frontend Engineer', 'React Product Engineer'],
      },
    })
  })

  it('loads seeker coaching and applies the suggested summary and skills to the form', async () => {
    render(
      <MemoryRouter>
        <CVGenerator />
      </MemoryRouter>,
    )

    expect(await screen.findByText('AI profile coach')).toBeInTheDocument()
    expect(screen.getByText('84')).toBeInTheDocument()
    expect(screen.getByText('Frontend Engineer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /use suggested summary/i }))
    expect(
      screen.getByDisplayValue(
        'Ada is a results-oriented frontend engineer with strong React and TypeScript delivery experience across product-facing work.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /merge suggested skills/i }))
    expect(screen.getByDisplayValue('React, TypeScript, UI Engineering')).toBeInTheDocument()
  })
})
