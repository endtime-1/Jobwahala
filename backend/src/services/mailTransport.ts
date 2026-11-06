import nodemailer from 'nodemailer';
import env from '../config/env';

export type MailMessage = { from: string; to: string; subject: string; html: string };

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 15000;

/** "JobWahala <noreply@jobwahala.com>" or "noreply@jobwahala.com" -> name and address. */
export const parseSender = (from: string) => {
  const match = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(from);
  if (match) return { email: match[2].trim(), ...(match[1]?.trim() ? { name: match[1].trim() } : {}) };
  return { email: from.trim() };
};

/**
 * Sends one email through Brevo's web API (HTTPS). Many hosts, Railway's cheaper plans included, block the usual mail ports,
 * so SMTP times out there; an HTTPS call is not blocked. Throws on any failure so callers log it like an SMTP failure.
 */
export const sendWithBrevoApi = async (message: MailMessage, apiKey: string, fetchImpl: typeof fetch = fetch) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: parseSender(message.from), to: [{ email: message.to }], subject: message.subject, htmlContent: message.html }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Brevo API ${response.status}: ${detail.slice(0, 200)}`);
    }
    return (await response.json().catch(() => ({}))) as { messageId?: string };
  } finally {
    clearTimeout(timer);
  }
};

const smtp = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpPort === 465,
  auth: env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
});

/** What the rest of the app calls. With BREVO_API_KEY set it uses the web API; otherwise normal SMTP. */
export const transporter = {
  sendMail: (message: MailMessage) => (env.brevoApiKey ? sendWithBrevoApi(message, env.brevoApiKey) : smtp.sendMail(message)),
};
