import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const mock: Record<string, any> = {
    course: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
    courseSkill: { deleteMany: vi.fn(), createMany: vi.fn() },
    courseEvent: { create: vi.fn(), groupBy: vi.fn() },
    courseEnquiry: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    learnerCourse: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
    employerProfile: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    job: { findFirst: vi.fn() },
    adminActionLog: { create: vi.fn() },
    notification: { create: vi.fn() },
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});

vi.mock('../../config/prisma', () => ({ default: prismaMock }));
vi.mock('../../services/realtime', () => ({ deferRealtimeEvent: vi.fn(), emitRealtimeEvent: vi.fn() }));

import env from '../../config/env';
import { SKILLS, isSkillSlug, skillsInText } from '../../content/skills';
import { getSitemap } from '../../controllers/shareController';
import { reviewCourse, reviewProvider, setFeatured } from '../../controllers/adminCourseController';
import { coursesForJob, createEnquiry, filterCourses, getCourse, getCourseLanding, getProviderPage, listCourses, trackCourseEvent } from '../../controllers/courseController';
import { addLearnerCourse, requestConfirmation } from '../../controllers/learnerCourseController';
import {
  createCourse,
  decideCompletion,
  enableProvider,
  listMyCourses,
  pauseCourse,
  removeCourse,
  updateCourse,
} from '../../controllers/providerController';
import { resetCourseCatalogCache } from '../../services/courseCatalog';
import {
  MIN_COURSES_FOR_PAGE,
  buildCourseJsonLd,
  buildCourseLanding,
  coursePagePaths,
  coursesForSkills,
  courseSlug,
  isFeaturedNow,
  jobSkills,
  publicCourseWhere,
  skillFromCoursesSlug,
  visitorHash,
  type PublicCourse,
} from '../../utils/courses';
import { renderCourseDetailPage, renderCourseLandingPage } from '../../utils/courseRender';
import { courseBodySchema, enquirySchema, learnerCourseSchema, providerReviewSchema } from '../../validation/courseSchemas';

const respond = () => {
  const state: { status: number; body: any } = { status: 200, body: undefined };
  const res = {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(value: unknown) {
      state.body = value;
      return this;
    },
    set() {
      return this;
    },
  } as unknown as Response;
  return { res, state };
};

const call = async (handler: (req: never, res: Response) => unknown, req: Record<string, unknown>) => {
  const { res, state } = respond();
  await handler({ body: {}, params: {}, query: {}, headers: {}, get: () => 'Mozilla/5.0', header: () => undefined, ip: '1.2.3.4', ...req } as never, res);
  return state;
};

const asUser = (id: string, role = 'EMPLOYER') => ({ user: { id, role } });

let counter = 0;
const publicCourse = (overrides: Partial<PublicCourse> = {}): PublicCourse => {
  counter += 1;
  return {
    id: `c${counter}`,
    slug: `course-${counter}`,
    title: `Course ${counter}`,
    summary: 'Learn a useful skill.',
    category: 'finance-accounting',
    level: 'BEGINNER',
    isFree: false,
    priceGhs: 500,
    durationWeeks: 6,
    format: 'ONLINE',
    location: null,
    startDates: [],
    rollingStart: true,
    certificateOffered: true,
    enrolUrl: 'https://provider.example/enrol',
    enquiryEnabled: true,
    skills: ['excel'],
    featured: false,
    createdAt: new Date(2026, 10, (counter % 27) + 1),
    provider: { id: 'p1', name: 'Accra Training Centre', logoUrl: null, isVerified: false },
    ...overrides,
  };
};
const many = (n: number, overrides: Partial<PublicCourse> = {}) => Array.from({ length: n }, () => publicCourse(overrides));

const validBody = {
  title: 'Excel for accountants',
  summary: 'Spreadsheets for everyday accounting work.',
  description: 'Six weeks of practical Excel for accounts clerks and accountants.',
  category: 'finance-accounting',
  level: 'BEGINNER',
  isFree: false,
  priceGhs: 450,
  durationWeeks: 6,
  format: 'ONLINE',
  skills: ['excel', 'accounting'],
  enrolUrl: 'https://provider.example/enrol',
  enquiryEnabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  resetCourseCatalogCache();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock));
  prismaMock.notification.create.mockResolvedValue({ id: 'n' });
  prismaMock.adminActionLog.create.mockResolvedValue({});
  prismaMock.user.findUnique.mockResolvedValue(null);
});

// ------------------------------------------------------------------ skills

describe('the shared skills list', () => {
  it('has unique slugs and the website copy is identical', () => {
    expect(new Set(SKILLS.map((skill) => skill.slug)).size).toBe(SKILLS.length);
    const root = path.resolve(__dirname, '../../../..');
    const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    expect(read('backend/src/content/skills.ts')).toBe(read('src/content/skills.ts'));
  });

  it('finds skills in text by whole word, in any case', () => {
    expect(skillsInText('We need someone who knows EXCEL and bookkeeping')).toEqual(expect.arrayContaining(['excel', 'accounting']));
    expect(skillsInText('Python developer, SQL a plus')).toEqual(expect.arrayContaining(['python', 'sql']));
    expect(skillsInText('Excellent communication')).not.toContain('excel');
    expect(skillsInText('')).toEqual([]);
  });

  it('knows what a job asks for from its title, field and description', () => {
    expect(jobSkills({ title: 'Accounts Clerk', category: 'Finance', description: 'Daily bookkeeping in Excel and QuickBooks.' })).toEqual(expect.arrayContaining(['accounting', 'excel', 'finance']));
    expect(isSkillSlug('excel')).toBe(true);
    expect(isSkillSlug('juggling')).toBe(false);
  });
});

// ------------------------------------------------------------ what is public

