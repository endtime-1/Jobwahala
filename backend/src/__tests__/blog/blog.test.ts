import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const prismaMock = vi.hoisted(() => {
  const mock: Record<string, any> = {
    job: { findMany: vi.fn().mockResolvedValue([]) },
    course: { findMany: vi.fn().mockResolvedValue([]) },
    blogPost: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn() },
    adminActionLog: { create: vi.fn() },
  };
  mock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});
vi.mock('../../config/prisma', () => ({ default: prismaMock }));

import { createPost, deletePost, getPost, listPosts, updatePost } from '../../controllers/blogController';
import { getBlogPostSharePage, getSitemapPart } from '../../controllers/shareController';
import { createBlogPostSchema, updateBlogPostSchema } from '../../validation/blogSchemas';
import { isBlogCategory, postState, publicPostWhere, readingMinutes, renderMarkdown, slugifyTitle } from '../../utils/blog';
import { renderBlogListPage, renderBlogPostPage, type BlogCard } from '../../utils/blogRender';
import { adminRouterPaths } from '../acquisition/helpers';

const respond = () => {
  const state: { status: number; body: any; headers: Record<string, string> } = { status: 200, body: null, headers: {} };
  const res = {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
    send(body: unknown) {
      state.body = body;
      return this;
    },
    type() {
      return this;
    },
    set(name: string, value: string) {
      state.headers[name] = value;
      return this;
    },
  } as unknown as Response;
  return { res, state };
};

const post = (over: Partial<BlogCard & { updatedAt: Date }> = {}) => ({
  id: 'p1',
  slug: 'write-a-cv-that-gets-calls',
  title: 'How to write a CV that gets calls',
  metaDescription: 'Five simple changes that help your CV get read by employers in Ghana, with examples you can copy today.',
  category: 'cv-tips',
  body: '## Start with a summary\nKeep it **short**.\n\n- Use bullet points\n- Add numbers\n\nRead [our guide](https://www.jobwahala.com/jobs).',
  coverImageUrl: '/api/uploads/logo/cover.webp',
  coverImageAlt: 'A person writing a CV at a desk',
  authorName: 'JobWahala Editorial',
  status: 'PUBLISHED',
  publishAt: new Date('2026-11-01T09:00:00Z'),
  createdAt: new Date('2026-10-30T09:00:00Z'),
  updatedAt: new Date('2026-11-02T09:00:00Z'),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ email: 'admin@jobwahala.com' });
});

describe('the Markdown a post is written in', () => {
  it('keeps H2/H3 headings, bold, lists and links', () => {
    const html = renderMarkdown('# Title\n## Part\n### Detail\nSome **bold** and *italic* text.\n\n1. One\n2. Two\n\n- A\n- B\n\n[Jobs](/jobs) and [site](https://example.com).');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<h2>Part</h2>');
    expect(html).toContain('<h3>Detail</h3>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<ol><li>One</li><li>Two</li></ol>');
    expect(html).toContain('<ul><li>A</li><li>B</li></ul>');
    expect(html).toContain('<a href="/jobs">Jobs</a>');
    expect(html).toContain('<a href="https://example.com" rel="noopener" target="_blank">site</a>');
  });

  it('never lets typed HTML or a javascript: link through', () => {
    const html = renderMarkdown('<script>alert(1)</script> and [bad](javascript:alert(1)) and <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('&lt;script&gt;');
  });

  it('makes slugs, reading time and knows the five categories', () => {
    expect(slugifyTitle('CV Tips: 5 ways to stand out!')).toBe('cv-tips-5-ways-to-stand-out');
    expect(readingMinutes('word '.repeat(450))).toBe(2);
    for (const slug of ['cv-tips', 'interview-tips', 'scam-alerts', 'nss-graduates', 'employer-advice']) expect(isBlogCategory(slug)).toBe(true);
    expect(isBlogCategory('other')).toBe(false);
  });

  it('treats a future publish time as scheduled and drafts as drafts', () => {
    const now = new Date('2026-11-09T00:00:00Z');
    expect(postState({ status: 'DRAFT', publishAt: null }, now)).toBe('DRAFT');
    expect(postState({ status: 'PUBLISHED', publishAt: new Date('2026-12-01') }, now)).toBe('SCHEDULED');
    expect(postState({ status: 'PUBLISHED', publishAt: new Date('2026-11-01') }, now)).toBe('PUBLISHED');
    expect(publicPostWhere(now)).toEqual({ status: 'PUBLISHED', publishAt: { lte: now } });
  });
});

describe('the public blog', () => {
  it('lists published posts newest first and can filter by category, with no draft or scheduled post', async () => {
    prismaMock.blogPost.findMany.mockResolvedValue([post()]);
    const { res, state } = respond();
    await listPosts({ query: { category: 'cv-tips' } } as unknown as Request, res);

    const args = prismaMock.blogPost.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ status: 'PUBLISHED', category: 'cv-tips' });
    expect(args.where.publishAt.lte).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual({ publishAt: 'desc' });
    expect(state.body.posts[0]).toMatchObject({ slug: 'write-a-cv-that-gets-calls', categoryLabel: 'CV tips' });
    expect(state.body.posts[0].body).toBeUndefined();
  });

  it('returns one article as safe HTML, and a 404 for a draft or unknown slug', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(post());
    prismaMock.blogPost.findMany.mockResolvedValue([]);
    const found = respond();
    await getPost({ params: { slug: 'write-a-cv-that-gets-calls' } } as unknown as Request, found.res);
    expect(found.state.body.post.html).toContain('<h2>Start with a summary</h2>');

    prismaMock.blogPost.findFirst.mockResolvedValue(null);
    const missing = respond();
    await getPost({ params: { slug: 'draft-post' } } as unknown as Request, missing.res);
    expect(missing.state.status).toBe(404);
    expect(prismaMock.blogPost.findFirst.mock.calls[1][0].where).toMatchObject({ slug: 'draft-post', status: 'PUBLISHED' });
  });
});

