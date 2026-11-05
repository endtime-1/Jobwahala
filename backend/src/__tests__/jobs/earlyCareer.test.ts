import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  job: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  savedSearch: { findMany: vi.fn() },
}));

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/jobAlertService', () => ({ notifyJobAlerts: vi.fn() }));

import { createJob, getJobs, updateOwnedJob } from '../../controllers/jobController';
import {
  EARLY_CAREER_TYPES,
  EarlyCareerError,
  canonicalEarlyCareerType,
  earlyCareerData,
  employmentTypeFor,
  isEarlyCareerType,
  parseStartDate,
} from '../../utils/earlyCareer';
import { createJobSchema, updateJobSchema } from '../../validation/jobSchemas';
import { getProfileUpdateSchema } from '../../validation/profileSchemas';
import { buildJobPostingJsonLd, mapEmploymentType } from '../../utils/seoPages';
import { searchMatchesJob } from '../../utils/jobAlerts';
import { staticSitemapPaths } from '../../utils/sitemap';

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
  await handler({ body: {}, params: {}, query: {}, user: { id: 'emp-1', role: 'EMPLOYER' }, ...req } as never, res);
  return { status, body: payload };
};

const NOW = new Date('2026-11-06T09:00:00.000Z');
const bodyOf = (body: Record<string, unknown>) =>
  createJobSchema.safeParse({ body: { title: 'Marketing intern', description: 'Help us.', type: 'Internship', ...body } });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.job.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'job-1', ...data }));
  prismaMock.job.findMany.mockResolvedValue([]);
});

describe('the four early-career types', () => {
  it('are Internship, National Service (NSS), Industrial Attachment and Graduate / Entry-level Job', () => {
    expect([...EARLY_CAREER_TYPES]).toEqual(['Internship', 'National Service (NSS)', 'Industrial Attachment', 'Graduate / Entry-level Job']);
  });

  it('are recognised in any case, and ordinary job types are not early-career', () => {
    expect(isEarlyCareerType('internship')).toBe(true);
    expect(isEarlyCareerType('  NATIONAL SERVICE (NSS) ')).toBe(true);
    expect(canonicalEarlyCareerType('industrial attachment')).toBe('Industrial Attachment');
    expect(isEarlyCareerType('Full-time')).toBe(false);
    expect(isEarlyCareerType(null)).toBe(false);
  });
});

describe('the extra details', () => {
  it('keeps what was sent for an early-career job', () => {
    const data = earlyCareerData({ durationMonths: 3, schedule: 'PART_TIME', possibleJobOffer: true, startDate: '2026-12-01' }, 'Internship', NOW);

    expect(data).toMatchObject({ durationMonths: 3, schedule: 'PART_TIME', possibleJobOffer: true, startsImmediately: false });
    expect(data.startDate).toEqual(new Date('2026-12-01T00:00:00.000Z'));
  });

  it('"start immediately" means no date, and a date means not immediately', () => {
    expect(earlyCareerData({ startsImmediately: true }, 'Internship', NOW)).toMatchObject({ startsImmediately: true, startDate: null });
    expect(earlyCareerData({ startDate: null }, 'Internship', NOW)).toMatchObject({ startsImmediately: false, startDate: null });
    expect(() => earlyCareerData({ startsImmediately: true, startDate: '2026-12-01' }, 'Internship', NOW)).toThrow(/not both/);
  });

  it('rejects a start date that is not a real day, is long past or is years away', () => {
    expect(() => parseStartDate('soon', NOW)).toThrow(EarlyCareerError);
    expect(() => parseStartDate('2026-02-31', NOW)).toThrow(/real day/);
    expect(() => parseStartDate('2026-10-01', NOW)).toThrow(/past/);
    expect(() => parseStartDate('2031-01-01', NOW)).toThrow(/far away/);
    expect(parseStartDate('2026-11-06', NOW)).toBeInstanceOf(Date);
  });

  it('a job that is not early-career carries none of it, whatever was sent', () => {
    expect(earlyCareerData({ durationMonths: 3, unpaid: true, possibleJobOffer: true }, 'Full-time', NOW)).toEqual({
      unpaid: false,
      durationMonths: null,
      startsImmediately: false,
      startDate: null,
      schedule: null,
      possibleJobOffer: false,
    });
  });

  it('only returns what was sent, so editing one thing changes only that', () => {
    expect(earlyCareerData({ durationMonths: 6 }, 'Internship', NOW)).toEqual({ durationMonths: 6 });
  });

  it('validates the request: duration 1 to 36 months, schedule full or part time', () => {
    expect(bodyOf({ durationMonths: 3 }).success).toBe(true);
    expect(bodyOf({ durationMonths: 0 }).success).toBe(false);
    expect(bodyOf({ durationMonths: 37 }).success).toBe(false);
    expect(bodyOf({ schedule: 'WEEKENDS' }).success).toBe(false);
    expect(bodyOf({ schedule: 'FULL_TIME', unpaid: true, possibleJobOffer: false, startsImmediately: true }).success).toBe(true);
    expect(updateJobSchema.safeParse({ params: { id: 'j' }, body: { possibleJobOffer: true } }).success).toBe(true);
  });
});

