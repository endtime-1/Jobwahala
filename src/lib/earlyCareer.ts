/**
 * Early-career opportunities: internships, National Service, attachments and graduate jobs.
 * The backend keeps the same list in backend/src/utils/earlyCareer.ts.
 */
export const earlyCareerTypes = [
  'Internship',
  'National Service (NSS)',
  'Industrial Attachment',
  'Graduate / Entry-level Job',
] as const

export type EarlyCareerType = (typeof earlyCareerTypes)[number]

const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

export const isEarlyCareerType = (type?: string | null) => earlyCareerTypes.some((known) => same(known, type))

export const careerStages = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'NSS', label: 'National Service personnel' },
  { value: 'GRADUATE', label: 'Graduate' },
] as const

export type CareerStage = (typeof careerStages)[number]['value']

export const careerStageLabel = (stage?: string | null) => careerStages.find((item) => item.value === stage)?.label ?? ''

/** What an early-career job carries beyond a normal one. */
export type EarlyCareerDetails = {
  type?: string
  unpaid?: boolean
  salary?: string | null
  durationMonths?: number | null
  startsImmediately?: boolean
  startDate?: string | null
  schedule?: string | null
  possibleJobOffer?: boolean
}

export const durationLabel = (months?: number | null) => {
  if (!months) return ''
  if (months % 12 === 0) return months === 12 ? '1 year' : `${months / 12} years`
  return months === 1 ? '1 month' : `${months} months`
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export const startLabel = (job: EarlyCareerDetails) => {
  if (job.startsImmediately) return 'Starts immediately'
  if (job.startDate) {
    const date = new Date(job.startDate)
    return Number.isNaN(date.getTime()) ? '' : `Starts ${dayFormat.format(date)}`
  }
  return ''
}

export const scheduleLabel = (schedule?: string | null) => (schedule === 'PART_TIME' ? 'Part-time' : schedule === 'FULL_TIME' ? 'Full-time' : '')

/** The stipend, or plainly "Unpaid". */
export const stipendLabel = (job: EarlyCareerDetails) => (job.unpaid ? 'Unpaid' : job.salary?.trim() || 'Stipend not stated')

/** The small facts shown on a card, in order. Empty for jobs that are not early-career. */
export const earlyCareerFacts = (job: EarlyCareerDetails) =>
  isEarlyCareerType(job.type)
    ? [durationLabel(job.durationMonths), scheduleLabel(job.schedule), startLabel(job)].filter(Boolean)
    : []

/** How well each type suits each stage: earlier in the list shows first. */
const relevanceOrder: Record<CareerStage, EarlyCareerType[]> = {
  STUDENT: ['Industrial Attachment', 'Internship', 'National Service (NSS)', 'Graduate / Entry-level Job'],
  NSS: ['National Service (NSS)', 'Graduate / Entry-level Job', 'Internship', 'Industrial Attachment'],
  GRADUATE: ['Graduate / Entry-level Job', 'Internship', 'National Service (NSS)', 'Industrial Attachment'],
}

/** Higher = more relevant. 0 when the stage is unknown or the job is not early-career. */
export const relevanceScore = (stage: string | null | undefined, type: string) => {
  const order = relevanceOrder[stage as CareerStage]
  const index = order ? order.findIndex((known) => same(known, type)) : -1
  return index === -1 ? 0 : order.length - index
}

/** Most relevant types first, keeping the existing (newest first) order within each type. */
export const sortByRelevance = <T extends { type: string }>(jobs: T[], stage: string | null | undefined) =>
  stage ? [...jobs].sort((a, b) => relevanceScore(stage, b.type) - relevanceScore(stage, a.type)) : jobs

export const durationFilterOptions = [
  { value: '', label: 'Any length' },
  { value: '1', label: 'Up to 1 month' },
  { value: '3', label: 'Up to 3 months' },
  { value: '6', label: 'Up to 6 months' },
  { value: '12', label: 'Up to 1 year' },
] as const

export const startFilterOptions = [
  { value: '', label: 'Any time' },
  { value: 'now', label: 'Starting immediately' },
  { value: '1', label: 'Within 1 month' },
  { value: '3', label: 'Within 3 months' },
] as const

export const stipendFilterOptions = [
  { value: '', label: 'Any stipend' },
  { value: 'paid', label: 'Paid only' },
  { value: '300', label: 'GHS 300+ a month' },
  { value: '500', label: 'GHS 500+ a month' },
  { value: '1000', label: 'GHS 1,000+ a month' },
] as const

export type EarlyCareerFilters = {
  types: string[]
  location: string
  stipend: string
  duration: string
  start: string
  schedule: string
  offer: boolean
  search: string
}

export const emptyEarlyFilters: EarlyCareerFilters = {
  types: [],
  location: '',
  stipend: '',
  duration: '',
  start: '',
  schedule: '',
  offer: false,
  search: '',
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10)

/** The search the server understands for these filters. */
export const earlyFilterParams = (filters: EarlyCareerFilters, now = new Date()): Record<string, string> => {
  const params: Record<string, string> = { section: 'early' }
  const types = filters.types.filter(isEarlyCareerType)
  if (types.length > 0) params.types = types.join(',')
  if (filters.search.trim()) params.q = filters.search.trim()
  if (filters.location.trim()) params.location = filters.location.trim()
  if (filters.stipend === 'paid') params.paid = '1'
  else if (filters.stipend) params.salaryMin = filters.stipend
  if (filters.duration) params.maxDuration = filters.duration
  if (filters.start === 'now') params.startsNow = '1'
  else if (filters.start) {
    const by = new Date(now)
    by.setUTCMonth(by.getUTCMonth() + Number(filters.start))
    params.startBy = isoDay(by)
  }
  if (filters.schedule) params.schedule = filters.schedule
  if (filters.offer) params.offer = '1'
  return params
}

export const hasEarlyFilters = (filters: EarlyCareerFilters) =>
  JSON.stringify({ ...filters, types: [...filters.types].sort() }) !== JSON.stringify(emptyEarlyFilters)
