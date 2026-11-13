import semver from 'semver';
import { z } from 'zod';

import { list, optionalString } from './common.ts';

/**
 * Addon management models. The addons-manager (installed addons) and the marketplace-manager
 * (catalog of addon definitions and their sources) are separate backends, see
 * `endpoints/addons.ts`.
 */

/** Lifecycle of an installed addon, in the order a typical install and removal pass through. */
export const ADDON_STATUSES = [
  'installing',
  'updating',
  'active',
  'partially_active',
  'failed',
  'disabling',
  'disabled',
] as const;
export type AddonStatus = (typeof ADDON_STATUSES)[number];

/** These end on their own (the reconcile loop moves them); UIs poll while an addon is in one. */
export const TRANSITIONAL_ADDON_STATUSES = ['installing', 'updating', 'disabling'] as const;
export type TransitionalAddonStatus = (typeof TRANSITIONAL_ADDON_STATUSES)[number];

export function isTransitionalAddonStatus(status: string): status is TransitionalAddonStatus {
  return (TRANSITIONAL_ADDON_STATUSES as readonly string[]).includes(status);
}

/** Running, but not as asked: the addon needs someone to look at it. */
export const PROBLEM_ADDON_STATUSES = ['partially_active', 'failed'] as const;
export type ProblemAddonStatus = (typeof PROBLEM_ADDON_STATUSES)[number];

export function isProblemAddonStatus(status: string): status is ProblemAddonStatus {
  return (PROBLEM_ADDON_STATUSES as readonly string[]).includes(status);
}

/**
 * Where a definition comes from: the curated `official` index, a third-party `tap` an admin
 * added, or a `local` registration on this marketplace.
 */
export const ADDON_SOURCE_KINDS = ['official', 'tap', 'local'] as const;
export type AddonSourceKind = (typeof ADDON_SOURCE_KINDS)[number];

export const addonSourceRefSchema = z.looseObject({
  kind: z.enum(ADDON_SOURCE_KINDS),
  /** `official`, `local` or the tap name. */
  name: z.string(),
});
export type AddonSourceRef = z.infer<typeof addonSourceRefSchema>;

const stringMap = z
  .record(z.string(), z.string())
  .nullish()
  .transform((value) => value ?? {});

const flag = z
  .boolean()
  .nullish()
  .transform((value) => value ?? false);

/**
 * The risky capabilities of an addon. A definition declares them, the admin accepts them with the
 * whole definition, and an installed addon reports what was granted.
 */
export const addonPermissionsSchema = z.looseObject({
  /** Host bind mount sources, `/path` or `/path:ro`. */
  host_paths: list(z.string()),
  host_ports: list(z.number()),
  /** Root on the host. */
  docker_socket: flag,
  /** Mounting root-equivalent host paths such as `/etc` or `/var/lib/docker`. */
  host_root: flag,
  host_network: flag,
  /** Joining the `oakestra` network, where Mongo, Redis and core APIs need no authentication. */
  core_network: flag,
});
export type AddonPermissions = z.infer<typeof addonPermissionsSchema>;

/** Old payloads and missing blocks mean "nothing granted". */
const permissions = addonPermissionsSchema.nullish().transform(
  (value): AddonPermissions =>
    value ?? {
      host_paths: [],
      host_ports: [],
      docker_socket: false,
      host_root: false,
      host_network: false,
      core_network: false,
    },
);

export const addonServiceSchema = z.looseObject({
  service_name: z.string(),
  image: z.string(),
  command: z.string().nullish(),
  networks: list(z.string()),
  /** `host:container[:ro]` bind mounts, `volume:container` mounts or `/container`. */
  volumes: list(z.string()),
  /** `{ "container port[/proto]": "host port" }`. */
  ports: stringMap,
  /**
   * Values may be secrets (tokens, passwords). The UI shows the keys only and never renders or
   * logs a value; they stay in the model because the backend returns them and a registration
   * round trip must not lose them.
   */
  environment: stringMap,
  labels: stringMap,
});
export type AddonService = z.infer<typeof addonServiceSchema>;

export const addonVolumeSchema = z.looseObject({
  name: z.string(),
  driver: z.string().nullish(),
  driver_opts: stringMap,
  labels: stringMap,
});
export type AddonVolume = z.infer<typeof addonVolumeSchema>;

export const addonNetworkSchema = z.looseObject({
  name: z.string(),
  driver: z.string().nullish(),
  enable_ipv6: z.boolean().nullish(),
});
export type AddonNetwork = z.infer<typeof addonNetworkSchema>;

