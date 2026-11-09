import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({ job: { findMany: vi.fn() }, course: { findMany: vi.fn() } }));
vi.mock('../../config/prisma', () => ({ default: prismaMock }));

import {
  MIN_JOBS,
  buildLandingIndex,
  buildLandingPage,
  categoriesOfJob,
  landingSitemapPaths,
  looksLikeLandingSlug,
  mentions,
  placesOfJob,
  slugify,
  typesOfJob,
  type LandingJob,
} from '../../utils/landingPages';
import { renderLandingNotFound, renderLandingPage } from '../../utils/landingRender';
import { getLandingJson, getLandingSharePage, getSitemap, resetLandingCache } from '../../controllers/shareController';

let counter = 0;
const job = (overrides: Partial<LandingJob> = {}): LandingJob => {
  counter += 1;
  return {
    id: `job-${counter}`,
    title: 'Customer Service Agent',
    location: 'Accra, Ghana',
    type: 'Full-time',
    category: 'Customer service',
    salary: null,
    salaryMin: null,
    createdAt: new Date(2026, 10, counter % 28 + 1),
    employerName: `Company ${counter % 4}`,
    ...overrides,
  };
};
const many = (count: number, overrides: Partial<LandingJob> = {}) => Array.from({ length: count }, () => job(overrides));
const pageOf = (slug: string, jobs: LandingJob[]) => buildLandingPage(slug, buildLandingIndex(jobs));

describe('working out where a job is', () => {
  it('matches whole words only: Ho is a town, Hotel is not', () => {
    expect(mentions('Ho, Volta', 'Ho')).toBe(true);
    expect(mentions('Hotel Road, Kumasi', 'Ho')).toBe(false);
    expect(mentions('Cape Coast', 'cape coast')).toBe(true);
    expect(mentions(null, 'Accra')).toBe(false);
  });

  it('finds the town, and the region it belongs to', () => {
    expect(placesOfJob({ location: 'Kumasi, Ghana' }).map((place) => place.slug).sort()).toEqual(['ashanti-region', 'kumasi']);
    expect(placesOfJob({ location: 'Spintex Road, Accra' }).map((place) => place.slug)).toContain('accra');
    expect(placesOfJob({ location: 'Tamale' }).map((place) => place.slug)).toContain('northern-region');
  });

  it('finds a region named on its own', () => {
    expect(placesOfJob({ location: 'Ashanti Region' }).map((place) => place.slug)).toEqual(['ashanti-region']);
  });

  it('uses the first part of an unfamiliar place as a town, but never "Remote" or a country', () => {
    expect(placesOfJob({ location: 'Weija, Ghana' }).map((place) => place.slug)).toEqual(['weija']);
    expect(placesOfJob({ location: 'Remote' })).toEqual([]);
    expect(placesOfJob({ location: 'Ghana' })).toEqual([]);
    expect(placesOfJob({ location: null })).toEqual([]);
  });
});

describe('categories and types', () => {
  it('finds a category from the category or the title', () => {
    expect(categoriesOfJob({ title: 'Loan Officer', category: null }).map((c) => c.slug)).toContain('banking');
    expect(categoriesOfJob({ title: 'Teller', category: 'Banking' }).map((c) => c.slug)).toContain('banking');
    expect(categoriesOfJob({ title: 'Primary school teacher', category: null }).map((c) => c.slug)).toContain('education');
  });

  it('does not match inside other words', () => {
    expect(categoriesOfJob({ title: 'Embankment engineer', category: null }).map((c) => c.slug)).not.toContain('banking');
    expect(categoriesOfJob({ title: 'Marshal', category: null }).map((c) => c.slug)).not.toContain('human-resources');
  });

  it('knows the job types, including remote and the early-career ones', () => {
    expect(typesOfJob({ type: 'Part-time', location: 'Accra' }).map((t) => t.slug)).toEqual(['part-time']);
    expect(typesOfJob({ type: 'Full-time', location: 'Remote' }).map((t) => t.slug).sort()).toEqual(['full-time', 'remote']);
    expect(typesOfJob({ type: 'Internship', location: 'Accra' }).map((t) => t.slug)).toEqual(['internship']);
    expect(typesOfJob({ type: 'National Service (NSS)', location: 'Accra' }).map((t) => t.slug)).toEqual(['nss']);
    expect(typesOfJob({ type: 'Industrial Attachment', location: 'Accra' }).map((t) => t.slug)).toEqual(['attachment']);
    expect(typesOfJob({ type: 'Graduate / Entry-level Job', location: 'Accra' }).map((t) => t.slug)).toEqual(['fresher']);
  });
});

