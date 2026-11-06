export type Point = { day: string; count: number }

export type AdminOverview = {
  generatedAt: string
  users: { total: number; seekers: number; employers: number; freelancers: number; admins: number; new7: number; new30: number }
  employers: { total: number; verified: number; unverified: number }
  jobs: { active: number; new7: number }
  applications: { total: number; new7: number }
  revenue: { thisMonthPesewas: number; lastMonthPesewas: number; paymentsThisMonth: number; mode: 'test' | 'live' | 'off' }
  queues: { verifications: number; reports: number; courses: number; providers: number; disputes: number }
  series: { signups: Point[]; applications: Point[]; jobs: Point[] }
}

export type HealthItem = { key: string; label: string; status: 'ok' | 'warn' | 'error' | 'off'; detail: string }
export type AdminHealth = { checkedAt: string; summary: { errors: number; warnings: number }; items: HealthItem[] }

/** Where each waiting item is handled. */
export const QUEUE_ROWS = [
  { key: 'verifications', label: 'Business verifications to review', tab: 'verifications' },
  { key: 'reports', label: 'Reports to look at', tab: 'reports' },
  { key: 'courses', label: 'Courses waiting for approval', tab: 'courses' },
  { key: 'providers', label: 'Training providers waiting for approval', tab: 'courses' },
  { key: 'disputes', label: 'Open disputes', tab: 'disputes' },
] as const

export const totalWaiting = (queues: AdminOverview['queues']) => Object.values(queues).reduce((sum, value) => sum + value, 0)

/** "+12 vs last month" style change, as a whole percent. null when there is nothing to compare with. */
export const changePercent = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null)
