import { afterEach, describe, expect, it, vi } from 'vitest';
import { organizationJsonLd, whatsappChannelUrl, DEFAULT_WHATSAPP_CHANNEL_URL } from '../../content/organization';
import { renderJobListPage } from '../../utils/seoPages';

afterEach(() => vi.unstubAllEnvs());

describe('the Organization structured data', () => {
  it('lists the WhatsApp channel in sameAs, on the www address', () => {
    const data = organizationJsonLd('https://www.jobwahala.com');
    expect(data).toMatchObject({ '@type': 'Organization', name: 'JobWahala', url: 'https://www.jobwahala.com', sameAs: [DEFAULT_WHATSAPP_CHANNEL_URL] });
  });

  it('can be changed with WHATSAPP_CHANNEL_URL, and ignores a link that is not WhatsApp', () => {
    vi.stubEnv('WHATSAPP_CHANNEL_URL', 'https://whatsapp.com/channel/other999');
    expect(whatsappChannelUrl()).toBe('https://whatsapp.com/channel/other999');
    vi.stubEnv('WHATSAPP_CHANNEL_URL', 'https://evil.example.com/x');
    expect(whatsappChannelUrl()).toBe(DEFAULT_WHATSAPP_CHANNEL_URL);
  });

  it('is on the home page crawlers get, next to the job list', () => {
    const html = renderJobListPage({ heading: 'Home', description: 'd', intro: 'i', path: '/', jobs: [], siteUrl: 'https://www.jobwahala.com', extraJsonLd: [organizationJsonLd('https://www.jobwahala.com')] });
    expect(html).toContain('"sameAs":["https://whatsapp.com/channel/0029VbEH50105MUaVCzgge2Z"]');
  });
});
