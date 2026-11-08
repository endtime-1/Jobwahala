import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const m = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const mock: Record<string, any> = {
    hiringRequest: m('findUnique', 'findFirst', 'findMany', 'create', 'update', 'updateMany', 'count', 'groupBy'),
    hiringCandidate: m('findUnique', 'findFirst', 'findMany', 'create', 'update', 'count', 'groupBy'),
    hiringEvent: m('create', 'findMany'),
    hiringPayment: m('create', 'findMany', 'findFirst', 'delete'),
    staffProfile: m('findUnique', 'findFirst', 'findMany', 'create', 'update'),
    user: m('findUnique', 'findFirst', 'findMany', 'create', 'update'),
    employerProfile: m('findUnique', 'findMany'),
    jobSeekerProfile: m('findFirst', 'findMany'),
    seekerCv: m('findFirst'),
    cvBlock: m('findMany', 'findFirst'),
    job: m('create', 'findUnique'),
    application: m('findMany', 'findFirst'),
    notification: m('create'),
    adminActionLog: m('create'),
    passwordResetToken: m('create'),
    billingSettings: m('findUnique', 'upsert'),
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});
vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));
const alerts = vi.hoisted(() => ({ notifyJobAlerts: vi.fn() }));
vi.mock('../../services/jobAlertService', () => alerts);
const mail = vi.hoisted(() => ({
  sendHiringShortlistEmail: vi.fn().mockResolvedValue(undefined),
  sendHiringStatusEmail: vi.fn().mockResolvedValue(undefined),
  sendGuaranteeReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendOpportunityEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/emailService', async (importOriginal) => ({ ...(await importOriginal<object>()), ...mail }));

import * as hiring from '../../services/hiringService';
import { canViewUpload } from '../../services/fileAccessService';
import { roleMiddleware } from '../../middleware/auth';

const NOW = new Date('2026-11-12T10:00:00.000Z');
const DAY = 86_400_000;
const admin = { id: 'admin-1', role: 'ADMIN', email: 'admin@jobwahala.com' };
const recruiter = { id: 'rec-1', role: 'RECRUITER', email: 'kofi@jobwahala.com' };

const request = (extra: Record<string, unknown> = {}) => ({
  id: 'req-1', reference: 'HS-2026-0001', clientId: 'client-1', status: 'SOURCING', roleTitle: 'Cashier', headcount: 1, salaryMin: 1500, salaryMax: 2000, location: 'Kumasi',
  startDate: null, deadline: new Date(NOW.getTime() + 20 * DAY), requirements: 'Run the till and count cash daily.', contactName: 'Mr Mensah', contactPhone: '0241234567',
  mustHavesJson: '[]', jobId: null, assignedRecruiterId: 'rec-1', assignedAt: NOW, feePesewas: null, depositPesewas: null, guaranteeDays: 90, sentAt: null, filledAt: null,
  guaranteeEndsAt: null, guaranteeReminderSentAt: null, replacementCount: 0, cancelledAt: null, closeReason: null, createdAt: NOW, ...extra,
});

const candidate = (extra: Record<string, unknown> = {}) => ({
  id: 'c-1', requestId: 'req-1', seekerId: 'seeker-1', source: 'CV_DATABASE', stage: 'SOURCED', consentAskedAt: null, consentAt: null, consentVersion: null, declinedAt: null, declineReason: null,
  ratingsJson: '{}', fitScore: null, clientSummary: null, staffNotes: null, shortlistedAt: null, clientDecision: null, clientDecisionNote: null, clientDecidedAt: null, startDate: null,
  createdById: 'rec-1', createdAt: NOW, ...extra,
});

const seekerProfile = (visibility = 'VERIFIED_EMPLOYERS') => ({ userId: 'seeker-1', firstName: 'Ama', lastName: 'Mensah', headline: 'Cashier', skills: 'POS', experience: 'Five years', location: 'Kumasi', educationLevel: null, yearsExperience: 5, cvVisibility: visibility, user: { email: 'ama@example.com', phone: '+233241234567', identityVerified: true, learnerCourses: [], seekerCv: { uploadedUrl: '/api/uploads/cv/ama.pdf', uploadedFileName: 'ama.pdf' } } });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.hiringRequest.findUnique.mockResolvedValue(request());
  prismaMock.hiringCandidate.findMany.mockResolvedValue([]);
  prismaMock.hiringPayment.findMany.mockResolvedValue([]);
  prismaMock.jobSeekerProfile.findMany.mockResolvedValue([]);
  prismaMock.cvBlock.findMany.mockResolvedValue([]);
  prismaMock.cvBlock.findFirst.mockResolvedValue(null);
  prismaMock.staffProfile.findUnique.mockResolvedValue({ displayName: 'Kofi Boateng', title: 'Recruiter' });
  prismaMock.billingSettings.findUnique.mockResolvedValue({ hiringFromPriceGhs: 1200, hiringGuaranteeDays: 90 });
  prismaMock.user.findMany.mockResolvedValue([{ id: 'admin-1', email: 'admin@jobwahala.com' }]);
  prismaMock.user.findUnique.mockResolvedValue({ email: 'boss@akoko.com', employerProfile: { companyName: 'Akoko' } });
});

describe('the public page and the admin setting behind it', () => {
  it('gives the "from" price and the guarantee length, and sensible defaults before anything is set', async () => {
    expect(await hiring.getHiringInfo()).toEqual({ fromPriceGhs: 1200, guaranteeDays: 90 });
    prismaMock.billingSettings.findUnique.mockResolvedValue(null);
    expect(await hiring.getHiringInfo()).toEqual({ fromPriceGhs: null, guaranteeDays: 90 });
  });

  it('lets an admin change them, and logs it', async () => {
    await hiring.saveHiringSettings(admin, { fromPriceGhs: 1500, guaranteeDays: 60 });
    expect(prismaMock.billingSettings.upsert.mock.calls[0][0].update).toEqual({ hiringFromPriceGhs: 1500, hiringGuaranteeDays: 60 });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ action: 'HIRING_SETTINGS_CHANGED', actorRole: 'ADMIN' });
  });
});

