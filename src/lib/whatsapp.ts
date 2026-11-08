import { DEFAULT_WHATSAPP_CHANNEL_URL } from '../content/social'

/** What we need to know about a job to share it. */
export type ShareableJob = {
  id: string
  title: string
  companyName: string
  location?: string | null
  salary?: string | null
  unpaid?: boolean
}

/** The job link with a source tag, so we can tell which visits came from WhatsApp shares. */
export const jobShareLink = (jobId: string, origin = window.location.origin) =>
  `${origin}/jobs/${encodeURIComponent(jobId)}?utm_source=whatsapp&utm_medium=share&utm_campaign=job_share`

/** The ready-written WhatsApp message: title, company, location, pay and the link. Lines with nothing to say are left out. */
export const jobShareMessage = (job: ShareableJob, origin?: string) => {
  const pay = job.unpaid ? 'Unpaid' : job.salary?.trim()
  const details = [job.location?.trim() ? `📍 ${job.location.trim()}` : '', pay ? `💰 ${pay}` : ''].filter(Boolean)
  return [`*${job.title.trim()}* at ${job.companyName.trim()}`, ...details, '', `Apply on JobWahala: ${jobShareLink(job.id, origin)}`].join('\n')
}

/** Opens WhatsApp (the app on a phone, WhatsApp Web on a computer) with the message ready to send. */
export const whatsappShareUrl = (job: ShareableJob, origin?: string) => `https://wa.me/?text=${encodeURIComponent(jobShareMessage(job, origin))}`

// ---------------------------------------------------------------- channels

export type WhatsAppChannel = { key: 'jobs' | 'internships' | 'employers'; label: string; description: string; url: string }

const read = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/** The main JobWahala channel: VITE_WHATSAPP_CHANNEL_URL if set, otherwise the one in src/content/social.ts. */
export const whatsappChannelUrl = () => {
  const configured = read(import.meta.env.VITE_WHATSAPP_CHANNEL_URL)
  return isUsableChannelUrl(configured) ? configured : DEFAULT_WHATSAPP_CHANNEL_URL
}

/** A real channel link: https, on whatsapp.com, and not the placeholder from the example settings file. */
export const isUsableChannelUrl = (value: string) => {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '')
    return url.protocol === 'https:' && (host === 'whatsapp.com' || host === 'chat.whatsapp.com') && !/replace|placeholder|your/i.test(value)
  } catch {
    return false
  }
}

/** The channels that have been set up (their links come from VITE_WHATSAPP_CHANNEL_* settings). */
export const getWhatsAppChannels = (): WhatsAppChannel[] => {
  const env = import.meta.env
  const all: WhatsAppChannel[] = [
    { key: 'jobs', label: 'JobWahala Jobs', description: 'New jobs every day', url: isUsableChannelUrl(read(env.VITE_WHATSAPP_CHANNEL_JOBS)) ? read(env.VITE_WHATSAPP_CHANNEL_JOBS) : whatsappChannelUrl() },
    { key: 'internships', label: 'Internships & NSS', description: 'Internships, National Service and graduate jobs', url: read(env.VITE_WHATSAPP_CHANNEL_INTERNSHIPS) },
    { key: 'employers', label: 'JobWahala for Employers', description: 'Hiring tips and platform news', url: read(env.VITE_WHATSAPP_CHANNEL_EMPLOYERS) },
  ]
  return all.filter((channel) => isUsableChannelUrl(channel.url))
}
