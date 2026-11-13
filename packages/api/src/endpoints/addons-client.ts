import { ApiError, messageFromErrorBody } from '../errors.ts';
import type { AddonErrorCode } from '../models/addon.ts';
import { rethrowAsNetworkError, type RequestOptions } from './request.ts';

export interface AddonsClientOptions {
  /** Base URL up to the service root, e.g. `/addons-api` or `http://localhost:11101/api/v1/addons`. */
  baseUrl: string;
  /** Defaults to the global fetch, looked up per request so test interceptors are honoured. */
  fetch?: (request: Request) => Promise<Response>;
}

export interface AddonsRequest extends RequestOptions {
  method: 'GET' | 'POST' | 'DELETE';
  /** Path below the base URL. Both services accept collections with and without a slash. */
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

export interface AddonsResponse {
  status: number;
  /** Parsed JSON, or undefined for an empty body. */
  body: unknown;
}

/**
 * Minimal transport for the addons-manager and marketplace-manager. They are not part of the
 * system-manager OpenAPI spec and live behind other base URLs, so they do not use the
 * openapi-fetch client of `createOakestraClient`.
 */
export interface AddonsClient {
  readonly baseUrl: string;
  request(request: AddonsRequest): Promise<AddonsResponse>;
}

/**
 * The text is parsed regardless of the Content-Type: older addons-managers answered JSON as
 * `text/html`, and proxies in between may relabel it. Anything that does not parse (an nginx HTML
 * error page) stays a string.
 */
function parseBody(text: string): unknown {
  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function codeOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { code } = body as { code?: unknown };
  return typeof code === 'string' && code !== '' ? code : undefined;
}

/**
 * Codes whose backend message doesn't tell the user what to do. The rest keep the
 * service's message: it names the addon, the version or the overlapping host paths.
 */
const FRIENDLY_MESSAGES: Partial<Record<AddonErrorCode, string>> = {
  auth_unavailable:
    'The addons service is still starting and cannot check sign-ins yet. Retry shortly.',
  marketplace_unavailable:
    'The addons manager cannot reach the marketplace right now. Retry shortly.',
  busy: 'The addon is still installing, updating or shutting down. Try again once it has settled.',
  no_update_available: 'The marketplace has no newer version of this addon.',
};

/** The text an addons engine error is shown with. */
function addonErrorMessage(body: unknown, status: number): string {
  const code = codeOf(body);
  const friendly = code ? FRIENDLY_MESSAGES[code as AddonErrorCode] : undefined;
  if (friendly) return friendly;
  // A gateway error without a code comes from the proxy, not from the service: the addons
  // engine or marketplace is not deployed or is down.
  if (!code && (status === 502 || status === 503 || status === 504)) {
    return 'The addons service is not reachable. It may not be installed, or it is down.';
  }
  return messageFromErrorBody(body, status);
}

export function createAddonsClient(options: AddonsClientOptions): AddonsClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const send = options.fetch ?? ((request: Request) => globalThis.fetch(request));

  return {
    baseUrl,
    async request({ method, path, query, body, signal }) {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== '') search.set(key, value);
      }
      const suffix = search.size > 0 ? `?${search.toString()}` : '';
      const target = `${baseUrl}${path}${suffix}`;
      const call = { method, path: `${path}${suffix}` };
      const headers = new Headers({ Accept: 'application/json' });
      if (body !== undefined) headers.set('Content-Type', 'application/json');

      let response: Response;
      let text: string;
      try {
        // Relative base URLs ("/addons-api") need an origin to form a Request, unlike fetch().
        const base = typeof window === 'undefined' ? undefined : window.location.href;
        const request = new Request(new URL(target, base), {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal,
        });
        response = await send(request);
        text = await response.text();
      } catch (error) {
        rethrowAsNetworkError(
          error,
          call,
          'Could not reach the addons service. Check your connection.',
        );
      }

      const parsed = parseBody(text);
      if (!response.ok) {
        const message = addonErrorMessage(parsed, response.status);
        throw new ApiError(message, {
          kind: 'http',
          status: response.status,
          ...call,
          body: parsed,
          code: codeOf(parsed),
        });
      }
      return { status: response.status, body: parsed };
    },
  };
}