describe('the employer makes a request', () => {
  const input = { roleTitle: ' Cashier ', headcount: 2, salaryMin: 1500, salaryMax: 2000, location: 'Kumasi', startDate: '2026-12-01', deadline: '2026-11-30', requirements: 'Run the till and count cash.', contactName: 'Mr Mensah', contactPhone: '0241234567' };

  it('saves it as New with every field from the form, copies the admin guarantee length, and tells the admins', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ companyName: 'Akoko' });
    prismaMock.hiringRequest.count.mockResolvedValue(6);
    prismaMock.hiringRequest.create.mockImplementation(async ({ data }: any) => ({ id: 'req-9', ...data }));

    expect(await hiring.createRequest('client-1', input, NOW)).toEqual({ id: 'req-9', reference: 'HS-2026-0007' });

    const data = prismaMock.hiringRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ clientId: 'client-1', roleTitle: 'Cashier', headcount: 2, salaryMin: 1500, salaryMax: 2000, location: 'Kumasi', requirements: 'Run the till and count cash.', contactName: 'Mr Mensah', contactPhone: '0241234567', guaranteeDays: 90 });
    expect(data.startDate).toEqual(new Date('2026-12-01'));
    expect(data.deadline).toEqual(new Date('2026-11-30'));
    expect(data.status).toBeUndefined();
    expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'admin-1', type: 'HIRING_REQUEST_NEW' });
    expect(prismaMock.hiringEvent.create.mock.calls[0][0].data).toMatchObject({ visibility: 'CLIENT', kind: 'STATUS' });
  });

  it('needs a company page, a sensible salary range and real dates', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue(null);
    await expect(hiring.createRequest('client-1', input, NOW)).rejects.toMatchObject({ code: 'COMPANY_REQUIRED' });
    prismaMock.employerProfile.findUnique.mockResolvedValue({ companyName: 'Akoko' });
    await expect(hiring.createRequest('client-1', { ...input, salaryMin: 3000, salaryMax: 2000 }, NOW)).rejects.toMatchObject({ code: 'SALARY_RANGE' });
    await expect(hiring.createRequest('client-1', { ...input, deadline: 'soon-ish' }, NOW)).rejects.toMatchObject({ code: 'BAD_DATE' });
    expect(prismaMock.hiringRequest.create).not.toHaveBeenCalled();
  });

  it('can be cancelled before work starts, and not after', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'AGREED' }));
    await hiring.cancelByClient('client-1', 'req-1', NOW);
    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data).toMatchObject({ status: 'CANCELLED', cancelledAt: NOW });
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'SOURCING' }));
    await expect(hiring.cancelByClient('client-1', 'req-1', NOW)).rejects.toMatchObject({ code: 'TOO_LATE' });
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'NEW' }));
    await expect(hiring.cancelByClient('someone-else', 'req-1', NOW)).rejects.toMatchObject({ status: 404 });
  });
});

describe('what the employer sees', () => {
  it('shows no shortlist until we have sent it, however many people are shortlisted', async () => {
    prismaMock.hiringCandidate.findMany.mockResolvedValue([candidate({ stage: 'SHORTLISTED', consentAt: NOW, shortlistedAt: NOW })]);
    const before = await hiring.getClientRequest('client-1', 'req-1', NOW);
    expect(before.candidates).toEqual([]);
    expect(prismaMock.hiringCandidate.findMany).not.toHaveBeenCalled();
  });

  it('shows agreed, shortlisted people with our note and CV once sent, and never staff notes or the source', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'SHORTLIST_SENT', sentAt: NOW }));
    prismaMock.hiringCandidate.findMany.mockResolvedValue([candidate({ stage: 'SHORTLISTED', consentAt: NOW, shortlistedAt: NOW, clientSummary: 'Strong cashier with five years.', staffNotes: 'secret staff note' })]);
    prismaMock.hiringEvent.findMany.mockResolvedValue([{ id: 'e-1', kind: 'DELIVERY', body: 'Our shortlist is ready', createdAt: NOW }]);
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([seekerProfile('HIDDEN')]);

    const view = await hiring.getClientRequest('client-1', 'req-1', NOW);

    expect(prismaMock.hiringCandidate.findMany.mock.calls[0][0].where).toMatchObject({ requestId: 'req-1', shortlistedAt: { not: null }, consentAt: { not: null } });
    expect(prismaMock.hiringEvent.findMany.mock.calls[0][0].where).toEqual({ requestId: 'req-1', visibility: 'CLIENT' });
    expect(view.candidates[0]).toMatchObject({ name: 'Ama Mensah', note: 'Strong cashier with five years.', identityVerified: true });
    expect(view.candidates[0].cv).toEqual({ url: '/api/uploads/cv/ama.pdf', fileName: 'ama.pdf' });
    expect(JSON.stringify(view)).not.toContain('secret staff note');
    expect(JSON.stringify(view)).not.toContain('CV_DATABASE');
    expect(view.request.recruiter).toEqual({ name: 'Kofi Boateng', title: 'Recruiter' });
  });

  it('hides a candidate who blocked the company after being added', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'SHORTLIST_SENT', sentAt: NOW }));
    prismaMock.hiringCandidate.findMany.mockResolvedValue([candidate({ stage: 'SHORTLISTED', consentAt: NOW, shortlistedAt: NOW })]);
    prismaMock.cvBlock.findMany.mockResolvedValue([{ seekerId: 'seeker-1' }]);
    expect((await hiring.getClientRequest('client-1', 'req-1', NOW)).candidates).toHaveLength(0);
  });

  it('shows the agreed fee and what has been paid, read-only, once a fee is set', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'AGREED', feePesewas: 300000, depositPesewas: 100000 }));
    prismaMock.hiringPayment.findMany.mockResolvedValue([{ kind: 'DEPOSIT', amountPesewas: 100000 }]);
    const view = await hiring.getClientRequest('client-1', 'req-1', NOW);
    expect(view.request.fee).toMatchObject({ feeLabel: 'GHS 3,000.00', paidLabel: 'GHS 1,000.00', outstandingLabel: 'GHS 2,000.00', depositDuePesewas: 0 });
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request());
    expect((await hiring.getClientRequest('client-1', 'req-1', NOW)).request.fee).toBeNull();
  });

  it('is only for the employer who made the request', async () => {
    await expect(hiring.getClientRequest('another-client', 'req-1', NOW)).rejects.toMatchObject({ status: 404 });
  });
});

