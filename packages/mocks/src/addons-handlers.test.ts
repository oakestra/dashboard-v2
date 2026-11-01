import {
  createAddonsClient,
  createAddonsManagerApi,
  createMarketplaceApi,
  isTransitionalAddonStatus,
} from '@oakestra/api';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createMockServer } from './node.ts';

const managerUrl = 'http://dash.test/addons-api';
const marketplaceUrl = 'http://dash.test/marketplace-api';
const { server, addons } = createMockServer({
  baseUrl: 'http://dash.test/api',
  addons: { managerUrl, marketplaceUrl, installDelayMs: 20, monitorDelayMs: 40 },
});

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => addons.reset());
afterAll(() => server.close());

const manager = createAddonsManagerApi(createAddonsClient({ baseUrl: managerUrl }));
const market = createMarketplaceApi(createAddonsClient({ baseUrl: marketplaceUrl }));

async function definitionId(name: string): Promise<string> {
  const [definition] = await market.list({ name });
  return definition!._id;
}

async function settled(id: string) {
  let addon = await manager.get(id);
  for (let i = 0; i < 100 && isTransitionalAddonStatus(addon.status); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    addon = await manager.get(id);
  }
  return addon;
}

/** Waits for a status the monitor reaches on a later loop, after the addon was `active`. */
async function waitForStatus(id: string, status: string) {
  let addon = await manager.get(id);
  for (let i = 0; i < 100 && addon.status !== status; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    addon = await manager.get(id);
  }
  return addon;
}

