import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fsp from 'fs/promises';
import path from 'path';
import env from '../config/env';
import type { UploadCategory, UploadContentType } from '../utils/uploads';

type PersistEvidenceFileArgs = {
  category: UploadCategory;
  storedFileName: string;
  originalFileName: string;
  contentType: UploadContentType;
  buffer: Buffer;
};

type PersistedEvidenceFile = {
  relativePath: string;
  url: string;
  originalFileName: string;
  contentType: UploadContentType;
  sizeBytes: number;
};

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

const joinPublicUrl = (baseUrl: string, suffix: string) =>
  `${baseUrl.replace(/\/$/, '')}/${suffix.replace(/^\/+/, '')}`;

export const isLocalEvidenceStorage = env.evidenceStorageProvider === 'LOCAL';

export const getLocalEvidenceUploadsDir = () =>
  path.isAbsolute(env.evidenceStorageLocalDir)
    ? env.evidenceStorageLocalDir
    : path.resolve(__dirname, '../..', env.evidenceStorageLocalDir);

let s3Client: S3Client | null = null;

const getS3Client = () => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.evidenceStorageS3Region,
      endpoint: env.evidenceStorageS3Endpoint || undefined,
      forcePathStyle: env.evidenceStorageS3ForcePathStyle,
      credentials: {
        accessKeyId: env.evidenceStorageS3AccessKeyId,
        secretAccessKey: env.evidenceStorageS3SecretAccessKey,
      },
    });
  }

  return s3Client;
};

const buildRelativePath = (category: UploadCategory, storedFileName: string) =>
  `${category}/${storedFileName}`;

const buildObjectKey = (category: UploadCategory, storedFileName: string) => {
  const prefix = trimSlashes(env.evidenceStoragePrefix);
  return [prefix, category, storedFileName].filter(Boolean).join('/');
};

const getPublicUploadPrefix = (category: UploadCategory) => {
  if (isLocalEvidenceStorage) {
    return `/api/uploads/${category}/`;
  }

  const prefix = trimSlashes(env.evidenceStoragePrefix);
  const publicPath = [prefix, category].filter(Boolean).join('/');
  return joinPublicUrl(env.evidenceStorageS3PublicBaseUrl, `${publicPath}/`);
};

export const matchesStoredUploadUrl = (
  category: UploadCategory,
  candidateUrl: string,
) => {
  const trimmed = candidateUrl.trim();

  if (!trimmed) {
    return false;
  }

  const publicPrefix = getPublicUploadPrefix(category);

  if (trimmed.startsWith(publicPrefix)) {
    return true;
  }

  if (!isLocalEvidenceStorage) {
    return false;
  }

  try {
    return new URL(trimmed).pathname.startsWith(publicPrefix);
  } catch {
    return false;
  }
};

const persistToLocalStorage = async ({
  category,
  storedFileName,
  originalFileName,
  contentType,
  buffer,
}: PersistEvidenceFileArgs): Promise<PersistedEvidenceFile> => {
  const uploadsRoot = getLocalEvidenceUploadsDir();
  const categoryDir = path.join(uploadsRoot, category);
  const absolutePath = path.join(categoryDir, storedFileName);
  const relativePath = buildRelativePath(category, storedFileName);

  await fsp.mkdir(categoryDir, { recursive: true });
  await fsp.writeFile(absolutePath, buffer);

  return {
    relativePath,
    url: `/api/uploads/${relativePath}`,
    originalFileName,
    contentType,
    sizeBytes: buffer.byteLength,
  };
};

const persistToS3Storage = async ({
  category,
  storedFileName,
  originalFileName,
  contentType,
  buffer,
}: PersistEvidenceFileArgs): Promise<PersistedEvidenceFile> => {
  const objectKey = buildObjectKey(category, storedFileName);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.evidenceStorageS3Bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return {
    relativePath: objectKey,
    url: joinPublicUrl(env.evidenceStorageS3PublicBaseUrl, objectKey),
    originalFileName,
    contentType,
    sizeBytes: buffer.byteLength,
  };
};

export const persistEvidenceFile = async (
  args: PersistEvidenceFileArgs,
): Promise<PersistedEvidenceFile> => {
  if (isLocalEvidenceStorage) {
    return persistToLocalStorage(args);
  }

  return persistToS3Storage(args);
};
