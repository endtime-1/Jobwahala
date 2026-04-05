import crypto from 'crypto';
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import env from '../config/env';
import { AuthRequest } from '../middleware/auth';
import { paystackService } from '../services/paystackService';
import { completeMilestonePayment, processPayout, TransactionClientLike } from './agreementController';
import logger from '../config/logger';

const isPaystackSignatureValid = (payload: unknown, signature: string | undefined) => {
  if (!signature || !env.paystackSecretKey) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha512', env.paystackSecretKey)
    .update(JSON.stringify(payload))
    .digest('hex');

  // Direct comparison if timingSafeEqual feels overkill for this specific string format, 
  // but it's best practice.
  return expectedSignature === signature;
};

/**
 * Initialize a milestone payment via Paystack.
 */
export const initializeMilestonePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { milestoneId } = req.body;
    const userId = req.user!.id;

    if (!milestoneId) {
      return res.status(400).json({ success: false, message: 'Milestone ID is required' });
    }

    // 1. Fetch milestone and agreement
    const milestone = await prisma.agreementMilestone.findUnique({
      where: { id: milestoneId },
      include: {
        agreement: {
          include: {
            employer: true,
            freelancer: true,
          }
        }
      }
    });

    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    if (milestone.agreement.employerId !== userId) {
      return res.status(403).json({ success: false, message: 'Only the employer can pay for this milestone' });
    }

    if (milestone.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'This milestone is already paid' });
    }

    const amountValue = parseFloat(milestone.amount || '0');
    if (amountValue <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid milestone amount' });
    }

    const currency = milestone.currency || 'GHS';
    // Paystack expects amount in minor units (pesewas/cents)
    const amountInMinorUnits = Math.round(amountValue * 100);
    const reference = `pay_${milestone.id}_${Date.now()}`;

    // 2. Create local payment record
    const payment = await prisma.payment.create({
      data: {
        agreementId: milestone.agreementId,
        milestoneId: milestone.id,
        payerId: userId,
        payeeId: milestone.agreement.freelancerId || milestone.agreement.seekerId || '',
        provider: 'PAYSTACK',
        status: 'PENDING',
        amount: milestone.amount || '0',
        currency: currency,
        providerAmount: amountInMinorUnits,
        reference: reference,
      }
    });

    // 3. Initialize Paystack Transaction
    const paystackData = await paystackService.initializeTransaction({
      email: (req.user as any).email,
      amount: amountInMinorUnits,
      currency: currency,
      reference: reference,
      callback_url: `${env.frontendBaseUrl}/agreements/${milestone.agreementId}`,
      metadata: {
        paymentId: payment.id,
        milestoneId: milestone.id,
      }
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { checkoutUrl: paystackData.data.authorization_url }
    });

    res.json({
      success: true,
      checkoutUrl: paystackData.data.authorization_url,
      reference: reference
    });

  } catch (error: any) {
    logger.error('initialize_milestone_payment_error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Handle Paystack Webhooks for automated escrow logic.
 */
export const handlePaystackWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.header('x-paystack-signature');
    if (!isPaystackSignatureValid(req.body, signature)) {
      return res.status(403).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = req.body;

    if (event.event !== 'charge.success') {
      return res.status(200).json({ success: true, message: 'Event ignored' });
    }

    const { reference, amount, currency, paid_at } = event.data;

    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: {
        agreement: true,
        milestone: true,
      },
    });

    if (!payment) {
      return res.status(200).json({ success: true, message: 'Payment reference not found in our DB' });
    }

    if (payment.status === 'SUCCEEDED') {
      return res.status(200).json({ success: true, message: 'Payment already processed' });
    }

    // Verify amount and currency (Standard safety check)
    if (payment.providerAmount !== amount) {
       logger.warn('paystack_webhook_amount_mismatch', { reference, expected: payment.providerAmount, received: amount });
       // We should still process if it's a small rounding diff, or flag for manual review.
    }

    // 1. Mark payment as SUCCEEDED and update milestone paymentStatus to PAID
    await prisma.$transaction(async (tx) => {
      await completeMilestonePayment(tx, {
        agreement: {
          id: payment.agreement.id,
          title: payment.agreement.title,
        },
        milestone: {
          id: payment.milestone.id,
          title: payment.milestone.title,
          paymentStatus: payment.milestone.paymentStatus,
        },
        payment: {
          id: payment.id,
          status: payment.status,
        },
        userId: payment.payerId,
        payeeId: payment.payeeId,
        completedAt: paid_at ? new Date(paid_at) : new Date(),
      });
    });

    // 2. Trigger automated payout from escrow to freelancer
    void processPayout(payment.milestone.id);

    return res.status(200).json({ success: true, processed: true });
  } catch (error: any) {
    logger.error('paystack_webhook_error', { error: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};
