export type ProfileShareInput = {
  id: string
  name: string
  tagline?: string | null
  bio?: string | null
  skills: string[]
  origin: string
}

const clip = (value: string, max: number) => {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

export const buildProfileShare = ({ id, name, tagline, bio, skills, origin }: ProfileShareInput) => {
  const headline = tagline?.trim() || skills.slice(0, 2).join(' · ') || 'Freelancer on JobWahala'
  const description = clip(
    bio?.trim() ||
      `${skills.length ? `Skills: ${skills.slice(0, 4).join(', ')}. ` : ''}Hire with payments held in escrow until the work is approved.`,
    200,
  )
  const url = `${origin}/freelancers/${id}`

  return {
    title: `${name} — ${headline}`,
    description,
    url,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name,
      description,
      url,
      ...(skills.length ? { knowsAbout: skills.slice(0, 8) } : {}),
    },
  }
}

export const whatsAppShareUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`

export const profileWhatsAppMessage = (name: string, url: string) =>
  `Check out ${name} on JobWahala - payments are held in escrow until the work is approved: ${url}`
