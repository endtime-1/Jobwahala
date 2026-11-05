import path from 'path';
import { Response } from 'express';
import env from '../config/env';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { fileWasUploadedBy, parseUploadRef } from '../utils/fileAccess';
import { getErrorMessage } from '../utils/errors';

type Slot = 'uploaded' | 'builder';

const present = (url: string | null | undefined, fileName: string | null | undefined, at: Date | null | undefined) =>
  url ? { url, fileName: fileName || 'CV', savedAt: at } : null;

/** The signed-in seeker's two CVs: the file they uploaded, and the one made by the CV builder. */
export const getMyCvFiles = async (req: AuthRequest, res: Response) => {
  try {
    const cv = await prisma.seekerCv.findUnique({ where: { userId: req.user!.id } });
    return res.json({
      success: true,
      uploaded: present(cv?.uploadedUrl, cv?.uploadedFileName, cv?.uploadedAt),
      builder: present(cv?.builderUrl, cv?.builderFileName, cv?.builderSavedAt),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

const cleanFileName = (value: string) => path.basename(value).replace(/[^\w .()-]+/g, '_').slice(0, 120) || 'CV';

const saveSlot = (slot: Slot) => async (req: AuthRequest, res: Response) => {
  try {
    const { url, fileName } = req.body as { url: string; fileName: string };
    const ref = parseUploadRef(url);

    // Only a file this member uploaded as a CV through JobWahala. Never a pasted link or someone else's file.
    if (!ref || ref.category !== 'cv' || !fileWasUploadedBy(ref.fileName, req.user!.id, env.jwtSecret)) {
      return res.status(400).json({ success: false, message: 'Upload your CV first, then save it.' });
    }

    const now = new Date();
    const data =
      slot === 'uploaded'
        ? { uploadedUrl: ref.path, uploadedFileName: cleanFileName(fileName), uploadedAt: now }
        : { builderUrl: ref.path, builderFileName: cleanFileName(fileName), builderSavedAt: now };

    await prisma.seekerCv.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...data },
      update: data,
    });

    return res.json({ success: true, [slot]: { url: ref.path, fileName: cleanFileName(fileName), savedAt: now } });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

const clearSlot = (slot: Slot) => async (req: AuthRequest, res: Response) => {
  try {
    // Applications keep the copy they were sent with, so employers who already have it still do.
    const data =
      slot === 'uploaded'
        ? { uploadedUrl: null, uploadedFileName: null, uploadedAt: null }
        : { builderUrl: null, builderFileName: null, builderSavedAt: null };

    await prisma.seekerCv.updateMany({ where: { userId: req.user!.id }, data });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const setUploadedCv = saveSlot('uploaded');
export const setBuilderCv = saveSlot('builder');
export const clearUploadedCv = clearSlot('uploaded');
export const clearBuilderCv = clearSlot('builder');
