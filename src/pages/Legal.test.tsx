import { render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { LEGAL } from '../content/legal'
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

const textOf = (path: string) => renderAt(path).container.textContent ?? ''

describe('the pages are final for launch', () => {
  it.each(['/privacy', '/terms'])('%s has no draft label, banner, placeholder or bracketed field', (path) => {
    const text = textOf(path)

    // No draft label (the word "draft" is fine when it describes what an AI tool does).
    for (const label of ['(draft)', 'is a draft', 'draft notice', 'draft for', 'draft only']) expect(text.toLowerCase()).not.toContain(label)
    expect(text).not.toMatch(/legal review|reviewed by a lawyer|not legal advice|still to confirm/i)
    expect(text).not.toMatch(/\[[A-Z][^\]]*\]/) // [BRACKETED FIELDS]
    expect(text).not.toMatch(/\bTBC\b|\bTODO\b/)
    expect(text).not.toMatch(/YOUR LEGAL|YOUR ADDRESS|REGISTRATION NUMBER/) // upper case only: "registration number" is a real phrase
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it.each(['/privacy', '/terms'])('%s shows the effective and last-updated dates', (path) => {
    expect(textOf(path)).toContain('Effective 8 November 2026. Last updated 8 November 2026.')
  })

  it('has no draft notice component or draft settings left in the code', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) files.push(full)
      }
    }
    walk(resolve(__dirname, '..'))
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/LegalDraftNotice|reviewedByLawyer|OPEN_POINTS|draftNotice|Draft for legal review/)
    }
  })
})

describe('the business details come from one place', () => {
  it('uses the operator, place, email, phone and website on both pages', () => {
    expect(LEGAL.operatorName).toBe('JobWahala, operated by Gabriel Kwaku Kusi (Founder & CEO)')
    expect(LEGAL.location).toBe('Kumasi, Ashanti Region, Ghana')
    expect(LEGAL.contactEmail).toBe('gabriel@jobwahala.com')
    expect(LEGAL.phone).toBe('+233 20 962 4647')
    expect(LEGAL.website).toBe('https://www.jobwahala.com')
    for (const path of ['/terms', '/privacy']) {
      const text = textOf(path)
      for (const detail of [LEGAL.operatorName, 'Kumasi, Ashanti Region, Ghana', 'gabriel@jobwahala.com', '+233 20 962 4647', 'https://www.jobwahala.com']) expect(text).toContain(detail)
    }
  })

  it('uses no other contact address', () => {
    for (const path of ['/terms', '/privacy']) expect(textOf(path)).not.toMatch(/info@jobwahala\.com/)
  })
})

describe('the Terms of Service', () => {
  it('has a section index, and links to the Privacy Policy, Account settings, the Plans page and the Hiring Service', () => {
    const { container } = renderAt('/terms')

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Freelance gigs: coming soon/ })).toHaveAttribute('href', '#section-10')
    expect(container.textContent).toMatch(/Act 843/)
    for (const link of screen.getAllByRole('link', { name: 'Privacy Policy' })) expect(link).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Account settings' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: 'Plans page' })).toHaveAttribute('href', '/plans')
    expect(screen.getByRole('link', { name: 'Hiring Service page' })).toHaveAttribute('href', '/hiring-service')
  })

  it('says what is free and what is paid, with prices shown before paying, and that paying never buys trust', () => {
    const text = textOf('/terms')

    expect(screen.getByRole('heading', { level: 2, name: /What is free and what is paid/ })).toBeInTheDocument()
    expect(text).toMatch(/You are never charged to apply for a job/)
    expect(text).toMatch(/posting jobs, receiving applications, the applicant board and employer verification are free/)
    expect(text).toMatch(/where they are offered/)
    expect(text).toMatch(/price is shown to you before you pay/)
    for (const paid of [/Plans/, /Featured jobs, job boosts and job packs/, /CV database access/, /profile boost/, /The Hiring Service/]) expect(text).toMatch(paid)
    expect(text).toMatch(/never ranks an unverified employer above a verified one/)
  })

  it('treats freelance gigs as coming soon, and does not suggest escrow, payouts or freelance payments are live', () => {
    const text = textOf('/terms')

    expect(text).toMatch(/Freelance gigs, proposals and agreements between members are coming soon and are not offered yet/)
    expect(text).toMatch(/We do not hold, pay out or handle money between members/)
    expect(text).not.toMatch(/escrow|payout|milestone|work agreement/i)
  })

  it('says job seekers never pay to apply, and that we remove listings that ask for money', () => {
    const text = textOf('/terms')
    expect(text).toMatch(/You must never have to pay to apply for a job/)
    expect(text).toMatch(/We remove any listing that asks applicants for money/)
  })

  it('sets the age at 18, and says users can download their data and delete their account in settings', () => {
    const text = textOf('/terms')
    expect(text).toMatch(/at least 18 years old/)
    expect(text).toMatch(/download your data and delete your account at any time in Account settings/)
  })

  it('says it is governed by the laws of Ghana, with the courts of Ghana deciding', () => {
    expect(textOf('/terms')).toMatch(/governed by the laws of the Republic of Ghana. The courts of Ghana have jurisdiction/)
  })

  it('says it may change, with the new last-updated date shown', () => {
    expect(textOf('/terms')).toMatch(/We may update these terms. When we do, we change the "last updated" date/)
  })

  it('explains payment, renewals, the 7-day grace period and credits', () => {
    const text = textOf('/terms')
    expect(screen.getByRole('heading', { level: 2, name: /Paying, plans and renewals/ })).toBeInTheDocument()
    for (const topic of [/Paystack/, /renew by themselves/i, /cancel at any time/i, /7 days to fix it/, /moves to the Free plan/i, /never expire/i, /keep their price/i]) expect(text).toMatch(topic)
  })

  it('has a refund policy that uses the numbers set in one place, and says how to ask', () => {
    const text = textOf('/terms')
    expect(screen.getByRole('heading', { level: 2, name: /Refunds and cancellations/ })).toBeInTheDocument()
    expect(text).toContain(`within ${LEGAL.planRefundDays} days of your first payment`)
    expect(text).toContain(`within ${LEGAL.promotionRefundHours} hours`)
    expect(text).toMatch(/charged twice/)
    expect(text).toMatch(/Ghanaian consumer law/)
  })

  it('sets the rules for the CV database, for job seekers and employers', () => {
    const text = textOf('/terms')
    expect(screen.getByRole('heading', { level: 2, name: /The CV database/ })).toBeInTheDocument()
    for (const topic of [/off unless you switch it on/i, /only verified employers/i, /only to consider that person for a job/i, /in bulk/i, /blocked you/i]) expect(text).toMatch(topic)
  })

  it('covers the Hiring Service: consent first, who sees the shortlist, cancelling, the guarantee, and no promise of a hire', () => {
    const text = textOf('/terms')
    expect(screen.getByRole('heading', { level: 2, name: /The Hiring Service/ })).toBeInTheDocument()
    expect(text).toMatch(/Candidates agree first/)
    expect(text).toMatch(/Work starts only once the fee is agreed/)
    expect(text).toMatch(/Only you and our team see the shortlist/)
    expect(text).toMatch(/you can cancel a request before work starts/)
    expect(text).toMatch(/search again at no extra charge/)
    expect(text).toMatch(/counted from the day your hire starts/)
    expect(text).toMatch(/No guarantee of a hire/)
    expect(text).toMatch(/We are not the employer/)
  })
})

