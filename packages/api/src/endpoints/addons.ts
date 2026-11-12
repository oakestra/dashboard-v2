import { ApiError, isApiError, type ApiErrorOptions } from '../errors.ts';
import {
  addTapInputSchema,
  installedAddonSchema,
  marketplaceAddonSchema,
  marketplaceSourceSchema,
  consentRequiredBodySchema,
  registerAddonInputSchema,
  type AddonDefinition,
  type AddonPermissions,
  type AddonStatus,
  type AddTapInput,
  type InstalledAddon,
  type MarketplaceAddon,
  type MarketplaceSource,
  type RegisterAddonInput,
} from '../models/addon.ts';
import { lenientArray } from '../models/common.ts';
import type { AddonsClient, AddonsResponse } from './addons-client.ts';
import { parse, type Call, type RequestOptions } from './request.ts';

const installedList = lenientArray(installedAddonSchema, 'installed addons');
const marketplaceList = lenientArray(marketplaceAddonSchema, 'marketplace addons');
const sourceList = lenientArray(marketplaceSourceSchema, 'marketplace sources');

/** What the addons-manager wants the admin to accept before it installs, updates or re-approves. */
export interface ConsentRequest {
  /** The backend's explanation. */
  message: string;
  /** The definition as it will be stored: images with digests, commands, environment, mounts. */
  definition: AddonDefinition;
  /** Pass it as `acceptDefinition` to accept exactly `definition`. */
  definitionHash: string;
  /** `definition.permissions`, canonical. */
  permissions: AddonPermissions;
  /** Updates only: the installed version. */
  previousVersion?: string;
  /** Updates only: what the installed version was granted. */
  previousPermissions?: AddonPermissions;
  /** Updates only: the new version asks for more than was granted. */
  permissionsGrow: boolean;
}

/**
 * The 409 of install, update and approve when the definition has not been accepted (or changed
 * since its hash was read). Every other 409 (already installed, host path conflicts) is a plain
 * ApiError. `name` stays `ApiError`, so `isApiError` and `describeError` keep working.
 */
export class ConsentRequiredError extends ApiError {
  readonly consentRequest: ConsentRequest;

  constructor(request: ConsentRequest, options: ApiErrorOptions) {
    super(request.message, options);
    this.consentRequest = request;
  }
}

/** Duck-typed like `isApiError`, for the same reason. */
export function isConsentRequiredError(error: unknown): error is ConsentRequiredError {
  return (
    isApiError(error) &&
    error.status === 409 &&
    typeof (error as { consentRequest?: unknown }).consentRequest === 'object'
  );
}

/** Turns a consent 409 (recognised by `definition_hash`) into a ConsentRequiredError. */
function asConsentRequired(error: unknown): never {
  if (isApiError(error) && error.kind === 'http' && error.status === 409) {
    const body = consentRequiredBodySchema.safeParse(error.body);
    if (body.success) {
      throw new ConsentRequiredError(
        {
          message: body.data.message ?? 'This addon has to be accepted first.',
          definition: body.data.definition,
          definitionHash: body.data.definition_hash,
          permissions: body.data.permissions,
          previousVersion: body.data.previous_version,
          previousPermissions: body.data.previous_permissions,
          permissionsGrow: body.data.permissions_grow ?? false,
        },
        {
          kind: 'http',
          status: 409,
          method: error.method,
          path: error.path,
          body: error.body,
          cause: error,
        },
      );
    }
  }
  throw error;
}

/**
 * Outcome of `remove`. The backend answers `DELETE` by state: an addon that is not `disabled` yet
 * only moves to `disabling` (200 with the addon); a `disabled` one is deleted (204, no body).
 * Removing an addon completely therefore takes two calls with a wait in between.
 */
export type RemoveAddonResult = { kind: 'disabling'; addon: InstalledAddon } | { kind: 'removed' };

export interface AcceptDefinitionOptions extends RequestOptions {
  /**
   * `definition_hash` of the definition the admin accepted. Without it (or with a stale one) the
   * call fails with a `ConsentRequiredError` that carries what has to be accepted. The catalog
   * serves no hash on purpose, so the first call always goes without one.
   */
  acceptDefinition?: string;
}

