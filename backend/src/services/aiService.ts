const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export type ProposalDraftContext = {
  type: 'JOB' | 'SERVICE'
  sourceTitle: string
  sourceDescription?: string | null
  counterpartName: string
  counterpartRoleLabel: string
  requestSummary?: string | null
  coverLetter?: string | null
  skills?: string | null
  amountHint?: string | null
  timelineHint?: string | null
  focus?: string | null
  titleHint?: string | null
}

export type GeneratedProposalDraft = {
  title: string
  summary: string
  amount: string
  timeline: string
  message: string
}

export type ProposalComparisonOptionContext = {
  title: string
  type: 'JOB' | 'SERVICE'
  status: string
  counterpartyName: string
  amount?: string | null
  timeline?: string | null
  sourceTitle?: string | null
  sourceStatus?: string | null
}

export type ProposalComparisonContext = {
  options: ProposalComparisonOptionContext[]
}

export type ProposalDecisionBriefContext = {
  type: 'JOB' | 'SERVICE'
  proposalTitle: string
  proposalSummary: string
  proposalAmount?: string | null
  proposalTimeline?: string | null
  expiresAt?: string | null
  sourceTitle?: string | null
  sourceStatus?: string | null
  sourceAmountHint?: string | null
  sourceTimelineHint?: string | null
  counterpartyName: string
  revisionCount: number
  focus?: string | null
}

export type GeneratedProposalDecisionBrief = {
  recommendation: 'ACCEPT' | 'COUNTER' | 'REJECT'
  headline: string
  summary: string
  strengths: string[]
  cautions: string[]
  suggestedMessage: string
}

export type AgreementComparisonOptionContext = {
  title: string
  type: 'JOB' | 'SERVICE'
  status: string
  counterpartyName: string
  amount?: string | null
  sourceTitle?: string | null
  sourceStatus?: string | null
  milestoneCount: number
  completedMilestones: number
  outstandingPayments: number
  hasActiveDispute: boolean
}

export type AgreementComparisonContext = {
  options: AgreementComparisonOptionContext[]
}

export type AgreementDecisionBriefContext = {
  type: 'JOB' | 'SERVICE'
  title: string
  status: string
  summary?: string | null
  amount?: string | null
  sourceTitle?: string | null
  sourceStatus?: string | null
  counterpartyName: string
  milestoneCount: number
  completedMilestones: number
  incompleteMilestones: number
  outstandingPayments: number
  requestedPayments: number
  hasActiveDispute: boolean
  canCompleteNow: boolean
  userRoleLabel: string
  focus?: string | null
}

export type GeneratedAgreementDecisionBrief = {
  recommendation: 'COMPLETE' | 'HOLD' | 'ESCALATE'
  headline: string
  summary: string
  strengths: string[]
  cautions: string[]
  nextAction: string
  suggestedMessage: string
}

export type ShortlistCandidateContext = {
  name: string
  status: string
  fitScore?: number | null
  fitReasons?: string[]
  skills?: string | null
  coverLetter?: string | null
}

export type SeekerProfileOptimizationContext = {
  firstName?: string | null
  lastName?: string | null
  skills?: string | null
  experience?: string | null
  resumeFileUrl?: string | null
  cvCount: number
  latestCvPrompt?: string | null
  recommendedJobs: Array<{
    title: string
    matchScore?: number | null
    matchReasons?: string[]
  }>
}

export type GeneratedSeekerProfileOptimization = {
  score: number
  headline: string
  strengths: string[]
  improvements: string[]
  suggestedSummary: string
  suggestedSkills: string[]
  nextCvPrompt: string
  targetRoles: string[]
}

export type JobApplicationCoachingContext = {
  firstName?: string | null
  lastName?: string | null
  jobTitle: string
  jobDescription?: string | null
  jobType?: string | null
  category?: string | null
  location?: string | null
  salary?: string | null
  skills?: string | null
  experience?: string | null
  existingCoverLetter?: string | null
  matchScore?: number | null
  matchReasons?: string[]
}

export type GeneratedJobApplicationCoaching = {
  score: number
  headline: string
  strengths: string[]
  gaps: string[]
  suggestedCoverLetter: string
  cvPrompt: string
}

export type EmployerApplicantDecisionBriefContext = {
  jobTitle: string
  jobDescription?: string | null
  jobType?: string | null
  category?: string | null
  location?: string | null
  candidateName: string
  applicationStatus: string
  fitScore?: number | null
  fitReasons?: string[]
  skills?: string | null
  experience?: string | null
  coverLetter?: string | null
  hasProposal: boolean
  proposalStatus?: string | null
  hasAgreement: boolean
  agreementStatus?: string | null
  focus?: string | null
}

export type GeneratedEmployerApplicantDecisionBrief = {
  recommendation: 'SHORTLIST' | 'INTERVIEW' | 'SEND_PROPOSAL' | 'HIRE' | 'HOLD'
  headline: string
  summary: string
  strengths: string[]
  cautions: string[]
  nextAction: string
  suggestedMessage: string
}

export type SeekerJobComparisonOptionContext = {
  companyName: string
  jobTitle: string
  matchScore?: number | null
  matchReasons?: string[]
  location?: string | null
  type?: string | null
  salary?: string | null
  category?: string | null
}

export type SeekerJobComparisonContext = {
  options: SeekerJobComparisonOptionContext[]
}

export type ServiceOptimizationContext = {
  firstName?: string | null
  lastName?: string | null
  bio?: string | null
  skills?: string | null
  hourlyRate?: number | null
  title?: string | null
  description?: string | null
  price?: string | null
  deliveryTime?: string | null
  category?: string | null
  focus?: string | null
}

export type GeneratedServiceOptimization = {
  title: string
  description: string
  price: string
  deliveryTime: string
  category: string
  positioning: string
  pricingNote: string
}

export type JobPostOptimizationContext = {
  companyName?: string | null
  industry?: string | null
  website?: string | null
  companyDescription?: string | null
  title?: string | null
  description?: string | null
  location?: string | null
  type?: string | null
  salary?: string | null
  category?: string | null
  focus?: string | null
}

export type GeneratedJobPostOptimization = {
  title: string
  description: string
  location: string
  type: string
  salary: string
  category: string
  positioning: string
  hiringNote: string
}

export type ServiceRequestCoachingContext = {
  clientRole: string
  freelancerName: string
  serviceTitle: string
  serviceDescription?: string | null
  serviceCategory?: string | null
  servicePrice?: string | null
  serviceDeliveryTime?: string | null
  clientSignals?: string | null
  currentBudget?: string | null
  currentTimeline?: string | null
  currentMessage?: string | null
  matchScore?: number | null
  matchReasons?: string[]
}

export type GeneratedServiceRequestCoaching = {
  score: number
  headline: string
  strengths: string[]
  gaps: string[]
  suggestedMessage: string
  suggestedBudget: string
  suggestedTimeline: string
}

export type ServiceComparisonOptionContext = {
  freelancerName: string
  serviceTitle: string
  matchScore?: number | null
  matchReasons?: string[]
  price?: string | null
  deliveryTime?: string | null
  category?: string | null
}

export type ServiceComparisonSummaryContext = {
  clientRole: string
  viewedFreelancerName: string
  viewedService?: ServiceComparisonOptionContext | null
  alternatives: ServiceComparisonOptionContext[]
}

export type MarketplaceFreelancerComparisonContext = {
  clientRole: string
  options: ServiceComparisonOptionContext[]
}

const fallbackCV = (prompt: string) => `# Generated CV

## Professional Summary
Candidate profile generated from the provided prompt.

## Source Prompt
${prompt || 'No prompt was provided.'}

## Experience Highlights
- Add measurable outcomes for recent work.
- Focus on responsibilities that match the target role.

## Skills
- Communication
- Problem Solving
- Team Collaboration
`

const extractOutputText = (payload: any): string => {
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

const extractFirstJsonObject = (value: string) => {
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

const sanitizeProposalField = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback
  }

  return value.trim() || fallback
}

const sanitizeStringArray = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) {
    return fallback
  }

  const next = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 6)

  return next.length > 0 ? next : fallback
}

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

const extractComparableNumber = (value?: string | null) => {
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

const daysUntilIsoDate = (value?: string | null) => {
  if (!value?.trim()) {
    return null
  }

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return null
  }

  return Math.ceil((parsed - Date.now()) / (1000 * 60 * 60 * 24))
}

const parseSkills = (value?: string | null) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const collectSuggestedSkills = (
  explicitSkills: string[],
  recommendedJobs: SeekerProfileOptimizationContext['recommendedJobs'],
) => {
  const suggestions = [...explicitSkills]

  recommendedJobs.forEach((job) => {
    ;(job.matchReasons || []).forEach((reason) => {
      const signal = reason.includes(':') ? reason.split(':').slice(1).join(':') : ''
      signal
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => {
          if (item.length > 2 && !suggestions.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
            suggestions.push(item)
          }
        })
    })
  })

  return suggestions.slice(0, 8)
}

const summarizeContext = (context: ProposalDraftContext) => {
  const focusSummary = context.focus?.trim()
    ? `Priority focus: ${context.focus.trim()}.`
    : ''
  const sourceSummary = context.sourceDescription?.trim()
    ? `Scope context: ${context.sourceDescription.trim()}`
    : ''
  const requestSummary = context.requestSummary?.trim()
    ? `Counterparty request: ${context.requestSummary.trim()}`
    : ''
  const skillsSummary = context.skills?.trim()
    ? `Relevant skills or profile signals: ${context.skills.trim()}`
    : ''
  const coverLetterSummary = context.coverLetter?.trim()
    ? `Application note: ${context.coverLetter.trim()}`
    : ''

  return [sourceSummary, requestSummary, skillsSummary, coverLetterSummary, focusSummary]
    .filter(Boolean)
    .join(' ')
    .trim()
}

