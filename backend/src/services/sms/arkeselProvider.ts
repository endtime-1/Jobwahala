import { SmsProvider, SmsSendError } from './types';

const ENDPOINT = 'https://sms.arkesel.com/api/v2/sms/send';
const TIMEOUT_MS = 10_000;

type ArkeselConfig = {
  apiKey: string;
  /** The registered sender name shown on the phone, 11 characters at most. */
  senderId: string;
  /** Replaceable in tests. */
  fetchImpl?: typeof fetch;
};

/**
 * Arkesel (https://arkesel.com), a Ghana SMS provider. One authenticated POST per message; the
 * API key goes in the `api-key` header and is never logged or put in an error message.
 */
export class ArkeselSmsProvider implements SmsProvider {
  readonly name = 'ARKESEL';

  constructor(private readonly config: ArkeselConfig) {}

  async send(to: string, message: string): Promise<void> {
    if (!this.config.apiKey) {
      throw new SmsSendError('ARKESEL_API_KEY is not set', this.name);
    }

    const doFetch = this.config.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await doFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'api-key': this.config.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: this.config.senderId,
          message,
          // Arkesel wants the international number without the plus sign.
          recipients: [to.replace(/^\+/, '')],
        }),
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => null)) as { status?: string; message?: string } | null;

      if (!response.ok || body?.status !== 'success') {
        throw new SmsSendError(`Arkesel refused the message (HTTP ${response.status}${body?.message ? `: ${body.message}` : ''})`, this.name);
      }
    } catch (error) {
      if (error instanceof SmsSendError) throw error;
      const reason = error instanceof Error && error.name === 'AbortError' ? 'timed out' : 'could not be reached';
      throw new SmsSendError(`Arkesel ${reason}`, this.name);
    } finally {
      clearTimeout(timer);
    }
  }
}