describe('what the public may see', () => {
  it('needs an active, approved course from an approved provider', () => {
    expect(publicCourseWhere()).toEqual({
      status: 'ACTIVE',
      reviewStatus: 'APPROVED',
      provider: { status: 'ACTIVE', employerProfile: { is: { providerStatus: 'APPROVED' } } },
    });
  });

  it('a featured course is featured only inside its period', () => {
    const now = new Date('2026-11-10T00:00:00Z');
    expect(isFeaturedNow({ featuredFrom: new Date('2026-11-01T00:00:00Z'), featuredUntil: new Date('2026-11-20T00:00:00Z') }, now)).toBe(true);
    expect(isFeaturedNow({ featuredFrom: new Date('2026-11-01T00:00:00Z'), featuredUntil: new Date('2026-11-05T00:00:00Z') }, now)).toBe(false);
    expect(isFeaturedNow({ featuredFrom: new Date('2026-11-15T00:00:00Z'), featuredUntil: new Date('2026-11-20T00:00:00Z') }, now)).toBe(false);
    expect(isFeaturedNow({}, now)).toBe(false);
  });

  it('gives each course a clean, unique address', () => {
    const a = courseSlug('Excel for Accountants!');
    expect(a).toMatch(/^excel-for-accountants-[0-9a-f]{6}$/);
    expect(courseSlug('Excel for Accountants!')).not.toBe(a);
  });

  it('lists featured courses first, then newest', async () => {
    const rows = [
      { ...rowOf(publicCourse({ title: 'Plain, newest' })), createdAt: new Date('2026-11-20') },
      { ...rowOf(publicCourse({ title: 'Featured, older' })), createdAt: new Date('2026-11-01'), featuredFrom: new Date('2026-10-01'), featuredUntil: new Date(Date.now() + 86_400_000) },
    ];
    prismaMock.course.findMany.mockResolvedValue(rows);

    const result = await call(listCourses as never, { query: {} });

    expect(result.body.courses.map((course: PublicCourse) => course.title)).toEqual(['Featured, older', 'Plain, newest']);
    expect(result.body.courses[0].featured).toBe(true);
  });

  it('shows the provider only as a name, a logo and verified or not', async () => {
    prismaMock.course.findMany.mockResolvedValue([rowOf(publicCourse(), { verified: true })]);

    const result = await call(listCourses as never, { query: {} });

    expect(result.body.courses[0].provider).toEqual({ id: 'p1', name: 'Accra Training Centre', logoUrl: null, isVerified: true });
    expect(JSON.stringify(result.body)).not.toMatch(/email|password/i);
  });
});

function rowOf(course: PublicCourse, options: { verified?: boolean } = {}) {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    category: course.category,
    level: course.level,
    isFree: course.isFree,
    priceGhs: course.priceGhs,
    durationWeeks: course.durationWeeks,
    format: course.format,
    location: course.location,
    startDatesJson: JSON.stringify(course.startDates),
    rollingStart: course.rollingStart,
    certificateOffered: course.certificateOffered,
    enrolUrl: course.enrolUrl,
    enquiryEnabled: course.enquiryEnabled,
    featuredFrom: null as Date | null,
    featuredUntil: null as Date | null,
    createdAt: new Date(course.createdAt),
    skills: course.skills.map((skill) => ({ skill })),
    provider: {
      id: course.provider.id,
      employerProfile: { companyName: course.provider.name, logoUrl: null },
      verificationRequests: options.verified ? [{ status: 'APPROVED', type: 'BUSINESS' }] : [],
    },
  };
}

// ------------------------------------------------------------- searching

describe('searching courses', () => {
  const catalogue = [
    publicCourse({ title: 'Excel basics', skills: ['excel'], category: 'office-skills', isFree: true, priceGhs: null, format: 'ONLINE' }),
    publicCourse({ title: 'Bookkeeping', skills: ['accounting'], category: 'finance-accounting', priceGhs: 800, format: 'IN_PERSON', location: 'Kumasi', level: 'INTERMEDIATE' }),
    publicCourse({ title: 'Advanced finance', skills: ['finance'], category: 'finance-accounting', priceGhs: 2500, format: 'HYBRID', location: 'Accra', level: 'ADVANCED', provider: { id: 'p2', name: 'Verified Academy', logoUrl: null, isVerified: true } }),
  ];
  const titles = (query: Record<string, string>) => filterCourses(catalogue, query).map((course) => course.title);

  it('by words in the title, summary, provider or skill', () => {
    expect(titles({ q: 'bookkeep' })).toEqual(['Bookkeeping']);
    expect(titles({ q: 'verified academy' })).toEqual(['Advanced finance']);
    expect(titles({ q: 'microsoft excel' })).toEqual(['Excel basics']);
  });

  it('by category, skill and level (a course for all levels fits any)', () => {
    expect(titles({ category: 'finance-accounting' })).toEqual(['Bookkeeping', 'Advanced finance']);
    expect(titles({ skill: 'excel' })).toEqual(['Excel basics']);
    expect(titles({ level: 'ADVANCED' })).toEqual(['Advanced finance']);
  });

  it('by price: free only, or up to an amount (free courses always fit)', () => {
    expect(titles({ free: '1' })).toEqual(['Excel basics']);
    expect(titles({ maxPrice: '1000' })).toEqual(['Excel basics', 'Bookkeeping']);
  });

  it('by format and location (online courses fit any place)', () => {
    expect(titles({ format: 'ONLINE' })).toEqual(['Excel basics', 'Advanced finance']);
    expect(titles({ location: 'kumasi' })).toEqual(['Excel basics', 'Bookkeeping', 'Advanced finance']);
    expect(titles({ location: 'tamale' })).toEqual(['Excel basics', 'Advanced finance']);
  });

  it('verified providers only', () => {
    expect(titles({ verified: '1' })).toEqual(['Advanced finance']);
  });
});

// ------------------------------------------------------------------ jobs

