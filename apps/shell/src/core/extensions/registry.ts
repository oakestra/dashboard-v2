import {
  hasAnyRole,
  type AddonContextValue,
  type Contributions,
  type CurrentUser,
  type ExtensionPointId,
  type ExtensionPoints,
} from '@oakestra/dashboard-sdk';
import { createStore, type StoreApi } from 'zustand/vanilla';

/**
 * Where a set of contributions came from. Core feature modules and addons go through the same
 * registry, so nav, slots and permission filtering never need to special-case either of them.
 */
export type ContributionSource =
  | { kind: 'core'; id: string; label: string }
  | { kind: 'addon'; id: string; label: string; addon: AddonContextValue };

export interface RegisteredSource {
  source: ContributionSource;
  contributions: Contributions;
  /** Registration order, used as the last sort key so equal `order`s stay stable. */
  sequence: number;
}

export interface ResolvedContribution<P extends ExtensionPointId> {
  item: ExtensionPoints[P];
  source: ContributionSource;
}

export interface ContributionRegistryState {
  sources: Readonly<Record<string, RegisteredSource>>;
  register(source: ContributionSource, contributions: Contributions): void;
  unregister(sourceKey: string): void;
}

export type ContributionRegistry = StoreApi<ContributionRegistryState>;

/** Core module "home" and addon "home" must not overwrite each other. */
export function sourceKey(source: Pick<ContributionSource, 'kind' | 'id'>): string {
  return `${source.kind}:${source.id}`;
}

/** The key a preset's `nav.items` uses for a top-level nav item, e.g. `core:settings:settings`. */
export function navItemKey(
  source: Pick<ContributionSource, 'kind' | 'id'>,
  itemId: string,
): string {
  return `${sourceKey(source)}:${itemId}`;
}

export function createContributionRegistry(): ContributionRegistry {
  let sequence = 0;
  return createStore<ContributionRegistryState>()((set) => ({
    sources: {},
    register: (source, contributions) =>
      set((state) => ({
        sources: {
          ...state.sources,
          [sourceKey(source)]: { source, contributions, sequence: sequence++ },
        },
      })),
    unregister: (key) =>
      set((state) => {
        if (!(key in state.sources)) return state;
        const { [key]: _removed, ...rest } = state.sources;
        return { sources: rest };
      }),
  }));
}

const UNORDERED = Number.MAX_SAFE_INTEGER;

/** Items without an `order` go last. `sort` is stable, so ties keep their position. */
export function compareOrder(a: number | undefined, b: number | undefined): number {
  return (a ?? UNORDERED) - (b ?? UNORDERED);
}

/**
 * Flattens all contributions to `point`, drops the ones the user may not see and sorts the rest.
 *
 * `context` is only passed for renderable points; it feeds each contribution's `visible()` check.
 */
export function selectContributions<P extends ExtensionPointId>(
  sources: Readonly<Record<string, RegisteredSource>>,
  point: P,
  user: CurrentUser | null,
  context?: object,
): ResolvedContribution<P>[] {
  const result: (ResolvedContribution<P> & { sequence: number })[] = [];
  for (const { source, contributions, sequence } of Object.values(sources)) {
    for (const item of contributions[point] ?? []) {
      if (!hasAnyRole(user, item.roles)) continue;
      if (!isVisible(item, context, user)) continue;
      result.push({ item, source, sequence });
    }
  }
  result.sort((a, b) => compareOrder(a.item.order, b.item.order) || a.sequence - b.sequence);
  return result.map(({ item, source }) => ({ item, source }));
}

type VisibilityCheck = (context: object, user: CurrentUser | null) => unknown;

function isVisible(item: object, context: object | undefined, user: CurrentUser | null): boolean {
  if (!('visible' in item) || typeof item.visible !== 'function') return true;
  try {
    return Boolean((item.visible as VisibilityCheck)(context ?? {}, user));
  } catch (error) {
    // A broken visibility check hides only that contribution; it must not take the slot down.
    console.error('[extensions] visible() threw, hiding contribution', error);
    return false;
  }
}
