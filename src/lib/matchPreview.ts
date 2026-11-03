export type PreviewJob = {
  id: string
  title: string
  description?: string | null
  category?: string | null
  location?: string | null
  salary?: string | null
  type?: string | null
  createdAt?: string
}

export type PreviewMatch = {
  job: PreviewJob
  score: number
  matched: string[]
}

const MAX_SKILLS = 8

export const parseSkills = (raw: string): string[] => {
  const seen = new Set<string>()
  const skills: string[] = []

  for (const part of raw.split(/[,\n;|]+/)) {
    const skill = part.trim()
    const key = skill.toLowerCase()
    if (!skill || seen.has(key)) continue
    seen.add(key)
    skills.push(skill)
  }

  return skills.slice(0, MAX_SKILLS)
}

const REGEX_SPECIALS = '.*+?^${}()|[]'
const BACKSLASH = String.fromCharCode(92)

const escapeRegExp = (value: string) =>
  Array.from(value, (ch) => (REGEX_SPECIALS.includes(ch) || ch === BACKSLASH ? BACKSLASH + ch : ch)).join('')

// Whole-word match so "art" never matches "smart" and "java" never matches "javascript".
const mentions = (text: string, skill: string) =>
  new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(skill.toLowerCase())}($|[^a-z0-9+#])`).test(text)

export const scoreJobPreview = (skills: string[], job: PreviewJob): PreviewMatch => {
  const title = (job.title || '').toLowerCase()
  const body = [job.title, job.category, job.description].filter(Boolean).join(' ').toLowerCase()
  const matched = skills.filter((skill) => mentions(body, skill))

  if (matched.length === 0) return { job, score: 0, matched }

  const coverage = matched.length / Math.min(skills.length, 4)
  const titleBonus = matched.some((skill) => mentions(title, skill)) ? 8 : 0
  const score = Math.min(98, Math.round(35 + 55 * Math.min(1, coverage) + titleBonus))

  return { job, score, matched }
}

export const rankJobsForSkills = (skills: string[], jobs: PreviewJob[], limit = 3): PreviewMatch[] =>
  skills.length === 0
    ? []
    : jobs
        .map((job) => scoreJobPreview(skills, job))
        .filter((match) => match.score > 0)
        .sort(
          (a, b) =>
            b.score - a.score ||
            new Date(b.job.createdAt || 0).getTime() - new Date(a.job.createdAt || 0).getTime(),
        )
        .slice(0, limit)
