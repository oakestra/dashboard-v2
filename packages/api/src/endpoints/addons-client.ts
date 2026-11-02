import { ApiError, messageFromErrorBody } from '../errors.ts';
import { rethrowAsNetworkError, type RequestOptions } from './request.ts';

export interface AddonsClientOptions {
  /** Base URL up to the service root, e.g. `/addons-api` or `http://localhost:11101/api/v1/addons`. */
  baseUrl: string;
  /** Defaults to the global fetch, looked up per request so test interceptors are honoured. */
  fetch?: (request: Request) => Promise<Response>;
}

export interface AddonsRequest extends RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Path below the base URL. A trailing slash is kept: Flask redirects the collection without. */
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
 * The addons-manager returns `json.dumps(...)` strings, so the Content-Type is `text/html` and
 * `response.json()` based helpers would not be reliable. The text is parsed here regardless of
 * the header. Anything that does not parse (an nginx HTML error page) stays a string.
 */
function parseBody(text: string): unknown {
  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
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
        // A gateway error means the addons engine or marketplace is not deployed or is down.
        const message =
          response.status === 502 || response.status === 503 || response.status === 504
            ? 'The addons service is not reachable. It may not be installed or is currently down.'
            : messageFromErrorBody(parsed, response.status);
        throw new ApiError(message, {
          kind: 'http',
          status: response.status,
          ...call,
          body: parsed,
        });
      }
      return { status: response.status, body: parsed };
    },
  };
}
