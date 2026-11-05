import path from 'path';
import { Request, Response } from 'express';
import env from '../config/env';
import { getLocalEvidenceUploadsDir } from '../services/evidenceStorage';
import { canViewUpload } from '../services/fileAccessService';
import { buildSignedPath, parseUploadRef, SIGNED_LINK_TTL_MS, verifySignedPath } from '../utils/fileAccess';
import { AuthRequest } from '../middleware/auth';
import {
  saveEvidenceUpload,
  UploadCategory,
  UploadContentType,
  UploadValidationError,
} from '../utils/uploads';
import { getErrorMessage } from '../utils/errors';

export const uploadEvidence = async (req: AuthRequest, res: Response) => {
  try {
    const { category, fileName, contentType, dataBase64 } = req.body as {
      category: UploadCategory;
      fileName: string;
      contentType: UploadContentType;
      dataBase64: string;
    };

    const uploadedFile = await saveEvidenceUpload({
      category,
      fileName,
      contentType,
      dataBase64,
      uploaderId: req.user!.id,
    });

    return res.status(201).json({
      success: true,
      file: {
        url: uploadedFile.url,
        originalFileName: uploadedFile.originalFileName,
        contentType: uploadedFile.contentType,
        sizeBytes: uploadedFile.sizeBytes,
      },
    });
  } catch (error) {
    const message = getErrorMessage(error, 'Unable to upload evidence right now');
    const statusCode =
      error instanceof UploadValidationError || message.includes('5 MB') || message.includes('empty') ? 400 : 500;

    return res.status(statusCode).json({ success: false, message });
  }
};

/**
 * Gives a signed-in person a short-lived link to one private file, but only if they are allowed
 * to see that file. Anything that is not a private upload (a public logo, or a link someone
 * pasted) is returned unchanged.
 */
export const signUploadUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body as { url: string };
    const ref = parseUploadRef(url);

    if (!ref) {
      return res.json({ success: true, protected: false, url });
    }

    if (!(await canViewUpload(req.user!, ref))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this file' });
    }

    return res.json({
      success: true,
      protected: true,
      url: buildSignedPath(ref, env.jwtSecret),
      expiresInSeconds: SIGNED_LINK_TTL_MS / 1000,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Serves a private file, but only with a valid, unexpired signature from signUploadUrl. */
export const serveProtectedUpload = (req: Request, res: Response) => {
  const ref = parseUploadRef(`/api/uploads/${req.params.category}/${req.params.file}`);

  if (!ref) {
    return res.status(404).json({ success: false, message: 'File not found' });
  }

  if (!verifySignedPath({ path: ref.path, exp: req.query.exp, sig: req.query.sig, secret: env.jwtSecret })) {
    return res.status(403).json({ success: false, message: 'This link has expired or is not valid' });
  }

  const absolutePath = path.join(getLocalEvidenceUploadsDir(), ref.category, ref.fileName);

  return res.sendFile(
    absolutePath,
    {
      dotfiles: 'deny',
      headers: {
        // A CV is downloaded, never shown inside the page.
        ...(ref.category === 'cv' ? { 'Content-Disposition': 'attachment' } : {}),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    },
    (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ success: false, message: 'File not found' });
      }
    },
  );
};