const fallbackProposalDraft = (context: ProposalDraftContext): GeneratedProposalDraft => {
  const summaryContext = summarizeContext(context)
  const defaultSummary = context.type === 'JOB'
    ? `This proposal covers the ${context.sourceTitle} role with clear ownership of the agreed responsibilities, steady communication, and measurable delivery against the hiring plan.`
    : `This proposal covers ${context.sourceTitle} with a focused delivery plan, clear scope control, and consistent communication from kickoff through final handoff.`

  return {
    title: sanitizeProposalField(
      context.titleHint,
      `${context.sourceTitle} proposal`,
    ),
    summary: summaryContext
      ? `${defaultSummary} ${summaryContext}`
      : defaultSummary,
    amount: sanitizeProposalField(context.amountHint),
    timeline: sanitizeProposalField(context.timelineHint),
    message: `Open to refining the terms with ${context.counterpartName} if the scope or delivery window needs adjustment.`,
  }
}

export const generateCVFromPrompt = async (prompt: string): Promise<string> => {
  const cleanPrompt = prompt.trim()

  if (!cleanPrompt) {
    return fallbackCV('')
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return fallbackCV(cleanPrompt)
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are an expert CV writer for JobWahala, the premier African talent marketplace. Produce a concise, ATS-friendly CV in Markdown using only the information provided. Focus on highlighting skills relevant to high-growth opportunities in Ghana and the broader African continent. Do not invent employers, degrees, dates, certifications, or achievements. If key details are missing, keep the section generic and clearly useful.',
        input: `Create a professional CV for a JobWahala user from this request:\n\n${cleanPrompt}`,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    if (!output) {
      throw new Error('OpenAI response did not contain text output')
    }

    return output
  } catch {
    return fallbackCV(cleanPrompt)
  }
}

export const generateProposalDraft = async (
  context: ProposalDraftContext,
): Promise<GeneratedProposalDraft> => {
  const fallback = fallbackProposalDraft(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const prompt = `
Draft a concise marketplace proposal in JSON.

Return only valid JSON with this exact shape:
{
  "title": string,
  "summary": string,
  "amount": string,
  "timeline": string,
  "message": string
}

Rules:
- Use only the supplied context.
- Keep the tone professional and direct.
- Do not invent companies, dates, experience, or deliverables that are not implied by the context.
- If amount or timeline is missing, return an empty string for that field.
- Keep "summary" to one compact paragraph.
- Keep "message" to one short negotiation note.

Context:
- Proposal type: ${context.type}
- Source title: ${context.sourceTitle}
- Counterparty: ${context.counterpartName} (${context.counterpartRoleLabel})
- Source description: ${context.sourceDescription || ''}
- Request summary: ${context.requestSummary || ''}
- Cover letter: ${context.coverLetter || ''}
- Relevant skills: ${context.skills || ''}
- Title hint: ${context.titleHint || ''}
- Amount hint: ${context.amountHint || ''}
- Timeline hint: ${context.timelineHint || ''}
- Focus note: ${context.focus || ''}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You draft high-quality freelance and hiring proposals for JobWahala, Africa’s leading workspace for elite talent. Return strict JSON only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    const parsed = extractFirstJsonObject(output)

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenAI response did not contain a valid JSON proposal draft')
    }

    return {
      title: sanitizeProposalField((parsed as Record<string, unknown>).title, fallback.title),
      summary: sanitizeProposalField((parsed as Record<string, unknown>).summary, fallback.summary),
      amount: sanitizeProposalField((parsed as Record<string, unknown>).amount, fallback.amount),
      timeline: sanitizeProposalField((parsed as Record<string, unknown>).timeline, fallback.timeline),
      message: sanitizeProposalField((parsed as Record<string, unknown>).message, fallback.message),
    }
  } catch {
    return fallback
  }
}

const fallbackProposalComparisonSummary = (
  context: ProposalComparisonContext,
) => {
  const proposals = context.options.slice(0, 4)
  const first = proposals[0]
  const second = proposals[1]

  if (!first) {
    return 'No proposal terms are available yet to compare.'
  }

  if (!second) {
    return `${first.title} is the only visible proposal in this comparison set, with ${first.amount || 'open pricing'} and ${first.timeline || 'no explicit timeline'} currently on the table.`
  }

  return `${first.title} and ${second.title} currently offer the clearest comparison. ${first.counterpartyName} is proposing ${first.amount || 'open pricing'} over ${first.timeline || 'an unspecified timeline'}, while ${second.counterpartyName} is proposing ${second.amount || 'open pricing'} over ${second.timeline || 'an unspecified timeline'}. Compare the scope summary, timing, and source status before deciding.`
}

export const generateProposalComparisonSummary = async (
  context: ProposalComparisonContext,
): Promise<string> => {
  const fallback = fallbackProposalComparisonSummary(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const optionBlock = context.options
    .slice(0, 4)
    .map((option, index) =>
      [
        `Proposal ${index + 1}: ${option.title}`,
        `Type: ${option.type}`,
        `Status: ${option.status}`,
        `Counterparty: ${option.counterpartyName}`,
        `Amount: ${option.amount || ''}`,
        `Timeline: ${option.timeline || ''}`,
        `Source: ${option.sourceTitle || ''}`,
        `Source status: ${option.sourceStatus || ''}`,
      ].join('\n'),
    )
    .join('\n\n')

  const prompt = `
Write a concise proposal comparison brief for a user reviewing multiple proposal options.

Rules:
- Use only the supplied context.
- Keep it under 180 words.
- Focus on term clarity, amount, timeline, and current source status.
- Keep the tone direct and decision-oriented.
- Return plain text only.

Proposals:
${optionBlock || 'No proposals available.'}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a negotiation decision coach for JobWahala. Your goal is to help users in the African market navigate professional opportunities. Return concise plain text only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    if (!output) {
      throw new Error('OpenAI response did not contain proposal comparison output')
    }

    return output
  } catch {
    return fallback
  }
}

const fallbackProposalDecisionBrief = (
  context: ProposalDecisionBriefContext,
): GeneratedProposalDecisionBrief => {
  const proposalAmountValue = extractComparableNumber(context.proposalAmount)
  const sourceAmountValue = extractComparableNumber(context.sourceAmountHint)
  const expiresInDays = daysUntilIsoDate(context.expiresAt)
  const strengths = []
  const cautions = []

  if (context.proposalSummary.trim().length >= 80) {
    strengths.push('The proposal scope is specific enough to understand what is being offered right now.')
  } else {
    cautions.push('The scope summary is still fairly compact, so make sure the delivery boundaries are explicit before you respond.')
  }

  if (context.proposalAmount?.trim()) {
    strengths.push(`The proposal already puts pricing on the table at ${context.proposalAmount.trim()}.`)
  } else {
    cautions.push('Pricing is still open, which makes it harder to accept the current terms as-is.')
  }

  if (context.proposalTimeline?.trim()) {
    strengths.push(`The timeline is already framed as ${context.proposalTimeline.trim()}.`)
  } else {
    cautions.push('The proposal does not lock a clear timeline yet.')
  }

  if (context.type === 'SERVICE' && proposalAmountValue !== null && sourceAmountValue !== null) {
    if (proposalAmountValue <= sourceAmountValue * 1.1) {
      strengths.push('The quoted amount stays close to the original service budget signal.')
    } else if (proposalAmountValue > sourceAmountValue * 1.4) {
      cautions.push('The price is materially above the original budget signal, so a direct acceptance would be hard to justify.')
    } else {
      cautions.push('The price is above the original budget signal, so you may want to counter on scope or amount.')
    }
  }

  if (context.type === 'JOB' && proposalAmountValue !== null && sourceAmountValue !== null) {
    if (proposalAmountValue >= sourceAmountValue * 0.95) {
      strengths.push('The compensation still tracks closely with the original job salary signal.')
    } else if (proposalAmountValue < sourceAmountValue * 0.8) {
      cautions.push('The offer amount is materially below the original salary signal for this role.')
    } else {
      cautions.push('The offer amount is below the original salary signal, so compensation is worth tightening before you respond.')
    }
  }

  if (expiresInDays !== null && expiresInDays <= 2) {
    cautions.push('The proposal is close to its expiry window, so respond only after the key terms feel clear.')
  }

  if (context.revisionCount >= 3) {
    cautions.push('The terms have already changed several times, so confirm the latest version carefully before you lock it in.')
  }

  let recommendation: GeneratedProposalDecisionBrief['recommendation'] = 'ACCEPT'

  if (
    !context.proposalAmount?.trim() ||
    !context.proposalTimeline?.trim() ||
    cautions.length >= 2
  ) {
    recommendation = 'COUNTER'
  }

  if (
    (context.type === 'SERVICE' &&
      proposalAmountValue !== null &&
      sourceAmountValue !== null &&
      proposalAmountValue > sourceAmountValue * 1.4 &&
      cautions.length >= 2) ||
    (context.type === 'JOB' &&
      proposalAmountValue !== null &&
      sourceAmountValue !== null &&
      proposalAmountValue < sourceAmountValue * 0.8 &&
      cautions.length >= 2)
  ) {
    recommendation = 'REJECT'
  }

  const focusNote = context.focus?.trim()
  const sourceLabel = context.sourceTitle || 'this proposal source'
  const nextActionSummary =
    recommendation === 'ACCEPT'
      ? `The terms from ${context.counterpartyName} look clear enough to move ${sourceLabel} into the agreement stage without another negotiation round.`
      : recommendation === 'COUNTER'
        ? `The proposal looks workable, but ${sourceLabel} still needs tighter terms before you accept what ${context.counterpartyName} has offered.`
        : `The current terms look materially misaligned for ${sourceLabel}, so rejecting this version is safer than locking in a weak deal.`

  const cautionSummary = cautions[0]
    ? ` Main caution: ${cautions[0]}`
    : ''

  const focusSummary = focusNote
    ? ` Priority focus: ${focusNote}.`
    : ''

  return {
    recommendation,
    headline:
      recommendation === 'ACCEPT'
        ? 'These terms look ready to move forward.'
        : recommendation === 'COUNTER'
          ? 'Counter once before you commit.'
          : 'Reject this version and wait for better terms.',
    summary: `${nextActionSummary}${cautionSummary}${focusSummary}`.trim(),
    strengths: strengths.slice(0, 3),
    cautions: cautions.slice(0, 3),
    suggestedMessage:
      recommendation === 'ACCEPT'
        ? `These terms look workable from my side. I am ready to move forward on ${sourceLabel} if the current scope stands.`
        : recommendation === 'COUNTER'
          ? `I am interested in moving forward, but I need a tighter version of the terms on ${sourceLabel}, especially around ${context.proposalAmount?.trim() ? 'price and scope clarity' : 'pricing clarity'}.`
          : `I appreciate the proposal, but the current terms do not align well enough for ${sourceLabel}. I will pass on this version for now.`,
  }
}