describe('the employer decides on a shortlisted candidate', () => {
  const sent = (extra: Record<string, unknown> = {}) => request({ status: 'SHORTLIST_SENT', sentAt: NOW, ...extra });
  const shown = (extra: Record<string, unknown> = {}) => candidate({ stage: 'SHORTLISTED', consentAt: NOW, shortlistedAt: NOW, ...extra });

  it('invites to an interview: the request moves on and the recruiter is told', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(sent());
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(shown());

    expect(await hiring.decideOnCandidate('client-1', 'req-1', 'c-1', { decision: 'INTERVIEW' }, NOW)).toEqual({ status: 'INTERVIEWING', filled: false });
    expect(prismaMock.hiringCandidate.update.mock.calls[0][0].data).toMatchObject({ stage: 'INTERVIEW', clientDecision: 'INTERVIEW' });
    expect(prismaMock.notification.create.mock.calls[0][0].data.userId).toBe('rec-1');
  });

  it('marks someone not suitable without moving the request', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(sent());
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(shown());
    expect(await hiring.decideOnCandidate('client-1', 'req-1', 'c-1', { decision: 'NOT_SUITABLE', note: 'Not enough experience' }, NOW)).toEqual({ status: 'SHORTLIST_SENT', filled: false });
    expect(prismaMock.hiringCandidate.update.mock.calls[0][0].data).toMatchObject({ stage: 'NOT_SUITABLE', clientDecisionNote: 'Not enough experience' });
  });

  it('records the start date when someone is hired, fills the request and starts the guarantee from that date', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(sent({ status: 'INTERVIEWING', headcount: 1, guaranteeDays: 90 }));
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(shown());
    prismaMock.hiringCandidate.count.mockResolvedValue(1);

    expect(await hiring.decideOnCandidate('client-1', 'req-1', 'c-1', { decision: 'HIRED', startDate: '2026-12-01' }, NOW)).toEqual({ status: 'FILLED', filled: true });

    expect(prismaMock.hiringCandidate.update.mock.calls[0][0].data).toMatchObject({ stage: 'HIRED', startDate: new Date('2026-12-01') });
    const data = prismaMock.hiringRequest.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'FILLED', filledAt: NOW });
    expect(data.guaranteeEndsAt.toISOString()).toBe('2027-03-01T00:00:00.000Z');
  });

  it('starts the guarantee today when no start date is given, and keeps the request open until every place is filled', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(sent({ headcount: 2 }));
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(shown());
    prismaMock.hiringCandidate.count.mockResolvedValue(1);
    expect(await hiring.decideOnCandidate('client-1', 'req-1', 'c-1', { decision: 'HIRED' }, NOW)).toEqual({ status: 'SHORTLIST_SENT', filled: false });
    expect(prismaMock.hiringCandidate.update.mock.calls[0][0].data.startDate).toEqual(NOW);

    prismaMock.hiringRequest.update.mockClear();
    prismaMock.hiringRequest.findUnique.mockResolvedValue(sent({ headcount: 1, guaranteeDays: 30 }));
    prismaMock.hiringCandidate.count.mockResolvedValue(1);
    await hiring.decideOnCandidate('client-1', 'req-1', 'c-1', { decision: 'HIRED' }, NOW);
    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data.guaranteeEndsAt.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it('refuses before the shortlist is sent, for another company, or for someone not on the shortlist', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'SOURCING' }));
    await expect(hiring.decideOnCandidate('client-1', 'req-1', 'c-1', { decision: 'HIRED' }, NOW)).rejects.toMatchObject({ code: 'NOT_OPEN' });
    prismaMock.hiringRequest.findUnique.mockResolvedValue(sent());
    await expect(hiring.decideOnCandidate('other', 'req-1', 'c-1', { decision: 'HIRED' }, NOW)).rejects.toMatchObject({ status: 404 });
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ stage: 'CONSENTED', consentAt: NOW, shortlistedAt: null }));
    await expect(hiring.decideOnCandidate('client-1', 'req-1', 'c-1', { decision: 'HIRED' }, NOW)).rejects.toMatchObject({ code: 'CANDIDATE_NOT_FOUND' });
  });

  it('reopens the request for a free replacement inside the guarantee, and not after it', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'FILLED', guaranteeEndsAt: new Date(NOW.getTime() + 10 * DAY) }));
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ stage: 'HIRED' }));
    await hiring.requestReplacement('client-1', 'req-1', 'Left after two weeks', NOW);
    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data).toMatchObject({ status: 'SOURCING', guaranteeEndsAt: null, replacementCount: { increment: 1 } });
    expect(prismaMock.hiringCandidate.update.mock.calls[0][0].data.stage).toBe('DROPPED');

    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'FILLED', guaranteeEndsAt: new Date(NOW.getTime() - DAY) }));
    await expect(hiring.requestReplacement('client-1', 'req-1', 'Left', NOW)).rejects.toMatchObject({ code: 'NO_GUARANTEE' });
  });
});

