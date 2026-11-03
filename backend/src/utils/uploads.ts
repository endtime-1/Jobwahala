import { randomUUID } from 'crypto';
import path from 'path';
import { persistEvidenceFile } from '../services/evidenceStorage';

// "logo" files are shown publicly (company logos), so they get stricter checks than private evidence.
export const uploadCategoryValues = ['verification', 'dispute', 'message', 'logo'] as const;
export type UploadCategory = typeof uploadCategoryValues[number];

export const uploadContentTypeValues = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;
export type UploadContentType = typeof uploadContentTypeValues[number];

const extensionByContentType: Record<UploadContentType, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export const maxEvidenceFileBytes = 5 * 1024 * 1024;
export const maxLogoFileBytes = 1024 * 1024;

export class UploadValidationError extends Error {}

// The browser tells us the file type, so for public images we also check the real file signature.
export const hasMatchingImageSignature = (buffer: Buffer, contentType: UploadContentType) => {
  if (contentType === 'image/png') {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === 'image/jpeg') {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === 'image/webp') {
    return buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
};

export const assertUploadAllowed = ({
  category,
  contentType,
  buffer,
}: {
  category: UploadCategory;
  contentType: UploadContentType;
  buffer: Buffer;
}) => {
  if (!buffer.length) {
    throw new UploadValidationError('Evidence upload content is empty');
  }

  if (buffer.byteLength > maxEvidenceFileBytes) {
    throw new UploadValidationError('Evidence files must be 5 MB or smaller');
  }

  if (category === 'logo') {
    if (contentType === 'application/pdf') {
      throw new UploadValidationError('Logos must be a PNG, JPG or WEBP image');
    }
    if (buffer.byteLength > maxLogoFileBytes) {
      throw new UploadValidationError('Logos must be 1 MB or smaller');
    }
    if (!hasMatchingImageSignature(buffer, contentType)) {
      throw new UploadValidationError('That file is not a valid image of the type it claims to be');
    }
  }
};

const normalizeBase64Payload = (dataBase64: string) => {
  const trimmed = dataBase64.trim();
  const separatorIndex = trimmed.indexOf(',');
  return trimmed.startsWith('data:') && separatorIndex >= 0
    ? trimmed.slice(separatorIndex + 1)
    : trimmed;
};

export const saveEvidenceUpload = async ({
  category,
  fileName,
  contentType,
  dataBase64,
}: {
  category: UploadCategory;
  fileName: string;
  contentType: UploadContentType;
  dataBase64: string;
}) => {
  const encodedPayload = normalizeBase64Payload(dataBase64);
  const buffer = Buffer.from(encodedPayload, 'base64');

  assertUploadAllowed({ category, contentType, buffer });

  const extension = extensionByContentType[contentType];
  const safeBaseName = path
    .basename(fileName, path.extname(fileName))
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'evidence';
  const storedFileName = `${Date.now()}-${randomUUID()}-${safeBaseName}${extension}`;
  return persistEvidenceFile({
    category,
    storedFileName,
    originalFileName: fileName,
    contentType,
    buffer,
  });
};
