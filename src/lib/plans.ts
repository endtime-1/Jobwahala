import type { Product } from './billing'

export type PlanTier = 'FREE' | 'STARTER' | 'BUSINESS'

export type Plan = Product & {
  planTier: PlanTier
  teamLimit: number
  cvDatabase: boolean
  monthlyUnlocks: number
  brandedPage: boolean
  hiringReports: boolean
  topEmployers: boolean
}

export type PlansResponse = {
  mode: 'test' | 'live' | 'off'
  plans: Plan[]
  current: {
    tier: PlanTier
    planName: string
    productId: string | null
    interval: 'MONTHLY' | 'YEARLY' | null
    subscription: { id: string; status: string; currentPeriodEnd: string; graceEndsAt: string | null; cancelAtPeriodEnd: boolean; pendingPlanName: string | null } | null
    features: { teamLimit: number; cvDatabase: boolean; monthlyUnlocks?: number; brandedPage: boolean; hiringReports: boolean; topEmployers: boolean }
  }
  usage: {
    featuredCredits: number
    boostCredits: number
    planCredits: { featured: number; boost: number }
    purchasedCredits: { featured: number; boost: number }
    monthlyFeaturedCredits: number
    monthlyBoostCredits: number
    teamSeatsUsed: number
    teamLimit: number
    unlocksUsed?: number
    monthlyUnlocks?: number
  }
}

const RANK: Record<PlanTier, number> = { FREE: 0, STARTER: 1, BUSINESS: 2 }

/** Same ordering the server uses: a bigger tier is higher, and a yearly plan sits just above its monthly one. */
export const planLevel = (plan: { planTier: PlanTier; interval: 'MONTHLY' | 'YEARLY' | null }) => RANK[plan.planTier] * 10 + (plan.interval === 'YEARLY' ? 1 : 0)

/** The plans of one billing period, with Free always shown. */
export const plansFor = (plans: Plan[], period: 'MONTHLY' | 'YEARLY') => plans.filter((plan) => plan.planTier === 'FREE' || plan.interval === period)

/** How much a yearly plan saves against twelve months of the monthly one, as a whole percent. */
export const yearlySavingPercent = (plans: Plan[], tier: PlanTier) => {
  const monthly = plans.find((plan) => plan.planTier === tier && plan.interval === 'MONTHLY')
  const yearly = plans.find((plan) => plan.planTier === tier && plan.interval === 'YEARLY')
  if (!monthly || !yearly || monthly.totalPesewas <= 0) return 0
  const saving = 1 - yearly.totalPesewas / (monthly.totalPesewas * 12)
  return saving > 0 ? Math.round(saving * 100) : 0
}

export const featureLines = (plan: Pick<Plan, 'planTier' | 'teamLimit' | 'cvDatabase' | 'monthlyUnlocks' | 'brandedPage' | 'hiringReports' | 'topEmployers' | 'featuredCredits' | 'boostCredits'>) => {
  const lines = ['Unlimited standard job posts', 'Applicant board']
  if (plan.featuredCredits > 0) lines.push(`${plan.featuredCredits} featured-job credit${plan.featuredCredits === 1 ? '' : 's'} every month`)
  if (plan.boostCredits > 0) lines.push(`${plan.boostCredits} "Urgently hiring" boost${plan.boostCredits === 1 ? '' : 's'} every month`)
  if (plan.brandedPage) lines.push('Branded company page: cover image, gallery and "Why work with us"')
  lines.push(plan.teamLimit === 1 ? '1 team member (you)' : `Up to ${plan.teamLimit} team members`)
  if (plan.cvDatabase) lines.push(plan.monthlyUnlocks > 0 ? `CV database: ${plan.monthlyUnlocks} profile unlocks every month` : 'CV database access')
  if (plan.hiringReports) lines.push('Hiring reports')
  if (plan.topEmployers) lines.push('Priority in "Top employers"')
  return lines
}
