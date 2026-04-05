import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { paystackService } from '../services/paystackService';
import logger from '../config/logger';

/**
 * Get the list of supported banks and MoMo providers in Ghana.
 */
export const getBanks = async (req: AuthRequest, res: Response) => {
  try {
    const banks = await paystackService.listBanks('ghana');
    res.json({ success: true, banks: banks.data });
  } catch (error: any) {
    logger.error('get_banks_error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch supported banks' });
  }
};

/**
 * Save or update a freelancer's payout account.
 */
export const savePayoutAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { bankCode, bankName, accountNumber, accountName, type } = req.body;

    if (!bankCode || !accountNumber || !accountName) {
      return res.status(400).json({ success: false, message: 'Incomplete payout account details' });
    }

    // 1. Create or Update Transfer Recipient on Paystack
    const recipientData = await paystackService.createTransferRecipient({
      type: type || 'mobile_money',
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'GHS',
    });

    if (!recipientData.status) {
      return res.status(400).json({ success: false, message: 'Paystack rejected the recipient details' });
    }

    // 2. Save to DB
    const payoutAccount = await prisma.payoutAccount.upsert({
      where: { userId },
      update: {
        bankCode,
        bankName,
        accountNumber,
        accountName,
        recipientCode: recipientData.data.recipient_code,
        type: type || 'mobile_money',
      },
      create: {
        userId,
        bankCode,
        bankName,
        accountNumber,
        accountName,
        recipientCode: recipientData.data.recipient_code,
        type: type || 'mobile_money',
      },
    });

    res.json({ success: true, payoutAccount });
  } catch (error: any) {
    logger.error('save_payout_account_error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get the user's current payout account.
 */
export const getMyPayoutAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const payoutAccount = await prisma.payoutAccount.findUnique({
      where: { userId },
    });

    res.json({ success: true, payoutAccount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