describe('posting an early-career role', () => {
  const post = (body: Record<string, unknown>) =>
    call(createJob as never, { body: { title: 'Marketing intern', description: 'Help us.', type: 'internship', ...body } });

  it('saves the stipend as numbers, the duration, the start and the offer tag', async () => {
    const result = await post({ salaryMin: 500, salaryMax: 800, durationMonths: 3, schedule: 'FULL_TIME', startsImmediately: true, possibleJobOffer: true });

    expect(result.status).toBe(201);
    expect(prismaMock.job.create.mock.calls[0][0].data).toMatchObject({
      type: 'Internship',
      salaryMin: 500,
      salaryMax: 800,
      durationMonths: 3,
      schedule: 'FULL_TIME',
      startsImmediately: true,
      startDate: null,
      possibleJobOffer: true,
    });
  });

  it('an unpaid role is labelled "Unpaid" and has no stipend numbers, even if some were sent', async () => {
    await post({ unpaid: true, salaryMin: 500, salaryMax: 800 });

    expect(prismaMock.job.create.mock.calls[0][0].data).toMatchObject({ unpaid: true, salary: 'Unpaid', salaryMin: null, salaryMax: null });
  });

  it('refuses a bad start date with a plain message and saves nothing', async () => {
    const result = await post({ startDate: 'next week' });

    expect(result.status).toBe(400);
    expect(result.body.message).toMatch(/start date/i);
    expect(prismaMock.job.create).not.toHaveBeenCalled();
  });

  it('an ordinary job saves no early-career details', async () => {
    await post({ type: 'Full-time', durationMonths: 3, possibleJobOffer: true });

    expect(prismaMock.job.create.mock.calls[0][0].data).toMatchObject({ type: 'Full-time', durationMonths: null, possibleJobOffer: false, unpaid: false });
  });
});

describe('changing an early-career role', () => {
  const owned = { id: 'job-1', employerId: 'emp-1', status: 'ACTIVE', type: 'Internship', salary: 'Unpaid', salaryMin: null, salaryMax: null, unpaid: true };
  const edit = (body: Record<string, unknown>) => call(updateOwnedJob as never, { params: { id: 'job-1' }, body });

  beforeEach(() => {
    prismaMock.job.findUnique.mockResolvedValue(owned);
    prismaMock.job.update.mockImplementation(async ({ data }: { data: object }) => ({ ...owned, ...data }));
  });

  it('turning it into a normal job clears the early-career details', async () => {
    await edit({ type: 'Full-time' });

    expect(prismaMock.job.update.mock.calls[0][0].data).toMatchObject({ type: 'Full-time', unpaid: false, durationMonths: null, possibleJobOffer: false, schedule: null });
  });

  it('adding a stipend to a role that was unpaid removes the Unpaid label', async () => {
    await edit({ unpaid: false, salaryMin: 400, salaryMax: 600 });

    const data = prismaMock.job.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ unpaid: false, salaryMin: 400, salaryMax: 600 });
    expect(data.salary).not.toBe('Unpaid');
  });

  it('no longer unpaid with no new pay just drops the label', async () => {
    await edit({ unpaid: false });

    expect(prismaMock.job.update.mock.calls[0][0].data).toMatchObject({ unpaid: false, salary: null, salaryMin: null });
  });

  it('changing only the duration touches nothing else', async () => {
    await edit({ durationMonths: 6 });

    const data = prismaMock.job.update.mock.calls[0][0].data;
    expect(data.durationMonths).toBe(6);
    expect(data).not.toHaveProperty('unpaid');
    expect(data).not.toHaveProperty('salary');
  });
});

