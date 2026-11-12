import { employmentTypeFor } from './earlyCareer';
import { escapeHtml } from './sharePage';
import { socialLinks, organizationJsonLd } from '../content/organization';
import { CATEGORIES, slugify } from './landingPages';

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
  /** Pay in Ghana cedis a month, when the employer gave numbers. */
  salaryMin?: number | null;
  salaryMax?: number | null;
  createdAt: Date;
  /** Last day to apply; becomes validThrough in the JobPosting data. */
  closesAt?: Date;
  /** FULL_TIME or PART_TIME, set on early-career roles. */
  schedule?: string | null;
  durationMonths?: number | null;
  unpaid?: boolean;
  employerName: string;
  employerLogoUrl?: string | null;
  employerWebsite?: string | null;
  /** An admin posted this for the company (it sent the vacancy by WhatsApp). Shown to people and crawlers. */
  postedOnBehalf?: boolean;
  /** How to apply outside JobWahala (WhatsApp, email). When set, people are told to apply that way. */
  applyInstructions?: string | null;
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

const COUNTRY_CODES: Record<string, string> = { Ghana: 'GH', Nigeria: 'NG', Kenya: 'KE', 'South Africa': 'ZA', Rwanda: 'RW', Senegal: 'SN', Tanzania: 'TZ', Uganda: 'UG', Ethiopia: 'ET', Egypt: 'EG', Cameroon: 'CM', Zambia: 'ZM', Zimbabwe: 'ZW', Botswana: 'BW', Namibia: 'NA', Morocco: 'MA', Tunisia: 'TN', "Côte d'Ivoire": 'CI' };
/** Google wants the two-letter country code; JobWahala is Ghana first, so an unnamed country is Ghana. */
export const countryCode = (country: string | null) => (country ? COUNTRY_CODES[country] ?? 'GH' : 'GH');

export const isRemoteLocation = (location?: string | null) => /remote/i.test(location ?? '');

export const mapEmploymentType = (type: string, schedule?: string | null) => {
  // Internships, attachments and National Service have their own values; the rest are the usual ones.
  const early = employmentTypeFor(type, schedule);
  if (early !== 'OTHER') return early;

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
    identifier: { '@type': 'PropertyValue', name: job.employerName, value: job.id },
    // Applying happens on JobWahala unless the employer asked people to apply by WhatsApp or email.
    directApply: !job.applyInstructions,
    description: paragraphs(job.description) || `<p>${e(job.title)}</p>`,
    datePosted: job.createdAt.toISOString(),
    ...(job.closesAt ? { validThrough: job.closesAt.toISOString() } : {}),
    // Google can show the pay in search results when it is given as numbers.
    ...(job.salaryMin != null || job.salaryMax != null
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: 'GHS',
            value: {
              '@type': 'QuantitativeValue',
              ...(job.salaryMin != null ? { minValue: job.salaryMin } : {}),
              ...(job.salaryMax != null ? { maxValue: job.salaryMax } : job.salaryMin != null ? { maxValue: job.salaryMin } : {}),
              unitText: 'MONTH',
            },
          },
        }
      : {}),
    employmentType: mapEmploymentType(job.type, job.schedule),
    url: `${siteUrl}/jobs/${job.id}`,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.employerName,
      ...(job.employerWebsite ? { sameAs: job.employerWebsite } : {}),
      ...(job.employerLogoUrl ? { logo: job.employerLogoUrl } : {}),
    },
    ...(job.location && !remote
      ? {
          jobLocation: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressLocality: job.location.split(/[/,]/)[0].trim(),
              ...(job.location.split(/[/,]/)[1]?.trim() && !detectCountry(job.location.split(/[/,]/)[1]) ? { addressRegion: job.location.split(/[/,]/)[1].trim() } : {}),
              addressCountry: countryCode(country),
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
  /** Tells search engines to leave the page out of their results. */
  noindex?: boolean;
  /** The preview picture. Defaults to the JobWahala card (1200x630). */
  image?: { url: string; alt?: string; width?: number; height?: number };
  body: string;
};

const SOCIAL_LABELS: Record<string, string> = { whatsapp: 'WhatsApp channel', linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', x: 'X' };

/** The links every public page ends with: About, Privacy, Terms, Contact and our social pages. */
export const renderFooter = (siteUrl: string) => {
  const social = socialLinks()
    .map((link) => '<a href="' + e(link.url) + '" rel="noopener me">' + e(SOCIAL_LABELS[link.key] ?? link.key) + '</a>')
    .join(' · ');
  return `<footer>
<nav aria-label="Footer"><a href="${e(siteUrl)}/about">About</a> · <a href="${e(siteUrl)}/privacy">Privacy</a> · <a href="${e(siteUrl)}/terms">Terms</a> · <a href="${e(siteUrl)}/support">Contact</a> · <a href="${e(siteUrl)}/blog">Blog</a> · <a href="${e(siteUrl)}/jobs-by-location">Jobs by location</a> · <a href="${e(siteUrl)}/jobs-by-category">Jobs by category</a></nav>
<p>Follow JobWahala: ${social}</p>
<p>&copy; JobWahala. Real jobs from employers you can check.</p>
</footer>`;
};

/** A BreadcrumbList for the search-engine data: each crumb has a label and a path on this site. */
export const breadcrumbJsonLd = (siteUrl: string, crumbs: { label: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.label, item: siteUrl + crumb.path })),
});

