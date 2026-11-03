import { describe, expect, it } from 'vitest';
import { maskEmail, maskEmailsDeep } from '../../middleware/privacy';

describe('maskEmail', () => {
  it('keeps the first letter and the domain only', () => {
    expect(maskEmail('rich.x220@gmail.com')).toBe('r***@gmail.com');
  });

  it('never throws on odd input', () => {
    expect(maskEmail('')).toBe('***');
    expect(maskEmail('no-at-sign')).toBe('***');
  });
});

describe('maskEmailsDeep', () => {
  it('masks nested emails in lists, employers and reviewers', () => {
    const body = {
      success: true,
      jobs: [
        {
          id: 'j1',
          title: 'Receptionist',
          employer: { email: 'owner@hotel.com', employerProfile: { companyName: 'Hotel' } },
        },
      ],
      profile: { reviewsReceived: [{ reviewer: { email: 'client@corp.com' } }] },
    };

    const masked = JSON.stringify(maskEmailsDeep(body));

    expect(masked).not.toContain('owner@hotel.com');
    expect(masked).not.toContain('client@corp.com');
    expect(masked).toContain('o***@hotel.com');
    expect(masked).toContain('Receptionist');
    expect(masked).toContain('Hotel');
  });

  it('leaves dates, numbers, nulls and other fields untouched', () => {
    const when = new Date('2026-01-01T00:00:00Z');
    const masked = maskEmailsDeep({ createdAt: when, price: 100, note: null, emailVerified: true }) as Record<string, unknown>;

    expect(masked.createdAt).toBe(when);
    expect(masked.price).toBe(100);
    expect(masked.note).toBeNull();
    expect(masked.emailVerified).toBe(true);
  });

  it('does not mutate the original payload', () => {
    const body = { employer: { email: 'owner@hotel.com' } };
    maskEmailsDeep(body);

    expect(body.employer.email).toBe('owner@hotel.com');
  });
});
