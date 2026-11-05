import { describe, expect, it } from 'vitest';
import { updateVerificationRequestStatusSchema } from '../../validation/adminSchemas';
import { createBusinessVerificationRequestSchema, confirmVerificationCodeSchema } from '../../validation/verificationSchemas';
import {
  OTP_LENGTH,
  generateOtp,
  hashOtp,
  isWellFormedOtp,
  otpMatches,
} from '../../utils/otp';
import {
  describeVerificationDecision,
  isPlausibleRegistrationNumber,
  normalizeRegistrationNumber,
  rankJobsByVerification,
  verificationDecisionProblem,
} from '../../utils/verification';

describe('one-time codes', () => {
  it('are six digits, zero padded', () => {
    for (let i = 0; i < 200; i += 1) expect(generateOtp()).toMatch(/^\d{6}$/);
    expect(OTP_LENGTH).toBe(6);
  });

  it('match only the right code, for the right request, with the right secret', () => {
    const hash = hashOtp('123456', 'req-1', 'secret');

    expect(otpMatches('123456', 'req-1', 'secret', hash)).toBe(true);
    expect(otpMatches(' 123456 ', 'req-1', 'secret', hash)).toBe(true);
    expect(otpMatches('654321', 'req-1', 'secret', hash)).toBe(false);
    expect(otpMatches('123456', 'req-2', 'secret', hash)).toBe(false);
    expect(otpMatches('123456', 'req-1', 'other-secret', hash)).toBe(false);
  });

  it('never store the code itself', () => {
    expect(hashOtp('123456', 'req-1', 'secret')).not.toContain('123456');
  });

  it('are checked for shape before anything else', () => {
    expect(isWellFormedOtp('123456')).toBe(true);
    for (const bad of ['12345', '1234567', 'abcdef', '', null, 123456]) expect(isWellFormedOtp(bad)).toBe(false);
  });
});

describe('registration numbers', () => {
  it('are tidied and compared in upper case', () => {
    expect(normalizeRegistrationNumber('  cs 123456789  ')).toBe('CS 123456789');
  });

  it('accept the usual Registrar-General shapes and reject junk', () => {
    for (const ok of ['CS123456789', 'BN-123456', 'CA/2020/0042', 'cs 1234']) expect(isPlausibleRegistrationNumber(ok)).toBe(true);
    for (const bad of ['', 'ab', '!!!', 'x'.repeat(60)]) expect(isPlausibleRegistrationNumber(bad)).toBe(false);
  });
});

describe('business verification request', () => {
  const valid = {
    registrationNumber: 'CS123456789',
    documentUrl: 'https://www.jobwahala.com/api/uploads/verification/cert.pdf',
    contactEmail: 'HR@Achiba.Example',
    address: '12 Ring Road, Accra, Ghana',
  };
  const parse = (body: unknown) => createBusinessVerificationRequestSchema.safeParse({ body });

  it('needs number, certificate, company email and address', () => {
    const result = parse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body.contactEmail).toBe('hr@achiba.example');

    for (const key of Object.keys(valid)) {
      const rest = { ...valid } as Record<string, string>;
      delete rest[key];
      expect(parse(rest).success).toBe(false);
    }
  });

  it('takes an optional phone, which must be a real number', () => {
    expect(parse({ ...valid, contactPhone: '024 123 4567' }).success).toBe(true);
    expect(parse({ ...valid, contactPhone: '' }).success).toBe(true);
    expect(parse({ ...valid, contactPhone: '123' }).success).toBe(false);
  });

  it('rejects a short address, a bad email and unknown fields', () => {
    expect(parse({ ...valid, address: 'Accra' }).success).toBe(false);
    expect(parse({ ...valid, contactEmail: 'not-an-email' }).success).toBe(false);
    expect(parse({ ...valid, role: 'ADMIN' }).success).toBe(false);
  });

  it('checks the confirmation code is six digits', () => {
    const check = (code: string) => confirmVerificationCodeSchema.safeParse({ params: { id: 'r1' }, body: { code } }).success;
    expect(check('123456')).toBe(true);
    expect(check('12345')).toBe(false);
    expect(check('abcdef')).toBe(false);
  });
});

