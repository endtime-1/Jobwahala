import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ShareOnWhatsApp from '../components/ShareOnWhatsApp'
import WhatsAppChannels from '../components/WhatsAppChannels'
import { getWhatsAppChannels, isUsableChannelUrl, jobShareLink, jobShareMessage, whatsappShareUrl } from './whatsapp'

const job = { id: 'job-1', title: 'Bank Teller', companyName: 'Achiba Bank', location: 'Accra, Ghana', salary: 'GHS 1,800 a month' }
const ORIGIN = 'https://jobwahala.com'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the share link', () => {
  it('is the job address with a source tag for WhatsApp', () => {
    const link = new URL(jobShareLink('job-1', ORIGIN))

    expect(link.origin + link.pathname).toBe('https://jobwahala.com/jobs/job-1')
    expect(link.searchParams.get('utm_source')).toBe('whatsapp')
    expect(link.searchParams.get('utm_medium')).toBe('share')
    expect(link.searchParams.get('utm_campaign')).toBe('job_share')
  })
})

describe('the WhatsApp message', () => {
  it('has the title, company, location, pay and the link', () => {
    const message = jobShareMessage(job, ORIGIN)

    expect(message).toContain('*Bank Teller* at Achiba Bank')
    expect(message).toContain('📍 Accra, Ghana')
    expect(message).toContain('💰 GHS 1,800 a month')
    expect(message).toContain('Apply on JobWahala: https://jobwahala.com/jobs/job-1?utm_source=whatsapp')
  })

  it('leaves out a line when there is nothing to say, with no stray blank lines', () => {
    const message = jobShareMessage({ ...job, location: null, salary: '  ' }, ORIGIN)

    expect(message).not.toContain('📍')
    expect(message).not.toContain('💰')
    expect(message.split('\n')).toEqual(['*Bank Teller* at Achiba Bank', '', expect.stringContaining('Apply on JobWahala:')])
  })

  it('says "Unpaid" for an unpaid role', () => {
    expect(jobShareMessage({ ...job, unpaid: true, salary: null }, ORIGIN)).toContain('💰 Unpaid')
  })

  it('opens WhatsApp with the message encoded, so line breaks and symbols survive', () => {
    const url = whatsappShareUrl(job, ORIGIN)

    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(jobShareMessage(job, ORIGIN))
    expect(url).not.toContain('\n')
  })
})

describe('the Share on WhatsApp button', () => {
  it('links to WhatsApp in a new tab, safely, and names the job for screen readers', () => {
    render(<ShareOnWhatsApp job={job} />)

    const link = screen.getByRole('link', { name: 'Share Bank Teller on WhatsApp' })
    expect(link.getAttribute('href')).toContain('https://wa.me/?text=')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('the labelled version says what it does', () => {
    render(<ShareOnWhatsApp job={job} variant="labelled" />)

    expect(screen.getByText('Share on WhatsApp')).toBeInTheDocument()
  })

  it('does not open the job when it sits on a clickable card', () => {
    const onCard = vi.fn()
    render(
      <div onClick={onCard}>
        <ShareOnWhatsApp job={job} />
      </div>,
    )

    const link = screen.getByRole('link')
    link.addEventListener('click', (event) => event.preventDefault())
    link.click()

    expect(onCard).not.toHaveBeenCalled()
  })
})

describe('WhatsApp channels', () => {
  it('accepts a real channel address and refuses placeholders and other sites', () => {
    expect(isUsableChannelUrl('https://whatsapp.com/channel/0029VaXyz')).toBe(true)
    expect(isUsableChannelUrl('https://www.whatsapp.com/channel/0029VaXyz')).toBe(true)
    expect(isUsableChannelUrl('https://whatsapp.com/channel/REPLACE_ME_JOBS')).toBe(false)
    expect(isUsableChannelUrl('')).toBe(false)
    expect(isUsableChannelUrl('http://whatsapp.com/channel/abc')).toBe(false)
    expect(isUsableChannelUrl('https://evil.example.com/channel/abc')).toBe(false)
    expect(isUsableChannelUrl('javascript:alert(1)')).toBe(false)
  })

  it('shows nothing until a channel has been set up', () => {
    vi.stubEnv('VITE_WHATSAPP_CHANNEL_JOBS', 'https://whatsapp.com/channel/REPLACE_ME_JOBS')
    const { container } = render(<WhatsAppChannels />)

    expect(getWhatsAppChannels()).toEqual([])
    expect(container).toBeEmptyDOMElement()
  })

  it('lists the channels that are set, in a panel', () => {
    vi.stubEnv('VITE_WHATSAPP_CHANNEL_JOBS', 'https://whatsapp.com/channel/jobs123')
    vi.stubEnv('VITE_WHATSAPP_CHANNEL_EMPLOYERS', 'https://whatsapp.com/channel/emp456')

    render(<WhatsAppChannels />)

    expect(screen.getByRole('link', { name: /jobwahala jobs/i })).toHaveAttribute('href', 'https://whatsapp.com/channel/jobs123')
    expect(screen.getByRole('link', { name: /for employers/i })).toHaveAttribute('href', 'https://whatsapp.com/channel/emp456')
    expect(screen.queryByRole('link', { name: /internships/i })).not.toBeInTheDocument()
  })

  it('a dashboard can ask for only the channels that suit its reader', () => {
    vi.stubEnv('VITE_WHATSAPP_CHANNEL_JOBS', 'https://whatsapp.com/channel/jobs123')
    vi.stubEnv('VITE_WHATSAPP_CHANNEL_INTERNSHIPS', 'https://whatsapp.com/channel/intern789')
    vi.stubEnv('VITE_WHATSAPP_CHANNEL_EMPLOYERS', 'https://whatsapp.com/channel/emp456')

    render(<WhatsAppChannels only={['jobs', 'internships']} />)

    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      'https://whatsapp.com/channel/jobs123',
      'https://whatsapp.com/channel/intern789',
    ])
  })

  it('the footer version is plain links, and opens in a new tab', () => {
    vi.stubEnv('VITE_WHATSAPP_CHANNEL_JOBS', 'https://whatsapp.com/channel/jobs123')

    render(
      <MemoryRouter>
        <WhatsAppChannels variant="footer" />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: /whatsapp: jobwahala jobs/i })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })
})