describe('who can work on a request', () => {
  it('lets a recruiter open only their own requests; an admin any; nobody else', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ assignedRecruiterId: 'rec-2' }));
    prismaMock.employerProfile.findUnique.mockResolvedValue({ companyName: 'Akoko', industry: 'Retail' });
    await expect(hiring.getStaffRequest(recruiter, 'req-1', NOW)).rejects.toMatchObject({ status: 404 });
    await expect(hiring.getStaffRequest({ id: 'client-1', role: 'EMPLOYER' }, 'req-1', NOW)).rejects.toMatchObject({ status: 403 });
    await expect(hiring.getStaffRequest({ id: 's', role: 'SEEKER' }, 'req-1', NOW)).rejects.toMatchObject({ status: 403 });
    expect((await hiring.getStaffRequest(admin, 'req-1', NOW)).request.company).toBe('Akoko');
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request());
    expect((await hiring.getStaffRequest(recruiter, 'req-1', NOW)).request.reference).toBe('HS-2026-0001');
  });

  it('shows the agreed fee and payments to an admin, never to a recruiter', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ feePesewas: 300000, depositPesewas: 100000 }));
    prismaMock.employerProfile.findUnique.mockResolvedValue({ companyName: 'Akoko', industry: null });
    prismaMock.hiringPayment.findMany.mockResolvedValue([{ id: 'p-1', kind: 'DEPOSIT', amountPesewas: 100000, paidAt: NOW, method: 'cash', reference: null, note: null }]);

    const asAdmin = await hiring.getStaffRequest(admin, 'req-1', NOW);
    expect(asAdmin.request.fee).toMatchObject({ feeLabel: 'GHS 3,000.00', outstandingLabel: 'GHS 2,000.00' });
    expect(asAdmin.request.payments).toHaveLength(1);

    const asRecruiter = await hiring.getStaffRequest(recruiter, 'req-1', NOW);
    expect(asRecruiter.request).not.toHaveProperty('fee');
    expect(asRecruiter.request).not.toHaveProperty('payments');
    expect(asRecruiter.request).not.toHaveProperty('feePesewas');
    expect(JSON.stringify(asRecruiter)).not.toContain('300000');
  });

  it('lists by status, recruiter and date for an admin; a recruiter is always limited to their own', async () => {
    prismaMock.hiringRequest.findMany.mockResolvedValue([request()]);
    prismaMock.employerProfile.findMany.mockResolvedValue([{ userId: 'client-1', companyName: 'Akoko' }]);
    prismaMock.staffProfile.findMany.mockResolvedValue([]);
    prismaMock.hiringCandidate.groupBy.mockResolvedValue([]);

    await hiring.listStaffRequests(admin, { status: 'SOURCING', recruiterId: 'rec-1', from: '2026-11-01', to: '2026-11-30' });
    const where = prismaMock.hiringRequest.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: 'SOURCING', assignedRecruiterId: 'rec-1' });
    expect(where.createdAt.gte).toEqual(new Date('2026-11-01'));
    expect(where.createdAt.lte.getTime()).toBe(new Date('2026-11-30').getTime() + DAY - 1);

    await hiring.listStaffRequests(admin, { recruiterId: 'NONE' });
    expect(prismaMock.hiringRequest.findMany.mock.calls[1][0].where.assignedRecruiterId).toBeNull();

    await hiring.listStaffRequests(recruiter, { recruiterId: 'rec-2', status: 'ALL' });
    const own = prismaMock.hiringRequest.findMany.mock.calls[2][0].where;
    expect(own.assignedRecruiterId).toBe('rec-1');
    expect(own.status).toBeUndefined();
  });

  it('keeps the staff routes closed to other roles', () => {
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    roleMiddleware(['RECRUITER', 'ADMIN'])({ user: { id: 'u', role: 'SEEKER' } } as never, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('the deal: terms and payments (admin only)', () => {
  it('sets the fee and deposit, moves a New request to Agreed, tells the employer by email and in the app, and logs the before and after', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'NEW', assignedRecruiterId: null }));

    await hiring.updateTerms(admin, 'req-1', { feeGhs: 3000, depositGhs: 1000, guaranteeDays: 60 });

    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data).toMatchObject({ feePesewas: 300000, depositPesewas: 100000, guaranteeDays: 60, status: 'AGREED' });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ action: 'HIRING_TERMS_CHANGED', actorRole: 'ADMIN' });
    expect(JSON.parse(prismaMock.adminActionLog.create.mock.calls[0][0].data.metadata)).toMatchObject({ before: { fee: null }, after: { fee: 300000, deposit: 100000, guaranteeDays: 60 } });
    expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'client-1', type: 'HIRING_UPDATE' });
    expect(mail.sendHiringStatusEmail).toHaveBeenCalledWith('boss@akoko.com', expect.objectContaining({ message: expect.stringContaining('GHS 3,000.00') }));
  });

  it('refuses a recruiter, a deposit above the fee, and a cancelled request', async () => {
    await expect(hiring.updateTerms(recruiter, 'req-1', { feeGhs: 100 })).rejects.toMatchObject({ code: 'ADMIN_ONLY' });
    await expect(hiring.updateTerms(admin, 'req-1', { feeGhs: 1000, depositGhs: 2000 })).rejects.toMatchObject({ code: 'DEPOSIT_TOO_BIG' });
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'CANCELLED' }));
    await expect(hiring.updateTerms(admin, 'req-1', { feeGhs: 1000 })).rejects.toMatchObject({ code: 'CLOSED' });
  });

  it('moves the guarantee end date when the guarantee length changes on a filled request', async () => {
    const ends = new Date('2027-03-01T00:00:00Z');
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'FILLED', guaranteeDays: 90, guaranteeEndsAt: ends, feePesewas: 100000 }));
    await hiring.updateTerms(admin, 'req-1', { guaranteeDays: 120 });
    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data.guaranteeEndsAt.getTime()).toBe(ends.getTime() + 30 * DAY);
  });

  it('records a payment by hand, in cedis, with an audit line and a staff-only history entry; a recruiter cannot', async () => {
    prismaMock.hiringPayment.create.mockResolvedValue({ id: 'p-1' });
    expect(await hiring.recordPayment(admin, 'req-1', { kind: 'DEPOSIT', amountGhs: 1000, paidAt: '2026-11-10', method: 'mobile money', reference: 'MM123' })).toEqual({ id: 'p-1' });
    expect(prismaMock.hiringPayment.create.mock.calls[0][0].data).toMatchObject({ kind: 'DEPOSIT', amountPesewas: 100000, method: 'mobile money', reference: 'MM123', recordedById: 'admin-1' });
    expect(prismaMock.hiringEvent.create.mock.calls[0][0].data).toMatchObject({ kind: 'PAYMENT', visibility: 'STAFF' });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data.action).toBe('HIRING_PAYMENT_RECORDED');

    await expect(hiring.recordPayment(recruiter, 'req-1', { kind: 'DEPOSIT', amountGhs: 10, paidAt: '2026-11-10' })).rejects.toMatchObject({ code: 'ADMIN_ONLY' });
    await expect(hiring.recordPayment(admin, 'req-1', { kind: 'DEPOSIT', amountGhs: 0, paidAt: '2026-11-10' })).rejects.toMatchObject({ code: 'BAD_AMOUNT' });
  });

  it('removes a mistaken payment, with a reason, and logs it', async () => {
    prismaMock.hiringPayment.findFirst.mockResolvedValue({ id: 'p-1', amountPesewas: 100000 });
    await hiring.removePayment(admin, 'req-1', 'p-1', 'Entered twice');
    expect(prismaMock.hiringPayment.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data.action).toBe('HIRING_PAYMENT_REMOVED');
    prismaMock.hiringPayment.findFirst.mockResolvedValue(null);
    await expect(hiring.removePayment(admin, 'req-1', 'nope', 'x')).rejects.toMatchObject({ status: 404 });
  });
});

