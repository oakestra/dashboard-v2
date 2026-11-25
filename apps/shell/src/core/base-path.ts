/*
 * The site's base path is `/` everywhere except the static demo, which GitHub Pages serves below the
 * repository name (`/dashboard-v2/`). Vite sets `BASE_URL` from `base` at build time.
 */

/**
 * A file the site serves itself (config, brand images, addon remotes) under the base path.
 * `path` is root-relative as it would be without a base: `/config.json`.
 */
export function sitePath(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

/** The router's basename: the base path without its trailing slash, undefined at the root. */
export function routerBasename(): string | undefined {
  const trimmed = import.meta.env.BASE_URL.replace(/\/$/, '');
  return trimmed === '' ? undefined : trimmed;
}