export const generateProposalDecisionBrief = async (
  context: ProposalDecisionBriefContext,
): Promise<GeneratedProposalDecisionBrief> => {
  const fallback = fallbackProposalDecisionBrief(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const prompt = `
Generate proposal response coaching in JSON.

Return only valid JSON with this exact shape:
{
  "recommendation": "ACCEPT" | "COUNTER" | "REJECT",
  "headline": string,
  "summary": string,
  "strengths": string[],
  "cautions": string[],
  "suggestedMessage": string
}

Rules:
- Use only the supplied context.
- Recommend ACCEPT only when the terms look clear and workable.
- Recommend COUNTER when the proposal is workable but needs refinement.
- Recommend REJECT when the terms look materially misaligned.
- Keep summary concise and decision-oriented.
- Keep strengths and cautions practical.
- Keep suggestedMessage to one compact paragraph.
- Do not invent deliverables, budgets, salaries, or negotiation facts.

Context:
- Proposal type: ${context.type}
- Proposal title: ${context.proposalTitle}
- Proposal summary: ${context.proposalSummary}
- Proposal amount: ${context.proposalAmount || ''}
- Proposal timeline: ${context.proposalTimeline || ''}
- Proposal expiry: ${context.expiresAt || ''}
- Source title: ${context.sourceTitle || ''}
- Source status: ${context.sourceStatus || ''}
- Source amount hint: ${context.sourceAmountHint || ''}
- Source timeline hint: ${context.sourceTimelineHint || ''}
- Counterparty: ${context.counterpartyName}
- Revision count: ${context.revisionCount}
- Focus note: ${context.focus || ''}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a negotiation decision coach. Return strict JSON only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    const parsed = extractFirstJsonObject(output)

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenAI response did not contain valid proposal decision JSON')
    }

    const record = parsed as Record<string, unknown>
    const recommendation =
      record.recommendation === 'ACCEPT' ||
      record.recommendation === 'COUNTER' ||
      record.recommendation === 'REJECT'
        ? record.recommendation
        : fallback.recommendation

    return {
      recommendation,
      headline: sanitizeProposalField(record.headline, fallback.headline),
      summary: sanitizeProposalField(record.summary, fallback.summary),
      strengths: sanitizeStringArray(record.strengths, fallback.strengths),
      cautions: sanitizeStringArray(record.cautions, fallback.cautions),
      suggestedMessage: sanitizeProposalField(record.suggestedMessage, fallback.suggestedMessage),
    }
  } catch {
    return fallback
  }
}

const fallbackAgreementComparisonSummary = (
  context: AgreementComparisonContext,
) => {
  const agreements = context.options.slice(0, 4)
  const first = agreements[0]
  const second = agreements[1]

  if (!first) {
    return 'No agreement records are available yet to compare.'
  }

  if (!second) {
    return `${first.title} is the only visible agreement in this comparison set, currently ${first.status.toLowerCase()} with ${first.completedMilestones}/${first.milestoneCount} milestones completed and ${first.outstandingPayments} payout step${first.outstandingPayments === 1 ? '' : 's'} still open.`
  }

  return `${first.title} and ${second.title} are the clearest agreements to compare right now. ${first.counterpartyName}'s agreement is ${first.status.toLowerCase()} with ${first.completedMilestones}/${first.milestoneCount} milestones complete and ${first.outstandingPayments} outstanding payout step${first.outstandingPayments === 1 ? '' : 's'}, while ${second.counterpartyName}'s agreement is ${second.status.toLowerCase()} with ${second.completedMilestones}/${second.milestoneCount} milestones complete and ${second.outstandingPayments} outstanding payout step${second.outstandingPayments === 1 ? '' : 's'}. Review source status, milestone pace, and dispute risk before prioritizing next action.`
}

export const generateAgreementComparisonSummary = async (
  context: AgreementComparisonContext,
): Promise<string> => {
  const fallback = fallbackAgreementComparisonSummary(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const optionBlock = context.options
    .slice(0, 4)
    .map((option, index) =>
      [
        `Agreement ${index + 1}: ${option.title}`,
        `Type: ${option.type}`,
        `Status: ${option.status}`,
        `Counterparty: ${option.counterpartyName}`,
        `Amount: ${option.amount || ''}`,
        `Source: ${option.sourceTitle || ''}`,
        `Source status: ${option.sourceStatus || ''}`,
        `Milestones: ${option.completedMilestones}/${option.milestoneCount}`,
        `Outstanding payments: ${option.outstandingPayments}`,
        `Active dispute: ${option.hasActiveDispute ? 'yes' : 'no'}`,
      ].join('\n'),
    )
    .join('\n\n')

  const prompt = `
Write a concise agreement comparison brief for a user reviewing multiple active or recent work agreements.

Rules:
- Use only the supplied context.
- Keep it under 180 words.
- Focus on work progress, payout readiness, dispute risk, and source status.
- Keep the tone direct and decision-oriented.
- Return plain text only.

Agreements:
${optionBlock || 'No agreements available.'}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a work operations decision coach. Return concise plain text only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    if (!output) {
      throw new Error('OpenAI response did not contain agreement comparison output')
    }

    return output
  } catch {
    return fallback
  }
}

const fallbackShortlistSummary = (
  jobTitle: string,
  candidates: ShortlistCandidateContext[],
  focus?: string | null,
) => {
  const topCandidates = candidates.slice(0, 3)
  const headline =
    topCandidates.length > 0
      ? `Top shortlist signal for ${jobTitle}: ${topCandidates[0].name} currently leads the pool${topCandidates[0].fitScore ? ` with a ${topCandidates[0].fitScore}% fit score` : ''}.`
      : `No applicants are available yet for ${jobTitle}.`

  const details = topCandidates
    .map((candidate, index) => {
      const reasons = (candidate.fitReasons || []).slice(0, 2).join('; ')
      return `${index + 1}. ${candidate.name} (${candidate.status}${candidate.fitScore ? `, ${candidate.fitScore}% fit` : ''})${reasons ? ` - ${reasons}` : ''}`
    })
    .join('\n')

  const focusLine = focus?.trim() ? `Focus note: ${focus.trim()}` : ''

  return [headline, details, focusLine].filter(Boolean).join('\n\n').trim()
}

export const generateEmployerShortlistSummary = async ({
  jobTitle,
  jobDescription,
  focus,
  candidates,
}: {
  jobTitle: string
  jobDescription?: string | null
  focus?: string | null
  candidates: ShortlistCandidateContext[]
}): Promise<string> => {
  const fallback = fallbackShortlistSummary(jobTitle, candidates, focus)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const candidateBlock = candidates
    .slice(0, 6)
    .map((candidate, index) => {
      const fitReasons = (candidate.fitReasons || []).join('; ')
      return [
        `Candidate ${index + 1}: ${candidate.name}`,
        `Status: ${candidate.status}`,
        `Fit score: ${candidate.fitScore ?? 'n/a'}`,
        `Reasons: ${fitReasons}`,
        `Skills: ${candidate.skills || ''}`,
        `Cover letter: ${candidate.coverLetter || ''}`,
      ].join('\n')
    })
    .join('\n\n')

  const prompt = `
Write a concise shortlist brief for an employer.

Rules:
- Use only the provided context.
- Keep it under 180 words.
- Mention the strongest candidates first.
- Reference fit signals and current statuses.
- End with a short recommendation for the next hiring step.
- Return plain text only.

Job title: ${jobTitle}
Job description: ${jobDescription || ''}
Employer focus note: ${focus || ''}

Candidates:
${candidateBlock || 'No candidates available.'}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You summarize hiring pipelines for employers. Return concise, accurate plain text only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    if (!output) {
      throw new Error('OpenAI response did not contain a shortlist summary')
    }

    return output
  } catch {
    return fallback
  }
}

const fallbackApplicantComparisonSummary = (
  jobTitle: string,
  candidates: ShortlistCandidateContext[],
  focus?: string | null,
) => {
  const compared = candidates.slice(0, 4)

  if (compared.length === 0) {
    return `No applicants are available yet to compare for ${jobTitle}.`
  }

  const ordered = compared
    .map((candidate) => ({
      ...candidate,
      fitScore: candidate.fitScore ?? 0,
    }))
    .sort((left, right) => (right.fitScore ?? 0) - (left.fitScore ?? 0))

  const leader = ordered[0]
  const runnerUp = ordered[1]
  const leaderReasons = (leader.fitReasons || []).slice(0, 2).join('; ')
  const runnerUpReasons = runnerUp ? (runnerUp.fitReasons || []).slice(0, 2).join('; ') : ''

  const lines = [
    `${leader.name} currently leads the comparison for ${jobTitle}${leader.fitScore ? ` with a ${leader.fitScore}% fit score` : ''}.`,
    leaderReasons ? `Lead strengths: ${leaderReasons}.` : '',
    runnerUp
      ? `${runnerUp.name} is the closest alternative${runnerUp.fitScore ? ` at ${runnerUp.fitScore}% fit` : ''}${runnerUpReasons ? `, with signals in ${runnerUpReasons}.` : '.'}`
      : 'No strong second-place comparison is available yet.',
    focus?.trim() ? `Decision focus: ${focus.trim()}` : '',
  ].filter(Boolean)

  return lines.join('\n\n').trim()
}

export const generateEmployerApplicantComparisonSummary = async ({
  jobTitle,
  jobDescription,
  focus,
  candidates,
}: {
  jobTitle: string
  jobDescription?: string | null
  focus?: string | null
  candidates: ShortlistCandidateContext[]
}): Promise<string> => {
  const fallback = fallbackApplicantComparisonSummary(jobTitle, candidates, focus)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const candidateBlock = candidates
    .slice(0, 6)
    .map((candidate, index) => {
      const fitReasons = (candidate.fitReasons || []).join('; ')
      return [
        `Candidate ${index + 1}: ${candidate.name}`,
        `Status: ${candidate.status}`,
        `Fit score: ${candidate.fitScore ?? 'n/a'}`,
        `Reasons: ${fitReasons}`,
        `Skills: ${candidate.skills || ''}`,
        `Cover letter: ${candidate.coverLetter || ''}`,
      ].join('\n')
    })
    .join('\n\n')

  const prompt = `
Write a concise employer comparison brief for the strongest applicants.

Rules:
- Use only the supplied context.
- Compare the strongest candidates, not every applicant equally.
- Explain who currently leads and why.
- Mention one reasonable alternative if present.
- Keep the summary concise and decision-oriented.

Job title: ${jobTitle}
Job description: ${jobDescription || ''}
Focus note: ${focus || ''}

Candidates:
${candidateBlock}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a recruiting decision coach. Return concise plain text only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    if (!output) {
      throw new Error('OpenAI response did not contain comparison output')
    }

    return output
  } catch {
    return fallback
  }
}

