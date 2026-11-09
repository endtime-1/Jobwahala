import { describe, expect, it } from 'vitest';
import {
  buildJobPostingJsonLd,
  detectCountry,
  isRemoteLocation,
  mapEmploymentType,
  renderCompanyPage,
  renderJobListPage,
  renderJobPage,
  type SeoJob,
} from '../../utils/seoPages';

const job: SeoJob = {
  id: 'job-1',
  title: 'Customer Support Agent',
  description: 'Answer customer questions by phone.\nKind, patient people welcome.',
  location: 'Kumasi, Ghana / Onsite',
  type: 'Full-time',
  category: 'Customer Service',
  salary: 'GHS 2,800 - 3,500',
  createdAt: new Date('2026-11-01T09:00:00Z'),
  employerName: 'Sunrise Microfinance',
  employerLogoUrl: 'https://www.jobwahala.com/api/uploads/logo/x.png',
  employerWebsite: 'https://sunrise.example',
};

describe('helpers', () => {
  it('finds the country in a location', () => {
    expect(detectCountry('Kumasi, Ghana / Onsite')).toBe('Ghana');
    expect(detectCountry('Cape Town, South Africa')).toBe('South Africa');
    expect(detectCountry('Somewhere')).toBeNull();
    expect(detectCountry(null)).toBeNull();
  });

  it('spots remote work', () => {
    expect(isRemoteLocation('Remote, Africa')).toBe(true);
    expect(isRemoteLocation('Accra')).toBe(false);
  });

  it('maps job types to the ones search engines understand', () => {
    expect(mapEmploymentType('Full-time')).toBe('FULL_TIME');
    expect(mapEmploymentType('part-time')).toBe('PART_TIME');
    expect(mapEmploymentType('Contract')).toBe('CONTRACTOR');
    expect(mapEmploymentType('Freelance')).toBe('CONTRACTOR');
    expect(mapEmploymentType('Seasonal')).toBe('OTHER');
  });
});

describe('buildJobPostingJsonLd', () => {
  it('describes the job the way Google for Jobs expects', () => {
    const data = buildJobPostingJsonLd(job, 'https://www.jobwahala.com') as Record<string, any>;

    expect(data['@type']).toBe('JobPosting');
    expect(data.title).toBe('Customer Support Agent');
    expect(data.datePosted).toBe('2026-11-01T09:00:00.000Z');
    expect(data.employmentType).toBe('FULL_TIME');
    expect(data.hiringOrganization.name).toBe('Sunrise Microfinance');
    expect(data.jobLocation.address.addressLocality).toBe('Kumasi');
    expect(data.jobLocation.address.addressCountry).toBe('GH');
    expect(data.description).toContain('<p>Answer customer questions by phone.</p>');
  });

  it('marks remote jobs and does not invent pay figures', () => {
    const data = buildJobPostingJsonLd({ ...job, location: 'Remote, Kenya' }, 'https://x.test') as Record<string, any>;

    expect(data.jobLocationType).toBe('TELECOMMUTE');
    expect(data.applicantLocationRequirements.name).toBe('Kenya');
    expect(data.baseSalary).toBeUndefined();
  });
});

describe('renderJobPage', () => {
  it('has a real title, heading, canonical link and structured data', () => {
    const html = renderJobPage(job, 'https://www.jobwahala.com');

    expect(html).toContain('<title>Customer Support Agent at Sunrise Microfinance – Kumasi | JobWahala</title>');
    expect(html).toContain('<h1>Customer Support Agent</h1>');
    expect(html).toContain('<link rel="canonical" href="https://www.jobwahala.com/jobs/job-1">');
    expect(html).toContain('application/ld+json');
  });

  it('has a WhatsApp-ready preview: title, description with the key facts, canonical link and picture', () => {
    const html = renderJobPage({ ...job, location: 'Accra', salary: 'GHS 2,000 a month', type: 'Full-time' }, 'https://www.jobwahala.com');

    expect(html).toContain('<meta property="og:title" content="Customer Support Agent at Sunrise Microfinance – Accra">');
    expect(html).toMatch(/<meta property="og:description" content="Accra · GHS 2,000 a month · Full-time\. /);
    expect(html).toContain('<meta property="og:url" content="https://www.jobwahala.com/jobs/job-1">');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta property="og:site_name" content="JobWahala">');
  });

  it('uses the company logo as the picture when it has a normal one', () => {
    const html = renderJobPage(job, 'https://www.jobwahala.com');

    expect(html).toContain('<meta property="og:image" content="https://www.jobwahala.com/api/uploads/logo/x.png">');
    expect(html).toContain('<meta property="og:image:alt" content="Sunrise Microfinance logo">');
  });

  it('falls back to the JobWahala card when there is no logo, or the logo is an SVG that apps cannot show', () => {
    for (const employerLogoUrl of [null, undefined, '', 'https://www.jobwahala.com/api/uploads/logo/x.svg']) {
      const html = renderJobPage({ ...job, employerLogoUrl }, 'https://www.jobwahala.com');

      expect(html).toContain('<meta property="og:image" content="https://www.jobwahala.com/og-image.jpg">');
      expect(html).toContain('<meta property="og:image:width" content="1200">');
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    }
  });

  it('says "Unpaid" in the preview of an unpaid role', () => {
    const html = renderJobPage({ ...job, unpaid: true, salary: 'Unpaid', type: 'Internship', location: 'Accra' }, 'https://www.jobwahala.com');

    expect(html).toContain('Accra · Unpaid · Internship.');
  });

  it('escapes anything a poster typed', () => {
    const html = renderJobPage({ ...job, title: '<script>alert(1)</script>' }, 'https://x.test');

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/<\/script>[^<]*alert/);
  });
});

