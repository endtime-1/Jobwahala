import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  job: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/jobAlertService', () => ({ notifyJobAlerts: vi.fn() }));

import { createJob, duplicateOwnedJob, getJobs, updateOwnedJob } from '../../controllers/jobController';
import { backfillJobSalaries } from '../../services/salaryBackfillService';
import { buildJobPostingJsonLd, type SeoJob } from '../../utils/seoPages';
import {
  MAX_SALARY,
  formatSalaryRange,
  parseSalaryText,
  resolvePay,
  salaryOverlaps,
  salaryRangeProblem,
} from '../../utils/salary';
import { createJobSchema, updateJobSchema } from '../../validation/jobSchemas';

describe('reading pay out of text', () => {
  it.each([
    ['GHS 3,000 - 4,500 a month', { min: 3000, max: 4500 }],
    ['GHS 3000-4500', { min: 3000, max: 4500 }],
    ['GH₵3,000 to 4,500 per month', { min: 3000, max: 4500 }],
    ['GH¢ 2,500', { min: 2500, max: null }],
    ['₵2,500 monthly', { min: 2500, max: null }],
    ['3k - 4.5k', { min: 3000, max: 4500 }],
    ['4,500 - 3,000', { min: 3000, max: 4500 }],
    ['3000', { min: 3000, max: null }],
    ['GHS 3,000 - 3,000', { min: 3000, max: null }],
    ['from 3,000 plus bonus', { min: 3000, max: null }],
  ])('"%s"', (text, expected) => {
    expect(parseSalaryText(text)).toEqual(expected);
  });

  it('reads "up to" as a ceiling', () => {
    expect(parseSalaryText('Up to GHS 5,000')).toEqual({ min: null, max: 5000 });
    expect(parseSalaryText('max 6000 a month')).toEqual({ min: null, max: 6000 });
  });

  it('turns yearly and weekly pay into a monthly figure', () => {
    expect(parseSalaryText('GHS 48,000 per year')).toEqual({ min: 4000, max: null });
    expect(parseSalaryText('GHS 36,000 - 60,000 per annum')).toEqual({ min: 3000, max: 5000 });
    expect(parseSalaryText('GHS 1,000 a week')).toEqual({ min: 4333, max: null });
  });

  it('ignores small stray numbers that are not pay', () => {
    expect(parseSalaryText('GHS 2,500 after a 6 month probation')).toEqual({ min: 2500, max: null });
    expect(parseSalaryText('2 days off, 3 meals')).toBeNull();
  });

  it('will not guess: other currencies, hourly or daily pay, and no figure', () => {
    for (const text of ['$3,000/month', 'USD 2,500', '€2,000', '£1,800', '₦400,000', 'GHS 15 per hour', 'GHS 120 a day', 'Negotiable', 'Competitive', '', '   ']) {
      expect(parseSalaryText(text)).toBeNull();
    }
    expect(parseSalaryText(null)).toBeNull();
    expect(parseSalaryText(undefined)).toBeNull();
  });

  it('rejects absurd figures', () => {
    expect(parseSalaryText(`GHS ${MAX_SALARY + 1}`)).toBeNull();
  });
});

describe('writing pay as text', () => {
  it('shows a range, a single figure, or a ceiling', () => {
    expect(formatSalaryRange(3000, 4500)).toBe('GHS 3,000 - 4,500 a month');
    expect(formatSalaryRange(3000, null)).toBe('GHS 3,000 a month');
    expect(formatSalaryRange(3000, 3000)).toBe('GHS 3,000 a month');
    expect(formatSalaryRange(null, 5000)).toBe('Up to GHS 5,000 a month');
    expect(formatSalaryRange(null, null)).toBeNull();
    expect(formatSalaryRange(undefined, undefined)).toBeNull();
  });
});