const fallbackEmployerApplicantDecisionBrief = (
  context: EmployerApplicantDecisionBriefContext,
): GeneratedEmployerApplicantDecisionBrief => {
  const fitScore = context.fitScore ?? 0
  const strengths = []
  const cautions = []

  if ((context.fitReasons || []).length > 0) {
    strengths.push(...(context.fitReasons || []).slice(0, 2))
  }

  if ((context.skills || '').trim()) {
    strengths.push(`The applicant profile already surfaces relevant skills: ${(context.skills || '').trim()}.`)
  }

  if ((context.coverLetter || '').trim()) {
    strengths.push('A tailored cover letter is already on file for this applicant.')
  } else {
    cautions.push('There is no substantive cover letter yet, so some motivation and communication signal is still missing.')
  }

  if (context.hasAgreement) {
    cautions.push(
      `This applicant already has an agreement in ${context.agreementStatus || 'active'} status, so the decision should move through agreement management instead of another hiring stage.`,
    )
  }

  if (context.hasProposal) {
    cautions.push(
      `There is already a proposal in ${context.proposalStatus || 'active'} status, so the next move should account for those live terms first.`,
    )
  }

  if (fitScore < 70) {
    cautions.push('The current fit score is still below a strong interview-ready threshold.')
  }

  let recommendation: GeneratedEmployerApplicantDecisionBrief['recommendation'] = 'HOLD'

  if (context.hasAgreement || context.hasProposal) {
    recommendation = 'HOLD'
  } else if (context.applicationStatus === 'INTERVIEW' && fitScore >= 92) {
    recommendation = 'HIRE'
  } else if (context.applicationStatus === 'INTERVIEW' && fitScore >= 80) {
    recommendation = 'SEND_PROPOSAL'
  } else if (context.applicationStatus === 'SHORTLISTED' && fitScore >= 72) {
    recommendation = 'INTERVIEW'
  } else if (context.applicationStatus === 'SUBMITTED' && fitScore >= 65) {
    recommendation = 'SHORTLIST'
  }

  const focusNote = context.focus?.trim() ? ` Priority focus: ${context.focus.trim()}.` : ''
  const summary =
    recommendation === 'HIRE'
      ? `${context.candidateName} looks strong enough to move from interview review into a final hiring decision for ${context.jobTitle}.${focusNote}`.trim()
      : recommendation === 'SEND_PROPOSAL'
        ? `${context.candidateName} appears ready for offer-stage terms, but the safer next step is to move through a proposal rather than jump straight to hire.${focusNote}`.trim()
        : recommendation === 'INTERVIEW'
          ? `${context.candidateName} has enough fit signal to justify a live interview round for ${context.jobTitle}.${focusNote}`.trim()
          : recommendation === 'SHORTLIST'
            ? `${context.candidateName} looks promising enough to advance into the shortlist pool while you keep comparing the rest of the pipeline.${focusNote}`.trim()
            : `${context.candidateName} should stay on hold until the active proposal, agreement, or missing signal gap is resolved for ${context.jobTitle}.${focusNote}`.trim()

  const nextAction =
    recommendation === 'HIRE'
      ? 'Confirm the final interview signal and move the applicant into a hire decision.'
      : recommendation === 'SEND_PROPOSAL'
        ? 'Open a proposal with clear scope, amount, and start timing before you promote the applicant further.'
        : recommendation === 'INTERVIEW'
          ? 'Schedule the interview and pressure-test the strongest fit reasons against real delivery examples.'
          : recommendation === 'SHORTLIST'
            ? 'Move the applicant into the shortlist stage and keep comparing them against stronger interview-ready options.'
            : context.hasAgreement
              ? 'Manage the existing agreement instead of changing this applicant stage again.'
              : context.hasProposal
                ? 'Review the live proposal terms before you change the application stage again.'
                : 'Hold the stage for now and collect the missing signal before you advance this applicant.'

  const suggestedMessage =
    recommendation === 'HIRE'
      ? `Your profile and recent interview signal make you a strong final candidate for ${context.jobTitle}. We are ready to move this into the last hiring step.`
      : recommendation === 'SEND_PROPOSAL'
        ? `Your application is moving well for ${context.jobTitle}. I want to move the conversation into concrete proposal terms so we can align on scope, timing, and compensation.`
        : recommendation === 'INTERVIEW'
          ? `Your application for ${context.jobTitle} is standing out. I would like to move you into an interview so we can test the strongest fit areas in more depth.`
          : recommendation === 'SHORTLIST'
            ? `Your application for ${context.jobTitle} has enough strength to move into the shortlist round while we continue the review process.`
            : context.hasAgreement
              ? `We already have an active agreement tied to this application, so the next update should happen through that agreement record instead of another stage change.`
              : context.hasProposal
                ? `We already have proposal terms open on this application, so I want to resolve those terms before making another hiring-stage change.`
                : `I want to hold this application briefly while I review the remaining fit signals for ${context.jobTitle}.`

  return {
    recommendation,
    headline:
      recommendation === 'HIRE'
        ? `${context.candidateName} looks ready for a final hire decision.`
        : recommendation === 'SEND_PROPOSAL'
          ? `${context.candidateName} is in a proposal-ready zone.`
          : recommendation === 'INTERVIEW'
            ? `${context.candidateName} is worth moving into interview.`
            : recommendation === 'SHORTLIST'
              ? `${context.candidateName} is worth advancing into the shortlist.`
              : `${context.candidateName} should stay in a hold state for now.`,
    summary,
    strengths: strengths.slice(0, 3),
    cautions: cautions.slice(0, 3),
    nextAction,
    suggestedMessage,
  }
}

