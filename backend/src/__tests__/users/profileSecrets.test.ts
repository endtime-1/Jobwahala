import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));

import { getProfile } from '../../controllers/userController';

beforeEach(() => vi.clearAllMocks());

describe('the profile the browser receives', () => {
  it('never contains the password hash or the sign-in version number', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ama@example.com',
      phone: null,
      googleId: null,
      password: '$2b$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvabcdefghij',
      tokenVersion: 7,
      role: 'EMPLOYER',
      status: 'ACTIVE',
      emailVerified: true,
      jobSeekerProfile: null,
      employerProfile: { companyName: 'Acme Ltd' },
      freelancerProfile: null,
      verificationRequests: [],
    });
    const out: { body: any } = { body: null };
    const res = { json: (body: unknown) => ((out.body = body), res), status: () => res } as unknown as Response;

    await getProfile({ user: { id: 'u1', role: 'EMPLOYER' } } as never, res);

    expect(out.body.success).toBe(true);
    expect(out.body.profile).toMatchObject({ id: 'u1', email: 'ama@example.com', role: 'EMPLOYER' });
    expect(out.body.profile).not.toHaveProperty('password');
    expect(out.body.profile).not.toHaveProperty('tokenVersion');
    expect(JSON.stringify(out.body)).not.toContain('$2b$');
  });
});
