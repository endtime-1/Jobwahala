import { describe, expect, it, vi } from 'vitest';
import { parseSender, sendWithBrevoApi } from '../../services/mailTransport';

const message = { from: 'JobWahala <noreply@jobwahala.com>', to: 'ama@example.com', subject: 'Hello', html: '<p>Hi</p>' };
const ok = (body: unknown = { messageId: '<abc@brevo>' }) => ({ ok: true, status: 201, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;

describe('parseSender', () => {
  it('splits a name and an address, or takes a bare address', () => {
    expect(parseSender('JobWahala <noreply@jobwahala.com>')).toEqual({ email: 'noreply@jobwahala.com', name: 'JobWahala' });
    expect(parseSender('"Job Wahala" <noreply@jobwahala.com>')).toEqual({ email: 'noreply@jobwahala.com', name: 'Job Wahala' });
    expect(parseSender('noreply@jobwahala.com')).toEqual({ email: 'noreply@jobwahala.com' });
    expect(parseSender('  <noreply@jobwahala.com> ')).toEqual({ email: 'noreply@jobwahala.com' });
  });
});

describe('sending through the Brevo web API', () => {
  it('posts the message over HTTPS with the key in a header, never in the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());

    const result = await sendWithBrevoApi(message, 'xkeysib-secret', fetchMock as unknown as typeof fetch);

    expect(result.messageId).toBe('<abc@brevo>');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers['api-key']).toBe('xkeysib-secret');
    expect(JSON.parse(init.body)).toEqual({ sender: { email: 'noreply@jobwahala.com', name: 'JobWahala' }, to: [{ email: 'ama@example.com' }], subject: 'Hello', htmlContent: '<p>Hi</p>' });
    expect(init.body).not.toContain('xkeysib-secret');
  });

  it('fails loudly with Brevo\'s reason, so the app logs it like any other email failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '{"message":"Key not found"}' });

    await expect(sendWithBrevoApi(message, 'bad', fetchMock as unknown as typeof fetch)).rejects.toThrow('Brevo API 401: {"message":"Key not found"}');
  });

  it('a network failure also rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(sendWithBrevoApi(message, 'k', fetchMock as unknown as typeof fetch)).rejects.toThrow('fetch failed');
  });

  it('gives up if Brevo does not answer in time', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))));

    const pending = sendWithBrevoApi(message, 'k', fetchMock as unknown as typeof fetch);
    const assertion = expect(pending).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(16000);
    await assertion;
    vi.useRealTimers();
  });
});
