import type { AuthSession } from '../auth/session';
import { ADDON_NAME_PATTERN } from '../addons/ui-addons';
import type { Fetch } from './authorized-fetch';

/**
 * The `addonBackendFetch` of the host context. useAddonApi() already keeps its requests below the
 * addon's base URL; this is the shell's own guard, because any addon can call the function
 * directly through the host context, and it would otherwise hand the token to any URL.
 *
 * Unlike createAuthorizedFetch it never refreshes and retries on a 401: that answer belongs to the
 * addon, and refreshing on it would send a refresh to the system-manager for every such request.
 * getAccessToken() still refreshes proactively before expiry.
 */
export function createAddonBackendFetch(session: AuthSession, send: Fetch): Fetch {
  return async (request) => {
    const origin = globalThis.location.origin;
    const url = new URL(request.url);
    if (url.origin !== origin || !isAddonBackendPath(url.pathname)) {
      throw new Error(
        `addonBackendFetch refuses ${request.url}: it attaches the user's token and only sends ` +
          `requests to ${origin}/addon-assets/<name>/api/. Use useAddonApi().`,
      );
    }
    if (!request.headers.has('Authorization')) {
      const token = await session.getAccessToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
    }
    return send(request);
  };
}

function isAddonBackendPath(pathname: string): boolean {
  const name = /^\/addon-assets\/([^/]+)\/api\//.exec(pathname)?.[1];
  if (name === undefined || !ADDON_NAME_PATTERN.test(name)) return false;
  // nginx decodes percent escapes before it resolves `..`, so `api/..%2f..%2f` would leave the
  // addon's location there although the URL parser keeps it as one segment.
  const decoded = pathname.replace(/%([\da-f]{2})/gi, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  return !decoded.split(/[/\\]/).includes('..');
}
