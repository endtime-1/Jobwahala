import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const m = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const mock: Record<string, any> = {
    user: m('findUnique'),
    outreachContact: m('create', 'findMany', 'findUnique', 'update', 'deleteMany', 'groupBy'),
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});
vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));

import { adminCreateOutreach, adminDeleteOutreach, adminListOutreach, adminUpdateOutreach } from '../../controllers/acquisitionController';
import { createOutreachSchema, updateOutreachSchema } from '../../validation/acquisitionSchemas';
import { renderCompanyPage, renderJobPage, type SeoJob } from '../../utils/seoPages';

const respond = () => {
  const out: { status: number; body: any } = { status: 200, body: null };
  const res = {
    status(code: number) {
      out.status = code;
      return this;
    },
    json(body: unknown) {
      out.body = body;
      return this;
    },
  } as unknown as Response;
  return { res, out };
};
const req = (extra: Record<string, unknown>) => ({ user: { id: 'admin-1', role: 'ADMIN' }, params: {}, query: {}, body: {}, ...extra }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ id: 'admin-1', email: 'admin@jobwahala.com' });
});

describe('6. the outreach tracker', () => {
  it('saves a contact with business, contact, sector, location, status, notes and a follow-up date', async () => {
    prismaMock.outreachContact.create.mockImplementation(async ({ data }: any) => ({ id: 'o-1', ...data }));
    const { res, out } = respond();

    await adminCreateOutreach(
      req({ body: { businessName: ' Achiba Star Hotel ', contactName: 'Mr Mensah', contactPhone: '0241234567', contactEmail: '', sector: 'Hospitality', location: 'Kumasi', status: 'INTERESTED', notes: 'Wants to hire 3 cleaners', followUpAt: '2026-11-20' } }),
      res,
    );

    expect(out.status).toBe(201);
    const data = prismaMock.outreachContact.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ businessName: 'Achiba Star Hotel', contactName: 'Mr Mensah', sector: 'Hospitality', location: 'Kumasi', status: 'INTERESTED', notes: 'Wants to hire 3 cleaners', createdById: 'admin-1' });
    expect(data.contactEmail).toBeNull();
    expect(data.followUpAt).toEqual(new Date('2026-11-20'));
  });

  it('only accepts the four statuses, and starts as contacted', () => {
    expect(createOutreachSchema.safeParse({ body: { businessName: 'Akoko' } }).success).toBe(true);
    expect(createOutreachSchema.parse({ body: { businessName: 'Akoko' } }).body.status).toBe('CONTACTED');
    for (const status of ['CONTACTED', 'INTERESTED', 'POSTED', 'NOT_INTERESTED']) expect(createOutreachSchema.safeParse({ body: { businessName: 'Akoko', status } }).success).toBe(true);
    expect(createOutreachSchema.safeParse({ body: { businessName: 'Akoko', status: 'WON' } }).success).toBe(false);
    expect(createOutreachSchema.safeParse({ body: { businessName: 'Akoko', extra: 1 } }).success).toBe(false);
  });

  it('rejects a follow-up date that is not a date', async () => {
    const { res, out } = respond();
    await adminCreateOutreach(req({ body: { businessName: 'Akoko', status: 'CONTACTED', followUpAt: 'next week' } }), res);
    expect(out.status).toBe(400);
    expect(prismaMock.outreachContact.create).not.toHaveBeenCalled();
  });

  it('updates the status, and can clear a note and a follow-up date', async () => {
    prismaMock.outreachContact.findUnique.mockResolvedValue({ id: 'o-1' });
    prismaMock.outreachContact.update.mockImplementation(async ({ data }: any) => ({ id: 'o-1', ...data }));
    const { res, out } = respond();

    await adminUpdateOutreach(req({ params: { id: 'o-1' }, body: { status: 'POSTED', notes: '', followUpAt: null } }), res);

    expect(out.status).toBe(200);
    const data = prismaMock.outreachContact.update.mock.calls[0][0].data;
    expect(data.status).toBe('POSTED');
    expect(data.notes).toBeNull();
    expect(data.followUpAt).toBeNull();
    expect(data.contactName).toBeUndefined(); // not sent, so not changed
    expect(updateOutreachSchema.safeParse({ params: { id: 'o-1' }, body: { status: 'POSTED' } }).success).toBe(true);
  });

  it('answers 404 for a contact that does not exist', async () => {
    prismaMock.outreachContact.findUnique.mockResolvedValue(null);
    prismaMock.outreachContact.deleteMany.mockResolvedValue({ count: 0 });
    const one = respond();
    await adminUpdateOutreach(req({ params: { id: 'nope' }, body: { status: 'POSTED' } }), one.res);
    expect(one.out.status).toBe(404);
    const two = respond();
    await adminDeleteOutreach(req({ params: { id: 'nope' } }), two.res);
    expect(two.out.status).toBe(404);
  });

  it('lists by status and search, soonest follow-up first, with a count for each status', async () => {
    prismaMock.outreachContact.findMany.mockResolvedValue([{ id: 'o-1' }]);
    prismaMock.outreachContact.groupBy.mockResolvedValue([{ status: 'CONTACTED', _count: { _all: 4 } }, { status: 'POSTED', _count: { _all: 1 } }]);
    const { res, out } = respond();

    await adminListOutreach(req({ query: { status: 'INTERESTED', q: 'hotel' } }), res);

    const args = prismaMock.outreachContact.findMany.mock.calls[0][0];
    expect(args.where.status).toBe('INTERESTED');
    expect(args.where.OR).toHaveLength(4);
    expect(args.orderBy[0]).toEqual({ followUpAt: 'asc' });
    expect(out.body.counts).toEqual({ CONTACTED: 4, POSTED: 1 });
  });
});

describe('what the public sees', () => {
  const job: SeoJob = { id: 'j1', title: 'Hotel receptionist', description: 'Welcome guests.', type: 'Full-time', createdAt: new Date(), employerName: 'Achiba Star Hotel', postedOnBehalf: true };

  it('says "Posted by JobWahala on behalf of [company]" on a job an admin posted, and not otherwise', () => {
    expect(renderJobPage(job, 'https://www.jobwahala.com')).toContain('Posted by JobWahala on behalf of Achiba Star Hotel.');
    expect(renderJobPage({ ...job, postedOnBehalf: false }, 'https://www.jobwahala.com')).not.toContain('on behalf of');
  });

  it('shows the Founding Employer badge on the company page for crawlers', () => {
    const company = { id: 'c1', name: 'Akoko', isVerified: false, jobs: [] };
    expect(renderCompanyPage({ ...company, isFoundingEmployer: true }, 'https://www.jobwahala.com')).toContain('Founding Employer');
    expect(renderCompanyPage(company, 'https://www.jobwahala.com')).not.toContain('Founding Employer');
  });
});