/** Optional UI block: which service serves the addon's micro frontend and its SDK range. */
export const addonUiSchema = z.looseObject({
  service: z.string(),
  sdk: z.string(),
});
export type AddonUi = z.infer<typeof addonUiSchema>;

const description = z
  .string()
  .nullish()
  .transform((value) => value ?? '');

/**
 * A display field the engine never acts on. Catalogs are third-party input, so a malformed value
 * is dropped instead of hiding the whole addon.
 */
const displayString = z
  .string()
  .nullish()
  .catch(undefined)
  .transform((value) => value?.trim() || undefined);

const definitionFields = {
  version: z.string(),
  description,
  homepage: optionalString,
  maintainers: list(z.string()),
  /** Name for people, up to 64 characters. Not unique: `qualified_name` is what identifies it. */
  display_name: displayString,
  /** Single, lowercase (`ai tools`): the main catalog filter. */
  category: displayString,
  /** Up to 8, lowercase, sorted. */
  tags: z
    .array(z.string())
    .nullish()
    .catch(undefined)
    .transform((tags) => tags ?? []),
  /**
   * `https` URL of an image on a third-party host. Only ever an `<img src>` with
   * `referrerpolicy="no-referrer"`, so the dashboard URL does not end up in that host's logs.
   */
  icon: displayString,
  services: list(addonServiceSchema),
  volumes: list(addonVolumeSchema),
  networks: list(addonNetworkSchema),
  permissions,
  ui: addonUiSchema.nullish().transform((ui) => ui ?? undefined),
};

/**
 * One addon of the merged catalog. Identified by its source and bare `name` (the path of
 * `GET /addons/<source>/<name>`), shown as `qualified_name` (`name`, `<tap>/name`, `local/name`).
 */
export const marketplaceAddonSchema = z.looseObject({
  name: z.string(),
  qualified_name: z.string(),
  /** DNS-safe id (`name`, `<tap>--name`, `local--name`), the name in `/ui-addons`. */
  id: z.string(),
  source: addonSourceRefSchema,
  ...definitionFields,
  /** What the services actually use, derived by the marketplace. */
  required_permissions: permissions,
});
export type MarketplaceAddon = z.infer<typeof marketplaceAddonSchema>;

export const installedAddonSchema = z.looseObject({
  _id: z.string(),
  /** The qualified name, like `qualified_name`. */
  name: z.string(),
  qualified_name: z.string(),
  /** DNS-safe id of the definition, the name in `/ui-addons` and of the `addonui-<id>` alias. */
  addon_id: z.string(),
  source: addonSourceRefSchema,
  ...definitionFields,
  /** What the admin granted, which is what the containers may use. */
  permissions,
  status: z.enum(ADDON_STATUSES),
  status_details: z
    .looseObject({ failed_services: list(z.string()), message: optionalString })
    .nullish()
    .transform((details) => details ?? undefined),
  /** Container output, sent to admins only. */
  logs: z
    .union([z.string(), z.array(z.string())])
    .nullish()
    .transform((logs) => (Array.isArray(logs) ? logs.join('\n') : logs || undefined)),
  /** A newer version than the installed one was listed at the last update check. */
  update_available: flag,
  latest_version: optionalString,
  created_at: optionalString,
  updated_at: optionalString,
});
export type InstalledAddon = z.infer<typeof installedAddonSchema>;

/** One entry of `GET /marketplace/categories`: a category and how many addons it has. */
export const marketplaceCategorySchema = z.looseObject({
  name: z.string(),
  count: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
});
export type MarketplaceCategory = z.infer<typeof marketplaceCategorySchema>;

/** A catalog source as the marketplace lists it. Credentials are never returned, only `has_token`. */
export const marketplaceSourceSchema = z.looseObject({
  name: z.string(),
  kind: z.enum(ADDON_SOURCE_KINDS),
  /** Query string redacted by the backend. Empty for the local source. */
  url: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
  has_token: flag,
  allow_insecure: flag,
  allow_private: flag,
  /** False for the local source and for an official source that is switched off. */
  sync_enabled: flag,
  /** Only taps can be deleted. */
  deletable: flag,
  created_at: optionalString,
  last_attempt_at: optionalString,
  last_synced_at: optionalString,
  /** Why the last fetch failed; the last good snapshot stays listed. Empty means none. */
  last_error: z
    .string()
    .nullish()
    .transform((value) => value || undefined),
  serial: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
  generated_at: optionalString,
  addon_count: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
});
export type MarketplaceSource = z.infer<typeof marketplaceSourceSchema>;

/**
 * A definition as the addons-manager stores it (images pinned by digest, permissions canonical):
 * what the admin accepts by echoing `definition_hash`.
 */