describe('"Build skills for this job"', () => {
  const wanted = ['excel', 'accounting'];

  it('shows at most 3, the ones teaching the most of the job\'s skills first', () => {
    const courses = [
      publicCourse({ title: 'One skill', skills: ['excel'] }),
      publicCourse({ title: 'Both skills', skills: ['excel', 'accounting'] }),
      publicCourse({ title: 'Unrelated', skills: ['photography'] }),
      publicCourse({ title: 'Other one', skills: ['accounting'] }),
      publicCourse({ title: 'Another one', skills: ['accounting'] }),
    ];

    const picked = coursesForSkills(courses, wanted, 3);

    expect(picked).toHaveLength(3);
    expect(picked[0].title).toBe('Both skills');
    expect(picked.map((course) => course.title)).not.toContain('Unrelated');
  });

  it('on equal fit, featured then verified providers come first', () => {
    const picked = coursesForSkills(
      [
        publicCourse({ title: 'Plain', skills: ['excel'] }),
        publicCourse({ title: 'Verified', skills: ['excel'], provider: { id: 'p2', name: 'V', logoUrl: null, isVerified: true } }),
        publicCourse({ title: 'Featured', skills: ['excel'], featured: true }),
      ],
      wanted,
    );

    expect(picked.map((course) => course.title)).toEqual(['Featured', 'Verified', 'Plain']);
  });

  it('shows nothing when the job names no skill we know', () => {
    expect(coursesForSkills([publicCourse()], [])).toEqual([]);
  });

  it('is served for an open job, using the skills in its text', async () => {
    prismaMock.job.findFirst.mockResolvedValue({ title: 'Accounts Clerk', category: 'Finance', description: 'Daily bookkeeping in Excel.' });
    prismaMock.course.findMany.mockResolvedValue([rowOf(publicCourse({ skills: ['excel'] })), rowOf(publicCourse({ skills: ['photography'] }))]);

    const result = await call(coursesForJob as never, { params: { jobId: 'job-1' } });

    expect(result.body.courses).toHaveLength(1);
    expect(result.body.skills).toEqual(['Microsoft Excel']);
    expect(prismaMock.job.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'job-1', status: 'ACTIVE' });
  });

  it('is a 404 for a job that is closed or missing', async () => {
    prismaMock.job.findFirst.mockResolvedValue(null);

    expect((await call(coursesForJob as never, { params: { jobId: 'gone' } })).status).toBe(404);
  });
});

// ------------------------------------------------------------ validation

