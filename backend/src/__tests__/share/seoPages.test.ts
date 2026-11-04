import { describe, expect, it } from 'vitest';
import {
  buildJobPostingJsonLd,
  detectCountry,
  isRemoteLocation,
  mapEmploymentType,
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
    expect(mapEmploymentType('Internship')).toBe('OTHER');
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
    expect(data.jobLocation.address.addressCountry).toBe('Ghana');
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

    expect(html).toContain('<title>Customer Support Agent at Sunrise Microfinance | JobWahala</title>');
    expect(html).toContain('<h1>Customer Support Agent</h1>');
    expect(html).toContain('<link rel="canonical" href="https://www.jobwahala.com/jobs/job-1">');
    expect(html).toContain('application/ld+json');
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
