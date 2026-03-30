import { describe, it, expect } from 'vitest';
import { scoreJobForSeeker, scoreApplicantForJob, scoreServiceForClient } from '../../utils/matching';

// ── scoreJobForSeeker ─────────────────────────────────────────────────

describe('scoreJobForSeeker', () => {
  it('returns a baseline score when profile is null', () => {
    const result = scoreJobForSeeker(null, {
      title: 'Frontend Developer',
      description: 'Build React apps',
      category: 'Engineering',
      type: 'Full-time',
      location: 'Remote',
    });

    expect(result.matchScore).toBeGreaterThanOrEqual(18);
    expect(result.matchScore).toBeLessThanOrEqual(98);
    expect(result.matchReasons).toContain('Add more profile detail to sharpen your recommendations');
  });

  it('scores higher when profile skills match the job', () => {
    const job = {
      title: 'React Developer',
      description: 'Build scalable web applications with React and TypeScript',
      category: 'Engineering',
      type: 'Full-time',
      location: 'Lagos, Nigeria',
    };

    const weakProfile = { skills: 'Python, Data Science', experience: 'ML engineer' };
    const strongProfile = { skills: 'React, TypeScript, Node.js', experience: 'Frontend developer building web applications' };

    const weakResult = scoreJobForSeeker(weakProfile, job);
    const strongResult = scoreJobForSeeker(strongProfile, job);

    expect(strongResult.matchScore).toBeGreaterThan(weakResult.matchScore);
  });

  it('gives a remote bonus for remote jobs', () => {
    const profile = { skills: 'React', experience: '' };
    const remoteJob = { title: 'Dev', description: 'Code', location: 'Remote' };
    const onsiteJob = { title: 'Dev', description: 'Code', location: 'Lagos' };

    const remoteScore = scoreJobForSeeker(profile, remoteJob);
    const onsiteScore = scoreJobForSeeker(profile, onsiteJob);

    expect(remoteScore.matchScore).toBeGreaterThanOrEqual(onsiteScore.matchScore);
  });

  it('always returns match reasons', () => {
    const result = scoreJobForSeeker(
      { skills: 'React, Node.js', experience: '5 years building SaaS products' },
      { title: 'Full Stack Developer', description: 'React and Node.js required', category: 'Engineering' },
    );

    expect(result.matchReasons.length).toBeGreaterThan(0);
    expect(result.matchReasons.length).toBeLessThanOrEqual(3);
  });
});

// ── scoreApplicantForJob ──────────────────────────────────────────────

describe('scoreApplicantForJob', () => {
  const testJob = {
    title: 'Backend Engineer',
    description: 'Build APIs with Node.js and PostgreSQL',
    category: 'Engineering',
    type: 'Full-time',
    location: 'Accra',
  };

  it('returns a baseline when profile is empty', () => {
    const result = scoreApplicantForJob(testJob, null, null);

    expect(result.fitScore).toBeGreaterThanOrEqual(22);
    expect(result.fitScore).toBeLessThanOrEqual(99);
  });

  it('scores higher when applicant skills align', () => {
    const weak = scoreApplicantForJob(testJob, { skills: 'React, CSS' }, null);
    const strong = scoreApplicantForJob(
      testJob,
      { skills: 'Node.js, PostgreSQL, API design', experience: 'Backend developer' },
      { coverLetter: 'I have extensive experience building APIs with Node.js and PostgreSQL' },
    );

    expect(strong.fitScore).toBeGreaterThan(weak.fitScore);
  });

  it('rewards cover letters that mirror job terms', () => {
    const profileOnly = scoreApplicantForJob(
      testJob,
      { skills: 'Node.js', experience: '' },
      null,
    );

    const withCoverLetter = scoreApplicantForJob(
      testJob,
      { skills: 'Node.js', experience: '' },
      { coverLetter: 'Expert in Node.js APIs and PostgreSQL databases for backend systems' },
    );

    expect(withCoverLetter.fitScore).toBeGreaterThanOrEqual(profileOnly.fitScore);
  });

  it('always clamps the score within bounds', () => {
    // Even a perfect candidate shouldn't exceed 99
    const result = scoreApplicantForJob(
      testJob,
      {
        skills: 'Node.js, PostgreSQL, API design, Backend, Express',
        experience: 'Built APIs with Node.js and PostgreSQL for 10 years',
      },
      { coverLetter: 'I am an expert backend engineer with Node.js and PostgreSQL experience building APIs for production systems' },
    );

    expect(result.fitScore).toBeLessThanOrEqual(99);
    expect(result.fitScore).toBeGreaterThanOrEqual(22);
  });
});

// ── scoreServiceForClient ─────────────────────────────────────────────

describe('scoreServiceForClient', () => {
  const testService = {
    title: 'Logo Design',
    description: 'Professional logo and brand identity design',
    category: 'Design',
    deliveryTime: '3 days',
  };

  it('returns a baseline when client signals are null', () => {
    const result = scoreServiceForClient(null, testService);

    expect(result.matchScore).toBeGreaterThanOrEqual(20);
    expect(result.matchScore).toBeLessThanOrEqual(97);
  });

  it('scores higher for matching client signals', () => {
    const unrelated = scoreServiceForClient(
      { skills: 'Node.js', experience: 'Backend developer', industry: null, description: null },
      testService,
    );

    const related = scoreServiceForClient(
      { skills: 'Logo, Branding', experience: null, industry: 'Design agency', description: 'We need brand identity design' },
      testService,
    );

    expect(related.matchScore).toBeGreaterThan(unrelated.matchScore);
  });

  it('always clamps within bounds', () => {
    const result = scoreServiceForClient(
      { skills: 'Logo, Brand, Design, Identity', experience: 'Professional design work', industry: 'Design', description: 'Logo and brand identity design agency' },
      testService,
    );

    expect(result.matchScore).toBeLessThanOrEqual(97);
    expect(result.matchScore).toBeGreaterThanOrEqual(20);
  });
});
