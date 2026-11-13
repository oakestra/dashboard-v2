import type { AddonErrorCode } from '@oakestra/api';

import {
  catalogFixtures,
  FAILED_INSTALL_LOGS,
  INSTALL_OUTCOMES,
  installedFixtures,
  noPermissions,
  sourceFixtures,
  type MockAddonStatus,
  type MockDefinition,
  type MockInstalledAddon,
  type MockPermissions,
  type MockSource,
  type MockSourceRef,
} from './fixtures/addons.ts';
import { createObjectId } from './store.ts';

/**
 * Framework-free mock of the Go addons engine: the addons-manager (`/api/v1/addons`) and the
 * marketplace (`/api/v1/marketplace`). MSW handlers (`createAddonsHandlers`) and the HTTP server
 * in tools/mock-addons-manager both wrap it, so unit tests, `pnpm dev:mock` and e2e share one
 * behaviour. Imports no browser or MSW code, so plain Node can load it.
 *
 * Reproduced from the oakestra repo (addons/internal):
 * - Every body is `application/json`; errors are `{code, message}` (`validation_failed` from the
 *   marketplace adds `errors: [{path, message}]`). Codes as in httpx: `already_installed`,
 *   `busy`, `no_update_available`, `conflict`, `not_found`, `sync_failed`, ...
 * - `POST /addons {name, accept_definition}` installs by qualified name. Without the hash of the
 *   whole canonical definition it answers 409 `{code: "confirmation_required", message,
 *   definition, definition_hash, permissions}`; the catalog serves no hash. A second install of
 *   an addon that is not `disabled` is a 409 `already_installed`, an unknown name a 404. Unknown body fields
 *   (such as the old `accept_permissions`) are a 400.
 * - `POST /addons/<id>/update {accept_definition}` needs a newer catalog version (409 otherwise)
 *   and always asks; its 409 adds `previous_version`, `previous_permissions` and
 *   `permissions_grow`. `POST /<id>/approve` asks the same way and redeploys a `failed` addon.
 *   Both only work on settled addons.
 * - `DELETE /addons/<id>`: 200 with the addon in `disabling` unless it is `disabled` already,
 *   then the record is deleted (204). There is no PATCH.
 * - The marketplace lists official, taps by name, local; registrations go to `local` and are
 *   listed at once. `?category=` and `?tag=` filter (normalized like the engine), and
 *   `GET /categories[?source=]` counts the addons per category. Decoding is strict (unknown fields are a 422), the declared permissions must
 *   cover what the services use, and a re-registration needs a higher version (409).
 * - Taps: `POST /sources` adds and syncs at once (a failing sync only sets `last_error`),
 *   official and local cannot be deleted (409), `POST /sources/<name>/sync` answers 502 for a
 *   failing fetch. A tap URL whose host contains `unreachable` or `invalid` fails to sync.
 * - Transitions: installs (and approvals of failed addons) go `installing` -> `active`, updates
 *   `updating` -> `active`. Crashes are noticed `monitorDelayMs` after `active` (see
 *   INSTALL_OUTCOMES); an install that fails at once ends `failed` without logs.
 *
 * Definition hashes are a stable FNV hash of the canonical definition, not SHA-256: callers only
 * echo them back.
 */

export interface BackendResponse {
  status: number;
  /** Undefined for an empty body (204). */
  text?: string;
  contentType?: string;
}

export interface AddonsBackendOptions {
  /** How long an install, approval or update stays transitional. Default 1500. */
  installDelayMs?: number;
  /** How long a removal stays `disabling`. Defaults to the install delay. */
  disableDelayMs?: number;
  /** How long after `active` a crashing container is noticed. Default 4000. */
  monitorDelayMs?: number;
}

export interface AddonsBackendState {
  sources: MockSource[];
  catalog: MockDefinition[];
  installed: MockInstalledAddon[];
}

export interface UiAddonEntry {
  name: string;
  version: string;
  sdk: string;
  display_name?: string;
  icon?: string;
}