describe('status changes and the job post', () => {
  it('changes the status, tells the employer by email and in the app, and logs it', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'AGREED' }));
    await hiring.setStatus(recruiter, 'req-1', 'SOURCING', null, NOW);

    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data).toEqual({ status: 'SOURCING' });
    expect(prismaMock.hiringEvent.create.mock.calls[0][0].data).toMatchObject({ visibility: 'CLIENT', body: 'Status changed from Agreed to Sourcing.' });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ action: 'HIRING_STATUS_CHANGED', actorRole: 'RECRUITER' });
    expect(prismaMock.notification.create.mock.calls[0][0].data.userId).toBe('client-1');
    expect(mail.sendHiringStatusEmail).toHaveBeenCalledWith('boss@akoko.com', expect.objectContaining({ title: 'HS-2026-0001: Sourcing' }));
  });

  it('lets only an admin cancel, with a reason; and does not allow Filled or Shortlist sent by hand', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request());
    await expect(hiring.setStatus(recruiter, 'req-1', 'CANCELLED', 'No longer needed')).rejects.toMatchObject({ code: 'ADMIN_REASON' });
    await expect(hiring.setStatus(admin, 'req-1', 'CANCELLED', '')).rejects.toMatchObject({ code: 'ADMIN_REASON' });
    await hiring.setStatus(admin, 'req-1', 'CANCELLED', 'Employer asked us to stop', NOW);
    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data).toMatchObject({ status: 'CANCELLED', cancelledAt: NOW, closeReason: 'Employer asked us to stop' });
    await expect(hiring.setStatus(admin, 'req-1', 'FILLED')).rejects.toMatchObject({ code: 'USE_HIRE' });
    await expect(hiring.setStatus(admin, 'req-1', 'SHORTLIST_SENT')).rejects.toMatchObject({ code: 'USE_SEND' });
  });

  it('will not change a closed request', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'CANCELLED' }));
    await expect(hiring.setStatus(admin, 'req-1', 'SOURCING')).rejects.toMatchObject({ code: 'BAD_STATUS' });
  });

  it('creates the job post in one click as a draft under the employer’s company, marked as posted by staff', async () => {
    prismaMock.job.create.mockImplementation(async ({ data }: any) => ({ id: 'job-1', ...data }));

    expect(await hiring.createJobFromRequest(recruiter, 'req-1', { publish: false }, NOW)).toEqual({ jobId: 'job-1', published: false });

    const data = prismaMock.job.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ employerId: 'client-1', postedByAdminId: 'rec-1', title: 'Cashier', description: 'Run the till and count cash daily.', location: 'Kumasi', status: 'DRAFT', salary: 'GHS 1,500 to 2,000 a month' });
    expect(data.closesAt).toEqual(new Date(NOW.getTime() + 20 * DAY));
    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data).toEqual({ jobId: 'job-1' });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ action: 'HIRING_JOB_CREATED', actorRole: 'RECRUITER' });
    expect(alerts.notifyJobAlerts).not.toHaveBeenCalled();
  });

  it('publishes straight away when asked, and alerts people with a matching job alert; one job per request', async () => {
    prismaMock.job.create.mockImplementation(async ({ data }: any) => ({ id: 'job-1', ...data }));
    await hiring.createJobFromRequest(admin, 'req-1', { publish: true }, NOW);
    expect(prismaMock.job.create.mock.calls[0][0].data.status).toBe('ACTIVE');
    expect(alerts.notifyJobAlerts).toHaveBeenCalledTimes(1);

    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ jobId: 'job-1' }));
    await expect(hiring.createJobFromRequest(admin, 'req-1', { publish: false }, NOW)).rejects.toMatchObject({ code: 'JOB_EXISTS' });
  });

  it('uses a 30-day closing date when the deadline has passed or was not given', async () => {
    prismaMock.job.create.mockImplementation(async ({ data }: any) => ({ id: 'job-1', ...data }));
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ deadline: new Date(NOW.getTime() - DAY) }));
    await hiring.createJobFromRequest(admin, 'req-1', { publish: false }, NOW);
    expect(prismaMock.job.create.mock.calls[0][0].data.closesAt).toEqual(new Date(NOW.getTime() + 30 * DAY));
  });
});

