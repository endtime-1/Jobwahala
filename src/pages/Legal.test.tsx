import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LEGAL, OPEN_POINTS, unfilledDetails, updatedLabel } from '../content/legal'
import Privacy from './Privacy'
import Terms from './Terms'

const renderAt = (path: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )

describe('legal pages linked from signup', () => {
  it('renders the terms of service with a section index', () => {
    renderAt('/terms')

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /freelance gigs, payments and escrow/i })).toHaveAttribute('href', '#section-3')
    expect(screen.getByRole('heading', { level: 2, name: /3\. Freelance gigs, payments and escrow/ })).toBeInTheDocument()
  })

  it('renders the privacy policy', () => {
    renderAt('/privacy')

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /support centre/i })[0]).toHaveAttribute('href', '/support')
  })
})

describe('drafts waiting for legal review', () => {
  it.each(['/privacy', '/terms'])('%s is marked clearly as a draft for legal review', (path) => {
    renderAt(path)

    const notice = screen.getByRole('note', { name: /draft notice/i })
    expect(notice).toHaveTextContent(/draft for legal review/i)
    expect(notice).toHaveTextContent(/not been reviewed by a lawyer/i)
    expect(notice).toHaveTextContent(/not legal advice/i)
    expect(screen.getByText(/\(draft\)/i)).toBeInTheDocument()
  })

  it('leaves the facts that only the company knows as visible placeholders', () => {
    renderAt('/privacy')

    // The business details come from one place (src/content/legal.ts). Until they are filled in, the brackets show.
    expect(screen.getAllByText(new RegExp(LEGAL.operatorName.replace(/[[\]]/g, '\\$&'))).length).toBeGreaterThan(0)
    expect(screen.getAllByText(new RegExp(LEGAL.contactEmail.replace('.', '\\.'))).length).toBeGreaterThan(0)
  })
})

describe('Ghana Data Protection Act, 2012 (Act 843)', () => {
  it('the privacy policy names the Act, the Commission and the member\'s rights', () => {
    const { container } = renderAt('/privacy')
    const text = container.textContent ?? ''

    expect(text).toMatch(/Data Protection Act, 2012 \(Act 843\)/)
    expect(text).toMatch(/Data Protection Commission/)
    expect(text).toMatch(/data controller/i)
    expect(screen.getByRole('heading', { level: 2, name: /Your rights under Act 843/ })).toBeInTheDocument()
  })

  it('points people to the real download and delete tools', () => {
    renderAt('/privacy')

    const settings = screen.getAllByRole('link', { name: /account settings/i })
    expect(settings.length).toBeGreaterThanOrEqual(2)
    for (const link of settings) expect(link).toHaveAttribute('href', '/settings')
  })

  it('describes what is actually collected and who processes it', () => {
    const { container } = renderAt('/privacy')
    const text = container.textContent ?? ''

    for (const topic of [/phone number/i, /registration number/i, /Arkesel/, /Sentry/, /Turnstile/, /retention|how long we keep/i]) {
      expect(text).toMatch(topic)
    }
  })

  it('the terms refer to the same Act and link the privacy policy and settings', () => {
    const { container } = renderAt('/terms')

    expect(container.textContent).toMatch(/Act 843/)
    for (const link of screen.getAllByRole('link', { name: 'Privacy Policy' })) expect(link).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Account settings' })).toHaveAttribute('href', '/settings')
  })

  it('the terms no longer present escrow or freelance payouts as live', () => {
    const { container } = renderAt('/terms')

    expect(container.textContent).toMatch(/not available yet/i)
    expect(container.textContent).not.toMatch(/held until the milestone is approved/i)
  })
})