describe('searching Internships & NSS', () => {
  const search = async (query: Record<string, string>) => {
    await call(getJobs as never, { query });
    return prismaMock.job.findMany.mock.calls[0][0].where;
  };

  it('?section=early shows only the four early-career types', async () => {
    const where = await search({ section: 'early' });

    expect(where.type).toEqual({ in: [...EARLY_CAREER_TYPES] });
  });

  it('?types picks some of them, ignoring ones that are not early-career', async () => {
    const where = await search({ types: 'internship,National Service (NSS),Full-time' });

    expect(where.type).toEqual({ in: ['Internship', 'National Service (NSS)'] });
  });

  it('only open jobs are shown, as everywhere', async () => {
    const where = await search({ section: 'early' });

    expect(where.status).toBe('ACTIVE');
    expect(where.closesAt.gt).toBeInstanceOf(Date);
  });

  it('filters on stipend, paid only, duration, schedule and the offer tag', async () => {
    const where = await search({ section: 'early', salaryMin: '500', paid: '1', maxDuration: '3', schedule: 'PART_TIME', offer: '1' });

    expect(where.AND).toEqual(
      expect.arrayContaining([
        { OR: [{ salaryMax: { gte: 500 } }, { salaryMax: null, salaryMin: { gte: 500 } }] },
        { unpaid: false },
        { possibleJobOffer: true },
        { durationMonths: { lte: 3 } },
        { schedule: 'PART_TIME' },
      ]),
    );
  });

  it('"starts now" and "start by a date" both include roles that start immediately', async () => {
    const now = await search({ section: 'early', startsNow: '1' });
    expect(now.AND).toContainEqual({ startsImmediately: true });

    prismaMock.job.findMany.mockClear();
    const by = await search({ section: 'early', startBy: '2027-01-31' });
    expect(by.AND[0].OR).toEqual([{ startsImmediately: true }, { startDate: { lte: new Date('2027-01-31T00:00:00.000Z') } }]);
  });

  it('an unreadable date or schedule is ignored, not an error', async () => {
    const where = await search({ section: 'early', startBy: 'tomorrow-ish', schedule: 'EVENINGS' });

    expect(where.AND).toBeUndefined();
  });

  it('a normal search is not narrowed to early-career types', async () => {
    const where = await search({ type: 'Full-time' });

    expect(where.type).toEqual({ contains: 'Full-time' });
  });
});

