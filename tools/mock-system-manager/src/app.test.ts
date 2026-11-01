import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMockSystemManager } from './app.ts';

const server = createMockSystemManager();
let base = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function login(): Promise<{ token: string; refresh_token: string }> {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Admin', password: 'Admin' }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { token: string; refresh_token: string };
}

describe('mock system-manager', () => {
  it('answers CORS preflights for the dashboard origin', async () => {
    const response = await fetch(`${base}/api/applications/`, { method: 'OPTIONS' });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('serves the mock API with bodies and auth', async () => {
    const { token } = await login();
    const created = await fetch(`${base}/api/organization/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'e2e', member: [] }),
    });
    expect(await created.json()).toMatchObject({ name: 'e2e' });
    expect(created.headers.get('access-control-allow-origin')).toBe('*');

    const missing = await fetch(`${base}/api/nope`);
    expect(missing.status).toBe(404);
  });

  it('resets its data on request', async () => {
    const { token } = await login();
    const list = () =>
      fetch(`${base}/api/organization/`, { headers: { Authorization: `Bearer ${token}` } }).then(
        (response) => response.json() as Promise<{ name: string }[]>,
      );
    await fetch(`${base}/api/organization/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'temporary', member: [] }),
    });
    expect((await list()).map((org) => org.name)).toContain('temporary');

    await fetch(`${base}/__test/reset`, { method: 'POST' });
    expect((await list()).map((org) => org.name)).not.toContain('temporary');
  });
});
