import { escapeHtml } from './sharePage';

/** The topics a post can be about. The slug is used in the address (?category=cv-tips) and stored with the post. */
export const BLOG_CATEGORIES = [
  { slug: 'cv-tips', label: 'CV tips' },
  { slug: 'interview-tips', label: 'Interview tips' },
  { slug: 'scam-alerts', label: 'Scam alerts' },
  { slug: 'nss-graduates', label: 'NSS & graduates' },
  { slug: 'employer-advice', label: 'Employer advice' },
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]['slug'];
export const blogCategorySlugs = BLOG_CATEGORIES.map((category) => category.slug) as [BlogCategory, ...BlogCategory[]];
export const blogCategoryLabel = (slug: string) => BLOG_CATEGORIES.find((category) => category.slug === slug)?.label ?? slug;
export const isBlogCategory = (value: string | undefined): value is BlogCategory => BLOG_CATEGORIES.some((category) => category.slug === value);

export const slugifyTitle = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/, '');

/** Posts everyone can read: published, and the publish time has come. A future publish time means "scheduled". */
export const publicPostWhere = (now = new Date()) => ({ status: 'PUBLISHED', publishAt: { lte: now } });

export const postState = (post: { status: string; publishAt: Date | null }, now = new Date()): 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' => {
  if (post.status !== 'PUBLISHED') return 'DRAFT';
  return post.publishAt && post.publishAt > now ? 'SCHEDULED' : 'PUBLISHED';
};

// ---- Markdown to safe HTML

const safeUrl = (url: string) => {
  const value = url.trim();
  if (/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(value)) return value;
  return null;
};

const inline = (raw: string) => {
  // Escape everything first, so nothing typed in a post can become a tag; then turn the Markdown marks into tags.
  let text = escapeHtml(raw);

  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_all, alt: string, url: string) => {
    const safe = safeUrl(url.replace(/&amp;/g, '&'));
    return safe && !safe.startsWith('mailto:') ? `<img src="${escapeHtml(safe)}" alt="${alt}" loading="lazy">` : alt;
  });

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_all, label: string, url: string) => {
    const safe = safeUrl(url.replace(/&amp;/g, '&'));
    if (!safe) return label;
    const external = /^https?:\/\//i.test(safe);
    return `<a href="${escapeHtml(safe)}"${external ? ' rel="noopener" target="_blank"' : ''}>${label}</a>`;
  });

  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=$|[\s).,;:!?])/g, '$1<em>$2</em>').replace(/(^|[\s(])_([^_\s][^_]*)_(?=$|[\s).,;:!?])/g, '$1<em>$2</em>');
  return text;
};

/**
 * Turns the Markdown a post is written in into HTML. Headings (# and ## become H2, ### becomes H3, because the title is the H1),
 * bold, italics, bullet and numbered lists, links, images and paragraphs. Any HTML typed into the post is shown as text.
 */
export const renderMarkdown = (markdown: string): string => {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const bullet = /^[-*+]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);

    if (!line) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      html.push(heading[1].length >= 3 ? `<h3>${inline(heading[2])}</h3>` : `<h2>${inline(heading[2])}</h2>`);
    } else if (bullet || numbered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list = list ?? { tag, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return html.join('\n');
};

/** The plain words of a post, for the reading time and a fallback description. */
export const plainText = (markdown: string) =>
  markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const readingMinutes = (markdown: string) => Math.max(1, Math.round(plainText(markdown).split(' ').filter(Boolean).length / 200));

/** A cover image address that the site can show: a normal https address or one of our own paths. */
export const isUsableImageUrl = (value: string) => /^(https:\/\/|\/api\/uploads\/|\/people\/)/i.test(value);