describe('Google job data', () => {
  const seoJob = (type: string, extra: Record<string, unknown> = {}) => ({
    id: 'j1',
    title: 'Marketing intern',
    description: 'Help us.',
    type,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    closesAt: new Date('2026-12-01T00:00:00.000Z'),
    employerName: 'Achiba Star Hotel',
    location: 'Accra, Ghana',
    ...extra,
  });

  it('internships and attachments are INTERN, not OTHER', () => {
    expect(mapEmploymentType('Internship')).toBe('INTERN');
    expect(mapEmploymentType('Industrial Attachment')).toBe('INTERN');
    expect(employmentTypeFor('internship')).toBe('INTERN');
  });

  it('adds full or part time when the employer said which', () => {
    expect(mapEmploymentType('Internship', 'PART_TIME')).toEqual(['INTERN', 'PART_TIME']);
    expect(mapEmploymentType('Industrial Attachment', 'FULL_TIME')).toEqual(['INTERN', 'FULL_TIME']);
  });

  it('National Service is a temporary post, and a graduate job is full time unless it says part time', () => {
    expect(mapEmploymentType('National Service (NSS)')).toBe('TEMPORARY');
    expect(mapEmploymentType('National Service (NSS)', 'FULL_TIME')).toEqual(['TEMPORARY', 'FULL_TIME']);
    expect(mapEmploymentType('Graduate / Entry-level Job')).toBe('FULL_TIME');
    expect(mapEmploymentType('Graduate / Entry-level Job', 'PART_TIME')).toBe('PART_TIME');
  });

  it('ordinary types are as before', () => {
    expect(mapEmploymentType('Full-time')).toBe('FULL_TIME');
    expect(mapEmploymentType('Contract')).toBe('CONTRACTOR');
    expect(mapEmploymentType('Seasonal')).toBe('OTHER');
  });

  it('the JobPosting uses it, and shows the stipend as monthly pay only when there is one', () => {
    const paid = buildJobPostingJsonLd(seoJob('Internship', { schedule: 'FULL_TIME', salaryMin: 500, salaryMax: 800 }) as never, 'https://jobwahala.com');
    expect(paid.employmentType).toEqual(['INTERN', 'FULL_TIME']);
    expect(paid.baseSalary).toMatchObject({ currency: 'GHS', value: { minValue: 500, maxValue: 800, unitText: 'MONTH' } });

    const unpaid = buildJobPostingJsonLd(seoJob('Internship', { unpaid: true }) as never, 'https://jobwahala.com');
    expect(unpaid.employmentType).toBe('INTERN');
    expect(unpaid).not.toHaveProperty('baseSalary');
  });
});

describe('alerts and the sitemap', () => {
  it('an alert for "Internship" matches new internships only', () => {
    const alert = { jobType: 'Internship' };

    expect(searchMatchesJob(alert, { title: 'Marketing intern', type: 'Internship' })).toBe(true);
    expect(searchMatchesJob(alert, { title: 'Marketing intern', type: 'National Service (NSS)' })).toBe(false);
    expect(searchMatchesJob({ jobType: 'National Service (NSS)', location: 'Accra' }, { title: 'x', type: 'National Service (NSS)', location: 'Accra, Ghana' })).toBe(true);
  });

  it('one "Internships & NSS" alert covers all four early-career types and nothing else', () => {
    const alert = { jobType: 'Internships & NSS', location: 'Accra' };

    for (const type of EARLY_CAREER_TYPES) {
      expect(searchMatchesJob(alert, { title: 'x', type, location: 'Accra' })).toBe(true);
    }
    expect(searchMatchesJob(alert, { title: 'x', type: 'Full-time', location: 'Accra' })).toBe(false);
    expect(searchMatchesJob(alert, { title: 'x', type: 'Internship', location: 'Kumasi' })).toBe(false);
  });

  it('the Internships & NSS page is in the sitemap', () => {
    expect(staticSitemapPaths.map((entry) => entry.path)).toContain('/internships');
  });
});

describe('a job seeker\'s early-career details', () => {
  const parse = (body: Record<string, unknown>) => getProfileUpdateSchema('SEEKER').safeParse({ body });

  it('accepts student, NSS or graduate with institution, programme and completion year', () => {
    for (const careerStage of ['STUDENT', 'NSS', 'GRADUATE']) {
      expect(parse({ careerStage, institution: 'University of Ghana', programme: 'BSc Computer Science', completionYear: 2027 }).success).toBe(true);
    }
  });

  it('accepts clearing them, and refuses nonsense', () => {
    expect(parse({ careerStage: '', institution: '', completionYear: null }).success).toBe(true);
    expect(parse({ careerStage: 'RETIRED' }).success).toBe(false);
    expect(parse({ completionYear: 1950 }).success).toBe(false);
    expect(parse({ completionYear: 2100 }).success).toBe(false);
    expect(parse({ completionYear: 2027.5 }).success).toBe(false);
    expect(parse({ institution: 'x'.repeat(121) }).success).toBe(false);
  });
});