describe('admin decisions', () => {
  const complete = {
    type: 'BUSINESS',
    registrationNumber: 'CS123456789',
    documentUrl: 'https://x/cert.pdf',
    address: '12 Ring Road, Accra',
    contactVerifiedAt: new Date(),
  };

  it('approves a complete business with a confirmed contact', () => {
    expect(verificationDecisionProblem(complete, 'APPROVED')).toBeNull();
  });

  it('will not approve until the contact is confirmed', () => {
    expect(verificationDecisionProblem({ ...complete, contactVerifiedAt: null }, 'APPROVED')).toMatch(/one-time code/);
  });

  it('will not approve when the registration number, certificate or address is missing', () => {
    expect(verificationDecisionProblem({ ...complete, registrationNumber: null }, 'APPROVED')).toMatch(/registration number/);
    expect(verificationDecisionProblem({ ...complete, documentUrl: null }, 'APPROVED')).toMatch(/certificate/);
    expect(verificationDecisionProblem({ ...complete, address: null }, 'APPROVED')).toMatch(/address/);
  });

  it('needs a reason to reject or to ask for more', () => {
    for (const status of ['REJECTED', 'NEEDS_INFO'] as const) {
      expect(verificationDecisionProblem(complete, status, '')).toMatch(/./);
      expect(verificationDecisionProblem(complete, status, '   ')).toMatch(/./);
      expect(verificationDecisionProblem(complete, status, 'abc')).toMatch(/./);
      expect(verificationDecisionProblem(complete, status, 'The certificate is unreadable')).toBeNull();
    }
  });

  it('can reject an incomplete request, as long as it says why', () => {
    expect(verificationDecisionProblem({ type: 'BUSINESS' }, 'REJECTED', 'No certificate supplied')).toBeNull();
  });

  it('does not hold other verification types to the business rules', () => {
    expect(verificationDecisionProblem({ type: 'IDENTITY' }, 'APPROVED')).toBeNull();
  });

  it('the admin API insists on a reason for both REJECTED and NEEDS_INFO', () => {
    const parse = (body: unknown) => updateVerificationRequestStatusSchema.safeParse({ body, params: { id: 'v1' } });
    expect(parse({ status: 'REJECTED' }).success).toBe(false);
    expect(parse({ status: 'NEEDS_INFO' }).success).toBe(false);
    expect(parse({ status: 'REJECTED', reviewNote: 'Certificate does not match the name' }).success).toBe(true);
    expect(parse({ status: 'APPROVED' }).success).toBe(true);
  });
});

describe('what the employer is told', () => {
  it('celebrates an approval', () => {
    const message = describeVerificationDecision('APPROVED', 'BUSINESS');
    expect(message.title).toMatch(/verified/i);
    expect(message.message).toMatch(/Verified employer/);
  });

  it('includes the reason when more information is needed', () => {
    const message = describeVerificationDecision('NEEDS_INFO', 'BUSINESS', 'Please upload a clearer certificate');
    expect(message.message).toContain('Please upload a clearer certificate');
  });

  it('includes the reason on a rejection and says they can try again', () => {
    const message = describeVerificationDecision('REJECTED', 'BUSINESS', 'The registration number could not be found');
    expect(message.message).toContain('The registration number could not be found');
    expect(message.message).toMatch(/new request/i);
  });
});

describe('ranking jobs', () => {
  const job = (id: string, isVerified: boolean, createdAt: string) => ({ id, createdAt: new Date(createdAt), employer: { isVerified } });

  it('puts verified employers first, then newest first', () => {
    const ranked = rankJobsByVerification([
      job('new-unverified', false, '2026-11-04'),
      job('old-verified', true, '2026-10-01'),
      job('new-verified', true, '2026-11-02'),
      job('old-unverified', false, '2026-09-01'),
    ]);

    expect(ranked.map((j) => j.id)).toEqual(['new-verified', 'old-verified', 'new-unverified', 'old-unverified']);
  });

  it('does not change the list it is given', () => {
    const input = [job('a', false, '2026-11-04'), job('b', true, '2026-11-01')];
    rankJobsByVerification(input);
    expect(input.map((j) => j.id)).toEqual(['a', 'b']);
  });
});