describe('sourcing candidates', () => {
  it('will not source for a request that is still New (terms not agreed) or closed', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'NEW' }));
    await expect(hiring.addCandidate(recruiter, 'req-1', { profileId: 'p' })).rejects.toMatchObject({ code: 'NOT_ACTIVE' });
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'CANCELLED' }));
    await expect(hiring.addCandidate(recruiter, 'req-1', { profileId: 'p' })).rejects.toMatchObject({ code: 'NOT_ACTIVE' });
  });

  it('adds a person from the CV database: only visible profiles, never someone who blocked the employer; Agreed becomes Sourcing', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'AGREED' }));
    prismaMock.jobSeekerProfile.findFirst.mockResolvedValue({ userId: 'seeker-1' });
    prismaMock.hiringCandidate.findUnique.mockResolvedValue(null);
    prismaMock.hiringCandidate.create.mockResolvedValue({ id: 'c-1' });

    await hiring.addCandidate(recruiter, 'req-1', { profileId: 'prof-1' });

    const where = prismaMock.jobSeekerProfile.findFirst.mock.calls[0][0].where;
    expect(where.cvVisibility).toBe('VERIFIED_EMPLOYERS');
    expect(where.user.cvBlocksMade).toEqual({ none: { employerId: 'client-1' } });
    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data).toEqual({ status: 'SOURCING' });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ action: 'CANDIDATE_ADDED', actorRole: 'RECRUITER' });
  });

  it('adds someone by email, and refuses a repeat or someone with no account', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'seeker-2' });
    prismaMock.hiringCandidate.findUnique.mockResolvedValue({ id: 'already' });
    await expect(hiring.addCandidate(recruiter, 'req-1', { email: 'Ama@Example.com' })).rejects.toMatchObject({ code: 'ALREADY_ADDED' });
    expect(prismaMock.user.findFirst.mock.calls[0][0].where.email).toBe('ama@example.com');
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(hiring.addCandidate(recruiter, 'req-1', { email: 'nobody@example.com' })).rejects.toMatchObject({ code: 'CANDIDATE_NOT_FOUND' });
  });

  it('imports the applicants of the linked job: their application is their agreement, blocked people and repeats are skipped', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ jobId: 'job-1' }));
    prismaMock.application.findMany.mockResolvedValue([
      { seekerId: 'a', createdAt: new Date('2026-11-05T00:00:00Z') },
      { seekerId: 'b', createdAt: new Date('2026-11-06T00:00:00Z') },
      { seekerId: 'c', createdAt: new Date('2026-11-07T00:00:00Z') },
    ]);
    prismaMock.hiringCandidate.findMany.mockResolvedValue([{ seekerId: 'a' }]);
    prismaMock.cvBlock.findMany.mockResolvedValue([{ seekerId: 'c' }]);

    expect(await hiring.importApplicants(recruiter, 'req-1')).toEqual({ added: 1 });

    expect(prismaMock.hiringCandidate.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.hiringCandidate.create.mock.calls[0][0].data).toMatchObject({ seekerId: 'b', source: 'APPLICANT', stage: 'CONSENTED', consentAt: new Date('2026-11-06T00:00:00Z') });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data.action).toBe('APPLICANTS_IMPORTED');
  });

  it('needs the job post before importing applicants', async () => {
    await expect(hiring.importApplicants(recruiter, 'req-1')).rejects.toMatchObject({ code: 'NO_JOB' });
  });

  it('asks a candidate for their agreement: notified and emailed, and nothing shared', async () => {
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate());
    prismaMock.user.findUnique.mockImplementation(async ({ where }: any) => (where.id === 'seeker-1' ? { email: 'ama@example.com' } : { email: 'boss@akoko.com', employerProfile: { companyName: 'Akoko' } }));

    await hiring.askConsent(recruiter, 'req-1', 'c-1', NOW);

    expect(prismaMock.hiringCandidate.update.mock.calls[0][0].data).toEqual({ stage: 'CONSENT_ASKED', consentAskedAt: NOW });
    expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'seeker-1', type: 'HIRING_OPPORTUNITY', actionUrl: '/opportunities' });
    expect(mail.sendOpportunityEmail).toHaveBeenCalledWith('ama@example.com', expect.objectContaining({ role: 'Cashier' }));
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ stage: 'CONSENT_ASKED' }));
    await expect(hiring.askConsent(recruiter, 'req-1', 'c-1', NOW)).rejects.toMatchObject({ code: 'ALREADY_ASKED' });
  });

  it('records the candidate’s answer, once', async () => {
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ stage: 'CONSENT_ASKED' }));
    await hiring.respondToOpportunity('seeker-1', 'c-1', { accept: true }, NOW);
    expect(prismaMock.hiringCandidate.update.mock.calls[0][0].data).toEqual({ stage: 'CONSENTED', consentAt: NOW, consentVersion: 'v1' });

    prismaMock.hiringCandidate.update.mockClear();
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ stage: 'CONSENT_ASKED' }));
    await hiring.respondToOpportunity('seeker-1', 'c-1', { accept: false, reason: 'Happy where I am' }, NOW);
    expect(prismaMock.hiringCandidate.update.mock.calls[0][0].data).toMatchObject({ stage: 'DECLINED', declineReason: 'Happy where I am' });

    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ stage: 'CONSENTED' }));
    await expect(hiring.respondToOpportunity('seeker-1', 'c-1', { accept: true })).rejects.toMatchObject({ code: 'ALREADY_ANSWERED' });
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(null);
    await expect(hiring.respondToOpportunity('someone-else', 'c-1', { accept: true })).rejects.toMatchObject({ status: 404 });
  });

  it('does not offer applicants an "opportunity" to answer: they already applied', async () => {
    prismaMock.hiringCandidate.findMany.mockResolvedValue([]);
    await hiring.listOpportunities('seeker-1');
    expect(prismaMock.hiringCandidate.findMany.mock.calls[0][0].where).toMatchObject({ seekerId: 'seeker-1', source: { not: 'APPLICANT' } });
  });

  it('saves a note per candidate and optional ratings, but never moves someone by rating alone', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ mustHavesJson: '["Cash handling","Fluent English"]' }));
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ stage: 'CONSENTED', consentAt: NOW }));
    prismaMock.hiringCandidate.update.mockImplementation(async ({ data }: any) => ({ id: 'c-1', stage: 'CONSENTED', ...data }));

    const result = await hiring.updateCandidate(recruiter, 'req-1', 'c-1', { ratings: { 'Cash handling': 5, 'Fluent English': 3, Other: 5 }, note: ' Strong cashier. ', staffNotes: 'Call after 5pm' });

    expect(result).toMatchObject({ stage: 'CONSENTED', fitScore: 80 });
    const data = prismaMock.hiringCandidate.update.mock.calls[0][0].data;
    expect(JSON.parse(data.ratingsJson)).toEqual({ 'Cash handling': 5, 'Fluent English': 3 });
    expect(data.clientSummary).toBe('Strong cashier.');
    expect(data.staffNotes).toBe('Call after 5pm');
  });
});

