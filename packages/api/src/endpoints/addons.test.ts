import { describe, expect, it } from 'vitest';

import { describeError, isApiError, messageFromErrorBody } from '../errors.ts';
import {
  addTapInputSchema,
  isTransitionalAddonStatus,
  registerAddonInputSchema,
  type RegisterAddonInput,
} from '../models/addon.ts';
import { createAddonsManagerApi, createMarketplaceApi, isConsentRequiredError } from './addons.ts';
import { createAddonsClient } from './addons-client.ts';

interface Seen {
  method: string;
  url: string;
  body: unknown;
  contentType: string | null;
}

function setup(respond: (request: Request) => Response, baseUrl = 'http://dash.test/addons-api/') {
  const seen: Seen[] = [];
  const client = createAddonsClient({
    baseUrl,
    fetch: async (request) => {
      const text = await request.clone().text();
      seen.push({
        method: request.method,
        url: request.url,
        body: text ? JSON.parse(text) : undefined,
        contentType: request.headers.get('Content-Type'),
      });
      return respond(request);
    },
  });
  return { seen, manager: createAddonsManagerApi(client), market: createMarketplaceApi(client) };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

const permissions = {
  host_paths: ['/data:ro'],
  host_ports: [],
  docker_socket: false,
  host_root: false,
  host_network: false,
  core_network: true,
};

const installed = {
  _id: 'a1',
  name: 'acme/example',
  qualified_name: 'acme/example',
  addon_id: 'acme--example',
  source: { kind: 'tap', name: 'acme' },
  version: '1.0.0',
  description: '',
  ui: null,
  services: [{ service_name: 'ui', image: 'img' }],
  volumes: [],
  networks: [],
  permissions,
  status: 'installing',
  status_details: {},
  update_available: false,
  latest_version: '',
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};

describe('addons-manager endpoints', () => {
  it('lists installed addons and drops malformed ones', async () => {
    const { manager, seen } = setup(() => json([installed, { nonsense: true }]));
    const list = await manager.list({ status: 'installing' });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ addon_id: 'acme--example', ui: undefined });
    expect(list[0]!.logs).toBeUndefined();
    expect(list[0]!.services[0]).toMatchObject({ environment: {}, ports: {} });
    expect(list[0]!.permissions).toEqual(permissions);
    expect(seen[0]!.url).toBe('http://dash.test/addons-api/?status=installing');
  });

  it('installs by qualified name with the accepted hash', async () => {
    const { manager, seen } = setup(() => json(installed, 201));
    await expect(
      manager.install('acme/example', { acceptDefinition: 'sha256:abc' }),
    ).resolves.toMatchObject({ _id: 'a1', status: 'installing' });
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: 'http://dash.test/addons-api/',
      body: { name: 'acme/example', accept_definition: 'sha256:abc' },
      contentType: 'application/json',
    });
  });

  it('turns the consent 409 into an inspectable error', async () => {
    const { manager, seen } = setup(() =>
      json(
        {
          message: 'This version has to be accepted before it is installed.',
          definition: {
            name: 'example',
            source: { kind: 'tap', name: 'acme' },
            version: '2.0.0',
            services: [{ service_name: 'ui', image: 'img@sha256:1' }],
            permissions: { ...permissions, docker_socket: true },
          },
          definition_hash: 'sha256:new',
          permissions: { ...permissions, docker_socket: true },
          previous_version: '1.0.0',
          previous_permissions: permissions,
          permissions_grow: true,
        },
        409,
      ),
    );
    const error = await manager.update('a1').catch((e: unknown) => e);
    expect(isApiError(error)).toBe(true);
    expect(isConsentRequiredError(error)).toBe(true);
    if (!isConsentRequiredError(error)) return;
    expect(error.consentRequest).toMatchObject({
      definitionHash: 'sha256:new',
      definition: { version: '2.0.0', services: [{ image: 'img@sha256:1', environment: {} }] },
      permissions: { docker_socket: true },
      previousVersion: '1.0.0',
      previousPermissions: { docker_socket: false },
      permissionsGrow: true,
    });
    expect(describeError(error)).toContain('has to be accepted');
    // The backend needs a JSON object even when nothing has been accepted.
    expect(seen[0]).toMatchObject({
      url: 'http://dash.test/addons-api/a1/update',
      body: { accept_definition: '' },
    });
  });

  it('keeps 409s without a definition hash plain', async () => {
    const { manager } = setup(() =>
      json({ message: 'Addon "acme/example" is already installed.' }, 409),
    );
    const error = await manager.install('acme/example').catch((e: unknown) => e);
    expect(isConsentRequiredError(error)).toBe(false);
    expect(error).toMatchObject({ status: 409, message: expect.stringContaining('already') });
  });

  it('approves with the hash', async () => {
    const { manager, seen } = setup(() => json(installed));
    await manager.approve('a1', { acceptDefinition: 'sha256:abc' });
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: 'http://dash.test/addons-api/a1/approve',
      body: { accept_definition: 'sha256:abc' },
    });
  });

  it('distinguishes DELETE 200 (disabling) from 204 (removed)', async () => {
    const first = setup(() => json({ ...installed, status: 'disabling' }));
    await expect(first.manager.remove('a1')).resolves.toMatchObject({
      kind: 'disabling',
      addon: { _id: 'a1', status: 'disabling' },
    });
    expect(first.seen[0]!.url).toBe('http://dash.test/addons-api/a1');

    const second = setup(() => new Response(null, { status: 204 }));
    await expect(second.manager.remove('a1')).resolves.toEqual({ kind: 'removed' });
  });

  it('keeps failure details and logs, and flags invalid responses', async () => {
    const { manager } = setup(() =>
      json({
        ...installed,
        status: 'failed',
        status_details: { failed_services: ['ui'], message: 'grant signature invalid' },
        logs: 'pull failed\ngiving up',
      }),
    );
    const addon = await manager.get('a1');
    expect(addon.status_details).toMatchObject({
      failed_services: ['ui'],
      message: 'grant signature invalid',
    });
    expect(addon.logs).toBe('pull failed\ngiving up');

    const bad = setup(() => json({ ...installed, status: 'exploded' }));
    await expect(bad.manager.get('a1')).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('reports an unreachable upstream, but shows the service's own gateway message', async () => {
    const gateway = setup(() => new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    await expect(gateway.manager.list()).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('not reachable'),
    });

    const marketDown = setup(() => json({ message: 'Marketplace is unavailable' }, 502));
    await expect(marketDown.manager.install('x')).rejects.toMatchObject({
      message: 'Marketplace is unavailable',
    });

    const client = createAddonsClient({
      baseUrl: 'http://dash.test/x',
      fetch: () => Promise.reject(new TypeError('failed to fetch')),
    });
    await expect(createAddonsManagerApi(client).list()).rejects.toMatchObject({ kind: 'network' });
  });
});