describe('what a provider can list', () => {
  const parse = (overrides: Record<string, unknown>) => courseBodySchema.safeParse({ ...validBody, ...overrides });

  it('accepts a complete listing', () => {
    expect(parse({}).success).toBe(true);
  });

  it('a paid course needs a price; a free one does not', () => {
    expect(parse({ priceGhs: null }).success).toBe(false);
    expect(parse({ isFree: true, priceGhs: null }).success).toBe(true);
  });

  it('an in-person or hybrid course needs a place', () => {
    expect(parse({ format: 'IN_PERSON' }).success).toBe(false);
    expect(parse({ format: 'HYBRID', location: 'Accra' }).success).toBe(true);
  });

  it('skills must come from the shared list, one to eight, each once', () => {
    expect(parse({ skills: [] }).success).toBe(false);
    expect(parse({ skills: ['juggling'] }).success).toBe(false);
    expect(parse({ skills: ['excel', 'excel'] }).success).toBe(false);
    expect(parse({ skills: SKILLS.slice(0, 9).map((skill) => skill.slug) }).success).toBe(false);
  });

  it('needs a way to enrol: a link or enquiries', () => {
    expect(parse({ enrolUrl: null, enquiryEnabled: false }).success).toBe(false);
    expect(parse({ enrolUrl: null, enquiryEnabled: true }).success).toBe(true);
  });

  it('only web addresses are accepted as the enrolment link', () => {
    expect(parse({ enrolUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(parse({ enrolUrl: 'ftp://files.example' }).success).toBe(false);
    expect(parse({ enrolUrl: 'https://provider.example/enrol' }).success).toBe(true);
  });

  it('checks category, level, format, dates and lengths', () => {
    expect(parse({ category: 'cooking-with-fire' }).success).toBe(false);
    expect(parse({ level: 'EXPERT' }).success).toBe(false);
    expect(parse({ format: 'TELEPATHY' }).success).toBe(false);
    expect(parse({ startDates: ['next week'] }).success).toBe(false);
    expect(parse({ startDates: ['2026-12-01'] }).success).toBe(true);
    expect(parse({ title: 'Hi' }).success).toBe(false);
    expect(parse({ somethingElse: true }).success).toBe(false);
  });
});

// -------------------------------------------------------------- providers

describe('a training provider', () => {
  const owner = asUser('prov-1');

  beforeEach(() => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ isTrainingProvider: true, providerStatus: 'APPROVED', companyName: 'Accra Training Centre' });
    prismaMock.course.count.mockResolvedValue(0);
    prismaMock.course.create.mockImplementation(async ({ data }: any) => ({ id: 'new-course', slug: data.slug, reviewStatus: 'PENDING' }));
  });

  it('can switch on "We are a training provider", which goes to the admin for approval', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ providerStatus: 'NONE' });
    prismaMock.employerProfile.update.mockResolvedValue({ isTrainingProvider: true, providerStatus: 'PENDING' });

    const result = await call(enableProvider as never, owner);

    expect(prismaMock.employerProfile.update.mock.calls[0][0].data).toEqual({ isTrainingProvider: true, providerStatus: 'PENDING' });
    expect(result.body.provider.status).toBe('PENDING');
  });

  it('one already approved stays approved', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ providerStatus: 'APPROVED' });
    prismaMock.employerProfile.update.mockResolvedValue({ isTrainingProvider: true, providerStatus: 'APPROVED' });

    await call(enableProvider as never, owner);

    expect(prismaMock.employerProfile.update.mock.calls[0][0].data.providerStatus).toBe('APPROVED');
  });

  it('creates a listing that waits for admin approval, with its skills and a clean address', async () => {
    const result = await call(createCourse as never, { ...owner, body: validBody });

    expect(result.status).toBe(201);
    const data = prismaMock.course.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ providerId: 'prov-1', title: 'Excel for accountants', priceGhs: 450, isFree: false, format: 'ONLINE' });
    expect(data.slug).toMatch(/^excel-for-accountants-/);
    expect(data.skills.create).toEqual([{ skill: 'excel' }, { skill: 'accounting' }]);
    expect(data).not.toHaveProperty('reviewStatus');
  });

  it('a free course saves no price, and start dates are kept sorted', async () => {
    await call(createCourse as never, { ...owner, body: { ...validBody, isFree: true, priceGhs: 999, startDates: ['2027-02-01', '2027-01-01', '2027-01-01'] } });

    const data = prismaMock.course.create.mock.calls[0][0].data;
    expect(data.priceGhs).toBeNull();
    expect(JSON.parse(data.startDatesJson)).toEqual(['2027-01-01', '2027-02-01']);
  });

  it('cannot list courses without having switched provider on', async () => {
    prismaMock.employerProfile.findUnique.mockResolvedValue({ isTrainingProvider: false, providerStatus: 'NONE' });

    const result = await call(createCourse as never, { ...owner, body: validBody });

    expect(result.status).toBe(403);
    expect(prismaMock.course.create).not.toHaveBeenCalled();
  });

  describe('changing a listing', () => {
    const existing = {
      id: 'c1',
      providerId: 'prov-1',
      status: 'ACTIVE',
      reviewStatus: 'APPROVED',
      title: 'Excel for accountants',
      summary: 'Spreadsheets for everyday accounting work.',
      description: 'Six weeks of practical Excel for accounts clerks and accountants.',
      category: 'finance-accounting',
      isFree: false,
      priceGhs: 450,
      enrolUrl: 'https://provider.example/enrol',
      skills: [{ skill: 'excel' }, { skill: 'accounting' }],
    };
    const edit = (body: Record<string, unknown>, id = 'prov-1') => call(updateCourse as never, { ...asUser(id), params: { id: 'c1' }, body: { ...validBody, ...body } });

    beforeEach(() => prismaMock.course.findUnique.mockResolvedValue(existing));

    it('a small change (duration) keeps it live', async () => {
      const result = await edit({ durationWeeks: 8 });

      expect(result.body.backInReview).toBe(false);
      expect(prismaMock.course.update.mock.calls[0][0].data).not.toHaveProperty('reviewStatus');
    });

    it('changing what learners are promised (price, title, description, link) sends it back for approval', async () => {
      for (const change of [{ priceGhs: 900 }, { title: 'Excel for everyone' }, { description: 'A completely different course description here.' }, { enrolUrl: 'https://elsewhere.example' }]) {
        prismaMock.course.update.mockClear();
        const result = await edit(change);
        expect(result.body.backInReview, JSON.stringify(change)).toBe(true);
        expect(prismaMock.course.update.mock.calls[0][0].data.reviewStatus).toBe('PENDING');
      }
    });

    it('replaces the skills only when they changed', async () => {
      await edit({});
      expect(prismaMock.courseSkill.deleteMany).not.toHaveBeenCalled();

      await edit({ skills: ['excel', 'finance'] });
      expect(prismaMock.courseSkill.deleteMany).toHaveBeenCalled();
      expect(prismaMock.courseSkill.createMany.mock.calls[0][0].data).toEqual([
        { courseId: 'c1', skill: 'excel' },
        { courseId: 'c1', skill: 'finance' },
      ]);
    });

    it('only the owner can change it', async () => {
      expect((await edit({}, 'someone-else')).status).toBe(404);
      expect(prismaMock.course.update).not.toHaveBeenCalled();
    });

    it('a listing JobWahala removed cannot be edited back to life', async () => {
      prismaMock.course.findUnique.mockResolvedValue({ ...existing, reviewStatus: 'REMOVED' });

      expect((await edit({})).status).toBe(409);
    });

    it('can be paused and removed by its owner, and not by anyone else', async () => {
      await call(pauseCourse as never, { ...owner, params: { id: 'c1' } });
      expect(prismaMock.course.update.mock.calls[0][0].data).toEqual({ status: 'PAUSED' });

      await call(removeCourse as never, { ...owner, params: { id: 'c1' } });
      expect(prismaMock.course.update.mock.calls[1][0].data).toEqual({ status: 'REMOVED' });

      prismaMock.course.update.mockClear();
      expect((await call(pauseCourse as never, { ...asUser('other'), params: { id: 'c1' } })).status).toBe(404);
      expect(prismaMock.course.update).not.toHaveBeenCalled();
    });
  });

  it('sees views, clicks and enquiries for each course, all time and the last 30 days', async () => {
    prismaMock.course.findMany.mockResolvedValue([{ ...rowOf(publicCourse({ id: 'c1' })), status: 'ACTIVE', reviewStatus: 'APPROVED', reviewNote: null, description: 'x', featuredUntil: null, startDatesJson: '[]', skills: [{ skill: 'excel' }] }]);
    prismaMock.courseEvent.groupBy.mockImplementation(async ({ where }: any) =>
      where.createdAt
        ? [{ courseId: 'c1', type: 'VIEW', _count: { _all: 10 } }]
        : [
            { courseId: 'c1', type: 'VIEW', _count: { _all: 120 } },
            { courseId: 'c1', type: 'CLICK', _count: { _all: 30 } },
            { courseId: 'c1', type: 'ENQUIRY', _count: { _all: 4 } },
          ],
    );

    const result = await call(listMyCourses as never, owner);

    expect(result.body.courses[0].stats).toEqual({
      allTime: { views: 120, clicks: 30, enquiries: 4 },
      last30Days: { views: 10, clicks: 0, enquiries: 0 },
    });
    expect(prismaMock.course.findMany.mock.calls[0][0].where.providerId).toBe('prov-1');
  });
});

// ------------------------------------------------------------ tracking

