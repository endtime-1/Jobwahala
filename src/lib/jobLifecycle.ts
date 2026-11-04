// Closing-date helpers shared by the employer dashboard and the job page.

const DAY_MS = 24 * 60 * 60 * 1000

export const DEFAULT_JOB_DAYS = 30
export const MAX_JOB_DAYS = 90

/** YYYY-MM-DD in UTC (Ghana is on UTC), for <input type="date">. */
export const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10)

export const closingDateIn = (days: number, now: Date = new Date()) => toDateInputValue(new Date(now.getTime() + days * DAY_MS))

export const defaultClosingDate = (now: Date = new Date()) => closingDateIn(DEFAULT_JOB_DAYS, now)
export const latestClosingDate = (now: Date = new Date()) => closingDateIn(MAX_JOB_DAYS, now)

/** Whole days until the job closes, rounded up. Zero or less means it has closed. */
export const daysUntil = (iso?: string | null, now: Date = new Date()) => {
  if (!iso) return null
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return null
  return Math.ceil((time - now.getTime()) / DAY_MS)
}

export const formatClosingDate = (iso?: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** "Closes 12 Dec 2026 (5 days left)", "Closes today", or "Closed on 12 Dec 2026". */
export const closingSummary = (iso?: string | null, now: Date = new Date()) => {
  const days = daysUntil(iso, now)
  const date = formatClosingDate(iso)
  if (days === null || !date) return ''
  if (days <= 0) return `Closed on ${date}`
  if (days === 1) return `Closes ${date} (1 day left)`
  return `Closes ${date} (${days} days left)`
}
