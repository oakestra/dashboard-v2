import {
  decodeTokenClaims,
  isApiError,
  ROOT_ORGANIZATION_NAME,
  type AccessTokenClaims,
  type TokenPair,
} from '@oakestra/api';
import type { CurrentUser } from '@oakestra/dashboard-sdk';
import { createStore, type StoreApi } from 'zustand/vanilla';

/** Survives reloads and is shared by all tabs. The access token never touches storage. */
export const REFRESH_TOKEN_KEY = 'oakestra.auth.refresh-token';
export const ORGANIZATION_NAME_KEY = 'oakestra.auth.organization';

/** Refresh this long before the access token expires, so requests never race its expiry. */
const REFRESH_MARGIN_MS = 30_000;

/**
 * - `user`: the user logged out.
 * - `expired`: the refresh token was rejected; the user has to log in again.
 * - `other-tab`: another tab logged out, which ends the session everywhere.
 */
export type LogoutReason = 'user' | 'expired' | 'other-tab';

export interface AuthState {
  status: 'anonymous' | 'authenticated';
  /** Kept referentially stable across token refreshes as long as the claims do not change. */
  user: CurrentUser | null;
  lastLogoutReason: LogoutReason | null;
}

export interface AuthSessionDeps {
  storage: Storage;
  /** Exchanges a refresh token for a new access token. Expected to throw ApiErrors. */
  refresh(refreshToken: string): Promise<string>;
  now?: () => number;
}

export interface AuthSession {
  readonly store: StoreApi<AuthState>;
  login(tokens: TokenPair, organizationName?: string): void;
  logout(reason: LogoutReason): void;
  /**
   * The access token to send, refreshed first if it expires within 30 seconds. Concurrent callers
   * share one refresh. Null when there is no session (or it just ended).
   */
  getAccessToken(): Promise<string | null>;
  /**
   * Called after a request with `rejectedToken` came back 401. Refreshes unless another request
   * already did, and ends the session if the refresh token is rejected too.
   */
  refreshAfterUnauthorized(rejectedToken: string): Promise<string | null>;
  /** For route guards: true if there is a session or the stored refresh token can restore one. */
  ensureSession(): Promise<boolean>;
  /** Follows logins and logouts in other tabs. Returns the unsubscribe function. */
  watchOtherTabs(target: Pick<Window, 'addEventListener' | 'removeEventListener'>): () => void;
}

interface AccessToken {
  raw: string;
  claims: AccessTokenClaims;
}

/** Answers that mean "this refresh token is no good", as opposed to "the backend is unreachable". */
function isRejection(error: unknown): boolean {
  return isApiError(error) && [401, 403, 404, 422].includes(error.status);
}

function sameUser(a: CurrentUser | null, b: CurrentUser): boolean {
  return (
    a !== null &&
    a.username === b.username &&
    a.organization === b.organization &&
    a.organizationName === b.organizationName &&
    a.roles.length === b.roles.length &&
    a.roles.every((role, index) => role === b.roles[index])
  );
}

export function createAuthSession(deps: AuthSessionDeps): AuthSession {
  const { storage } = deps;
  const now = deps.now ?? Date.now;

  let access: AccessToken | null = null;
  let refreshToken = readStorage(REFRESH_TOKEN_KEY);
  let organizationName = readStorage(ORGANIZATION_NAME_KEY) ?? ROOT_ORGANIZATION_NAME;
  let refreshing: Promise<string | null> | null = null;
  // Bumped on every login/logout so a refresh that started before can't resurrect an old session.
  let generation = 0;

  const store = createStore<AuthState>()(() => ({
    status: 'anonymous',
    user: null,
    lastLogoutReason: null,
  }));

  function readStorage(key: string): string | null {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key: string, value: string | null): void {
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch {
      // Private mode or full storage: the session still works until the tab is closed.
    }
  }

  function setAccessToken(raw: string): AccessToken {
    const token = { raw, claims: decodeTokenClaims(raw) };
    access = token;
    const { sub, roles, organization } = token.claims;
    const user: CurrentUser = {
      username: sub,
      roles,
      // Older backends put the literal "root" here; current ones put the root organization's id.
      organization: organization && organization !== ROOT_ORGANIZATION_NAME ? organization : null,
      organizationName,
    };
    const current = store.getState().user;
    store.setState({
      status: 'authenticated',
      user: sameUser(current, user) ? current : user,
      lastLogoutReason: null,
    });
    return token;
  }

  function endSession(reason: LogoutReason, clearStorage: boolean): void {
    generation += 1;
    access = null;
    refreshToken = null;
    refreshing = null;
    if (clearStorage) {
      writeStorage(REFRESH_TOKEN_KEY, null);
      writeStorage(ORGANIZATION_NAME_KEY, null);
    }
    if (store.getState().status === 'anonymous' && store.getState().lastLogoutReason === reason) {
      return;
    }
    store.setState({ status: 'anonymous', user: null, lastLogoutReason: reason });
  }

  function refresh(): Promise<string | null> {
    if (refreshing) return refreshing;
    const token = refreshToken;
    if (!token) return Promise.resolve(null);
    const started = generation;

    refreshing = deps
      .refresh(token)
      .then((raw) => (started === generation ? setAccessToken(raw).raw : null))
      .catch((error: unknown) => {
        if (started !== generation) return null;
        if (isRejection(error)) {
          endSession('expired', true);
          return null;
        }
        // Network trouble: keep the session, the next request will try again.
        throw error;
      })
      .finally(() => {
        if (started === generation) refreshing = null;
      });
    return refreshing;
  }

  function expiresSoon(token: AccessToken): boolean {
    return token.claims.exp * 1000 - now() < REFRESH_MARGIN_MS;
  }

  return {
    store,

    login(tokens, name) {
      generation += 1;
      refreshing = null;
      refreshToken = tokens.refresh_token;
      organizationName = name?.trim() || ROOT_ORGANIZATION_NAME;
      writeStorage(REFRESH_TOKEN_KEY, tokens.refresh_token);
      writeStorage(ORGANIZATION_NAME_KEY, organizationName);
      setAccessToken(tokens.token);
    },

    logout(reason) {
      endSession(reason, true);
    },

    async getAccessToken() {
      if (access && !expiresSoon(access)) return access.raw;
      return refresh();
    },

    async refreshAfterUnauthorized(rejectedToken) {
      if (access && access.raw !== rejectedToken) return access.raw;
      return refresh();
    },

    async ensureSession() {
      if (access && !expiresSoon(access)) return true;
      return (await refresh()) !== null;
    },

    watchOtherTabs(target) {
      const onStorage = (event: StorageEvent) => {
        if (event.key !== REFRESH_TOKEN_KEY && event.key !== null) return;
        const stored = readStorage(REFRESH_TOKEN_KEY);
        if (stored === null) {
          // `key === null` is a storage.clear() in the other tab, which also ends its session.
          if (refreshToken !== null || store.getState().status === 'authenticated') {
            endSession('other-tab', false);
          }
          return;
        }
        if (stored === refreshToken) return;
        // Another tab logged in, possibly as someone else. Drop what this tab knows and let the
        // next request pick up that session.
        generation += 1;
        access = null;
        refreshing = null;
        refreshToken = stored;
        organizationName = readStorage(ORGANIZATION_NAME_KEY) ?? ROOT_ORGANIZATION_NAME;
        void refresh().catch(() => undefined);
      };
      target.addEventListener('storage', onStorage);
      return () => target.removeEventListener('storage', onStorage);
    },
  };
}
