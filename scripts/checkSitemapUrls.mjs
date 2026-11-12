// Fails (exit 1) if any URL listed in the sitemaps does not answer 200 for Googlebot.
// Usage: node scripts/checkSitemapUrls.mjs [https://www.jobwahala.com]
const raw = process.argv[2] || process.env.DEPLOY_URL || 'https://www.jobwahala.com';
const base = (raw.startsWith('http') ? raw : `https://${raw}`).replace(/\/$/, '');
const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' };

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&').trim());
const get = async (url) => fetch(url, { headers, redirect: 'manual' });

const indexRes = await get(`${base}/sitemap.xml`);
if (indexRes.status !== 200) throw new Error(`${base}/sitemap.xml answered ${indexRes.status}`);
const parts = locs(await indexRes.text());
if (!parts.length) throw new Error('The sitemap index lists no sitemaps');

const urls = new Set();
for (const part of parts) {
  const res = await get(part);
  if (res.status !== 200) throw new Error(`${part} answered ${res.status}`);
  locs(await res.text()).forEach((url) => urls.add(url));
}

const bad = [];
for (const url of urls) {
  const res = await get(url);
  if (res.status !== 200) bad.push(`${res.status} ${url}`);
}

if (bad.length) {
  console.error(`${bad.length} of ${urls.size} sitemap URLs are not 200:\n${bad.join('\n')}`);
  process.exit(1);
}
console.log(`OK: all ${urls.size} sitemap URLs answer 200`);
