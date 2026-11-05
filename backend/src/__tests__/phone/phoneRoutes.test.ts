import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The real app: checks the routes exist, are validated and are protected, with no database involved.
describe('phone routes on the real app', () => {
  let server: Server;
  let base = '';

  beforeAll(async () => {
    const { default: app } = await import('../../app');
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server?.close();
  });

  const post = (path: string, body: unknown) =>
    fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('refuses a number that is not a Ghanaian mobile before doing anything', async () => {
    const response = await post('/api/auth/phone/send-code', { phone: '0301234567', purpose: 'LOGIN' });

    expect(response.status).toBe(400);
  });

  it('refuses a malformed code on log-in and sign-up', async () => {
    expect((await post('/api/auth/phone/login', { phone: '0241234567', code: '12' })).status).toBe(400);
    expect((await post('/api/auth/phone/signup', { phone: '0241234567', code: 'abcdef' })).status).toBe(400);
  });

  it('does not let a visitor add a phone to an account', async () => {
    expect((await post('/api/users/phone/send-code', { phone: '0241234567' })).status).toBe(401);
    expect((await post('/api/users/phone/confirm', { phone: '0241234567', code: '123456' })).status).toBe(401);
  });

  it('keeps downloading and deleting your data behind a login', async () => {
    expect((await fetch(base + '/api/users/me/export')).status).toBe(401);
    expect((await fetch(base + '/api/users/me/deletion-preview')).status).toBe(401);
    expect((await post('/api/users/me/delete-code', {})).status).toBe(401);
    expect((await post('/api/users/me/delete', { confirm: 'DELETE', password: 'x' })).status).toBe(401);
  });

  it('keeps the employer code routes behind a login too', async () => {
    expect((await post('/api/users/verification/abc/code', {})).status).toBe(401);
  });
});
