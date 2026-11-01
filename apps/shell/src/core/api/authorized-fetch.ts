import type { AuthSession } from '../auth/session';

export type Fetch = (request: Request) => Promise<Response>;

/**
 * Sends `request` with the session's bearer token: refreshes proactively shortly before expiry,
 * and on a 401 refreshes once and retries once. If the refresh token is rejected as well, the
 * session ends (which logs the user out) and the original 401 is returned to the caller.
 *
 * This is the client's `fetch` rather than an openapi-fetch middleware because a retry has to
 * re-send the request with its body, and because the SDK's raw `api.fetch` needs exactly the same
 * behaviour for endpoints the typed client does not cover.
 *
 * Requests that already carry an Authorization header (the refresh call) are sent untouched.
 */
export function createAuthorizedFetch(
  session: AuthSession,
  send: Fetch = (request) => globalThis.fetch(request),
): Fetch {
  return async (request) => {
    if (request.headers.has('Authorization')) return send(request);
    const token = await session.getAccessToken();
    if (!token) return send(request);

    // The body stream can only be read once, so keep an unsent copy for the retry.
    const retry = request.clone();
    request.headers.set('Authorization', `Bearer ${token}`);
    const response = await send(request);
    if (response.status !== 401) return response;

    const fresh = await session.refreshAfterUnauthorized(token);
    if (!fresh) return response;
    retry.headers.set('Authorization', `Bearer ${fresh}`);
    return send(retry);
  };
}