export const generateEmployerApplicantDecisionBrief = async (
  context: EmployerApplicantDecisionBriefContext,
): Promise<GeneratedEmployerApplicantDecisionBrief> => {
  const fallback = fallbackEmployerApplicantDecisionBrief(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const prompt = `
Generate employer applicant decision coaching in JSON.

Return only valid JSON with this exact shape:
{
  "recommendation": "SHORTLIST" | "INTERVIEW" | "SEND_PROPOSAL" | "HIRE" | "HOLD",
  "headline": string,
  "summary": string,
  "strengths": string[],
  "cautions": string[],
  "nextAction": string,
  "suggestedMessage": string
}

Rules:
- Use only the supplied context.
- SHORTLIST means the applicant should advance one stage from submitted review.
- INTERVIEW means the applicant should move into a live interview round.
- SEND_PROPOSAL means the applicant is ready for concrete offer/proposal terms before a final hire.
- HIRE means the applicant looks ready for a final hire decision.
- HOLD means the employer should not advance the applicant yet.
- If there is already an active proposal or agreement, bias toward HOLD unless the context clearly supports another step.
- Keep the summary decision-oriented.
- Keep strengths and cautions practical.
- Keep nextAction concrete.
- Keep suggestedMessage to one compact paragraph.
- Do not invent interviews, offer terms, or qualifications that are not in context.

Context:
- Job title: ${context.jobTitle}
- Job description: ${context.jobDescription || ''}
- Job type: ${context.jobType || ''}
- Category: ${context.category || ''}
- Location: ${context.location || ''}
- Candidate name: ${context.candidateName}
- Application status: ${context.applicationStatus}
- Fit score: ${context.fitScore ?? 'n/a'}
- Fit reasons: ${(context.fitReasons || []).join('; ')}
- Skills: ${context.skills || ''}
- Experience: ${context.experience || ''}
- Cover letter: ${context.coverLetter || ''}
- Has proposal: ${context.hasProposal ? 'yes' : 'no'}
- Proposal status: ${context.proposalStatus || ''}
- Has agreement: ${context.hasAgreement ? 'yes' : 'no'}
- Agreement status: ${context.agreementStatus || ''}
- Focus note: ${context.focus || ''}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are an expert recruiting decision coach. Return strict JSON only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    if (!output) {
      throw new Error('OpenAI response did not contain applicant decision output')
    }

    const parsed = extractFirstJsonObject(output) as GeneratedEmployerApplicantDecisionBrief | null
    if (
      !parsed ||
      !['SHORTLIST', 'INTERVIEW', 'SEND_PROPOSAL', 'HIRE', 'HOLD'].includes(
        parsed.recommendation as string,
      ) ||
      typeof parsed.headline !== 'string' ||
      typeof parsed.summary !== 'string' ||
      !Array.isArray(parsed.strengths) ||
      !Array.isArray(parsed.cautions) ||
      typeof parsed.nextAction !== 'string' ||
      typeof parsed.suggestedMessage !== 'string'
    ) {
      throw new Error('OpenAI response shape was invalid')
    }

    return {
      recommendation: parsed.recommendation,
      headline: parsed.headline.trim() || fallback.headline,
      summary: parsed.summary.trim() || fallback.summary,
      strengths: sanitizeStringArray(parsed.strengths, fallback.strengths),
      cautions: sanitizeStringArray(parsed.cautions, fallback.cautions),
      nextAction: parsed.nextAction.trim() || fallback.nextAction,
      suggestedMessage: parsed.suggestedMessage.trim() || fallback.suggestedMessage,
    }
  } catch {
    return fallback
  }
}

const fallbackAgreementDecisionBrief = (
  context: AgreementDecisionBriefContext,
): GeneratedAgreementDecisionBrief => {
  const strengths = []
  const cautions = []

  if (context.milestoneCount > 0) {
    strengths.push(
      `${context.completedMilestones} of ${context.milestoneCount} milestone${context.milestoneCount === 1 ? '' : 's'} are already complete.`,
    )
  } else {
    cautions.push('There are no milestone checkpoints yet, so completion readiness is harder to verify from the record.')
  }

  if (context.amount?.trim()) {
    strengths.push(`The agreement amount is clearly recorded at ${context.amount.trim()}.`)
  }

  if (context.outstandingPayments > 0) {
    cautions.push(
      `${context.outstandingPayments} payout step${context.outstandingPayments === 1 ? '' : 's'} still need to clear before the work looks financially closed.`,
    )
  }

  if (context.requestedPayments > 0) {
    cautions.push(
      `${context.requestedPayments} milestone payout request${context.requestedPayments === 1 ? '' : 's'} still need a final payment response.`,
    )
  }

  if (context.incompleteMilestones > 0) {
    cautions.push(
      `${context.incompleteMilestones} milestone${context.incompleteMilestones === 1 ? '' : 's'} still show work in progress.`,
    )
  }

  if (context.hasActiveDispute) {
    cautions.push('An active dispute is open, so agreement closure should wait until that issue is resolved.')
  }

  let recommendation: GeneratedAgreementDecisionBrief['recommendation'] = 'HOLD'

  if (context.hasActiveDispute) {
    recommendation = 'ESCALATE'
  } else if (context.canCompleteNow) {
    recommendation = 'COMPLETE'
  }

  const focusNote = context.focus?.trim()
    ? ` Priority focus: ${context.focus.trim()}.`
    : ''

  const summary =
    recommendation === 'COMPLETE'
      ? `This agreement looks operationally clear enough to close: milestone delivery and payout checkpoints are aligned for ${context.sourceTitle || context.title}.`
      : recommendation === 'ESCALATE'
        ? `This agreement should stay in issue-resolution mode because dispute risk is already active around ${context.sourceTitle || context.title}.`
        : `Keep this agreement active until the remaining work, payout, or confirmation steps are cleared for ${context.sourceTitle || context.title}.${focusNote}`.trim()

  const nextAction =
    recommendation === 'COMPLETE'
      ? 'Confirm the final deliverable state and close the agreement.'
      : context.hasActiveDispute
        ? 'Resolve the dispute path before you move milestones, payout, or completion any further.'
        : context.requestedPayments > 0
          ? context.userRoleLabel.toLowerCase().includes('payer')
            ? 'Review the requested payout and clear the payment action if the milestone is ready.'
            : 'Follow up on the requested payout before treating the work as fully closed.'
          : context.outstandingPayments > 0
            ? context.userRoleLabel.toLowerCase().includes('worker') || context.userRoleLabel.toLowerCase().includes('payee')
              ? 'Request or follow through on the remaining payout steps before you close the record.'
              : 'Clear the remaining payout steps before you close the record.'
            : context.incompleteMilestones > 0
              ? 'Push the remaining milestones to completion before you consider closing this agreement.'
              : 'Keep the agreement active while you confirm the remaining operational details.'

  return {
    recommendation,
    headline:
      recommendation === 'COMPLETE'
        ? 'This work record looks ready to close.'
        : recommendation === 'ESCALATE'
          ? 'Resolve the blocker before you move further.'
          : 'Hold the agreement open until the remaining steps clear.',
    summary,
    strengths: strengths.slice(0, 3),
    cautions: cautions.slice(0, 3),
    nextAction,
    suggestedMessage:
      recommendation === 'COMPLETE'
        ? `From my side, the work record looks ready to close. If you agree the deliverables and payout steps are settled, we can complete this agreement.`
        : recommendation === 'ESCALATE'
          ? `There is still an active blocker on this agreement, so I need us to resolve that issue before we move the work forward or close it.`
          : `I want to keep this agreement active until we clear the remaining delivery or payout step on ${context.sourceTitle || context.title}.`,
  }
}

export const generateAgreementDecisionBrief = async (
  context: AgreementDecisionBriefContext,
): Promise<GeneratedAgreementDecisionBrief> => {
  const fallback = fallbackAgreementDecisionBrief(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const prompt = `
Generate agreement workflow coaching in JSON.

Return only valid JSON with this exact shape:
{
  "recommendation": "COMPLETE" | "HOLD" | "ESCALATE",
  "headline": string,
  "summary": string,
  "strengths": string[],
  "cautions": string[],
  "nextAction": string,
  "suggestedMessage": string
}

Rules:
- Use only the supplied context.
- Recommend COMPLETE only when the work record looks ready to close.
- Recommend HOLD when the agreement should stay active while remaining work or payout steps clear.
- Recommend ESCALATE when dispute risk or a serious blocker should take priority.
- Keep summary concise and operational.
- Keep strengths and cautions practical.
- Keep nextAction concrete.
- Keep suggestedMessage to one compact paragraph.
- Do not invent milestones, disputes, payments, or delivery facts.

Context:
- Agreement type: ${context.type}
- Agreement title: ${context.title}
- Agreement status: ${context.status}
- Agreement summary: ${context.summary || ''}
- Agreement amount: ${context.amount || ''}
- Source title: ${context.sourceTitle || ''}
- Source status: ${context.sourceStatus || ''}
- Counterparty: ${context.counterpartyName}
- Milestones total: ${context.milestoneCount}
- Milestones completed: ${context.completedMilestones}
- Milestones incomplete: ${context.incompleteMilestones}
- Outstanding payments: ${context.outstandingPayments}
- Requested payments: ${context.requestedPayments}
- Active dispute: ${context.hasActiveDispute ? 'yes' : 'no'}
- Can complete now: ${context.canCompleteNow ? 'yes' : 'no'}
- User role label: ${context.userRoleLabel}
- Focus note: ${context.focus || ''}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a work operations decision coach for JobWahala, specialized in the African freelancer and employment market. Return strict JSON only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    const parsed = extractFirstJsonObject(output)

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenAI response did not contain valid agreement decision JSON')
    }

    const record = parsed as Record<string, unknown>
    const recommendation =
      record.recommendation === 'COMPLETE' ||
      record.recommendation === 'HOLD' ||
      record.recommendation === 'ESCALATE'
        ? record.recommendation
        : fallback.recommendation

    return {
      recommendation,
      headline: sanitizeProposalField(record.headline, fallback.headline),
      summary: sanitizeProposalField(record.summary, fallback.summary),
      strengths: sanitizeStringArray(record.strengths, fallback.strengths),
      cautions: sanitizeStringArray(record.cautions, fallback.cautions),
      nextAction: sanitizeProposalField(record.nextAction, fallback.nextAction),
      suggestedMessage: sanitizeProposalField(record.suggestedMessage, fallback.suggestedMessage),
    }
  } catch {
    return fallback
  }
}

const fallbackSeekerJobComparisonSummary = (
  context: SeekerJobComparisonContext,
) => {
  const rankedOptions = context.options
    .map((option) => ({
      ...option,
      matchScore: option.matchScore ?? 0,
    }))
    .sort((left, right) => (right.matchScore ?? 0) - (left.matchScore ?? 0))

  const leader = rankedOptions[0]
  const runnerUp = rankedOptions[1]

  if (!leader) {
    return 'No role options are available yet to compare.'
  }

  if (!runnerUp) {
    return `${leader.jobTitle} at ${leader.companyName} currently stands out${leader.matchScore ? ` with a ${leader.matchScore}% fit score` : ''}, strongest in ${(leader.matchReasons || []).slice(0, 2).join('; ') || 'visible role-fit signals'}.`
  }

  return `${leader.jobTitle} at ${leader.companyName} currently leads the selected comparison${leader.matchScore ? ` at ${leader.matchScore}% fit` : ''}, especially around ${(leader.matchReasons || []).slice(0, 2).join('; ') || 'role alignment'}. ${runnerUp.jobTitle} at ${runnerUp.companyName} is the closest alternative${runnerUp.matchScore ? ` at ${runnerUp.matchScore}% fit` : ''}, with strength in ${(runnerUp.matchReasons || []).slice(0, 2).join('; ') || 'adjacent role coverage'}.`
}