describe('the terms now cover the paid services', () => {
  it('lists what is free and what is paid, and links to the plans', () => {
    const { container } = renderAt('/terms')

    expect(screen.getByRole('heading', { level: 2, name: /What is free and what is paid/ })).toBeInTheDocument()
    expect(container.textContent).toMatch(/free for employers to post jobs/i)
    expect(container.textContent).toMatch(/You are never asked to pay to apply/i)
    expect(screen.getByRole('link', { name: 'Plans page' })).toHaveAttribute('href', '/plans')
    // Paying never buys trust.
    expect(container.textContent).toMatch(/never ranks an unverified employer\s+above a verified one/i)
  })

  it('no longer says that no money changes hands', () => {
    const { container } = renderAt('/terms')

    expect(container.textContent).not.toMatch(/Nothing on JobWahala today involves us holding or\s+paying out money/i)
    expect(container.textContent).toMatch(/We do not hold or pay out money between\s+members/i)
  })

  it('explains payment, renewals, the 7-day grace period and credits', () => {
    const { container } = renderAt('/terms')
    const text = container.textContent ?? ''

    expect(screen.getByRole('heading', { level: 2, name: /Paying, plans and renewals/ })).toBeInTheDocument()
    for (const topic of [/Paystack/, /renew by themselves/i, /cancel at any time/i, /7 days to fix it/, /moves to the Free plan/i, /never expire/i, /keep their price/i]) expect(text).toMatch(topic)
  })

  it('has a refund policy that uses the numbers set in one place, and says how to ask', () => {
    const { container } = renderAt('/terms')
    const text = container.textContent ?? ''

    expect(screen.getByRole('heading', { level: 2, name: /Refunds and cancellations/ })).toBeInTheDocument()
    expect(text).toContain(`within ${LEGAL.planRefundDays} days of your first`)
    expect(text).toContain(`within ${LEGAL.promotionRefundHours} hours`)
    expect(text).toMatch(/charged twice/)
    expect(text).toContain(LEGAL.contactEmail)
    expect(text).toMatch(/Ghanaian consumer law/)
  })

  it('sets the rules for using the CV database, for job seekers and employers', () => {
    const { container } = renderAt('/terms')
    const text = container.textContent ?? ''

    expect(screen.getByRole('heading', { level: 2, name: /The CV database/ })).toBeInTheDocument()
    for (const topic of [/off unless you switch it on/i, /only verified employers/i, /only to consider that person for a job/i, /bulk/i, /blocked you/i]) expect(text).toMatch(topic)
  })
})

describe('the privacy policy now matches what the site does', () => {
  it('names the real providers instead of placeholders, with no note left for a lawyer in the text', () => {
    const { container } = renderAt('/privacy')
    const text = container.textContent ?? ''

    for (const provider of ['Railway', 'Brevo', 'OpenAI', 'Paystack', 'Arkesel', 'Turnstile']) expect(text).toContain(provider)
    expect(text).not.toMatch(/\[Lawyer to/)
    expect(text).not.toMatch(/\[(HOSTING|EMAIL|AI) PROVIDER/)
  })

  it('explains payments, plans, receipts, teams, messages and job views', () => {
    const { container } = renderAt('/privacy')
    const text = container.textContent ?? ''

    expect(screen.getByRole('heading', { level: 2, name: /Payments, plans and receipts/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Teams, messages and job views/ })).toBeInTheDocument()
    expect(text).toMatch(/do not see or store card numbers/i)
    expect(text).toMatch(/not stored/i)
    expect(text).toMatch(/counted once a day/i)
  })

  it('keeps payment records for the period set in one place', () => {
    const { container } = renderAt('/privacy')

    expect(container.textContent).toContain(`for ${LEGAL.paymentRecordYears} years`)
  })
})

describe('the legal details, in one place', () => {
  it('lists what is still to fill in and what a lawyer must confirm', () => {
    renderAt('/terms')

    expect(unfilledDetails()).toEqual(expect.arrayContaining(['operatorName', 'address', 'dpcRegistration']))
    const notice = screen.getByRole('note', { name: /draft notice/i })
    for (const point of OPEN_POINTS) expect(notice).toHaveTextContent(point)
  })

  it('marks the date as a draft until a lawyer has reviewed it', () => {
    expect(updatedLabel()).toBe(`${LEGAL.lastUpdated} (draft)`)
  })
})
