import { z } from 'zod';
import { blogCategorySlugs, isUsableImageUrl } from '../utils/blog';

const slug = z
  .string()
  .trim()
  .min(3, 'The address needs at least 3 characters')
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only');

const postFields = {
  title: z.string().trim().min(3).max(120),
  slug,
  metaDescription: z.string().trim().min(30, 'The description should be at least 30 characters').max(160, 'The description must be 160 characters or fewer'),
  category: z.enum(blogCategorySlugs),
  body: z.string().trim().min(20, 'Write the article').max(60000),
  coverImageUrl: z.string().trim().max(500).refine(isUsableImageUrl, 'Use an https image address or an uploaded image').optional().or(z.literal('')),
  coverImageAlt: z.string().trim().max(200).optional().or(z.literal('')),
  authorName: z.string().trim().min(2).max(80),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  publishAt: z.string().datetime({ offset: true }).optional().or(z.literal('')),
};

const needsAlt = (post: { coverImageUrl?: string; coverImageAlt?: string }) => !post.coverImageUrl || Boolean(post.coverImageAlt);
const altMessage = { message: 'Describe the cover image (alt text)', path: ['coverImageAlt'] };

export const createBlogPostSchema = z.object({
  body: z.object(postFields).strict().refine(needsAlt, altMessage),
});

export const updateBlogPostSchema = z.object({
  body: z.object(postFields).partial().strict().refine(needsAlt, altMessage),
  params: z.object({ id: z.string().min(1) }),
});

export const blogPostIdSchema = z.object({ params: z.object({ id: z.string().min(1) }) });
