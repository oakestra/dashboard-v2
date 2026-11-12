import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMockAddonsManager } from './app.ts';

let baseUrl: string;
let close: () => Promise<void>;

beforeEach(async () => {
  const server = createMockAddonsManager({ installDelayMs: 30 });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((resolve) => server.close(() => resolve()));
});

afterEach(() => close());

const uiAddons = async () =>
  (await (await fetch(`${baseUrl}/api/v1/ui-addons`)).json()) as { name: string }[];
const json = async <T>(path: string, init?: RequestInit) =>
  JSON.parse(await (await fetch(`${baseUrl}${path}`, init)).text()) as T;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('test API (legacy model on top of the two backends)', () => {
  it('lists enabled addons with only the public fields', async () => {
    expect(await uiAddons()).toEqual([{ name: 'example', version: '0.1.0', sdk: '^0.1.0' }]);
  });

  it('toggles and upgrades addons', async () => {
    const put = (name: string, body: object) =>
      fetch(`${baseUrl}/__test/addons/${name}`, { method: 'PUT', body: JSON.stringify(body) });

    await put('example', { enabled: false });
    expect(await uiAddons()).toEqual([]);
    expect(
      (await json<{ status: string }[]>('/api/v1/addons/')).find((a) => a.status === 'disabled'),
    ).toBeDefined();

    await put('example', { enabled: true, version: '0.2.0' });
    expect(await uiAddons()).toEqual([{ name: 'example', version: '0.2.0', sdk: '^0.1.0' }]);

    await put('example', { sdk: '^9.0.0' });
    expect(await uiAddons()).toEqual([{ name: 'example', version: '0.2.0', sdk: '^9.0.0' }]);

    await put('ghost', { enabled: true });
    expect((await uiAddons()).map((a) => a.name)).toEqual(['example', 'ghost']);

    await fetch(`${baseUrl}/__test/reset`, { method: 'POST' });
    expect(await uiAddons()).toEqual([{ name: 'example', version: '0.1.0', sdk: '^0.1.0' }]);
  });
});

/** POSTs an install; with `accept`, first fetches the definition hash from the consent 409. */
async function installRequest(name: string, accept = true) {
  const post = (hash: string) =>
    fetch(`${baseUrl}/api/v1/addons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, accept_definition: hash }),
    });
  const first = await post('');
  if (!accept || first.status !== 409) return first;
  const body = (await first.json()) as { definition_hash?: string };
  return body.definition_hash ? post(body.definition_hash) : first;
}

describe('addons-manager and marketplace over HTTP', () => {
  it('serves JSON from both services', async () => {
    const manager = await fetch(`${baseUrl}/api/v1/addons/`);
    expect(manager.headers.get('content-type')).toBe('application/json');
    const market = await fetch(`${baseUrl}/api/v1/marketplace/addons/`);
    expect(market.headers.get('content-type')).toBe('application/json');
    const sources = await json<{ name: string }[]>('/api/v1/marketplace/sources');
    expect(sources.map((s) => s.name)).toEqual(['official', 'acme', 'lab', 'local']);
  });

  it('runs the consent, install and remove lifecycle, and ui-addons follows', async () => {
    const refused = await installRequest('flops', false);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({
      definition_hash: expect.stringMatching(/^sha256:/),
      permissions: { core_network: true },
    });

    const created = await installRequest('flops');
    expect(created.status).toBe(201);
    const addon = (await created.json()) as { _id: string; status: string };
    expect(addon.status).toBe('installing');
    expect((await installRequest('flops')).status).toBe(409);

    await wait(80);
    expect((await json<{ status: string }>(`/api/v1/addons/${addon._id}`)).status).toBe('active');
    // flops has no ui block.
    expect(await uiAddons()).toHaveLength(1);

    const first = await fetch(`${baseUrl}/api/v1/addons/${addon._id}`, { method: 'DELETE' });
    expect(first.status).toBe(200);
    await wait(80);
    const second = await fetch(`${baseUrl}/api/v1/addons/${addon._id}`, { method: 'DELETE' });
    expect(second.status).toBe(204);
  });

  it('installs the example again after disabling it, bringing its ui back', async () => {
    const [example] = await json<{ _id: string }[]>('/api/v1/addons/');
    await fetch(`${baseUrl}/api/v1/addons/${example!._id}`, { method: 'DELETE' });
    await wait(80);
    expect(await uiAddons()).toEqual([]);
    await fetch(`${baseUrl}/api/v1/addons/${example!._id}`, { method: 'DELETE' });
    expect((await installRequest('example')).status).toBe(201);
    await wait(80);
    expect(await uiAddons()).toEqual([{ name: 'example', version: '0.1.0', sdk: '^0.1.0' }]);
  });

  it('lets e2e change the delays', async () => {
    await fetch(`${baseUrl}/__test/config`, {
      method: 'PUT',
      body: JSON.stringify({ installDelayMs: 0 }),
    });
    const addon = (await (await installRequest('flops')).json()) as { _id: string };
    await wait(20);
    expect((await json<{ status: string }>(`/api/v1/addons/${addon._id}`)).status).toBe('active');
  });
});
