import semver from 'semver';
import { z } from 'zod';

import { list } from './common.ts';

/**
 * Addon management models. The addons-manager (installed addons) and the marketplace-manager
 * (addon definitions) are separate backends, see `endpoints/addons.ts`.
 */

/** Lifecycle of an installed addon, in the order a typical install and removal pass through. */
export const ADDON_STATUSES = [
  'installing',
  'active',
  'partially_active',
  'failed',
  'disabling',
  'disabled',
] as const;
export type AddonStatus = (typeof ADDON_STATUSES)[number];

/** `installing` and `disabling` end on their own; UIs poll while an addon is in one of them. */
export const TRANSITIONAL_ADDON_STATUSES = ['installing', 'disabling'] as const;
export type TransitionalAddonStatus = (typeof TRANSITIONAL_ADDON_STATUSES)[number];

export function isTransitionalAddonStatus(status: string): status is TransitionalAddonStatus {
  return (TRANSITIONAL_ADDON_STATUSES as readonly string[]).includes(status);
}

/** Review state of a marketplace definition. The backend lists approved ones only. */
export const MARKETPLACE_ADDON_STATUSES = [
  'under_review',
  'approved',
  'verification_failed',
] as const;
export type MarketplaceAddonStatus = (typeof MARKETPLACE_ADDON_STATUSES)[number];

const stringMap = z
  .record(z.string(), z.string())
  .nullish()
  .transform((value) => value ?? {});

export const addonServiceSchema = z.looseObject({
  service_name: z.string(),
  image: z.string(),
  command: z.string().nullish(),
  networks: list(z.string()),
  /** `host:container` bind mounts or `volume:container` mounts. */
  volumes: list(z.string()),
  /** `{ "host port": "container port" }` as the backend documents it. */
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

/**
 * Optional UI block of a definition: which service serves the addon's micro frontend and the SDK
 * range it was built against. Planned backend feature, absent from today's marketplace.
 */
export const addonUiSchema = z.looseObject({
  service: z.string(),
  sdk: z.string(),
});
export type AddonUi = z.infer<typeof addonUiSchema>;

const description = z
  .string()
  .nullish()
  .transform((value) => value ?? '');

export const marketplaceAddonSchema = z.looseObject({
  _id: z.string(),
  name: z.string(),
  description,
  services: list(addonServiceSchema),
  volumes: list(addonVolumeSchema),
  networks: list(addonNetworkSchema),
  status: z.enum(MARKETPLACE_ADDON_STATUSES).optional(),
  ui: addonUiSchema.nullish().transform((ui) => ui ?? undefined),
});
export type MarketplaceAddon = z.infer<typeof marketplaceAddonSchema>;

export const installedAddonSchema = z.looseObject({
  _id: z.string(),
  marketplace_id: z.string(),
  name: z.string(),
  description,
  services: list(addonServiceSchema),
  volumes: list(addonVolumeSchema),
  networks: list(addonNetworkSchema),
  status: z.enum(ADDON_STATUSES),
  status_details: z
    .looseObject({ failed_services: list(z.string()) })
    .nullish()
    .transform((details) => details ?? undefined),
  /** Free text written by the addons monitor, usually about why an install failed. */
  logs: z
    .union([z.string(), z.array(z.string())])
    .nullish()
    .transform((logs) => (Array.isArray(logs) ? logs.join('\n') : (logs ?? undefined))),
});
export type InstalledAddon = z.infer<typeof installedAddonSchema>;

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);
const stringRecord = z.record(z.string(), z.string());

/** Request body for registering a definition at the marketplace (`POST /marketplace/addons`). */
export const registerAddonInputSchema = z
  .object({
    name: nonEmpty('Name'),
    description: z.string().optional(),
    services: z
      .array(
        z.object({
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
        z.object({
          name: nonEmpty('Volume name'),
          driver: z.string().optional(),
          driver_opts: stringRecord.optional(),
          labels: stringRecord.optional(),
        }),
      )
      .optional(),
    networks: z
      .array(
        z.object({
          name: nonEmpty('Network name'),
          driver: z.string().optional(),
          enable_ipv6: z.boolean().optional(),
        }),
      )
      .optional(),
    ui: z
      .object({
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
