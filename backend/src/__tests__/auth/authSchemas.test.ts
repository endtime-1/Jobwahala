import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../validation/authSchemas';

// ── registerSchema ────────────────────────────────────────────────────

describe('registerSchema', () => {
  it('accepts valid registration with email, password, and role', () => {
    const result = registerSchema.safeParse({
      body: { email: 'Test@Example.COM', password: 'securepass123', role: 'seeker' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.email).toBe('test@example.com'); // normalized
      expect(result.data.body.role).toBe('SEEKER'); // uppercased
    }
  });

  it('defaults role to SEEKER when omitted', () => {
    const result = registerSchema.safeParse({
      body: { email: 'user@test.com', password: 'password123' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.role).toBe('SEEKER');
    }
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      body: { email: 'user@test.com', password: 'short' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid emails', () => {
    const result = registerSchema.safeParse({
      body: { email: 'not-an-email', password: 'password123' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid roles', () => {
    const result = registerSchema.safeParse({
      body: { email: 'user@test.com', password: 'password123', role: 'ADMIN' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = registerSchema.safeParse({
      body: { email: 'user@test.com', password: 'password123', sneaky: true },
    });

    expect(result.success).toBe(false);
  });
});

// ── loginSchema ───────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('accepts valid login', () => {
    const result = loginSchema.safeParse({
      body: { email: 'User@Test.COM', password: 'mypassword' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.email).toBe('user@test.com');
    }
  });

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({
      body: { email: 'user@test.com' },
    });

    expect(result.success).toBe(false);
  });
});

// ── verifyEmailSchema ─────────────────────────────────────────────────

describe('verifyEmailSchema', () => {
  it('accepts a valid token', () => {
    const result = verifyEmailSchema.safeParse({
      body: { token: 'abc123xyz' },
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty token', () => {
    const result = verifyEmailSchema.safeParse({
      body: { token: '' },
    });

    expect(result.success).toBe(false);
  });
});

// ── resendVerificationSchema ──────────────────────────────────────────

describe('resendVerificationSchema', () => {
  it('accepts a valid email', () => {
    const result = resendVerificationSchema.safeParse({
      body: { email: 'USER@test.com' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.email).toBe('user@test.com');
    }
  });

  it('rejects invalid email', () => {
    const result = resendVerificationSchema.safeParse({
      body: { email: 'bad' },
    });

    expect(result.success).toBe(false);
  });
});

// ── forgotPasswordSchema ──────────────────────────────────────────────

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    const result = forgotPasswordSchema.safeParse({
      body: { email: 'user@example.com' },
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = forgotPasswordSchema.safeParse({ body: {} });

    expect(result.success).toBe(false);
  });
});

// ── resetPasswordSchema ───────────────────────────────────────────────

describe('resetPasswordSchema', () => {
  it('accepts valid token + password', () => {
    const result = resetPasswordSchema.safeParse({
      body: { token: 'reset-token-abc', password: 'newSecurePass123' },
    });

    expect(result.success).toBe(true);
  });

  it('rejects short passwords', () => {
    const result = resetPasswordSchema.safeParse({
      body: { token: 'reset-token-abc', password: 'short' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects missing token', () => {
    const result = resetPasswordSchema.safeParse({
      body: { password: 'validpassword123' },
    });

    expect(result.success).toBe(false);
  });
});
