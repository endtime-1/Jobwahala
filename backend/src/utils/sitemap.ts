export type SitemapEntry = {
  path: string;
  lastModified?: Date;
  changeFrequency?: 'daily' | 'weekly' | 'monthly';
  priority?: number;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Pages that are the same for everyone. Job and company pages are added from the database. */
export const staticSitemapPaths: SitemapEntry[] = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/jobs', changeFrequency: 'daily', priority: 0.9 },
  { path: '/internships', changeFrequency: 'daily', priority: 0.9 },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/terms', changeFrequency: 'monthly', priority: 0.2 },
  { path: '/privacy', changeFrequency: 'monthly', priority: 0.2 },
];

/** Only listed while the freelance screens are switched on; otherwise the address just redirects to the home page. */
export const freelanceSitemapPaths: SitemapEntry[] = [{ path: '/freelancers', changeFrequency: 'weekly', priority: 0.5 }];

export const sitemapCountries = [
  'ghana',
  'nigeria',
  'kenya',
  'south-africa',
  'rwanda',
  'senegal',
  'tanzania',
  'uganda',
  'ethiopia',
  'egypt',
];

export const countryEntries = (): SitemapEntry[] =>
  sitemapCountries.map((slug) => ({ path: `/jobs-in/${slug}`, changeFrequency: 'daily', priority: 0.8 }));

/**
 * The address the sitemap should use for links. An explicitly configured site address wins;
 * otherwise use the address the visitor reached us on, so a missing setting cannot produce
 * links to localhost.
 */
export const resolvePublicBaseUrl = ({
  configured,
  protocol,
  host,
}: {
  configured?: string;
  protocol?: string;
  host?: string;
}) => {
  const explicit = (configured ?? '').trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const cleanHost = (host ?? '').trim();
  if (!cleanHost) return '';

  // Hosting layers often hide the secure connection from us, so only local addresses stay on http.
  const isLocal = /^(localhost|127\.0\.0\.1)(:|$)/.test(cleanHost);
  const reported = (protocol ?? 'https').split(',')[0].trim() || 'https';
  return `${isLocal ? reported : 'https'}://${cleanHost}`;
};

export const buildSitemapXml = (baseUrl: string, entries: SitemapEntry[]) => {
  const items = entries
    .map((entry) => {
      const parts = [`    <loc>${escapeXml(`${baseUrl}${entry.path}`)}</loc>`];
      if (entry.lastModified) parts.push(`    <lastmod>${entry.lastModified.toISOString().slice(0, 10)}</lastmod>`);
      if (entry.changeFrequency) parts.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
      if (entry.priority !== undefined) parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
};
