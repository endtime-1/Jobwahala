import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const prismaMock = vi.hoisted(() => {
  const mock: Record<string, any> = {
    employerProfile: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    job: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    adminActionLog: { create: vi.fn() },
    user: { findUnique: vi.fn() },
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});
vi.mock('../../config/prisma', () => ({ default: prismaMock }));

const company = vi.hoisted(() => ({ createManagedCompany: vi.fn() }));
vi.mock('../../services/acquisitionService', () => company);
vi.mock('../../services/jobAlertService', () => ({ notifyJobAlerts: vi.fn().mockResolvedValue(undefined) }));

import { parseCsv } from '../../utils/csv';
import { composeLocation, parseDateText, readJobCsv } from '../../utils/jobImport';
import { importJobs } from '../../services/jobImportService';
import { importJobsSchema } from '../../validation/adminSchemas';
import { renderJobPage } from '../../utils/seoPages';
import { adminRouterPaths } from '../acquisition/helpers';

const sbp = readFileSync(resolve(__dirname, '../fixtures/sbp_jobs.csv'), 'utf8');
const admin = { id: 'admin-1', email: 'admin@jobwahala.com' };
const now = new Date('2026-11-09T10:00:00Z');
const input = (over: object = {}) => ({
  csv: sbp,
  company: { name: 'Strategic Jobs Africa (powered by SBP Africa)', website: 'sbpafrica.group', email: 'recruitment@sbpafrica.group' },
  defaultType: 'Full-time',
  defaultClosingDate: '2026-12-09',
  dryRun: false,
  ...over,
});

let jobCounter = 0;
beforeEach(() => {
  vi.clearAllMocks();
  jobCounter = 0;
  prismaMock.employerProfile.findMany.mockResolvedValue([]);
  prismaMock.job.findMany.mockResolvedValue([]);
  prismaMock.job.create.mockImplementation(async ({ data }: { data: object }) => ({ id: `job-${(jobCounter += 1)}`, ...data }));
  company.createManagedCompany.mockResolvedValue({ id: 'company-1', companyName: 'Strategic Jobs Africa (powered by SBP Africa)', claimStatus: 'UNCLAIMED' });
});

describe('reading a CSV', () => {
  it('keeps commas, quotes and line breaks inside quoted cells', () => {
    const rows = parseCsv('a,b\r\n"one, two","line1\nline2 ""quoted"""\r\n');
    expect(rows).toEqual([['a', 'b'], ['one, two', 'line1\nline2 "quoted"']]);
  });

  it('reads the SBP file as 12 jobs with their full text', () => {
    const rows = readJobCsv(sbp, { type: 'Full-time', closesAt: new Date('2026-12-09T23:59:59Z') }, now);
    expect(rows).toHaveLength(12);
    expect(rows.every((row) => row.problems.length === 0)).toBe(true);
    expect(rows[0].title).toBe('Engineering Stores Officer');
    expect(rows[0].description.startsWith('WE ARE HIRING: ENGINEERING STORES OFFICER')).toBe(true);
    expect(rows[0].description).toContain("Bachelor's degree in Engineering");
    expect(rows[0].description.endsWith('Location: Accra-Spintex')).toBe(true);
    expect(rows[0].applyInstructions).toBe('Send CV to:\nWhatsApp: 0544128417\nEmail: recruitment@sbpafrica.group');
    expect(rows[10].applyInstructions).toContain('Use "Business Development Executive (Oil & Gas)" as the Subject.');
  });

  it('turns "Not specified" into the defaults, and keeps real pay as written', () => {
    const rows = readJobCsv(sbp, { type: 'Full-time', closesAt: new Date('2026-12-09T23:59:59Z') }, now);
    for (const row of rows) {
      expect(row.type).toBe('Full-time');
      expect(row.closesAt.toISOString()).toBe('2026-12-09T23:59:59.000Z');
    }
    expect(rows[0].salary).toBeNull();
    const social = rows.find((row) => row.title.startsWith('Social Media'))!;
    expect(social.salary).toBe('GHC 1,500 - 2,000 plus accommodation');
    expect(social.salaryMin).toBe(1500);
    expect(social.salaryMax).toBe(2000);
    expect(rows.find((row) => row.title === 'Sales Girl')!.salary).toBe('GHC 1,200 - 1,500');
  });

  it('puts the region with the location, and leaves out a region that is several', () => {
    expect(composeLocation('Accra-Spintex', 'Greater Accra')).toBe('Accra-Spintex, Greater Accra');
    expect(composeLocation('Kumasi', 'Ashanti')).toBe('Kumasi, Ashanti');
    expect(composeLocation('Temale, Somanya, Wa and Lapaz', 'Multiple regions')).toBe('Temale, Somanya, Wa and Lapaz');
    expect(composeLocation('Accra and Kumasi', 'Greater Accra / Ashanti')).toBe('Accra and Kumasi');
    expect(composeLocation('Agbogba, Accra', 'Greater Accra')).toBe('Agbogba, Accra, Greater Accra');
  });

  it('reads dates and flags a closing date that has passed or cannot be read', () => {
    expect(parseDateText('9 Dec 2026')?.toISOString()).toBe('2026-12-09T23:59:59.000Z');
    expect(parseDateText('9 December 2026')?.toISOString()).toBe('2026-12-09T23:59:59.000Z');
    expect(parseDateText('2026-12-09')?.toISOString()).toBe('2026-12-09T23:59:59.000Z');
    expect(parseDateText('09/12/2026')?.toISOString()).toBe('2026-12-09T23:59:59.000Z');
    expect(parseDateText('31/02/2026')).toBeNull();

    const csv = 'Job title,Description,Closing date\nA,Text,1 Jan 2020\nB,Text,someday\nC,Text,15 Dec 2026\n';
    const rows = readJobCsv(csv, { type: 'Full-time', closesAt: new Date('2026-12-09T23:59:59Z') }, now);
    expect(rows[0].problems[0]).toContain('already passed');
    expect(rows[1].problems[0]).toContain('Could not read the closing date');
    expect(rows[2].problems).toEqual([]);
    expect(rows[2].closesAt.toISOString()).toBe('2026-12-15T23:59:59.000Z');
  });
});

describe('importing the SBP jobs', () => {
  it('creates the company when it does not exist (with its website and email) and all 12 jobs on its behalf', async () => {
    const result = await importJobs(admin, input(), now);

    expect(company.createManagedCompany).toHaveBeenCalledWith(admin, { companyName: 'Strategic Jobs Africa (powered by SBP Africa)', website: 'https://sbpafrica.group', contactPhone: null });
    expect(prismaMock.employerProfile.update).toHaveBeenCalledWith({ where: { userId: 'company-1' }, data: { contactEmail: 'recruitment@sbpafrica.group' } });
    expect(result.company).toMatchObject({ id: 'company-1', exists: false });
    expect(result.counts).toEqual({ created: 12, skipped: 0, invalid: 0 });
    expect(prismaMock.job.create).toHaveBeenCalledTimes(12);

    const data = prismaMock.job.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      employerId: 'company-1',
      postedByAdminId: 'admin-1',
      title: 'Engineering Stores Officer',
      location: 'Accra-Spintex, Greater Accra',
      category: 'Supply Chain / Logistics',
      type: 'Full-time',
      salary: null,
    });
    expect(data.closesAt.toISOString()).toBe('2026-12-09T23:59:59.000Z');
    expect(data.applyInstructions).toContain('WhatsApp: 0544128417');
    expect(result.lines.map((line) => line.path)).toEqual(Array.from({ length: 12 }, (_, i) => `/jobs/job-${i + 1}`));
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ action: 'JOBS_IMPORTED', targetId: 'company-1' });
  });

  it('skips a title that already exists for the company, and a repeat run creates nothing', async () => {
    prismaMock.employerProfile.findMany.mockResolvedValue([{ userId: 'company-1', companyName: 'Strategic Jobs Africa (powered by SBP Africa)' }]);
    prismaMock.job.findMany.mockResolvedValue([{ title: 'engineering stores officer' }]);

    const result = await importJobs(admin, input(), now);
    expect(company.createManagedCompany).not.toHaveBeenCalled();
    expect(result.counts).toEqual({ created: 11, skipped: 1, invalid: 0 });
    expect(result.lines[0]).toMatchObject({ title: 'Engineering Stores Officer', status: 'skipped' });

    prismaMock.job.findMany.mockResolvedValue(parseCsv(sbp).slice(1).map((cells) => ({ title: cells[0] })));
    const again = await importJobs(admin, input(), now);
    expect(again.counts).toEqual({ created: 0, skipped: 12, invalid: 0 });
  });

  it('uses the company picked in the Growth section, whatever the file says, and never creates a second copy', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ userId: 'growth-1', companyName: 'SBP Africa (assigned)' });
    const result = await importJobs(admin, input({ company: { id: 'growth-1' } }), now);

    expect(company.createManagedCompany).not.toHaveBeenCalled();
    expect(prismaMock.employerProfile.findMany).not.toHaveBeenCalled();
    expect(result.company).toMatchObject({ id: 'growth-1', name: 'SBP Africa (assigned)', exists: true });
    expect(result.counts.created).toBe(12);
    expect(new Set(prismaMock.job.create.mock.calls.map((call: any[]) => call[0].data.employerId))).toEqual(new Set(['growth-1']));

    prismaMock.employerProfile.findUnique.mockResolvedValue(null);
    await expect(importJobs(admin, input({ company: { id: 'gone' } }), now)).rejects.toThrow('no longer exists');
  });

  it('a preview changes nothing', async () => {
    const result = await importJobs(admin, input({ dryRun: true }), now);
    expect(result.dryRun).toBe(true);
    expect(result.counts.created).toBe(12);
    expect(result.lines.every((line) => line.status === 'would_create' && !line.path)).toBe(true);
    expect(company.createManagedCompany).not.toHaveBeenCalled();
    expect(prismaMock.job.create).not.toHaveBeenCalled();
    expect(prismaMock.adminActionLog.create).not.toHaveBeenCalled();
  });

  it('skips a duplicate title inside the file, reports bad rows, and ignores the "Check before posting" column', async () => {
    const csv = 'Job title,Description,How to apply,Check before posting\nCook,Cook meals.,Call 0244000000,do not post\ncook,Same job again.,,\n,No title,,\n';
    const result = await importJobs(admin, input({ csv, company: { name: 'Café Ltd' }, defaultClosingDate: '2026-12-09' }), now);
    expect(result.counts).toEqual({ created: 1, skipped: 1, invalid: 1 });
    expect(result.lines[2].reason).toContain('title is empty');
    expect(JSON.stringify(prismaMock.job.create.mock.calls)).not.toContain('do not post');
  });

  it('refuses a missing or past default closing date, and no company name', async () => {
    await expect(importJobs(admin, input({ defaultClosingDate: '' }), now)).rejects.toThrow('closing date');
    await expect(importJobs(admin, input({ defaultClosingDate: '2026-01-01' }), now)).rejects.toThrow('future');
    await expect(importJobs(admin, input({ company: {} , csv: 'Job title,Description\nA,B\n' }), now)).rejects.toThrow('company name');
  });
});

