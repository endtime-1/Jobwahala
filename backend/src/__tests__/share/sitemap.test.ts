import { describe, expect, it } from 'vitest';
import { buildSitemapXml, countryEntries, resolvePublicBaseUrl } from '../../utils/sitemap';

describe('buildSitemapXml', () => {
  it('lists each page with its full address, last change and priority', () => {
    const xml = buildSitemapXml('https://www.jobwahala.com', [
      { path: '/', changeFrequency: 'daily', priority: 1 },
      { path: '/jobs/abc', lastModified: new Date('2026-11-02T10:00:00Z'), priority: 0.7 },
    ]);

    expect(xml).toContain('<loc>https://www.jobwahala.com/</loc>');
    expect(xml).toContain('<loc>https://www.jobwahala.com/jobs/abc</loc>');
    expect(xml).toContain('<lastmod>2026-11-02</lastmod>');
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('escapes characters that would break the XML', () => {
    const xml = buildSitemapXml('https://x.test', [{ path: '/jobs?a=1&b=<2>' }]);

    expect(xml).toContain('/jobs?a=1&amp;b=&lt;2&gt;');
  });

  it('includes a page for each country', () => {
    expect(countryEntries().map((entry) => entry.path)).toContain('/jobs-in/south-africa');
  });
});

describe('resolvePublicBaseUrl', () => {
  it('prefers the configured site address', () => {
    expect(resolvePublicBaseUrl({ configured: 'https://www.jobwahala.com/', host: 'api.example.com' })).toBe(
      'https://www.jobwahala.com',
    );
  });

  it('falls back to the address the visitor used', () => {
    expect(resolvePublicBaseUrl({ protocol: 'https', host: 'www.jobwahala.com' })).toBe('https://www.jobwahala.com');
    expect(resolvePublicBaseUrl({ protocol: 'https, http', host: 'a.test' })).toBe('https://a.test');
  });

  it('uses https for real sites even when the hosting layer reports http', () => {
    expect(resolvePublicBaseUrl({ protocol: 'http', host: 'www.jobwahala.com' })).toBe('https://www.jobwahala.com');
  });

  it('keeps http for local development', () => {
    expect(resolvePublicBaseUrl({ protocol: 'http', host: 'localhost:5000' })).toBe('http://localhost:5000');
  });

  it('returns nothing rather than a broken address', () => {
    expect(resolvePublicBaseUrl({})).toBe('');
  });
});
