/** CV database words and shapes shared by the employer search page and the job seeker's privacy panel. */

export const EDUCATION_OPTIONS = [
  { value: 'SECONDARY', label: 'Secondary school' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'BACHELORS', label: "Bachelor's degree" },
  { value: 'MASTERS', label: "Master's degree" },
  { value: 'DOCTORATE', label: 'Doctorate' },
] as const

export const AVAILABILITY_OPTIONS = [
  { value: 'IMMEDIATELY', label: 'Available immediately' },
  { value: 'NSS', label: 'National Service (NSS)' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'FULL_TIME', label: 'Full-time' },
] as const

export const ACTIVE_OPTIONS = [
  { value: '7', label: 'In the last 7 days' },
  { value: '30', label: 'In the last 30 days' },
  { value: '90', label: 'In the last 90 days' },
  { value: '365', label: 'In the last year' },
] as const

export const educationLabel = (value?: string | null) => EDUCATION_OPTIONS.find((item) => item.value === value)?.label ?? ''
export const availabilityLabel = (value?: string | null) => AVAILABILITY_OPTIONS.find((item) => item.value === value)?.label ?? ''

export type CandidateFilters = {
  skills?: string
  category?: string
  location?: string
  minYears?: string
  education?: string
  availability?: string
  activeWithinDays?: string
  certificate?: string
}

export type Candidate = {
  id: string
  headline: string
  skills: string
  experienceSummary: string
  location: string | null
  educationLevel: string | null
  availability: string | null
  yearsExperience: number | null
  jobCategory: string | null
  hasVerifiedCertificate: boolean
  lastActiveAt: string | null
  boosted: boolean
  unlocked: boolean
}

export type Allowance = { limit: number; used: number; remaining: number; resetsOn: string }

export type Contact = { name: string; email: string | null; phone: string | null; cv: { url: string; fileName: string | null } | null }

/** Drops empty filters so the request (and a saved search) holds only what was chosen. */
export const compactFilters = (filters: CandidateFilters) => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '' && value !== 'false')) as Record<string, string>
