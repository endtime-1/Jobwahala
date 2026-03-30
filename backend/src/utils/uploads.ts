import { randomUUID } from 'crypto';
import path from 'path';
import { persistEvidenceFile } from '../services/evidenceStorage';

export const uploadCategoryValues = ['verification', 'dispute', 'message'] as const;
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

  if (!buffer.length) {
    throw new Error('Evidence upload content is empty');
  }

  if (buffer.byteLength > maxEvidenceFileBytes) {
    throw new Error('Evidence files must be 5 MB or smaller');
  }

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
