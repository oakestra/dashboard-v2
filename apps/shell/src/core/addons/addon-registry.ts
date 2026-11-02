import type { AddonDefinition } from '@oakestra/dashboard-sdk';
import { createStore, type StoreApi } from 'zustand/vanilla';

import type { ResolvedAddon } from './ui-addons';

export type AddonState = 'loading' | 'loaded' | 'failed' | 'incompatible';

export type AddonEntry =
  | (ResolvedAddon & { state: 'loading' })
  | (ResolvedAddon & {
      state: 'loaded';
      definition: AddonDefinition;
      /** Set when /ui-addons reports a newer version than the one running in this page. */
      availableVersion?: string;
    })
  | (ResolvedAddon & { state: 'failed'; error: string })
  | (ResolvedAddon & { state: 'incompatible'; error: string });

/**
 * - `pending`: the first /ui-addons request has not completed yet.
 * - `available`: the last request succeeded.
 * - `unavailable`: the addons manager is not reachable (or not installed). Existing entries are
 *   kept, because a short outage should not rip addon pages out from under the user.
 */
export type AddonsAvailability = 'pending' | 'available' | 'unavailable';

export interface AddonRegistryState {
  entries: Readonly<Record<string, AddonEntry>>;
  /** Addons that were present earlier in this session and have since disappeared. */
  removed: Readonly<Record<string, true>>;
  availability: AddonsAvailability;
}

export type AddonRegistry = StoreApi<AddonRegistryState>;

/** The addon's name for users: the label its UI declares once loaded, its name until then. */
export function addonLabel(entry: AddonEntry): string {
  return (entry.state === 'loaded' ? entry.definition.label : undefined) ?? entry.name;
}

export function createAddonRegistry(): AddonRegistry {
  return createStore<AddonRegistryState>()(() => ({
    entries: {},
    removed: {},
    availability: 'pending',
  }));
}

export function setEntry(registry: AddonRegistry, entry: AddonEntry): void {
  registry.setState((state) => {
    const { [entry.name]: _wasRemoved, ...removed } = state.removed;
    return { entries: { ...state.entries, [entry.name]: entry }, removed };
  });
}

export function deleteEntries(registry: AddonRegistry, names: readonly string[]): void {
  if (names.length === 0) return;
  registry.setState((state) => {
    const entries = { ...state.entries };
    const removed = { ...state.removed };
    for (const name of names) {
      delete entries[name];
      removed[name] = true;
    }
    return { entries, removed };
  });
}
