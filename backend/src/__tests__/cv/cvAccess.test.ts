import type { AddressInfo } from 'net';
import type { Server } from 'http';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  application: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  seekerCv: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  job: { findFirst: vi.fn() },
  verificationRequest: { findFirst: vi.fn() },
}));

vi.mock('../../config/prisma', () => ({ default: prismaMock }));

import env from '../../config/env';
import { applyForJob } from '../../controllers/jobController';
import { clearBuilderCv, clearUploadedCv, getMyCvFiles, setBuilderCv, setUploadedCv } from '../../controllers/cvFileController';
import { serveProtectedUpload } from '../../controllers/uploadController';
import { canViewUpload } from '../../services/fileAccessService';
import { buildSignedPath, parseUploadRef, uploaderTag } from '../../utils/fileAccess';
import { applyForJobSchema } from '../../validation/jobSchemas';
import { setCvFileSchema } from '../../validation/cvFileSchemas';

const secret = env.jwtSecret;
/** A stored CV file name as the upload code makes it, tagged with who uploaded it. */
const cvFileFor = (userId: string, ext = 'pdf') => `1730000000000-u${uploaderTag(userId, secret)}-3f2a9c1e-my-cv.${ext}`;
const urlFor = (userId: string, ext = 'pdf') => `/api/uploads/cv/${cvFileFor(userId, ext)}`;

const call = async (handler: (req: never, res: Response) => unknown, req: Record<string, unknown>) => {
  let status = 200;
  let payload: any;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as Response;
  await handler({ body: {}, params: {}, query: {}, user: { id: 'seeker-1', role: 'SEEKER' }, ...req } as never, res);
  return { status, body: payload };
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.application.findFirst.mockResolvedValue(null);
  prismaMock.seekerCv.findFirst.mockResolvedValue(null);
});

describe('who can open a CV', () => {
  const ref = (userId: string) => parseUploadRef(urlFor(userId))!;

  it('the seeker who uploaded it can', async () => {
    expect(await canViewUpload({ id: 'seeker-1', role: 'SEEKER' }, ref('seeker-1'))).toBe(true);
  });

  it('an employer can, if the applicant sent it with an application to one of THEIR jobs', async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: 'app-1' });

    expect(await canViewUpload({ id: 'emp-1', role: 'EMPLOYER' }, ref('seeker-1'))).toBe(true);

    const where = prismaMock.application.findFirst.mock.calls[0][0].where;
    expect(where.job).toEqual({ employerId: 'emp-1' });
    expect(where.cvFileUrl).toEqual({ endsWith: urlFor('seeker-1') });
  });

  it('an employer the applicant never applied to cannot', async () => {
    expect(await canViewUpload({ id: 'emp-2', role: 'EMPLOYER' }, ref('seeker-1'))).toBe(false);
  });

  it('an employer cannot open a CV the applicant chose not to send', async () => {
    // The applicant applied (to emp-1) but sent no CV: no application points at the file.
    expect(await canViewUpload({ id: 'emp-1', role: 'EMPLOYER' }, ref('seeker-1'))).toBe(false);
  });

  it('another job seeker cannot', async () => {
    expect(await canViewUpload({ id: 'seeker-2', role: 'SEEKER' }, ref('seeker-1'))).toBe(false);
  });

  it('a seeker can open their own current CVs, even if uploaded in an earlier session', async () => {
    prismaMock.seekerCv.findFirst.mockResolvedValue({ id: 'cv-1' });

    expect(await canViewUpload({ id: 'seeker-1', role: 'SEEKER' }, parseUploadRef('/api/uploads/cv/1-abc-other.pdf')!)).toBe(true);
    expect(prismaMock.seekerCv.findFirst.mock.calls[0][0].where.userId).toBe('seeker-1');
  });

  it('administrators can, to review reports', async () => {
    expect(await canViewUpload({ id: 'admin-1', role: 'ADMIN' }, ref('seeker-1'))).toBe(true);
  });

  it('a signed link is only given to someone allowed', () => {
    const parsed = parseUploadRef('http://localhost:5000/api/uploads/cv/../../etc/passwd');
    expect(parsed).toBeNull();
    expect(parseUploadRef('/api/uploads/cv/a/b.pdf')).toBeNull();
  });
});

