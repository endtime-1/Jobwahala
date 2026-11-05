/** Employer plans: what a plan includes, which one a company is on, and the grace period when a payment fails. */

export const PLAN_TIERS = ['FREE', 'STARTER', 'BUSINESS'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const GRACE_DAYS = 7;
const DAY_MS = 86_400_000;

export type PlanFeatures = {
  teamLimit: number;
  cvDatabase: boolean;
  /** Profiles that can be unlocked per calendar month in the CV database. */
  monthlyUnlocks: number;
  brandedPage: boolean;
  hiringReports: boolean;
  topEmployers: boolean;
  monthlyFeaturedCredits: number;
  monthlyBoostCredits: number;
};

export type Entitlements = PlanFeatures & {
  tier: PlanTier;
  planName: string;
  productId: string | null;
  interval: 'MONTHLY' | 'YEARLY' | null;
  subscription: null | {
    id: string;
    status: string;
    currentPeriodEnd: Date;
    graceEndsAt: Date | null;
    cancelAtPeriodEnd: boolean;
    pendingPlanName: string | null;
  };
};

/** What a company gets with no paid plan, if the admin has not edited the Free plan: unlimited standard posts, the applicant board, one seat. */
export const FREE_FEATURES: PlanFeatures = {
  teamLimit: 1,
  cvDatabase: false,
  monthlyUnlocks: 0,
  brandedPage: false,
  hiringReports: false,
  topEmployers: false,
  monthlyFeaturedCredits: 0,
  monthlyBoostCredits: 0,
};

type PlanProduct = {
  id?: string;
  name: string;
  planTier: string | null;
  interval: string | null;
  pricePesewas: number;
  teamLimit: number;
  cvDatabase: boolean;
  monthlyUnlocks: number;
  brandedPage: boolean;
  hiringReports: boolean;
  topEmployers: boolean;
  featuredCredits: number;
  boostCredits: number;
};

export const tierRank = (tier?: string | null) => Math.max(0, PLAN_TIERS.indexOf((tier ?? 'FREE') as PlanTier));

/** Higher is a bigger plan. A yearly plan sits just above the monthly one of the same tier. */
export const planLevel = (product: { planTier: string | null; interval: string | null }) => tierRank(product.planTier) * 10 + (product.interval === 'YEARLY' ? 1 : 0);

export const featuresOf = (product: PlanProduct): PlanFeatures => ({
  teamLimit: Math.max(1, product.teamLimit),
  cvDatabase: product.cvDatabase,
  monthlyUnlocks: product.cvDatabase ? Math.max(0, product.monthlyUnlocks) : 0,
  brandedPage: product.brandedPage,
  hiringReports: product.hiringReports,
  topEmployers: product.topEmployers,
  monthlyFeaturedCredits: product.featuredCredits,
  monthlyBoostCredits: product.boostCredits,
});

type SubscriptionLike = { status: string; currentPeriodEnd: Date; graceEndsAt: Date | null; cancelAtPeriodEnd?: boolean };

/**
 * Is this subscription giving its plan right now? A paid-up plan, one running out its period after cancelling, or one whose
 * renewal failed and is still inside its 7 days of grace. Past that the company is on Free.
 */
export const isLive = (subscription: SubscriptionLike, now = new Date()) => {
  // A cancelled plan ends exactly when its period does; otherwise two days of slack for a renewal that is on its way.
  if (subscription.status === 'ACTIVE') return subscription.currentPeriodEnd.getTime() + (subscription.cancelAtPeriodEnd ? 0 : 2 * DAY_MS) > now.getTime();
  if (subscription.status === 'PAST_DUE') return Boolean(subscription.graceEndsAt && subscription.graceEndsAt.getTime() > now.getTime());
  return false;
};

export const graceEndFrom = (failedAt: Date) => new Date(failedAt.getTime() + GRACE_DAYS * DAY_MS);

/** Whole days since the failure, from the grace end. */
export const daysIntoGrace = (graceEndsAt: Date, now = new Date()) => Math.floor((now.getTime() - (graceEndsAt.getTime() - GRACE_DAYS * DAY_MS)) / DAY_MS);

/** Reminders during grace: one after 2 days, a last one after 5. Returns how many should have been sent by now. */
export const graceRemindersDue = (graceEndsAt: Date, now = new Date()) => {
  const days = daysIntoGrace(graceEndsAt, now);
  return days >= 5 ? 2 : days >= 2 ? 1 : 0;
};

export const PLAN_NEEDED_MESSAGE: Record<keyof Pick<PlanFeatures, 'cvDatabase' | 'brandedPage' | 'hiringReports' | 'topEmployers'> | 'teamMembers', string> = {
  cvDatabase: 'The CV database is part of the Business plan.',
  brandedPage: 'A branded company page is part of the Starter and Business plans.',
  hiringReports: 'Hiring reports are part of the Business plan.',
  topEmployers: 'Priority in Top employers is part of the Business plan.',
  teamMembers: 'Your plan has no more team seats. Upgrade to add more people.',
};

/** Starting plans for the admin to edit. The prices are placeholders. */
export const DEFAULT_PLANS = [
  { slug: 'plan-free', name: 'Free', planTier: 'FREE', interval: null, pricePesewas: 0, teamLimit: 1, cvDatabase: false, monthlyUnlocks: 0, brandedPage: false, hiringReports: false, topEmployers: false, featuredCredits: 0, boostCredits: 0, sortOrder: 100, description: 'Everything you need to post jobs and review applicants.', includes: ['Unlimited standard job posts', 'Applicant board', '1 team member (you)'] },
  { slug: 'plan-starter-monthly', name: 'Starter (monthly)', planTier: 'STARTER', interval: 'MONTHLY', pricePesewas: 15000, teamLimit: 3, cvDatabase: false, monthlyUnlocks: 0, brandedPage: true, hiringReports: false, topEmployers: false, featuredCredits: 2, boostCredits: 1, sortOrder: 110, description: 'For employers who hire now and then and want to stand out.', includes: ['Branded company page: cover image, gallery, "Why work with us"', 'Up to 3 team members', 'Cancel any time'] },
  { slug: 'plan-starter-yearly', name: 'Starter (yearly)', planTier: 'STARTER', interval: 'YEARLY', pricePesewas: 150000, teamLimit: 3, cvDatabase: false, monthlyUnlocks: 0, brandedPage: true, hiringReports: false, topEmployers: false, featuredCredits: 2, boostCredits: 1, sortOrder: 120, description: 'Starter, paid once a year at a discount.', includes: ['Two months free', 'Credits arrive every month', 'Up to 3 team members'] },
  { slug: 'plan-business-monthly', name: 'Business (monthly)', planTier: 'BUSINESS', interval: 'MONTHLY', pricePesewas: 45000, teamLimit: 10, cvDatabase: true, monthlyUnlocks: 50, brandedPage: true, hiringReports: true, topEmployers: true, featuredCredits: 6, boostCredits: 3, sortOrder: 130, description: 'For employers who hire all the time.', includes: ['CV database access', 'Hiring reports', 'Priority in Top employers', 'Up to 10 team members'] },
  { slug: 'plan-business-yearly', name: 'Business (yearly)', planTier: 'BUSINESS', interval: 'YEARLY', pricePesewas: 450000, teamLimit: 10, cvDatabase: true, monthlyUnlocks: 50, brandedPage: true, hiringReports: true, topEmployers: true, featuredCredits: 6, boostCredits: 3, sortOrder: 140, description: 'Business, paid once a year at a discount.', includes: ['Two months free', 'Credits arrive every month', 'CV database access, hiring reports, up to 10 team members'] },
] as const;