describe('the Privacy Policy', () => {
  it('names the Act, the Commission and the member’s rights', () => {
    const text = textOf('/privacy')

    expect(text).toMatch(/Data Protection Act, 2012 \(Act 843\)/)
    expect(text).toMatch(/Data Protection Commission/)
    expect(text).toMatch(/data controller/i)
    expect(screen.getByRole('heading', { level: 2, name: /Your rights under Act 843/ })).toBeInTheDocument()
  })

  it('points people to the real download and delete tools, and to the contact for any privacy request', () => {
    const text = textOf('/privacy')

    const settings = screen.getAllByRole('link', { name: /account settings/i })
    expect(settings.length).toBeGreaterThanOrEqual(2)
    for (const link of settings) expect(link).toHaveAttribute('href', '/settings')
    expect(text).toMatch(/For any privacy request, write to gabriel@jobwahala.com/)
  })

  it('describes what is collected, and who processes it', () => {
    const text = textOf('/privacy')
    for (const topic of [/phone number/i, /registration number/i, /Arkesel/, /Sentry/, /Turnstile/, /how long we keep/i, /Railway/, /Brevo/, /OpenAI/, /Paystack/]) expect(text).toMatch(topic)
  })

  it('says who can see a job seeker’s data: employers they apply to, and verified employers in the CV database only if they opt in', () => {
    const text = textOf('/privacy')
    expect(screen.getByRole('heading', { level: 2, name: /Who can see a job seeker/ })).toBeInTheDocument()
    expect(text).toMatch(/Employers you apply to see your application/)
    expect(text).toMatch(/Verified employers in the CV database can see a limited profile only if you opt in/)
    expect(text).toMatch(/Hidden unless you switch it on/)
  })

  it('explains WhatsApp updates without claiming we message people on WhatsApp', () => {
    const text = textOf('/privacy')
    expect(screen.getByRole('heading', { level: 2, name: /WhatsApp updates/ })).toBeInTheDocument()
    expect(text).toMatch(/follow our WhatsApp channel/)
    expect(text).toMatch(/We do not send it/)
  })

  it('does not describe freelance proposals, agreements or payouts as things we handle', () => {
    expect(textOf('/privacy')).not.toMatch(/proposal|agreement|payout|escrow|milestone/i)
  })

  it('keeps payment records for the period set in one place, and covers teams, messages and job views', () => {
    const text = textOf('/privacy')
    expect(text).toContain(`for ${LEGAL.paymentRecordYears} years`)
    expect(screen.getByRole('heading', { level: 2, name: /Teams, messages and job views/ })).toBeInTheDocument()
    expect(text).toMatch(/do not see or store card numbers/i)
    expect(text).toMatch(/once a day/i)
  })

  it('says the minimum age is 18, and that the policy will be updated with a new date', () => {
    const text = textOf('/privacy')
    expect(text).toMatch(/for people aged 18 and over/)
    expect(text).toMatch(/We change the "last updated" date at the top/)
  })

  it('covers the Hiring Service: your yes first, what the employer sees, who at JobWahala can see it, the audit trail', () => {
    const text = textOf('/privacy')
    expect(screen.getByRole('heading', { level: 2, name: /The Hiring Service: recruiters and candidates/ })).toBeInTheDocument()
    expect(text).toMatch(/We do not give your profile, CV or contact details to the employer until you agree/)
    expect(text).toMatch(/We record when you agreed and what you agreed to/)
    expect(text).toMatch(/private notes are not shared/)
    expect(text).toMatch(/Recruiters cannot open requests that are not assigned to them/)
    expect(text).toMatch(/recorded in our audit log/)
    expect(text).toMatch(/Companies you blocked/)
  })
})