describe('counting views, clicks and enquiries', () => {
  beforeEach(() => {
    prismaMock.course.findFirst.mockResolvedValue({ id: 'c1', providerId: 'prov-1' });
    prismaMock.courseEvent.create.mockResolvedValue({});
  });
  const track = (type: 'VIEW' | 'CLICK', extra: Record<string, unknown> = {}) => call(trackCourseEvent as never, { params: { id: 'c1' }, body: { type }, ...extra });

  it('counts a visit once', async () => {
    const result = await track('VIEW');

    expect(result.body).toEqual({ success: true, counted: true });
    expect(prismaMock.courseEvent.create.mock.calls[0][0].data).toMatchObject({ courseId: 'c1', type: 'VIEW' });
  });

  it('the same visitor the same day is not counted again', async () => {
    prismaMock.courseEvent.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' }));

    expect((await track('CLICK')).body).toEqual({ success: true, counted: false });
  });

  it('the hash differs by visitor, kind of event, course and day, and hides the address', () => {
    const base = visitorHash('secret', '1.1.1.1', 'agent', 'c1', 'VIEW', new Date('2026-11-10'));

    expect(visitorHash('secret', '1.1.1.1', 'agent', 'c1', 'VIEW', new Date('2026-11-10'))).toBe(base);
    expect(visitorHash('secret', '2.2.2.2', 'agent', 'c1', 'VIEW', new Date('2026-11-10'))).not.toBe(base);
    expect(visitorHash('secret', '1.1.1.1', 'agent', 'c1', 'CLICK', new Date('2026-11-10'))).not.toBe(base);
    expect(visitorHash('secret', '1.1.1.1', 'agent', 'c2', 'VIEW', new Date('2026-11-10'))).not.toBe(base);
    expect(visitorHash('secret', '1.1.1.1', 'agent', 'c1', 'VIEW', new Date('2026-11-11'))).not.toBe(base);
    expect(base).not.toContain('1.1.1.1');
  });

  it('crawlers and link previews are not counted, since providers are billed on this', async () => {
    for (const agent of ['Googlebot/2.1', 'WhatsApp/2.23', 'facebookexternalhit/1.1', '']) {
      const result = await track('VIEW', { get: () => agent });
      expect(result.body.counted, agent).toBe(false);
    }
    expect(prismaMock.courseEvent.create).not.toHaveBeenCalled();
  });

  it('the provider looking at their own course is not counted', async () => {
    const token = jwt.sign({ id: 'prov-1', role: 'EMPLOYER', tokenVersion: 0 }, env.jwtSecret);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'prov-1', role: 'EMPLOYER', status: 'ACTIVE', tokenVersion: 0 });

    const result = await track('VIEW', { header: () => `Bearer ${token}` });

    expect(result.body.counted).toBe(false);
    expect(prismaMock.courseEvent.create).not.toHaveBeenCalled();
  });

  it('only a public course can be counted', async () => {
    prismaMock.course.findFirst.mockResolvedValue(null);

    expect((await track('VIEW')).status).toBe(404);
  });
});

describe('enquiries', () => {
  const body = { name: 'Ama Mensah', email: 'ama@example.com', message: 'Is there a weekend class?' };

  beforeEach(() => {
    prismaMock.course.findFirst.mockResolvedValue({ id: 'c1', title: 'Excel', providerId: 'prov-1', enquiryEnabled: true });
    prismaMock.courseEnquiry.create.mockResolvedValue({ id: 'enq-1' });
    prismaMock.courseEvent.create.mockResolvedValue({});
  });

  it('is saved, counts once for billing, and tells the provider', async () => {
    const result = await call(createEnquiry as never, { params: { id: 'c1' }, body });

    expect(result.status).toBe(201);
    expect(prismaMock.courseEnquiry.create.mock.calls[0][0].data).toMatchObject({ courseId: 'c1', name: 'Ama Mensah', email: 'ama@example.com', userId: null });
    expect(prismaMock.courseEvent.create.mock.calls[0][0].data).toEqual({ courseId: 'c1', type: 'ENQUIRY', visitorHash: 'enq-1' });
    expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'prov-1', type: 'COURSE_ENQUIRY', actionUrl: '/provider' });
  });

  it('is refused when the provider takes enrolments only through its own link', async () => {
    prismaMock.course.findFirst.mockResolvedValue({ id: 'c1', title: 'Excel', providerId: 'prov-1', enquiryEnabled: false });

    const result = await call(createEnquiry as never, { params: { id: 'c1' }, body });

    expect(result.status).toBe(400);
    expect(prismaMock.courseEnquiry.create).not.toHaveBeenCalled();
  });

  it('needs a way to reply, and a message', () => {
    const parse = (value: Record<string, unknown>) => enquirySchema.safeParse({ params: { id: 'c1' }, body: value }).success;

    expect(parse(body)).toBe(true);
    expect(parse({ name: 'Ama Mensah', phone: '0241234567', message: 'Hello there' })).toBe(true);
    expect(parse({ name: 'Ama Mensah', message: 'Hello there' })).toBe(false);
    expect(parse({ ...body, message: 'x' })).toBe(false);
    expect(parse({ ...body, phone: 'abc' })).toBe(false);
  });

  it('is a 404 for a course that is not public', async () => {
    prismaMock.course.findFirst.mockResolvedValue(null);

    expect((await call(createEnquiry as never, { params: { id: 'c1' }, body })).status).toBe(404);
  });
});

// ------------------------------------------------------------- learners