describe('which pages exist', () => {
  const jobs = many(4, { title: 'Bank Teller', category: 'Banking', location: 'Accra, Ghana' });

  it('makes the city, category and combined pages from clean addresses', () => {
    const index = buildLandingIndex(jobs);

    for (const slug of ['jobs-in-accra', 'banking-jobs', 'banking-jobs-in-accra', 'full-time-jobs', 'full-time-jobs-in-accra', 'jobs-in-greater-accra-region']) {
      expect(buildLandingPage(slug, index), slug).not.toBeNull();
    }
  });

  it('every city in the list has a page, even before anyone posts there', () => {
    for (const city of ['accra', 'kumasi', 'takoradi', 'tamale', 'cape-coast', 'ho', 'koforidua', 'sunyani']) {
      const page = pageOf(`jobs-in-${city}`, []);
      expect(page, city).not.toBeNull();
      expect(page!.count).toBe(0);
    }
  });

  it('every job type has a page', () => {
    for (const type of ['part-time', 'remote', 'internship', 'nss', 'attachment', 'fresher']) {
      expect(pageOf(`${type}-jobs`, []), type).not.toBeNull();
    }
  });

  it('is a real 404 for anything else', () => {
    for (const slug of ['jobs-in-narnia', 'wizard-jobs', 'banking-jobs-in-narnia', 'jobs-in-', 'about', 'banking-jobs-in-accra-extra']) {
      expect(pageOf(slug, jobs), slug).toBeNull();
    }
  });

  it('a town only in the data gets a page once a job is there', () => {
    expect(pageOf('jobs-in-weija', [])).toBeNull();
    expect(pageOf('jobs-in-weija', [job({ location: 'Weija' })])).not.toBeNull();
  });

  it('recognises our address shapes', () => {
    expect(looksLikeLandingSlug('jobs-in-accra')).toBe(true);
    expect(looksLikeLandingSlug('banking-jobs')).toBe(true);
    expect(looksLikeLandingSlug('banking-jobs-in-accra')).toBe(true);
    expect(looksLikeLandingSlug('jobs-by-location')).toBe(true);
    expect(looksLikeLandingSlug('dashboard')).toBe(false);
  });
});

describe('publishing only pages with enough jobs', () => {
  it('needs at least 3 open jobs', () => {
    expect(MIN_JOBS).toBe(3);
  });

  it('2 jobs: the page works but says noindex, and stays out of the sitemap', () => {
    const jobs = many(2, { location: 'Takoradi' });
    const page = pageOf('jobs-in-takoradi', jobs)!;

    expect(page.count).toBe(2);
    expect(page.indexable).toBe(false);
    expect(page.jobs).toHaveLength(2);
    expect(landingSitemapPaths(buildLandingIndex(jobs))).not.toContain('/jobs-in-takoradi');
    expect(renderLandingPage(page, 'https://jobwahala.com')).toContain('<meta name="robots" content="noindex, follow">');
  });

  it('3 jobs: the page is published and in the sitemap', () => {
    const jobs = many(3, { location: 'Takoradi' });
    const page = pageOf('jobs-in-takoradi', jobs)!;

    expect(page.indexable).toBe(true);
    expect(landingSitemapPaths(buildLandingIndex(jobs))).toContain('/jobs-in-takoradi');
    expect(renderLandingPage(page, 'https://jobwahala.com')).not.toContain('noindex');
  });

  it('a page with no jobs is noindex too', () => {
    const page = pageOf('banking-jobs', [])!;

    expect(page.indexable).toBe(false);
    expect(renderLandingPage(page, 'https://jobwahala.com')).toContain('noindex');
  });

  it('each page is judged on its own count: 3 in Accra, but only 2 banking jobs in Accra', () => {
    const jobs = [...many(2, { title: 'Bank Teller', category: 'Banking' }), job({ title: 'Cleaner', category: 'Cleaning' })];
    const index = buildLandingIndex(jobs);

    expect(buildLandingPage('jobs-in-accra', index)!.indexable).toBe(true);
    expect(buildLandingPage('banking-jobs-in-accra', index)!.indexable).toBe(false);
    expect(buildLandingPage('banking-jobs', index)!.indexable).toBe(false);
    expect(landingSitemapPaths(index)).toContain('/jobs-in-accra');
    expect(landingSitemapPaths(index)).not.toContain('/banking-jobs-in-accra');
  });

  it('the sitemap lists exactly the published pages', () => {
    const jobs = [...many(3, { title: 'Bank Teller', category: 'Banking', location: 'Kumasi' }), ...many(2, { location: 'Tamale' })];
    const paths = landingSitemapPaths(buildLandingIndex(jobs));

    expect(paths).toContain('/jobs-in-kumasi');
    expect(paths).toContain('/banking-jobs');
    expect(paths).toContain('/banking-jobs-in-kumasi');
    expect(paths).toContain('/jobs-in-ashanti-region');
    expect(paths).toContain('/full-time-jobs-in-kumasi');
    expect(paths.some((path) => path.includes('tamale'))).toBe(false);
  });
});

