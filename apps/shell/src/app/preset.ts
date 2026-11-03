import type { RouteObject } from 'react-router';

import type { LinkedAddon } from '../core/addons/linked-addons';
import { ConfigError } from '../core/config/config';
import type { Preset } from '../core/config/preset';
import type { CoreModule } from '../core/modules';
import { ALWAYS_ENABLED_MODULES, selectLinkedAddons, selectModules } from './modules';
import { addonMounts, createAppRoutes, ownsIndexRoute } from './router';

export interface AppliedPreset {
  /** The enabled modules, for the services and the router. */
  modules: CoreModule[];
  /** The enabled linked addons, minus those a preset addon replaces. */
  linked: LinkedAddon[];
  /**
   * The preset with the always enabled modules listed, so useModuleEnabled agrees with it, and
   * with the mount of a linked addon on the preset addon that replaces it (unless it sets one).
   */
  preset: Preset;
}

/**
 * Checks a preset against the built-in modules and linked addons and selects the enabled ones.
 * Everything wrong with it throws a ConfigError, which bootstrap shows instead of a half working
 * dashboard: a typo in a module id would otherwise silently drop a feature.
 */
export function applyPreset(
  allModules: readonly CoreModule[],
  allLinked: readonly LinkedAddon[],
  rawPreset: Preset,
): AppliedPreset {
  const linkedByName = new Map(allLinked.map((addon) => [addon.definition.id, addon]));
  const coreIds = new Set(allModules.map((module) => module.id));
  const known = new Set([...coreIds, ...linkedByName.keys()]);
  const problems: string[] = [];

  const unknown = (rawPreset.modules ?? []).filter((id) => !known.has(id));
  if (unknown.length > 0) {
    problems.push(
      `unknown modules ${unknown.map((id) => `"${id}"`).join(', ')} (known: ${[...known].join(', ')})`,
    );
  }

  // Addon names and module ids share one namespace (nav keys, useModuleEnabled). A linked addon is
  // an addon too, so a preset may swap it for another build; a core module has no such seam.
  for (const addon of rawPreset.addons) {
    if (coreIds.has(addon.name)) {
      problems.push(`addon "${addon.name}" has the id of a built-in module`);
    }
  }

  // The replacement takes over the linked addon's URL, so links and bookmarks keep working.
  const preset: Preset = {
    ...rawPreset,
    addons: rawPreset.addons.map((addon) => {
      const linked = linkedByName.get(addon.name);
      return linked && !addon.mount ? { ...addon, mount: linked.mount } : addon;
    }),
  };

  const modules = selectModules(allModules, preset);
  const linked = selectLinkedAddons(allLinked, preset);
  if (!preset.home && !ownsIndexRoute(modules.flatMap((module) => module.routes))) {
    problems.push('"home" is required when no enabled module provides the start page');
  }

  const paths = routePaths(createAppRoutes(modules, { ...preset, addons: [] }));
  const mounts = addonMounts(linked, preset.addons);
  mounts.forEach(({ name, mount }, index) => {
    const taken = paths.find((path) => overlaps(mount, path));
    if (taken) {
      problems.push(`mount "${mount}" of addon "${name}" overlaps the route "${taken}"`);
    }
    // Equal mounts of two preset addons are already rejected by the schema.
    for (const other of mounts.slice(index + 1)) {
      if (overlaps(mount, `${other.mount}/*`)) {
        problems.push(
          `mount "${mount}" of addon "${name}" overlaps the mount "${other.mount}" of addon "${other.name}"`,
        );
      }
    }
  });

  if (problems.length > 0) {
    throw new ConfigError(`The preset is invalid:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  }
  return {
    modules,
    linked,
    preset: preset.modules
      ? {
          ...preset,
          modules: [...new Set([...ALWAYS_ENABLED_MODULES, ...preset.modules])],
        }
      : preset,
  };
}

/** Full path pattern of every route that can render a page, e.g. `/applications/:appId`. */
function routePaths(routes: readonly RouteObject[], parent = ''): string[] {
  return routes.flatMap((route) => {
    const path =
      route.path === undefined
        ? parent
        : route.path.startsWith('/')
          ? route.path
          : `${parent.replace(/\/$/, '')}/${route.path}`;
    const own = route.index || route.path !== undefined ? [path || '/'] : [];
    return [...own, ...routePaths(route.children ?? [], path)];
  });
}

/**
 * Whether the route pattern `path` would answer the mount or a page below it. The mount route is
 * `${mount}/*`, so any route that reaches into that subtree would win or lose against it depending
 * on react-router's ranking. The top-level `*` (the 404 page) is the only route allowed to.
 */
function overlaps(mount: string, path: string): boolean {
  const routeSegments = path.split('/').filter(Boolean);
  if (routeSegments.length === 1 && routeSegments[0] === '*') return false;
  const mountSegments = mount.split('/').filter(Boolean);
  for (const [index, segment] of mountSegments.entries()) {
    const routeSegment = routeSegments[index];
    // The route ends above the mount, so it cannot reach into it.
    if (routeSegment === undefined) return false;
    if (routeSegment === '*') return true;
    if (routeSegment.startsWith(':')) continue;
    if (routeSegment.replace(/\?$/, '').toLowerCase() !== segment) return false;
  }
  return true;
}