export const renderShell = ({ title, description, url, siteUrl, ogType = 'website', jsonLd, noindex = false, image, body }: PageShell) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>${e(title)} | JobWahala</title>
<meta name="description" content="${e(description)}">
${noindex ? '<meta name="robots" content="noindex, follow">\n' : ''}<link rel="canonical" href="${e(url)}">
<meta property="og:site_name" content="JobWahala">
<meta property="og:type" content="${e(ogType)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(url)}">
<meta property="og:image" content="${e(image?.url ?? `${siteUrl}/og-image.jpg`)}">
${image ? `<meta property="og:image:alt" content="${e(image.alt ?? title)}">\n` : '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'}${image?.width && image?.height ? `<meta property="og:image:width" content="${image.width}">\n<meta property="og:image:height" content="${image.height}">\n` : ''}<meta property="og:locale" content="en_GH">
<meta name="twitter:card" content="${image ? 'summary' : 'summary_large_image'}">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(description)}">
<meta name="twitter:image" content="${e(image?.url ?? `${siteUrl}/og-image.jpg`)}">
${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : ''}
</head>
<body>
<header><nav aria-label="Main"><a href="${e(siteUrl)}/">JobWahala</a> · <a href="${e(siteUrl)}/jobs">Jobs</a> · <a href="${e(siteUrl)}/internships">Internships &amp; NSS</a> · <a href="${e(siteUrl)}/courses">Courses</a> · <a href="${e(siteUrl)}/blog">Blog</a> · <a href="${e(siteUrl)}/hiring-service">Hiring Service</a> · <a href="${e(siteUrl)}/support">Help</a></nav></header>
<main>
${body}
</main>
${renderFooter(siteUrl)}
</body>
</html>`;

/**
 * The picture shown when a job link is shared: the company's own logo when it has one WhatsApp and other
 * apps can show (a normal picture, not an SVG), otherwise the JobWahala card.
 */
export const jobPreviewImage = (job: Pick<SeoJob, 'employerLogoUrl' | 'employerName'>) => {
  const logo = job.employerLogoUrl ?? '';
  if (!/^https?:\/\//i.test(logo) || /\.svg(\?|$)/i.test(logo)) return undefined;
  return { url: logo, alt: `${job.employerName} logo` };
};

/** A job that existed but has closed, expired or been removed: says so, points to similar open jobs, and stays out of search results. */
export const renderClosedJobPage = ({ title, similar, siteUrl, id }: { title: string | null; similar: SeoJob[]; siteUrl: string; id: string }) => {
  const items = similar
    .map((job) => {
      const facts = [job.type, job.location].filter(Boolean).join(' · ');
      return `<li><a href="${e(`${siteUrl}/jobs/${job.id}`)}">${e(job.title)}</a> - ${e(job.employerName)}${facts ? ` (${e(facts)})` : ''}</li>`;
    })
    .join('\n');

  return renderShell({
    title: 'This job has closed',
    description: 'This job is no longer open. See similar open jobs on JobWahala.',
    url: `${siteUrl}/jobs/${id}`,
    siteUrl,
    noindex: true,
    body: `<h1>This job has closed</h1>
