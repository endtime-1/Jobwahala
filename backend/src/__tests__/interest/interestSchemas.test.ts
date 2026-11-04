import { describe, expect, it } from 'vitest';
import { createInterestSignupSchema, normalizePhone } from '../../validation/interestSchemas';

const parse = (body: unknown) => createInterestSignupSchema.safeParse({ body });

describe('normalizePhone', () => {
  it('turns Ghana local numbers into international form', () => {
    expect(normalizePhone('024 123 4567')).toBe('+233241234567');
    expect(normalizePhone('0241234567')).toBe('+233241234567');
  });

  it('keeps international numbers and rejects junk', () => {
    expect(normalizePhone('+234 803 123 4567')).toBe('+2348031234567');
    expect(normalizePhone('00233241234567')).toBe('+233241234567');
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('call me')).toBeNull();
  });
});

describe('createInterestSignupSchema', () => {
  it('accepts an email or a phone, with a known source', () => {
    expect(parse({ email: 'ama@example.com', source: 'landing_freelance_gigs' }).success).toBe(true);
    expect(parse({ phone: '0241234567', source: 'landing_freelance_gigs' }).success).toBe(true);
  });

  it('needs at least one contact', () => {
    expect(parse({ source: 'landing_freelance_gigs' }).success).toBe(false);
    expect(parse({ email: '  ', phone: '', source: 'landing_freelance_gigs' }).success).toBe(false);
  });

  it('rejects bad emails, bad phones and unknown sources', () => {
    expect(parse({ email: 'nope', source: 'landing_freelance_gigs' }).success).toBe(false);
    expect(parse({ phone: '123', source: 'landing_freelance_gigs' }).success).toBe(false);
    expect(parse({ email: 'ama@example.com', source: 'made_up' }).success).toBe(false);
    expect(parse({ email: 'ama@example.com', source: 'landing_freelance_gigs', role: 'ADMIN' }).success).toBe(false);
  });
});
