/**
 * Checks on CV files. A CV is opened by employers, so it gets stricter checks than other evidence:
 * it must really be what it says (not a renamed program), small, and free of anything that can run.
 *
 *  - PDF: must start with the PDF marker and end properly, and must not carry scripts, launch actions
 *    or embedded files.
 *  - Word (.docx): must be a real zip archive that holds a Word document, with no macros, no embedded
 *    programs or objects, a sane number of parts and a sane unpacked size (no "zip bombs").
 *
 * These are best-effort checks on the bytes, not a virus scan.
 */

export const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PDF_CONTENT_TYPE = 'application/pdf';
export const cvContentTypes = [PDF_CONTENT_TYPE, DOCX_CONTENT_TYPE] as const;
export const maxCvFileBytes = 3 * 1024 * 1024;

const MAX_ZIP_ENTRIES = 1000;
const MAX_UNPACKED_BYTES = 50 * 1024 * 1024;

export class CvFileError extends Error {}

const PDF_FORBIDDEN = [/\/JavaScript\b/, /\/JS\b/, /\/Launch\b/, /\/EmbeddedFile\b/, /\/RichMedia\b/, /\/XFA\b/];

export const assertPdfIsSafe = (buffer: Buffer) => {
  if (buffer.length < 16 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new CvFileError('That file is not a valid PDF');
  }

  if (!buffer.subarray(Math.max(0, buffer.length - 1024)).toString('latin1').includes('%%EOF')) {
    throw new CvFileError('That PDF looks incomplete or damaged');
  }

  const text = buffer.toString('latin1');
  if (PDF_FORBIDDEN.some((pattern) => pattern.test(text))) {
    throw new CvFileError('PDFs with scripts or attachments cannot be accepted. Save your CV as a plain PDF and try again.');
  }
};

type ZipEntry = { name: string; uncompressedSize: number };

/** Reads the file list from a zip's central directory. Throws when the archive is not a well-formed zip. */
export const readZipEntries = (buffer: Buffer): ZipEntry[] => {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new CvFileError('That file is not a valid Word document');
  }

  // The end-of-central-directory record is within the last 64 KB.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65_535); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new CvFileError('That Word document looks incomplete or damaged');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  if (count > MAX_ZIP_ENTRIES) throw new CvFileError('That Word document has too many parts');

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new CvFileError('That Word document looks damaged');
    }
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const end = offset + 46 + nameLength;
    if (end > buffer.length) throw new CvFileError('That Word document looks damaged');

    entries.push({ name: buffer.subarray(offset + 46, end).toString('utf8'), uncompressedSize });
    offset = end + extraLength + commentLength;
  }

  return entries;
};

export const assertDocxIsSafe = (buffer: Buffer) => {
  const entries = readZipEntries(buffer);
  const names = entries.map((entry) => entry.name.toLowerCase());

  if (!names.includes('[content_types].xml') || !names.includes('word/document.xml')) {
    throw new CvFileError('That file is not a Word (.docx) document');
  }

  // Macros, embedded programs and embedded objects are how Word files carry something that can run.
  if (names.some((name) => name.endsWith('vbaproject.bin') || name.includes('/macros/') || name.startsWith('word/embeddings/') || name.startsWith('word/activex/'))) {
    throw new CvFileError('Word documents with macros or embedded objects cannot be accepted. Save a plain .docx and try again.');
  }

  if (names.some((name) => name.includes('..') || name.startsWith('/') || /\.(exe|dll|bat|cmd|js|vbs|ps1|scr)$/.test(name))) {
    throw new CvFileError('That Word document contains files that cannot be accepted');
  }

  const unpacked = entries.reduce((total, entry) => total + entry.uncompressedSize, 0);
  if (unpacked > MAX_UNPACKED_BYTES) throw new CvFileError('That Word document is too large once opened');
};

/** The one entry point: size, then the checks for whichever type the file claims to be. */
export const assertCvFile = (contentType: string, buffer: Buffer) => {
  if (!(cvContentTypes as readonly string[]).includes(contentType)) {
    throw new CvFileError('CVs must be a PDF or a Word (.docx) file');
  }
  if (buffer.byteLength > maxCvFileBytes) {
    throw new CvFileError('CVs must be 3 MB or smaller');
  }

  if (contentType === PDF_CONTENT_TYPE) assertPdfIsSafe(buffer);
  else assertDocxIsSafe(buffer);
};
