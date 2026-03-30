import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  saveEvidenceUpload,
  UploadCategory,
  UploadContentType,
} from '../utils/uploads';

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
  } catch (error: any) {
    const message = error?.message || 'Unable to upload evidence right now';
    const statusCode =
      message.includes('5 MB') || message.includes('empty') ? 400 : 500;

    return res.status(statusCode).json({ success: false, message });
  }
};
