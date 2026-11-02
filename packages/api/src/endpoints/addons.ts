import { ApiError } from '../errors.ts';
import {
  installedAddonSchema,
  marketplaceAddonSchema,
  registerAddonInputSchema,
  type AddonStatus,
  type InstalledAddon,
  type MarketplaceAddon,
  type RegisterAddonInput,
} from '../models/addon.ts';
import { lenientArray } from '../models/common.ts';
import type { AddonsClient } from './addons-client.ts';
import { parse, type Call, type RequestOptions } from './request.ts';

const installedList = lenientArray(installedAddonSchema, 'installed addons');
const marketplaceList = lenientArray(marketplaceAddonSchema, 'marketplace addons');

/**
 * Outcome of `remove`. The backend answers `DELETE` by state: an addon that is not `disabled` yet
 * only moves to `disabling` (200 with the addon); a `disabled` one is deleted (204, no body).
 * Removing an addon completely therefore takes two calls with a wait in between.
 */
export type RemoveAddonResult = { kind: 'disabling'; addon: InstalledAddon } | { kind: 'removed' };

export interface AddonsManagerEndpoints {
  /** Installed addons, optionally only those in one status. */
  list(options?: RequestOptions & { status?: AddonStatus }): Promise<InstalledAddon[]>;
  get(id: string, options?: RequestOptions): Promise<InstalledAddon>;
  /** Installs a marketplace definition. Resolves with the addon in `installing`; 400 if installed. */
  install(marketplaceId: string, options?: RequestOptions): Promise<InstalledAddon>;
  /** Raw status change. Prefer `remove` to disable. */
  setStatus(id: string, status: AddonStatus, options?: RequestOptions): Promise<InstalledAddon>;
  remove(id: string, options?: RequestOptions): Promise<RemoveAddonResult>;
}

export interface MarketplaceEndpoints {
  /** Approved definitions, optionally filtered by exact name. */
  list(options?: RequestOptions & { name?: string }): Promise<MarketplaceAddon[]>;
  get(id: string, options?: RequestOptions): Promise<MarketplaceAddon>;
  /** Validates the input with `registerAddonInputSchema` first; a failure is an ApiError (422). */
  register(input: RegisterAddonInput, options?: RequestOptions): Promise<MarketplaceAddon>;
  remove(id: string, options?: RequestOptions): Promise<void>;
}

const segment = (id: string) => encodeURIComponent(id);

/** Endpoints of the addons-manager (`/api/v1/addons`, proxied as `addonsManagerUrl`). */
export function createAddonsManagerApi(client: AddonsClient): AddonsManagerEndpoints {
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
    async install(marketplaceId, { signal } = {}) {
      const call = { method: 'POST', path: '/' };
      const { body } = await client.request({
        method: 'POST',
        path: '/',
        body: { marketplace_id: marketplaceId },
        signal,
      });
      return parse(installedAddonSchema, body, call);
    },
    async setStatus(id, status, { signal } = {}) {
      const call = { method: 'PATCH', path: `/${segment(id)}` };
      const { body } = await client.request({
        method: 'PATCH',
        path: call.path,
        body: { status },
        signal,
      });
      return parse(installedAddonSchema, body, call);
    },
    async remove(id, { signal } = {}) {
      const call = { method: 'DELETE', path: `/${segment(id)}` };
      const { status, body } = await client.request({ method: 'DELETE', path: call.path, signal });
      if (status === 204) return { kind: 'removed' };
      return { kind: 'disabling', addon: parse(installedAddonSchema, body, call) };
    },
  };
}

/** Endpoints of the marketplace-manager (`/api/v1/marketplace/addons`, `marketplaceUrl`). */
export function createMarketplaceApi(client: AddonsClient): MarketplaceEndpoints {
  return {
    async list({ name, signal } = {}) {
      const call = { method: 'GET', path: '/' };
      const { body } = await client.request({ method: 'GET', path: '/', query: { name }, signal });
      return parse(marketplaceList, body, call);
    },
    async get(id, { signal } = {}) {
      const call = { method: 'GET', path: `/${segment(id)}` };
      const { body } = await client.request({ method: 'GET', path: call.path, signal });
      return parse(marketplaceAddonSchema, body, call);
    },
    async register(input, { signal } = {}) {
      const call: Call = { method: 'POST', path: '/' };
      const checked = registerAddonInputSchema.safeParse(input);
      if (!checked.success) {
        throw new ApiError(checked.error.issues[0]?.message ?? 'The addon definition is invalid.', {
          kind: 'http',
          status: 422,
          ...call,
          body: checked.error.issues,
          cause: checked.error,
        });
      }
      const { body } = await client.request({
        method: 'POST',
        path: '/',
        body: checked.data,
        signal,
      });
      return parse(marketplaceAddonSchema, body, call);
    },
    async remove(id, { signal } = {}) {
      await client.request({ method: 'DELETE', path: `/${segment(id)}`, signal });
    },
  };
}