const definition: RegisterAddonInput = {
  name: 'demo',
  version: '1.0.0',
  services: [
    { service_name: 'api', image: 'ghcr.io/x/api:1' },
    { service_name: 'demo-ui', image: 'ghcr.io/x/ui:1' },
  ],
};

const item = {
  name: 'example',
  qualified_name: 'example',
  id: 'example',
  source: { kind: 'official', name: 'official' },
  version: '0.1.0',
  services: [],
  volumes: [],
  networks: [],
  permissions,
  required_permissions: permissions,
  ui: { service: 'ui', sdk: '^0.1.0' },
};

describe('marketplace endpoints', () => {
  const base = 'http://dash.test/marketplace-api';

  it('lists addons, filters by source and name and reads the ui block', async () => {
    const { market, seen } = setup(
      () => json([item, { ...item, name: 'plain', ui: undefined }, { name: 'broken' }]),
      base,
    );
    const list = await market.list({ source: 'official', name: 'example' });
    expect(list).toHaveLength(2);
    expect(list[0]!.ui).toEqual({ service: 'ui', sdk: '^0.1.0' });
    expect(list[1]!.ui).toBeUndefined();
    expect(seen[0]!.url).toBe(`${base}/addons?source=official&name=example`);
  });

  it('reads one addon by source and name', async () => {
    const { market, seen } = setup(() => json(item), base);
    await expect(market.get({ source: 'acme', name: 'tool' })).resolves.toMatchObject({
      name: 'example',
    });
    expect(seen[0]!.url).toBe(`${base}/addons/acme/tool`);
  });

  it('registers a valid definition and refuses an invalid one before any request', async () => {
    const { market, seen } = setup(
      () => json({ ...item, source: { kind: 'local', name: 'local' } }, 201),
      base,
    );
    await expect(market.register({ ...definition, privileged: true })).resolves.toMatchObject({
      source: { kind: 'local' },
    });
    // Unknown fields reach the marketplace, which names them.
    expect(seen[0]).toMatchObject({ url: `${base}/addons`, body: { privileged: true } });

    await expect(market.register({ ...definition, name: ' ' })).rejects.toMatchObject({
      status: 422,
    });
    await expect(market.register({ ...definition, version: 'v1' })).rejects.toMatchObject({
      status: 422,
    });
    expect(seen).toHaveLength(1);
  });

  it('removes a local registration', async () => {
    const { market, seen } = setup(() => new Response(null, { status: 204 }), base);
    await expect(market.removeLocal('demo')).resolves.toBeUndefined();
    expect(seen[0]).toMatchObject({ method: 'DELETE', url: `${base}/addons/local/demo` });
  });

  it('manages sources', async () => {
    const source = {
      name: 'acme',
      kind: 'tap',
      url: 'https://acme.example/index.json?<redacted>',
      has_token: true,
      sync_enabled: true,
      deletable: true,
      last_synced_at: null,
      last_error: 'fetch failed',
      addon_count: 3,
    };
    const { market, seen } = setup(
      (request) =>
        request.method === 'DELETE'
          ? new Response(null, { status: 204 })
          : json(
              request.method === 'GET' ? [source] : source,
              request.url.endsWith('/sources') ? 201 : 200,
            ),
      base,
    );
    await expect(market.sources.list()).resolves.toMatchObject([
      { name: 'acme', last_error: 'fetch failed', last_synced_at: undefined, addon_count: 3 },
    ]);
    await market.sources.add({ name: 'acme', url: 'https://acme.example/index.json', token: '' });
    await market.sources.sync('acme');
    await market.sources.importIndex('acme', { schema: 1, addons: [] });
    await market.sources.remove('acme');
    expect(seen.map((s) => `${s.method} ${s.url.slice(base.length)}`)).toEqual([
      'GET /sources',
      'POST /sources',
      'POST /sources/acme/sync',
      'POST /sources/acme/import',
      'DELETE /sources/acme',
    ]);
    // An empty token is not sent: the marketplace would store it.
    expect(seen[1]!.body).toEqual({ name: 'acme', url: 'https://acme.example/index.json' });
  });

  it('shows why a sync failed', async () => {
    const { market } = setup(() => json({ message: 'fetching index: 404 Not Found' }, 502), base);
    await expect(market.sources.sync('acme')).rejects.toMatchObject({
      message: 'fetching index: 404 Not Found',
    });
  });
});

