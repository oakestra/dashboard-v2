import {
  FAILED_INSTALL_LOGS,
  INSTALL_OUTCOMES,
  installedFixtures,
  marketplaceFixtures,
  type MockInstalledAddon,
  type MockMarketplaceAddon,
} from './fixtures/addons.ts';
import { createObjectId } from './store.ts';

/**
 * Framework-free mock of the addons-manager (`/api/v1/addons`) and the marketplace-manager
 * (`/api/v1/marketplace/addons`). MSW handlers (`createAddonsHandlers`) and the HTTP server in
 * tools/mock-addons-manager both wrap it, so unit tests, `pnpm dev:mock` and e2e share one
 * behaviour. Imports no browser or MSW code, so plain Node can load it.
 *
 * Backend quirks reproduced on purpose (checked against the oakestra repo):
 * - addons-manager handlers return `json.dumps(...)` strings: JSON bodies with `text/html`.
 *   marketplace-manager and all error bodies (flask-smorest) are `application/json`.
 * - `POST /addons` answers 400 for an already installed definition, 201 otherwise; it also
 *   installs definitions that are not approved. An unknown marketplace id is a 500.
 * - `DELETE /addons/<id>`: 200 with the addon in `disabling` unless it is `disabled` already,
 *   then the record is deleted (204, empty).
 * - `PATCH /addons/<id>` only validates `status` and `$set`s every other field into the record;
 *   nothing else (status_details, logs) is cleared.
 * - An id that is not a 24 char hex string makes `ObjectId(id)` raise in both backends: an
 *   unhandled exception, so a 500 HTML page (GET, PATCH and DELETE alike).
 * - The marketplace list shows approved definitions only; `GET /<id>` returns any status. Its
 *   schema rejects unknown fields (422 `{errors: {json: {field: ["Unknown field."]}}}`) and drops
 *   everything it does not declare from responses. That includes the planned `ui` block, which
 *   is only accepted and returned with the `uiBlockSupport` option.
 * - Install flow: `docker run` is detached, so an install goes `installing` -> `active` even for a
 *   container that crashes right after. The monitor notices crashes on a later loop and moves the
 *   addon to `failed` / `partially_active` with logs (`monitorDelayMs` later). Only an install
 *   that fails at once ends `failed` directly, with empty status_details and no logs.
 */

export interface BackendResponse {
  status: number;
  /** Undefined for an empty body (204). */
  text?: string;
  contentType?: string;
}

export interface AddonsBackendOptions {
  /** How long an install stays `installing`. Default 1500. */
  installDelayMs?: number;
  /** How long a removal stays `disabling`. Defaults to the install delay. */
  disableDelayMs?: number;
  /** How long a new marketplace definition stays `under_review`. Defaults to the install delay. */
  reviewDelayMs?: number;
  /**
   * How long after an install reached `active` the monitor notices that a container crashed.
   * The real monitor loops every 30s and restarts once first, so 30-90s. Default 4000.
   */
  monitorDelayMs?: number;
  /**
   * Whether the marketplace knows the planned `ui` block (`{service, sdk}`). Off by default,
   * like the real marketplace, which answers a definition with `ui` with a 422 and strips the
   * block from the seed. The compose mock and the e2e suite turn it on to stand in for the
   * backend that will support it.
   */
  uiBlockSupport?: boolean;
}

export interface AddonsBackendState {
  marketplace: MockMarketplaceAddon[];
  installed: MockInstalledAddon[];
}

export interface UiAddonEntry {
  name: string;
  version: string;
  sdk: string;
}