describe('what is on each page', () => {
  const jobs = [
    ...many(4, { title: 'Bank Teller', category: 'Banking', location: 'Accra, Ghana', salaryMin: 1800 }),
    ...many(3, { title: 'Sales Executive', category: 'Sales', location: 'Kumasi', type: 'Part-time' }),
  ];
  const index = buildLandingIndex(jobs);

  it('has its own title, description, H1 and intro', () => {
    const slugs = ['jobs-in-accra', 'jobs-in-kumasi', 'banking-jobs', 'banking-jobs-in-accra', 'part-time-jobs', 'sales-jobs-in-kumasi'];
    const pages = slugs.map((slug) => buildLandingPage(slug, index)!);

    for (const key of ['title', 'description', 'h1', 'intro'] as const) {
      expect(new Set(pages.map((page) => page[key])).size, key).toBe(pages.length);
    }
  });

  it('reads naturally', () => {
    const page = buildLandingPage('banking-jobs-in-accra', index)!;

    expect(page.h1).toBe('Banking jobs in Accra');
    expect(page.title).toBe('Banking jobs in Accra - 4 vacancies today');
    expect(page.intro).toMatch(/There are 4 open banking jobs in Accra on JobWahala from \d employers?\./);
    expect(page.intro).toContain('Pay starts from GHS 1,800 a month');
    expect(page.description).toContain('4 open banking jobs in Accra');
    expect(page.description.length).toBeLessThanOrEqual(200);
    expect(buildLandingPage('part-time-jobs', index)!.h1).toBe('Part-time jobs');
    expect(buildLandingPage('internship-jobs', index)!.h1).toBe('Internships');
    expect(buildLandingPage('jobs-in-ashanti-region', index)!.h1).toBe('Jobs in Ashanti Region');
  });

  it('a city page mentions its main categories', () => {
    expect(buildLandingPage('jobs-in-accra', index)!.intro).toMatch(/Most are in .*Banking/);
  });

  it('says plainly when there is nothing yet', () => {
    const page = pageOf('jobs-in-ho', [])!;

    expect(page.intro).toMatch(/no open jobs in Ho/i);
    expect(page.title).toBe('Jobs in Ho');
  });

  it('a single job is not written as a plural', () => {
    const page = pageOf('jobs-in-ho', [job({ location: 'Ho' })])!;

    expect(page.intro).toMatch(/There is 1 open job matching jobs in Ho/);
  });

  it('lists only the matching jobs, newest first, at most 50', () => {
    const page = buildLandingPage('banking-jobs-in-accra', index)!;
    expect(page.jobs).toHaveLength(4);
    expect(page.jobs.every((item) => item.title === 'Bank Teller')).toBe(true);

    const lots = pageOf('jobs-in-accra', many(60))!;
    expect(lots.count).toBe(60);
    expect(lots.jobs).toHaveLength(50);
  });

  it('breadcrumbs lead back up', () => {
    expect(buildLandingPage('banking-jobs-in-accra', index)!.breadcrumbs.map((crumb) => crumb.path)).toEqual(['/', '/jobs', '/banking-jobs', '/banking-jobs-in-accra']);
    expect(buildLandingPage('jobs-in-accra', index)!.breadcrumbs.map((crumb) => crumb.path)).toEqual(['/', '/jobs', '/jobs-by-location', '/jobs-in-accra']);
  });
});

