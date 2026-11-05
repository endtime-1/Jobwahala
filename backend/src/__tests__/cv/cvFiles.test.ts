import { describe, expect, it } from 'vitest';
import {
  CvFileError,
  DOCX_CONTENT_TYPE,
  PDF_CONTENT_TYPE,
  assertCvFile,
  maxCvFileBytes,
  readZipEntries,
} from '../../utils/cvFiles';
import { UploadValidationError, assertUploadAllowed, uploadCategoryValues, uploadContentTypeValues } from '../../utils/uploads';
import { privateUploadCategories } from '../../utils/fileAccess';
import { uploadEvidenceSchema } from '../../validation/uploadSchemas';

// ---- tiny builders, so the tests can make real files without a library ----

const pdf = (body = 'BT /F1 12 Tf (Ama Mensah, receptionist) Tj ET') =>
  Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n${body}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`, 'latin1');

type ZipPart = { name: string; content?: string; claimedSize?: number };

/** A real (stored, uncompressed) zip archive. */
export const makeZip = (parts: ZipPart[]) => {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const part of parts) {
    const name = Buffer.from(part.name, 'utf8');
    const data = Buffer.from(part.content ?? '<xml/>', 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(part.claimedSize ?? data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += 30 + name.length + data.length;
  }

  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBytes, end]);
};

const goodDocxParts: ZipPart[] = [
  { name: '[Content_Types].xml' },
  { name: '_rels/.rels' },
  { name: 'word/document.xml', content: '<w:document>Ama Mensah</w:document>' },
  { name: 'word/styles.xml' },
];
const docx = (extra: ZipPart[] = [], base: ZipPart[] = goodDocxParts) => makeZip([...base, ...extra]);

describe('PDF CVs', () => {
  it('accepts an ordinary PDF', () => {
    expect(() => assertCvFile(PDF_CONTENT_TYPE, pdf())).not.toThrow();
  });

  it('rejects a file that only claims to be a PDF', () => {
    expect(() => assertCvFile(PDF_CONTENT_TYPE, Buffer.from('MZ\u0090\u0000 this is a program, not a pdf at all, honest'))).toThrow(/not a valid PDF/);
    expect(() => assertCvFile(PDF_CONTENT_TYPE, Buffer.from('<html><script>alert(1)</script></html>'))).toThrow(CvFileError);
  });

  it('rejects an empty or tiny file', () => {
    expect(() => assertCvFile(PDF_CONTENT_TYPE, Buffer.alloc(0))).toThrow(CvFileError);
    expect(() => assertCvFile(PDF_CONTENT_TYPE, Buffer.from('%PDF-1'))).toThrow(CvFileError);
  });

  it('rejects a PDF cut off before its end', () => {
    expect(() => assertCvFile(PDF_CONTENT_TYPE, Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n'))).toThrow(/incomplete or damaged/);
  });

  it.each([
    ['JavaScript', '<< /S /JavaScript /JS (app.alert(1)) >>'],
    ['a short JS action', '<< /S /JS /JS (x) >>'],
    ['a launch action', '<< /S /Launch /F (cmd.exe) >>'],
    ['an attached file', '<< /Type /EmbeddedFile >>'],
    ['rich media', '<< /Subtype /RichMedia >>'],
    ['an XFA form', '<< /XFA 5 0 R >>'],
  ])('rejects a PDF carrying %s', (_name, body) => {
    expect(() => assertCvFile(PDF_CONTENT_TYPE, pdf(body))).toThrow(/scripts or attachments/);
  });

  it('does not mistake harmless words for scripts', () => {
    expect(() => assertCvFile(PDF_CONTENT_TYPE, pdf('(Worked with JSON and JavaScriptless pages) /JSON'))).not.toThrow();
  });
});

describe('Word (.docx) CVs', () => {
  it('accepts a real Word document', () => {
    expect(() => assertCvFile(DOCX_CONTENT_TYPE, docx())).not.toThrow();
  });

  it('reads the parts of a zip', () => {
    expect(readZipEntries(docx()).map((entry) => entry.name)).toContain('word/document.xml');
  });

  it('rejects something that is not a zip at all', () => {
    expect(() => assertCvFile(DOCX_CONTENT_TYPE, pdf())).toThrow(/not a valid Word/);
    expect(() => assertCvFile(DOCX_CONTENT_TYPE, Buffer.from('plain text pretending to be a document'))).toThrow(CvFileError);
  });

  it('rejects a zip that is not a Word document', () => {
    const notWord = makeZip([{ name: 'photos/cat.jpg' }, { name: 'notes.txt' }]);
    expect(() => assertCvFile(DOCX_CONTENT_TYPE, notWord)).toThrow(/not a Word/);
    expect(() => assertCvFile(DOCX_CONTENT_TYPE, makeZip([{ name: '[Content_Types].xml' }]))).toThrow(/not a Word/);
  });

  it('rejects a zip cut off before its end', () => {
    const whole = docx();
    expect(() => assertCvFile(DOCX_CONTENT_TYPE, whole.subarray(0, whole.length - 30))).toThrow(CvFileError);
  });

  it.each([
    ['a macro project', 'word/vbaProject.bin'],
    ['a macros folder', 'word/macros/module1.bas'],
    ['an embedded object', 'word/embeddings/oleObject1.bin'],
    ['an ActiveX control', 'word/activeX/activeX1.xml'],
  ])('rejects a document with %s', (_name, entry) => {
    expect(() => assertCvFile(DOCX_CONTENT_TYPE, docx([{ name: entry }]))).toThrow(/macros or embedded/);
  });

  it('rejects hidden programs and paths that climb out of the folder', () => {
    expect(() => assertCvFile(DOCX_CONTENT_TYPE, docx([{ name: 'word/media/run.exe' }]))).toThrow(/cannot be accepted/);
    expect(() => assertCvFile(DOCX_CONTENT_TYPE, docx([{ name: '../../etc/passwd' }]))).toThrow(/cannot be accepted/);
  });

  it('rejects a zip bomb: a small file that claims to unpack to a huge size', () => {
    const bomb = docx([{ name: 'word/media/huge.bin', claimedSize: 4_000_000_000 }]);
    expect(bomb.length).toBeLessThan(maxCvFileBytes);
    expect(() => assertCvFile(DOCX_CONTENT_TYPE, bomb)).toThrow(/too large once opened/);
  });

  it('rejects a zip with an absurd number of parts', () => {
    const many = makeZip(Array.from({ length: 1200 }, (_, i) => ({ name: `word/media/${i}.xml` })));
    expect(() => assertCvFile(DOCX_CONTENT_TYPE, many)).toThrow(/too many parts/);
  });
});

describe('size and type', () => {
  it('accepts up to 3 MB and not a byte more', () => {
    expect(maxCvFileBytes).toBe(3 * 1024 * 1024);
    const filler = 'x'.repeat(maxCvFileBytes);
    expect(() => assertCvFile(PDF_CONTENT_TYPE, Buffer.concat([pdf(), Buffer.from(filler)]))).toThrow(/3 MB or smaller/);
  });

  it('accepts only PDF and Word', () => {
    for (const type of ['image/png', 'image/jpeg', 'text/plain', 'application/msword', 'application/zip']) {
      expect(() => assertCvFile(type, pdf())).toThrow(/PDF or a Word/);
    }
  });
});

describe('as part of the upload rules', () => {
  const check = (category: (typeof uploadCategoryValues)[number], contentType: string, buffer: Buffer) =>
    assertUploadAllowed({ category, contentType: contentType as never, buffer });

  it('CVs are a known, private upload category, and Word is a known type', () => {
    expect(uploadCategoryValues).toContain('cv');
    expect(privateUploadCategories).toContain('cv');
    expect(uploadContentTypeValues).toContain(DOCX_CONTENT_TYPE);
  });

  it('accepts a good PDF and a good Word CV', () => {
    expect(() => check('cv', PDF_CONTENT_TYPE, pdf())).not.toThrow();
    expect(() => check('cv', DOCX_CONTENT_TYPE, docx())).not.toThrow();
  });

  it('turns every CV problem into a plain upload error the person can read', () => {
    expect(() => check('cv', PDF_CONTENT_TYPE, pdf('/JavaScript'))).toThrow(UploadValidationError);
    expect(() => check('cv', DOCX_CONTENT_TYPE, pdf())).toThrow(UploadValidationError);
    expect(() => check('cv', 'image/png', pdf())).toThrow(/PDF or a Word/);
  });

  it('applies the CV size limit, which is smaller than for other evidence', () => {
    const big = Buffer.concat([pdf(), Buffer.alloc(4 * 1024 * 1024, 120)]);
    expect(() => check('cv', PDF_CONTENT_TYPE, big)).toThrow(/3 MB/);
    expect(() => check('verification', PDF_CONTENT_TYPE, big)).not.toThrow();
  });

  it('keeps Word files out of every other kind of upload', () => {
    for (const category of ['verification', 'dispute', 'message'] as const) {
      expect(() => check(category, DOCX_CONTENT_TYPE, docx())).toThrow(/only accepted for CVs/);
    }
    expect(() => check('logo', DOCX_CONTENT_TYPE, docx())).toThrow(UploadValidationError);
  });

  it('other uploads keep working exactly as before', () => {
    expect(() => check('verification', PDF_CONTENT_TYPE, pdf('/JavaScript'))).not.toThrow();
    expect(() => check('message', 'image/png', Buffer.from('anything'))).not.toThrow();
  });

  it('the upload request accepts the cv category and Word files', () => {
    const body = { category: 'cv', fileName: 'My CV.docx', contentType: DOCX_CONTENT_TYPE, dataBase64: 'A'.repeat(40) };
    expect(uploadEvidenceSchema.safeParse({ body }).success).toBe(true);
    expect(uploadEvidenceSchema.safeParse({ body: { ...body, contentType: 'application/msword' } }).success).toBe(false);
  });
});