const rawRegister = (body: unknown) =>
  fetch(`${marketplaceUrl}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('mock marketplace', () => {
  it('lists approved definitions only, without a ui block like the real marketplace', async () => {
    const list = await market.list();
    expect(list.map((addon) => addon.name)).toEqual([
      'example',
      'analytics',
      'legacy-exporter',
      'flops',
      'flaky-addon',
      'broken-addon',
      'install-error-addon',
    ]);
    expect(list.filter((addon) => addon.ui)).toHaveLength(0);
    expect(await market.list({ name: 'flops' })).toHaveLength(1);
  });

  it('serves unapproved definitions by id', async () => {
    const hidden = addons.state.marketplace.find((addon) => addon.name === 'community-tool')!;
    await expect(market.get(hidden._id)).resolves.toMatchObject({ status: 'under_review' });
    await expect(market.get('000000000000000000000000')).rejects.toMatchObject({
      status: 404,
      message: 'Addon not found',
    });
  });

  it('registers a definition: under_review, then approved or verification_failed', async () => {
    const ok = await market.register({
      name: 'mine',
      services: [{ service_name: 'mine-ui', image: 'ghcr.io/me/ui:1' }],
    });
    expect(ok).toMatchObject({ status: 'under_review' });
    expect(await market.list({ name: 'mine' })).toHaveLength(0);

    const bad = await market.register({
      name: 'bad',
      services: [{ service_name: 'bad', image: 'nobody/does-not-exist:1' }],
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect((await market.get(ok._id)).status).toBe('approved');
    expect((await market.get(bad._id)).status).toBe('verification_failed');
    expect(await market.list({ name: 'mine' })).toHaveLength(1);

    await market.remove(ok._id);
    await expect(market.remove(ok._id)).rejects.toMatchObject({ status: 404 });
  });

  it('answers 422 in the flask-smorest shape for a malformed definition', async () => {
    const response = await rawRegister({ name: 'x', services: [{ service_name: 'a' }] });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      code: 422,
      status: 'Unprocessable Entity',
      errors: { json: { services: { '0': { image: ['Missing data for required field.'] } } } },
    });
  });

  it('rejects unknown fields, including the ui block and status, like the real schema', async () => {
    const response = await rawRegister({
      name: 'x',
      status: 'approved',
      services: [{ service_name: 'a', image: 'b', restart: 'always' }],
      ui: { service: 'a', sdk: '^0.1.0' },
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      code: 422,
      status: 'Unprocessable Entity',
      errors: {
        json: {
          status: ['Unknown field.'],
          ui: ['Unknown field.'],
          services: { '0': { restart: ['Unknown field.'] } },
        },
      },
    });
    expect(addons.state.marketplace.some((a) => a.name === 'x')).toBe(false);
  });

  it('answers a non-ObjectId id with a 500 page, not a 404', async () => {
    for (const [method, url] of [
      ['GET', `${marketplaceUrl}/nope`],
      ['DELETE', `${marketplaceUrl}/nope`],
      ['GET', `${managerUrl}/nope`],
      ['DELETE', `${managerUrl}/nope`],
    ] as const) {
      const response = await fetch(url, { method });
      expect(response.status, `${method} ${url}`).toBe(500);
      expect(response.headers.get('Content-Type')).toContain('text/html');
    }
    const patch = await fetch(`${managerUrl}/nope`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(patch.status).toBe(500);
  });
});

describe('mock addons-manager', () => {
  it('seeds one active, one partially_active and one failed addon', async () => {
    const list = await manager.list();
    expect(list.map((addon) => [addon.name, addon.status])).toEqual([
      ['example', 'active'],
      ['analytics', 'partially_active'],
      ['legacy-exporter', 'failed'],
    ]);
    const failed = list.find((addon) => addon.status === 'failed')!;
    expect(failed.status_details?.failed_services).toEqual(['legacy-exporter']);
    expect(failed.logs).toContain('out of memory');
    expect(await manager.list({ status: 'failed' })).toHaveLength(1);
  });

  it('sends JSON as text/html like the real addons-manager', async () => {
    const response = await fetch(`${managerUrl}/`);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(Array.isArray(JSON.parse(await response.text()))).toBe(true);
    const marketplaceResponse = await fetch(`${marketplaceUrl}/`);
    expect(marketplaceResponse.headers.get('Content-Type')).toBe('application/json');
  });

  it('installs: installing, then active', async () => {
    const created = await manager.install(await definitionId('flops'));
    expect(created.status).toBe('installing');
    expect(created.services).toHaveLength(2);
    const done = await settled(created._id);
    expect(done.status).toBe('active');
    expect(addons.uiAddons()).toEqual([]);
  });

  it('reports a crashing container only after the addon was active, on a later monitor loop', async () => {
    const flaky = await settled((await manager.install(await definitionId('flaky-addon')))._id);
    expect(flaky.status).toBe('active');
    expect(flaky.logs).toBeUndefined();
    expect(await waitForStatus(flaky._id, 'partially_active')).toMatchObject({
      status_details: { failed_services: ['flaky-sidecar'] },
    });

    const broken = await settled((await manager.install(await definitionId('broken-addon')))._id);
    expect(broken.status).toBe('active');
    const failed = await waitForStatus(broken._id, 'failed');
    expect(failed.status_details?.failed_services).toEqual(['broken-worker']);
    expect(failed.logs).toContain('manifest');
  });

  it('fails an install-time error at once, with empty details and no logs', async () => {
    const created = await manager.install(await definitionId('install-error-addon'));
    const failed = await settled(created._id);
    expect(failed.status).toBe('failed');
    expect(failed.status_details?.failed_services).toEqual([]);
    expect(failed.logs).toBeUndefined();
    const raw = JSON.parse(await (await fetch(`${managerUrl}/${created._id}`)).text()) as Record<
      string,
      unknown
    >;
    expect(raw.status_details).toEqual({});
    expect(raw).not.toHaveProperty('logs');
  });

  it('stops the pending monitor event when the addon is disabled meanwhile', async () => {
    const flaky = await settled((await manager.install(await definitionId('flaky-addon')))._id);
    await manager.remove(flaky._id);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect((await manager.get(flaky._id)).status).toBe('disabled');
  });

  it('rejects a double install with 400', async () => {
    await expect(manager.install(await definitionId('example'))).rejects.toMatchObject({
      status: 400,
      message:
        'Addon with marketplace-id - ' + (await definitionId('example')) + ' already exists.',
    });
  });

  it('rejects an unknown marketplace id with a 500, as the real service does', async () => {
    await expect(manager.install('000000000000000000000000')).rejects.toMatchObject({
      status: 500,
    });
  });

  it('removes in two steps: 200 disabling, then 204 removed', async () => {
    const [example] = await manager.list();
    const first = await manager.remove(example!._id);
    expect(first).toMatchObject({ kind: 'disabling', addon: { status: 'disabling' } });

    // Not disabled yet: another DELETE only restarts the disabling.
    expect((await manager.remove(example!._id)).kind).toBe('disabling');

    expect((await settled(example!._id)).status).toBe('disabled');
    expect(addons.uiAddons()).toEqual([]);
    await expect(manager.remove(example!._id)).resolves.toEqual({ kind: 'removed' });
    await expect(manager.get(example!._id)).rejects.toMatchObject({ status: 404 });
    // Free to install again.
    await expect(manager.install(await definitionId('example'))).resolves.toMatchObject({
      status: 'installing',
    });
  });

  it('patches the status and validates it', async () => {
    const [example] = await manager.list();
    await expect(manager.setStatus(example!._id, 'disabled')).resolves.toMatchObject({
      status: 'disabled',
    });
    const reenabled = await manager.setStatus(example!._id, 'installing');
    expect(reenabled.status).toBe('installing');
    expect((await settled(example!._id)).status).toBe('active');

    const response = await fetch(`${managerUrl}/${example!._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'nonsense' }),
    });
    expect(response.status).toBe(422);
    await expect(manager.setStatus('000000000000000000000000', 'active')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('keeps status_details and logs when a PATCH sets active, like a Mongo $set', async () => {
    const failed = (await manager.list({ status: 'failed' }))[0]!;
    const patched = await manager.setStatus(failed._id, 'active');
    expect(patched.status).toBe('active');
    expect(patched.logs).toContain('out of memory');
    expect(patched.status_details?.failed_services).toEqual(['legacy-exporter']);
  });

  it('has no ui-addons without ui block support', () => {
    expect(addons.uiAddons()).toEqual([]);
  });
});

