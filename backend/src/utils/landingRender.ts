import { renderShell } from './seoPages';
import { escapeHtml as e } from './sharePage';
import type { LandingPage } from './landingPages';

/** The plain HTML version of a landing page, for search engines and link previews. */
export const renderLandingPage = (page: LandingPage, siteUrl: string) => {
  const jobs = page.jobs;

  const items = jobs
    .map((job) => {
      const facts = [job.type, job.location, job.salary].filter(Boolean).join(' · ');
      return `<li><a href="${e(`${siteUrl}/jobs/${job.id}`)}">${e(job.title)}</a> - ${e(job.employerName)}${facts ? ` (${e(facts)})` : ''}</li>`;
    })
    .join('\n');

  const related = page.related
    .map(
      (group) => `<section>
<h2>${e(group.title)}</h2>
<ul>
${group.links.map((link) => `<li><a href="${e(`${siteUrl}${link.path}`)}">${e(link.label)}</a> (${link.count})</li>`).join('\n')}
</ul>
</section>`,
    )
    .join('\n');

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: page.breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: `${siteUrl}${crumb.path}`,
    })),
  };

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: jobs.map((job, index) => ({ '@type': 'ListItem', position: index + 1, url: `${siteUrl}/jobs/${job.id}`, name: job.title })),
  };

  const crumbs = page.breadcrumbs.map((crumb) => `<a href="${e(`${siteUrl}${crumb.path}`)}">${e(crumb.label)}</a>`).join(' &gt; ');
  const list = page.kind === 'directory' ? '' : jobs.length ? `<ul>\n${items}\n</ul>` : '<p>No open jobs right now. Check back soon.</p>';

  return renderShell({
    title: page.title,
    description: page.description,
    url: `${siteUrl}${page.path}`,
    siteUrl,
    jsonLd: jobs.length ? [breadcrumbs, itemList] : [breadcrumbs],
    noindex: !page.indexable,
    body: `<nav aria-label="Breadcrumb">${crumbs}</nav>
<h1>${e(page.h1)}</h1>
<p>${e(page.intro)}</p>
${list}
${related}
<p><a href="${e(siteUrl)}/jobs">See every open job</a></p>`,
  });
};

/** A short "this page does not exist" page that search engines will not index. */
export const renderLandingNotFound = (siteUrl: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Page not found | JobWahala</title>
<meta name="robots" content="noindex"></head>
<body><p>We could not find that page. <a href="${e(siteUrl)}/jobs">See every open job</a>.</p></body></html>`;
