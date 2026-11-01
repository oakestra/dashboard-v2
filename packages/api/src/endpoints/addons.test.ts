import { describe, expect, it } from 'vitest';

import { isApiError } from '../errors.ts';
import {
  isTransitionalAddonStatus,
  registerAddonInputSchema,
  type RegisterAddonInput,
} from '../models/addon.ts';
import { createAddonsManagerApi, createMarketplaceApi } from './addons.ts';
import { createAddonsClient } from './addons-client.ts';

interface Seen {
  method: string;
  url: string;
  body: unknown;
  contentType: string | null;
}

/** A fake backend that, like Flask's json.dumps handlers, answers JSON as text/html. */
function setup(respond: (request: Request) => Response) {
  const seen: Seen[] = [];
  const client = createAddonsClient({
    baseUrl: 'http://dash.test/addons-api/',
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

const textJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'text/html' } });

const installed = {
  _id: 'a1',
  marketplace_id: 'm1',
  name: 'example',
  description: null,
  services: [{ service_name: 'ui', image: 'img' }],
  status: 'installing',
};

describe('addons-manager endpoints', () => {
  it('parses JSON bodies that are not labelled application/json', async () => {
    const { manager, seen } = setup(() => textJson([installed, { nonsense: true }]));
    const list = await manager.list({ status: 'installing' });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ description: '', volumes: [], networks: [] });
    expect(list[0]!.services[0]).toMatchObject({ environment: {}, ports: {} });
    expect(seen[0]!.url).toBe('http://dash.test/addons-api/?status=installing');
  });

  it('installs with the marketplace id', async () => {
    const { manager, seen } = setup(() => textJson(installed, 201));
    await expect(manager.install('m1')).resolves.toMatchObject({ _id: 'a1', status: 'installing' });
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: 'http://dash.test/addons-api/',
      body: { marketplace_id: 'm1' },
      contentType: 'application/json',
    });
  });

  it('turns the 400 for a double install into a readable ApiError', async () => {
    const { manager } = setup(() =>
      textJson(
        {
          code: 400,
          status: 'Bad Request',
          message: 'Addon with marketplace-id - m1 already exists.',
        },
        400,
      ),
    );
    const error = await manager.install('m1').catch((e: unknown) => e);
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({
      status: 400,
      message: 'Addon with marketplace-id - m1 already exists.',
    });
  });

  it('distinguishes DELETE 200 (disabling) from 204 (removed)', async () => {
    const first = setup(() => textJson({ ...installed, status: 'disabling' }));
    await expect(first.manager.remove('a1')).resolves.toMatchObject({
      kind: 'disabling',
      addon: { _id: 'a1', status: 'disabling' },
    });
    expect(first.seen[0]!.url).toBe('http://dash.test/addons-api/a1');

    const second = setup(() => new Response(null, { status: 204 }));
    await expect(second.manager.remove('a1')).resolves.toEqual({ kind: 'removed' });
  });

  it('patches the status and flags invalid responses', async () => {
    const ok = setup(() => textJson({ ...installed, status: 'disabled' }));
    await ok.manager.setStatus('a1', 'disabled');
    expect(ok.seen[0]).toMatchObject({ method: 'PATCH', body: { status: 'disabled' } });

    const bad = setup(() => textJson({ ...installed, status: 'exploded' }));
    await expect(bad.manager.get('a1')).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('keeps failure details and logs', async () => {
    const { manager } = setup(() =>
      textJson({
        ...installed,
        status: 'failed',
        status_details: { failed_services: ['ui'] },
        logs: ['pull failed', 'giving up'],
      }),
    );
    const addon = await manager.get('a1');
    expect(addon.status_details?.failed_services).toEqual(['ui']);
    expect(addon.logs).toBe('pull failed\ngiving up');
  });

  it('reports an unreachable upstream and network failures', async () => {
    const gateway = setup(() => new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    await expect(gateway.manager.list()).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('not reachable'),
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
  services: [
    { service_name: 'api', image: 'ghcr.io/x/api:1' },
    { service_name: 'demo-ui', image: 'ghcr.io/x/ui:1' },
  ],
};

describe('marketplace endpoints', () => {
  it('lists, filters by name and reads the optional ui block', async () => {
    const { market, seen } = setup(() =>
      Response.json([
        {
          _id: 'm1',
          name: 'example',
          status: 'approved',
          services: [],
          ui: { service: 'ui', sdk: '^0.1.0' },
        },
        { _id: 'm2', name: 'plain', services: [] },
      ]),
    );
    const list = await market.list({ name: 'example' });
    expect(list[0]!.ui).toEqual({ service: 'ui', sdk: '^0.1.0' });
    expect(list[1]!.ui).toBeUndefined();
    expect(seen[0]!.url).toBe('http://dash.test/addons-api/?name=example');
  });

  it('registers a valid definition and refuses an invalid one before any request', async () => {
    const { market, seen } = setup(() =>
      Response.json(
        { _id: 'm9', name: 'demo', status: 'under_review', services: [] },
        { status: 201 },
      ),
    );
    await expect(market.register(definition)).resolves.toMatchObject({ _id: 'm9' });
    expect(seen).toHaveLength(1);

    await expect(market.register({ ...definition, name: ' ' })).rejects.toMatchObject({
      status: 422,
    });
    expect(seen).toHaveLength(1);
  });

  it('removes a definition', async () => {
    const { market, seen } = setup(() => new Response(null, { status: 204 }));
    await expect(market.remove('m1')).resolves.toBeUndefined();
    expect(seen[0]).toMatchObject({ method: 'DELETE' });
  });
});

describe('registerAddonInputSchema', () => {
  const run = (input: unknown) => registerAddonInputSchema.safeParse(input);

  it('requires service_name and image', () => {
    const result = run({ name: 'x', services: [{ service_name: '', image: '' }] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual(
      expect.arrayContaining(['services.0.service_name', 'services.0.image']),
    );
    expect(run({ name: 'x', services: [] }).success).toBe(false);
  });

  it('accepts a ui block that references a service with a valid semver range', () => {
    expect(run({ ...definition, ui: { service: 'demo-ui', sdk: '^0.1.0' } }).success).toBe(true);
    expect(run(definition).success).toBe(true);
  });

  it('rejects a ui block with an unknown service or a bad range', () => {
    const unknown = run({ ...definition, ui: { service: 'nope', sdk: '^0.1.0' } });
    expect(unknown.error?.issues[0]).toMatchObject({ path: ['ui', 'service'] });
    const range = run({ ...definition, ui: { service: 'demo-ui', sdk: 'latest-ish' } });
    expect(range.error?.issues[0]).toMatchObject({ path: ['ui', 'sdk'] });
  });
});

describe('isTransitionalAddonStatus', () => {
  it('is true for installing and disabling only', () => {
    expect(['installing', 'disabling'].every(isTransitionalAddonStatus)).toBe(true);
    expect(
      ['active', 'failed', 'disabled', 'partially_active'].some(isTransitionalAddonStatus),
    ).toBe(false);
  });
});