export interface AddonsManagerEndpoints {
  /** Installed addons, optionally only those in one status. Logs are included for admins only. */
  list(options?: RequestOptions & { status?: AddonStatus }): Promise<InstalledAddon[]>;
  get(id: string, options?: RequestOptions): Promise<InstalledAddon>;
  /**
   * Installs a catalog addon by qualified name (`name`, `<tap>/name`, `local/name`). Resolves
   * with the addon in `installing`. A 409 is a `ConsentRequiredError` when the definition still
   * has to be accepted, otherwise an ApiError (already installed, host path conflict).
   */
  install(qualifiedName: string, options?: AcceptDefinitionOptions): Promise<InstalledAddon>;
  /**
   * Updates to the catalog's latest version (the addon moves to `updating`). Always needs the
   * hash of the new definition, also when the permissions stay the same.
   */
  update(id: string, options?: AcceptDefinitionOptions): Promise<InstalledAddon>;
  /**
   * Signs the grant again, e.g. after `grant signature invalid`, and redeploys a failed addon.
   * Always needs the definition hash.
   */
  approve(id: string, options?: AcceptDefinitionOptions): Promise<InstalledAddon>;
  remove(id: string, options?: RequestOptions): Promise<RemoveAddonResult>;
}

/** Identifies a catalog addon: its source name and bare name. */
export interface MarketplaceAddonRef {
  source: string;
  name: string;
}

export interface MarketplaceEndpoints {
  /** The merged catalog, optionally one source only or one name (bare or qualified). */
  list(options?: RequestOptions & { source?: string; name?: string }): Promise<MarketplaceAddon[]>;
  get(ref: MarketplaceAddonRef, options?: RequestOptions): Promise<MarketplaceAddon>;
  /**
   * Registers a definition in the `local` source, where it is listed at once. Validates the
   * input with `registerAddonInputSchema` first; a failure is an ApiError (422).
   */
  register(input: RegisterAddonInput, options?: RequestOptions): Promise<MarketplaceAddon>;
  /** Deletes a local registration. Other sources are managed through their index. */
  removeLocal(name: string, options?: RequestOptions): Promise<void>;
  sources: {
    list(options?: RequestOptions): Promise<MarketplaceSource[]>;
    /**
     * Adds a tap and runs its first sync. A failing first sync does not undo it: the source
     * comes back with `last_error`.
     */
    add(input: AddTapInput, options?: RequestOptions): Promise<MarketplaceSource>;
    /** Taps only; the official and local sources answer 409. */
    remove(name: string, options?: RequestOptions): Promise<void>;
    /** A failed fetch is a 502 whose message says why; it is also kept as `last_error`. */
    sync(name: string, options?: RequestOptions): Promise<MarketplaceSource>;
    /** Replaces the source's snapshot with an index document (air-gapped setups). */
    importIndex(name: string, index: unknown, options?: RequestOptions): Promise<MarketplaceSource>;
  };
}

const segment = (id: string) => encodeURIComponent(id);

function invalidInput(call: Call, issues: readonly { message: string }[], cause: unknown): never {
  throw new ApiError(issues[0]?.message ?? 'The input is invalid.', {
    kind: 'http',
    status: 422,
    ...call,
    body: issues,
    cause,
  });
}

