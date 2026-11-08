import prisma from '../config/prisma';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Adds (or takes away) credits and writes the ledger line, in the caller's transaction. Kept in its own file so small features can give credits without loading the whole billing service. */
export const grantCredits = async (tx: Tx, input: { userId: string; featured?: number; boost?: number; reason: string; paymentId?: string; adminId?: string; note?: string }) => {
  const featured = input.featured ?? 0;
  const boost = input.boost ?? 0;
  if (featured === 0 && boost === 0) return;

  await tx.creditAccount.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, featuredCredits: Math.max(0, featured), boostCredits: Math.max(0, boost) },
    update: { featuredCredits: { increment: featured }, boostCredits: { increment: boost } },
  });
  const common = { userId: input.userId, reason: input.reason, paymentId: input.paymentId ?? null, adminId: input.adminId ?? null, note: input.note ?? null };
  if (featured !== 0) await tx.creditLedger.create({ data: { ...common, creditType: 'FEATURE', delta: featured } });
  if (boost !== 0) await tx.creditLedger.create({ data: { ...common, creditType: 'BOOST', delta: boost } });
};
