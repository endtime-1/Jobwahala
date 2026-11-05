import { PrismaClient } from '@prisma/client';

type AuditClient = Pick<PrismaClient, 'adminActionLog'>;

type AuditEntry = {
  admin: { id: string; email: string };
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Writes one line to the admin audit log: who (admin), what (action), to what, why, and when.
 * Call it with the transaction client, so the log line is saved in the same step as the decision
 * and a decision can never exist without its record.
 */
export const recordAdminAction = (client: AuditClient, entry: AuditEntry) =>
  client.adminActionLog.create({
    data: {
      adminId: entry.admin.id,
      adminEmail: entry.admin.email,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason?.trim() || null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    },
  });
