import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMockAddonsManager } from './app.ts';

let baseUrl: string;
let close: () => Promise<void>;

beforeEach(async () => {
  const server = createMockAddonsManager({ installDelayMs: 30, uiBlockSupport: true });
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

describe('addons-manager and marketplace over HTTP', () => {
  it('serves JSON as text/html from the addons-manager and application/json from the marketplace', async () => {
    const manager = await fetch(`${baseUrl}/api/v1/addons/`);
    expect(manager.headers.get('content-type')).toContain('text/html');
    const market = await fetch(`${baseUrl}/api/v1/marketplace/addons/`);
    expect(market.headers.get('content-type')).toBe('application/json');
    expect(manager.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('runs the install and remove lifecycle, and ui-addons follows', async () => {
    const [flops] = await json<{ _id: string }[]>('/api/v1/marketplace/addons/?name=flops');
    const post = () =>
      fetch(`${baseUrl}/api/v1/addons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplace_id: flops!._id }),
      });
    const created = await post();
    expect(created.status).toBe(201);
    const addon = JSON.parse(await created.text()) as { _id: string; status: string };
    expect(addon.status).toBe('installing');
    expect((await post()).status).toBe(400);

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
    const [example] = await json<{ _id: string; marketplace_id: string }[]>('/api/v1/addons/');
    await fetch(`${baseUrl}/api/v1/addons/${example!._id}`, { method: 'DELETE' });
    await wait(80);
    expect(await uiAddons()).toEqual([]);
    await fetch(`${baseUrl}/api/v1/addons/${example!._id}`, { method: 'DELETE' });
    await fetch(`${baseUrl}/api/v1/addons`, {
      method: 'POST',
      body: JSON.stringify({ marketplace_id: example!.marketplace_id }),
    });
    await wait(80);
    expect(await uiAddons()).toEqual([{ name: 'example', version: '0.1.0', sdk: '^0.1.0' }]);
  });

  it('lets e2e change the delays', async () => {
    await fetch(`${baseUrl}/__test/config`, {
      method: 'PUT',
      body: JSON.stringify({ installDelayMs: 0 }),
    });
    const [flops] = await json<{ _id: string }[]>('/api/v1/marketplace/addons/?name=flops');
    const addon = await json<{ _id: string }>('/api/v1/addons/', {
      method: 'POST',
      body: JSON.stringify({ marketplace_id: flops!._id }),
    });
    await wait(20);
    expect((await json<{ status: string }>(`/api/v1/addons/${addon._id}`)).status).toBe('active');
  });
});

describe('without ui block support (the default, like the real marketplace)', () => {
  it('rejects ui and serves no ui-addons for the seed', async () => {
    const server = createMockAddonsManager({});
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      expect(await (await fetch(`${url}/api/v1/ui-addons`)).json()).toEqual([]);
      const response = await fetch(`${url}/api/v1/marketplace/addons/`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'x',
          services: [{ service_name: 'a', image: 'b' }],
          ui: { service: 'a', sdk: '^0.1.0' },
        }),
      });
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ errors: { json: { ui: ['Unknown field.'] } } });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