<p>${title ? `"${e(title)}" is` : 'This job is'} no longer accepting applications.</p>
${similar.length ? `<h2>Similar open jobs</h2>\n<ul>\n${items}\n</ul>` : ''}
<p><a href="${e(siteUrl)}/jobs">See every open job</a></p>`,
  });
};

export const renderJobPage = (job: SeoJob, siteUrl: string) => {
  const url = `${siteUrl}/jobs/${job.id}`;
  const city = isRemoteLocation(job.location) ? '' : (job.location ?? '').split(/[/,]/)[0].trim();
  const facts =[job.type, job.location, job.salary].filter(Boolean).join(' · ');
  // What shows under the title when the link is shared: the facts people look for first, then the start of the ad.
  const pay = job.unpaid ? 'Unpaid' : job.salary;
  const description = clip(
    `${[job.location, pay, job.type].filter(Boolean).join(' · ')}${facts ? '. ' : ''}${job.description}`,
    200,
  );

  return renderShell({
    title: `${job.title} at ${job.employerName}${city ? ` – ${city}` : ''}`,
    description,
    url,
    siteUrl,
    ogType: 'article',
    image: jobPreviewImage(job),
    jsonLd: [
      buildJobPostingJsonLd(job, siteUrl),
      breadcrumbJsonLd(siteUrl, [
        { label: 'Home', path: '/' },
        { label: 'Jobs', path: '/jobs' },
        { label: job.title, path: `/jobs/${job.id}` },
      ]),
    ],
    body: `<nav aria-label="Breadcrumb"><a href="${e(siteUrl)}/">Home</a> &gt; <a href="${e(siteUrl)}/jobs">Jobs</a> &gt; ${e(job.title)}</nav>
${/^https?:\/\//i.test(job.employerLogoUrl ?? '') ? `<img src="${e(job.employerLogoUrl ?? '')}" alt="${e(job.employerName)} logo" width="64" height="64" loading="lazy">
` : ''}<h1>${e(job.title)}</h1>
<p>${e(job.employerName)}${facts ? ` · ${e(facts)}` : ''}</p>
${job.postedOnBehalf ? `<p>Posted by JobWahala on behalf of ${e(job.employerName)}.</p>
` : ''}${job.closesAt ? `<p>Apply by ${e(job.closesAt.toISOString().slice(0, 10))}.</p>
` : ''}<h2>About this job</h2>
${paragraphs(job.description)}
${job.applyInstructions ? `<h2>How to apply</h2>
${paragraphs(job.applyInstructions)}` : `<p><a href="${e(url)}">Apply for this job on JobWahala</a></p>`}
<p>More: <a href="${e(siteUrl)}/jobs">all open jobs</a>${city ? ` · <a href="${e(siteUrl)}/jobs-in-${e(slugify(city))}">jobs in ${e(city)}</a>` : ''}</p>`,
  });
};

export type SeoCompany = {
  id: string;
  name: string;
  industry?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  isVerified: boolean;
  isFoundingEmployer?: boolean;
  jobs: { id: string; title: string; location?: string | null; type?: string | null }[];
};

