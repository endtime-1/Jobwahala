import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { getErrorMessage } from '../utils/errors';
import { buildUserDataExport, deleteAccount, getDeletionPreview } from '../services/accountService';
import { issuePhoneOtp, verifyPhoneOtp } from '../services/phoneOtpService';
import { respondToIssue, respondToWrongCode } from './authController';

/** Download everything we hold about the signed-in member, as a JSON file. */
export const exportMyData = async (req: AuthRequest, res: Response) => {
  try {
    const data = await buildUserDataExport(req.user!.id);
    if (!data) return res.status(404).json({ success: false, message: 'Account not found' });

    const day = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="jobwahala-my-data-${day}.json"`);
    // Personal data: never kept in a shared cache.
    res.setHeader('Cache-Control', 'no-store');
    return res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** What deleting would do, so the page can say it plainly before asking for confirmation. */
export const getMyDeletionPreview = async (req: AuthRequest, res: Response) => {
  try {
    const preview = await getDeletionPreview(req.user!.id);
    if (!preview) return res.status(404).json({ success: false, message: 'Account not found' });
    return res.json({ success: true, preview });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Phone-only members have no password, so they confirm deleting with a code texted to their number. */
export const sendDeletionCode = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true, phone: true } });
    if (!user?.phone) return res.status(400).json({ success: false, message: 'There is no phone number on this account.' });
    if (user.email) return res.status(400).json({ success: false, message: 'Confirm with your password instead.' });

    return respondToIssue(res, await issuePhoneOtp({ phone: user.phone, purpose: 'DELETE_ACCOUNT', subjectId: req.user!.id, ip: req.ip }));
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const deleteMyAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { password, code, acknowledgeCompany } = req.body as { password?: string; code?: string; acknowledgeCompany?: boolean };
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, password: true, role: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found' });

    if (user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Administrator accounts cannot be deleted from here.' });
    }

    // Prove it is really them: a password, or for phone-only accounts a code texted to their number.
    if (user.email) {
      if (!password || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ success: false, message: 'That password is not right.' });
      }
    } else {
      if (!code || !user.phone) return res.status(400).json({ success: false, message: 'Enter the code we texted you.' });
      const checked = await verifyPhoneOtp({ phone: user.phone, purpose: 'DELETE_ACCOUNT', subjectId: userId, code });
      if (!checked.ok) return respondToWrongCode(res, checked);
    }

    const result = await deleteAccount(userId, { acknowledgeCompany });

    if (result.ok) return res.json({ success: true, message: 'Your account and personal data have been deleted.' });

    if (result.reason === 'BLOCKED') {
      return res.status(409).json({ success: false, blockers: result.blockers, message: result.blockers[0] });
    }
    if (result.reason === 'ACKNOWLEDGE_COMPANY') {
      return res.status(400).json({
        success: false,
        code: 'ACKNOWLEDGE_COMPANY',
        openJobs: result.openJobs,
        applicantsOnOpenJobs: result.applicantsOnOpenJobs,
        message: 'Your open jobs will be closed and your company page removed. Confirm that you understand.',
      });
    }
    return res.status(404).json({ success: false, message: 'Account not found' });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
