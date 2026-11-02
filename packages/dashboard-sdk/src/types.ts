import type { OakestraEndpoints } from '@oakestra/api';

/** Roles as they appear in the `roles` claim of Oakestra access tokens. */
export type KnownRole =
  'Admin' | 'Organization_Admin' | 'Application_Provider' | 'Infrastructure_Provider';

// `string & {}` keeps autocompletion for the known roles while still accepting roles the backend
// may add later without an SDK release.
export type Role = KnownRole | (string & {});

export interface CurrentUser {
  /** Username, taken from the token's `sub` claim. */
  readonly username: string;
  readonly roles: readonly Role[];
  /**
   * Id of the organization the session belongs to (the token's `organization` claim). Users who
   * log in without naming an organization get the id of the built-in `root` organization.
   */
  readonly organization: string | null;
  /** Name of that organization as entered at login; `root` when none was given. */
  readonly organizationName?: string;
}

export interface NotifyOptions {
  description?: string;
  /** A notification with the same id replaces the previous one instead of stacking up. */
  id?: string;
}

export interface Notify {
  success(message: string, options?: NotifyOptions): void;
  info(message: string, options?: NotifyOptions): void;
  warning(message: string, options?: NotifyOptions): void;
  error(message: string, options?: NotifyOptions): void;
}

/**
 * Access to the Oakestra system-manager API with the current user's credentials attached.
 *
 * The grouped endpoints (`api.services.list(...)`, ...) are the typed `@oakestra/api` facade: they
 * validate responses and throw `ApiError`s (import the type from `@oakestra/api`). `fetch` stays
 * for endpoints the facade does not cover; it gets the same bearer token and refresh handling.
 */
export interface OakestraApi extends OakestraEndpoints {
  /** Base URL of the system-manager API, without a trailing slash. */
  readonly baseUrl: string;
  /** `path` is resolved against `baseUrl`. */
  fetch(path: string, init?: RequestInit): Promise<Response>;
}
