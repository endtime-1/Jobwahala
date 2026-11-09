import { describe, expect, it } from 'vitest';
import { appShellTags, mergeIntoAppShell } from '../../utils/appShell';
import { breadcrumbJsonLd, buildJobPostingJsonLd, renderHomePage, renderJobPage, type SeoJob } from '../../utils/seoPages';
import { buildSitemapIndexXml } from '../../utils/sitemap';

const SHELL = `<!doctype html><html><head><meta charset="UTF-8" /><link rel="icon" href="/favicon.svg" />
<meta name="theme-color" content="#2f6df6" /><title>x</title>
<script type="module" crossorigin src="/assets/index-abc.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-def.js">
<link rel="stylesheet" crossorigin href="/assets/index-ghi.css">
</head><body><div id="root"></div></body></html>`;

const job: SeoJob = {
  id: 'job-1',
  title: 'Customer Support Agent',
  description: 'Answer customer questions.',
  location: 'Kumasi, Ashanti',
  type: 'Full-time',
  salaryMin: 2000,
  createdAt: new Date('2026-11-01T09:00:00Z'),
  closesAt: new Date('2026-12-01T09:00:00Z'),
  employerName: 'Sunrise Microfinance',
  employerWebsite: 'https://sunrise.example',
  employerLogoUrl: 'https://cdn.example/logo.png',
};

describe('merging a server-rendered page into the app shell', () => {
  it('takes the script, style and icon tags from the built app', () => {
    const tags = appShellTags(SHELL).join('\n');
    expect(tags).toContain('/assets/index-abc.js');
    expect(tags).toContain('/assets/vendor-def.js');
    expect(tags).toContain('/assets/index-ghi.css');
    expect(tags).toContain('theme-color');
  });

  it('keeps the page content, canonical and structured data and adds the app so people still get it', () => {
    const page = renderJobPage(job, 'https://www.jobwahala.com');
    const merged = mergeIntoAppShell(page, SHELL);

    expect(merged).toContain('<div id="root">');
    expect(merged).toContain('<script type="module" crossorigin src="/assets/index-abc.js"></script>');
    expect(merged).toContain('rel="canonical" href="https://www.jobwahala.com/jobs/job-1"');
    expect(merged).toContain('"@type":"JobPosting"');
    expect(merged).toContain('<h1>Customer Support Agent</h1>');
    expect(merged.indexOf('<div id="root">')).toBeLessThan(merged.indexOf('<h1>'));
    expect(merged.match(/<\/body>/g)).toHaveLength(1);
  });

  it('returns the page untouched when there is no usable shell', () => {
    const page = renderJobPage(job, 'https://www.jobwahala.com');
    expect(mergeIntoAppShell(page, null)).toBe(page);
    expect(mergeIntoAppShell(page, '<html><head></head></html>')).toBe(page);
  });

  it('does not wrap a page twice', () => {
    const once = mergeIntoAppShell(renderJobPage(job, 'https://www.jobwahala.com'), SHELL);
    expect(mergeIntoAppShell(once, SHELL)).toBe(once);
  });
});

describe('the job page for Google for Jobs', () => {
  const data = buildJobPostingJsonLd(job, 'https://www.jobwahala.com') as Record<string, any>;

  it('has every field Google asks for', () => {
    expect(data.directApply).toBe(true);
    expect(data.validThrough).toBe('2026-12-01T09:00:00.000Z');
    expect(data.hiringOrganization).toMatchObject({ name: 'Sunrise Microfinance', sameAs: 'https://sunrise.example', logo: 'https://cdn.example/logo.png' });
    expect(data.jobLocation.address).toMatchObject({ addressLocality: 'Kumasi', addressRegion: 'Ashanti', addressCountry: 'GH' });
    expect(data.baseSalary.currency).toBe('GHS');
    expect(data.identifier.value).toBe('job-1');
  });

  it('uses telecommute, with no street address, for remote jobs', () => {
    const remote = buildJobPostingJsonLd({ ...job, location: 'Remote, Ghana' }, 'https://x.test') as Record<string, any>;
    expect(remote.jobLocationType).toBe('TELECOMMUTE');
    expect(remote.jobLocation).toBeUndefined();
  });

  it('has a title like "Job at Company – City" and a breadcrumb trail', () => {
    const html = renderJobPage(job, 'https://www.jobwahala.com');
    expect(html).toContain('<title>Customer Support Agent at Sunrise Microfinance – Kumasi | JobWahala</title>');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('<a href="https://www.jobwahala.com/jobs-in-kumasi">jobs in Kumasi</a>');
  });

  it('builds a breadcrumb list', () => {
    const crumbs = breadcrumbJsonLd('https://s.test', [{ label: 'Home', path: '/' }, { label: 'Jobs', path: '/jobs' }]) as Record<string, any>;
    expect(crumbs.itemListElement[1]).toMatchObject({ position: 2, name: 'Jobs', item: 'https://s.test/jobs' });
  });
});

describe('the home page for crawlers', () => {
  const html = renderHomePage({
    jobs: [job, { ...job, id: 'job-2', title: 'Teller' }],
    siteUrl: 'https://www.jobwahala.com',
    intro: 'JobWahala is a job portal for Africa.',
    description: 'Find real jobs across Africa.',
  });

  it('has the heading, the sections and normal links to jobs, places, categories, employers and the footer pages', () => {
    expect(html).toContain('<h1>Work without the wahala</h1>');
    for (const heading of ['Latest jobs', 'Browse jobs by location', 'Browse by category', 'Internships &amp; NSS', 'For employers']) {
      expect(html).toContain(`<h2>${heading}</h2>`);
    }
    expect(html).toContain('<a href="https://www.jobwahala.com/jobs/job-1">Customer Support Agent</a>');
    for (const city of ['accra', 'kumasi', 'takoradi', 'tamale', 'cape-coast', 'ho', 'koforidua', 'sunyani']) {
      expect(html).toContain(`href="https://www.jobwahala.com/jobs-in-${city}"`);
    }
    expect(html).toContain('href="https://www.jobwahala.com/remote-jobs"');
    expect(html).toContain('href="https://www.jobwahala.com/banking-jobs"');
    expect(html).toContain('href="https://www.jobwahala.com/hiring-service"');
    for (const page of ['about', 'privacy', 'terms', 'support']) expect(html).toContain(`href="https://www.jobwahala.com/${page}"`);
    expect(html).toContain('linkedin.com');
  });

  it('has a canonical link, the Organization and a WebSite with a search action', () => {
    expect(html).toContain('<link rel="canonical" href="https://www.jobwahala.com/">');
    expect(html).toContain('"@type":"Organization"');
    expect(html).toContain('"@type":"WebSite"');
    expect(html).toContain('"@type":"SearchAction"');
  });
});

describe('the sitemap index', () => {
  it('lists each sitemap file with the date it changed', () => {
    const xml = buildSitemapIndexXml('https://www.jobwahala.com', [{ path: '/sitemap-jobs.xml', lastModified: new Date('2026-11-05T10:00:00Z') }]);
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain('<loc>https://www.jobwahala.com/sitemap-jobs.xml</loc>');
    expect(xml).toContain('<lastmod>2026-11-05</lastmod>');
  });
});