export interface AddonsBackend {
  /** Live state; mutate through `forceStatus` when timers are involved. */
  readonly state: AddonsBackendState;
  /** Overrides the version `/ui-addons` reports per addon id (default: the UI image's tag). */
  readonly versions: Map<string, string>;
  manager: {
    list(query?: { status?: string | null }): BackendResponse;
    install(body: unknown): BackendResponse;
    get(id: string): BackendResponse;
    update(id: string, body: unknown): BackendResponse;
    approve(id: string, body: unknown): BackendResponse;
    remove(id: string): BackendResponse;
  };
  marketplace: {
    list(query?: {
      source?: string | null;
      name?: string | null;
      category?: string | null;
      tag?: string | null;
    }): BackendResponse;
    /** `GET /categories`: `{items: [{name, count}]}`, sorted by name. */
    categories(query?: { source?: string | null }): BackendResponse;
    get(source: string, name: string): BackendResponse;
    register(body: unknown): BackendResponse;
    removeLocal(name: string): BackendResponse;
    sources: {
      list(): BackendResponse;
      add(body: unknown): BackendResponse;
      remove(name: string): BackendResponse;
      sync(name: string): BackendResponse;
      importIndex(name: string, body: unknown): BackendResponse;
    };
  };
  /** `GET /api/v1/ui-addons`: active installed addons whose definition has a `ui` block. */
  uiAddons(): UiAddonEntry[];
  /** The hash `accept_definition` has to carry for this catalog definition. */
  definitionHash(definition: MockDefinition): string;
  /** Sets a status at once and drops pending transitions. */
  forceStatus(id: string, status: MockAddonStatus): void;
  setDelays(delays: AddonsBackendOptions): void;
  /** Restores the seed and cancels pending transitions. Keeps the delays. */
  reset(): void;
}

const STATUSES: readonly MockAddonStatus[] = [
  'installing',
  'updating',
  'disabling',
  'disabled',
  'failed',
  'active',
  'partially_active',
];
const SETTLED: readonly MockAddonStatus[] = ['active', 'partially_active', 'failed'];

const json = (status: number, body: unknown): BackendResponse => ({
  status,
  text: JSON.stringify(body),
  contentType: 'application/json',
});
// Typed with the client's list, so a code the client no longer knows fails the typecheck here.
const error = (status: number, code: AddonErrorCode, message: string) =>
  json(status, { code, message });
const empty = (status = 204): BackendResponse => ({ status });

type FieldError = { path: string; message: string };
const invalid = (message: string, errors: FieldError[] = []): BackendResponse =>
  json(422, { code: 'validation_failed', message, ...(errors.length > 0 ? { errors } : {}) });

const NAME = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split(/[-+]/)[0]!.split('.').map(Number);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}
const newer = (candidate: string, current: string) =>
  SEMVER.test(candidate) && SEMVER.test(current) && compareVersions(candidate, current) > 0;

export function qualifiedName(source: MockSourceRef, name: string): string {
  return source.kind === 'official' ? name : `${source.name}/${name}`;
}
export function addonId(source: MockSourceRef, name: string): string {
  return source.kind === 'official' ? name : `${source.name}--${name}`;
}

/** Sorted, deduplicated, a path listed `:ro` and read-write collapsed to read-write. */
export function canonicalPermissions(p: Partial<MockPermissions> | undefined): MockPermissions {
  const rw = new Map<string, boolean>();
  for (const entry of p?.host_paths ?? []) {
    const ro = entry.endsWith(':ro');
    const path = ro ? entry.slice(0, -3) : entry;
    rw.set(path, (rw.get(path) ?? false) || !ro);
  }
  return {
    host_paths: [...rw.keys()].sort().map((path) => (rw.get(path) ? path : `${path}:ro`)),
    host_ports: [...new Set(p?.host_ports ?? [])].sort((a, b) => a - b),
    docker_socket: p?.docker_socket ?? false,
    host_root: p?.host_root ?? false,
    host_network: p?.host_network ?? false,
    core_network: p?.core_network ?? false,
  };
}

/** definition.CanonicalJSON: the stored shape with canonical permissions, in Go's field order. */
function canonicalDefinition(def: MockDefinition) {
  const copy = structuredClone(def);
  return {
    name: copy.name,
    source: copy.source,
    version: copy.version,
    ...(copy.description ? { description: copy.description } : {}),
    ...(copy.homepage ? { homepage: copy.homepage } : {}),
    ...(copy.maintainers?.length ? { maintainers: copy.maintainers } : {}),
    ...displayFields(copy),
    ...(copy.ui ? { ui: copy.ui } : {}),
    permissions: canonicalPermissions(copy.permissions),
    services: copy.services,
    volumes: copy.volumes,
    networks: copy.networks,
  };
}

