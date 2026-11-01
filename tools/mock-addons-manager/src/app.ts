import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import {
  createAddonsBackend,
  type AddonsBackend,
  type BackendResponse,
  type MockInstalledAddon,
  type MockMarketplaceAddon,
} from '@oakestra/mocks/addons';

/**
 * Mock of the addons-manager AND the marketplace-manager on one port (their paths differ), for the
 * e2e stack and `docker-compose.dev.yml`. The behaviour lives in `@oakestra/mocks` (shared with
 * the MSW handlers); this file only serves it over HTTP and adds the `/__test` control API.
 *
 * Endpoints:
 * - `/api/v1/addons[/<id>]`: addons-manager
 * - `/api/v1/marketplace/addons[/<id>]`: marketplace-manager
 * - `GET /api/v1/ui-addons`: `[{name, version, sdk}]` of active addons whose definition has `ui`
 *
 * Test API, which predates the two backends and keeps working on top of them. The old model was a
 * flat list of `{name, version, sdk, enabled}`; it maps onto the new one like this:
 * - `enabled: true`  -> the addon is installed and `active` (installed on the spot if needed,
 *   with a marketplace definition that has a ui block created for unknown names)
 * - `enabled: false` -> the installed addon is `disabled` (no `disabling` phase, no timers)
 * - `sdk`            -> `ui.sdk` of its marketplace definition (a ui block is added if missing)
 * - `version`        -> the version reported by `/ui-addons` (stored apart: no model has it yet)
 *
 *   GET    /__test/addons          legacy view of all installed addons
 *   PUT    /__test/addons/<name>   body {enabled?, version?, sdk?}; PATCH is the same
 *   DELETE /__test/addons/<name>   drops the installed record
 *   GET    /__test/state           raw {marketplace, installed}
 *   PUT    /__test/config          body {installDelayMs?, disableDelayMs?, reviewDelayMs?, monitorDelayMs?}
 *   POST   /__test/reset           restores the seed (delays are kept)
 */
export interface LegacyAddon {
  name: string;
  version: string;
  sdk: string;
  enabled: boolean;
}

export interface MockAddonsManagerOptions {
  /** Replaces the default seed: addons set up as by `PUT /__test/addons/<name>`. */
  seed?: readonly Partial<LegacyAddon>[];
  installDelayMs?: number;
  /** Delay between `active` and the monitor noticing a crash (flaky and broken fixtures). */
  monitorDelayMs?: number;
  /** Accept and return the planned marketplace `ui` block. Off like the real marketplace. */
  uiBlockSupport?: boolean;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '600',
};

const DEFAULT_SDK = '^0.1.0';
const DEFAULT_VERSION = '0.1.0';

export function createMockAddonsManager(options: MockAddonsManagerOptions = {}): Server {
  const backend = createAddonsBackend({
    installDelayMs: options.installDelayMs,
    monitorDelayMs: options.monitorDelayMs,
    uiBlockSupport: options.uiBlockSupport,
  });
  seed();

  function seed(): void {
    backend.reset();
    if (!options.seed) return;
    backend.state.installed = [];
    for (const entry of options.seed) {
      if (entry.name) applyPatch(backend, entry.name, { enabled: true, ...entry });
    }
  }

  return createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      sendJson(response, 500, { message: String(error) });
    });
  });

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const method = request.method ?? 'GET';
    const path = url.pathname.replace(/(?<=.)\/+$/, '');

    if (method === 'OPTIONS') {
      response.writeHead(204, CORS_HEADERS).end();
      return;
    }
    if (method === 'GET' && path === '/healthz') return sendJson(response, 200, { ok: true });
    if (method === 'GET' && path === '/api/v1/ui-addons') {
      return sendJson(response, 200, backend.uiAddons());
    }

    const addons = /^\/api\/v1\/addons(?:\/([^/]+))?$/.exec(path);
    if (addons) {
      const id = addons[1] ? decodeURIComponent(addons[1]) : undefined;
      const body = method === 'POST' || method === 'PATCH' ? await readJson(request) : undefined;
      if (!id && method === 'GET') {
        return sendBackend(
          response,
          backend.manager.list({ status: url.searchParams.get('status') }),
        );
      }
      if (!id && method === 'POST') return sendBackend(response, backend.manager.install(body));
      if (id && method === 'GET') return sendBackend(response, backend.manager.get(id));
      if (id && method === 'PATCH') return sendBackend(response, backend.manager.patch(id, body));
      if (id && method === 'DELETE') return sendBackend(response, backend.manager.remove(id));
    }

    const market = /^\/api\/v1\/marketplace\/addons(?:\/([^/]+))?$/.exec(path);
    if (market) {
      const id = market[1] ? decodeURIComponent(market[1]) : undefined;
      if (!id && method === 'GET') {
        return sendBackend(
          response,
          backend.marketplace.list({ name: url.searchParams.get('name') }),
        );
      }
      if (!id && method === 'POST') {
        return sendBackend(response, backend.marketplace.register(await readJson(request)));
      }
      if (id && method === 'GET') return sendBackend(response, backend.marketplace.get(id));
      if (id && method === 'DELETE') return sendBackend(response, backend.marketplace.remove(id));
    }

    if (method === 'GET' && path === '/__test/addons') {
      return sendJson(
        response,
        200,
        backend.state.installed.map((addon) => legacyView(backend, addon)),
      );
    }
    if (method === 'GET' && path === '/__test/state') {
      return sendJson(response, 200, backend.state);
    }
    if (method === 'PUT' && path === '/__test/config') {
      const config = (await readJson(request)) as Record<string, unknown>;
      const numbers = (key: string) => (typeof config[key] === 'number' ? config[key] : undefined);
      backend.setDelays({
        installDelayMs: numbers('installDelayMs'),
        disableDelayMs: numbers('disableDelayMs'),
        reviewDelayMs: numbers('reviewDelayMs'),
        monitorDelayMs: numbers('monitorDelayMs'),
      });
      return sendJson(response, 200, { ok: true });
    }
    if (method === 'POST' && path === '/__test/reset') {
      seed();
      return sendJson(
        response,
        200,
        backend.state.installed.map((addon) => legacyView(backend, addon)),
      );
    }

    const test = /^\/__test\/addons\/([a-z0-9-]+)$/.exec(path);
    if (test && (method === 'PUT' || method === 'PATCH')) {
      const patch = (await readJson(request)) as Partial<LegacyAddon>;
      const addon = applyPatch(backend, test[1]!, patch);
      return sendJson(response, 200, legacyView(backend, addon));
    }
    if (test && method === 'DELETE') {
      backend.state.installed = backend.state.installed.filter((addon) => addon.name !== test[1]);
      return sendJson(response, 204, null);
    }

    sendJson(response, 404, { message: `No route for ${method} ${url.pathname}` });
  }
}