describe('downloading a CV', () => {
  const serve = (category: string, file: string, signed = false) => {
    let options: any;
    const query: Record<string, string> = {};
    if (signed) {
      const link = buildSignedPath(parseUploadRef('/api/uploads/' + category + '/' + file)!, secret);
      const params = new URL(link, 'http://x').searchParams;
      query.exp = params.get('exp')!;
      query.sig = params.get('sig')!;
    }
    const res = {
      status: () => res,
      json: () => res,
      sendFile: (_path: string, opts: unknown) => {
        options = opts;
      },
      headersSent: false,
    } as unknown as Response;
    serveProtectedUpload({ params: { category, file }, query } as unknown as Request, res);
    return options;
  };

  it('without a valid signature there is no file', () => {
    expect(serve('cv', cvFileFor('seeker-1'))).toBeUndefined();
  });

  it('with a valid signature a CV is sent as a download, never shown in the page, and never cached', () => {
    const options = serve('cv', cvFileFor('seeker-1'), true);

    expect(options.headers['Content-Disposition']).toBe('attachment');
    expect(options.headers['Cache-Control']).toBe('private, no-store');
    expect(options.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(options.dotfiles).toBe('deny');
  });

  it('other private files are unchanged: no forced download', () => {
    const options = serve('verification', cvFileFor('seeker-1').replace('.pdf', '.png'), true);

    expect(options.headers).not.toHaveProperty('Content-Disposition');
  });
});

describe('saving a CV to the profile', () => {
  const save = (handler: typeof setUploadedCv, body: Record<string, unknown>, userId = 'seeker-1') =>
    call(handler as never, { user: { id: userId, role: 'SEEKER' }, body });

  it('keeps a CV the member uploaded, under its clean site address', async () => {
    const result = await save(setUploadedCv, { url: `https://jobwahala.com${urlFor('seeker-1')}`, fileName: 'C:\\fakepath\\My CV (final).pdf' });

    expect(result.status).toBe(200);
    expect(prismaMock.seekerCv.upsert).toHaveBeenCalledTimes(1);
    const args = prismaMock.seekerCv.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId: 'seeker-1' });
    expect(args.update).toMatchObject({ uploadedUrl: urlFor('seeker-1'), uploadedFileName: 'My CV (final).pdf' });
    expect(args.update.uploadedAt).toBeInstanceOf(Date);
  });

  it('keeps the CV-builder version in its own slot', async () => {
    await save(setBuilderCv, { url: urlFor('seeker-1', 'docx'), fileName: 'cv.docx' });

    const data = prismaMock.seekerCv.upsert.mock.calls[0][0].update;
    expect(data).toMatchObject({ builderUrl: urlFor('seeker-1', 'docx'), builderFileName: 'cv.docx' });
    expect(data).not.toHaveProperty('uploadedUrl');
  });

  it.each([
    ['a pasted web link', 'https://evil.example/cv.pdf'],
    ['someone else\'s file', urlFor('seeker-2')],
    ['a file from another kind of upload', `/api/uploads/verification/${cvFileFor('seeker-1')}`],
    ['a path that climbs out', '/api/uploads/cv/../../.env'],
    ['nothing useful', 'cv.pdf'],
  ])('refuses %s', async (_name, url) => {
    const result = await save(setUploadedCv, { url, fileName: 'cv.pdf' });

    expect(result.status).toBe(400);
    expect(prismaMock.seekerCv.upsert).not.toHaveBeenCalled();
  });

  it('removes one CV without touching the other, and only for the member', async () => {
    await call(clearUploadedCv as never, {});
    expect(prismaMock.seekerCv.updateMany.mock.calls[0][0]).toEqual({
      where: { userId: 'seeker-1' },
      data: { uploadedUrl: null, uploadedFileName: null, uploadedAt: null },
    });

    await call(clearBuilderCv as never, {});
    expect(prismaMock.seekerCv.updateMany.mock.calls[1][0].data).toEqual({ builderUrl: null, builderFileName: null, builderSavedAt: null });
  });

  it('lists the two CVs by name and date', async () => {
    prismaMock.seekerCv.findUnique.mockResolvedValue({
      uploadedUrl: urlFor('seeker-1'),
      uploadedFileName: 'my-cv.pdf',
      uploadedAt: new Date('2026-11-01'),
      builderUrl: null,
      builderFileName: null,
      builderSavedAt: null,
    });

    const result = await call(getMyCvFiles as never, {});

    expect(result.body.uploaded).toMatchObject({ fileName: 'my-cv.pdf', url: urlFor('seeker-1') });
    expect(result.body.builder).toBeNull();
  });

  it('shows nothing when there are no CVs', async () => {
    prismaMock.seekerCv.findUnique.mockResolvedValue(null);

    const result = await call(getMyCvFiles as never, {});

    expect(result.body).toMatchObject({ uploaded: null, builder: null });
  });

  it('validates the request', () => {
    expect(setCvFileSchema.safeParse({ body: { url: '/api/uploads/cv/x.pdf', fileName: 'x.pdf' } }).success).toBe(true);
    expect(setCvFileSchema.safeParse({ body: { url: '', fileName: 'x.pdf' } }).success).toBe(false);
    expect(setCvFileSchema.safeParse({ body: { url: 'x', fileName: 'x', extra: 1 } }).success).toBe(false);
  });
});

