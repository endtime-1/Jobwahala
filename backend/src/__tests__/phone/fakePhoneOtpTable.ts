import { vi } from 'vitest';

type Row = {
  id: string;
  phone: string;
  purpose: string;
  subjectId: string | null;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  requestIp: string | null;
  createdAt: Date;
};

/**
 * A tiny in-memory stand-in for the PhoneOtp table, so tests can run the real OTP service end to
 * end (limits, attempts, single use) without a database.
 */
export const makePhoneOtpTable = (clock: () => Date = () => new Date()) => {
  let rows: Row[] = [];
  let counter = 0;

  const matches = (row: Row, where: Record<string, any> = {}) =>
    Object.entries(where).every(([key, expected]) => {
      const actual = (row as Record<string, unknown>)[key];
      if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
        if ('gt' in expected) return (actual as Date).getTime() > expected.gt.getTime();
        return true;
      }
      return expected === actual || (expected === null && actual === null);
    });

  const newestFirst = (list: Row[]) => [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const table = {
    findMany: vi.fn(async ({ where }: { where?: Record<string, any> } = {}) => newestFirst(rows.filter((row) => matches(row, where)))),
    findFirst: vi.fn(async ({ where }: { where?: Record<string, any> } = {}) => newestFirst(rows.filter((row) => matches(row, where)))[0] ?? null),
    count: vi.fn(async ({ where }: { where?: Record<string, any> } = {}) => rows.filter((row) => matches(row, where)).length),
    create: vi.fn(async ({ data }: { data: Partial<Row> }) => {
      counter += 1;
      const row: Row = {
        id: `otp-${counter}`,
        phone: '',
        purpose: '',
        subjectId: null,
        codeHash: '',
        expiresAt: new Date(),
        attempts: 0,
        consumedAt: null,
        requestIp: null,
        createdAt: clock(),
        ...data,
      } as Row;
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
      const row = rows.find((candidate) => candidate.id === where.id)!;
      if (data.attempts?.increment) row.attempts += data.attempts.increment;
      if ('consumedAt' in data) row.consumedAt = data.consumedAt;
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      rows = rows.filter((row) => row.id !== where.id);
      return {};
    }),
  };

  return {
    table,
    all: () => rows,
    reset: () => {
      rows = [];
      counter = 0;
    },
    /** Pretend time has passed for every code already stored (for cooldown and expiry tests). */
    age: (ms: number) => {
      rows.forEach((row) => {
        row.createdAt = new Date(row.createdAt.getTime() - ms);
        row.expiresAt = new Date(row.expiresAt.getTime() - ms);
      });
    },
  };
};