describe('the server-rendered blog pages (what search engines read)', () => {
  const site = 'https://www.jobwahala.com';
  const { updatedAt, ...card } = post();

  it('the article has a unique title and description, canonical, Open Graph image, Article and Breadcrumb data, share buttons and the end box', () => {
    const html = renderBlogPostPage({ ...card, updatedAt }, [], site);

    expect(html).toContain('<title>How to write a CV that gets calls | JobWahala</title>');
    expect(html).toContain('<meta name="description" content="Five simple changes');
    expect(html).toContain('<link rel="canonical" href="https://www.jobwahala.com/blog/write-a-cv-that-gets-calls">');
    expect(html).toContain('<meta property="og:image" content="https://www.jobwahala.com/api/uploads/logo/cover.webp">');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"datePublished":"2026-11-01T09:00:00.000Z"');
    expect(html).toContain('<h1>How to write a CV that gets calls</h1>');
    expect(html).toContain('<time datetime="2026-11-01">1 November 2026</time>');
    expect(html).toContain('alt="A person writing a CV at a desk" width="1200" height="675"');
    expect(html).toContain('<h2>Start with a summary</h2>');
    for (const network of ['wa.me', 'facebook.com/sharer', 'linkedin.com/sharing', 'twitter.com/intent']) expect(html).toContain(network);
    expect(html).toContain('href="https://www.jobwahala.com/jobs"');
    expect(html).toContain('whatsapp.com/channel');
  });

  it('the list page has the categories to filter by, the newest posts and its own canonical', () => {
    const html = renderBlogListPage([card], site);
    expect(html).toContain('<h1>JobWahala Blog</h1>');
    expect(html).toContain('<link rel="canonical" href="https://www.jobwahala.com/blog">');
    expect(html).toContain('href="https://www.jobwahala.com/blog?category=scam-alerts"');
    expect(html).toContain('href="https://www.jobwahala.com/blog/write-a-cv-that-gets-calls"');

    const filtered = renderBlogListPage([card], site, 'cv-tips');
    expect(filtered).toContain('<link rel="canonical" href="https://www.jobwahala.com/blog?category=cv-tips">');
    expect(filtered).toContain('<title>CV tips – Blog | JobWahala</title>');
  });

  it('a draft or scheduled post answers 404, as if it did not exist', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(null);
    const { res, state } = respond();
    await getBlogPostSharePage({ params: { slug: 'secret-draft' }, get: () => undefined, protocol: 'https' } as unknown as Request, res);
    expect(state.status).toBe(404);
  });
});

