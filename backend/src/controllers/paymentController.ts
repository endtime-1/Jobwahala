import crypto from 'crypto';
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import env from '../config/env';
import { completeMilestonePayment } from './agreementController';

const isPaystackSignatureValid = (payload: unknown, signature: string | undefined) => {
  if (!signature || !env.paystackSecretKey) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha512', env.paystackSecretKey)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
};

export const handlePaystackWebhook = async (req: Request, res: Response) => {
  try {
    if (!isPaystackSignatureValid(req.body, req.header('x-paystack-signature'))) {
      return res.status(403).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = req.body as {
      event?: string;
      data?: {
        reference?: string;
        amount?: number;
        currency?: string;
        paid_at?: string | null;
      };
    };

    if (event.event !== 'charge.success' || !event.data?.reference) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const eventData = event.data;

    const payment = await prisma.payment.findUnique({
      where: { reference: eventData.reference },
      include: {
        agreement: true,
        milestone: true,
      },
    });

    if (!payment || payment.provider !== 'PAYSTACK') {
      return res.status(200).json({ success: true, ignored: true });
    }

    if (payment.status === 'SUCCEEDED' || payment.milestone.paymentStatus === 'PAID') {
      return res.status(200).json({ success: true, alreadyProcessed: true });
    }

    if (
      typeof eventData.amount === 'number' &&
      typeof (payment as any).providerAmount === 'number' &&
      eventData.amount !== (payment as any).providerAmount
    ) {
      return res.status(400).json({ success: false, message: 'Webhook amount mismatch' });
    }

    if (
      eventData.currency &&
      (payment as any).currency &&
      eventData.currency.toUpperCase() !== (payment as any).currency.toUpperCase()
    ) {
      return res.status(400).json({ success: false, message: 'Webhook currency mismatch' });
    }

    await prisma.$transaction(async (tx) =>
      completeMilestonePayment(tx, {
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
        completedAt: eventData.paid_at ? new Date(eventData.paid_at) : undefined,
      })
    );

    return res.status(200).json({ success: true, processed: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
