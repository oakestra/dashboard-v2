import { z } from 'zod';

/**
 * The container template renders unset variables as `""`, which means "not configured" rather
 * than "invalid".
 */
function emptyAsUnset<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    schema.optional(),
  );
}

const optionalUrl = emptyAsUnset(z.url({ protocol: /^https?$/ }));

/**
 * Runtime configuration served as `/config.json`.
 *
 * In production the container entrypoint renders it from environment variables, so one image works
 * for every deployment.
 */
export const appConfigSchema = z.object({
  /** Base URL of the system-manager API, including the `/api` prefix. */
  apiUrl: z.string().min(1),
  uiAddonsUrl: z.string().min(1).default('/ui-addons'),
  addonsPollIntervalMs: z.coerce.number().int().min(1000).default(15_000),
  /** Shown as an external link in the navigation when set. */
  grafanaUrl: optionalUrl,
  /** Base URL of the addons-manager (installed addons); nginx proxies it to `/api/v1/addons`. */
  addonsManagerUrl: z.string().min(1).default('/addons-api'),
  /** Base URL of the marketplace-manager (addon definitions), proxied to `/api/v1/marketplace/addons`. */
  marketplaceUrl: z.string().min(1).default('/marketplace-api'),
  /**
   * MapLibre style of the basemap, for deployments that serve their own tiles. Unset means the
   * public default, see mapStylesFromConfig.
   */
  mapStyleUrl: optionalUrl,
  /** The same for the dark theme; without it the dark theme uses `mapStyleUrl` as well. */
  mapStyleDarkUrl: optionalUrl,
  /** Deployment preset (see preset.ts), a same-origin path or a URL. Unset means the defaults. */
  presetUrl: emptyAsUnset(z.string().min(1)),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

/**
 * The basemap a deployment configured, if any. One configured style serves both themes: filling
 * the other from the public default would send a self-hosted deployment's viewers to a third party
 * as soon as they switch themes.
 */
export function mapStylesFromConfig(
  config: Pick<AppConfig, 'mapStyleUrl' | 'mapStyleDarkUrl'>,
): { light: string; dark: string } | undefined {
  const light = config.mapStyleUrl ?? config.mapStyleDarkUrl;
  const dark = config.mapStyleDarkUrl ?? config.mapStyleUrl;
  return light && dark ? { light, dark } : undefined;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Parses a runtime file, throwing a ConfigError that names `source` and every problem. */
export function parseConfigFile<T extends z.ZodType>(
  schema: T,
  raw: unknown,
  source: string,
): z.output<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(`${source} is invalid: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Fetches and parses a runtime file (config.json, preset.json), bypassing the HTTP cache. */
export async function fetchConfigFile<T extends z.ZodType>(
  schema: T,
  url: string,
): Promise<z.output<T>> {
  let raw: unknown;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new ConfigError(`${url} returned HTTP ${response.status}`);
    raw = await response.json();
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError(`Could not load ${url}: ${String(error)}`, { cause: error });
  }
  return parseConfigFile(schema, raw, url);
}

export function loadConfig(url = '/config.json'): Promise<AppConfig> {
  return fetchConfigFile(appConfigSchema, url);
}
