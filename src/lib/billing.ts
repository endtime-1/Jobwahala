/** Billing words and helpers shared by the billing page, job cards and the admin panel. */

export type Promotion = 'URGENT' | 'FEATURED' | null

export const promotionLabel = (promotion?: Promotion | string | null) =>
  promotion === 'URGENT' ? 'Urgently hiring' : promotion === 'FEATURED' ? 'Featured' : ''

export const ghs = (pesewas: number) => `GHS ${(pesewas / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type Product = {
  id: string
  kind: 'FEATURED_JOB' | 'JOB_BOOST' | 'JOB_PACK' | 'FEATURED_COURSE' | 'SUBSCRIPTION'
  slug: string
  name: string
  description: string
  audience: 'EMPLOYER' | 'PROVIDER'
  durationDays: number | null
  featuredCredits: number
  boostCredits: number
  interval: 'MONTHLY' | 'YEARLY' | null
  includes: string[]
  active: boolean
  sortOrder: number
  priceGhs: number
  totalPesewas: number
  totalLabel: string
  vatPesewas: number
  pricesIncludeVat: boolean
  vatRatePercent: number
}

export const STATUS_LABEL: Record<string, string> = {
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partly refunded',
  PENDING: 'Waiting',
}

/** The label a job shows right now: "Urgently hiring" outranks "Featured"; both end by themselves. */
export const promotionOf = (job: { featuredUntil?: string | null; boostedUntil?: string | null }, now = new Date()): Promotion => {
  const live = (value?: string | null) => Boolean(value && new Date(value).getTime() > now.getTime())
  if (live(job.boostedUntil)) return 'URGENT'
  if (live(job.featuredUntil)) return 'FEATURED'
  return null
}
