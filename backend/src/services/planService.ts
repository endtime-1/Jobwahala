import prisma from '../config/prisma';
import { BillingError } from './billingErrors';
import {
  FREE_FEATURES,
  PLAN_NEEDED_MESSAGE,
  featuresOf,
  isLive,
  planLevel,
  type Entitlements,
  type PlanFeatures,
  type PlanTier,
} from '../utils/plans';

type Db = Pick<typeof prisma, 'subscription' | 'product' | 'teamMember' | 'creditAccount' | 'creditLedger'>;

/**
 * What a company is entitled to right now, worked out on the server from its live subscription (or Free). Every plan limit
 * (credits, team seats, CV database, reports, branded page) is checked against this, never against the browser.
 */
export const getEntitlements = async (ownerId: string, now = new Date(), db: Db = prisma): Promise<Entitlements> => {
  const subscriptions = await db.subscription.findMany({
    where: { userId: ownerId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  });

  const live = subscriptions.filter((subscription) => subscription.product.planTier && isLive(subscription, now));
  // If there are somehow two, the bigger plan counts.
  live.sort((a, b) => planLevel(b.product) - planLevel(a.product));
  const current = live[0];

  if (current) {
    const pending = current.pendingProductId ? await db.product.findUnique({ where: { id: current.pendingProductId }, select: { name: true } }) : null;
    return {
      tier: (current.product.planTier as PlanTier) ?? 'FREE',
      planName: current.product.name,
      productId: current.product.id,
      interval: current.product.interval as 'MONTHLY' | 'YEARLY' | null,
      ...featuresOf(current.product),
      subscription: {
        id: current.id,
        status: current.status,
        currentPeriodEnd: current.currentPeriodEnd,
        graceEndsAt: current.graceEndsAt,
        cancelAtPeriodEnd: current.cancelAtPeriodEnd,
        pendingPlanName: pending?.name ?? null,
      },
    };
  }

  // The Free plan is a row the admin can edit; with no row, the built-in Free applies.
  const free = await db.product.findFirst({ where: { planTier: 'FREE' }, orderBy: { sortOrder: 'asc' } });
  return {
    tier: 'FREE',
    planName: free?.name ?? 'Free',
    productId: free?.id ?? null,
    interval: null,
    ...(free ? featuresOf(free) : FREE_FEATURES),
    subscription: null,
  };
};

/** Refuses with a plain message when the plan does not include a feature. */
export const requireFeature = async (ownerId: string, feature: keyof typeof PLAN_NEEDED_MESSAGE & keyof PlanFeatures, now = new Date()) => {
  const entitlements = await getEntitlements(ownerId, now);
  if (!entitlements[feature]) throw new BillingError(403, 'PLAN_REQUIRED', PLAN_NEEDED_MESSAGE[feature]);
  return entitlements;
};

/**
 * Keeps the team within the plan. Seats are the owner plus active and invited members. When a plan shrinks, the newest members
 * above the limit are suspended (kept, not deleted); when it grows, suspended ones come back, oldest first.
 */
export const reconcileTeam = async (ownerId: string, now = new Date(), db: Db = prisma) => {
  const { teamLimit } = await getEntitlements(ownerId, now, db);
  const seats = Math.max(0, teamLimit - 1);
  const members = await db.teamMember.findMany({ where: { ownerId, status: { in: ['INVITED', 'ACTIVE', 'SUSPENDED'] } }, orderBy: { invitedAt: 'asc' } });

  const keep = new Set(members.slice(0, seats).map((member) => member.id));
  let suspended = 0;
  let restored = 0;
  for (const member of members) {
    if (keep.has(member.id) && member.status === 'SUSPENDED') {
      // Only someone who had joined comes back as active; an old invitation that was never accepted comes back as an invitation.
      await db.teamMember.update({ where: { id: member.id }, data: { status: member.userId ? 'ACTIVE' : 'INVITED' } });
      restored += 1;
    } else if (!keep.has(member.id) && member.status !== 'SUSPENDED') {
      await db.teamMember.update({ where: { id: member.id }, data: { status: 'SUSPENDED' } });
      suspended += 1;
    }
  }
  return { suspended, restored };
};

/** Takes the monthly plan credits away (a plan has ended). Purchased pack credits are never touched. */
export const expirePlanCredits = async (ownerId: string, db: Db = prisma) => {
  const account = await db.creditAccount.findUnique({ where: { userId: ownerId } });
  if (!account || (account.planFeaturedCredits === 0 && account.planBoostCredits === 0)) return;

  await db.creditAccount.update({ where: { userId: ownerId }, data: { planFeaturedCredits: 0, planBoostCredits: 0 } });
  if (account.planFeaturedCredits > 0) await db.creditLedger.create({ data: { userId: ownerId, creditType: 'FEATURE', delta: -account.planFeaturedCredits, reason: 'EXPIRY', note: 'Plan ended' } });
  if (account.planBoostCredits > 0) await db.creditLedger.create({ data: { userId: ownerId, creditType: 'BOOST', delta: -account.planBoostCredits, reason: 'EXPIRY', note: 'Plan ended' } });
};

/**
 * A new month of plan credits. What was left of last month's is gone (that is the rule), and this month's allowance replaces it.
 * Both steps go in the ledger.
 */
export const grantMonthlyPlanCredits = async (ownerId: string, allowance: { featured: number; boost: number }, db: Db = prisma, paymentId?: string) => {
  const account = await db.creditAccount.findUnique({ where: { userId: ownerId } });
  const leftFeatured = account?.planFeaturedCredits ?? 0;
  const leftBoost = account?.planBoostCredits ?? 0;

  await db.creditAccount.upsert({
    where: { userId: ownerId },
    create: { userId: ownerId, planFeaturedCredits: allowance.featured, planBoostCredits: allowance.boost },
    update: { planFeaturedCredits: allowance.featured, planBoostCredits: allowance.boost },
  });

  const entries: { creditType: string; delta: number; reason: string; note?: string }[] = [
    ...(leftFeatured > 0 ? [{ creditType: 'FEATURE', delta: -leftFeatured, reason: 'EXPIRY', note: 'Unused monthly credits expire at renewal' }] : []),
    ...(leftBoost > 0 ? [{ creditType: 'BOOST', delta: -leftBoost, reason: 'EXPIRY', note: 'Unused monthly credits expire at renewal' }] : []),
    ...(allowance.featured > 0 ? [{ creditType: 'FEATURE', delta: allowance.featured, reason: 'SUBSCRIPTION' }] : []),
    ...(allowance.boost > 0 ? [{ creditType: 'BOOST', delta: allowance.boost, reason: 'SUBSCRIPTION' }] : []),
  ];
  for (const entry of entries) await db.creditLedger.create({ data: { userId: ownerId, paymentId: paymentId ?? null, ...entry } });
};

/** How much of each kind of credit a company has: the plan's monthly credits (which expire) and the ones it bought or was given. */
export const getCreditBalance = async (userId: string, db: Db = prisma) => {
  const account = await db.creditAccount.findUnique({ where: { userId } });
  const plan = { featured: account?.planFeaturedCredits ?? 0, boost: account?.planBoostCredits ?? 0 };
  const purchased = { featured: account?.featuredCredits ?? 0, boost: account?.boostCredits ?? 0 };
  return {
    featuredCredits: plan.featured + purchased.featured,
    boostCredits: plan.boost + purchased.boost,
    plan,
    purchased,
  };
};
