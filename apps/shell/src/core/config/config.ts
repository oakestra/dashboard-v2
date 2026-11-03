import { z } from 'zod';

/**
 * Optional absolute URL. The container template renders unset variables as `""`, which means
 * "not configured" rather than "invalid".
 */
const optionalUrl = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.url({ protocol: /^https?$/ }).optional(),
);

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
  /** Deployment preset (see preset.ts), a same-origin path or a URL. Unset means the defaults. */
  presetUrl: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.string().min(1).optional(),
  ),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

export async function loadConfig(url = '/config.json'): Promise<AppConfig> {
  let raw: unknown;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new ConfigError(`${url} returned HTTP ${response.status}`);
    raw = await response.json();
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError(`Could not load ${url}: ${String(error)}`, { cause: error });
  }

  const result = appConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(`${url} is invalid: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