export const addonDefinitionSchema = z.looseObject({
  name: z.string(),
  source: addonSourceRefSchema.optional(),
  ...definitionFields,
});
export type AddonDefinition = z.infer<typeof addonDefinitionSchema>;

/**
 * `code` of an addons engine error body (`{code, message, errors?}`). Branch on it instead of the
 * status: a 409 alone can mean six different things.
 */
export const ADDON_ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'auth_unavailable',
  'not_found',
  'method_not_allowed',
  'validation_failed',
  'payload_too_large',
  'confirmation_required',
  'already_installed',
  'host_path_conflict',
  'no_update_available',
  'busy',
  'conflict',
  'sync_failed',
  'marketplace_unavailable',
  'internal_error',
] as const;
export type AddonErrorCode = (typeof ADDON_ERROR_CODES)[number];

/**
 * Body of the addons-manager's 409 `confirmation_required` (install, every update, approve).
 * Repeating the call with `definition_hash` accepts exactly `definition`.
 */
export const consentRequiredBodySchema = z.looseObject({
  code: z.literal('confirmation_required'),
  message: optionalString,
  definition: addonDefinitionSchema,
  definition_hash: z.string().min(1),
  permissions: addonPermissionsSchema,
  /** Updates only: the installed version, what it was granted and whether the new one asks more. */
  previous_version: optionalString,
  previous_permissions: addonPermissionsSchema.optional(),
  permissions_grow: z.boolean().optional(),
});

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);
const stringRecord = z.record(z.string(), z.string());

/**
 * Request body for a local registration (`POST /marketplace/addons`). Objects are loose on
 * purpose: the marketplace decodes strictly and names unknown fields (`privileged`, `cap_add`),
 * which tells the author more than dropping them here would.
 */
export const registerAddonInputSchema = z
  .looseObject({
    name: nonEmpty('Name'),
    version: z.string().refine((version) => semver.valid(version) === version, {
      message: 'Not a semantic version, e.g. 1.0.0',
    }),
    description: z.string().optional(),
    homepage: z.string().optional(),
    maintainers: z.array(z.string()).optional(),
    services: z
      .array(
        z.looseObject({
          service_name: nonEmpty('Service name'),
          image: nonEmpty('Image'),
          command: z.string().optional(),
          networks: z.array(z.string()).optional(),
          volumes: z.array(z.string()).optional(),
          ports: stringRecord.optional(),
          /** Values may be secrets: never display them after entry. */
          environment: stringRecord.optional(),
          labels: stringRecord.optional(),
        }),
      )
      .min(1, 'At least one service is required'),
    volumes: z
      .array(
        z.looseObject({
          name: nonEmpty('Volume name'),
          driver: z.string().optional(),
          driver_opts: stringRecord.optional(),
          labels: stringRecord.optional(),
        }),
      )
      .optional(),
    networks: z
      .array(
        z.looseObject({
          name: nonEmpty('Network name'),
          driver: z.string().optional(),
          enable_ipv6: z.boolean().optional(),
        }),
      )
      .optional(),
    permissions: z
      .looseObject({
        host_paths: z.array(z.string()).optional(),
        host_ports: z.array(z.number().int()).optional(),
        docker_socket: z.boolean().optional(),
        host_root: z.boolean().optional(),
        host_network: z.boolean().optional(),
        core_network: z.boolean().optional(),
      })
      .optional(),
    ui: z
      .looseObject({
        service: nonEmpty('UI service'),
        sdk: z.string().refine((range) => semver.validRange(range) !== null, {
          message: 'Not a valid semver range, e.g. ^0.1.0',
        }),
      })
      .optional(),
  })
  .superRefine((input, ctx) => {
    if (input.ui && !input.services.some((service) => service.service_name === input.ui?.service)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ui', 'service'],
        message: 'The UI service must be one of the addon services',
      });
    }
  });
export type RegisterAddonInput = z.input<typeof registerAddonInputSchema>;

/** Request body for adding a tap (`POST /marketplace/sources`). */
export const addTapInputSchema = z.object({
  /** Becomes the namespace of its addons (`<name>/<addon>`). */
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/, {
      message: 'Lowercase letters, digits and hyphens, at most 32 characters',
    }),
  url: z.string().trim().min(1, 'URL is required'),
  /** Sent as a bearer token when fetching the index; never returned by the API. */
  token: z.string().optional(),
  /** Allow plain http. */
  allow_insecure: z.boolean().optional(),
  /** Allow private, loopback and link-local addresses. */
  allow_private: z.boolean().optional(),
});
export type AddTapInput = z.input<typeof addTapInputSchema>;
