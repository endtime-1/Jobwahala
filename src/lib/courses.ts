import { SKILLS } from '../content/skills'

/** Courses: what a listing looks like, and the words used to show it. Mirrors backend/src/utils/courses.ts. */

export const courseCategories = [
  { slug: 'technology', name: 'Technology and IT' },
  { slug: 'business', name: 'Business and management' },
  { slug: 'finance-accounting', name: 'Finance and accounting' },
  { slug: 'marketing-sales', name: 'Marketing and sales' },
  { slug: 'design-creative', name: 'Design and creative' },
  { slug: 'office-skills', name: 'Office and admin skills' },
  { slug: 'healthcare', name: 'Healthcare' },
  { slug: 'education-teaching', name: 'Education and teaching' },
  { slug: 'hospitality', name: 'Hospitality and catering' },
  { slug: 'trades-technical', name: 'Trades and technical' },
  { slug: 'agriculture', name: 'Agriculture' },
  { slug: 'languages', name: 'Languages' },
  { slug: 'personal-development', name: 'Personal development' },
] as const

export const courseLevels = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
  { value: 'ALL', label: 'All levels' },
] as const

export const courseFormats = [
  { value: 'ONLINE', label: 'Online' },
  { value: 'IN_PERSON', label: 'In person' },
  { value: 'HYBRID', label: 'Online and in person' },
] as const

export const categoryName = (slug: string) => courseCategories.find((category) => category.slug === slug)?.name ?? slug
export const levelLabel = (value: string) => courseLevels.find((level) => level.value === value)?.label ?? value
export const formatLabel = (value: string) => courseFormats.find((format) => format.value === value)?.label ?? value
export const skillLabel = (slug: string) => SKILLS.find((skill) => skill.slug === slug)?.name ?? slug

export type CourseProvider = { id: string; name: string; logoUrl: string | null; isVerified: boolean }

export type Course = {
  id: string
  slug: string
  title: string
  summary: string
  category: string
  level: string
  isFree: boolean
  priceGhs: number | null
  durationWeeks: number | null
  format: string
  location: string | null
  startDates: string[]
  rollingStart: boolean
  certificateOffered: boolean
  enrolUrl: string | null
  enquiryEnabled: boolean
  skills: string[]
  featured: boolean
  createdAt: string
  provider: CourseProvider
}

export const priceLabel = (course: Pick<Course, 'isFree' | 'priceGhs'>) =>
  course.isFree ? 'Free' : course.priceGhs != null ? `GHS ${course.priceGhs.toLocaleString('en-GB')}` : 'Ask for the price'

export const durationText = (weeks?: number | null) => {
  if (!weeks) return ''
  if (weeks < 8) return weeks === 1 ? '1 week' : `${weeks} weeks`
  const months = Math.round(weeks / 4.345)
  return months === 1 ? '1 month' : `${months} months`
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** When it starts, in plain words: "Any time", the next dates, or nothing when none are given. */
export const startText = (course: Pick<Course, 'startDates' | 'rollingStart'>, now = new Date()) => {
  if (course.rollingStart) return 'Starts any time'
  const upcoming = course.startDates.filter((date) => new Date(`${date}T23:59:59Z`).getTime() >= now.getTime()).sort()
  if (upcoming.length === 0) return ''
  return `Next start: ${dayFormat.format(new Date(upcoming[0]))}`
}

export type CourseFilters = {
  search: string
  category: string
  skill: string
  level: string
  format: string
  location: string
  price: string // '' | 'free' | a maximum in GHS
  verified: boolean
}

export const emptyCourseFilters: CourseFilters = { search: '', category: '', skill: '', level: '', format: '', location: '', price: '', verified: false }

export const hasCourseFilters = (filters: CourseFilters) => JSON.stringify(filters) !== JSON.stringify(emptyCourseFilters)

export const priceFilterOptions = [
  { value: '', label: 'Any price' },
  { value: 'free', label: 'Free' },
  { value: '200', label: 'Up to GHS 200' },
  { value: '500', label: 'Up to GHS 500' },
  { value: '1000', label: 'Up to GHS 1,000' },
  { value: '3000', label: 'Up to GHS 3,000' },
] as const

/** What the server is asked for. */
export const courseFilterParams = (filters: CourseFilters): Record<string, string> => {
  const params: Record<string, string> = {}
  if (filters.search.trim()) params.q = filters.search.trim()
  if (filters.category) params.category = filters.category
  if (filters.skill) params.skill = filters.skill
  if (filters.level) params.level = filters.level
  if (filters.format) params.format = filters.format
  if (filters.location.trim()) params.location = filters.location.trim()
  if (filters.price === 'free') params.free = '1'
  else if (filters.price) params.maxPrice = filters.price
  if (filters.verified) params.verified = '1'
  return params
}

/** "[skill] courses in Ghana" address for a skill. */
export const skillCoursesPath = (skill: string) => `/${skill}-courses-in-ghana`
export const looksLikeSkillCoursesSlug = (slug: string) => /^[a-z0-9-]+-courses-in-ghana$/.test(slug)
export const skillFromCoursesSlug = (slug: string) => {
  const match = /^([a-z0-9-]+)-courses-in-ghana$/.exec(slug)
  return match && SKILLS.some((skill) => skill.slug === match[1]) ? match[1] : null
}

/** A learner's completed course, as shown on their profile and to employers. */
export type LearnerCourse = {
  id: string
  courseId?: string | null
  courseSlug?: string | null
  title: string
  providerName: string | null
  completedOn: string | null
  certificateUrl: string | null
  status: 'SELF' | 'REQUESTED' | 'CONFIRMED' | 'DECLINED'
  decisionNote?: string | null
}
