import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { generateCVFromPrompt } from '../services/ai';
import { singleValue } from '../utils/request';

export const saveCVGeneration = async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, content } = req.body;
    
    // If content isn't explicitly provided, route through the AI service.
    const finalContent = content || await generateCVFromPrompt(prompt || '');

    const cv = await prisma.cVGeneration.create({
      data: {
        prompt,
        content: finalContent,
        userId: req.user!.id
      }
    });
    res.status(201).json({ success: true, cv });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyCVs = async (req: AuthRequest, res: Response) => {
  try {
    const cvs = await prisma.cVGeneration.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, cvs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCVById = async (req: AuthRequest, res: Response) => {
  try {
    const cvId = singleValue(req.params.id);
    if (!cvId) {
      return res.status(400).json({ success: false, message: 'CV id is required' });
    }

    const cv = await prisma.cVGeneration.findUnique({
      where: { id: cvId }
    });

    if (!cv || cv.userId !== req.user!.id) {
      return res.status(404).json({ success: false, message: 'CV generation not found or access denied' });
    }

    res.json({ success: true, cv });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