export const generateSeekerJobComparisonSummary = async (
  context: SeekerJobComparisonContext,
): Promise<string> => {
  const fallback = fallbackSeekerJobComparisonSummary(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const optionBlock = context.options
    .slice(0, 4)
    .map((option, index) =>
      [
        `Option ${index + 1}: ${option.jobTitle}`,
        `Company: ${option.companyName}`,
        `Match score: ${option.matchScore ?? 'n/a'}`,
        `Reasons: ${(option.matchReasons || []).join('; ')}`,
        `Location: ${option.location || ''}`,
        `Type: ${option.type || ''}`,
        `Salary: ${option.salary || ''}`,
        `Category: ${option.category || ''}`,
      ].join('\n'),
    )
    .join('\n\n')

  const prompt = `
Write a concise job comparison brief for a seeker reviewing several role options.

Rules:
- Use only the supplied context.
- Keep it under 180 words.
- Rank the strongest option first.
- Mention one useful alternative if present.
- Keep the tone direct, practical, and decision-oriented.
- Return plain text only.

Selected jobs:
${optionBlock || 'No jobs available.'}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a job search decision coach. Return concise plain text only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    if (!output) {
      throw new Error('OpenAI response did not contain job comparison output')
    }

    return output
  } catch {
    return fallback
  }
}

const fallbackSeekerProfileOptimization = (
  context: SeekerProfileOptimizationContext,
): GeneratedSeekerProfileOptimization => {
  const name = [context.firstName, context.lastName].filter(Boolean).join(' ').trim() || 'This candidate'
  const skillList = parseSkills(context.skills)
  const targetRoles = context.recommendedJobs
    .slice(0, 3)
    .map((job) => job.title)
  const suggestedSkills = collectSuggestedSkills(skillList, context.recommendedJobs)

  let score = 15
  if (context.firstName?.trim()) score += 10
  if (context.lastName?.trim()) score += 10
  if (skillList.length >= 3) score += 20
  if ((context.experience || '').trim().length >= 80) score += 25
  if (context.resumeFileUrl?.trim()) score += 10
  if (context.cvCount > 0) score += 10

  const strengths = []
  if (skillList.length >= 3) {
    strengths.push(`Your skill stack is already specific enough to support stronger job matching: ${skillList.slice(0, 4).join(', ')}.`)
  }
  if ((context.experience || '').trim().length >= 80) {
    strengths.push('Your experience section already gives employers a clearer signal about delivery scope and prior work.')
  }
  if (context.recommendedJobs[0]?.matchReasons?.[0]) {
    strengths.push(`You already align with current demand signals such as ${context.recommendedJobs[0].matchReasons[0].toLowerCase()}.`)
  }
  if (context.cvCount > 0) {
    strengths.push(`You already have ${context.cvCount} saved CV draft${context.cvCount === 1 ? '' : 's'} to refine for new roles.`)
  }

  const improvements = []
  if (!context.resumeFileUrl?.trim()) {
    improvements.push('Upload a resume link or keep generating CV drafts so employers can quickly review a polished candidate record.')
  }
  if (skillList.length < 5) {
    improvements.push('Expand your skills list with tools, frameworks, and domain keywords that match the roles you want next.')
  }
  if ((context.experience || '').trim().length < 120) {
    improvements.push('Add a more specific experience narrative with shipped work, measurable outcomes, and collaboration scope.')
  }
  if (context.cvCount === 0) {
    improvements.push('Generate and save at least one CV draft so you have a reusable base for future applications.')
  }
  if (improvements.length === 0) {
    improvements.push('Refresh your CV summary for each target role so your strongest skills and outcomes stay visible.')
  }

  const focusRoles = targetRoles.length > 0 ? targetRoles.join(', ') : 'frontend, product, or delivery-focused roles'
  const focusSkills = suggestedSkills.slice(0, 4).join(', ') || 'your strongest shipped skills'
  const suggestedSummary = `${name} is a results-oriented job seeker with experience in ${(context.experience || 'professional delivery and cross-functional execution').trim()}. Strong fit signals include ${focusSkills}. Best aligned next roles include ${focusRoles}.`
  const nextCvPrompt = `Create an ATS-friendly CV for ${name} targeting ${focusRoles}. Emphasize ${focusSkills}, highlight concrete delivery outcomes, and keep the summary concise and recruiter-ready.`

  return {
    score: clampScore(score),
    headline:
      targetRoles.length > 0
        ? `${name} is currently best positioned for ${targetRoles[0]} opportunities.`
        : `${name} can improve discoverability with a sharper profile summary and skill signal.`,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    suggestedSummary,
    suggestedSkills: suggestedSkills.slice(0, 6),
    nextCvPrompt,
    targetRoles,
  }
}

export const generateSeekerProfileOptimization = async (
  context: SeekerProfileOptimizationContext,
): Promise<GeneratedSeekerProfileOptimization> => {
  const fallback = fallbackSeekerProfileOptimization(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const prompt = `
Generate seeker profile optimization advice in JSON.

Return only valid JSON with this exact shape:
{
  "score": number,
  "headline": string,
  "strengths": string[],
  "improvements": string[],
  "suggestedSummary": string,
  "suggestedSkills": string[],
  "nextCvPrompt": string,
  "targetRoles": string[]
}

Rules:
- Use only the supplied context.
- Keep strengths and improvements concise and practical.
- Do not invent employers, achievements, or certifications.
- Keep the suggested summary to one compact paragraph.
- Keep targetRoles to the best-matching role titles from the supplied context.

Context:
- First name: ${context.firstName || ''}
- Last name: ${context.lastName || ''}
- Skills: ${context.skills || ''}
- Experience: ${context.experience || ''}
- Resume URL present: ${context.resumeFileUrl ? 'yes' : 'no'}
- Saved CV count: ${context.cvCount}
- Latest CV prompt: ${context.latestCvPrompt || ''}
- Recommended jobs:
${context.recommendedJobs
  .slice(0, 5)
  .map((job, index) => [
    `Job ${index + 1}: ${job.title}`,
    `Match score: ${job.matchScore ?? 'n/a'}`,
    `Reasons: ${(job.matchReasons || []).join('; ')}`,
  ].join('\n'))
  .join('\n\n')}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a recruiter-oriented career coach. Return strict JSON only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    const parsed = extractFirstJsonObject(output)

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenAI response did not contain valid optimization JSON')
    }

    const record = parsed as Record<string, unknown>

    return {
      score:
        typeof record.score === 'number' && Number.isFinite(record.score)
          ? clampScore(record.score)
          : fallback.score,
      headline: sanitizeProposalField(record.headline, fallback.headline),
      strengths: sanitizeStringArray(record.strengths, fallback.strengths),
      improvements: sanitizeStringArray(record.improvements, fallback.improvements),
      suggestedSummary: sanitizeProposalField(record.suggestedSummary, fallback.suggestedSummary),
      suggestedSkills: sanitizeStringArray(record.suggestedSkills, fallback.suggestedSkills),
      nextCvPrompt: sanitizeProposalField(record.nextCvPrompt, fallback.nextCvPrompt),
      targetRoles: sanitizeStringArray(record.targetRoles, fallback.targetRoles),
    }
  } catch {
    return fallback
  }
}

const fallbackJobApplicationCoaching = (
  context: JobApplicationCoachingContext,
): GeneratedJobApplicationCoaching => {
  const name = context.firstName?.trim() || 'This candidate'
  const parsedSkills = parseSkills(context.skills)
  const score = clampScore(context.matchScore ?? (parsedSkills.length > 0 ? 74 : 52))

  const strengths = []
  if ((context.matchReasons || []).length > 0) {
    strengths.push(...(context.matchReasons || []).slice(0, 2))
  }
  if (parsedSkills.length > 0) {
    strengths.push(`You already have relevant seeker profile signals for this role, including ${parsedSkills.slice(0, 4).join(', ')}.`)
  }
  if ((context.existingCoverLetter || '').trim()) {
    strengths.push('You already have a saved cover note that can be refined for this role.')
  }

  const gaps = []
  if (!(context.existingCoverLetter || '').trim()) {
    gaps.push('Write a tailored cover note that connects your strongest skills directly to this role.')
  }
  if ((context.experience || '').trim().length < 120) {
    gaps.push('Add more specific delivery outcomes to your experience so employers can see shipped work and scope.')
  }
  if (parsedSkills.length < 5) {
    gaps.push('Expand your profile skills with tools, frameworks, and role-specific keywords from the job description.')
  }
  if (gaps.length === 0) {
    gaps.push('Refine your next application around outcomes, ownership, and the exact scope of this role.')
  }

  const roleFocus = context.category || context.jobType || context.jobTitle
  const skillFocus = parsedSkills.slice(0, 4).join(', ') || 'relevant product and delivery skills'
  const suggestedCoverLetter = `${name} is applying for the ${context.jobTitle} role with a focus on ${skillFocus}. My background includes ${(context.experience || 'hands-on delivery across related product work').trim()}, and I would bring clear ownership, communication, and execution to this role.`
  const cvPrompt = `Create an ATS-friendly CV tailored to the ${context.jobTitle} role. Emphasize ${skillFocus}, highlight measurable outcomes, and align the summary with ${roleFocus}.`

  return {
    score,
    headline:
      score >= 80
        ? `You already look like a strong candidate for ${context.jobTitle}.`
        : `You have a workable profile for ${context.jobTitle}, but the application will be stronger with a sharper role-specific note.`,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 3),
    suggestedCoverLetter,
    cvPrompt,
  }
}