describe('a learner\'s completed courses', () => {
  const learner = asUser('learner-1', 'SEEKER');

  beforeEach(() => {
    prismaMock.learnerCourse.count.mockResolvedValue(0);
    prismaMock.learnerCourse.create.mockResolvedValue({ id: 'lc-1', status: 'SELF' });
    prismaMock.learnerCourse.findFirst.mockResolvedValue(null);
  });

  it('adds a course from the catalogue, copying its name and provider', async () => {
    prismaMock.course.findFirst.mockResolvedValue({ id: 'c1', title: 'Excel for accountants', provider: { employerProfile: { companyName: 'Accra Training Centre' } } });

    const result = await call(addLearnerCourse as never, { ...learner, body: { courseId: 'c1', completedOn: '2026-10-01' } });

    expect(result.status).toBe(201);
    expect(prismaMock.learnerCourse.create.mock.calls[0][0].data).toMatchObject({ userId: 'learner-1', courseId: 'c1', title: 'Excel for accountants', providerName: 'Accra Training Centre' });
  });

  it('adds a course done elsewhere by hand, with no course to confirm it', async () => {
    await call(addLearnerCourse as never, { ...learner, body: { title: 'Google Data Analytics', providerName: 'Coursera', certificateUrl: 'https://coursera.example/cert/1' } });

    expect(prismaMock.learnerCourse.create.mock.calls[0][0].data).toMatchObject({ courseId: null, title: 'Google Data Analytics', certificateUrl: 'https://coursera.example/cert/1' });
  });

  it('refuses a future completion date, a duplicate, and a link that is not a web address', async () => {
    expect((await call(addLearnerCourse as never, { ...learner, body: { title: 'Future course', completedOn: '2099-01-01' } })).status).toBe(400);

    prismaMock.course.findFirst.mockResolvedValue({ id: 'c1', title: 'X', provider: { employerProfile: null } });
    prismaMock.learnerCourse.findFirst.mockResolvedValue({ id: 'already' });
    expect((await call(addLearnerCourse as never, { ...learner, body: { courseId: 'c1' } })).status).toBe(409);

    expect(learnerCourseSchema.safeParse({ body: { title: 'A course', certificateUrl: 'javascript:alert(1)' } }).success).toBe(false);
    expect(learnerCourseSchema.safeParse({ body: {} }).success).toBe(false);
  });

  describe('asking the provider to confirm', () => {
    const record = (overrides: Record<string, unknown> = {}) => ({ id: 'lc-1', userId: 'learner-1', status: 'SELF', completedOn: new Date('2026-10-01'), course: { providerId: 'prov-1', title: 'Excel' }, ...overrides });

    it('sets the request and tells the provider', async () => {
      prismaMock.learnerCourse.findUnique.mockResolvedValue(record());

      const result = await call(requestConfirmation as never, { ...learner, params: { id: 'lc-1' } });

      expect(result.body.status).toBe('REQUESTED');
      expect(prismaMock.learnerCourse.update.mock.calls[0][0].data.status).toBe('REQUESTED');
      expect(prismaMock.notification.create.mock.calls[0][0].data.userId).toBe('prov-1');
    });

    it('cannot be done for a course written in by hand, without a date, twice, or for someone else', async () => {
      prismaMock.learnerCourse.findUnique.mockResolvedValue(record({ course: null }));
      expect((await call(requestConfirmation as never, { ...learner, params: { id: 'lc-1' } })).status).toBe(400);

      prismaMock.learnerCourse.findUnique.mockResolvedValue(record({ completedOn: null }));
      expect((await call(requestConfirmation as never, { ...learner, params: { id: 'lc-1' } })).status).toBe(400);

      prismaMock.learnerCourse.findUnique.mockResolvedValue(record({ status: 'REQUESTED' }));
      expect((await call(requestConfirmation as never, { ...learner, params: { id: 'lc-1' } })).status).toBe(409);

      prismaMock.learnerCourse.findUnique.mockResolvedValue(record({ userId: 'someone-else' }));
      expect((await call(requestConfirmation as never, { ...learner, params: { id: 'lc-1' } })).status).toBe(404);
      expect(prismaMock.learnerCourse.update).not.toHaveBeenCalled();
    });
  });

  describe('the provider confirming', () => {
    const pending = { id: 'lc-1', userId: 'learner-1', status: 'REQUESTED', course: { providerId: 'prov-1', title: 'Excel' } };
    const decide = (decision: 'CONFIRM' | 'DECLINE', id = 'prov-1', note?: string) =>
      call(decideCompletion as never, { ...asUser(id), params: { id: 'lc-1' }, body: { decision, note } });

    beforeEach(() => prismaMock.learnerCourse.findUnique.mockResolvedValue(pending));

    it('makes it a verified certificate and tells the learner', async () => {
      const result = await decide('CONFIRM');

      expect(result.body.status).toBe('CONFIRMED');
      expect(prismaMock.learnerCourse.update.mock.calls[0][0].data).toMatchObject({ status: 'CONFIRMED', confirmedById: 'prov-1' });
      expect(prismaMock.learnerCourse.update.mock.calls[0][0].data.confirmedAt).toBeInstanceOf(Date);
      expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'learner-1', title: 'Your certificate is verified' });
    });

    it('can decline, with a note the learner sees', async () => {
      await decide('DECLINE', 'prov-1', 'We have no record of you.');

      expect(prismaMock.learnerCourse.update.mock.calls[0][0].data).toMatchObject({ status: 'DECLINED', decisionNote: 'We have no record of you.' });
      expect(prismaMock.notification.create.mock.calls[0][0].data.message).toContain('We have no record of you.');
    });

    it('only the course\'s own provider can, and only once', async () => {
      expect((await decide('CONFIRM', 'another-provider')).status).toBe(404);
      expect(prismaMock.learnerCourse.update).not.toHaveBeenCalled();

      prismaMock.learnerCourse.findUnique.mockResolvedValue({ ...pending, status: 'CONFIRMED' });
      expect((await decide('CONFIRM')).status).toBe(409);
    });
  });
});

// ----------------------------------------------------------------- admin

