import { describe, expect, it } from 'vitest';
import {
  approvedBusinessVerificationQuery,
  isVerifiedEmployer,
  publicEmployerVerification,
} from '../../utils/verification';

const request = (status: string, type = 'BUSINESS') => ({ status, type });

describe('isVerifiedEmployer', () => {
  it('is true only for an approved business request', () => {
    expect(isVerifiedEmployer([request('APPROVED')])).toBe(true);
  });

  it('is false while the request is pending', () => {
    expect(isVerifiedEmployer([request('PENDING')])).toBe(false);
  });

  it('is false when the request was rejected', () => {
    expect(isVerifiedEmployer([request('REJECTED')])).toBe(false);
  });

  it('is false when the reviewer asked for more information', () => {
    expect(isVerifiedEmployer([request('NEEDS_INFO')])).toBe(false);
  });

  it('is false with no request at all', () => {
    expect(isVerifiedEmployer([])).toBe(false);
    expect(isVerifiedEmployer(null)).toBe(false);
    expect(isVerifiedEmployer(undefined)).toBe(false);
  });

  it('keeps the badge when a newer request is pending or rejected', () => {
    expect(isVerifiedEmployer([request('PENDING'), request('APPROVED')])).toBe(true);
    expect(isVerifiedEmployer([request('REJECTED'), request('APPROVED')])).toBe(true);
  });

  it('does not count an approved identity or professional request', () => {
    expect(isVerifiedEmployer([request('APPROVED', 'IDENTITY')])).toBe(false);
    expect(isVerifiedEmployer([request('APPROVED', 'PROFESSIONAL')])).toBe(false);
  });
});

describe('publicEmployerVerification', () => {
  it('exposes only a yes/no and a status, never request details', () => {
    const full = { ...request('APPROVED'), details: 'secret', documentUrl: '/x.pdf' };
    const verified = publicEmployerVerification([full]);
    expect(verified).toEqual({ isVerified: true, verificationStatus: 'APPROVED' });

    for (const status of ['PENDING', 'REJECTED', 'NEEDS_INFO']) {
      expect(publicEmployerVerification([request(status)])).toEqual({
        isVerified: false,
        verificationStatus: 'UNVERIFIED',
      });
    }
    expect(publicEmployerVerification([])).toEqual({ isVerified: false, verificationStatus: 'UNVERIFIED' });
  });
});

describe('approvedBusinessVerificationQuery', () => {
  it('asks the database for approved business requests only', () => {
    expect(approvedBusinessVerificationQuery.where).toEqual({ status: 'APPROVED', type: 'BUSINESS' });
  });
});
