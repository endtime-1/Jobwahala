import type { NextFunction, Request, RequestHandler, Response } from 'express';
import env from '../config/env';
import logger from '../config/logger';

/**
 * Public pages are rendered on the server so everyone, search engines included, gets the real content in the HTML.
 * People still need the app, so the page is merged into the app's own built shell (its script and style tags):
 * the browser shows the content straight away, then React takes over the #root element.
 */

const SHELL_TTL_MS = 30 * 1000;
const PAGE_TTL_MS = 60 * 1000;
const MAX_CACHED_PAGES = 300;

const SHELL_TAGS = [
  /<script\b[^>]*\btype="module"[^>]*><\/script>/gi,
  /<link\b[^>]*\brel="(?:stylesheet|modulepreload|preload)"[^>]*>/gi,
  /<meta\b[^>]*\bname="theme-color"[^>]*>/gi,
];

/** The script, style and icon tags of the built app, taken from its index.html. */
export const appShellTags = (shell: string) => {
  const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(shell)?.[1] ?? '';
  return SHELL_TAGS.flatMap((pattern) => head.match(pattern) ?? []);
};

/** Puts the app's tags into a server-rendered page and wraps its content in the #root element the app takes over. */
export const mergeIntoAppShell = (page: string, shell: string | null): string => {
  if (!shell || page.includes('id="root"')) return page;
  const tags = appShellTags(shell);
  if (!tags.some((tag) => tag.includes('type="module"'))) return page;

  const viewport = /name="viewport"/i.test(page) ? '' : '<meta name="viewport" content="width=device-width, initial-scale=1">\n';
  return page
    .replace('</head>', () => `${viewport}${tags.join('\n')}\n</head>`)
    .replace(/<body[^>]*>/i, (open) => `${open}\n<div id="root">`)
    .replace('</body>', () => '</div>\n</body>');
};

let shellCache: { at: number; html: string } | null = null;

/** The built app's index.html, fetched from the website and kept for a short time. Null when it cannot be reached. */
export const loadAppShell = async (): Promise<string | null> => {
  if (shellCache && Date.now() - shellCache.at < SHELL_TTL_MS) return shellCache.html;
  // Tests never reach out to a website.
  if (process.env.NODE_ENV === 'test' && !process.env.APP_SHELL_URL) return null;

  const base = (process.env.APP_SHELL_URL || env.frontendBaseUrl).replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/index.html`, { signal: AbortSignal.timeout(3000), headers: { 'user-agent': 'JobWahala-page-renderer' } });
    const html = response.ok ? await response.text() : '';
    if (html.includes('type="module"')) {
      shellCache = { at: Date.now(), html };
      return html;
    }
    logger.warn('app_shell_unusable', { status: response.status });
  } catch (error) {
    logger.warn('app_shell_unreachable', { error: error instanceof Error ? error.message : String(error) });
  }
  // A slightly old shell still boots the app unless a deploy just removed its files.
  return shellCache?.html ?? null;
};

export const resetAppShellCache = () => {
  shellCache = null;
};

const BOT_AGENT = /bot|crawl|spider|slurp|whatsapp|facebookexternalhit|facebot|slack|telegram|discord|inspectiontool|google|applebot|preview/i;

type ShellLoader = () => Promise<string | null>;

/**
 * Sends HTML pages merged into the app shell, and keeps good pages for a minute so busy pages do not hit the database
 * on every visit. Without a shell, crawlers still get the plain page; people get a 503 so the website falls back to the app.
 */
export const appShellMiddleware = (loader: ShellLoader = loadAppShell): RequestHandler => {
  const pages = new Map<string, { at: number; html: string }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.originalUrl;
    const cached = pages.get(key);
    if (cached && Date.now() - cached.at < PAGE_TTL_MS) {
      res.status(200).type('html').set('Cache-Control', 'no-cache').send(cached.html);
      return;
    }

    const send = res.send.bind(res);
    res.send = ((body?: unknown) => {
      const isHtml = typeof body === 'string' && String(res.getHeader('Content-Type') ?? '').includes('html');
      if (!isHtml || res.statusCode >= 500) return send(body as never);

      void loader()
        .then((shell) => {
          if (!shell && !BOT_AGENT.test(req.get('user-agent') ?? '') && process.env.NODE_ENV !== 'test') {
            res.status(503).set('Retry-After', '30').type('text/plain');
            send('Temporarily unavailable. Please retry shortly.');
            return;
          }
          const html = mergeIntoAppShell(body as string, shell);
          res.set('Cache-Control', 'no-cache');
          if (res.statusCode === 200) {
            if (pages.size >= MAX_CACHED_PAGES) pages.delete(pages.keys().next().value as string);
            pages.set(key, { at: Date.now(), html });
          }
          send(html);
        })
        .catch(() => send(body as never));
      return res;
    }) as typeof res.send;

    next();
  };
};
