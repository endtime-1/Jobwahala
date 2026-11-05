/**
 * What the rest of the app needs from an SMS service. To switch provider, write a class that
 * implements this and choose it in ./index.ts. Nothing else in the codebase knows who sends the SMS.
 */
export interface SmsProvider {
  /** Short name for logs, e.g. ARKESEL. */
  readonly name: string;
  /** Sends one text. `to` is always a validated +233 number. Throws SmsSendError when it could not be sent. */
  send(to: string, message: string): Promise<void>;
}

export class SmsSendError extends Error {
  constructor(message: string, readonly provider: string) {
    super(message);
    this.name = 'SmsSendError';
  }
}