/** Endpoints of the addons-manager (`/api/v1/addons`, proxied as `addonsManagerUrl`). */
export function createAddonsManagerApi(client: AddonsClient): AddonsManagerEndpoints {
  /** Install, update and approve all take `{accept_definition}` and may answer the consent 409. */
  async function accepting(
    call: Call,
    body: Record<string, unknown>,
    { acceptDefinition, signal }: AcceptDefinitionOptions,
  ): Promise<InstalledAddon> {
    let response: AddonsResponse;
    try {
      response = await client.request({
        method: 'POST',
        path: call.path,
        // The backend needs a JSON object even when nothing has been accepted yet, and rejects
        // unknown fields, so this is the whole body.
        body: { ...body, accept_definition: acceptDefinition ?? '' },
        signal,
      });
    } catch (error) {
      asConsentRequired(error);
    }
    return parse(installedAddonSchema, response.body, call);
  }

  return {
    async list({ status, signal } = {}) {
      const call = { method: 'GET', path: '/' };
      const { body } = await client.request({
        method: 'GET',
        path: '/',
        query: { status },
        signal,
      });
      return parse(installedList, body, call);
    },
    async get(id, { signal } = {}) {
      const call = { method: 'GET', path: `/${segment(id)}` };
      const { body } = await client.request({ method: 'GET', path: call.path, signal });
      return parse(installedAddonSchema, body, call);
    },
    install(qualifiedName, options = {}) {
      return accepting({ method: 'POST', path: '/' }, { name: qualifiedName }, options);
    },
    update(id, options = {}) {
      return accepting({ method: 'POST', path: `/${segment(id)}/update` }, {}, options);
    },
    approve(id, options = {}) {
      return accepting({ method: 'POST', path: `/${segment(id)}/approve` }, {}, options);
    },
    async remove(id, { signal } = {}) {
      const call = { method: 'DELETE', path: `/${segment(id)}` };
      const { status, body } = await client.request({ method: 'DELETE', path: call.path, signal });
      if (status === 204) return { kind: 'removed' };
      return { kind: 'disabling', addon: parse(installedAddonSchema, body, call) };
    },
  };
}

/**
 * Endpoints of the marketplace-manager. `marketplaceUrl` is its API root, `/api/v1/marketplace`:
 * addons live below `/addons`, sources below `/sources`.
 */
export function createMarketplaceApi(client: AddonsClient): MarketplaceEndpoints {
  const sourcePath = (name: string) => `/sources/${segment(name)}`;

  return {
    async list({ source, name, signal } = {}) {
      const call = { method: 'GET', path: '/addons' };
      const { body } = await client.request({
        method: 'GET',
        path: call.path,
        query: { source, name },
        signal,
      });
      return parse(marketplaceList, body, call);
    },
    async get({ source, name }, { signal } = {}) {
      const call = { method: 'GET', path: `/addons/${segment(source)}/${segment(name)}` };
      const { body } = await client.request({ method: 'GET', path: call.path, signal });
      return parse(marketplaceAddonSchema, body, call);
    },
    async register(input, { signal } = {}) {
      const call: Call = { method: 'POST', path: '/addons' };
      const checked = registerAddonInputSchema.safeParse(input);
      if (!checked.success) invalidInput(call, checked.error.issues, checked.error);
      const { body } = await client.request({
        method: 'POST',
        path: call.path,
        body: checked.data,
        signal,
      });
      return parse(marketplaceAddonSchema, body, call);
    },
    async removeLocal(name, { signal } = {}) {
      await client.request({ method: 'DELETE', path: `/addons/local/${segment(name)}`, signal });
    },
    sources: {
      async list({ signal } = {}) {
        const call = { method: 'GET', path: '/sources' };
        const { body } = await client.request({ method: 'GET', path: call.path, signal });
        return parse(sourceList, body, call);
      },
      async add(input, { signal } = {}) {
        const call: Call = { method: 'POST', path: '/sources' };
        const checked = addTapInputSchema.safeParse(input);
        if (!checked.success) invalidInput(call, checked.error.issues, checked.error);
        // The marketplace rejects unknown fields, and an empty token would be stored as one.
        const { token, ...rest } = checked.data;
        const { body } = await client.request({
          method: 'POST',
          path: call.path,
          body: token ? { ...rest, token } : rest,
          signal,
        });
        return parse(marketplaceSourceSchema, body, call);
      },
      async remove(name, { signal } = {}) {
        await client.request({ method: 'DELETE', path: sourcePath(name), signal });
      },
      async sync(name, { signal } = {}) {
        const call = { method: 'POST', path: `${sourcePath(name)}/sync` };
        const { body } = await client.request({ method: 'POST', path: call.path, signal });
        return parse(marketplaceSourceSchema, body, call);
      },
      async importIndex(name, index, { signal } = {}) {
        const call = { method: 'POST', path: `${sourcePath(name)}/import` };
        const { body } = await client.request({
          method: 'POST',
          path: call.path,
          body: index,
          signal,
        });
        return parse(marketplaceSourceSchema, body, call);
      },
    },
  };
}
