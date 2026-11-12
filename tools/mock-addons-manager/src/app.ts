import type { Server } from 'node:http';

import {
  addonId,
  createAddonsBackend,
  createAddonsFetchHandler,
  noPermissions,
  qualifiedName,
  type AddonsBackend,
  type MockDefinition,
  type MockInstalledAddon,
} from '@oakestra/mocks';
import { createMockHttpServer } from '@oakestra/mocks/http';

/**
 * Mock of the Go addons engine (addons-manager and marketplace) on one port, since their paths differ,
 * for the e2e stack and `compose.dev.yml`. The behaviour lives in `@oakestra/mocks` (shared with
 * the MSW handlers); this file only serves it over HTTP and adds the `/__test` control API.
 *
 * Endpoints:
 * - `/api/v1/addons[/<id>[/update|/approve]]`: addons-manager
 * - `/api/v1/marketplace/addons...`, `/api/v1/marketplace/sources...`: marketplace
 * - `GET /api/v1/ui-addons`: `[{name, version, sdk}]` of active addons whose definition has `ui`
 *
 * Test API, which predates the backends and keeps working on top of them. Addons are named by
 * their id (the name in `/ui-addons`). The old model was a flat list of
 * `{name, version, sdk, enabled}`; it maps onto the new one like this:
 * - `enabled: true`  -> the addon is installed and `active` (installed on the spot, definition
 *   accepted, with an official catalog definition that has a ui block created for unknown names)
 * - `enabled: false` -> the installed addon is `disabled` (no `disabling` phase, no timers)
 * - `sdk`            -> `ui.sdk` of its catalog and installed definition (a ui block is added)
 * - `version`        -> the version reported by `/ui-addons`
 *
 *   GET    /__test/addons          legacy view of all installed addons
 *   PUT    /__test/addons/<id>     body {enabled?, version?, sdk?}; PATCH is the same
 *   DELETE /__test/addons/<id>     drops the installed records
 *   GET    /__test/state           raw {sources, catalog, installed}
 *   PUT    /__test/config          body {installDelayMs?, disableDelayMs?, monitorDelayMs?}
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
}

// Handlers match on absolute URLs. Requests are rebuilt against this origin, whatever Host header
// the browser sent.
const INTERNAL_ORIGIN = 'http://mock-addons-manager';

const DEFAULT_SDK = '^0.1.0';
const DEFAULT_VERSION = '0.1.0';

export function createMockAddonsManager(options: MockAddonsManagerOptions = {}): Server {
  const backend = createAddonsBackend({
    installDelayMs: options.installDelayMs,
    monitorDelayMs: options.monitorDelayMs,
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

  const handleBackends = createAddonsFetchHandler({
    backend,
    managerUrl: `${INTERNAL_ORIGIN}/api/v1/addons`,
    marketplaceUrl: `${INTERNAL_ORIGIN}/api/v1/marketplace`,
  });

  return createMockHttpServer({ name: 'mock-addons-manager', origin: INTERNAL_ORIGIN, handle });

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname.replace(/(?<=.)\/+$/, '');

    if (method === 'GET' && path === '/healthz') return Response.json({ ok: true });
    if (method === 'GET' && path === '/api/v1/ui-addons') return Response.json(backend.uiAddons());

    const mocked = await handleBackends(request);
    if (mocked) return mocked;

    if (method === 'GET' && path === '/__test/addons') {
      return Response.json(backend.state.installed.map((addon) => legacyView(backend, addon)));
    }
    if (method === 'GET' && path === '/__test/state') return Response.json(backend.state);
    if (method === 'PUT' && path === '/__test/config') {
      const config = (await readJson(request)) as Record<string, unknown>;
      const numbers = (key: string) => (typeof config[key] === 'number' ? config[key] : undefined);
      backend.setDelays({
        installDelayMs: numbers('installDelayMs'),
        disableDelayMs: numbers('disableDelayMs'),
        monitorDelayMs: numbers('monitorDelayMs'),
      });
      return Response.json({ ok: true });
    }
    if (method === 'POST' && path === '/__test/reset') {
      seed();
      return Response.json(backend.state.installed.map((addon) => legacyView(backend, addon)));
    }

    const test = /^\/__test\/addons\/([a-z0-9-]+)$/.exec(path);
    if (test && (method === 'PUT' || method === 'PATCH')) {
      const patch = (await readJson(request)) as Partial<LegacyAddon>;
      return Response.json(legacyView(backend, applyPatch(backend, test[1]!, patch)));
    }
    if (test && method === 'DELETE') {
      backend.state.installed = backend.state.installed.filter(
        (addon) => addon.addon_id !== test[1],
      );
      return new Response(null, { status: 204 });
    }

    return Response.json({ message: `No route for ${method} ${url.pathname}` }, { status: 404 });
  }
}

function legacyView(backend: AddonsBackend, addon: MockInstalledAddon): LegacyAddon {
  return {
    name: addon.addon_id,
    version: backend.versions.get(addon.addon_id) ?? DEFAULT_VERSION,
    sdk: addon.definition.ui?.sdk ?? DEFAULT_SDK,
    enabled: addon.status === 'active',
  };
}

/** The `/__test/addons/<id>` semantics described at the top of this file. */
function applyPatch(
  backend: AddonsBackend,
  id: string,
  patch: Partial<LegacyAddon>,
): MockInstalledAddon {
  const { state } = backend;
  let definition: MockDefinition | undefined = state.catalog.find(
    (item) => addonId(item.source, item.name) === id,
  );
  const current = () =>
    state.installed.find((item) => item.addon_id === id && item.status !== 'disabled') ??
    state.installed.find((item) => item.addon_id === id);
  let installed = current();

  const unknownName = !definition;
  if (!definition) {
    const service = `${id}-ui`;
    definition = {
      name: id,
      source: { kind: 'official', name: 'official' },
      version: DEFAULT_VERSION,
      description: 'Addon created through the test API',
      services: [
        {
          service_name: service,
          image: `ghcr.io/oakestra/${id}:${DEFAULT_VERSION}`,
          networks: [],
          volumes: [],
          ports: {},
          environment: {},
          labels: {},
        },
      ],
      volumes: [],
      networks: [],
      permissions: noPermissions(),
      ui: { service, sdk: DEFAULT_SDK },
    };
    state.catalog.push(definition);
  }

  if (typeof patch.sdk === 'string') {
    for (const def of [definition, installed?.definition]) {
      if (!def) continue;
      def.ui = { service: def.ui?.service ?? def.services[0]!.service_name, sdk: patch.sdk };
    }
  }
  if (typeof patch.version === 'string') backend.versions.set(id, patch.version);

  // The old API treated an unknown name as an enabled addon unless told otherwise.
  const enabled = patch.enabled ?? (unknownName ? true : undefined);
  if (enabled === true && (!installed || installed.status === 'disabled')) {
    backend.manager.install({
      name: qualifiedName(definition.source, definition.name),
      accept_definition: backend.definitionHash(definition),
    });
    installed = current()!;
  }
  if (installed && enabled !== undefined) {
    backend.forceStatus(installed._id, enabled ? 'active' : 'disabled');
    if (enabled) {
      installed.status_details = {};
      delete installed.logs;
    }
  }
  return (
    installed ??
    ({
      addon_id: id,
      status: 'disabled',
      definition,
    } as MockInstalledAddon)
  );
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return undefined;
  }
}

export function seedFromEnv(
  value: string | undefined,
): readonly Partial<LegacyAddon>[] | undefined {
  if (!value) return undefined;
  return JSON.parse(value) as Partial<LegacyAddon>[];
}