describe('the admin reviewing courses', () => {
  const admin = asUser('admin-1', 'ADMIN');

  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'admin-1', email: 'admin@jobwahala.com' });
    prismaMock.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Excel', providerId: 'prov-1', reviewStatus: 'PENDING' });
    prismaMock.course.update.mockResolvedValue({});
    prismaMock.employerProfile.findUnique.mockResolvedValue({ isTrainingProvider: true, companyName: 'Accra Training Centre' });
    prismaMock.employerProfile.update.mockResolvedValue({});
  });

  const review = (decision: string, reason?: string) => call(reviewCourse as never, { ...admin, params: { id: 'c1' }, body: { decision, reason } });
  const logged = () => prismaMock.adminActionLog.create.mock.calls[0][0].data;

  it('approving makes it live, writes the admin log, and tells the provider', async () => {
    const result = await review('APPROVE');

    expect(result.body.reviewStatus).toBe('APPROVED');
    expect(prismaMock.course.update.mock.calls[0][0].data).toMatchObject({ reviewStatus: 'APPROVED', reviewNote: null });
    expect(logged()).toMatchObject({ adminId: 'admin-1', adminEmail: 'admin@jobwahala.com', action: 'COURSE_APPROVED', targetType: 'Course', targetId: 'c1' });
    expect(prismaMock.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'prov-1', type: 'COURSE_REVIEW' });
  });

  it('rejecting and removing need a reason, which the provider is shown', async () => {
    expect((await review('REJECT')).status).toBe(400);
    expect((await review('REMOVE', 'ok')).status).toBe(400);
    expect(prismaMock.course.update).not.toHaveBeenCalled();

    await review('REMOVE', 'Claims a government accreditation it does not have.');

    expect(prismaMock.course.update.mock.calls[0][0].data).toMatchObject({ reviewStatus: 'REMOVED', reviewNote: 'Claims a government accreditation it does not have.', featuredUntil: null });
    expect(logged()).toMatchObject({ action: 'COURSE_REMOVED', reason: 'Claims a government accreditation it does not have.' });
    expect(prismaMock.notification.create.mock.calls[0][0].data.message).toContain('government accreditation');
  });

  it('a decision and its log line are saved together', async () => {
    await review('APPROVE');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('approves or rejects a company as a provider, with the same rules', async () => {
    const decide = (decision: string, reason?: string) => call(reviewProvider as never, { ...admin, params: { userId: 'prov-1' }, body: { decision, reason } });

    expect((await decide('REJECT')).status).toBe(400);

    await decide('APPROVE');
    expect(prismaMock.employerProfile.update.mock.calls[0][0].data).toMatchObject({ providerStatus: 'APPROVED', providerReviewNote: null });
    expect(logged()).toMatchObject({ action: 'COURSE_PROVIDER_APPROVED', targetType: 'EmployerProfile', targetId: 'prov-1' });

    prismaMock.adminActionLog.create.mockClear();
    await decide('REJECT', 'We could not find this organisation.');
    expect(prismaMock.employerProfile.update.mock.calls[1][0].data).toMatchObject({ providerStatus: 'REJECTED', providerReviewNote: 'We could not find this organisation.' });
    expect(logged().action).toBe('COURSE_PROVIDER_REJECTED');
    expect(providerReviewSchema.safeParse({ params: { userId: 'x' }, body: { decision: 'MAYBE' } }).success).toBe(false);
  });

  it('features a listing for a number of days, and stops featuring it at 0', async () => {
    const result = await call(setFeatured as never, { ...admin, params: { id: 'c1' }, body: { days: 30 } });

    const data = prismaMock.course.update.mock.calls[0][0].data;
    expect(Math.round((data.featuredUntil.getTime() - data.featuredFrom.getTime()) / 86_400_000)).toBe(30);
    expect(result.body.featuredUntil).toBeTruthy();
    expect(logged()).toMatchObject({ action: 'COURSE_FEATURED', targetId: 'c1' });

    prismaMock.adminActionLog.create.mockClear();
    await call(setFeatured as never, { ...admin, params: { id: 'c1' }, body: { days: 0 } });
    expect(prismaMock.course.update.mock.calls[1][0].data).toEqual({ featuredFrom: null, featuredUntil: null });
    expect(logged().action).toBe('COURSE_UNFEATURED');
  });

  it('is a 404 for a course or provider that does not exist', async () => {
    prismaMock.course.findUnique.mockResolvedValue(null);
    expect((await review('APPROVE')).status).toBe(404);

    prismaMock.employerProfile.findUnique.mockResolvedValue(null);
    expect((await call(reviewProvider as never, { ...admin, params: { userId: 'nobody' }, body: { decision: 'APPROVE' } })).status).toBe(404);
  });
});

// ------------------------------------------------------------ SEO pages

describe('category and skill pages', () => {
  const catalogue = [
    ...many(3, { skills: ['excel'], category: 'office-skills' }),
    ...many(2, { skills: ['photography'], category: 'design-creative' }),
  ];

  it('is published with at least 3 courses and noindex otherwise', () => {
    expect(MIN_COURSES_FOR_PAGE).toBe(3);
    expect(buildCourseLanding('skill', 'excel', catalogue)!.indexable).toBe(true);
    expect(buildCourseLanding('skill', 'photography', catalogue)!.indexable).toBe(false);
    expect(buildCourseLanding('category', 'agriculture', catalogue)!.indexable).toBe(false);
  });

  it('unknown skills and categories are a 404', () => {
    expect(buildCourseLanding('skill', 'juggling', catalogue)).toBeNull();
    expect(buildCourseLanding('category', 'cooking-with-fire', catalogue)).toBeNull();
  });

  it('has its own title, heading, description and intro, and clean addresses', () => {
    const skill = buildCourseLanding('skill', 'excel', catalogue)!;
    const category = buildCourseLanding('category', 'office-skills', catalogue)!;

    expect(skill.path).toBe('/excel-courses-in-ghana');
    expect(skill.h1).toBe('Microsoft Excel courses in Ghana');
    expect(skill.title).toBe('Microsoft Excel courses in Ghana - 3 courses');
    expect(category.path).toBe('/courses/category/office-skills');
    expect(skill.intro).toMatch(/There are 3 microsoft excel courses in ghana on JobWahala from 1 training provider/i);
    expect(new Set([skill.title, category.title, skill.description, category.description]).size).toBe(4);
  });

  it('lists only courses that match, and links to published neighbours', () => {
    const page = buildCourseLanding('category', 'office-skills', catalogue)!;

    expect(page.courses).toHaveLength(3);
    expect(page.related).toEqual([{ label: 'Microsoft Excel courses in Ghana', path: '/excel-courses-in-ghana', count: 3 }]);
  });

  it('only published pages go in the sitemap', () => {
    expect(coursePagePaths(catalogue).sort()).toEqual(['/courses/category/office-skills', '/excel-courses-in-ghana']);
    expect(coursePagePaths([])).toEqual([]);
  });

  it('reads the skill out of a "[skill] courses in Ghana" address', () => {
    expect(skillFromCoursesSlug('excel-courses-in-ghana')).toBe('excel');
    expect(skillFromCoursesSlug('digital-marketing-courses-in-ghana')).toBe('digital-marketing');
    expect(skillFromCoursesSlug('juggling-courses-in-ghana')).toBeNull();
  });

  it('is served as data, and as 404 when unknown', async () => {
    prismaMock.course.findMany.mockResolvedValue([]);

    expect((await call(getCourseLanding as never, { params: { kind: 'skill', slug: 'excel' } })).body.page.indexable).toBe(false);
    expect((await call(getCourseLanding as never, { params: { kind: 'skill', slug: 'juggling' } })).status).toBe(404);
  });
});

