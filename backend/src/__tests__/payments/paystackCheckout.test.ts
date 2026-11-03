import { describe, expect, it } from 'vitest';
import { buildPaystackCallbackUrl, getPaystackChannels } from '../../services/paymentProvider';

describe('buildPaystackCallbackUrl', () => {
  it('returns to the agreements page with the params the page auto-verifies', () => {
    const url = new URL(
      buildPaystackCallbackUrl('https://jobwahala.com', {
        agreementId: 'agr-1',
        paymentId: 'pay-1',
        milestoneId: 'ms-1',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://jobwahala.com/agreements');
    expect(url.searchParams.get('agreementId')).toBe('agr-1');
    expect(url.searchParams.get('paymentId')).toBe('pay-1');
    expect(url.searchParams.get('milestoneId')).toBe('ms-1');
    expect(url.searchParams.get('provider')).toBe('PAYSTACK');
  });

  it('never points at a per-agreement path the frontend does not route', () => {
    const url = new URL(
      buildPaystackCallbackUrl('http://localhost:5173', { agreementId: 'a', paymentId: 'p', milestoneId: 'm' }),
    );

    expect(url.pathname).toBe('/agreements');
  });
});

describe('getPaystackChannels', () => {
  it('offers mobile money first for Ghana cedis', () => {
    expect(getPaystackChannels('GHS')?.[0]).toBe('mobile_money');
    expect(getPaystackChannels('ghs')).toContain('card');
  });

  it('leaves other currencies on Paystack defaults', () => {
    expect(getPaystackChannels('USD')).toBeUndefined();
  });
});
