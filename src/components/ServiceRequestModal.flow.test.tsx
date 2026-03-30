import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ServiceRequestModal from './ServiceRequestModal'

const apiCreateServiceRequestMock = vi.fn()
const apiGetServiceRequestCoachingMock = vi.fn()

vi.mock('../lib/api', () => ({
  apiCreateServiceRequest: (...args: unknown[]) => apiCreateServiceRequestMock(...args),
  apiGetServiceRequestCoaching: (...args: unknown[]) => apiGetServiceRequestCoachingMock(...args),
}))

describe('ServiceRequestModal AI coaching flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads coaching, applies the AI draft, and submits the service request', async () => {
    apiGetServiceRequestCoachingMock.mockResolvedValue({
      coaching: {
        score: 86,
        headline: 'This service looks like a strong fit for your current request.',
        strengths: ['Service fit: product design, launch pages', 'Category alignment for Design'],
        gaps: ['Add a clear deadline so delivery planning is easier.'],
        suggestedMessage:
          'I need a launch-ready landing page with clear conversion goals, responsive sections, and final handoff assets for the campaign team.',
        suggestedBudget: 'GHS 3,200',
        suggestedTimeline: '2 weeks',
      },
    })
    apiCreateServiceRequestMock.mockResolvedValue({
      serviceRequest: { id: 'service-request-1' },
    })

    render(
      <ServiceRequestModal
        isOpen
        onClose={vi.fn()}
        serviceId="service-1"
        serviceTitle="Landing Page Design"
        freelancerName="Kojo Asante"
      />,
    )

    expect(await screen.findByText('This service looks like a strong fit for your current request.')).toBeInTheDocument()
    expect(screen.getByText('86% fit')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /use ai request draft/i }))

    expect(screen.getByDisplayValue('GHS 3,200')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2 weeks')).toBeInTheDocument()
    expect(
      screen.getByDisplayValue(
        'I need a launch-ready landing page with clear conversion goals, responsive sections, and final handoff assets for the campaign team.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /send request/i }))

    await waitFor(() => {
      expect(apiCreateServiceRequestMock).toHaveBeenCalledWith('service-1', {
        message:
          'I need a launch-ready landing page with clear conversion goals, responsive sections, and final handoff assets for the campaign team.',
        budget: 'GHS 3,200',
        timeline: '2 weeks',
      })
    })
    expect(await screen.findByText('Request Sent')).toBeInTheDocument()
  })
})
