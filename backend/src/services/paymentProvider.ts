import env from '../config/env';

type ProviderSessionInput = {
  paymentId: string;
  reference: string;
  payerEmail: string;
  amount: string;
  agreementId: string;
  milestoneId: string;
};

type ProviderVerificationResult = {
  status: 'SUCCEEDED' | 'PROCESSING' | 'FAILED' | 'CANCELLED';
  failureReason?: string | null;
  completedAt?: string | null;
};

type ParsedProviderAmount = {
  currency: string;
  providerAmount: number;
};

const currencyFromSymbol = (symbol: string) => {
  if (symbol === '₵') return 'GHS';
  if (symbol === '₦') return 'NGN';
  if (symbol === '$') return 'USD';
  if (symbol === '£') return 'GBP';
  if (symbol === '€') return 'EUR';
  return env.paymentDefaultCurrency;
};

export const parseProviderAmount = (rawAmount: string): ParsedProviderAmount | null => {
  const trimmed = rawAmount.trim();
  const codeMatch = trimmed.match(/\b([A-Z]{3})\b/);
  const symbolMatch = trimmed.match(/[₵₦$£€]/);
  const numericMatch = trimmed.match(/(\d[\d,]*(?:\.\d{1,2})?)/);

  if (!numericMatch) {
    return null;
  }

  const numeric = Number(numericMatch[1].replace(/,/g, ''));

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  const currency = (codeMatch?.[1] || (symbolMatch ? currencyFromSymbol(symbolMatch[0]) : env.paymentDefaultCurrency)).toUpperCase();
  const providerAmount = Math.round(numeric * 100);

  if (!Number.isFinite(providerAmount) || providerAmount <= 0) {
    return null;
  }

  return { currency, providerAmount };
};

export const initializePaymentSession = async ({
  paymentId,
  reference,
  payerEmail,
  amount,
  agreementId,
  milestoneId,
}: ProviderSessionInput) => {
  const parsedAmount = parseProviderAmount(amount);

  if (!parsedAmount) {
    throw new Error('Milestone amount must include a numeric value before a live payment can start');
  }

  if (env.paymentProvider !== 'PAYSTACK') {
    return {
      paymentId,
      reference,
      provider: 'SANDBOX' as const,
      status: 'PENDING' as const,
      checkoutUrl: null,
      ...parsedAmount,
    };
  }

  const callbackUrl = new URL('/agreements', env.frontendBaseUrl);
  callbackUrl.searchParams.set('agreementId', agreementId);
  callbackUrl.searchParams.set('paymentId', paymentId);
  callbackUrl.searchParams.set('milestoneId', milestoneId);
  callbackUrl.searchParams.set('provider', 'PAYSTACK');

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: payerEmail,
      amount: String(parsedAmount.providerAmount),
      currency: parsedAmount.currency,
      reference,
      callback_url: callbackUrl.toString(),
      metadata: {
        source: 'jobwahala',
        agreementId,
        milestoneId,
        paymentId,
      },
    }),
  });

  const payload = (await response.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      authorization_url?: string;
      reference?: string;
    };
  };

  if (!response.ok || !payload.status || !payload.data?.authorization_url) {
    throw new Error(payload.message || 'Unable to initialize the payment provider session');
  }

  return {
    paymentId,
    reference,
    provider: 'PAYSTACK' as const,
    status: 'PENDING' as const,
    checkoutUrl: payload.data.authorization_url,
    currency: parsedAmount.currency,
    providerAmount: parsedAmount.providerAmount,
  };
};

export const verifyProviderPayment = async (reference: string): Promise<ProviderVerificationResult> => {
  if (env.paymentProvider !== 'PAYSTACK') {
    return {
      status: 'PROCESSING',
      failureReason: 'Sandbox payments are settled locally and do not require remote verification.',
    };
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.paystackSecretKey}`,
    },
  });

  const payload = (await response.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      status?: string;
      gateway_response?: string | null;
      paid_at?: string | null;
    };
  };

  if (!response.ok || !payload.status || !payload.data?.status) {
    throw new Error(payload.message || 'Unable to verify the payment provider session');
  }

  const providerStatus = payload.data.status.toLowerCase();

  if (providerStatus === 'success') {
    return {
      status: 'SUCCEEDED',
      completedAt: payload.data.paid_at || null,
    };
  }

  if (['abandoned', 'failed', 'reversed'].includes(providerStatus)) {
    return {
      status: 'FAILED',
      failureReason: payload.data.gateway_response || payload.message || 'Payment failed',
    };
  }

  return {
    status: 'PROCESSING',
    failureReason: payload.data.gateway_response || null,
  };
};