describe('shortlisting and sending', () => {
  const ready = () => candidate({ stage: 'CONSENTED', consentAt: NOW, clientSummary: 'A strong cashier with five years in busy shops.' });

  it('shortlists an agreed person with a note, and logs it', async () => {
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(ready());
    await hiring.shortlistCandidate(recruiter, 'req-1', 'c-1', NOW);
    expect(prismaMock.hiringCandidate.update.mock.calls[0][0].data).toEqual({ stage: 'SHORTLISTED', shortlistedAt: NOW });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ action: 'CANDIDATE_SHORTLISTED', actorRole: 'RECRUITER' });
  });

  it('refuses someone who has not agreed, has no note, or has blocked the employer', async () => {
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ stage: 'SOURCED' }));
    await expect(hiring.shortlistCandidate(recruiter, 'req-1', 'c-1', NOW)).rejects.toMatchObject({ code: 'NOT_READY' });
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ stage: 'CONSENTED', consentAt: NOW, clientSummary: 'ok' }));
    await expect(hiring.shortlistCandidate(recruiter, 'req-1', 'c-1', NOW)).rejects.toMatchObject({ code: 'NOT_READY' });
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(ready());
    prismaMock.cvBlock.findFirst.mockResolvedValue({ id: 'b' });
    await expect(hiring.shortlistCandidate(recruiter, 'req-1', 'c-1', NOW)).rejects.toMatchObject({ code: 'BLOCKED' });
  });

  it('sends the shortlist: status becomes Shortlist sent, the employer is emailed and notified, and it is logged', async () => {
    prismaMock.hiringCandidate.count.mockResolvedValue(3);

    expect(await hiring.sendShortlist(recruiter, 'req-1', NOW)).toEqual({ shortlisted: 3 });

    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data).toEqual({ sentAt: NOW, status: 'SHORTLIST_SENT' });
    expect(mail.sendHiringShortlistEmail).toHaveBeenCalledWith('boss@akoko.com', expect.objectContaining({ count: 3, role: 'Cashier', url: expect.stringContaining('/hiring-service/req-1') }));
    expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'client-1', type: 'HIRING_SHORTLIST_READY' });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data.action).toBe('SHORTLIST_SENT');
    expect(prismaMock.hiringCandidate.count.mock.calls[0][0].where).toMatchObject({ consentAt: { not: null }, shortlistedAt: { not: null }, stage: { notIn: ['DECLINED', 'DROPPED'] } });
  });

  it('sends again later without changing the status, keeping the first sent date', async () => {
    const first = new Date(NOW.getTime() - 3 * DAY);
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'INTERVIEWING', sentAt: first }));
    prismaMock.hiringCandidate.count.mockResolvedValue(2);
    await hiring.sendShortlist(recruiter, 'req-1', NOW);
    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data).toEqual({ sentAt: first });
  });

  it('refuses an empty shortlist', async () => {
    prismaMock.hiringCandidate.count.mockResolvedValue(0);
    await expect(hiring.sendShortlist(recruiter, 'req-1', NOW)).rejects.toMatchObject({ code: 'EMPTY_SHORTLIST' });
  });

  it('tells the employer straight away when a person is added after the shortlist went out', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'SHORTLIST_SENT', sentAt: NOW }));
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(ready());
    await hiring.shortlistCandidate(recruiter, 'req-1', 'c-1', NOW);
    expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'client-1', type: 'HIRING_SHORTLIST_ADDED' });
  });
});

describe('hires and the replacement guarantee end date', () => {
  it('lets staff correct the start date; the guarantee end date follows and the reminder resets', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ status: 'FILLED', guaranteeDays: 90, guaranteeEndsAt: new Date('2027-03-01T00:00:00Z') }));
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ stage: 'HIRED' }));

    await hiring.setHireStartDate(recruiter, 'req-1', 'c-1', '2027-01-01');

    expect(prismaMock.hiringCandidate.update.mock.calls[0][0].data).toEqual({ startDate: new Date('2027-01-01') });
    const data = prismaMock.hiringRequest.update.mock.calls[0][0].data;
    expect(data.guaranteeEndsAt.toISOString()).toBe('2027-04-01T00:00:00.000Z');
    expect(data.guaranteeReminderSentAt).toBeNull();
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data.action).toBe('HIRE_START_DATE_SET');

    prismaMock.hiringCandidate.findFirst.mockResolvedValue(null);
    await expect(hiring.setHireStartDate(recruiter, 'req-1', 'c-2', '2027-01-01')).rejects.toMatchObject({ code: 'NOT_HIRED' });
  });

  it('reminds staff a week before a guarantee ends: recruiter and admins, by email and in the app, once', async () => {
    const ends = new Date(NOW.getTime() + 5 * DAY);
    prismaMock.hiringRequest.findMany.mockResolvedValue([request({ status: 'FILLED', guaranteeEndsAt: ends })]);
    prismaMock.hiringRequest.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    prismaMock.user.findUnique.mockImplementation(async ({ where }: any) => (where.id === 'rec-1' ? { id: 'rec-1', email: 'kofi@jobwahala.com' } : null));
    prismaMock.employerProfile.findUnique.mockResolvedValue({ companyName: 'Akoko' });

    expect(await hiring.runGuaranteeReminders(NOW)).toEqual({ reminded: 1 });

    expect(mail.sendGuaranteeReminderEmail.mock.calls.map((call: any) => call[0]).sort()).toEqual(['admin@jobwahala.com', 'kofi@jobwahala.com']);
    expect(mail.sendGuaranteeReminderEmail.mock.calls[0][1]).toMatchObject({ reference: 'HS-2026-0001', role: 'Cashier', company: 'Akoko', endsOn: ends.toISOString().slice(0, 10) });
    expect(prismaMock.notification.create.mock.calls.map((call: any) => call[0].data.userId).sort()).toEqual(['admin-1', 'rec-1']);
    expect(prismaMock.hiringRequest.findMany.mock.calls[0][0].where).toMatchObject({ status: 'FILLED', guaranteeReminderSentAt: null });

    mail.sendGuaranteeReminderEmail.mockClear();
    expect(await hiring.runGuaranteeReminders(NOW)).toEqual({ reminded: 0 });
    expect(mail.sendGuaranteeReminderEmail).not.toHaveBeenCalled();
  });

  it('does not remind about a guarantee that is more than a week away', async () => {
    prismaMock.hiringRequest.findMany.mockResolvedValue([request({ status: 'FILLED', guaranteeEndsAt: new Date(NOW.getTime() + 20 * DAY) })]);
    expect(await hiring.runGuaranteeReminders(NOW)).toEqual({ reminded: 0 });
    expect(prismaMock.hiringRequest.updateMany).not.toHaveBeenCalled();
  });
});

describe('opening a person is logged, and hidden profiles stay closed', () => {
  it('opens a visible profile fully and writes an audit line', async () => {
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate());
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([seekerProfile('VERIFIED_EMPLOYERS')]);
    const opened = await hiring.openCandidate(recruiter, 'req-1', 'c-1');
    expect(opened.detailsOpen).toBe(true);
    expect(opened.email).toBe('ama@example.com');
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ action: 'CANDIDATE_PROFILE_OPENED', actorRole: 'RECRUITER', adminId: 'rec-1' });
  });

  it('keeps a hidden profile closed (still logged) until the person agrees', async () => {
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ source: 'DIRECT' }));
    prismaMock.jobSeekerProfile.findMany.mockResolvedValue([seekerProfile('HIDDEN')]);
    const closed = await hiring.openCandidate(recruiter, 'req-1', 'c-1');
    expect(closed.detailsOpen).toBe(false);
    expect(closed.email).toBeNull();
    expect(JSON.stringify(closed)).not.toContain('Mensah');
    prismaMock.hiringCandidate.findFirst.mockResolvedValue(candidate({ stage: 'CONSENTED', consentAt: NOW }));
    expect((await hiring.openCandidate(recruiter, 'req-1', 'c-1')).detailsOpen).toBe(true);
  });

  it('never opens a person in a request assigned to another recruiter', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ assignedRecruiterId: 'rec-2' }));
    await expect(hiring.openCandidate(recruiter, 'req-1', 'c-1')).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.adminActionLog.create).not.toHaveBeenCalled();
  });
});