/** definition.NormalizeCategory: trimmed, lowercased, inner whitespace collapsed. */
const normalizeCategory = (value: string) =>
  value.toLowerCase().split(/\s+/).filter(Boolean).join(' ');
/** definition.NormalizeTag: trimmed and lowercased. */
const normalizeTag = (value: string) => value.trim().toLowerCase();

/** The display fields and metadata as the engine stores them (normalized, empty ones left out). */
function displayFields(def: MockDefinition) {
  const tags = [...new Set((def.tags ?? []).map(normalizeTag))].sort();
  const category = def.category ? normalizeCategory(def.category) : '';
  return {
    ...(def.display_name?.trim() ? { display_name: def.display_name.trim() } : {}),
    ...(category ? { category } : {}),
    ...(tags.length ? { tags } : {}),
    ...(def.icon ? { icon: def.icon } : {}),
    ...(def.metadata && Object.keys(def.metadata).length ? { metadata: def.metadata } : {}),
  };
}

function hashDefinition(def: MockDefinition): string {
  const text = JSON.stringify(canonicalDefinition(def));
  let out = '';
  // Eight seeded FNV-1a rounds give the 64 hex digits of the real hash's shape.
  for (let seed = 0; seed < 8; seed += 1) {
    let h = 0x811c9dc5 ^ seed;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
  }
  return `sha256:${out}`;
}

/** True when `next` grants anything `old` does not (an exact path with at least the access). */
function grows(next: MockPermissions, old: MockPermissions): boolean {
  const flags = ['docker_socket', 'host_root', 'host_network', 'core_network'] as const;
  if (flags.some((flag) => next[flag] && !old[flag])) return true;
  if (next.host_ports.some((port) => !old.host_ports.includes(port))) return true;
  return next.host_paths.some(
    (entry) =>
      !old.host_paths.includes(entry) && !old.host_paths.includes(entry.replace(/:ro$/, '')),
  );
}

const ROOT_EQUIVALENT = ['/', '/etc', '/root', '/boot', '/proc', '/sys', '/dev', '/var/lib/docker'];

/** What the services use, roughly like definition.RequiredPermissions. */
function requiredPermissions(def: MockDefinition): MockPermissions {
  const required = noPermissions();
  for (const svc of def.services) {
    if (svc.networks.includes('host')) required.host_network = true;
    if (svc.networks.includes('oakestra')) required.core_network = true;
    for (const host of Object.values(svc.ports)) {
      const port = Number(host.split(':').pop());
      if (Number.isInteger(port)) required.host_ports.push(port);
    }
    for (const volume of svc.volumes) {
      const [source, target, mode] = volume.split(':');
      if (!source?.startsWith('/') || target === undefined) continue;
      required.host_paths.push(mode === 'ro' ? `${source}:ro` : source);
      if (source.includes('docker.sock') || source === '/run' || source === '/var/run') {
        required.docker_socket = true;
      }
      if (ROOT_EQUIVALENT.some((root) => source === root || source.startsWith(`${root}/`))) {
        required.host_root = true;
      }
    }
  }
  return canonicalPermissions(required);
}

/** Problems with permissions that the declared set does not cover. */
function uncovered(def: MockDefinition): FieldError[] {
  const declared = canonicalPermissions(def.permissions);
  const required = requiredPermissions(def);
  const errors: FieldError[] = [];
  for (const flag of ['docker_socket', 'host_root', 'host_network', 'core_network'] as const) {
    if (required[flag] && !declared[flag]) {
      errors.push({ path: `permissions.${flag}`, message: 'is used but not declared' });
    }
  }
  for (const port of required.host_ports) {
    if (!declared.host_ports.includes(port)) {
      errors.push({ path: 'permissions.host_ports', message: `port ${port} is not declared` });
    }
  }
  for (const path of required.host_paths) {
    if (
      !declared.host_paths.includes(path) &&
      !declared.host_paths.includes(path.replace(/:ro$/, ''))
    ) {
      errors.push({ path: 'permissions.host_paths', message: `${path} is not declared` });
    }
  }
  return errors;
}

const DEFINITION_FIELDS = [
  'name',
  'source',
  'version',
  'description',
  'homepage',
  'maintainers',
  'display_name',
  'category',
  'tags',
  'icon',
  'metadata',
  'ui',
  'permissions',
  'services',
  'volumes',
  'networks',
];
const SERVICE_FIELDS = [
  'service_name',
  'image',
  'command',
  'networks',
  'volumes',
  'ports',
  'environment',
  'labels',
];
const PERMISSION_FIELDS = [
  'host_paths',
  'host_ports',
  'docker_socket',
  'host_root',
  'host_network',
  'core_network',
];

