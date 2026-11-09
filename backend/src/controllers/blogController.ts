import { Request, Response } from 'express';
import prisma from '../config/prisma';
import logger from '../config/logger';
import { AuthRequest } from '../middleware/auth';
import { getErrorMessage } from '../utils/errors';
import { singleValue } from '../utils/request';
import { recordAdminAction } from '../utils/adminAudit';
import { BLOG_CATEGORIES, blogCategoryLabel, isBlogCategory, plainText, postState, publicPostWhere, readingMinutes, renderMarkdown } from '../utils/blog';

type PostRow = {
  id: string;
  slug: string;
  title: string;
  metaDescription: string;
  category: string;
  body: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  authorName: string;
  status: string;
  publishAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const listFields = {
  id: true,
  slug: true,
  title: true,
  metaDescription: true,
  category: true,
  coverImageUrl: true,
  coverImageAlt: true,
  authorName: true,
  publishAt: true,
  body: true,
} as const;

/** What a visitor sees in a list: no article text, only the card. */
export const toCard = (post: Pick<PostRow, 'slug' | 'title' | 'metaDescription' | 'category' | 'coverImageUrl' | 'coverImageAlt' | 'authorName' | 'publishAt' | 'body'>) => ({
  slug: post.slug,
  title: post.title,
  excerpt: post.metaDescription,
  category: post.category,
  categoryLabel: blogCategoryLabel(post.category),
  coverImageUrl: post.coverImageUrl,
  coverImageAlt: post.coverImageAlt,
  authorName: post.authorName,
  publishedAt: post.publishAt,
  readingMinutes: readingMinutes(post.body),
});

export const loadPublicPosts = (category?: string, take = 60) =>
  prisma.blogPost.findMany({
    where: { ...publicPostWhere(), ...(isBlogCategory(category) ? { category } : {}) },
    select: listFields,
    orderBy: { publishAt: 'desc' },
    take,
  });

export const loadPublicPost = (slug: string) => prisma.blogPost.findFirst({ where: { slug, ...publicPostWhere() } });

// ---- public

export const listPosts = async (req: Request, res: Response) => {
  try {
    const category = singleValue(req.query.category as string | undefined);
    const posts = await loadPublicPosts(category);
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({ success: true, categories: BLOG_CATEGORIES, posts: posts.map(toCard) });
  } catch (error) {
    logger.error('blog_list_failed', { error: getErrorMessage(error) });
    return res.status(500).json({ success: false, message: 'Unable to load the blog right now' });
  }
};

export const getPost = async (req: Request, res: Response) => {
  try {
    const post = await loadPublicPost(singleValue(req.params.slug) || '');
    if (!post) return res.status(404).json({ success: false, message: 'Article not found' });

    const more = await prisma.blogPost.findMany({
      where: { ...publicPostWhere(), slug: { not: post.slug } },
      select: listFields,
      orderBy: { publishAt: 'desc' },
      take: 2,
    });
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({ success: true, post: { ...toCard(post), metaDescription: post.metaDescription, html: renderMarkdown(post.body) }, more: more.map(toCard) });
  } catch (error) {
    logger.error('blog_post_failed', { error: getErrorMessage(error) });
    return res.status(500).json({ success: false, message: 'Unable to load this article right now' });
  }
};

// ---- admin

const adminOf = async (req: AuthRequest) => {
  const row = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true } });
  return { id: req.user!.id, email: row?.email ?? 'unknown' };
};

const toAdminPost = (post: PostRow) => ({ ...post, state: postState(post), wordCount: plainText(post.body).split(' ').filter(Boolean).length });

export const adminListPosts = async (_req: AuthRequest, res: Response) => {
  try {
    const posts = await prisma.blogPost.findMany({ orderBy: { updatedAt: 'desc' }, take: 300 });
    return res.json({ success: true, categories: BLOG_CATEGORIES, posts: posts.map((post) => toAdminPost(post as PostRow)) });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

type PostInput = Partial<{
  title: string;
  slug: string;
  metaDescription: string;
  category: string;
  body: string;
  coverImageUrl: string;
  coverImageAlt: string;
  authorName: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishAt: string;
}>;

const dataFrom = (input: PostInput, existing?: PostRow) => {
  const status = input.status ?? existing?.status ?? 'DRAFT';
  const given = input.publishAt === undefined ? undefined : input.publishAt ? new Date(input.publishAt) : null;
  // Publishing without a date means "now"; a date in the future means scheduled.
  const publishAt = given === undefined ? existing?.publishAt ?? null : given;
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    ...(input.metaDescription !== undefined ? { metaDescription: input.metaDescription } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl || null } : {}),
    ...(input.coverImageAlt !== undefined ? { coverImageAlt: input.coverImageAlt || null } : {}),
    ...(input.authorName !== undefined ? { authorName: input.authorName } : {}),
    status,
    publishAt: status === 'PUBLISHED' ? publishAt ?? new Date() : publishAt,
  };
};

const isSlugTaken = (error: unknown) => (error as { code?: string })?.code === 'P2002';

export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await adminOf(req);
    const input = req.body as PostInput;
    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.blogPost.create({
        data: { ...(dataFrom(input) as Required<ReturnType<typeof dataFrom>>), createdById: admin.id } as never,
      });
      await recordAdminAction(tx, { admin, action: 'blog.create', targetType: 'BlogPost', targetId: created.id, metadata: { slug: created.slug, status: created.status } });
      return created;
    });
    return res.status(201).json({ success: true, post: toAdminPost(post as PostRow) });
  } catch (error) {
    if (isSlugTaken(error)) return res.status(409).json({ success: false, message: 'Another article already uses that address. Change the URL slug.' });
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const updatePost = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const existing = (await prisma.blogPost.findUnique({ where: { id } })) as PostRow | null;
    if (!existing) return res.status(404).json({ success: false, message: 'Article not found' });

    const admin = await adminOf(req);
    const data = dataFrom(req.body as PostInput, existing);
    const post = await prisma.$transaction(async (tx) => {
      const updated = await tx.blogPost.update({ where: { id }, data });
      const wasLive = postState(existing) !== 'DRAFT';
      const action = existing.status !== updated.status ? (updated.status === 'PUBLISHED' ? 'blog.publish' : 'blog.unpublish') : 'blog.update';
      await recordAdminAction(tx, {
        admin,
        action,
        targetType: 'BlogPost',
        targetId: id,
        metadata: { slug: updated.slug, previousSlug: existing.slug !== updated.slug ? existing.slug : undefined, wasLive, state: postState(updated) },
      });
      return updated;
    });
    return res.json({ success: true, post: toAdminPost(post as PostRow) });
  } catch (error) {
    if (isSlugTaken(error)) return res.status(409).json({ success: false, message: 'Another article already uses that address. Change the URL slug.' });
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    const id = singleValue(req.params.id) || '';
    const existing = await prisma.blogPost.findUnique({ where: { id }, select: { id: true, slug: true, title: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Article not found' });

    const admin = await adminOf(req);
    await prisma.$transaction(async (tx) => {
      await tx.blogPost.delete({ where: { id } });
      await recordAdminAction(tx, { admin, action: 'blog.delete', targetType: 'BlogPost', targetId: id, metadata: { slug: existing.slug, title: existing.title } });
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
