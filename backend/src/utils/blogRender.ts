import { whatsappChannelUrl } from '../content/organization';
import { BLOG_CATEGORIES, blogCategoryLabel, readingMinutes, renderMarkdown } from './blog';
import { breadcrumbJsonLd, renderShell, stripBrand } from './seoPages';
import { escapeHtml as e } from './sharePage';

export type BlogCard = {
  slug: string;
  title: string;
  metaDescription: string;
  category: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  authorName: string;
  publishAt: Date | null;
  body: string;
};

const absolute = (url: string, siteUrl: string) => (url.startsWith('/') ? `${siteUrl}${url}` : url);
const day = (date: Date | null) => (date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
const isoDay = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : '');

const cardHtml = (post: BlogCard, siteUrl: string) => `<article>
${post.coverImageUrl ? `<a href="${e(`${siteUrl}/blog/${post.slug}`)}"><img src="${e(absolute(post.coverImageUrl, siteUrl))}" alt="${e(post.coverImageAlt ?? post.title)}" width="800" height="450" loading="lazy"></a>\n` : ''}<p>${e(blogCategoryLabel(post.category))} · <time datetime="${e(isoDay(post.publishAt))}">${e(day(post.publishAt))}</time></p>
<h2><a href="${e(`${siteUrl}/blog/${post.slug}`)}">${e(stripBrand(post.title))}</a></h2>
<p>${e(post.metaDescription)}</p>
<p>${e(post.authorName)} · ${readingMinutes(post.body)} min read</p>
</article>`;

/** /blog and /blog?category=cv-tips: newest first, with the categories to filter by. */
export const renderBlogListPage = (posts: BlogCard[], siteUrl: string, category?: string) => {
  const label = category ? blogCategoryLabel(category) : '';
  const path = category ? `/blog?category=${category}` : '/blog';
  const filters = [{ slug: '', label: 'All' }, ...BLOG_CATEGORIES]
    .map((entry) => `<li><a href="${e(`${siteUrl}/blog${entry.slug ? `?category=${entry.slug}` : ''}`)}">${e(entry.label)}</a></li>`)
    .join('\n');

  return renderShell({
    title: category ? `${label} – Blog` : 'Blog – Career Advice for Job Seekers and Employers in Ghana',
    description: category
      ? `${label}: practical advice for job seekers and employers in Ghana, from the JobWahala team.`
      : 'CV tips, interview tips, scam alerts, National Service and graduate advice, and hiring advice for employers in Ghana. Written by the JobWahala team.',
    url: `${siteUrl}${path}`,
    siteUrl,
    jsonLd: [
      breadcrumbJsonLd(siteUrl, [
        { label: 'Home', path: '/' },
        { label: 'Blog', path: '/blog' },
        ...(category ? [{ label, path }] : []),
      ]),
    ],
    body: `<nav aria-label="Breadcrumb"><a href="${e(siteUrl)}/">Home</a> &gt; ${category ? `<a href="${e(siteUrl)}/blog">Blog</a> &gt; ${e(label)}` : 'Blog'}</nav>
<h1>${category ? e(label) : 'JobWahala Blog'}</h1>
<p>Practical advice for finding a job, avoiding scams and hiring well in Ghana and across Africa.</p>
<nav aria-label="Categories"><ul>
${filters}
</ul></nav>
${posts.length ? posts.map((post) => cardHtml(post, siteUrl)).join('\n') : '<p>No articles here yet. Check back soon.</p>'}
<p><a href="${e(siteUrl)}/jobs">See every open job</a></p>`,
  });
};

const shareLinks = (url: string, title: string) => {
  const u = encodeURIComponent(url);
  const text = encodeURIComponent(`${stripBrand(title)} - JobWahala`);
  return [
    ['WhatsApp', `https://wa.me/?text=${text}%20${u}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ['X', `https://twitter.com/intent/tweet?text=${text}&url=${u}`],
  ] as const;
};

export type BlogPostPage = BlogCard & { updatedAt: Date };

export const renderBlogPostPage = (rawPost: BlogPostPage, more: BlogCard[], siteUrl: string) => {
  const post = { ...rawPost, title: stripBrand(rawPost.title) };
  const url = `${siteUrl}/blog/${post.slug}`;
  const cover = post.coverImageUrl ? absolute(post.coverImageUrl, siteUrl) : null;
  const share = shareLinks(url, post.title)
    .map(([name, href]) => `<a href="${e(href)}" rel="noopener" target="_blank">${name}</a>`)
    .join(' · ');

  return renderShell({
    title: post.title,
    description: post.metaDescription,
    url,
    siteUrl,
    ogType: 'article',
    image: cover ? { url: cover, alt: post.coverImageAlt ?? post.title, width: 1200, height: 675 } : undefined,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.metaDescription,
        ...(cover ? { image: [cover] } : {}),
        datePublished: post.publishAt?.toISOString(),
        dateModified: post.updatedAt.toISOString(),
        author: { '@type': 'Person', name: post.authorName },
        publisher: { '@type': 'Organization', name: 'JobWahala', logo: { '@type': 'ImageObject', url: `${siteUrl}/icon-512.png` } },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        articleSection: blogCategoryLabel(post.category),
      },
      breadcrumbJsonLd(siteUrl, [
        { label: 'Home', path: '/' },
        { label: 'Blog', path: '/blog' },
        { label: post.title, path: `/blog/${post.slug}` },
      ]),
    ],
    body: `<nav aria-label="Breadcrumb"><a href="${e(siteUrl)}/">Home</a> &gt; <a href="${e(siteUrl)}/blog">Blog</a> &gt; ${e(post.title)}</nav>
<article>
<p><a href="${e(`${siteUrl}/blog?category=${post.category}`)}">${e(blogCategoryLabel(post.category))}</a></p>
<h1>${e(post.title)}</h1>
<p>By ${e(post.authorName)} · <time datetime="${e(isoDay(post.publishAt))}">${e(day(post.publishAt))}</time> · ${readingMinutes(post.body)} min read</p>
${cover ? `<img src="${e(cover)}" alt="${e(post.coverImageAlt ?? post.title)}" width="1200" height="675">\n` : ''}${renderMarkdown(post.body)}
</article>
<p>Share this article: ${share}</p>
<aside>
<h2>Looking for work or hiring?</h2>
<p><a href="${e(siteUrl)}/jobs">Browse open jobs on JobWahala</a> or <a href="${e(whatsappChannelUrl())}" rel="noopener me">follow our WhatsApp channel</a> to get new jobs on your phone.</p>
</aside>
${more.length ? `<h2>More from the blog</h2>\n${more.map((item) => cardHtml(item, siteUrl)).join('\n')}` : ''}`,
  });
};
