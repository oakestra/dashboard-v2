import {
  EXTENSION_POINT_IDS,
  type AddonDefinition,
  type AddonRoute,
  type ExtensionPointId,
} from '@oakestra/dashboard-sdk';
import { z } from 'zod';

// React components are functions, or objects tagged with $$typeof (memo, forwardRef, lazy).
const reactComponent = z.custom<NonNullable<AddonRoute['Component']>>(
  (value) =>
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value),
  'must be a React component',
);

const callable = z.custom<(...args: never[]) => unknown>(
  (value) => typeof value === 'function',
  'must be a function',
);

const contributionBase = z.object({
  id: z.string().min(1),
  order: z.number().finite().optional(),
  roles: z.array(z.string()).optional(),
});

const renderable = contributionBase.extend({
  component: reactComponent,
  visible: callable.optional(),
});

const navItem = contributionBase.extend({
  label: z.string().min(1),
  // Addon nav paths are relative to the addon base path; an absolute path would escape it.
  path: z.string().refine((path) => !path.startsWith('/') && !/^[a-z]+:/i.test(path), {
    message: 'must be relative to the addon base path',
  }),
  icon: reactComponent.optional(),
  group: z.enum(['main', 'management', 'addons']).optional(),
});

const widget = renderable.extend({ title: z.string().min(1) });
const tab = renderable.extend({ label: z.string().min(1) });
const panel = renderable.extend({ title: z.string().min(1), description: z.string().optional() });

const pointSchemas = {
  'nav.items': navItem,
  'home.widgets': widget,
  'application.detail.tabs': tab,
  'service.detail.tabs': tab,
  'cluster.widgets': widget,
  'settings.panels': panel,
} satisfies Record<ExtensionPointId, z.ZodType>;

const uniqueIds = (items: readonly { id: string }[], ctx: z.RefinementCtx) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      ctx.addIssue({ code: 'custom', message: `duplicate id "${item.id}"`, path: [index, 'id'] });
    }
    seen.add(item.id);
  });
};

const contributionsSchema = z.object(
  Object.fromEntries(
    EXTENSION_POINT_IDS.map((point) => [
      point,
      z.array(pointSchemas[point]).superRefine(uniqueIds).optional(),
    ]),
  ) as { [P in ExtensionPointId]: z.ZodOptional<z.ZodArray<(typeof pointSchemas)[P]>> },
);

const routeSchema: z.ZodType<AddonRoute> = z.lazy(() =>
  z.object({
    path: z
      .string()
      .refine((path) => !path.startsWith('/'), 'must be relative to the addon base path')
      .optional(),
    index: z.boolean().optional(),
    Component: reactComponent.optional(),
    children: z.array(routeSchema).optional(),
  }),
);

const definitionSchema = z.object({
  id: z.string().min(1),
  routes: z.array(routeSchema).optional(),
  contributions: contributionsSchema.optional(),
});

export class AddonDefinitionError extends Error {
  override name = 'AddonDefinitionError';
}

/**
 * Validates what an addon's `./addon` module exported. Anything that would make the shell crash
 * later (missing components, wrong id, duplicate ids) is turned into an AddonDefinitionError here,
 * so the addon ends up as a `failed` registry entry instead.
 *
 * Unknown extension points are dropped with a warning: they may come from a newer SDK minor that
 * this shell does not render yet, which is not a reason to reject the whole addon.
 */
export function parseAddonDefinition(module: unknown, expectedId: string): AddonDefinition {
  const candidate =
    typeof module === 'object' && module !== null && 'default' in module ? module.default : module;

  if (typeof candidate !== 'object' || candidate === null) {
    throw new AddonDefinitionError('./addon has no default export with an addon definition');
  }

  const contributions = (candidate as { contributions?: unknown }).contributions;
  if (typeof contributions === 'object' && contributions !== null) {
    const unknownPoints = Object.keys(contributions).filter(
      (point) => !(EXTENSION_POINT_IDS as readonly string[]).includes(point),
    );
    if (unknownPoints.length > 0) {
      console.warn(`[addons] ${expectedId}: ignoring unknown extension points`, unknownPoints);
    }
  }

  const result = definitionSchema.safeParse(candidate);
  if (!result.success) {
    throw new AddonDefinitionError(`Invalid addon definition: ${z.prettifyError(result.error)}`);
  }
  if (result.data.id !== expectedId) {
    throw new AddonDefinitionError(
      `Addon definition id "${result.data.id}" does not match the addon name "${expectedId}"`,
    );
  }
  return result.data as AddonDefinition;
}
