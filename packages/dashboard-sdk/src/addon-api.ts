/** Client for an addon's own backend. */
export interface AddonApi {
  /** Origin-relative base URL of the backend, without a trailing slash. */
  readonly baseUrl: string;
  /**
   * `path` is resolved below `baseUrl`, so `fetch('/runs')` calls `<baseUrl>/runs`. The request
   * carries the user's bearer token. Only paths that stay below `baseUrl` are accepted: absolute
   * URLs, protocol-relative URLs and `..` segments that climb out of it reject before anything is
   * sent. A 401 from the backend comes back as it is, without a token refresh or retry. The raw
   * `Response` comes back untouched (the body is never read), so streams such as SSE work.
   */
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

/** Where the shell proxies an addon's UI container, and with it the `/api/` of its nginx. */
export function addonApiBasePath(addonId: string): string {
  return `/addon-assets/${encodeURIComponent(addonId)}/api`;
}

const HAS_SCHEME = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

/**
 * Resolves `path` below `base` (from addonApiBasePath, no trailing slash) on `origin`. `base` is
 * path-absolute, so once schemes and `//` are refused the origin cannot change. The check runs on the parsed URL, which has already
 * resolved `..` and `%2e%2e`, so every spelling of a path is covered. It then also looks at the
 * decoded rest of the path: nginx decodes percent escapes before it resolves `..`, so `..%2f`
 * would climb out of the base there although the URL parser keeps it as one segment.
 */
export function resolveAddonApiUrl(base: string, path: string, origin: string): URL {
  if (HAS_SCHEME.test(path) || path.startsWith('//')) {
    throw new Error(
      `useAddonApi().fetch takes a path below ${base}/, not a URL ("${path}"). It attaches the ` +
        `user's token, so it only calls the addon's own backend. Pass e.g. "/runs".`,
    );
  }
  const root = new URL(`${base}/`, origin).pathname;
  const url = new URL(`${base}/${path.replace(/^\/+/, '')}`, origin);
  if (!isBelow(url.pathname, root)) {
    throw new Error(
      `useAddonApi().fetch refuses "${path}": it resolves to ${url.pathname}, outside ${root}. ` +
        `Paths are relative to ${base}; ".." cannot leave it.`,
    );
  }
  return url;
}

function isBelow(pathname: string, root: string): boolean {
  if (!pathname.startsWith(root)) return false;
  // Byte by byte rather than decodeURIComponent, which throws on escapes that are not UTF-8.
  const decoded = pathname
    .slice(root.length)
    .replace(/%([\da-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return !decoded.split(/[/\\]/).includes('..');
}

export function createAddonApi(
  baseUrl: string,
  send: (request: Request) => Promise<Response>,
): AddonApi {
  return {
    baseUrl,
    // async so a refused URL is a rejected promise like any other failed fetch, not a sync throw.
    fetch: async (path, init) => {
      const url = resolveAddonApiUrl(baseUrl, path, globalThis.location.origin);
      return send(new Request(url, init));
    },
  };
}
