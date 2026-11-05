import axios from 'axios';
import crypto from 'crypto';
import env from '../config/env';
import logger from '../config/logger';
import { getErrorMessage } from '../utils/errors';

const BASE = 'https://api.paystack.co';

/** What the billing code needs from Paystack. A class of its own so tests can stand in for it. */
export type PaystackClient = {
  initialize: (input: { email: string; amountPesewas: number; reference: string; callbackUrl: string; plan?: string; metadata?: Record<string, unknown> }) => Promise<{ authorizationUrl: string }>;
  verify: (reference: string) => Promise<{ status: string; amountPesewas: number; currency: string; channel: string | null; paidAt: string | null; failureReason: string | null }>;
  createPlan: (input: { name: string; amountPesewas: number; interval: 'monthly' | 'annually' }) => Promise<{ planCode: string }>;
  refund: (input: { reference: string; amountPesewas: number }) => Promise<{ refundId: string | null; status: string }>;
  disableSubscription: (input: { code: string; token: string }) => Promise<void>;
};

const headers = () => ({ Authorization: `Bearer ${env.paystackSecretKey}`, 'Content-Type': 'application/json' });

const fail = (name: string, error: unknown): never => {
  logger.error(name, { error: (axios.isAxiosError(error) && error.response?.data) || getErrorMessage(error) });
  throw error;
};

export const realPaystack: PaystackClient = {
  async initialize({ email, amountPesewas, reference, callbackUrl, plan, metadata }) {
    try {
      const { data } = await axios.post(
        `${BASE}/transaction/initialize`,
        {
          email,
          // With a plan, Paystack charges the plan's own amount.
          amount: amountPesewas,
          currency: 'GHS',
          reference,
          callback_url: callbackUrl,
          channels: ['card', 'mobile_money'],
          ...(plan ? { plan } : {}),
          ...(metadata ? { metadata } : {}),
        },
        { headers: headers(), timeout: 15000 },
      );
      return { authorizationUrl: data.data.authorization_url as string };
    } catch (error) {
      return fail('paystack_initialize_failed', error);
    }
  },

  async verify(reference) {
    try {
      const { data } = await axios.get(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, { headers: headers(), timeout: 15000 });
      return {
        status: String(data.data.status),
        amountPesewas: Number(data.data.amount),
        currency: String(data.data.currency),
        channel: data.data.channel ?? null,
        paidAt: data.data.paid_at ?? null,
        failureReason: data.data.gateway_response ?? null,
      };
    } catch (error) {
      return fail('paystack_verify_failed', error);
    }
  },

  async createPlan({ name, amountPesewas, interval }) {
    try {
      const { data } = await axios.post(`${BASE}/plan`, { name, amount: amountPesewas, interval, currency: 'GHS' }, { headers: headers(), timeout: 15000 });
      return { planCode: data.data.plan_code as string };
    } catch (error) {
      return fail('paystack_create_plan_failed', error);
    }
  },

  async refund({ reference, amountPesewas }) {
    try {
      const { data } = await axios.post(`${BASE}/refund`, { transaction: reference, amount: amountPesewas }, { headers: headers(), timeout: 15000 });
      return { refundId: data.data?.id != null ? String(data.data.id) : null, status: String(data.data?.status ?? 'pending') };
    } catch (error) {
      return fail('paystack_refund_failed', error);
    }
  },

  async disableSubscription({ code, token }) {
    try {
      await axios.post(`${BASE}/subscription/disable`, { code, token }, { headers: headers(), timeout: 15000 });
    } catch (error) {
      fail('paystack_disable_subscription_failed', error);
    }
  },
};

/** "test" for sk_test_ keys, "live" for sk_live_ keys, "off" with no key. */
export const paystackMode = (secret = env.paystackSecretKey): 'test' | 'live' | 'off' =>
  secret.startsWith('sk_live_') ? 'live' : secret ? 'test' : 'off';

/**
 * Is this webhook really from Paystack? The signature is an HMAC-SHA512 of the EXACT bytes Paystack sent, made with the
 * secret key. It must be checked against the raw body: re-printing parsed JSON can change the bytes.
 */
export const isValidPaystackSignature = (rawBody: Buffer | string | undefined, signature: string | undefined, secret = env.paystackSecretKey) => {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};