describe('renderJobListPage', () => {
  const page = {
    heading: 'Jobs in Ghana',
    description: 'Real jobs in Ghana.',
    intro: 'Browse real jobs in Ghana.',
    path: '/jobs-in/ghana',
    siteUrl: 'https://www.jobwahala.com',
  };

  it('links every job', () => {
    const html = renderJobListPage({ ...page, jobs: [job] });

    expect(html).toContain('<h1>Jobs in Ghana</h1>');
    expect(html).toContain('href="https://www.jobwahala.com/jobs/job-1"');
    expect(html).toContain('"@type":"ItemList"');
  });

  it('says so plainly when there are no jobs', () => {
    const html = renderJobListPage({ ...page, jobs: [] });

    expect(html).toContain('No open jobs right now');
    expect(html).not.toContain('ItemList');
  });
});

describe('JobPosting closing date', () => {
  it('tells Google when the job stops taking applications', () => {
    const data = buildJobPostingJsonLd({ ...job, closesAt: new Date('2026-12-01T23:59:59.999Z') }, 'https://www.jobwahala.com');

    expect(data.validThrough).toBe('2026-12-01T23:59:59.999Z');
  });

  it('leaves validThrough out when there is no closing date', () => {
    expect(buildJobPostingJsonLd(job, 'https://www.jobwahala.com')).not.toHaveProperty('validThrough');
  });
});

describe('renderCompanyPage', () => {
  const company = {
    id: 'emp-1',
    name: 'Akoko Solutions LTD',
    industry: 'Production',
    description: 'Poultry feed producer.',
    logoUrl: 'https://cdn.example.com/akoko.png',
    isVerified: false,
    jobs: [{ id: 'job-1', title: 'B2B SALES EXECUTIVE', location: 'Kumasi', type: 'Full-time' }],
  };

  it('gives crawlers the company name as the title, its open roles, and the right address', () => {
    const html = renderCompanyPage(company, 'https://www.jobwahala.com');

    expect(html).toContain('<title>Akoko Solutions LTD Jobs &amp; Company Profile | JobWahala</title>');
    expect(html).toContain('<link rel="canonical" href="https://www.jobwahala.com/companies/emp-1">');
    expect(html).toContain('Open roles (1)');
    expect(html).toContain('href="https://www.jobwahala.com/jobs/job-1"');
    expect(html).toContain('<meta property="og:image" content="https://cdn.example.com/akoko.png">');
  });

  it('says plainly whether the employer is verified, and never shows an unverified one as verified', () => {
    expect(renderCompanyPage(company, 'https://x.test')).toContain('Unverified employer');
    expect(renderCompanyPage({ ...company, isVerified: true }, 'https://x.test')).toContain('Verified business');
    expect(renderCompanyPage({ ...company, isVerified: false }, 'https://x.test')).not.toContain('Verified business');
  });

  it('copes with no description and no open roles, and escapes the company name', () => {
    const html = renderCompanyPage({ ...company, name: '<b>Bad</b> & Co', description: null, jobs: [] }, 'https://x.test');

    expect(html).toContain('&lt;b&gt;Bad&lt;/b&gt; &amp; Co');
    expect(html).not.toContain('<b>Bad</b>');
    expect(html).toContain('No open roles right now.');
    expect(html).toContain('is hiring on JobWahala');
  });
});