describe('settling a job\'s pay', () => {
  it('numbers win, and the text is written from them', () => {
    expect(resolvePay({ salaryMin: 3000, salaryMax: 4500 })).toEqual({ salary: 'GHS 3,000 - 4,500 a month', salaryMin: 3000, salaryMax: 4500 });
  });

  it('keeps the employer\'s own wording when they gave both', () => {
    expect(resolvePay({ salary: 'GHS 3-4.5k plus transport', salaryMin: 3000, salaryMax: 4500 }).salary).toBe('GHS 3-4.5k plus transport');
  });

  it('reads numbers from text when only text was given', () => {
    expect(resolvePay({ salary: 'GHS 3,000 - 4,500 a month' })).toEqual({ salary: 'GHS 3,000 - 4,500 a month', salaryMin: 3000, salaryMax: 4500 });
  });

  it('keeps text it cannot read, with no numbers', () => {
    expect(resolvePay({ salary: '$3,000/month' })).toEqual({ salary: '$3,000/month', salaryMin: null, salaryMax: null });
  });

  it('can clear the pay', () => {
    expect(resolvePay({ salaryMin: null, salaryMax: null })).toEqual({ salary: null, salaryMin: null, salaryMax: null });
    expect(resolvePay({})).toEqual({ salary: null, salaryMin: null, salaryMax: null });
  });
});

describe('matching a salary filter', () => {
  const job = (salaryMin: number | null, salaryMax: number | null) => ({ salaryMin, salaryMax });

  it('wants pay that reaches the level asked for', () => {
    expect(salaryOverlaps(job(3000, 4500), { min: 4000 })).toBe(true);
    expect(salaryOverlaps(job(3000, 4500), { min: 5000 })).toBe(false);
    expect(salaryOverlaps(job(3000, null), { min: 3000 })).toBe(true);
    expect(salaryOverlaps(job(3000, null), { min: 3500 })).toBe(false);
    expect(salaryOverlaps(job(null, 5000), { min: 4000 })).toBe(true);
  });

  it('can also cap the level', () => {
    expect(salaryOverlaps(job(3000, 4500), { max: 3500 })).toBe(true);
    expect(salaryOverlaps(job(3000, 4500), { max: 2500 })).toBe(false);
    expect(salaryOverlaps(job(3000, 4500), { min: 3200, max: 4000 })).toBe(true);
  });

  it('cannot match a job that never gave numbers', () => {
    expect(salaryOverlaps(job(null, null), { min: 1000 })).toBe(false);
    expect(salaryOverlaps(job(null, null), {})).toBe(false);
  });
});

describe('validating a pay range', () => {
  it('accepts sensible numbers and gaps', () => {
    expect(salaryRangeProblem(3000, 4500)).toBeNull();
    expect(salaryRangeProblem(3000, null)).toBeNull();
    expect(salaryRangeProblem(undefined, undefined)).toBeNull();
    expect(salaryRangeProblem(3000, 3000)).toBeNull();
  });

  it('refuses a backwards range, negatives, fractions and absurd figures', () => {
    expect(salaryRangeProblem(5000, 3000)).toMatch(/lowest pay/);
    expect(salaryRangeProblem(-1, 3000)).toMatch(/whole number/);
    expect(salaryRangeProblem(1.5, 3000)).toMatch(/whole number/);
    expect(salaryRangeProblem(1, MAX_SALARY + 1)).toMatch(/whole number/);
  });

  it('is enforced on create and edit', () => {
    const body = { title: 'Cook', description: 'Kitchen', type: 'Full-time' };
    expect(createJobSchema.safeParse({ body: { ...body, salaryMin: 3000, salaryMax: 4500 } }).success).toBe(true);
    expect(createJobSchema.safeParse({ body: { ...body, salaryMin: 5000, salaryMax: 3000 } }).success).toBe(false);
    expect(createJobSchema.safeParse({ body: { ...body, salaryMin: '3000' } }).success).toBe(false);
    expect(updateJobSchema.safeParse({ params: { id: 'j' }, body: { salaryMin: 3000, salaryMax: null } }).success).toBe(true);
    expect(updateJobSchema.safeParse({ params: { id: 'j' }, body: { salaryMin: 9, salaryMax: 3 } }).success).toBe(false);
    expect(updateJobSchema.safeParse({ params: { id: 'j' }, body: { salaryMin: null } }).success).toBe(true);
  });
});

const call = async (handler: (req: never, res: Response) => unknown, req: Record<string, unknown>) => {
  let status = 200;
  let payload: any;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as Response;
  await handler({ body: {}, params: {}, query: {}, user: { id: 'emp-1' }, ...req } as never, res);
  return { status, body: payload };
};

const existingJob = (overrides: Record<string, unknown> = {}) => ({
  id: 'job-1',
  employerId: 'emp-1',
  title: 'Cook',
  description: 'Kitchen work',
  location: 'Accra',
  type: 'Full-time',
  salary: 'GHS 3,000 a month',
  salaryMin: 3000,
  salaryMax: null,
  currency: 'GHS',
  category: null,
  status: 'ACTIVE',
  closesAt: new Date(Date.now() + 10 * 86_400_000),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.job.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'new-job', ...data }));
  prismaMock.job.update.mockImplementation(async ({ data }: { data: object }) => ({ ...existingJob(), ...data }));
  prismaMock.job.findMany.mockResolvedValue([]);
});

