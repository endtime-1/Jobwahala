/** Types and small helpers for the employer-growth features (claim links, referral, weekly report, outreach). */

export type WeeklyJobLine = { jobId: string; title: string; views: number; newApplicants: number; totalApplicants: number; awaitingReview: number }
export type WeeklyReport = {
  weekStart: string
  weekEnd: string
  jobs: WeeklyJobLine[]
  totals: { views: number; newApplicants: number; totalApplicants: number; awaitingReview: number; activeJobs: number }
}

export type ReferralInfo = { code: string; url: string; referred: number; rewarded: number; creditsEarned: number; whatsappUrl: string }

export type ClaimState = 'ACTIVE' | 'CLAIMED' | 'REVOKED' | 'EXPIRED'
export type ManagedCompany = {
  id: string
  companyName: string
  industry: string | null
  contactPhone: string | null
  email: string | null
  claimStatus: 'CLAIMED' | 'UNCLAIMED'
  isFoundingEmployer: boolean
  foundingNumber: number | null
  jobs: number
  claim: { id: string; state: ClaimState; channel: string; sentTo: string | null; sendCount: number; lastSentAt: string; expiresAt: string } | null
}

export const OUTREACH_STATUSES = [
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'NOT_INTERESTED', label: 'Not interested' },
] as const
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number]['value']

export type OutreachContact = {
  id: string
  businessName: string
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  sector: string | null
  location: string | null
  status: OutreachStatus
  notes: string | null
  followUpAt: string | null
  createdAt: string
}

/** A follow-up that is due (today or earlier) on a contact we are still working on. */
export const isFollowUpDue = (contact: Pick<OutreachContact, 'followUpAt' | 'status'>, now = new Date()) =>
  Boolean(contact.followUpAt) &&
  contact.status !== 'POSTED' &&
  contact.status !== 'NOT_INTERESTED' &&
  new Date(contact.followUpAt as string).getTime() < new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime()

const REF_KEY = 'jobwahala_ref'

/** Keeps the referral code from a link until the new employer account exists. */
export const rememberReferral = (code: string | null | undefined) => {
  try {
    if (code && /^jw-[a-z2-9]{6}$/i.test(code.trim())) localStorage.setItem(REF_KEY, code.trim().toUpperCase())
  } catch {
    // Storage can be blocked; the referral is a bonus, not a requirement.
  }
}

export const takeReferral = () => {
  try {
    const code = localStorage.getItem(REF_KEY)
    if (code) localStorage.removeItem(REF_KEY)
    return code
  } catch {
    return null
  }
}

/** "2 Nov to 8 Nov": the end of the report is the Monday after, so the last day shown is the day before it. */
export const weekRangeLabel = (report: Pick<WeeklyReport, 'weekStart' | 'weekEnd'>) => {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${fmt(report.weekStart)} to ${fmt(new Date(new Date(report.weekEnd).getTime() - 86_400_000).toISOString())}`
}
