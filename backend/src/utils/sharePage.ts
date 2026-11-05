const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

const clip = (value: string, max: number) => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
};

export type FreelancerShareInput = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  tagline?: string | null;
  bio?: string | null;
  skills?: string | null;
  location?: string | null;
  serviceTitles?: string[];
};

export const buildFreelancerShareMeta = (input: FreelancerShareInput, siteUrl: string) => {
  const name = [input.firstName, input.lastName].filter(Boolean).join(' ').trim() || 'A JobWahala freelancer';
  const skills = (input.skills || '')
    .split(/[,;\n|]+/)
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 4);

  const headline = input.tagline?.trim() || skills.slice(0, 2).join(' · ') || 'Freelancer on JobWahala';
  const description = clip(
    input.bio?.trim() ||
      [
        skills.length ? `Skills: ${skills.join(', ')}.` : '',
        input.serviceTitles?.length ? `Offers: ${input.serviceTitles.slice(0, 3).join(', ')}.` : '',
        'Freelancer on JobWahala.',
      ]
        .filter(Boolean)
        .join(' '),
    200,
  );

  return {
    title: `${name} — ${headline}`,
    description,
    url: `${siteUrl}/freelancers/${input.id}`,
    image: `${siteUrl}/og-image.jpg`,
    name,
    location: input.location?.trim() || null,
  };
};

/** Minimal HTML for link-preview crawlers (WhatsApp, Facebook, X, LinkedIn, Telegram, Slack). */
export const renderFreelancerSharePage = (input: FreelancerShareInput, siteUrl: string) => {
  const meta = buildFreelancerShareMeta(input, siteUrl);
  const e = escapeHtml;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: meta.name,
    description: meta.description,
    url: meta.url,
    ...(meta.location ? { homeLocation: { '@type': 'Place', name: meta.location } } : {}),
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${e(meta.title)} | JobWahala</title>
<meta name="description" content="${e(meta.description)}">
<link rel="canonical" href="${e(meta.url)}">
<meta property="og:site_name" content="JobWahala">
<meta property="og:type" content="profile">
<meta property="og:title" content="${e(meta.title)}">
<meta property="og:description" content="${e(meta.description)}">
<meta property="og:url" content="${e(meta.url)}">
<meta property="og:image" content="${e(meta.image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(meta.title)}">
<meta name="twitter:description" content="${e(meta.description)}">
<meta name="twitter:image" content="${e(meta.image)}">
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>
<h1>${e(meta.name)}</h1>
<p>${e(meta.description)}</p>
<p><a href="${e(meta.url)}">View the profile on JobWahala</a></p>
</body>
</html>`;
};

export const renderSharePageNotFound = (siteUrl: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Profile not found | JobWahala</title>
<meta name="robots" content="noindex"></head>
<body><p>This profile is not available. <a href="${escapeHtml(siteUrl)}">Go to JobWahala</a></p></body></html>`;
