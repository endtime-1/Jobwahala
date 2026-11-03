import { describe, expect, it } from 'vitest';
import {
  assertUploadAllowed,
  hasMatchingImageSignature,
  maxLogoFileBytes,
  UploadValidationError,
} from '../../utils/uploads';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(40)]);

describe('hasMatchingImageSignature', () => {
  it('recognises real PNG, JPEG and WEBP files', () => {
    expect(hasMatchingImageSignature(png, 'image/png')).toBe(true);
    expect(hasMatchingImageSignature(jpeg, 'image/jpeg')).toBe(true);
    expect(hasMatchingImageSignature(webp, 'image/webp')).toBe(true);
  });

  it('rejects a file whose bytes do not match the type it claims', () => {
    expect(hasMatchingImageSignature(jpeg, 'image/png')).toBe(false);
    expect(hasMatchingImageSignature(Buffer.from('<html><script>alert(1)</script></html>'), 'image/png')).toBe(false);
    expect(hasMatchingImageSignature(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/webp')).toBe(false);
  });

  it('never treats a PDF as an image', () => {
    expect(hasMatchingImageSignature(Buffer.from('%PDF-1.7'), 'application/pdf')).toBe(false);
  });
});

describe('assertUploadAllowed for logos', () => {
  it('accepts a real image under 1 MB', () => {
    expect(() => assertUploadAllowed({ category: 'logo', contentType: 'image/png', buffer: png })).not.toThrow();
  });

  it('rejects PDFs, disguised files and oversized images with a clear message', () => {
    expect(() => assertUploadAllowed({ category: 'logo', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 x') })).toThrow(
      /PNG, JPG or WEBP/,
    );
    expect(() => assertUploadAllowed({ category: 'logo', contentType: 'image/png', buffer: Buffer.from('not an image at all') })).toThrow(
      /not a valid image/,
    );

    const big = Buffer.concat([png, Buffer.alloc(maxLogoFileBytes)]);
    expect(() => assertUploadAllowed({ category: 'logo', contentType: 'image/png', buffer: big })).toThrow(/1 MB or smaller/);
  });

  it('throws a typed error so the API can answer 400 instead of 500', () => {
    try {
      assertUploadAllowed({ category: 'logo', contentType: 'image/png', buffer: Buffer.from('nope') });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UploadValidationError);
    }
  });
});

describe('assertUploadAllowed for private evidence (unchanged behaviour)', () => {
  it('still accepts a PDF of any content, as before', () => {
    expect(() => assertUploadAllowed({ category: 'verification', contentType: 'application/pdf', buffer: Buffer.from('plain text evidence') })).not.toThrow();
  });

  it('still rejects empty files and files over 5 MB', () => {
    expect(() => assertUploadAllowed({ category: 'dispute', contentType: 'image/png', buffer: Buffer.alloc(0) })).toThrow(/empty/);
    expect(() => assertUploadAllowed({ category: 'message', contentType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })).toThrow(/5 MB/);
  });
});
