import { Response } from 'express';
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