describe('writing posts in the admin panel', () => {
  const valid = {
    title: 'How to write a CV that gets calls',
    slug: 'write-a-cv-that-gets-calls',
    metaDescription: 'Five simple changes that help your CV get read by employers in Ghana.',
    category: 'cv-tips',
    body: 'A real article with enough words in it to be saved.',
    authorName: 'JobWahala Editorial',
    status: 'DRAFT',
  };
  const call = (body: object, id?: string) => ({ body, params: id ? { id } : {}, user: { id: 'admin-1', role: 'ADMIN' } }) as never;

  it('validates the fields: slug format, description length, category, and alt text for a cover image', () => {
    const ok = (body: object) => createBlogPostSchema.safeParse({ body }).success;
    expect(ok(valid)).toBe(true);
    expect(ok({ ...valid, slug: 'Bad Slug' })).toBe(false);
    expect(ok({ ...valid, metaDescription: 'x'.repeat(161) })).toBe(false);
    expect(ok({ ...valid, category: 'gossip' })).toBe(false);
    expect(ok({ ...valid, coverImageUrl: 'https://cdn.example/cover.jpg' })).toBe(false);
    expect(ok({ ...valid, coverImageUrl: 'https://cdn.example/cover.jpg', coverImageAlt: 'A desk' })).toBe(true);
    expect(ok({ ...valid, coverImageUrl: 'javascript:alert(1)', coverImageAlt: 'x' })).toBe(false);
    expect(updateBlogPostSchema.safeParse({ body: { title: 'New title here' }, params: { id: 'p1' } }).success).toBe(true);
  });

  it('saves a draft with no publish date, and logs it', async () => {
    prismaMock.blogPost.create.mockImplementation(async ({ data }: { data: object }) => ({ ...post(), ...data }));
    const { res, state } = respond();
    await createPost(call(valid), res);

    expect(state.status).toBe(201);
    const data = prismaMock.blogPost.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'DRAFT', publishAt: null, createdById: 'admin-1' });
    expect(state.body.post.state).toBe('DRAFT');
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data).toMatchObject({ action: 'blog.create', targetType: 'BlogPost' });
  });

  it('publishing with no date publishes now; a future date schedules it', async () => {
    prismaMock.blogPost.create.mockImplementation(async ({ data }: { data: object }) => ({ ...post(), ...data }));

    const now = respond();
    await createPost(call({ ...valid, status: 'PUBLISHED' }), now.res);
    expect(prismaMock.blogPost.create.mock.calls[0][0].data.publishAt).toBeInstanceOf(Date);
    expect(now.state.body.post.state).toBe('PUBLISHED');

    const later = respond();
    await createPost(call({ ...valid, status: 'PUBLISHED', publishAt: '2099-01-01T09:00:00.000Z' }), later.res);
    expect(later.state.body.post.state).toBe('SCHEDULED');
  });

  it('refuses a slug that another post already uses', async () => {
    prismaMock.blogPost.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    const { res, state } = respond();
    await createPost(call(valid), res);
    expect(state.status).toBe(409);
  });

  it('edits, publishes and deletes with a log line each, and 404s on an unknown post', async () => {
    prismaMock.blogPost.findUnique.mockResolvedValue(post({ status: 'DRAFT' } as never));
    prismaMock.blogPost.update.mockImplementation(async ({ data }: { data: object }) => ({ ...post(), ...data }));
    const published = respond();
    await updatePost(call({ status: 'PUBLISHED' }, 'p1'), published.res);
    expect(prismaMock.adminActionLog.create.mock.calls[0][0].data.action).toBe('blog.publish');

    prismaMock.blogPost.findUnique.mockResolvedValue({ id: 'p1', slug: 'x', title: 'X' });
    const removed = respond();
    await deletePost(call({}, 'p1'), removed.res);
    expect(prismaMock.blogPost.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(prismaMock.adminActionLog.create.mock.calls[1][0].data.action).toBe('blog.delete');

    prismaMock.blogPost.findUnique.mockResolvedValue(null);
    const missing = respond();
    await updatePost(call({ title: 'Anything' }, 'nope'), missing.res);
    expect(missing.state.status).toBe(404);
  });

  it('keeps the blog management behind the admin router', async () => {
    const paths = await adminRouterPaths();
    expect(paths).toContain('/blog');
    expect(paths).toContain('/blog/:id');
  });
});

describe('the sitemap', () => {
  it('lists the blog and each published post, with the date it last changed', async () => {
    prismaMock.blogPost.findMany.mockResolvedValue([{ slug: 'write-a-cv-that-gets-calls', updatedAt: new Date('2026-11-02T09:00:00Z') }]);
    let xml = '';
    const res = { status: () => res, type: () => res, set: () => res, send: (value: string) => ((xml = value), res) } as unknown as Response;
    await getSitemapPart({ params: { part: 'blog' }, get: () => undefined, protocol: 'https', headers: {} } as unknown as Request, res);

    expect(prismaMock.blogPost.findMany.mock.calls[0][0].where).toMatchObject({ status: 'PUBLISHED' });
    expect(xml).toContain('/blog/write-a-cv-that-gets-calls</loc>');
    expect(xml).toContain('<loc>https://www.jobwahala.com/blog</loc>'.replace('https://www.jobwahala.com', ''));
    expect(xml).toContain('<lastmod>2026-11-02</lastmod>');
  });
});
