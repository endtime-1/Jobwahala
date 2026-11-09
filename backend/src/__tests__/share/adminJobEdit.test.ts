import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

const prismaMock = vi.hoisted(() => {
  const mock: Record<string, any> = {
    job: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    adminActionLog: { create: vi.fn() },
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});
vi.mock('../../config/prisma', () => ({ default: prismaMock }));

import { updateJobContent } from '../../controllers/adminController';
import { updateAdminJobContentSchema } from '../../validation/adminSchemas';
import { adminRouterPaths } from '../acquisition/helpers';
import { renderJobListPage } from '../../utils/seoPages';
import { buildLandingIndex, buildLandingPage, landingSitemapPaths, MIN_JOBS, type LandingJob } from '../../utils/landingPages';
import { siteCopy } from '../../content/siteCopy';

const respond = () => {
  const state: { status: number; body: any } = { status: 200, body: null };
  const res = {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  } as unknown as Response;
  return { res, state };
};

const call = (body: Record<string, unknown>) =>
  ({ body, params: { id: 'job-1' }, user: { id: 'admin-1', role: 'ADMIN' } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.job.findUnique.mockResolvedValue({ id: 'job-1', title: 'B2B SALES EXCUTIVE', description: 'Old text' });
  prismaMock.job.update.mockImplementation(async ({ data }: { data: object }) => ({ id: 'job-1', ...data }));
  prismaMock.user.findUnique.mockResolvedValue({ email: 'admin@jobwahala.com' });
});

describe('an admin fixing a job typo', () => {
  it('changes the title and writes who, what and why to the admin action log', async () => {
    const { res, state } = respond();
    await updateJobContent(call({ title: 'B2B SALES EXECUTIVE', reason: 'typo, employer agreed on WhatsApp' }), res);

    expect(state.status).toBe(200);
    expect(prismaMock.job.update).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: { title: 'B2B SALES EXECUTIVE' } });
    const log = prismaMock.adminActionLog.create.mock.calls[0][0].data;
    expect(log).toMatchObject({ adminId: 'admin-1', adminEmail: 'admin@jobwahala.com', action: 'job.edit_content', targetType: 'Job', targetId: 'job-1', reason: 'typo, employer agreed on WhatsApp' });
    expect(JSON.parse(log.metadata).changes.title).toEqual({ from: 'B2B SALES EXCUTIVE', to: 'B2B SALES EXECUTIVE' });
  });

  it('does nothing, and logs nothing, when nothing changed or the job does not exist', async () => {
    const same = respond();
    await updateJobContent(call({ title: 'B2B SALES EXCUTIVE', reason: 'no change' }), same.res);
    expect(same.state.status).toBe(400);

    prismaMock.job.findUnique.mockResolvedValue(null);
    const missing = respond();
    await updateJobContent(call({ title: 'x', reason: 'typo' }), missing.res);
    expect(missing.state.status).toBe(404);
    expect(prismaMock.job.update).not.toHaveBeenCalled();
    expect(prismaMock.adminActionLog.create).not.toHaveBeenCalled();
  });

  it('needs a reason and at least a title or a description, and only admins reach it', async () => {
    const parse = (body: object) => updateAdminJobContentSchema.safeParse({ body, params: { id: 'job-1' } }).success;
    expect(parse({ title: 'Fixed', reason: 'typo' })).toBe(true);
    expect(parse({ description: 'Fixed text', reason: 'typo' })).toBe(true);
    expect(parse({ title: 'Fixed' })).toBe(false);
    expect(parse({ reason: 'typo' })).toBe(false);
    expect(parse({ title: 'Fixed', reason: 'typo', status: 'ACTIVE' })).toBe(false);
    expect(await adminRouterPaths()).toContain('/jobs/:id');
  });
});

describe('the /jobs page for crawlers', () => {
  it('has an intro and Browse links, so a page with few jobs is not a thin list', () => {
    const html = renderJobListPage({
      heading: 'Open jobs across Africa',
      description: 'Browse and apply for real jobs across Africa.',
      intro: 'Find real jobs in Ghana and across Africa from employers you can check.',
      path: '/jobs',
      jobs: [],
      siteUrl: 'https://www.jobwahala.com',
      browse: true,
    });
    for (const heading of ['Browse by location', 'Browse by category', 'Internships &amp; NSS']) expect(html).toContain(`<h2>${heading}</h2>`);
    expect(html).toContain('href="https://www.jobwahala.com/jobs-in-accra"');
    expect(html).toContain('href="https://www.jobwahala.com/banking-jobs"');
    expect(html).toContain('href="https://www.jobwahala.com/internships"');
  });
});

describe('the home page description', () => {
  it('is under 160 characters', () => {
    expect(siteCopy.description.length).toBeLessThan(160);
  });
});

describe('landing pages with few jobs', () => {
  const jobs = (n: number): LandingJob[] =>
    Array.from({ length: n }, (_, i) => ({ id: `j${i}`, title: 'Bank Teller', location: 'Accra', type: 'Full-time', category: 'Banking', createdAt: new Date(), employerName: 'Bank' }));

  it(`stay noindex and out of the sitemap below ${MIN_JOBS} jobs, and are indexed from ${MIN_JOBS}`, () => {
    for (const [count, indexed] of [[2, false], [MIN_JOBS, true]] as const) {
      const index = buildLandingIndex(jobs(count));
      const page = buildLandingPage('jobs-in-accra', index)!;
      expect(page.indexable).toBe(indexed);
      expect(landingSitemapPaths(index).includes('jobs-in-accra') || landingSitemapPaths(index).includes('/jobs-in-accra')).toBe(indexed);
    }
  });
});
