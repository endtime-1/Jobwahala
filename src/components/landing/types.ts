import type { PreviewJob } from '../../lib/matchPreview'

export type LandingCounts = {
  openJobs: number
  freelancers: number
  seekers: number
  employers: number
  activeServices: number
  totalTalent: number
}

export type LandingJob = PreviewJob & {
  employer?: { email?: string; employerProfile?: { companyName?: string | null; logoUrl?: string | null } | null } | null
  companyName?: string
}

export const companyOf = (job: LandingJob) =>
  job.companyName || job.employer?.employerProfile?.companyName || 'Verified employer'

export const logoOf = (job: LandingJob) => job.employer?.employerProfile?.logoUrl ?? null

export type HiringCompany = {
  id: string
  companyName: string
  industry?: string | null
  logoUrl?: string | null
  isVerified: boolean
  openRoles: number
}

export const timeAgo = (iso?: string) => {
  if (!iso) return ''
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`
}

export const buildWhatsAppInvite = (origin: string) =>
  `https://wa.me/?text=${encodeURIComponent(
    `Found a job site for Africa with real jobs and employers you can check. Free to apply: ${origin}`,
  )}`

// Only show an age for recent roles: "6mo ago" beside an "open" label undersells and confuses.
export const recentAge = (iso?: string, maxDays = 45) =>
  iso && Date.now() - new Date(iso).getTime() <= maxDays * 86_400_000 ? timeAgo(iso) : ''
