import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { organizationJsonLd, socialLinks, whatsappChannelUrl, DEFAULT_WHATSAPP_CHANNEL_URL, SOCIAL_NETWORKS } from '../../content/organization';
import { renderJobListPage } from '../../utils/seoPages';

afterEach(() => vi.unstubAllEnvs());

const DEFAULTS = [
  'https://whatsapp.com/channel/0029VbEH50105MUaVCzgge2Z',
  'https://www.linkedin.com/company/145436921',
  'https://www.facebook.com/profile.php?id=61576395645143',
];

describe('the Organization structured data', () => {
  it('lists WhatsApp, LinkedIn and Facebook in sameAs, on the www address; Instagram, TikTok and X stay out until set', () => {
    expect(organizationJsonLd('https://www.jobwahala.com')).toMatchObject({ '@type': 'Organization', name: 'JobWahala', url: 'https://www.jobwahala.com', sameAs: DEFAULTS });
  });

  it('shows a network as soon as its link is set, and ignores links that are not on that network', () => {
    vi.stubEnv('INSTAGRAM_URL', 'https://www.instagram.com/jobwahala');
    vi.stubEnv('TIKTOK_URL', 'https://evil.example.com/jobwahala');
    expect(socialLinks().map((link) => link.key)).toEqual(['whatsapp', 'linkedin', 'facebook', 'instagram']);
  });

  it('takes a shorter LinkedIn or Facebook address from the settings', () => {
    vi.stubEnv('LINKEDIN_URL', 'https://www.linkedin.com/company/jobwahala');
    vi.stubEnv('FACEBOOK_URL', 'https://www.facebook.com/jobwahala');
    expect(socialLinks().map((link) => link.url)).toEqual([DEFAULTS[0], 'https://www.linkedin.com/company/jobwahala', 'https://www.facebook.com/jobwahala']);
  });

  it('keeps the WhatsApp channel setting working, and ignores a link that is not WhatsApp', () => {
    vi.stubEnv('WHATSAPP_CHANNEL_URL', 'https://whatsapp.com/channel/other999');
    expect(whatsappChannelUrl()).toBe('https://whatsapp.com/channel/other999');
    vi.stubEnv('WHATSAPP_CHANNEL_URL', 'https://evil.example.com/x');
    expect(whatsappChannelUrl()).toBe(DEFAULT_WHATSAPP_CHANNEL_URL);
  });

  it('is on the home page crawlers get, next to the job list', () => {
    const html = renderJobListPage({ heading: 'Home', description: 'd', intro: 'i', path: '/', jobs: [], siteUrl: 'https://www.jobwahala.com', extraJsonLd: [organizationJsonLd('https://www.jobwahala.com')] });
    expect(html).toContain(`"sameAs":${JSON.stringify(DEFAULTS)}`);
  });

  it('lists the same networks and built-in links as the website (src/content/social.ts)', () => {
    const website = readFileSync(resolve(__dirname, '../../../../src/content/social.ts'), 'utf8');
    for (const network of SOCIAL_NETWORKS) {
      expect(website).toContain(`key: '${network.key}'`);
      expect(website).toContain(`defaultUrl: '${network.defaultUrl}'`);
      expect(website).toContain(`hosts: [${network.hosts.map((host) => `'${host}'`).join(', ')}]`);
    }
  });
});