export const generateJobApplicationCoaching = async (
  context: JobApplicationCoachingContext,
): Promise<GeneratedJobApplicationCoaching> => {
  const fallback = fallbackJobApplicationCoaching(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const prompt = `
Generate job application coaching in JSON.

Return only valid JSON with this exact shape:
{
  "score": number,
  "headline": string,
  "strengths": string[],
  "gaps": string[],
  "suggestedCoverLetter": string,
  "cvPrompt": string
}

Rules:
- Use only the supplied context.
- Keep strengths and gaps concise and practical.
- Do not invent employers, achievements, or qualifications.
- Keep suggestedCoverLetter to one compact paragraph.
- Keep cvPrompt short and actionable.

Context:
- Candidate first name: ${context.firstName || ''}
- Candidate last name: ${context.lastName || ''}
- Job title: ${context.jobTitle}
- Job description: ${context.jobDescription || ''}
- Job type: ${context.jobType || ''}
- Category: ${context.category || ''}
- Location: ${context.location || ''}
- Salary: ${context.salary || ''}
- Skills: ${context.skills || ''}
- Experience: ${context.experience || ''}
- Existing cover letter: ${context.existingCoverLetter || ''}
- Match score: ${context.matchScore ?? 'n/a'}
- Match reasons: ${(context.matchReasons || []).join('; ')}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are an expert job application coach. Return strict JSON only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    const parsed = extractFirstJsonObject(output)

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenAI response did not contain valid job coaching JSON')
    }

    const record = parsed as Record<string, unknown>

    return {
      score:
        typeof record.score === 'number' && Number.isFinite(record.score)
          ? clampScore(record.score)
          : fallback.score,
      headline: sanitizeProposalField(record.headline, fallback.headline),
      strengths: sanitizeStringArray(record.strengths, fallback.strengths),
      gaps: sanitizeStringArray(record.gaps, fallback.gaps),
      suggestedCoverLetter: sanitizeProposalField(record.suggestedCoverLetter, fallback.suggestedCoverLetter),
      cvPrompt: sanitizeProposalField(record.cvPrompt, fallback.cvPrompt),
    }
  } catch {
    return fallback
  }
}

const fallbackServiceOptimization = (
  context: ServiceOptimizationContext,
): GeneratedServiceOptimization => {
  const skills = parseSkills(context.skills)
  const freelancerName =
    [context.firstName, context.lastName].filter(Boolean).join(' ').trim() || 'This freelancer'
  const serviceCategory = sanitizeProposalField(context.category, skills[0] || 'Creative')
  const serviceTitle = sanitizeProposalField(
    context.title,
    skills[0]
      ? `${skills[0]} service package`
      : `${serviceCategory} service package`,
  )
  const focusSummary = sanitizeProposalField(context.focus)
  const deliveryTime = sanitizeProposalField(context.deliveryTime, '5 days')
  const price = sanitizeProposalField(
    context.price,
    context.hourlyRate && Number.isFinite(context.hourlyRate)
      ? String(Math.max(50, Math.round(Number(context.hourlyRate) * 6)))
      : '250',
  )

  const descriptionParts = [
    `${freelancerName} delivers ${serviceTitle.toLowerCase()} with a clear scope, dependable communication, and structured handoff.`,
    context.bio?.trim() ? `Profile signal: ${context.bio.trim()}` : '',
    skills.length > 0 ? `Core tools and strengths include ${skills.slice(0, 5).join(', ')}.` : '',
    focusSummary ? `Priority focus: ${focusSummary}.` : '',
  ].filter(Boolean)

  return {
    title: serviceTitle,
    description: sanitizeProposalField(
      context.description,
      descriptionParts.join(' '),
    ),
    price,
    deliveryTime,
    category: serviceCategory,
    positioning: `${serviceTitle} is positioned as a scoped ${serviceCategory.toLowerCase()} offer with clear delivery boundaries and quality signals.`,
    pricingNote:
      context.hourlyRate && Number.isFinite(context.hourlyRate)
        ? `Current pricing stays anchored to your profile hourly signal of ${context.hourlyRate}.`
        : 'Anchor pricing to scope, revisions, and delivery speed so buyers understand the service value quickly.',
  }
}

export const generateServiceOptimization = async (
  context: ServiceOptimizationContext,
): Promise<GeneratedServiceOptimization> => {
  const fallback = fallbackServiceOptimization(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const prompt = `
Generate a freelancer marketplace service draft in JSON.

Return only valid JSON with this exact shape:
{
  "title": string,
  "description": string,
  "price": string,
  "deliveryTime": string,
  "category": string,
  "positioning": string,
  "pricingNote": string
}

Rules:
- Use only the supplied context.
- Keep the description to one compact paragraph.
- Keep positioning and pricingNote concise and practical.
- Do not invent clients, outcomes, or certifications.
- If price or deliveryTime is missing, suggest a reasonable value from the supplied context.

Context:
- Freelancer first name: ${context.firstName || ''}
- Freelancer last name: ${context.lastName || ''}
- Bio: ${context.bio || ''}
- Skills: ${context.skills || ''}
- Hourly rate: ${context.hourlyRate ?? ''}
- Current title: ${context.title || ''}
- Current description: ${context.description || ''}
- Current price: ${context.price || ''}
- Current delivery time: ${context.deliveryTime || ''}
- Current category: ${context.category || ''}
- Focus note: ${context.focus || ''}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a freelance marketplace growth coach. Return strict JSON only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    const parsed = extractFirstJsonObject(output)

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenAI response did not contain valid service optimization JSON')
    }

    const record = parsed as Record<string, unknown>

    return {
      title: sanitizeProposalField(record.title, fallback.title),
      description: sanitizeProposalField(record.description, fallback.description),
      price: sanitizeProposalField(record.price, fallback.price),
      deliveryTime: sanitizeProposalField(record.deliveryTime, fallback.deliveryTime),
      category: sanitizeProposalField(record.category, fallback.category),
      positioning: sanitizeProposalField(record.positioning, fallback.positioning),
      pricingNote: sanitizeProposalField(record.pricingNote, fallback.pricingNote),
    }
  } catch {
    return fallback
  }
}

const fallbackJobPostOptimization = (
  context: JobPostOptimizationContext,
): GeneratedJobPostOptimization => {
  const companyName = sanitizeProposalField(context.companyName, 'Your team')
  const title = sanitizeProposalField(
    context.title,
    context.category ? `${context.category} specialist` : 'Team contributor',
  )
  const location = sanitizeProposalField(context.location, 'Remote')
  const type = sanitizeProposalField(context.type, 'Full-time')
  const category = sanitizeProposalField(context.category, context.industry || 'General')
  const salary = sanitizeProposalField(context.salary)
  const focus = sanitizeProposalField(context.focus)

  const descriptionParts = [
    `${companyName} is hiring a ${title} to own meaningful delivery and collaborate across the core workflow.`,
    context.companyDescription?.trim() ? `Company context: ${context.companyDescription.trim()}` : '',
    context.description?.trim() ? `Role scope: ${context.description.trim()}` : '',
    focus ? `Priority focus: ${focus}.` : '',
  ].filter(Boolean)

  return {
    title,
    description: descriptionParts.join(' '),
    location,
    type,
    salary,
    category,
    positioning: `${title} is positioned as a clear-impact role for ${companyName}, with scope and ownership phrased to attract stronger applicants quickly.`,
    hiringNote:
      salary
        ? `Keep the salary framing specific and pair it with the most important scope so qualified candidates can self-select faster.`
        : `Consider adding salary guidance or a concrete compensation range to improve applicant quality and reduce mismatch.`,
  }
}