describe('posting a job with pay', () => {
  const body = { title: 'Cook', description: 'Kitchen', type: 'Full-time' };

  it('stores the numbers and writes the display text from them', async () => {
    await call(createJob as never, { body: { ...body, salaryMin: 3000, salaryMax: 4500 } });

    expect(prismaMock.job.create.mock.calls[0][0].data).toMatchObject({
      salary: 'GHS 3,000 - 4,500 a month',
      salaryMin: 3000,
      salaryMax: 4500,
    });
  });

  it('reads the numbers out of the text when only text is typed', async () => {
    await call(createJob as never, { body: { ...body, salary: 'GHS 2,500 - 3,200' } });

    expect(prismaMock.job.create.mock.calls[0][0].data).toMatchObject({ salary: 'GHS 2,500 - 3,200', salaryMin: 2500, salaryMax: 3200 });
  });

  it('keeps text it cannot read, without numbers, and marks the job as looked at', async () => {
    await call(createJob as never, { body: { ...body, salary: '$3,000/month' } });

    const data = prismaMock.job.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ salary: '$3,000/month', salaryMin: null, salaryMax: null });
    expect(data.salaryParsedAt).toBeInstanceOf(Date);
  });
});

describe('editing a job\'s pay', () => {
  beforeEach(() => prismaMock.job.findUnique.mockResolvedValue(existingJob()));

  it('rewrites the text when only the numbers change', async () => {
    await call(updateOwnedJob as never, { params: { id: 'job-1' }, body: { salaryMin: 3500, salaryMax: 5000 } });

    expect(prismaMock.job.update.mock.calls[0][0].data).toMatchObject({ salary: 'GHS 3,500 - 5,000 a month', salaryMin: 3500, salaryMax: 5000 });
  });

  it('re-reads the numbers when only the text changes', async () => {
    await call(updateOwnedJob as never, { params: { id: 'job-1' }, body: { salary: 'GHS 4,000 - 6,000' } });

    expect(prismaMock.job.update.mock.calls[0][0].data).toMatchObject({ salary: 'GHS 4,000 - 6,000', salaryMin: 4000, salaryMax: 6000 });
  });

  it('keeps the other end when only one number is sent', async () => {
    prismaMock.job.findUnique.mockResolvedValue(existingJob({ salaryMin: 3000, salaryMax: 4000 }));

    await call(updateOwnedJob as never, { params: { id: 'job-1' }, body: { salaryMax: 5000 } });

    expect(prismaMock.job.update.mock.calls[0][0].data).toMatchObject({ salaryMin: 3000, salaryMax: 5000 });
  });

  it('can clear the pay', async () => {
    await call(updateOwnedJob as never, { params: { id: 'job-1' }, body: { salary: '', salaryMin: null, salaryMax: null } });

    expect(prismaMock.job.update.mock.calls[0][0].data).toMatchObject({ salary: null, salaryMin: null, salaryMax: null });
  });

  it('leaves pay alone when it is not mentioned', async () => {
    await call(updateOwnedJob as never, { params: { id: 'job-1' }, body: { title: 'Head Cook' } });

    const data = prismaMock.job.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('salary');
    expect(data).not.toHaveProperty('salaryMin');
  });

  it('a duplicate keeps the pay numbers', async () => {
    prismaMock.job.findUnique.mockResolvedValue(existingJob({ salaryMin: 3000, salaryMax: 4500 }));

    await call(duplicateOwnedJob as never, { params: { id: 'job-1' } });

    expect(prismaMock.job.create.mock.calls[0][0].data).toMatchObject({ salary: 'GHS 3,000 a month', salaryMin: 3000, salaryMax: 4500 });
  });
});