describe('links to related pages', () => {
  const jobs = [
    ...many(3, { title: 'Bank Teller', category: 'Banking', location: 'Accra' }),
    ...many(3, { title: 'Bank Teller', category: 'Banking', location: 'Kumasi' }),
    ...many(3, { title: 'Sales Executive', category: 'Sales', location: 'Accra' }),
  ];
  const index = buildLandingIndex(jobs);
  const paths = (slug: string) => buildLandingPage(slug, index)!.related.flatMap((group) => group.links.map((link) => link.path));

  it('a city page links to its categories and other cities', () => {
    const related = paths('jobs-in-accra');

    expect(related).toContain('/banking-jobs-in-accra');
    expect(related).toContain('/sales-jobs-in-accra');
    expect(related).toContain('/jobs-in-kumasi');
    expect(related).not.toContain('/jobs-in-accra');
  });

  it('a category page links to its cities and other categories', () => {
    const related = paths('banking-jobs');

    expect(related).toContain('/banking-jobs-in-accra');
    expect(related).toContain('/banking-jobs-in-kumasi');
    expect(related).toContain('/sales-jobs');
  });

  it('a combined page links to the broader pages and to its neighbours', () => {
    const related = paths('banking-jobs-in-accra');

    expect(related).toContain('/banking-jobs');
    expect(related).toContain('/jobs-in-accra');
    expect(related).toContain('/banking-jobs-in-kumasi');
    expect(related).toContain('/sales-jobs-in-accra');
  });

  it('only links to published pages, with their counts', () => {
    const thin = buildLandingIndex([...jobs, ...many(2, { title: 'Bank Teller', category: 'Banking', location: 'Tamale' })]);
    const links = buildLandingPage('banking-jobs', thin)!.related.flatMap((group) => group.links);

    expect(links.map((link) => link.path)).not.toContain('/banking-jobs-in-tamale');
    expect(links.find((link) => link.path === '/banking-jobs-in-accra')?.count).toBe(3);
  });

  it('no more than 8 in a group', () => {
    const places = ['Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Ho', 'Sunyani', 'Tema', 'Koforidua', 'Wa', 'Techiman'];
    const wide = buildLandingIndex(places.flatMap((place) => many(3, { location: place })));

    expect(buildLandingPage('customer-service-jobs', wide)!.related.every((group) => group.links.length <= 8)).toBe(true);
  });
});

describe('directory pages', () => {
  const jobs = [
    ...many(3, { title: 'Bank Teller', category: 'Banking', location: 'Accra' }),
    ...many(3, { title: 'Teacher', category: 'Education', location: 'Kumasi', type: 'Part-time' }),
    ...many(2, { location: 'Tamale' }),
  ];
  const index = buildLandingIndex(jobs);

  it('Jobs by location lists published regions and towns only', () => {
    const page = buildLandingPage('jobs-by-location', index)!;
    const all = page.related.flatMap((group) => group.links.map((link) => link.path));

    expect(page.h1).toBe('Jobs by location');
    expect(page.related.map((group) => group.title)).toEqual(['Regions', 'Cities and towns']);
    expect(all).toContain('/jobs-in-accra');
    expect(all).toContain('/jobs-in-kumasi');
    expect(all).toContain('/jobs-in-greater-accra-region');
    expect(all).not.toContain('/jobs-in-tamale');
    expect(page.indexable).toBe(true);
  });

  it('Jobs by category lists published categories and types of work', () => {
    const page = buildLandingPage('jobs-by-category', index)!;
    const all = page.related.flatMap((group) => group.links.map((link) => link.path));

    expect(all).toContain('/banking-jobs');
    expect(all).toContain('/education-jobs');
    expect(all).toContain('/part-time-jobs');
    expect(all).not.toContain('/sales-jobs');
  });

  it('an empty directory is noindex and not in the sitemap', () => {
    const page = buildLandingPage('jobs-by-location', buildLandingIndex([]))!;

    expect(page.indexable).toBe(false);
    expect(landingSitemapPaths(buildLandingIndex([]))).toEqual([]);
  });

  it('a directory with something to list is in the sitemap', () => {
    expect(landingSitemapPaths(index)).toEqual(expect.arrayContaining(['/jobs-by-location', '/jobs-by-category']));
  });
});

describe('the HTML for search engines', () => {
  const jobs = many(3, { title: 'Bank Teller <b>', category: 'Banking', location: 'Accra' });

  it('has the title, description, canonical address, H1, intro, jobs and related links', () => {
    const html = renderLandingPage(pageOf('banking-jobs-in-accra', jobs)!, 'https://jobwahala.com');

    expect(html).toContain('<title>Banking jobs in Accra - 3 vacancies today | JobWahala</title>');
    expect(html).toContain('<meta name="description" content="Apply for 3 open banking jobs in Accra');
    expect(html).toContain('<link rel="canonical" href="https://jobwahala.com/banking-jobs-in-accra">');
    expect(html).toContain('<h1>Banking jobs in Accra</h1>');
    expect(html).toContain('There are 3 open banking jobs in Accra');
    expect(html).toContain('href="https://jobwahala.com/jobs/job-');
    expect(html).toContain('href="https://jobwahala.com/banking-jobs"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"@type":"ItemList"');
  });

  it('escapes what employers typed', () => {
    const html = renderLandingPage(pageOf('banking-jobs-in-accra', jobs)!, 'https://jobwahala.com');

    expect(html).toContain('Bank Teller &lt;b&gt;');
    expect(html).not.toContain('Bank Teller <b>');
  });

  it('the not-found page is noindex', () => {
    expect(renderLandingNotFound('https://jobwahala.com')).toContain('noindex');
  });
});

