/** The course form's values, and how they become what the server wants. */
export type CourseFormValues = {
  title: string
  summary: string
  description: string
  category: string
  level: string
  isFree: boolean
  priceGhs: string
  durationWeeks: string
  format: string
  location: string
  startDates: string[]
  rollingStart: boolean
  certificateOffered: boolean
  enrolUrl: string
  enquiryEnabled: boolean
  skills: string[]
}

export const emptyCourseForm: CourseFormValues = {
  title: '',
  summary: '',
  description: '',
  category: 'technology',
  level: 'BEGINNER',
  isFree: false,
  priceGhs: '',
  durationWeeks: '',
  format: 'ONLINE',
  location: '',
  startDates: [],
  rollingStart: false,
  certificateOffered: false,
  enrolUrl: '',
  enquiryEnabled: true,
  skills: [],
}

const whole = (value: string) => {
  const number = Number(value.replace(/[,\s]/g, ''))
  return value.trim() !== '' && Number.isFinite(number) ? Math.round(number) : null
}

/** The form as the server wants it. */
export const toCoursePayload = (form: CourseFormValues) => ({
  title: form.title.trim(),
  summary: form.summary.trim(),
  description: form.description.trim(),
  category: form.category,
  level: form.level,
  isFree: form.isFree,
  priceGhs: form.isFree ? null : whole(form.priceGhs),
  durationWeeks: whole(form.durationWeeks),
  format: form.format,
  location: form.location.trim() || null,
  startDates: form.rollingStart ? [] : form.startDates,
  rollingStart: form.rollingStart,
  certificateOffered: form.certificateOffered,
  enrolUrl: form.enrolUrl.trim() || null,
  enquiryEnabled: form.enquiryEnabled,
  skills: form.skills,
})
