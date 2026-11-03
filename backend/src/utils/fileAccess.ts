import crypto from 'crypto';

/** Folders whose files are private. Logos live in a separate, intentionally public folder. */
export const privateUploadCategories = ['verification', 'dispute', 'message'] as const;
export type PrivateUploadCategory = (typeof privateUploadCategories)[number];

export const SIGNED_LINK_TTL_MS = 5 * 60 * 1000;

const UPLOAD_PREFIX = '/api/uploads/';

export type UploadRef = {
  category: PrivateUploadCategory;
  fileName: string;
  /** Canonical site path, for example /api/uploads/verification/123-abc.pdf */
  path: string;
};

const isSafeFileName = (name: string) =>
  name.length > 0 &&
  name.length <= 220 &&
  name[0] !== '.' &&
  Array.from(name).every((ch) => /[A-Za-z0-9._-]/.test(ch));

/**
 * Reads a stored upload address (relative or absolute) and returns which private file it points
 * to, or null for anything else. File names are strictly checked so a crafted value can never
 * point outside the uploads folder.
 */
export const parseUploadRef = (value: string): UploadRef | null => {
  let pathname: string;
  try {
    pathname = new URL(value.trim(), 'http://placeholder.invalid').pathname;
  } catch {
    return null;
  }

  if (!pathname.startsWith(UPLOAD_PREFIX)) return null;

  const parts = pathname.slice(UPLOAD_PREFIX.length).split('/');
  if (parts.length !== 2) return null;

  const [category, fileName] = parts;
  if (!(privateUploadCategories as readonly string[]).includes(category)) return null;
  if (!isSafeFileName(fileName)) return null;

  return { category: category as PrivateUploadCategory, fileName, path: `${UPLOAD_PREFIX}${category}/${fileName}` };
};

const signature = (path: string, expiresAt: number, secret: string) =>
  crypto.createHmac('sha256', secret).update(`${path}|${expiresAt}`).digest('hex');

/** A site path that works without a login until it expires. */
export const buildSignedPath = (ref: UploadRef, secret: string, now = Date.now(), ttlMs = SIGNED_LINK_TTL_MS) => {
  const expiresAt = now + ttlMs;
  return `${ref.path}?exp=${expiresAt}&sig=${signature(ref.path, expiresAt, secret)}`;
};

export const verifySignedPath = ({
  path,
  exp,
  sig,
  secret,
  now = Date.now(),
}: {
  path: string;
  exp: unknown;
  sig: unknown;
  secret: string;
  now?: number;
}) => {
  if (typeof exp !== 'string' || typeof sig !== 'string') return false;

  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false;

  const expected = Buffer.from(signature(path, expiresAt, secret), 'hex');
  const provided = Buffer.from(sig, 'hex');

  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
};

/**
 * New uploads carry a short, non-reversible tag of whoever uploaded them in the file name, so a
 * person can preview their own file before it is attached to a verification request, dispute or
 * message.
 */
export const uploaderTag = (userId: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(`uploader:${userId}`).digest('hex').slice(0, 12);

export const fileWasUploadedBy = (fileName: string, userId: string, secret: string) =>
  fileName.includes(`-u${uploaderTag(userId, secret)}-`);
