import { earlyCareerTypes } from './earlyCareer'

export const jobTypeOptions = ['Full-time', 'Part-time', 'Contract', 'Freelance', ...earlyCareerTypes] as const

/** Common fields people search by. Matching is loose, so employers' own wording still works. */
export const jobFieldOptions = [
  'Technology',
  'Sales',
  'Customer service',
  'Finance',
  'Marketing',
  'Education',
  'Healthcare',
  'Hospitality',
  'Logistics',
  'Agriculture',
  'Design',
  'Engineering',
  'Administration',
] as const

type SearchExtras = { category?: string; type?: string }

/** Link to the jobs page pre-filled with what the visitor typed on the homepage. */
export const buildJobSearchPath = (keyword: string, town: string, extras: SearchExtras = {}) => {
  const params = new URLSearchParams()
  if (keyword.trim()) params.set('search', keyword.trim())
  if (town.trim()) params.set('location', town.trim())
  if (extras.category?.trim()) params.set('category', extras.category.trim())
  if (extras.type?.trim()) params.set('type', extras.type.trim())

  const query = params.toString()
  return query ? `/jobs?${query}` : '/jobs'
}

/** The job type named in a link, if it is one we know about. */
export const parseJobType = (value: string | null | undefined) =>
  jobTypeOptions.find((option) => option.toLowerCase() === (value ?? '').trim().toLowerCase()) ?? null

/** True when a job's field loosely matches the one asked for ("tech" matches "Technology"). */
export const matchesJobField = (jobCategory: string | null | undefined, wanted: string) => {
  const target = wanted.trim().toLowerCase()
  if (!target) return true

  const actual = (jobCategory ?? '').trim().toLowerCase()
  if (!actual) return false

  return actual.includes(target) || target.includes(actual) || actual.startsWith(target.slice(0, 4))
}

/** "south-africa" becomes "South Africa". */
export const countryFromSlug = (slug: string | undefined) =>
  (slug ?? '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

export const countrySlug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '-')

export type FieldTile = { name: string; count: number | null }

/** Real fields with live counts when there are jobs; otherwise the common fields people search by. */
export const buildFieldTiles = (jobs: { category?: string | null }[]): FieldTile[] => {
  const counts = new Map<string, { name: string; count: number }>()

  for (const job of jobs) {
    const name = (job.category ?? '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    const current = counts.get(key)
    counts.set(key, { name: current?.name ?? name, count: (current?.count ?? 0) + 1 })
  }

  const live = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8)

  return live.length >= 3 ? live : jobFieldOptions.slice(0, 8).map((name) => ({ name, count: null }))
}

/** "Pay from" choices for the job board, in Ghana cedis a month. 0 means no filter. */
export const salaryFloorOptions = [
  { value: 0, label: 'Any pay' },
  { value: 1000, label: 'GHS 1,000+' },
  { value: 2000, label: 'GHS 2,000+' },
  { value: 3000, label: 'GHS 3,000+' },
  { value: 5000, label: 'GHS 5,000+' },
  { value: 8000, label: 'GHS 8,000+' },
  { value: 12000, label: 'GHS 12,000+' },
] as const

/** The pay level named in a link (?minSalary=3000), or 0 for none or nonsense. */
export const parseSalaryFloor = (value: string | null | undefined) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

type JobPay = { salaryMin?: number | null; salaryMax?: number | null }

/** Does this job's pay reach the level asked for? Pay that was never given as numbers cannot be matched. */
export const matchesSalaryFloor = (job: JobPay, floor: number) => {
  if (floor <= 0) return true
  const top = job.salaryMax ?? job.salaryMin
  return typeof top === 'number' && top >= floor
}