function legacyView(backend: AddonsBackend, addon: MockInstalledAddon): LegacyAddon {
  const definition = backend.state.marketplace.find((item) => item._id === addon.marketplace_id);
  return {
    name: addon.name,
    version: backend.versions.get(addon.name) ?? DEFAULT_VERSION,
    sdk: definition?.ui?.sdk ?? DEFAULT_SDK,
    enabled: addon.status === 'active',
  };
}

/** The `/__test/addons/<name>` semantics described at the top of this file. */
function applyPatch(
  backend: AddonsBackend,
  name: string,
  patch: Partial<LegacyAddon>,
): MockInstalledAddon {
  const { state } = backend;
  let definition: MockMarketplaceAddon | undefined = state.marketplace.find(
    (item) => item.name === name,
  );
  let installed = state.installed.find((item) => item.name === name);

  const unknownName = !definition;
  if (!definition) {
    const service = `${name}-ui`;
    definition = {
      _id: crypto.randomUUID().replaceAll('-', '').slice(0, 24),
      name,
      description: `Addon created through the test API`,
      services: [
        {
          service_name: service,
          image: `ghcr.io/oakestra/${name}:${DEFAULT_VERSION}`,
          networks: [],
          volumes: [],
          ports: {},
          environment: {},
          labels: {},
        },
      ],
      volumes: [],
      networks: [],
      status: 'approved',
      ui: { service, sdk: DEFAULT_SDK },
    };
    state.marketplace.push(definition);
  }

  if (typeof patch.sdk === 'string') {
    definition.ui = {
      service: definition.ui?.service ?? definition.services[0]!.service_name,
      sdk: patch.sdk,
    };
  }
  if (typeof patch.version === 'string') backend.versions.set(name, patch.version);

  // The old API treated an unknown name as an enabled addon unless told otherwise.
  const enabled = patch.enabled ?? (unknownName ? true : undefined);
  if (enabled === true && !installed) {
    backend.manager.install({ marketplace_id: definition._id });
    installed = state.installed.find((item) => item.name === name)!;
  }
  if (installed && enabled !== undefined) {
    backend.forceStatus(installed._id, enabled ? 'active' : 'disabled');
    if (enabled) {
      delete installed.status_details;
      delete installed.logs;
    }
  }
  return (
    installed ??
    ({ name, marketplace_id: definition._id, status: 'disabled' } as MockInstalledAddon)
  );
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return undefined;
  }
}

function sendBackend(response: ServerResponse, result: BackendResponse): void {
  const headers: Record<string, string> = { ...CORS_HEADERS, 'Cache-Control': 'no-store' };
  if (result.contentType) headers['Content-Type'] = result.contentType;
  response.writeHead(result.status, headers);
  response.end(result.text);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  if (status === 204) {
    response.writeHead(204, CORS_HEADERS).end();
    return;
  }
  response.writeHead(status, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

export function seedFromEnv(
  value: string | undefined,
): readonly Partial<LegacyAddon>[] | undefined {
  if (!value) return undefined;
  return JSON.parse(value) as Partial<LegacyAddon>[];
}