export const renderCompanyPage = (company: SeoCompany, siteUrl: string) => {
  const url = `${siteUrl}/companies/${company.id}`;
  const open = company.jobs.length;
  const description = clip(
    company.description?.trim() ||
      `${company.name}${company.industry ? ` (${company.industry})` : ''} is hiring on JobWahala${open ? ` with ${open} open ${open === 1 ? 'role' : 'roles'}` : ''}.`,
    200,
  );
  const logo = jobPreviewImage({ employerLogoUrl: company.logoUrl ?? null, employerName: company.name });
  const items = company.jobs
    .map((job) => `<li><a href="${e(`${siteUrl}/jobs/${job.id}`)}">${e(job.title)}</a>${[job.type, job.location].filter(Boolean).length ? ` (${e([job.type, job.location].filter(Boolean).join(' · '))})` : ''}</li>`)
    .join('\n');

  return renderShell({
    title: `${company.name} Jobs & Company Profile`,
    description,
    url,
    siteUrl,
    image: logo,
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'Organization', name: company.name, url, ...(company.logoUrl ? { logo: company.logoUrl } : {}), ...(company.description ? { description: clip(company.description, 300) } : {}) },
      breadcrumbJsonLd(siteUrl, [
        { label: 'Home', path: '/' },
        { label: 'Jobs', path: '/jobs' },
        { label: company.name, path: `/companies/${company.id}` },
      ]),
    ],
    body: `<h1>${e(company.name)}</h1>
<p>${company.isVerified ? 'Verified business' : 'Unverified employer'}${company.isFoundingEmployer ? ' · Founding Employer' : ''}${company.industry ? ` · ${e(company.industry)}` : ''}</p>
${company.description ? paragraphs(company.description) : ''}
<h2>Open roles (${open})</h2>
${open ? `<ul>\n${items}\n</ul>` : '<p>No open roles right now.</p>'}`,
  });
};

export type JobListPageInput = {
  heading: string;
  description: string;
  intro: string;
  path: string;
  jobs: SeoJob[];
  siteUrl: string;
  /** Extra structured data for this page, for example the Organization on the home page. */
  extraJsonLd?: unknown[];
  /** The page title when it should differ from the heading. */
  title?: string;
  /** Add the "Browse by location / category / Internships" sections, so the page is more than a short list when few jobs are open. */
  browse?: boolean;
};