describe('the job page for a job applied for outside JobWahala', () => {
  const job = {
    id: 'job-1',
    title: 'Scouts',
    description: 'WE ARE HIRING: SCOUTS',
    location: 'Madina, Greater Accra',
    type: 'Full-time',
    createdAt: now,
    closesAt: new Date('2026-12-09T23:59:59Z'),
    employerName: 'Strategic Jobs Africa (powered by SBP Africa)',
    postedOnBehalf: true,
    applyInstructions: 'Send CV to:\nWhatsApp: 0547125675\nEmail: recruitment@sbpafrica.group',
  };

  it('shows "How to apply" and says so to Google (no direct apply), and is marked as posted on behalf', () => {
    const html = renderJobPage(job, 'https://www.jobwahala.com');
    expect(html).toContain('<h2>How to apply</h2>');
    expect(html).toContain('<p>WhatsApp: 0547125675</p>');
    expect(html).toContain('<p>Email: recruitment@sbpafrica.group</p>');
    expect(html).toContain('Posted by JobWahala on behalf of Strategic Jobs Africa (powered by SBP Africa).');
    expect(html).toContain('"directApply":false');
    expect(html).not.toContain('Apply for this job on JobWahala');
  });

  it('keeps the JobWahala apply link and directApply for ordinary jobs', () => {
    const html = renderJobPage({ ...job, applyInstructions: null }, 'https://www.jobwahala.com');
    expect(html).toContain('"directApply":true');
    expect(html).toContain('Apply for this job on JobWahala');
  });
});

describe('the import tool for admins', () => {
  it('validates the request and sits behind the admin router', async () => {
    const ok = (body: object) => importJobsSchema.safeParse({ body }).success;
    expect(ok(input())).toBe(true);
    expect(ok({ ...input(), dryRun: 'yes' })).toBe(false);
    expect(ok({ ...input(), csv: '' })).toBe(false);
    expect(await adminRouterPaths()).toContain('/jobs/import');
  });

  it('in-app applications to such a job are refused', async () => {
    prismaMock.job.findFirst.mockResolvedValue({ id: 'job-1', applyInstructions: 'Send CV to: x@y.com', employerId: 'company-1' });
    const { applyForJob } = await import('../../controllers/jobController');
    let status = 0;
    let message = '';
    const res = { status: (code: number) => ((status = code), res), json: (body: { message: string }) => ((message = body.message), res) } as unknown as Response;
    await applyForJob({ params: { id: 'job-1' }, body: {}, user: { id: 'seeker-1', role: 'SEEKER' } } as unknown as Request & { user: { id: string; role: string } }, res);
    expect(status).toBe(400);
    expect(message).toContain('outside JobWahala');
  });
});