/** Strict decoding plus the checks of definition.Check that matter for the dashboard. */
function decodeDefinition(body: unknown): { def: MockDefinition } | { response: BackendResponse } {
  if (!isRecord(body)) return { response: invalid('invalid request body: not a JSON object') };
  const unknownField = (value: Record<string, unknown>, known: readonly string[]) =>
    Object.keys(value).find((key) => !known.includes(key));
  const rejectField = (field: string) =>
    ({ response: invalid(`invalid request body: json: unknown field "${field}"`) }) as const;
  const top = unknownField(body, DEFINITION_FIELDS);
  if (top) return rejectField(top);
  const services = Array.isArray(body.services) ? body.services : [];
  for (const svc of services) {
    const field = isRecord(svc) ? unknownField(svc, SERVICE_FIELDS) : undefined;
    if (field) return rejectField(field);
  }
  if (isRecord(body.permissions)) {
    const field = unknownField(body.permissions, PERMISSION_FIELDS);
    if (field) return rejectField(field);
  }

  const errors: FieldError[] = [];
  const name = typeof body.name === 'string' ? body.name : '';
  if (!NAME.test(name)) errors.push({ path: 'name', message: `"${name}" is not a valid name` });
  const version = typeof body.version === 'string' ? body.version : '';
  if (!version) errors.push({ path: 'version', message: 'is required' });
  else if (!SEMVER.test(version)) {
    errors.push({
      path: 'version',
      message: `"${version}" is not a semantic version (e.g. 1.2.3)`,
    });
  }
  if (services.length === 0)
    errors.push({ path: 'services', message: 'at least one service is required' });
  const def: MockDefinition = {
    name,
    source: { kind: 'local', name: 'local' },
    version,
    description: typeof body.description === 'string' ? body.description : '',
    ...(typeof body.homepage === 'string' ? { homepage: body.homepage } : {}),
    ...(Array.isArray(body.maintainers) ? { maintainers: body.maintainers as string[] } : {}),
    ...displayFields({
      display_name: typeof body.display_name === 'string' ? body.display_name : undefined,
      category: typeof body.category === 'string' ? body.category : undefined,
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
      icon: typeof body.icon === 'string' ? body.icon : undefined,
      metadata: isRecord(body.metadata) ? (body.metadata as Record<string, string>) : undefined,
    } as MockDefinition),
    services: services.map((raw, index) => {
      const svc = isRecord(raw) ? raw : {};
      if (typeof svc.service_name !== 'string' || !NAME.test(svc.service_name)) {
        errors.push({ path: `services[${index}].service_name`, message: 'is not a valid name' });
      }
      if (typeof svc.image !== 'string' || svc.image === '') {
        errors.push({ path: `services[${index}].image`, message: 'is required' });
      }
      return {
        networks: [],
        volumes: [],
        ports: {},
        environment: {},
        labels: {},
        ...svc,
      } as unknown as MockDefinition['services'][number];
    }),
    volumes: (Array.isArray(body.volumes) ? body.volumes : []) as MockDefinition['volumes'],
    networks: (Array.isArray(body.networks) ? body.networks : []) as MockDefinition['networks'],
    permissions: canonicalPermissions(isRecord(body.permissions) ? body.permissions : undefined),
    ...(isRecord(body.ui) ? { ui: body.ui as MockDefinition['ui'] } : {}),
  };
  if (def.icon && !def.icon.startsWith('https://')) {
    errors.push({ path: 'icon', message: 'must be an https URL' });
  }
  if (def.ui && !def.services.some((svc) => svc.service_name === def.ui?.service)) {
    errors.push({ path: 'ui.service', message: `"${def.ui.service}" is not one of the services` });
  }
  errors.push(...uncovered(def));
  if (errors.length > 0) {
    return {
      response: invalid(
        `invalid addon definition: ${errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`,
        errors,
      ),
    };
  }
  return { def };
}

function parseQualified(value: string): { source: string; name: string } | undefined {
  const [first, second] = value.split('/');
  if (second === undefined)
    return NAME.test(first ?? '') ? { source: 'official', name: first! } : undefined;
  if (!NAME.test(first ?? '') || !NAME.test(second)) return undefined;
  return { source: first === 'oakestra' ? 'official' : first!, name: second };
}