describe('the sitemap', () => {
  it('lists the courses hub, every public course, and the category and skill pages that have enough courses', async () => {
    prismaMock.course.findMany.mockResolvedValue([
      ...Array.from({ length: 3 }, (_, i) => rowOf(publicCourse({ slug: `excel-${i}`, skills: ['excel'], category: 'office-skills' }))),
      rowOf(publicCourse({ slug: 'photo-1', skills: ['photography'], category: 'design-creative' })),
    ]);
    prismaMock.job.findMany = vi.fn().mockResolvedValue([]);
    let xml = '';
    const res = {
      status() {
        return this;
      },
      type() {
        return this;
      },
      set() {
        return this;
      },
      send(value: string) {
        xml = value;
        return this;
      },
    } as unknown as Response;

    await getSitemap({ get: () => undefined, protocol: 'https', headers: {} } as unknown as Request, res);

    expect(xml).toContain('/courses</loc>');
    expect(xml).toContain('/courses/excel-0</loc>');
    expect(xml).toContain('/courses/photo-1</loc>');
    expect(xml).toContain('/excel-courses-in-ghana</loc>');
    expect(xml).toContain('/courses/category/office-skills</loc>');
    expect(xml).not.toContain('photography-courses-in-ghana');
  });
});

describe('Course structured data and crawler pages', () => {
  const course = {
    ...publicCourse({ title: 'Excel for accountants', skills: ['excel', 'accounting'], durationWeeks: 6, startDates: ['2099-01-15'], format: 'HYBRID', location: 'Accra', certificateOffered: true, priceGhs: 450 }),
    description: 'Six weeks of practical Excel.\nBring a laptop.',
  };

  it('describes what is taught, who by, the price, delivery and start', () => {
    const data = buildCourseJsonLd(course, 'https://jobwahala.com');

    expect(data).toMatchObject({
      '@type': 'Course',
      name: 'Excel for accountants',
      provider: { '@type': 'Organization', name: 'Accra Training Centre' },
      offers: { '@type': 'Offer', price: 450, priceCurrency: 'GHS', category: 'Paid' },
      teaches: ['Microsoft Excel', 'Accounting'],
      timeRequired: 'P6W',
      educationalCredentialAwarded: 'Certificate',
    });
    expect(data.hasCourseInstance[0]).toMatchObject({ '@type': 'CourseInstance', courseMode: 'Blended', startDate: '2099-01-15', location: { '@type': 'Place', name: 'Accra' } });
  });

  it('a free online course is free, online and has no place', () => {
    const data = buildCourseJsonLd({ ...course, isFree: true, priceGhs: null, format: 'ONLINE', location: null, startDates: [] }, 'https://jobwahala.com');

    expect(data.offers).toMatchObject({ price: 0, category: 'Free' });
    expect(data.hasCourseInstance).toEqual([expect.objectContaining({ courseMode: 'Online' })]);
    expect(data.hasCourseInstance[0]).not.toHaveProperty('location');
  });

  it('the course page has its title, canonical link, facts and the Course data', () => {
    const html = renderCourseDetailPage(course, 'https://jobwahala.com');

    expect(html).toContain(`<link rel="canonical" href="https://jobwahala.com/courses/${course.slug}">`);
    expect(html).toContain('<h1>Excel for accountants</h1>');
    expect(html).toContain('"@type":"Course"');
    expect(html).toContain('Price: GHS 450');
    expect(html).not.toContain('noindex');
  });

  it('a thin category page says noindex in its HTML', () => {
    const html = renderCourseLandingPage(buildCourseLanding('skill', 'excel', many(2, { skills: ['excel'] }))!, 'https://jobwahala.com');

    expect(html).toContain('<meta name="robots" content="noindex, follow">');
  });

  it('escapes what providers typed', () => {
    const html = renderCourseDetailPage({ ...course, title: 'Excel <script>alert(1)</script>' }, 'https://jobwahala.com');

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('serves one public course with its description, and a 404 for anything else', async () => {
    prismaMock.course.findFirst.mockResolvedValue({ ...rowOf(publicCourse({ slug: 'excel-1' })), description: 'Full description' });
    prismaMock.course.findMany.mockResolvedValue([]);

    const found = await call(getCourse as never, { params: { slug: 'excel-1' } });
    expect(found.body.course.description).toBe('Full description');
    expect(prismaMock.course.findFirst.mock.calls[0][0].where).toMatchObject({ slug: 'excel-1', status: 'ACTIVE', reviewStatus: 'APPROVED' });

    prismaMock.course.findFirst.mockResolvedValue(null);
    expect((await call(getCourse as never, { params: { slug: 'nope' } })).status).toBe(404);
  });

  it('a provider page lists only that provider\'s courses, and only for an approved provider', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'p1', employerProfile: { companyName: 'Accra Training Centre', logoUrl: null, website: null, description: 'We train.' }, verificationRequests: [{ status: 'APPROVED', type: 'BUSINESS' }] });
    prismaMock.course.findMany.mockResolvedValue([rowOf(publicCourse()), rowOf(publicCourse({ provider: { id: 'p2', name: 'Other', logoUrl: null, isVerified: false } }))]);

    const result = await call(getProviderPage as never, { params: { id: 'p1' } });

    expect(result.body.provider).toMatchObject({ name: 'Accra Training Centre', isVerified: true });
    expect(result.body.courses).toHaveLength(1);
    expect(prismaMock.user.findFirst.mock.calls[0][0].where).toMatchObject({ employerProfile: { is: { providerStatus: 'APPROVED' } } });

    prismaMock.user.findFirst.mockResolvedValue(null);
    expect((await call(getProviderPage as never, { params: { id: 'x' } })).status).toBe(404);
  });
});
