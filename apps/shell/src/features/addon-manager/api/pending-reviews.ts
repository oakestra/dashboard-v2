import { useSyncExternalStore } from 'react';

import type { AddonsAdminApi } from '../../../core/addons/addons-admin';

export interface PendingReview {
  id: string;
  name: string;
  /** When this page registered it, for slowing down the poll. */
  since: number;
}

/**
 * Definitions registered from this page that are still `under_review`. Kept outside React state
 * because the register dialog that adds them unmounts at once, and outside the query cache
 * because nothing else would know which review queries to keep polling.
 */
export class PendingReviews {
  private items: readonly PendingReview[] = [];
  private readonly listeners = new Set<() => void>();

  add(definition: { _id: string; name: string }, now = Date.now()): void {
    if (this.items.some((item) => item.id === definition._id)) return;
    this.items = [...this.items, { id: definition._id, name: definition.name, since: now }];
    this.emit();
  }

  /**
   * False if it was not pending. Callers only toast when this is true, so an effect that runs
   * twice (StrictMode, or a render before the store update lands) can't toast twice.
   */
  remove(id: string): boolean {
    const next = this.items.filter((item) => item.id !== id);
    if (next.length === this.items.length) return false;
    this.items = next;
    this.emit();
    return true;
  }

  readonly snapshot = (): readonly PendingReview[] => this.items;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

// One per API like the transition trackers, so pending reviews survive leaving the addon manager
// and are picked up again when the person comes back.
const stores = new WeakMap<AddonsAdminApi, PendingReviews>();

export function pendingReviewsFor(api: AddonsAdminApi): PendingReviews {
  let store = stores.get(api);
  if (!store) {
    store = new PendingReviews();
    stores.set(api, store);
  }
  return store;
}

export function usePendingReviews(api: AddonsAdminApi): readonly PendingReview[] {
  const store = pendingReviewsFor(api);
  return useSyncExternalStore(store.subscribe, store.snapshot);
}
