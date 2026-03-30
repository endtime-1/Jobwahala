// ── Shared AI helpers ─────────────────────────────────────────────────
// Utilities used by every domain-specific AI module.

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5'

export const extractOutputText = (payload: any): string => {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim()
  }

  if (!Array.isArray(payload?.output)) {
    return ''
  }

  const parts = payload.output.flatMap((item: any) => {
    if (!Array.isArray(item?.content)) return []

    return item.content
      .map((content: any) => (content?.type === 'output_text' ? String(content.text || '').trim() : ''))
      .filter(Boolean)
  })

  return parts.join('\n\n').trim()
}

export const extractFirstJsonObject = (value: string) => {
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')

  if (start < 0 || end <= start) {
    return null
  }

  try {
    return JSON.parse(value.slice(start, end + 1))
  } catch {
    return null
  }
}

export const sanitizeProposalField = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback
  }

  return value.trim() || fallback
}

export const sanitizeStringArray = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) {
    return fallback
  }

  const next = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 6)

  return next.length > 0 ? next : fallback
}

export const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export const extractComparableNumber = (value?: string | null) => {
  if (!value?.trim()) {
    return null
  }

  const normalized = value.replace(/,/g, '')
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) {
    return null
  }

  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

export const daysUntilIsoDate = (value?: string | null) => {
  if (!value?.trim()) {
    return null
  }

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return null
  }

  return Math.ceil((parsed - Date.now()) / (1000 * 60 * 60 * 24))
}

export const parseSkills = (value?: string | null) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

export const callOpenAI = async (instructions: string, input: string) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      instructions,
      input,
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
  }

  return extractOutputText(payload)
}