const acceptOf = (body: Record<string, unknown>) =>
  typeof body.accept_definition === 'string' ? body.accept_definition : '';

/** The engine decodes these bodies strictly; returns the 400 for anything else. */
function badBody(body: unknown, known: readonly string[]): BackendResponse | undefined {
  if (!isRecord(body)) return error(400, 'validation_failed', 'Request body must be a JSON object');
  const unknown = Object.keys(body).find((key) => !known.includes(key));
  return unknown
    ? error(400, 'validation_failed', `Request body has an unknown field "${unknown}"`)
    : undefined;
}

export function createAddonsBackend(options: AddonsBackendOptions = {}): AddonsBackend {
  const delays = { install: 1500, disable: 1500, monitor: 4000 };
  setDelays(options);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const versions = new Map<string, string>();
  const state: AddonsBackendState = { sources: [], catalog: [], installed: [] };

  function seed(): void {
    state.sources = sourceFixtures();
    state.catalog = catalogFixtures();
    state.installed = installedFixtures(state.catalog);
    versions.clear();
  }
  seed();

  const now = () => new Date().toISOString();
  const findInstalled = (id: string) => state.installed.find((addon) => addon._id === id);
  const findSource = (name: string) => state.sources.find((source) => source.name === name);
  const findDefinition = (source: string, name: string) =>
    state.catalog.find((def) => def.source.name === source && def.name === name);

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

  /** The reconcile loop's part: transitional statuses resolve on their own after a while. */
  function settle(addon: MockInstalledAddon): void {
    const set = (status: MockAddonStatus) => {
      addon.status = status;
      addon.updated_at = now();
    };
    if (addon.status === 'installing' || addon.status === 'updating') {
      later(addon._id, delays.install, () => {
        if (INSTALL_OUTCOMES[addon.definition.name] === 'install_failed') {
          set('failed');
          addon.status_details = { message: 'creating container install-error: exit status 125' };
          return;
        }
        set('active');
        settle(addon);
      });
    } else if (addon.status === 'disabling') {
      later(addon._id, delays.disable, () => {
        set('disabled');
        addon.status_details = {};
        delete addon.logs;
      });
    } else if (addon.status === 'active') {
      const outcome = INSTALL_OUTCOMES[addon.definition.name];
      if (outcome !== 'partially_active' && outcome !== 'failed') return;
      later(`monitor-${addon._id}`, delays.monitor, () => {
        set(outcome);
        const services = addon.definition.services.map((s) => s.service_name);
        if (outcome === 'partially_active') {
          addon.status_details = { failed_services: services.slice(-1) };
        } else {
          addon.status_details = { failed_services: services };
          addon.logs = FAILED_INSTALL_LOGS;
        }
      });
    }
  }

  function setDelays(next: AddonsBackendOptions): void {
    delays.install = next.installDelayMs ?? delays.install;
    delays.disable = next.disableDelayMs ?? next.installDelayMs ?? delays.disable;
    delays.monitor = next.monitorDelayMs ?? delays.monitor;
  }

  function forceStatus(id: string, status: MockAddonStatus): void {
    const addon = findInstalled(id);
    if (!addon) return;
    cancel(id);
    addon.status = status;
  }

  const latestOf = (addon: MockInstalledAddon) =>
    findDefinition(addon.source.name, addon.definition.name)?.version ?? addon.version;

  /** addonResponse in dto.go: the definition flattened, the grant as `permissions`. */
  function serializeInstalled(addon: MockInstalledAddon) {
    const def = addon.definition;
    const latest = latestOf(addon);
    return {
      _id: addon._id,
      name: addon.qualified_name,
      qualified_name: addon.qualified_name,
      addon_id: addon.addon_id,
      source: addon.source,
      version: addon.version,
      description: def.description,
      ...(def.homepage ? { homepage: def.homepage } : {}),
      ...(def.maintainers?.length ? { maintainers: def.maintainers } : {}),
      ...displayFields(def),
      ui: def.ui ?? null,
      services: def.services,
      volumes: def.volumes,
      networks: def.networks,
      permissions: canonicalPermissions(addon.granted),
      status: addon.status,
      status_details: addon.status_details,
      ...(addon.logs ? { logs: addon.logs } : {}),
      update_available: newer(latest, addon.version),
      latest_version: latest,
      created_at: addon.created_at,
      updated_at: addon.updated_at,
    };
  }

  /** catalog.Item: the definition plus qualified name, id and derived permissions. */
  function serializeDefinition(def: MockDefinition) {
    const permissions = canonicalPermissions(def.permissions);
    return {
      ...structuredClone(def),
      ...displayFields(def),
      permissions,
      qualified_name: qualifiedName(def.source, def.name),
      id: addonId(def.source, def.name),
      required_permissions: requiredPermissions(def),
    };
  }

  function serializeSource(source: MockSource) {
    const { token, ...rest } = source;
    return {
      ...rest,
      url: source.url.replace(/\?.*$/, '?<redacted>'),
      has_token: Boolean(token),
      sync_enabled: source.kind !== 'local',
      deletable: source.kind === 'tap',
      etag: '',
      addon_count: state.catalog.filter((def) => def.source.name === source.name).length,
    };
  }

  const ORDER: Record<string, number> = { official: 0, tap: 1, local: 2 };
  const sortedSources = () =>
    [...state.sources].sort(
      (a, b) => ORDER[a.kind]! - ORDER[b.kind]! || a.name.localeCompare(b.name),
    );

  /** writeConsentRequired; `installed` is the record an update replaces. */
  const consentRequired = (
    message: string,
    def: MockDefinition,
    installed?: MockInstalledAddon,
  ) => {
    const permissions = canonicalPermissions(def.permissions);
    return json(409, {
      code: 'confirmation_required',
      message,
      definition: canonicalDefinition(def),
      definition_hash: hashDefinition(def),
      permissions,
      ...(installed
        ? {
            previous_version: installed.version,
            previous_permissions: canonicalPermissions(installed.granted),
            permissions_grow: grows(permissions, canonicalPermissions(installed.granted)),
          }
        : {}),
    });
  };

  /** Catalog.eachItem: official, taps by name, local; addons by name within a source. */
  function catalogItems(source: string | undefined) {
    const items: ReturnType<typeof serializeDefinition>[] = [];
    for (const src of sortedSources()) {
      if (source && src.name !== source) continue;
      const defs = state.catalog
        .filter((def) => def.source.name === src.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      items.push(...defs.map(serializeDefinition));
    }
    return items;
  }

  // Like Store.Get: a non-ObjectId id is simply not found.
  const addonNotFound = () => error(404, 'not_found', 'Addon not found');

  function syncSource(source: MockSource): string | undefined {
    const at = now();
    source.last_attempt_at = at;
    if (/unreachable|invalid/.test(source.url)) {
      source.last_error = `fetching ${source.url}: dial tcp: lookup failed`;
      return source.last_error;
    }
    source.last_error = '';
    source.last_synced_at = at;
    return undefined;
  }

  return {
    state,
    versions,
    manager: {
      list(query) {
        const status = query?.status;
        if (status && !STATUSES.includes(status as MockAddonStatus)) {
          return error(400, 'validation_failed', `Unknown status "${status}"`);
        }
        return json(
          200,
          state.installed.filter((a) => !status || a.status === status).map(serializeInstalled),
        );
      },
      install(body) {
        const bad = badBody(body, ['name', 'accept_definition']);
        if (bad || !isRecord(body)) return bad!;
        const ref = parseQualified(typeof body.name === 'string' ? body.name : '');
        if (!ref) {
          return error(400, 'validation_failed', `invalid addon name: "${String(body.name)}"`);
        }
        const def = findDefinition(ref.source, ref.name);
        if (!def) return error(404, 'not_found', 'Marketplace addon not found');
        const id = addonId(def.source, def.name);
        const qualified = qualifiedName(def.source, def.name);
        if (state.installed.some((a) => a.addon_id === id && a.status !== 'disabled')) {
          return error(409, 'already_installed', `Addon "${qualified}" is already installed.`);
        }
        const permissions = canonicalPermissions(def.permissions);
        if (acceptOf(body) !== hashDefinition(def)) {
          return consentRequired('This addon has to be accepted before it is installed.', def);
        }
        const at = now();
        const addon: MockInstalledAddon = {
          _id: createObjectId(),
          addon_id: id,
          qualified_name: qualified,
          source: structuredClone(def.source),
          version: def.version,
          definition: structuredClone(def),
          granted: permissions,
          status: 'installing',
          status_details: {},
          created_at: at,
          updated_at: at,
        };
        state.installed.push(addon);
        settle(addon);
        return json(201, serializeInstalled(addon));
      },
      get(id) {
        const addon = findInstalled(id);
        return addon ? json(200, serializeInstalled(addon)) : addonNotFound();
      },
      update(id, body) {
        const bad = badBody(body, ['accept_definition']);
        if (bad || !isRecord(body)) return bad!;
        const addon = findInstalled(id);
        if (!addon) return addonNotFound();
        if (!SETTLED.includes(addon.status)) {
          return error(409, 'busy', `Addon is ${addon.status} and can't be updated right now.`);
        }
        const latest = findDefinition(addon.source.name, addon.definition.name);
        if (!latest) return error(404, 'not_found', 'Marketplace addon not found');
        if (!newer(latest.version, addon.version)) {
          return error(
            409,
            'no_update_available',
            `No newer version than ${addon.version} is available.`,
          );
        }
        const permissions = canonicalPermissions(latest.permissions);
        if (acceptOf(body) !== hashDefinition(latest)) {
          return consentRequired(
            'This version has to be accepted before it is installed.',
            latest,
            addon,
          );
        }
        cancel(id);
        addon.version = latest.version;
        addon.definition = structuredClone(latest);
        addon.granted = permissions;
        addon.status = 'updating';
        addon.status_details = {};
        delete addon.logs;
        addon.updated_at = now();
        settle(addon);
        return json(200, serializeInstalled(addon));
      },
      approve(id, body) {
        const bad = badBody(body, ['accept_definition']);
        if (bad || !isRecord(body)) return bad!;
        const addon = findInstalled(id);
        if (!addon) return addonNotFound();
        if (!SETTLED.includes(addon.status)) {
          return error(409, 'busy', `Addon is ${addon.status} and can't be approved right now.`);
        }
        const latest = findDefinition(addon.source.name, addon.definition.name);
        if (!latest) return error(404, 'not_found', 'Marketplace addon not found');
        if (latest.version !== addon.version) {
          return error(
            409,
            'conflict',
            `The marketplace lists ${addon.qualified_name} ${latest.version}, not the installed ${addon.version}; update the addon instead.`,
          );
        }
        const permissions = canonicalPermissions(latest.permissions);
        if (acceptOf(body) !== hashDefinition(latest)) {
          return consentRequired('This addon has to be accepted again.', latest);
        }
        addon.granted = permissions;
        if (addon.status === 'failed') {
          cancel(id);
          addon.status = 'installing';
          addon.status_details = {};
          delete addon.logs;
          settle(addon);
        }
        addon.updated_at = now();
        return json(200, serializeInstalled(addon));
      },
      remove(id) {
        const addon = findInstalled(id);
        if (!addon) return addonNotFound();
        if (addon.status === 'disabled') {
          state.installed = state.installed.filter((candidate) => candidate._id !== id);
          return empty();
        }
        if (addon.status !== 'disabling') {
          cancel(id);
          addon.status = 'disabling';
          addon.updated_at = now();
          settle(addon);
        }
        return json(200, serializeInstalled(addon));
      },
    },
    marketplace: {
      list(query) {
        const name = query?.name || undefined;
        const category = normalizeCategory(query?.category ?? '');
        const tag = normalizeTag(query?.tag ?? '');
        const items = catalogItems(query?.source || undefined).filter(
          (item) =>
            (!name || item.name === name || item.qualified_name === name) &&
            (!category || item.category === category) &&
            (!tag || (item.tags ?? []).includes(tag)),
        );
        return json(200, items);
      },
      categories(query) {
        const counts = new Map<string, number>();
        for (const item of catalogItems(query?.source || undefined)) {
          if (item.category) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
        }
        const items = [...counts]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([name, count]) => ({ name, count }));
        return json(200, { items });
      },
      get(source, name) {
        const def = findSource(source) ? findDefinition(source, name) : undefined;
        return def ? json(200, serializeDefinition(def)) : error(404, 'not_found', 'not found');
      },
      register(body) {
        const decoded = decodeDefinition(body);
        if ('response' in decoded) return decoded.response;
        const { def } = decoded;
        const existing = findDefinition('local', def.name);
        if (existing) {
          if (!newer(def.version, existing.version)) {
            return error(
              409,
              'conflict',
              `local/${def.name} is already registered with version ${existing.version}; a new registration needs a higher version`,
            );
          }
          state.catalog = state.catalog.filter((candidate) => candidate !== existing);
        }
        state.catalog.push(def);
        findSource('local')!.serial += 1;
        return json(201, serializeDefinition(def));
      },
      removeLocal(name) {
        const before = state.catalog.length;
        state.catalog = state.catalog.filter(
          (def) => !(def.source.name === 'local' && def.name === name),
        );
        return state.catalog.length === before ? error(404, 'not_found', 'not found') : empty();
      },
      sources: {
        list() {
          return json(200, sortedSources().map(serializeSource));
        },
        add(body) {
          if (!isRecord(body)) return invalid('invalid request body: not a JSON object');
          const field = Object.keys(body).find(
            (key) => !['name', 'url', 'token', 'allow_insecure', 'allow_private'].includes(key),
          );
          if (field) return invalid(`invalid request body: json: unknown field "${field}"`);
          const name = typeof body.name === 'string' ? body.name : '';
          const url = typeof body.url === 'string' ? body.url : '';
          const allowInsecure = body.allow_insecure === true;
          if (!NAME.test(name) || name === 'official' || name === 'local' || name === 'oakestra') {
            return invalid(`invalid tap name: "${name}" is not allowed`);
          }
          if (!/^https?:\/\/[^/]+/.test(url) || (url.startsWith('http:') && !allowInsecure)) {
            return invalid(
              `invalid url: ${url.startsWith('http:') ? 'plain http needs allow_insecure' : 'must be an absolute https URL'}`,
            );
          }
          if (findSource(name)) return error(409, 'conflict', `source "${name}" already exists`);
          const source: MockSource = {
            name,
            kind: 'tap',
            url,
            ...(typeof body.token === 'string' && body.token ? { token: body.token } : {}),
            allow_insecure: allowInsecure,
            allow_private: body.allow_private === true,
            created_at: now(),
            last_attempt_at: null,
            last_synced_at: null,
            last_error: '',
            serial: 0,
            generated_at: null,
          };
          state.sources.push(source);
          syncSource(source);
          return json(201, serializeSource(source));
        },
        remove(name) {
          if (name === 'official' || name === 'local') {
            return error(409, 'conflict', `the ${name} source can't be deleted`);
          }
          if (!findSource(name)) return error(404, 'not_found', 'not found');
          state.sources = state.sources.filter((source) => source.name !== name);
          state.catalog = state.catalog.filter((def) => def.source.name !== name);
          return empty();
        },
        sync(name) {
          const source = findSource(name);
          if (!source) return error(404, 'not_found', 'not found');
          if (source.kind === 'local') {
            return error(409, 'conflict', 'sync is disabled for this source');
          }
          const problem = syncSource(source);
          return problem ? error(502, 'sync_failed', problem) : json(200, serializeSource(source));
        },
        importIndex(name, body) {
          const source = findSource(name);
          if (!source) return error(404, 'not_found', 'not found');
          if (source.kind === 'local') {
            return error(409, 'conflict', 'sync is disabled for this source');
          }
          if (!isRecord(body) || body.schema !== 1 || !Array.isArray(body.addons)) {
            return invalid('rejected index: schema must be 1 and addons a list');
          }
          const defs: MockDefinition[] = [];
          for (const raw of body.addons) {
            const decoded = decodeDefinition(raw);
            if ('response' in decoded) return decoded.response;
            defs.push({ ...decoded.def, source: { kind: source.kind, name: source.name } });
          }
          state.catalog = [...state.catalog.filter((def) => def.source.name !== name), ...defs];
          source.serial = typeof body.serial === 'number' ? body.serial : source.serial + 1;
          source.last_synced_at = source.last_attempt_at = now();
          source.last_error = '';
          return json(200, serializeSource(source));
        },
      },
    },
    uiAddons() {
      const entries: UiAddonEntry[] = [];
      for (const addon of state.installed) {
        const ui = addon.definition.ui;
        if (addon.status !== 'active' || !ui) continue;
        const image = addon.definition.services.find((s) => s.service_name === ui.service)?.image;
        const tag = /:([^/@:]+)(@|$)/.exec(image ?? '')?.[1] ?? 'latest';
        const { display_name, icon } = displayFields(addon.definition);
        entries.push({
          name: addon.addon_id,
          version: versions.get(addon.addon_id) ?? tag,
          sdk: ui.sdk,
          ...(display_name ? { display_name } : {}),
          ...(icon ? { icon } : {}),
        });
      }
      return entries;
    },
    definitionHash: hashDefinition,
    forceStatus,
    setDelays,
    reset() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      seed();
    },
  };
}