describe('registerAddonInputSchema', () => {
  const run = (input: unknown) => registerAddonInputSchema.safeParse(input);

  it('requires version, service_name and image', () => {
    const result = run({ name: 'x', services: [{ service_name: '', image: '' }] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual(
      expect.arrayContaining(['version', 'services.0.service_name', 'services.0.image']),
    );
    expect(run({ name: 'x', version: '1.0.0', services: [] }).success).toBe(false);
  });

  it('accepts permissions and a ui block that references a service', () => {
    expect(
      run({
        ...definition,
        permissions: { host_ports: [8080], core_network: true },
        ui: { service: 'demo-ui', sdk: '^0.1.0' },
      }).success,
    ).toBe(true);
    expect(run(definition).success).toBe(true);
  });

  it('rejects a ui block with an unknown service or a bad range', () => {
    const unknown = run({ ...definition, ui: { service: 'nope', sdk: '^0.1.0' } });
    expect(unknown.error?.issues[0]).toMatchObject({ path: ['ui', 'service'] });
    const range = run({ ...definition, ui: { service: 'demo-ui', sdk: 'latest-ish' } });
    expect(range.error?.issues[0]).toMatchObject({ path: ['ui', 'sdk'] });
  });
});

describe('addTapInputSchema', () => {
  it('checks the tap name', () => {
    expect(addTapInputSchema.safeParse({ name: 'acme', url: 'https://x' }).success).toBe(true);
    expect(addTapInputSchema.safeParse({ name: 'Acme Corp', url: 'https://x' }).success).toBe(
      false,
    );
  });
});

describe('messageFromErrorBody', () => {
  it('flattens the field error list of the addon services', () => {
    expect(
      messageFromErrorBody(
        { errors: [{ path: 'services[0].image', message: 'is required' }, { message: 'bad' }] },
        422,
      ),
    ).toBe('services[0].image: is required bad');
  });
});

describe('isTransitionalAddonStatus', () => {
  it('is true for installing, updating and disabling only', () => {
    expect(['installing', 'updating', 'disabling'].every(isTransitionalAddonStatus)).toBe(true);
    expect(
      ['active', 'failed', 'disabled', 'partially_active'].some(isTransitionalAddonStatus),
    ).toBe(false);
  });
});