describe('admin: assignment and recruiter accounts', () => {
  it('assigns a recruiter, and tells the recruiter and the employer', async () => {
    prismaMock.hiringRequest.findUnique.mockResolvedValue(request({ assignedRecruiterId: null }));
    prismaMock.user.findFirst.mockResolvedValue({ id: 'rec-1' });
    prismaMock.staffProfile.findFirst.mockResolvedValue({ displayName: 'Kofi Boateng' });
    await hiring.assignRecruiter(admin, 'req-1', 'rec-1', NOW);
    expect(prismaMock.hiringRequest.update.mock.calls[0][0].data).toEqual({ assignedRecruiterId: 'rec-1', assignedAt: NOW });
    expect(prismaMock.notification.create.mock.calls.map((call: any) => call[0].data.userId).sort()).toEqual(['client-1', 'rec-1']);
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ action: 'HIRING_RECRUITER_ASSIGNED', actorRole: 'ADMIN' });
  });

  it('refuses someone who is not an active recruiter', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.staffProfile.findFirst.mockResolvedValue(null);
    await expect(hiring.assignRecruiter(admin, 'req-1', 'someone', NOW)).rejects.toMatchObject({ code: 'RECRUITER_NOT_FOUND' });
  });

  it('creates a recruiter account with the RECRUITER role and an email to choose a password; refuses a taken email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'rec-9' });
    expect(await hiring.createRecruiter(admin, { email: ' Kofi@JobWahala.com ', displayName: 'Kofi Boateng', title: 'Recruiter' })).toEqual({ userId: 'rec-9' });
    expect(prismaMock.user.create.mock.calls[0][0].data).toMatchObject({ email: 'kofi@jobwahala.com', role: 'RECRUITER', status: 'ACTIVE' });
    expect(prismaMock.staffProfile.create.mock.calls[0][0].data).toMatchObject({ userId: 'rec-9', displayName: 'Kofi Boateng' });
    expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith('kofi@jobwahala.com', prismaMock.passwordResetToken.create.mock.calls[0][0].data.token);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'taken' });
    await expect(hiring.createRecruiter(admin, { email: 'kofi@jobwahala.com', displayName: 'Kofi' })).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('deactivates a recruiter: suspended and signed out everywhere', async () => {
    prismaMock.staffProfile.findUnique.mockResolvedValue({ userId: 'rec-1' });
    await hiring.setRecruiterActive(admin, 'rec-1', false);
    expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({ status: 'SUSPENDED', tokenVersion: { increment: 1 } });
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data.action).toBe('RECRUITER_DEACTIVATED');
  });
});

describe('CV files and the Hiring Service', () => {
  const ref = { category: 'cv', fileName: 'x.pdf', path: '/api/uploads/cv/x.pdf' } as never;

  beforeEach(() => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    prismaMock.seekerCv.findFirst.mockImplementation(async ({ where }: any) => (where.userId || where.user ? null : { userId: 'seeker-1' }));
    prismaMock.teamMember = { findFirst: vi.fn().mockResolvedValue(null) };
  });

  it('lets an employer open the CV of an agreed, shortlisted person in their own request once the shortlist was sent', async () => {
    prismaMock.hiringCandidate.findMany.mockResolvedValue([{ requestId: 'req-1', consentAt: NOW, shortlistedAt: NOW }]);
    prismaMock.hiringRequest.findMany.mockResolvedValue([{ id: 'req-1' }]);
    expect(await canViewUpload({ id: 'client-1', role: 'EMPLOYER' }, ref)).toBe(true);
    expect(prismaMock.hiringRequest.findMany.mock.calls[0][0].where).toMatchObject({ clientId: 'client-1', sentAt: { not: null } });

    prismaMock.hiringCandidate.findMany.mockResolvedValue([{ requestId: 'req-1', consentAt: NOW, shortlistedAt: null }]);
    expect(await canViewUpload({ id: 'client-1', role: 'EMPLOYER' }, ref)).toBe(false);
    prismaMock.hiringCandidate.findMany.mockResolvedValue([{ requestId: 'req-1', consentAt: null, shortlistedAt: NOW }]);
    expect(await canViewUpload({ id: 'client-1', role: 'EMPLOYER' }, ref)).toBe(false);
    prismaMock.hiringCandidate.findMany.mockResolvedValue([{ requestId: 'req-1', consentAt: NOW, shortlistedAt: NOW }]);
    prismaMock.hiringRequest.findMany.mockResolvedValue([]);
    expect(await canViewUpload({ id: 'client-2', role: 'EMPLOYER' }, ref)).toBe(false);
  });

  it('lets a recruiter open a CV only in their own request, and only if the person agreed or is visible', async () => {
    prismaMock.hiringCandidate.findMany.mockResolvedValue([{ requestId: 'req-1', consentAt: null, shortlistedAt: null }]);
    prismaMock.hiringRequest.findMany.mockResolvedValue([{ id: 'req-1' }]);
    prismaMock.jobSeekerProfile.findFirst.mockResolvedValue(null);
    expect(await canViewUpload({ id: 'rec-1', role: 'RECRUITER' }, ref)).toBe(false);
    prismaMock.jobSeekerProfile.findFirst.mockResolvedValue({ id: 'p' });
    expect(await canViewUpload({ id: 'rec-1', role: 'RECRUITER' }, ref)).toBe(true);
    prismaMock.jobSeekerProfile.findFirst.mockResolvedValue(null);
    prismaMock.hiringCandidate.findMany.mockResolvedValue([{ requestId: 'req-1', consentAt: NOW, shortlistedAt: null }]);
    expect(await canViewUpload({ id: 'rec-1', role: 'RECRUITER' }, ref)).toBe(true);
    prismaMock.hiringRequest.findMany.mockResolvedValue([]);
    expect(await canViewUpload({ id: 'rec-2', role: 'RECRUITER' }, ref)).toBe(false);
    expect(prismaMock.hiringRequest.findMany.mock.calls.at(-1)![0].where).toMatchObject({ assignedRecruiterId: 'rec-2' });
  });
});
