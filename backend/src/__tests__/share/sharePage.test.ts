import { describe, expect, it } from 'vitest';
import { buildFreelancerShareMeta, escapeHtml, renderFreelancerSharePage } from '../../utils/sharePage';

const site = 'https://www.jobwahala.com';

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('buildFreelancerShareMeta', () => {
  it('builds a title and canonical URL from the profile', () => {
    const meta = buildFreelancerShareMeta(
      { id: 'abc', firstName: 'Ama', lastName: 'Mensah', tagline: 'Brand designer', bio: 'I design logos.' },
      site,
    );

    expect(meta.title).toBe('Ama Mensah — Brand designer');
    expect(meta.url).toBe('https://www.jobwahala.com/freelancers/abc');
    expect(meta.description).toBe('I design logos.');
    expect(meta.image).toBe('https://www.jobwahala.com/og-image.jpg');
  });

  it('falls back to skills and services when there is no name, tagline or bio', () => {
    const meta = buildFreelancerShareMeta(
      { id: 'abc', skills: 'Figma, adobe, Canva', serviceTitles: ['Ghost Writer'] },
      site,
    );

    expect(meta.title).toBe('A JobWahala freelancer — Figma · adobe');
    expect(meta.description).toContain('Skills: Figma, adobe, Canva.');
    expect(meta.description).toContain('Offers: Ghost Writer.');
    expect(meta.description).not.toMatch(/escrow/i);
  });

  it('keeps the description short enough for link previews', () => {
    const meta = buildFreelancerShareMeta({ id: 'abc', bio: 'word '.repeat(200) }, site);

    expect(meta.description.length).toBeLessThanOrEqual(200);
    expect(meta.description.endsWith('…')).toBe(true);
  });
});

describe('renderFreelancerSharePage', () => {
  it('emits OpenGraph and Twitter tags', () => {
    const html = renderFreelancerSharePage({ id: 'abc', firstName: 'Ama', tagline: 'Designer' }, site);

    expect(html).toContain('<meta property="og:title" content="Ama — Designer">');
    expect(html).toContain('<meta property="og:url" content="https://www.jobwahala.com/freelancers/abc">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('application/ld+json');
  });

  it('cannot be used for HTML or script injection through profile fields', () => {
    const html = renderFreelancerSharePage(
      {
        id: 'abc',
        firstName: '"><script>alert(1)</script>',
        bio: '</script><img src=x onerror=alert(2)>',
        tagline: '<b>x</b>',
      },
      site,
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('</script><img');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