describe('mock with uiBlockSupport', () => {
  const withUi = createMockServer({
    baseUrl: 'http://dash.test/api',
    addons: { managerUrl, marketplaceUrl, installDelayMs: 20, uiBlockSupport: true },
  });
  const uiMarket = createMarketplaceApi(createAddonsClient({ baseUrl: marketplaceUrl }));
  const uiManager = createAddonsManagerApi(createAddonsClient({ baseUrl: managerUrl }));

  beforeEach(() => {
    server.close();
    withUi.server.listen({ onUnhandledFrame: 'error' });
  });
  afterEach(() => {
    withUi.addons.reset();
    withUi.server.close();
    server.listen({ onUnhandledFrame: 'error' });
  });

  it('lists the ui block of example and accepts it on register', async () => {
    const list = await uiMarket.list();
    expect(list.find((addon) => addon.name === 'example')?.ui).toEqual({
      service: 'example-ui',
      sdk: '^0.1.0',
    });
    expect(list.filter((addon) => addon.ui)).toHaveLength(1);
    const ok = await uiMarket.register({
      name: 'mine',
      services: [{ service_name: 'mine-ui', image: 'ghcr.io/me/ui:1' }],
      ui: { service: 'mine-ui', sdk: '^1.0.0' },
    });
    expect(ok.ui).toEqual({ service: 'mine-ui', sdk: '^1.0.0' });
  });

  it('derives ui-addons from active addons whose definition has a ui block', async () => {
    expect(withUi.addons.uiAddons()).toEqual([
      { name: 'example', version: '0.1.0', sdk: '^0.1.0' },
    ]);
    const [example] = await uiManager.list();
    withUi.addons.forceStatus(example!._id, 'failed');
    expect(withUi.addons.uiAddons()).toEqual([]);
  });
});
