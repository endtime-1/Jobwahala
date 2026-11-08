/** Types and wording for the Hiring Service (JobWahala staff recruit for an employer). */

export type HiringInfo = { fromPriceGhs: number | null; guaranteeDays: number }

export type RequestStatus = 'NEW' | 'AGREED' | 'SOURCING' | 'SHORTLIST_SENT' | 'INTERVIEWING' | 'FILLED' | 'CANCELLED'

export const STATUS_LABEL: Record<string, string> = {
  NEW: 'New',
  AGREED: 'Agreed',
  SOURCING: 'Sourcing',
  SHORTLIST_SENT: 'Shortlist sent',
  INTERVIEWING: 'Interviewing',
  FILLED: 'Filled',
  CANCELLED: 'Cancelled',
}

export const STATUS_ORDER: RequestStatus[] = ['NEW', 'AGREED', 'SOURCING', 'SHORTLIST_SENT', 'INTERVIEWING', 'FILLED', 'CANCELLED']

/** What the person on the other side is waiting for, in plain words. */
export const STATUS_HINT: Record<string, string> = {
  NEW: 'We have your request and will contact you to agree the terms.',
  AGREED: 'The terms are agreed. A recruiter is getting started.',
  SOURCING: 'Your recruiter is finding and screening candidates.',
  SHORTLIST_SENT: 'Our shortlist is ready. Tell us who you want to meet.',
  INTERVIEWING: 'You are interviewing. Mark each candidate as you go.',
  FILLED: 'The role is filled. Your replacement guarantee is running.',
  CANCELLED: 'This request was cancelled.',
}

export type RequestSummary = {
  id: string
  reference: string
  roleTitle: string
  status: RequestStatus
  headcount: number
  location: string
  deadline: string | null
  sentAt: string | null
  createdAt: string
}

export type FeeView = {
  agreed: boolean
  feeLabel: string
  depositLabel: string
  balanceLabel: string
  paidLabel: string
  outstandingLabel: string
  depositDuePesewas: number
  balanceDuePesewas: number
  outstandingPesewas: number
  settled: boolean
}

export type ClientCandidate = {
  id: string
  stage: string
  name: string
  headline: string | null
  skills: string | null
  experience: string | null
  location: string | null
  educationLevel: string | null
  yearsExperience: number | null
  verifiedCertificate: boolean
  identityVerified: boolean
  fitScore: number | null
  ratings: { mustHave: string; rating: number | null }[]
  note: string | null
  email: string | null
  phone: string | null
  cv: { url: string; fileName: string | null } | null
  decision: 'INTERVIEW' | 'NOT_SUITABLE' | 'HIRED' | null
  decisionNote: string | null
  startDate: string | null
}

export type TimelineEvent = { id: string; kind: string; body: string; createdAt: string }

export type ClientRequestDetail = {
  request: RequestSummary & {
    salaryMin: number | null
    salaryMax: number | null
    startDate: string | null
    requirements: string
    contactName: string
    contactPhone: string
    mustHaves: string[]
    guaranteeDays: number
    guaranteeEndsAt: string | null
    guaranteeDaysLeft: number | null
    closeReason: string | null
    recruiter: { name: string; title: string | null } | null
    job: { id: string; title: string; status: string } | null
    fee: FeeView | null
    canCancel: boolean
    canRequestReplacement: boolean
  }
  candidates: ClientCandidate[]
  timeline: TimelineEvent[]
}

export type Opportunity = {
  id: string
  stage: string
  answered: boolean
  agreedAt: string | null
  roleTitle: string
  location: string
  salaryMin: number | null
  salaryMax: number | null
  description: string
  company: string
  recruiter: { name: string; title: string | null } | null
  consentText: string
}

export type StaffRequestRow = RequestSummary & {
  company: string
  recruiter: string | null
  assignedRecruiterId: string | null
  guaranteeEndsAt: string | null
  pipeline: { total: number; shortlisted: number }
}

export type StaffCandidate = {
  id: string
  stage: string
  source: string
  consentAt: string | null
  consentAskedAt: string | null
  declineReason: string | null
  fitScore: number | null
  ratings: { mustHave: string; rating: number | null }[]
  note: string | null
  staffNotes: string | null
  shortlistedAt: string | null
  decision: string | null
  decisionNote: string | null
  startDate: string | null
  detailsOpen: boolean
  name: string
  headline: string | null
  skills: string | null
  experience: string | null
  location: string | null
  educationLevel: string | null
  yearsExperience: number | null
  verifiedCertificate: boolean
  identityVerified: boolean
  email: string | null
  phone: string | null
  cv: { url: string; fileName: string | null } | null
}

export type StaffPayment = { id: string; kind: string; amountPesewas: number; amountLabel: string; paidAt: string; method: string | null; reference: string | null; note: string | null }

export type StaffRequestDetail = {
  request: RequestSummary & {
    company: string
    industry: string | null
    salaryMin: number | null
    salaryMax: number | null
    startDate: string | null
    requirements: string
    contactName: string
    contactPhone: string
    mustHaves: string[]
    assignedRecruiterId: string | null
    guaranteeDays: number
    guaranteeEndsAt: string | null
    guaranteeDaysLeft: number | null
    replacementCount: number
    closeReason: string | null
    job: { id: string; title: string; status: string } | null
    // Only an admin is sent these: a recruiter never sees the money.
    fee?: FeeView
    feePesewas?: number | null
    depositPesewas?: number | null
    payments?: StaffPayment[]
  }
  candidates: StaffCandidate[]
  events: { id: string; candidateId: string | null; actorRole: string; kind: string; body: string; visibility: 'STAFF' | 'CLIENT'; createdAt: string }[]
}

export const STAGE_LABEL: Record<string, string> = {
  SOURCED: 'Found',
  CONSENT_ASKED: 'Asked',
  CONSENTED: 'Agreed',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  HIRED: 'Hired',
  DECLINED: 'Said no',
  DROPPED: 'Removed',
  NOT_SUITABLE: 'Not suitable',
}

export type StaffMember = { userId: string; displayName: string; title: string | null; phone: string | null; active: boolean; email: string | null; openRequests: number }

export const salaryLabel = (min: number | null, max: number | null) => {
  const money = (value: number) => `GHS ${value.toLocaleString('en-GH')}`
  if (min && max) return `${money(min)} to ${money(max)} a month`
  if (min) return `From ${money(min)} a month`
  if (max) return `Up to ${money(max)} a month`
  return 'Salary not stated'
}

export const isDone = (status: string) => ['FILLED', 'CANCELLED'].includes(status)

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

/** "12 days left", "Ends today", "Ended 3 days ago". */
export const guaranteeLabel = (daysLeft: number | null) => {
  if (daysLeft === null) return ''
  if (daysLeft < 0) return `Ended ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'day' : 'days'} ago`
  if (daysLeft === 0) return 'Ends today'
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
}