describe('serving the pages', () => {
  const respond = () => {
    const state: { status: number; body: unknown; type?: string } = { status: 200, body: undefined };
    const res = {
      status(code: number) {
        state.status = code;
        return this;
      },
      type(value: string) {
        state.type = value;
        return this;
      },
      set() {
        return this;
      },
      send(value: unknown) {
        state.body = value;
        return this;
      },
      json(value: unknown) {
        state.body = value;
        return this;
      },
    } as unknown as Response;
    return { res, state };
  };
  const request = (slug: string) => ({ params: { slug }, get: () => undefined, protocol: 'https' }) as unknown as Request;

  const rows = (count: number, location: string) =>
    Array.from({ length: count }, (_, i) => ({
      id: `row-${location}-${i}`,
      title: 'Bank Teller',
      location,
      type: 'Full-time',
      category: 'Banking',
      salary: null,
      salaryMin: null,
      createdAt: new Date(),
      employer: { employerProfile: { companyName: 'Achiba Star Hotel' } },
    }));

  beforeEach(() => {
    resetLandingCache();
    prismaMock.job.findMany.mockReset();
    prismaMock.course.findMany.mockReset();
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.job.findMany.mockResolvedValue([...rows(3, 'Accra'), ...rows(2, 'Tamale')]);
  });

  it('asks only for open jobs', async () => {
    const { res } = respond();
    await getLandingSharePage(request('jobs-in-accra'), res);

    const where = prismaMock.job.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    expect(where.closesAt.gt).toBeInstanceOf(Date);
  });

  it('serves a published page without noindex, and a thin one with it', async () => {
    const published = respond();
    await getLandingSharePage(request('jobs-in-accra'), published.res);
    expect(published.state.status).toBe(200);
    expect(published.state.body).not.toContain('noindex');

    const thin = respond();
    await getLandingSharePage(request('jobs-in-tamale'), thin.res);
    expect(thin.state.status).toBe(200);
    expect(thin.state.body).toContain('<meta name="robots" content="noindex, follow">');
  });

  it('a page that does not exist is a real 404, for crawlers and for the app', async () => {
    const html = respond();
    await getLandingSharePage(request('jobs-in-narnia'), html.res);
    expect(html.state.status).toBe(404);
    expect(html.state.body).toContain('noindex');

    const json = respond();
    await getLandingJson(request('jobs-in-narnia'), json.res);
    expect(json.state.status).toBe(404);
  });

  it('gives the app the same page as data', async () => {
    const { res, state } = respond();
    await getLandingJson(request('banking-jobs-in-accra'), res);

    expect(state.body).toMatchObject({ success: true, page: { h1: 'Banking jobs in Accra', indexable: true, count: 3 } });
  });

  it('reads the jobs once for a burst of requests', async () => {
    await getLandingJson(request('jobs-in-accra'), respond().res);
    await getLandingJson(request('banking-jobs'), respond().res);

    expect(prismaMock.job.findMany).toHaveBeenCalledTimes(1);
  });

  it('puts the published pages in the sitemap and leaves the thin ones out', async () => {
    const { res, state } = respond();
    prismaMock.job.findMany.mockImplementation(async (args: { select?: { employerId?: boolean } }) =>
      args.select?.employerId ? [] : [...rows(3, 'Accra'), ...rows(2, 'Tamale')],
    );

    await getSitemap({ get: () => undefined, protocol: 'https', headers: {} } as unknown as Request, res);

    const xml = String(state.body);
    expect(xml).toContain('/jobs-in-accra</loc>');
    expect(xml).toContain('/banking-jobs-in-accra</loc>');
    expect(xml).toContain('/jobs-by-location</loc>');
    expect(xml).not.toContain('/jobs-in-tamale</loc>');
  });
});

describe('slugs', () => {
  it('make clean addresses', () => {
    expect(slugify('Cape Coast')).toBe('cape-coast');
    expect(slugify('  Sefwi Wiawso ')).toBe('sefwi-wiawso');
    expect(slugify('Greater Accra Region')).toBe('greater-accra-region');
  });
});
