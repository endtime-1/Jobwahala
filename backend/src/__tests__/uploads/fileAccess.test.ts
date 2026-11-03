import { describe, expect, it } from 'vitest';
import {
  buildSignedPath,
  fileWasUploadedBy,
  parseUploadRef,
  SIGNED_LINK_TTL_MS,
  uploaderTag,
  verifySignedPath,
} from '../../utils/fileAccess';

const secret = 'test-secret';

describe('parseUploadRef', () => {
  it('reads relative and absolute stored addresses', () => {
    expect(parseUploadRef('/api/uploads/verification/123-abc-id.pdf')).toEqual({
      category: 'verification',
      fileName: '123-abc-id.pdf',
      path: '/api/uploads/verification/123-abc-id.pdf',
    });
    expect(parseUploadRef('https://www.jobwahala.com/api/uploads/dispute/x.png?foo=1')?.path).toBe('/api/uploads/dispute/x.png');
    expect(parseUploadRef('http://localhost:5173/api/uploads/message/a-b.webp')?.category).toBe('message');
  });

  it('does not treat public logos or other addresses as protected files', () => {
    expect(parseUploadRef('/api/uploads/logo/a.png')).toBeNull();
    expect(parseUploadRef('https://evil.example.com/files/a.png')).toBeNull();
    expect(parseUploadRef('/api/jobs')).toBeNull();
  });

  it('rejects anything that could point outside the uploads folder', () => {
    expect(parseUploadRef('/api/uploads/verification/../../etc/passwd')).toBeNull();
    expect(parseUploadRef('/api/uploads/verification/%2e%2e/secret.pdf')).toBeNull();
    expect(parseUploadRef('/api/uploads/verification/.env')).toBeNull();
    expect(parseUploadRef('/api/uploads/verification/a/b.pdf')).toBeNull();
    expect(parseUploadRef('/api/uploads/verification/a%2Fb.pdf')).toBeNull();
    expect(parseUploadRef('/api/uploads/verification/')).toBeNull();
    expect(parseUploadRef('/api/uploads/secrets/file.pdf')).toBeNull();
  });
});

describe('signed links', () => {
  const ref = parseUploadRef('/api/uploads/verification/123-abc-id.pdf')!;
  const query = (signed: string) => Object.fromEntries(new URL(signed, 'http://x').searchParams);

  it('verifies a freshly signed link', () => {
    const signed = buildSignedPath(ref, secret, 1_000);
    const { exp, sig } = query(signed);

    expect(signed.startsWith('/api/uploads/verification/123-abc-id.pdf?exp=')).toBe(true);
    expect(verifySignedPath({ path: ref.path, exp, sig, secret, now: 1_001 })).toBe(true);
  });

  it('expires after the lifetime', () => {
    const { exp, sig } = query(buildSignedPath(ref, secret, 1_000));

    expect(verifySignedPath({ path: ref.path, exp, sig, secret, now: 1_000 + SIGNED_LINK_TTL_MS + 1 })).toBe(false);
  });

  it('rejects a link reused for a different file', () => {
    const { exp, sig } = query(buildSignedPath(ref, secret, 1_000));

    expect(verifySignedPath({ path: '/api/uploads/verification/other.pdf', exp, sig, secret, now: 1_001 })).toBe(false);
  });

  it('rejects a changed expiry, a wrong secret and a forged or malformed signature', () => {
    const { exp, sig } = query(buildSignedPath(ref, secret, 1_000));

    expect(verifySignedPath({ path: ref.path, exp: String(Number(exp) + 999_999), sig, secret, now: 1_001 })).toBe(false);
    expect(verifySignedPath({ path: ref.path, exp, sig, secret: 'another-secret', now: 1_001 })).toBe(false);
    expect(verifySignedPath({ path: ref.path, exp, sig: 'a'.repeat(64), secret, now: 1_001 })).toBe(false);
    expect(verifySignedPath({ path: ref.path, exp, sig: 'zz', secret, now: 1_001 })).toBe(false);
    expect(verifySignedPath({ path: ref.path, exp: undefined, sig: undefined, secret, now: 1_001 })).toBe(false);
    expect(verifySignedPath({ path: ref.path, exp: 'abc', sig, secret, now: 1_001 })).toBe(false);
  });
});

describe('uploader tag', () => {
  it('lets a person recognise their own new files, and nobody else', () => {
    const tag = uploaderTag('user-1', secret);
    const fileName = `1700000000000-u${tag}-uuid-evidence.pdf`;

    expect(fileWasUploadedBy(fileName, 'user-1', secret)).toBe(true);
    expect(fileWasUploadedBy(fileName, 'user-2', secret)).toBe(false);
    expect(fileWasUploadedBy('1700000000000-uuid-legacy.pdf', 'user-1', secret)).toBe(false);
  });

  it('does not reveal the user id', () => {
    expect(uploaderTag('user-1', secret)).not.toContain('user-1');
    expect(uploaderTag('user-1', secret)).toHaveLength(12);
  });
});
