import { z } from 'zod';

import { navGroupSchema } from '../addons/definition';
import { ADDON_NAME_PATTERN, uiAddonSchema } from '../addons/ui-addons';
import { fetchConfigFile, parseConfigFile } from './config';

/**
 * Plain static segments only: a mount becomes a react-router path, where `:x` or `*` would turn
 * it into a pattern, and the collision check against module routes assumes literal segments.
 */
const MOUNT_PATTERN = /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;

const DUMMY_ORIGIN = 'http://preset.invalid';

/**
 * The parsed form of a same-origin path, or undefined when it is not one. Checked by parsing, as
 * the browser would: `//host` and `/\\host` both start with "/" but resolve to another origin.
 */
function parseLocalPath(value: string): URL | undefined {
  if (!value.startsWith('/') || value.includes('\\')) return undefined;
  try {
    const url = new URL(value, DUMMY_ORIGIN);
    return url.origin === DUMMY_ORIGIN ? url : undefined;
  } catch {
    return undefined;
  }
}

/** Same-origin paths or absolute http(s) URLs. */
const entrySchema = z.string().refine((value) => {
  if (parseLocalPath(value)) return true;
  if (!/^https?:\/\//.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}, 'must be an absolute http(s) URL or a path starting with "/" that stays on this origin');

const presetAddonSchema = z.strictObject({
  ...uiAddonSchema.shape,
  entry: entrySchema.describe("Manifest URL (mf-manifest.json) of the addon's remote."),
  mount: z
    .string()
    .regex(MOUNT_PATTERN, 'must be a path like "/billing" (lowercase letters, digits, hyphens)')
    .optional()
    .describe('Top-level path to serve the addon at instead of /addons/<name>, e.g. /billing.'),
});

const navOverrideSchema = z.strictObject({
  label: z.string().min(1).optional(),
  order: z.number().optional(),
  group: navGroupSchema.optional(),
  hidden: z
    .boolean()
    .optional()
    .describe('Hides the link only. The pages stay reachable; leave out the module to remove it.'),
});

/**
 * Deployment preset served next to `config.json` (see `presetUrl`). It picks the built-in modules,
 * adds addons that ship with the deployment and adjusts the sidebar. Strict objects throughout, so
 * a misspelled key fails at startup instead of being ignored.
 *
 * Module ids are checked against the built-in modules in app/preset.ts, because core does not know
 * the features.
 */
export const presetSchema = z
  .strictObject({
    // Lets a preset.json point editors at preset.schema.json.
    $schema: z.string().optional(),
    modules: z
      .array(z.string().regex(ADDON_NAME_PATTERN))
      .refine((ids) => new Set(ids).size === ids.length, 'must not list a module twice')
      .optional()
      .describe('Built-in modules to enable, by id. Omitted means all of them; auth is always on.'),
    home: z
      .string()
      .refine((value) => parseLocalPath(value) !== undefined, 'must be a path starting with "/"')
      // `/` redirecting to `/` would loop forever in the index route.
      .refine(
        (value) => parseLocalPath(value)?.pathname !== '/',
        'must not be "/" itself, which would redirect to itself: name the page to start on',
      )
      .optional()
      .describe('Where / redirects when no enabled module owns the start page (overview).'),
    addonDiscovery: z
      .boolean()
      .default(true)
      .describe('false stops polling /ui-addons, for deployments without the addons-manager.'),
    addons: z
      .array(presetAddonSchema)
      .default([])
      .describe('Addons that ship with the deployment, loaded without the addons-manager.'),
    nav: z
      .strictObject({
        groupLabels: z
          .partialRecord(navGroupSchema, z.string().min(1))
          .default({})
          .describe('Labels of the sidebar groups, e.g. { "main": "Workloads" }.'),
        // Unknown keys only warn (later, in the nav model), since addons load late or not at all.
        items: z
          .record(z.string(), navOverrideSchema)
          .default({})
          .describe(
            'Overrides of top-level nav items, keyed kind:sourceId:itemId, e.g. core:settings:settings.',
          ),
      })
      .prefault({}),
  })
  .superRefine((preset, ctx) => {
    const names = new Set<string>();
    const mounts = new Set<string>();
    preset.addons.forEach((addon, index) => {
      if (names.has(addon.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['addons', index, 'name'],
          message: `addon "${addon.name}" is listed twice`,
        });
      }
      names.add(addon.name);
      if (!addon.mount) return;
      // react-router matches case-insensitively, but MOUNT_PATTERN already rules out upper case.
      if (mounts.has(addon.mount)) {
        ctx.addIssue({
          code: 'custom',
          path: ['addons', index, 'mount'],
          message: `mount "${addon.mount}" is used by another addon`,
        });
      }
      mounts.add(addon.mount);
    });
  });

export type Preset = z.infer<typeof presetSchema>;
export type PresetInput = z.input<typeof presetSchema>;
export type PresetAddon = Preset['addons'][number];
export type NavOverride = z.infer<typeof navOverrideSchema>;

/** No preset: every module, addons from `/ui-addons` only, the sidebar as the modules declare it. */
export const DEFAULT_PRESET: Preset = presetSchema.parse({});

export function parsePreset(raw: unknown, source = 'preset'): Preset {
  return parseConfigFile(presetSchema, raw, source);
}

/** Loads the preset `config.presetUrl` points at, or the default when none is configured. */
export async function loadPreset(url: string | undefined): Promise<Preset> {
  return url ? fetchConfigFile(presetSchema, url) : DEFAULT_PRESET;
}
