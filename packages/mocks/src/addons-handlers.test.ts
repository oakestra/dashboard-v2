import {
  createAddonsClient,
  createAddonsManagerApi,
  createMarketplaceApi,
  isConsentRequiredError,
  isTransitionalAddonStatus,
  type InstalledAddon,
} from '@oakestra/api';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

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

/** Like the dashboard: the first call fetches the definition, the second accepts its hash. */
async function install(qualifiedName: string): Promise<InstalledAddon> {
  const error = await manager.install(qualifiedName).catch((e: unknown) => e);
  if (!isConsentRequiredError(error)) throw error;
  return manager.install(qualifiedName, { acceptDefinition: error.consentRequest.definitionHash });
}

async function waitForStatus(id: string, status?: string) {
  let addon = await manager.get(id);
  const done = () =>
    status === undefined ? !isTransitionalAddonStatus(addon.status) : addon.status === status;
  for (let i = 0; i < 100 && !done(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    addon = await manager.get(id);
  }
  return addon;
}
const settled = (id: string) => waitForStatus(id);

const rawPost = (url: string, body: unknown) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('mock marketplace', () => {
  it('lists official, taps and local, each sorted by name', async () => {
    const list = await market.list();
    expect(list.map((addon) => addon.qualified_name)).toEqual([
      'analytics',
      'broken-addon',
      'example',
      'flaky-addon',
      'flops',
      'install-error-addon',
      'legacy-exporter',
      'acme/node-exporter',
      'local/docker-inspector',
    ]);
    expect(list.find((addon) => addon.name === 'example')?.ui).toEqual({
      service: 'example-ui',
      sdk: '^0.1.0',
    });
    expect(await market.list({ source: 'acme' })).toHaveLength(1);
    expect(await market.list({ name: 'local/docker-inspector' })).toHaveLength(1);
  });

  it('derives the id, the required permissions and a stable hash', async () => {
    const item = await market.get({ source: 'acme', name: 'node-exporter' });
    expect(item).toMatchObject({
      id: 'acme--node-exporter',
      source: { kind: 'tap', name: 'acme' },
      permissions: { host_network: true, host_root: true, host_paths: ['/proc:ro', '/sys:ro'] },
      required_permissions: { host_network: true, host_root: true },
    });
    // The catalog serves no hash on purpose: only the addons manager's 409 does.
    expect(item).not.toHaveProperty('permissions_hash');
    await expect(market.get({ source: 'acme', name: 'nope' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('registers locally, lists it at once and needs a higher version to replace it', async () => {
    const item = await market.register({
      name: 'mine',
      version: '1.0.0',
      services: [{ service_name: 'mine-ui', image: 'ghcr.io/me/ui:1', ports: { '80': '8080' } }],
      permissions: { host_ports: [8080] },
      ui: { service: 'mine-ui', sdk: '^1.0.0' },
    });
    expect(item).toMatchObject({ qualified_name: 'local/mine', ui: { sdk: '^1.0.0' } });
    expect(await market.list({ name: 'local/mine' })).toHaveLength(1);

    await expect(
      market.register({
        name: 'mine',
        version: '1.0.0',
        services: [{ service_name: 'a', image: 'b' }],
      }),
    ).rejects.toMatchObject({ status: 409 });

    await market.removeLocal('mine');
    await expect(market.removeLocal('mine')).rejects.toMatchObject({ status: 404 });
  });

  it('rejects unknown fields and undeclared permissions with 422', async () => {
    const unknown = await rawPost(`${marketplaceUrl}/addons`, {
      name: 'x',
      version: '1.0.0',
      services: [{ service_name: 'a', image: 'b', privileged: true }],
    });
    expect(unknown.status).toBe(422);
    expect(await unknown.json()).toEqual({
      message: 'invalid request body: json: unknown field "privileged"',
    });

    const undeclared = await rawPost(`${marketplaceUrl}/addons`, {
      name: 'x',
      version: '1.0.0',
      services: [{ service_name: 'a', image: 'b', networks: ['oakestra'] }],
    });
    expect(undeclared.status).toBe(422);
    expect(await undeclared.json()).toMatchObject({
      errors: [{ path: 'permissions.core_network', message: 'is used but not declared' }],
    });
    expect(addons.state.catalog.some((def) => def.name === 'x')).toBe(false);
  });

  it('manages taps', async () => {
    expect((await market.sources.list()).map((s) => [s.name, s.kind])).toEqual([
      ['official', 'official'],
      ['acme', 'tap'],
      ['lab', 'tap'],
      ['local', 'local'],
    ]);
    const acme = (await market.sources.list()).find((s) => s.name === 'acme')!;
    expect(acme).toMatchObject({ has_token: true, deletable: true, addon_count: 1 });
    expect(acme).not.toHaveProperty('token');

    const added = await market.sources.add({ name: 'new', url: 'https://new.example/index.json' });
    expect(added).toMatchObject({ kind: 'tap', last_error: undefined });
    expect(added.last_synced_at).toBeDefined();
    await expect(
      market.sources.add({ name: 'new', url: 'https://new.example/index.json' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      market.sources.add({ name: 'plain', url: 'http://plain.example/index.json' }),
    ).rejects.toMatchObject({ status: 422 });

    // A first sync that fails keeps the tap, with the error.
    const broken = await market.sources.add({ name: 'down', url: 'https://unreachable.example/i' });
    expect(broken.last_error).toContain('unreachable.example');
    await expect(market.sources.sync('down')).rejects.toMatchObject({ status: 502 });

    await expect(market.sources.remove('official')).rejects.toMatchObject({ status: 409 });
    await market.sources.remove('acme');
    expect(await market.list({ source: 'acme' })).toEqual([]);
  });

  it('imports an index into a source', async () => {
    const source = await market.sources.importIndex('lab', {
      schema: 1,
      serial: 3,
      addons: [{ name: 'tool', version: '1.0.0', services: [{ service_name: 't', image: 'i' }] }],
    });
    expect(source).toMatchObject({ serial: 3, addon_count: 1, last_error: undefined });
    expect(await market.list({ name: 'lab/tool' })).toHaveLength(1);
  });
});

describe('mock addons-manager', () => {
  it('seeds one active, one partially_active with an update and one failed addon', async () => {
    const list = await manager.list();
    expect(list.map((addon) => [addon.name, addon.status])).toEqual([
      ['example', 'active'],
      ['analytics', 'partially_active'],
      ['legacy-exporter', 'failed'],
    ]);
    expect(list[1]).toMatchObject({
      version: '1.1.0',
      update_available: true,
      latest_version: '1.2.0',
    });
    const failed = list[2]!;
    expect(failed.status_details).toMatchObject({
      failed_services: ['legacy-exporter'],
      message: expect.stringContaining('grant signature invalid'),
    });
    expect(failed.logs).toContain('out of memory');
    expect(await manager.list({ status: 'failed' })).toHaveLength(1);
  });

  it('asks to accept the definition, then installs: installing, then active', async () => {
    const error = await manager.install('flops').catch((e: unknown) => e);
    expect(isConsentRequiredError(error)).toBe(true);
    if (!isConsentRequiredError(error)) return;
    expect(error.consentRequest.permissions.core_network).toBe(true);
    expect(error.consentRequest.definition.services[0]!.image).toContain('@sha256:');
    expect(error.consentRequest.definitionHash).toBe(
      addons.definitionHash(addons.state.catalog.find((d) => d.name === 'flops')!),
    );

    // A changed catalog invalidates the hash the admin saw.
    addons.state.catalog.find((d) => d.name === 'flops')!.services[1]!.image = 'other@sha256:9';
    const stale = await manager
      .install('flops', { acceptDefinition: error.consentRequest.definitionHash })
      .catch((e: unknown) => e);
    expect(isConsentRequiredError(stale)).toBe(true);
    if (!isConsentRequiredError(stale)) return;

    const created = await manager.install('flops', {
      acceptDefinition: stale.consentRequest.definitionHash,
    });
    expect(created).toMatchObject({ status: 'installing', addon_id: 'flops' });
    expect((await settled(created._id)).status).toBe('active');
    expect(addons.uiAddons()).toEqual([{ name: 'example', version: '0.1.0', sdk: '^0.1.0' }]);
  });

  it('installs a tap addon under its namespaced id', async () => {
    const created = await install('acme/node-exporter');
    expect(created).toMatchObject({ addon_id: 'acme--node-exporter', name: 'acme/node-exporter' });
  });

  it('reports a crashing container only after the addon was active', async () => {
    const flaky = await settled((await install('flaky-addon'))._id);
    expect(flaky.status).toBe('active');
    expect(await waitForStatus(flaky._id, 'partially_active')).toMatchObject({
      status_details: { failed_services: ['flaky-sidecar'] },
    });

    const broken = await settled((await install('broken-addon'))._id);
    const failed = await waitForStatus(broken._id, 'failed');
    expect(failed.status_details?.failed_services).toEqual(['broken-worker']);
    expect(failed.logs).toContain('manifest');
  });

  it('fails an install-time error at once, with a message and no logs', async () => {
    const failed = await settled((await install('install-error-addon'))._id);
    expect(failed.status).toBe('failed');
    expect(failed.status_details?.message).toContain('exit status');
    expect(failed.logs).toBeUndefined();
  });

  it('rejects a double install with a plain 409', async () => {
    const error = await install('example').catch((e: unknown) => e);
    expect(isConsentRequiredError(error)).toBe(false);
    expect(error).toMatchObject({ status: 409, message: 'Addon "example" is already installed.' });
    await expect(manager.install('nope')).rejects.toMatchObject({ status: 404 });
  });

  it('updates only after the new version was accepted, flagging grown permissions', async () => {
    const analytics = (await manager.list()).find((a) => a.name === 'analytics')!;
    const error = await manager.update(analytics._id).catch((e: unknown) => e);
    expect(isConsentRequiredError(error)).toBe(true);
    if (!isConsentRequiredError(error)) return;
    expect(error.consentRequest).toMatchObject({
      definition: { version: '1.2.0' },
      permissions: { host_ports: [8080, 9090] },
      previousVersion: '1.1.0',
      previousPermissions: { host_ports: [8080] },
      permissionsGrow: true,
    });

    const updating = await manager.update(analytics._id, {
      acceptDefinition: error.consentRequest.definitionHash,
    });
    expect(updating).toMatchObject({ status: 'updating', version: '1.2.0' });
    const done = await settled(analytics._id);
    expect(done).toMatchObject({ status: 'active', update_available: false });
    await expect(manager.update(analytics._id)).rejects.toMatchObject({ status: 409 });
  });

  it('re-approves a failed addon, which is deployed again', async () => {
    const legacy = (await manager.list({ status: 'failed' }))[0]!;
    const error = await manager.approve(legacy._id).catch((e: unknown) => e);
    expect(isConsentRequiredError(error)).toBe(true);
    if (!isConsentRequiredError(error)) return;
    const approved = await manager.approve(legacy._id, {
      acceptDefinition: error.consentRequest.definitionHash,
    });
    expect(approved).toMatchObject({ status: 'installing', status_details: {} });
    expect((await settled(legacy._id)).status).toBe('active');
  });

  it('removes in two steps: 200 disabling, then 204 removed', async () => {
    const [example] = await manager.list();
    const first = await manager.remove(example!._id);
    expect(first).toMatchObject({ kind: 'disabling', addon: { status: 'disabling' } });
    expect((await manager.remove(example!._id)).kind).toBe('disabling');

    expect((await settled(example!._id)).status).toBe('disabled');
    expect(addons.uiAddons()).toEqual([]);
    // A disabled record does not block a new install.
    await expect(install('example')).resolves.toMatchObject({ status: 'installing' });
    await expect(manager.remove(example!._id)).resolves.toEqual({ kind: 'removed' });
    await expect(manager.get(example!._id)).rejects.toMatchObject({ status: 404 });
  });

  it('rejects the old accept_permissions field with 400', async () => {
    const response = await fetch(`${managerUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'flops', accept_permissions: 'x' }),
    });
    expect(response.status).toBe(400);
  });

  it('answers every body as JSON and has no PATCH', async () => {
    const response = await fetch(`${managerUrl}/`);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    const missing = await fetch(`${managerUrl}/nope`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ message: 'Addon not found' });
  });

  it('stops the pending monitor event when the addon is disabled meanwhile', async () => {
    const flaky = await settled((await install('flaky-addon'))._id);
    await manager.remove(flaky._id);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect((await manager.get(flaky._id)).status).toBe('disabled');
  });
});