export interface AddonsBackend {
  /** Live state; mutate through `forceStatus` when timers are involved. */
  readonly state: AddonsBackendState;
  /** Version reported in `/ui-addons` per addon name (not part of any model yet). Default 0.1.0. */
  readonly versions: Map<string, string>;
  manager: {
    list(query?: { status?: string | null }): BackendResponse;
    install(body: unknown): BackendResponse;
    get(id: string): BackendResponse;
    patch(id: string, body: unknown): BackendResponse;
    remove(id: string): BackendResponse;
  };
  marketplace: {
    list(query?: { name?: string | null }): BackendResponse;
    register(body: unknown): BackendResponse;
    get(id: string): BackendResponse;
    remove(id: string): BackendResponse;
  };
  /** `GET /api/v1/ui-addons`: active installed addons whose definition has a `ui` block. */
  uiAddons(): UiAddonEntry[];
  /** Sets a status at once and drops pending transitions (no follow-up, unlike PATCH). */
  forceStatus(id: string, status: MockInstalledAddon['status']): void;
  setDelays(delays: Omit<AddonsBackendOptions, 'uiBlockSupport'>): void;
  /** Restores the seed and cancels pending transitions. Keeps the delays. */
  reset(): void;
}

const STATUSES = ['installing', 'disabling', 'disabled', 'failed', 'active', 'partially_active'];
const JSON_TYPE = 'application/json';
// Flask sends a returned str as text/html.
const TEXT_TYPE = 'text/html; charset=utf-8';

const asJson = (status: number, body: unknown): BackendResponse => ({
  status,
  text: JSON.stringify(body),
  contentType: JSON_TYPE,
});
const asText = (status: number, body: unknown): BackendResponse => ({
  status,
  text: JSON.stringify(body),
  contentType: TEXT_TYPE,
});
const empty = (status = 204): BackendResponse => ({ status });

/** flask-smorest `abort(status, message=...)`. */
const abort = (status: number, message: string): BackendResponse =>
  asJson(status, { code: status, message, status: STATUS_TEXT[status] ?? 'Error' });
const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  404: 'Not Found',
  422: 'Unprocessable Entity',
};

const unprocessable = (errors: ErrorTree): BackendResponse =>
  asJson(422, { code: 422, errors: { json: errors }, status: 'Unprocessable Entity' });

const serverError = (): BackendResponse => ({
  status: 500,
  text: '<!doctype html><html lang=en><title>500 Internal Server Error</title><h1>Internal Server Error</h1>',
  contentType: 'text/html; charset=utf-8',
});

/** Both backends call `ObjectId(id)` on the path segment, which raises for anything else. */
const isObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

type ErrorTree = { [key: string]: string[] | ErrorTree };

const SERVICE_FIELDS = [
  'service_name',
  'image',
  'command',
  'networks',
  'volumes',
  'ports',
  'environment',
  'labels',
] as const;
const VOLUME_FIELDS = ['name', 'driver', 'driver_opts', 'labels'] as const;
const NETWORK_FIELDS = ['name', 'driver', 'enable_ipv6'] as const;
const DEFINITION_FIELDS = [
  '_id',
  'name',
  'description',
  'services',
  'volumes',
  'networks',
] as const;

const MISSING = 'Missing data for required field.';
const NOT_STRING = 'Not a valid string.';

const isStringMap = (value: unknown) =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string');

function addError(tree: ErrorTree, field: string, message: string): void {
  const existing = tree[field];
  if (Array.isArray(existing)) existing.push(message);
  else tree[field] = [message];
}

