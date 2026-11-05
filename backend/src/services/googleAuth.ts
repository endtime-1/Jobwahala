import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * "Continue with Google": checks the ID token Google's sign-in button hands to the browser.
 *
 * The token is a JWT signed by Google. We check the signature against Google's published public keys, that it
 * was issued to OUR client id, that it is from Google, and that it has not expired. Nothing the browser says
 * about itself is trusted until all of that passes.
 */

export const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export class GoogleAuthError extends Error {}

export type GoogleIdentity = {
  /** Google's permanent id for this person. */
  subject: string;
  email: string;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
};

type Jwk = { kid?: string; kty?: string; [field: string]: unknown };

export type KeyFetcher = () => Promise<{ keys: Jwk[]; maxAgeMs: number }>;

const fetchGoogleKeys: KeyFetcher = async () => {
  const response = await fetch(GOOGLE_CERTS_URL, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new GoogleAuthError('Could not reach Google to check your sign-in.');
  const body = (await response.json()) as { keys?: Jwk[] };
  const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '');
  return { keys: body.keys ?? [], maxAgeMs: (maxAge ? Number(maxAge[1]) : 3600) * 1000 };
};

let fetchKeys: KeyFetcher = fetchGoogleKeys;
let cache: { at: number; ttl: number; keys: Jwk[] } | null = null;

/** For tests: use these keys instead of asking Google. Pass nothing to go back to Google. */
export const setGoogleKeyFetcherForTests = (fetcher?: KeyFetcher) => {
  fetchKeys = fetcher ?? fetchGoogleKeys;
  cache = null;
};

const keyFor = async (kid: string) => {
  const fresh = cache && Date.now() - cache.at < cache.ttl;
  let found = fresh ? cache!.keys.find((key) => key.kid === kid) : undefined;

  // An unknown key id may mean Google rotated its keys: look again, but only once per call.
  if (!found) {
    const next = await fetchKeys();
    cache = { at: Date.now(), ttl: next.maxAgeMs, keys: next.keys };
    found = next.keys.find((key) => key.kid === kid);
  }
  if (!found) throw new GoogleAuthError('This Google sign-in could not be checked. Please try again.');
  return crypto.createPublicKey({ key: found as never, format: 'jwk' });
};

export const verifyGoogleIdToken = async (credential: string, clientId: string): Promise<GoogleIdentity> => {
  if (!clientId) throw new GoogleAuthError('Google sign-in is not set up.');

  const decoded = jwt.decode(credential, { complete: true });
  const header = decoded && typeof decoded === 'object' ? decoded.header : null;
  // Only Google's own signing method; this also blocks the "alg: none" and shared-secret tricks.
  if (!header || header.alg !== 'RS256' || !header.kid) {
    throw new GoogleAuthError('This Google sign-in could not be checked. Please try again.');
  }

  let payload: jwt.JwtPayload;
  try {
    const key = await keyFor(header.kid);
    const verified = jwt.verify(credential, key, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: GOOGLE_ISSUERS as [string, ...string[]],
    });
    if (typeof verified === 'string') throw new GoogleAuthError('Unexpected token.');
    payload = verified;
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error;
    throw new GoogleAuthError('This Google sign-in has expired or is not valid. Please try again.');
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!payload.sub || !email) throw new GoogleAuthError('Google did not share an email address with us.');

  return {
    subject: String(payload.sub),
    email,
    // Google sends this as a boolean (older tokens as the text "true").
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    givenName: typeof payload.given_name === 'string' ? payload.given_name.trim().slice(0, 80) || null : null,
    familyName: typeof payload.family_name === 'string' ? payload.family_name.trim().slice(0, 80) || null : null,
  };
};
