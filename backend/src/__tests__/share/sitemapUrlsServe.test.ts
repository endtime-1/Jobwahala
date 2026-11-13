import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  job: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  course: { findMany: vi.fn().mockResolvedValue([]) },
  blogPost: { findMany: vi.fn(), findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
}));
vi.mock('../../config/prisma', () => ({ default: prismaMock }));

import { getBlogPostSharePage, getCompanySharePage, getJobSharePage, getSitemapPart, SITEMAP_PARTS } from '../../controllers/shareController';
import { publicJobWhere } from '../../utils/jobLifecycle';

const respond = () => {
  const out = { status: 200, body: '', location: '' };
  const res = {
    status(code: number) {
      out.status = code;
      return this;
    },
    type() {
      return this;
    },
    set() {
      return this;
    },
    send(body: string) {
      out.body = body;
      return this;
    },
    redirect(code: number, url: string) {
      out.status = code;
      out.location = url;
      return this;
    },
  } as unknown as Response;
  return { res, out };
};
const req = (params: Record<string, string> = {}) =>
  ({ params, protocol: 'https', headers: {}, get: (name: string) => (name === 'host' ? 'www.jobwahala.com' : undefined) }) as unknown as Request;

const liveJob = {
  id: 'job-1', title: 'Accountant', description: 'Do the books', location: 'Accra, Ghana', type: 'FULL_TIME', category: 'Finance', salary: null, salaryMin: null, salaryMax: null,
  createdAt: new Date('2026-11-01'), closesAt: new Date('2027-01-01'), schedule: null, durationMonths: null, unpaid: false, postedByAdminId: null, applyInstructions: null,
  employerId: 'emp-1', updatedAt: new Date('2026-11-02'),
  employer: { employerProfile: { companyName: 'Acme', logoUrl: null, website: null } },
};
const livePost = { slug: 'real-post', title: 'Real post', metaDescription: 'd', category: 'cv-tips', body: 'Hello', coverImageUrl: null, coverImageAlt: null, authorName: 'JobWahala', publishAt: new Date('2026-11-01'), updatedAt: new Date('2026-11-02') };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.course.findMany.mockResolvedValue([]);
  prismaMock.job.findMany.mockResolvedValue([liveJob]);
  prismaMock.blogPost.findMany.mockResolvedValue([livePost]);
  prismaMock.blogPost.findFirst.mockResolvedValue(livePost);
  prismaMock.job.findFirst.mockResolvedValue(liveJob);
  prismaMock.user.findFirst.mockResolvedValue({
    id: 'emp-1',
    employerProfile: { companyName: 'Acme', industry: null, description: 'We do things', logoUrl: null, isFoundingEmployer: false },
    verificationRequests: [],
    jobsPosted: [{ id: 'job-1', title: 'Accountant', location: 'Accra', type: 'FULL_TIME' }],
  });
});

describe('every dynamic URL in the sitemaps answers 200', () => {
  it('serves each job, blog post and company the sitemap lists, and only asks for public ones', async () => {
    const listed: string[] = [];
    for (const part of SITEMAP_PARTS) {
      const { res, out } = respond();
      await getSitemapPart(req({ part }), res);
      expect(out.status).toBe(200);
      listed.push(...[...out.body.matchAll(/<loc>https:\/\/www\.jobwahala\.com([^<]+)<\/loc>/g)].map((m) => m[1]));
    }

    // Closed, expired and draft items can never be listed.
    expect(prismaMock.job.findMany.mock.calls[0][0].where).toMatchObject({ status: publicJobWhere().status });
    expect(prismaMock.blogPost.findMany.mock.calls[0][0].where).toMatchObject({ status: 'PUBLISHED' });

    const dynamic = listed.filter((path) => /^\/(jobs|companies|blog)\/[^/]+$/.test(path));
    expect(dynamic.length).toBeGreaterThanOrEqual(3);

    for (const path of dynamic) {
      const [, kind, id] = path.split('/');
      const { res, out } = respond();
      if (kind === 'jobs') await getJobSharePage(req({ id }), res);
      else if (kind === 'companies') await getCompanySharePage(req({ id }), res);
      else await getBlogPostSharePage(req({ slug: id }), res);
      expect(out.status, path).toBe(200);
    }
  });
});

describe('closed jobs', () => {
  it('answer 410 with a "This job has closed" page, noindex, and similar open jobs', async () => {
    prismaMock.job.findFirst.mockResolvedValue(null);
    prismaMock.job.findUnique.mockResolvedValue({ id: 'gone', title: 'Old role', category: 'Finance', location: 'Accra' });
    const { res, out } = respond();
    await getJobSharePage(req({ id: 'gone' }), res);

    expect(out.status).toBe(410);
    expect(out.body).toContain('This job has closed');
    expect(out.body).toContain('<meta name="robots" content="noindex, follow">');
    expect(out.body).toContain('/jobs/job-1');
    expect(out.body).not.toContain('JobPosting');
    // similar jobs must be open jobs only
    expect(prismaMock.job.findMany.mock.calls[0][0].where).toMatchObject({ status: publicJobWhere().status });
  });
});

describe('moved blog addresses', () => {
  it('redirects the old fake-job-advert address to the live article with a 301', async () => {
    prismaMock.blogPost.findFirst.mockImplementation(async ({ where }: { where: { slug: string } }) =>
      where.slug === 'how-to-spot-a-fake-job-advert-in-ghana-2026-guide-jobwahala' ? { ...livePost, slug: where.slug } : null,
    );
    const { res, out } = respond();
    await getBlogPostSharePage(req({ slug: 'how-to-spot-fake-job-adverts-ghana' }), res);

    expect(out.status).toBe(301);
    expect(out.location).toBe('https://www.jobwahala.com/blog/how-to-spot-a-fake-job-advert-in-ghana-2026-guide-jobwahala');
  });

  it('still answers 404 for an address that never existed', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(null);
    const { res, out } = respond();
    await getBlogPostSharePage(req({ slug: 'nope' }), res);
    expect(out.status).toBe(404);
  });
});

describe('titles do not repeat the site name', () => {
  it('strips a trailing "| JobWahala" from the stored title', async () => {
    const { stripBrand, renderShell } = await import('../../utils/seoPages');
    expect(stripBrand('How to Write a CV | JobWahala - JobWahala')).toBe('How to Write a CV');
    expect(stripBrand('Open jobs across Africa')).toBe('Open jobs across Africa');
    const html = renderShell({ title: 'A guide | JobWahala', description: 'd', url: 'https://x/y', siteUrl: 'https://x', body: '' });
    expect(html).toContain('<title>A guide | JobWahala</title>');
  });
});