describe('searching by salary', () => {
  const whereOf = async (query: Record<string, string>) => {
    await call(getJobs as never, { query });
    return prismaMock.job.findMany.mock.calls[0][0].where;
  };

  it('has no salary condition unless asked', async () => {
    expect(await whereOf({})).not.toHaveProperty('AND');
  });

  it('?salaryMin keeps jobs whose pay reaches it, using the top of the range or a single figure', async () => {
    const where = await whereOf({ salaryMin: '4000' });

    expect(where.AND).toEqual([{ OR: [{ salaryMax: { gte: 4000 } }, { salaryMax: null, salaryMin: { gte: 4000 } }] }]);
  });

  it('?salaryMax keeps jobs whose pay starts at or below it', async () => {
    const where = await whereOf({ salaryMax: '3000' });

    expect(where.AND).toEqual([{ OR: [{ salaryMin: { lte: 3000 } }, { salaryMin: null, salaryMax: { lte: 3000 } }] }]);
  });

  it('can use both together, and still searches words and other filters', async () => {
    const where = await whereOf({ salaryMin: '2000', salaryMax: '5000', q: 'cook' });

    expect(where.AND).toHaveLength(2);
    expect(where.OR).toBeDefined();
    expect(where.status).toBe('ACTIVE');
  });

  it('ignores nonsense values', async () => {
    const where = await whereOf({ salaryMin: 'lots', salaryMax: '-5' });

    expect(where).not.toHaveProperty('AND');
  });
});

describe('moving older jobs over', () => {
  it('reads numbers into jobs that only had text, marks every job it looked at, and leaves the text alone', async () => {
    prismaMock.job.findMany.mockResolvedValueOnce([
      { id: 'a', salary: 'GHS 3,000 - 4,500 a month', salaryMin: null, salaryMax: null },
      { id: 'b', salary: '$3,000/month', salaryMin: null, salaryMax: null },
      { id: 'c', salary: null, salaryMin: null, salaryMax: null },
    ]);
    prismaMock.job.update.mockResolvedValue({});

    const result = await backfillJobSalaries(new Date('2026-11-05T00:00:00Z'));

    expect(result).toEqual({ checked: 3, filled: 1 });
    const updates = prismaMock.job.update.mock.calls.map((call) => call[0]);
    expect(updates[0]).toEqual({ where: { id: 'a' }, data: { salaryParsedAt: new Date('2026-11-05T00:00:00Z'), salaryMin: 3000, salaryMax: 4500 } });
    expect(updates[1].data).toEqual({ salaryParsedAt: new Date('2026-11-05T00:00:00Z') });
    expect(updates[2].data).toEqual({ salaryParsedAt: new Date('2026-11-05T00:00:00Z') });
    for (const update of updates) expect(update.data).not.toHaveProperty('salary');
  });

  it('never overwrites numbers someone already set', async () => {
    prismaMock.job.findMany.mockResolvedValueOnce([{ id: 'a', salary: 'GHS 9,999', salaryMin: 3000, salaryMax: 4000 }]);
    prismaMock.job.update.mockResolvedValue({});

    await backfillJobSalaries();

    expect(prismaMock.job.update.mock.calls[0][0].data).not.toHaveProperty('salaryMin');
  });

  it('only looks at jobs it has not already looked at, and stops when there are none', async () => {
    prismaMock.job.findMany.mockResolvedValueOnce([]);

    expect(await backfillJobSalaries()).toEqual({ checked: 0, filled: 0 });
    expect(prismaMock.job.findMany.mock.calls[0][0].where).toEqual({ salaryParsedAt: null });
  });
});

describe('pay in search-engine data', () => {
  const seoJob = (extra: Partial<SeoJob>): SeoJob => ({
    id: 'job-1',
    title: 'Cook',
    description: 'Kitchen',
    type: 'Full-time',
    createdAt: new Date('2026-11-01T00:00:00Z'),
    employerName: 'Achiba',
    ...extra,
  });

  it('gives Google the pay as numbers, per month, in cedis', () => {
    const data = buildJobPostingJsonLd(seoJob({ salaryMin: 3000, salaryMax: 4500 }), 'https://www.jobwahala.com') as any;

    expect(data.baseSalary).toEqual({
      '@type': 'MonetaryAmount',
      currency: 'GHS',
      value: { '@type': 'QuantitativeValue', minValue: 3000, maxValue: 4500, unitText: 'MONTH' },
    });
  });

  it('handles a single figure and a missing salary', () => {
    const single = buildJobPostingJsonLd(seoJob({ salaryMin: 3000, salaryMax: null }), 'https://www.jobwahala.com') as any;
    expect(single.baseSalary.value).toMatchObject({ minValue: 3000, maxValue: 3000 });

    expect(buildJobPostingJsonLd(seoJob({}), 'https://www.jobwahala.com')).not.toHaveProperty('baseSalary');
  });
});