const HOME_CITIES = ['Accra', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast', 'Ho', 'Koforidua', 'Sunyani'];
const HOME_CATEGORIES = ['banking', 'accounting', 'sales', 'marketing', 'customer-service', 'technology', 'education', 'healthcare', 'hospitality', 'logistics', 'engineering', 'administration'];

const jobItems = (jobs: SeoJob[], siteUrl: string) =>
  jobs
    .map((job) => {
      const facts = [job.type, job.location, job.category].filter(Boolean).join(' · ');
      return `<li><a href="${e(`${siteUrl}/jobs/${job.id}`)}">${e(job.title)}</a> - ${e(job.employerName)}${facts ? ` (${e(facts)})` : ''}</li>`;
    })
    .join('\n');

/** Links to places, categories and early-career pages, so a list page with few jobs still leads somewhere. */
export const browseSections = (siteUrl: string) => {
  const places = [...HOME_CITIES.map((name) => ({ label: `Jobs in ${name}`, path: `/jobs-in-${slugify(name)}` })), { label: 'Remote jobs', path: '/remote-jobs' }, { label: 'All locations', path: '/jobs-by-location' }];
  const categories = [...CATEGORIES.filter((entry) => HOME_CATEGORIES.includes(entry.slug)).map((entry) => ({ label: `${entry.name} jobs`, path: `/${entry.slug}-jobs` })), { label: 'All categories', path: '/jobs-by-category' }];
  const early = [{ label: 'Internships, NSS and graduate jobs', path: '/internships' }, { label: 'Internships', path: '/internship-jobs' }, { label: 'National Service (NSS)', path: '/nss-jobs' }, { label: 'Industrial attachments', path: '/attachment-jobs' }];
  const list = (links: { label: string; path: string }[]) =>
    '<ul>\n' + links.map((link) => `<li><a href="${e(siteUrl + link.path)}">${e(link.label)}</a></li>`).join('\n') + '\n</ul>';
  return `
<h2>Browse by location</h2>
${list(places)}
<h2>Browse by category</h2>
${list(categories)}
<h2>Internships &amp; NSS</h2>
${list(early)}`;
};

/** The home page: the same sections people see, as plain HTML with real links to jobs, places, categories and employers. */
export const renderHomePage = ({ jobs, siteUrl, intro, description }: { jobs: SeoJob[]; siteUrl: string; intro: string; description: string }) => {
  const latest = jobs.slice(0, 15);
  const city = (name: string) => `<li><a href="${e(`${siteUrl}/jobs-in-${slugify(name)}`)}">Jobs in ${e(name)}</a></li>`;
  const categories = CATEGORIES.filter((entry) => HOME_CATEGORIES.includes(entry.slug))
    .map((entry) => `<li><a href="${e(`${siteUrl}/${entry.slug}-jobs`)}">${e(entry.name)} jobs</a></li>`)
    .join('\n');

  return renderShell({
    title: 'Real jobs from employers you can check, across Africa',
    description,
    url: `${siteUrl}/`,
    siteUrl,
    jsonLd: [
      organizationJsonLd(siteUrl),
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'JobWahala',
        url: `${siteUrl}/`,
        potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/jobs?search={search_term_string}` }, 'query-input': 'required name=search_term_string' },
      },
      ...(latest.length
        ? [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: latest.map((job, index) => ({ '@type': 'ListItem', position: index + 1, url: `${siteUrl}/jobs/${job.id}`, name: job.title })) }]
        : []),
    ],
    body: `<h1>Work without the wahala</h1>
<p>${e(intro)} JobWahala lists real jobs in Ghana and across Africa from employers you can check, with the pay and location shown before you apply. Employers can post jobs free and review every applicant on one board.</p>
<h2>Latest jobs</h2>
${latest.length ? `<ul>\n${jobItems(latest, siteUrl)}\n</ul>` : '<p>No open jobs right now. Check back soon.</p>'}
<p><a href="${e(siteUrl)}/jobs">See every open job</a></p>
<h2>Browse jobs by location</h2>
<ul>
${HOME_CITIES.map(city).join('\n')}
<li><a href="${e(siteUrl)}/remote-jobs">Remote jobs</a></li>
<li><a href="${e(siteUrl)}/jobs-by-location">All locations</a></li>
</ul>
<h2>Browse by category</h2>
<ul>
${categories}
<li><a href="${e(siteUrl)}/jobs-by-category">All categories</a></li>
</ul>
<h2>Internships &amp; NSS</h2>
<p>Early-career roles for students, National Service personnel and graduates.</p>
<ul>
<li><a href="${e(siteUrl)}/internships">Internships, NSS and graduate jobs</a></li>
<li><a href="${e(siteUrl)}/internship-jobs">Internships</a></li>
<li><a href="${e(siteUrl)}/nss-jobs">National Service (NSS)</a></li>
<li><a href="${e(siteUrl)}/attachment-jobs">Industrial attachments</a></li>
</ul>
<h2>For employers</h2>
<p>Post a job free, get applications on one board, and let us recruit for you.</p>
<ul>
<li><a href="${e(siteUrl)}/signup">Post a job free</a></li>
<li><a href="${e(siteUrl)}/hiring-service">Hiring Service: we recruit for you</a></li>
<li><a href="${e(siteUrl)}/plans">Employer plans</a></li>
</ul>`,
  });
};

export const renderJobListPage = ({ heading, description, intro, path, jobs, siteUrl, extraJsonLd = [], title, browse = false }: JobListPageInput) => {
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
    title: title ?? heading,
    description,
    url: `${siteUrl}${path}`,
    siteUrl,
    jsonLd: extraJsonLd.length ? [...extraJsonLd, ...(jobs.length ? [itemList] : [])] : jobs.length ? itemList : undefined,
    body: `<h1>${e(heading)}</h1>
<p>${e(intro)}</p>
${jobs.length ? `<ul>\n${items}\n</ul>` : '<p>No open jobs right now. Check back soon.</p>'}
<p><a href="${e(siteUrl)}/jobs">See every open job</a></p>${browse ? browseSections(siteUrl) : ''}`,
  });
};