/** Marshmallow `Schema.load` for a flat object: unknown fields raise, `check` validates known ones. */
function validateObject(
  value: unknown,
  known: readonly string[],
  required: readonly string[],
  check: (field: string, item: unknown) => string | undefined,
): ErrorTree | undefined {
  if (!isRecord(value)) return { _schema: ['Invalid input type.'] };
  const errors: ErrorTree = {};
  for (const field of required) if (!(field in value)) addError(errors, field, MISSING);
  for (const [field, item] of Object.entries(value)) {
    if (!known.includes(field)) addError(errors, field, 'Unknown field.');
    else {
      const problem = check(field, item);
      if (problem) addError(errors, field, problem);
    }
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}

function validateList(
  value: unknown,
  validateItem: (item: unknown) => ErrorTree | undefined,
): ErrorTree | string[] | undefined {
  if (!Array.isArray(value)) return ['Not a valid list.'];
  const errors: ErrorTree = {};
  value.forEach((item, index) => {
    const nested = validateItem(item);
    if (nested) errors[String(index)] = nested;
  });
  return Object.keys(errors).length > 0 ? errors : undefined;
}

/** What the real marketplace's schemas (marketplace-manager api/v1/schema.py) accept. */
function validateDefinition(input: unknown, uiBlockSupport: boolean): ErrorTree | undefined {
  const known = uiBlockSupport ? [...DEFINITION_FIELDS, 'ui'] : [...DEFINITION_FIELDS];
  const nested =
    (
      fields: readonly string[],
      required: string[],
      check: (field: string, item: unknown) => string | undefined,
    ) =>
    (item: unknown) =>
      validateObject(item, fields, required, check);
  const validateService = nested(SERVICE_FIELDS, ['service_name', 'image'], (field, item) => {
    if (field === 'networks' || field === 'volumes') {
      return Array.isArray(item) && item.every((v) => typeof v === 'string')
        ? undefined
        : 'Not a valid list.';
    }
    if (field === 'ports' || field === 'environment' || field === 'labels') {
      return isStringMap(item) ? undefined : 'Not a valid mapping type.';
    }
    return typeof item === 'string' ? undefined : NOT_STRING;
  });
  const validateVolume = nested(VOLUME_FIELDS, ['name'], (field, item) => {
    if (field === 'driver_opts' || field === 'labels') {
      return isStringMap(item) ? undefined : 'Not a valid mapping type.';
    }
    return typeof item === 'string' ? undefined : NOT_STRING;
  });
  const validateNetwork = nested(NETWORK_FIELDS, ['name'], (field, item) => {
    if (field === 'enable_ipv6')
      return typeof item === 'boolean' ? undefined : 'Not a valid boolean.';
    return typeof item === 'string' ? undefined : NOT_STRING;
  });

  const errors = validateObject(input, known, ['name', 'services'], (field, item) => {
    if (field === 'name' || field === 'description' || field === '_id') {
      return typeof item === 'string' ? undefined : NOT_STRING;
    }
    return undefined;
  });
  if (errors?._schema) return errors;

  const tree: ErrorTree = errors ?? {};
  const body = input as Record<string, unknown>;
  for (const [field, validateItem] of [
    ['services', validateService],
    ['volumes', validateVolume],
    ['networks', validateNetwork],
  ] as const) {
    if (!(field in body)) continue;
    const problem = validateList(body[field], validateItem);
    if (problem) tree[field] = problem;
  }
  return Object.keys(tree).length > 0 ? tree : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createAddonsBackend(options: AddonsBackendOptions = {}): AddonsBackend {
  const delays = { install: 1500, disable: 1500, review: 1500, monitor: 4000 };
  setDelays(options);
  const uiBlockSupport = options.uiBlockSupport ?? false;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const versions = new Map<string, string>();
  const state: AddonsBackendState = { marketplace: [], installed: [] };

  function seed(): void {
    state.marketplace = marketplaceFixtures();
    if (!uiBlockSupport) for (const definition of state.marketplace) delete definition.ui;
    state.installed = installedFixtures(state.marketplace);
    versions.clear();
  }
  seed();

  const findInstalled = (id: string) => state.installed.find((addon) => addon._id === id);
  const findDefinition = (id: string) => state.marketplace.find((addon) => addon._id === id);

  function later(key: string, ms: number, run: () => void): void {
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        run();
      }, ms),
    );
  }

  const cancel = (id: string) => {
    for (const key of [id, `monitor-${id}`]) {
      clearTimeout(timers.get(key));
      timers.delete(key);
    }
  };

  /** The addons monitor's part: transitional statuses resolve on their own after a while. */
  function settle(addon: MockInstalledAddon): void {
    if (addon.status === 'installing') {
      later(addon._id, delays.install, () => {
        if (INSTALL_OUTCOMES[addon.name] === 'install_failed') {
          // The install itself failed (docker run errored): the monitor has nothing to report.
          addon.status = 'failed';
          addon.status_details = {};
          return;
        }
        addon.status = 'active';
        settle(addon);
      });
    } else if (addon.status === 'disabling') {
      later(addon._id, delays.disable, () => {
        addon.status = 'disabled';
      });
    } else if (addon.status === 'active') {
      // A detached `docker run` succeeded, so a crashing container only shows up when the monitor
      // loops again, after its one restart attempt.
      const outcome = INSTALL_OUTCOMES[addon.name];
      if (outcome !== 'partially_active' && outcome !== 'failed') return;
      later(`monitor-${addon._id}`, delays.monitor, () => {
        addon.status = outcome;
        if (outcome === 'partially_active') {
          addon.status_details = {
            failed_services: addon.services.slice(-1).map((s) => s.service_name),
          };
        } else {
          addon.status_details = { failed_services: addon.services.map((s) => s.service_name) };
          addon.logs = FAILED_INSTALL_LOGS;
        }
      });
    }
  }

  function setDelays(next: Omit<AddonsBackendOptions, 'uiBlockSupport'>): void {
    delays.install = next.installDelayMs ?? delays.install;
    delays.disable = next.disableDelayMs ?? next.installDelayMs ?? delays.disable;
    delays.review = next.reviewDelayMs ?? next.installDelayMs ?? delays.review;
    delays.monitor = next.monitorDelayMs ?? delays.monitor;
  }

  function forceStatus(id: string, status: MockInstalledAddon['status']): void {
    const addon = findInstalled(id);
    if (!addon) return;
    cancel(id);
    addon.status = status;
  }

  /** The marketplace schema's output: undeclared fields (such as `ui`) never leave the service. */
  function serializeDefinition(definition: MockMarketplaceAddon): MockMarketplaceAddon {
    const { ui, ...rest } = definition;
    return uiBlockSupport && ui ? { ...rest, ui } : rest;
  }

  /** An empty query parameter (`?status=`) filters nothing. */
  function nonEmpty(filter: unknown): string | undefined {
    return typeof filter === 'string' && filter !== '' ? filter : undefined;
  }

  return {
    state,
    versions,
    manager: {
      list(query) {
        const status = nonEmpty(query?.status);
        return asText(
          200,
          state.installed.filter((addon) => !status || addon.status === status),
        );
      },
      install(body) {
        const marketplaceId = isRecord(body) ? body.marketplace_id : undefined;
        if (typeof marketplaceId !== 'string') {
          return unprocessable({ marketplace_id: ['Missing data for required field.'] });
        }
        if (state.installed.some((addon) => addon.marketplace_id === marketplaceId)) {
          return abort(400, `Addon with marketplace-id - ${marketplaceId} already exists.`);
        }
        const definition = findDefinition(marketplaceId);
        // The real service calls raise_for_status() on the marketplace answer, a 404 there is a 500.
        if (!definition) return serverError();
        if (definition.services.length === 0) return abort(400, 'Failed to install addon');

        const addon: MockInstalledAddon = {
          _id: createObjectId(),
          marketplace_id: marketplaceId,
          name: definition.name,
          description: definition.description,
          services: structuredClone(definition.services),
          volumes: structuredClone(definition.volumes),
          networks: structuredClone(definition.networks),
          status: 'installing',
        };
        state.installed.push(addon);
        settle(addon);
        return asText(201, addon);
      },
      get(id) {
        if (!isObjectId(id)) return serverError();
        const addon = findInstalled(id);
        return addon ? asText(200, addon) : abort(404, 'Addon not found');
      },
      patch(id, body) {
        const status = isRecord(body) ? body.status : undefined;
        if (typeof status !== 'string') {
          return unprocessable({ status: ['Missing data for required field.'] });
        }
        if (!STATUSES.includes(status)) {
          return unprocessable({ status: [`Must be one of: ${STATUSES.join(', ')}.`] });
        }
        if (!isObjectId(id)) return serverError();
        const addon = findInstalled(id);
        if (!addon) return abort(400, 'Failed to update addon');
        // unknown=INCLUDE in the real schema: extra fields are written to the record as well.
        const { _id: _ignored, ...fields } = body as Record<string, unknown>;
        Object.assign(addon, fields);
        cancel(id);
        settle(addon);
        return asText(200, addon);
      },
      remove(id) {
        if (!isObjectId(id)) return serverError();
        const addon = findInstalled(id);
        if (!addon) return abort(404, 'Addon not found');
        if (addon.status !== 'disabled') {
          cancel(id);
          addon.status = 'disabling';
          settle(addon);
          return asText(200, addon);
        }
        state.installed = state.installed.filter((candidate) => candidate._id !== id);
        return empty();
      },
    },
    marketplace: {
      list(query) {
        const name = nonEmpty(query?.name);
        return asJson(
          200,
          state.marketplace
            .filter((addon) => addon.status === 'approved' && (!name || addon.name === name))
            .map(serializeDefinition),
        );
      },
      register(body) {
        const errors = validateDefinition(body, uiBlockSupport);
        if (errors) return unprocessable(errors);

        const input = body as Record<string, unknown>;
        const ui = uiBlockSupport && isRecord(input.ui) ? input.ui : undefined;
        const definition: MockMarketplaceAddon = {
          _id: createObjectId(),
          name: input.name as string,
          description: typeof input.description === 'string' ? input.description : '',
          services: (input.services as Record<string, unknown>[]).map((s) => ({
            networks: [],
            volumes: [],
            ports: {},
            environment: {},
            labels: {},
            ...s,
          })) as unknown as MockMarketplaceAddon['services'],
          volumes: (Array.isArray(input.volumes)
            ? input.volumes
            : []) as MockMarketplaceAddon['volumes'],
          networks: (Array.isArray(input.networks)
            ? input.networks
            : []) as MockMarketplaceAddon['networks'],
          status: 'under_review',
          ...(ui ? { ui: ui as MockMarketplaceAddon['ui'] } : {}),
        };
        state.marketplace.push(definition);
        // The real manager pulls every image; the mock rejects images that obviously cannot exist.
        later(`review-${definition._id}`, delays.review, () => {
          const broken = definition.services.some((s) => /does-not-exist|invalid/.test(s.image));
          definition.status = broken ? 'verification_failed' : 'approved';
        });
        return asJson(201, serializeDefinition(definition));
      },
      get(id) {
        if (!isObjectId(id)) return serverError();
        const definition = findDefinition(id);
        return definition
          ? asJson(200, serializeDefinition(definition))
          : abort(404, 'Addon not found');
      },
      remove(id) {
        if (!isObjectId(id)) return serverError();
        const before = state.marketplace.length;
        state.marketplace = state.marketplace.filter((addon) => addon._id !== id);
        clearTimeout(timers.get(`review-${id}`));
        return state.marketplace.length === before ? abort(404, 'Addon not found') : empty();
      },
    },
    uiAddons() {
      const entries: UiAddonEntry[] = [];
      for (const addon of state.installed) {
        if (addon.status !== 'active') continue;
        const ui = findDefinition(addon.marketplace_id)?.ui;
        if (!ui) continue;
        entries.push({
          name: addon.name,
          version: versions.get(addon.name) ?? '0.1.0',
          sdk: ui.sdk,
        });
      }
      return entries;
    },
    forceStatus,
    setDelays,
    reset() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      seed();
    },
  };
}