describe('choosing which CV to send when applying', () => {
  const stored = {
    uploadedUrl: urlFor('seeker-1'),
    uploadedFileName: 'my-cv.pdf',
    builderUrl: urlFor('seeker-1', 'docx'),
    builderFileName: 'builder-cv.docx',
  };

  beforeEach(() => {
    prismaMock.job.findFirst.mockResolvedValue({ id: 'job-1' });
    prismaMock.application.findUnique.mockResolvedValue(null);
    prismaMock.application.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'app-1', ...data }));
    prismaMock.seekerCv.findUnique.mockResolvedValue(stored);
  });

  const apply = (body: Record<string, unknown>) => call(applyForJob as never, { params: { id: 'job-1' }, body });

  it('sends the uploaded CV, copying its address onto the application', async () => {
    const result = await apply({ coverLetter: 'Hello', cv: 'UPLOADED' });

    expect(result.status).toBe(201);
    expect(prismaMock.application.create.mock.calls[0][0].data).toMatchObject({
      coverLetter: 'Hello',
      cvSource: 'UPLOADED',
      cvFileUrl: stored.uploadedUrl,
      cvFileName: 'my-cv.pdf',
    });
  });

  it('sends the CV-builder version instead', async () => {
    await apply({ cv: 'BUILDER' });

    expect(prismaMock.application.create.mock.calls[0][0].data).toMatchObject({
      cvSource: 'BUILDER',
      cvFileUrl: stored.builderUrl,
      cvFileName: 'builder-cv.docx',
    });
  });

  it('can send no CV, or say nothing, and then no file is attached', async () => {
    await apply({ cv: 'NONE' });
    await apply({});

    for (const call of prismaMock.application.create.mock.calls) {
      expect(call[0].data).not.toHaveProperty('cvFileUrl');
      expect(call[0].data).not.toHaveProperty('cvSource');
    }
    expect(prismaMock.seekerCv.findUnique).not.toHaveBeenCalled();
  });

  it('refuses to send a CV the member does not have, and does not apply', async () => {
    prismaMock.seekerCv.findUnique.mockResolvedValue({ ...stored, uploadedUrl: null, uploadedFileName: null });

    const result = await apply({ cv: 'UPLOADED' });

    expect(result.status).toBe(400);
    expect(result.body.message).toMatch(/not uploaded a CV/);
    expect(prismaMock.application.create).not.toHaveBeenCalled();
  });

  it('refuses the CV-builder version when none is saved', async () => {
    prismaMock.seekerCv.findUnique.mockResolvedValue(null);

    const result = await apply({ cv: 'BUILDER' });

    expect(result.status).toBe(400);
    expect(result.body.message).toMatch(/CV builder/);
  });

  it('only ever uses the applicant\'s own CV record', async () => {
    await apply({ cv: 'UPLOADED' });

    expect(prismaMock.seekerCv.findUnique.mock.calls[0][0]).toEqual({ where: { userId: 'seeker-1' } });
  });

  it('the request only allows the three choices', () => {
    for (const cv of ['UPLOADED', 'BUILDER', 'NONE', undefined]) {
      expect(applyForJobSchema.safeParse({ body: { cv } }).success).toBe(true);
    }
    expect(applyForJobSchema.safeParse({ body: { cv: 'ANYTHING' } }).success).toBe(false);
    expect(applyForJobSchema.safeParse({ body: { cvFileUrl: 'https://evil.example/x.pdf' } }).success).toBe(false);
  });
});

describe('CV routes on the real app', () => {
  let server: Server;
  let base = '';

  beforeAll(async () => {
    const { default: app } = await import('../../app');
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server?.close();
  });

  it('are for signed-in members only', async () => {
    expect((await fetch(`${base}/api/users/cv`)).status).toBe(401);
    expect((await fetch(`${base}/api/users/cv/uploaded`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(401);
    expect((await fetch(`${base}/api/users/cv/builder`, { method: 'DELETE' })).status).toBe(401);
  });

  it('a CV file cannot be fetched without a signed link', async () => {
    const response = await fetch(`${base}${urlFor('seeker-1')}`);

    expect(response.status).toBe(403);
  });
});
