import { escapeHtml } from './sharePage';

/**
 * Plain HTML pages for search-engine and link-preview crawlers. People get the React app; crawlers
 * that do not run JavaScript get these, with the same content: real titles, descriptions, job lists
 * and Google's JobPosting data.
 */

export type SeoJob = {
  id: string;
  title: string;
  description: string;
  location?: string | null;
  type: string;
  category?: string | null;
  salary?: string | null;
  createdAt: Date;
  employerName: string;
  employerLogoUrl?: string | null;
  employerWebsite?: string | null;
};

const e = escapeHtml;

const clip = (value: string, max: number) => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
};

const KNOWN_COUNTRIES = [
  'South Africa',
  'Ghana',
  'Nigeria',
  'Kenya',
  'Rwanda',
  'Senegal',
  'Tanzania',
  'Uganda',
  'Ethiopia',
  'Egypt',
  'Cameroon',
  'Zambia',
  'Zimbabwe',
  'Botswana',
  'Namibia',
  'Morocco',
  'Tunisia',
  "Côte d'Ivoire",
];

export const detectCountry = (location?: string | null) => {
  const text = (location ?? '').toLowerCase();
  return KNOWN_COUNTRIES.find((country) => text.includes(country.toLowerCase())) ?? null;
};

export const isRemoteLocation = (location?: string | null) => /remote/i.test(location ?? '');

export const mapEmploymentType = (type: string) => {
  switch (type.trim().toLowerCase()) {
    case 'full-time':
      return 'FULL_TIME';
    case 'part-time':
      return 'PART_TIME';
    case 'contract':
    case 'freelance':
      return 'CONTRACTOR';
    default:
      return 'OTHER';
  }
};

const paragraphs = (text: string) =>
  text
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${e(line)}</p>`)
    .join('');

export const buildJobPostingJsonLd = (job: SeoJob, siteUrl: string) => {
  const country = detectCountry(job.location);
  const remote = isRemoteLocation(job.location);

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: paragraphs(job.description) || `<p>${e(job.title)}</p>`,
    datePosted: job.createdAt.toISOString(),
    employmentType: mapEmploymentType(job.type),
    url: `${siteUrl}/jobs/${job.id}`,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.employerName,
      ...(job.employerWebsite ? { sameAs: job.employerWebsite } : {}),
      ...(job.employerLogoUrl ? { logo: job.employerLogoUrl } : {}),
    },
    ...(job.location
      ? {
          jobLocation: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressLocality: job.location.split(/[/,]/)[0].trim(),
              ...(country ? { addressCountry: country } : {}),
            },
          },
        }
      : {}),
    ...(remote ? { jobLocationType: 'TELECOMMUTE' } : {}),
    ...(remote && country ? { applicantLocationRequirements: { '@type': 'Country', name: country } } : {}),
  };
};

const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

type PageShell = {
  title: string;
  description: string;
  url: string;
  siteUrl: string;
  ogType?: string;
  jsonLd?: unknown;
  body: string;
};

const renderShell = ({ title, description, url, siteUrl, ogType = 'website', jsonLd, body }: PageShell) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${e(title)} | JobWahala</title>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${e(url)}">
<meta property="og:site_name" content="JobWahala">
<meta property="og:type" content="${e(ogType)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(url)}">
<meta property="og:image" content="${e(`${siteUrl}/og-image.jpg`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(description)}">
<meta name="twitter:image" content="${e(`${siteUrl}/og-image.jpg`)}">
${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : ''}
</head>
<body>
<header><a href="${e(siteUrl)}/">JobWahala</a> · <a href="${e(siteUrl)}/jobs">Jobs</a> · <a href="${e(siteUrl)}/blog">Guides</a> · <a href="${e(siteUrl)}/support">Help</a></header>
<main>
${body}
</main>
</body>
</html>`;

export const renderJobPage = (job: SeoJob, siteUrl: string) => {
  const url = `${siteUrl}/jobs/${job.id}`;
  const facts = [job.type, job.location, job.salary].filter(Boolean).join(' · ');
  const description = clip(
    `${job.title} at ${job.employerName}${job.location ? ` in ${job.location}` : ''}. ${job.description}`,
    200,
  );

  return renderShell({
    title: `${job.title} at ${job.employerName}`,
    description,
    url,
    siteUrl,
    ogType: 'article',
    jsonLd: buildJobPostingJsonLd(job, siteUrl),
    body: `<h1>${e(job.title)}</h1>
<p>${e(job.employerName)}${facts ? ` · ${e(facts)}` : ''}</p>
${paragraphs(job.description)}
<p><a href="${e(url)}">Apply for this job on JobWahala</a></p>`,
  });
};

export type JobListPageInput = {
  heading: string;
  description: string;
  intro: string;
  path: string;
  jobs: SeoJob[];
  siteUrl: string;
};

export const renderJobListPage = ({ heading, description, intro, path, jobs, siteUrl }: JobListPageInput) => {
  const items = jobs
    .map((job) => {
      const facts = [job.type, job.location, job.category].filter(Boolean).join(' · ');
      return `<li><a href="${e(`${siteUrl}/jobs/${job.id}`)}">${e(job.title)}</a> - ${e(job.employerName)}${facts ? ` (${e(facts)})` : ''}</li>`;
    })
    .join('\n');

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: jobs.map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteUrl}/jobs/${job.id}`,
      name: job.title,
    })),
  };

  return renderShell({
    title: heading,
    description,
    url: `${siteUrl}${path}`,
    siteUrl,
    jsonLd: jobs.length ? itemList : undefined,
    body: `<h1>${e(heading)}</h1>
<p>${e(intro)}</p>
${jobs.length ? `<ul>\n${items}\n</ul>` : '<p>No open jobs right now. Check back soon.</p>'}
<p><a href="${e(siteUrl)}/jobs">See every open job</a></p>`,
  });
};