export const generateJobPostOptimization = async (
  context: JobPostOptimizationContext,
): Promise<GeneratedJobPostOptimization> => {
  const fallback = fallbackJobPostOptimization(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const prompt = `
Generate a concise job post draft in JSON.

Return only valid JSON with this exact shape:
{
  "title": string,
  "description": string,
  "location": string,
  "type": string,
  "salary": string,
  "category": string,
  "positioning": string,
  "hiringNote": string
}

Rules:
- Use only the supplied context.
- Keep the description to one compact paragraph.
- Keep positioning and hiringNote concise and practical.
- Do not invent benefits, technologies, company claims, or compensation that are not implied by the context.
- If salary is missing, return an empty string or a short prompt to clarify compensation.

Context:
- Company name: ${context.companyName || ''}
- Industry: ${context.industry || ''}
- Website: ${context.website || ''}
- Company description: ${context.companyDescription || ''}
- Current title: ${context.title || ''}
- Current description: ${context.description || ''}
- Current location: ${context.location || ''}
- Current job type: ${context.type || ''}
- Current salary: ${context.salary || ''}
- Current category: ${context.category || ''}
- Focus note: ${context.focus || ''}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a recruiting operations coach. Return strict JSON only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    const parsed = extractFirstJsonObject(output)

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenAI response did not contain valid job post optimization JSON')
    }

    const record = parsed as Record<string, unknown>

    return {
      title: sanitizeProposalField(record.title, fallback.title),
      description: sanitizeProposalField(record.description, fallback.description),
      location: sanitizeProposalField(record.location, fallback.location),
      type: sanitizeProposalField(record.type, fallback.type),
      salary: sanitizeProposalField(record.salary, fallback.salary),
      category: sanitizeProposalField(record.category, fallback.category),
      positioning: sanitizeProposalField(record.positioning, fallback.positioning),
      hiringNote: sanitizeProposalField(record.hiringNote, fallback.hiringNote),
    }
  } catch {
    return fallback
  }
}

const fallbackServiceRequestCoaching = (
  context: ServiceRequestCoachingContext,
): GeneratedServiceRequestCoaching => {
  const score = clampScore(context.matchScore ?? (context.clientSignals ? 72 : 54))
  const strengths = []
  if ((context.matchReasons || []).length > 0) {
    strengths.push(...(context.matchReasons || []).slice(0, 2))
  }
  if (context.clientSignals?.trim()) {
    strengths.push('You already have enough context to send a focused service brief instead of a generic inquiry.')
  }

  const gaps = []
  if (!(context.currentMessage || '').trim()) {
    gaps.push('Spell out the deliverable, deadline, and success criteria so the freelancer can scope quickly.')
  }
  if (!(context.currentBudget || '').trim()) {
    gaps.push('Add a budget anchor so the freelancer can confirm scope fit faster.')
  }
  if (!(context.currentTimeline || '').trim()) {
    gaps.push('Include a timing window or launch deadline to reduce back-and-forth.')
  }
  if (gaps.length === 0) {
    gaps.push('Tighten the brief around deliverables, timeline, and approval steps before sending.')
  }

  const suggestedBudget = sanitizeProposalField(context.currentBudget, context.servicePrice || '')
  const suggestedTimeline = sanitizeProposalField(
    context.currentTimeline,
    context.serviceDeliveryTime || '2 weeks',
  )
  const suggestedMessage = sanitizeProposalField(
    context.currentMessage,
    `I want support with ${context.serviceTitle.toLowerCase()} for a live project. The priority is a clean scope, clear communication, and final delivery that matches the agreed quality bar. ${context.clientSignals?.trim() ? `Relevant context: ${context.clientSignals.trim()}.` : ''}`.trim(),
  )

  return {
    score,
    headline:
      score >= 80
        ? `${context.serviceTitle} looks like a strong fit for your current request.`
        : `You can still send a solid request for ${context.serviceTitle}, but the brief should be more specific before submitting.`,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 3),
    suggestedMessage,
    suggestedBudget,
    suggestedTimeline,
  }
}

export const generateServiceRequestCoaching = async (
  context: ServiceRequestCoachingContext,
): Promise<GeneratedServiceRequestCoaching> => {
  const fallback = fallbackServiceRequestCoaching(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const prompt = `
Generate service request coaching in JSON.

Return only valid JSON with this exact shape:
{
  "score": number,
  "headline": string,
  "strengths": string[],
  "gaps": string[],
  "suggestedMessage": string,
  "suggestedBudget": string,
  "suggestedTimeline": string
}

Rules:
- Use only the supplied context.
- Keep strengths and gaps concise and practical.
- Keep suggestedMessage to one compact paragraph.
- Do not invent company claims, project requirements, or budget figures beyond what is implied by the context.

Context:
- Client role: ${context.clientRole}
- Freelancer name: ${context.freelancerName}
- Service title: ${context.serviceTitle}
- Service description: ${context.serviceDescription || ''}
- Service category: ${context.serviceCategory || ''}
- Service price: ${context.servicePrice || ''}
- Service delivery time: ${context.serviceDeliveryTime || ''}
- Client signals: ${context.clientSignals || ''}
- Current budget: ${context.currentBudget || ''}
- Current timeline: ${context.currentTimeline || ''}
- Current message: ${context.currentMessage || ''}
- Match score: ${context.matchScore ?? 'n/a'}
- Match reasons: ${(context.matchReasons || []).join('; ')}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a freelance marketplace buying coach. Return strict JSON only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    const parsed = extractFirstJsonObject(output)

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('OpenAI response did not contain valid service coaching JSON')
    }

    const record = parsed as Record<string, unknown>

    return {
      score:
        typeof record.score === 'number' && Number.isFinite(record.score)
          ? clampScore(record.score)
          : fallback.score,
      headline: sanitizeProposalField(record.headline, fallback.headline),
      strengths: sanitizeStringArray(record.strengths, fallback.strengths),
      gaps: sanitizeStringArray(record.gaps, fallback.gaps),
      suggestedMessage: sanitizeProposalField(record.suggestedMessage, fallback.suggestedMessage),
      suggestedBudget: sanitizeProposalField(record.suggestedBudget, fallback.suggestedBudget),
      suggestedTimeline: sanitizeProposalField(record.suggestedTimeline, fallback.suggestedTimeline),
    }
  } catch {
    return fallback
  }
}

const fallbackServiceComparisonSummary = (
  context: ServiceComparisonSummaryContext,
) => {
  const viewed = context.viewedService
  const topAlternative = context.alternatives[0]

  if (!viewed) {
    return `No active service context is available yet for ${context.viewedFreelancerName}.`
  }

  if (!topAlternative) {
    return `${context.viewedFreelancerName} currently looks like your clearest visible fit around ${viewed.serviceTitle}${viewed.matchScore ? ` with a ${viewed.matchScore}% match score` : ''}. The service signals are strongest in ${(viewed.matchReasons || []).slice(0, 2).join('; ') || 'scope alignment and delivery fit'}.`
  }

  return `${context.viewedFreelancerName} currently leads with ${viewed.serviceTitle}${viewed.matchScore ? ` at ${viewed.matchScore}% fit` : ''}, especially around ${(viewed.matchReasons || []).slice(0, 2).join('; ') || 'scope alignment'}. The strongest nearby alternative is ${topAlternative.serviceTitle} from ${topAlternative.freelancerName}${topAlternative.matchScore ? ` at ${topAlternative.matchScore}% fit` : ''}, which looks strongest for ${(topAlternative.matchReasons || []).slice(0, 2).join('; ') || 'adjacent scope coverage'}.`
}

export const generateServiceComparisonSummary = async (
  context: ServiceComparisonSummaryContext,
): Promise<string> => {
  const fallback = fallbackServiceComparisonSummary(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const viewedService = context.viewedService
  const alternativeBlock = context.alternatives
    .slice(0, 4)
    .map((alternative, index) =>
      [
        `Alternative ${index + 1}: ${alternative.serviceTitle}`,
        `Freelancer: ${alternative.freelancerName}`,
        `Match score: ${alternative.matchScore ?? 'n/a'}`,
        `Reasons: ${(alternative.matchReasons || []).join('; ')}`,
        `Price: ${alternative.price || ''}`,
        `Delivery: ${alternative.deliveryTime || ''}`,
        `Category: ${alternative.category || ''}`,
      ].join('\n'),
    )
    .join('\n\n')

  const prompt = `
Write a concise marketplace comparison brief for a client reviewing one freelancer profile against alternative services.

Rules:
- Use only the supplied context.
- Keep it under 170 words.
- Explain why the viewed freelancer currently looks strong or weak.
- Mention the strongest alternative if one exists.
- Keep the tone direct and decision-oriented.
- Return plain text only.

Client role: ${context.clientRole}
Viewed freelancer: ${context.viewedFreelancerName}
Viewed service: ${viewedService?.serviceTitle || ''}
Viewed score: ${viewedService?.matchScore ?? 'n/a'}
Viewed reasons: ${(viewedService?.matchReasons || []).join('; ')}
Viewed price: ${viewedService?.price || ''}
Viewed delivery: ${viewedService?.deliveryTime || ''}
Viewed category: ${viewedService?.category || ''}

Alternatives:
${alternativeBlock || 'No alternatives available.'}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a freelance marketplace comparison coach. Return concise plain text only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    if (!output) {
      throw new Error('OpenAI response did not contain service comparison output')
    }

    return output
  } catch {
    return fallback
  }
}

const fallbackMarketplaceFreelancerComparisonSummary = (
  context: MarketplaceFreelancerComparisonContext,
) => {
  const rankedOptions = context.options
    .map((option) => ({
      ...option,
      matchScore: option.matchScore ?? 0,
    }))
    .sort((left, right) => (right.matchScore ?? 0) - (left.matchScore ?? 0))

  const leader = rankedOptions[0]
  const runnerUp = rankedOptions[1]

  if (!leader) {
    return 'No comparable freelancer options are available yet.'
  }

  if (!runnerUp) {
    return `${leader.freelancerName} currently stands out with ${leader.serviceTitle}${leader.matchScore ? ` at ${leader.matchScore}% fit` : ''}, especially around ${(leader.matchReasons || []).slice(0, 2).join('; ') || 'scope alignment and delivery fit'}.`
  }

  return `${leader.freelancerName} currently leads the selected comparison with ${leader.serviceTitle}${leader.matchScore ? ` at ${leader.matchScore}% fit` : ''}, strongest in ${(leader.matchReasons || []).slice(0, 2).join('; ') || 'scope alignment'}. ${runnerUp.freelancerName} is the closest alternative through ${runnerUp.serviceTitle}${runnerUp.matchScore ? ` at ${runnerUp.matchScore}% fit` : ''}, with strength in ${(runnerUp.matchReasons || []).slice(0, 2).join('; ') || 'adjacent delivery coverage'}.`
}

export const generateMarketplaceFreelancerComparisonSummary = async (
  context: MarketplaceFreelancerComparisonContext,
): Promise<string> => {
  const fallback = fallbackMarketplaceFreelancerComparisonSummary(context)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallback
  }

  const optionBlock = context.options
    .slice(0, 4)
    .map((option, index) =>
      [
        `Option ${index + 1}: ${option.serviceTitle}`,
        `Freelancer: ${option.freelancerName}`,
        `Match score: ${option.matchScore ?? 'n/a'}`,
        `Reasons: ${(option.matchReasons || []).join('; ')}`,
        `Price: ${option.price || ''}`,
        `Delivery: ${option.deliveryTime || ''}`,
        `Category: ${option.category || ''}`,
      ].join('\n'),
    )
    .join('\n\n')

  const prompt = `
Write a concise marketplace comparison brief for a client reviewing several freelancer options.

Rules:
- Use only the supplied context.
- Keep it under 180 words.
- Rank the strongest option first.
- Mention one useful alternative if present.
- Keep the tone direct, practical, and decision-oriented.
- Return plain text only.

Client role: ${context.clientRole}

Options:
${optionBlock || 'No options available.'}
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        instructions:
          'You are a freelance marketplace decision coach. Return concise plain text only.',
        input: prompt,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'OpenAI request failed')
    }

    const output = extractOutputText(payload)
    if (!output) {
      throw new Error('OpenAI response did not contain marketplace comparison output')
    }

    return output
  } catch {
    return fallback
  }
}
