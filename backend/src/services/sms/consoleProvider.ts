import logger from '../../config/logger';
import { SmsProvider } from './types';

/** Development only: writes the text to the server log instead of sending it. Refused in production. */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'CONSOLE';

  async send(to: string, message: string): Promise<void> {
    logger.info('sms_console_provider', { to, message });
  }
}
