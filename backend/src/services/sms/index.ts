import env from '../../config/env';
import { ArkeselSmsProvider } from './arkeselProvider';
import { ConsoleSmsProvider } from './consoleProvider';
import { SmsProvider, SmsSendError } from './types';

export { SmsSendError } from './types';
export type { SmsProvider } from './types';

let override: SmsProvider | null = null;
let cached: SmsProvider | null = null;

/** The one place that decides who sends our SMS. Add a case here to support another provider. */
export const buildSmsProvider = (settings: {
  provider: string;
  isProduction: boolean;
  arkeselApiKey: string;
  arkeselSenderId: string;
}): SmsProvider => {
  switch (settings.provider.toUpperCase()) {
    case 'ARKESEL':
      return new ArkeselSmsProvider({ apiKey: settings.arkeselApiKey, senderId: settings.arkeselSenderId });
    case 'CONSOLE':
      if (settings.isProduction) {
        throw new SmsSendError('The CONSOLE SMS provider cannot be used in production', 'CONSOLE');
      }
      return new ConsoleSmsProvider();
    default:
      throw new SmsSendError(`Unknown SMS_PROVIDER "${settings.provider}"`, settings.provider);
  }
};

export const getSmsProvider = (): SmsProvider => {
  if (override) return override;
  cached ??= buildSmsProvider({
    provider: env.smsProvider,
    isProduction: env.isProduction,
    arkeselApiKey: env.arkeselApiKey,
    arkeselSenderId: env.arkeselSenderId,
  });
  return cached;
};

/** For tests: swap in a fake provider, or pass null to go back to the configured one. */
export const setSmsProviderForTests = (provider: SmsProvider | null) => {
  override = provider;
};

export const sendSms = (to: string, message: string) => getSmsProvider().send(to, message);
