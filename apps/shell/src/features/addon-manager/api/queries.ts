import { isTransitionalAddonStatus, type AddonStatus, type InstalledAddon } from '@oakestra/api';
import { queryOptions } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { AddonsAdminApi } from '../../../core/addons/addons-admin';
import { addonManagerKeys } from '../keys';
import { INSTALLED_IDLE_POLL_MS, INSTALLED_POLL_MS, STUCK_AFTER_MS } from './polling';

/**
 * Remembers since when this page has seen an addon in its current transitional status. Shared by
 * everything that queries the installed list (the layout and both tabs), hence one per API.
 */
export class TransitionTracker {
  private readonly since = new Map<string, { status: AddonStatus; at: number }>();

  observe(addons: readonly InstalledAddon[], now = Date.now()): void {
    const seen = new Set<string>();
    for (const addon of addons) {
      if (!isTransitionalAddonStatus(addon.status)) continue;
      seen.add(addon._id);
      if (this.since.get(addon._id)?.status !== addon.status) {
        this.since.set(addon._id, { status: addon.status, at: now });
      }
    }
    for (const id of this.since.keys()) if (!seen.has(id)) this.since.delete(id);
  }

  isStuck(id: string, now = Date.now()): boolean {
    const entry = this.since.get(id);
    return entry !== undefined && now - entry.at >= STUCK_AFTER_MS;
  }

  /** True while some addon is transitional and has not been so for too long. */
  wantsFastPoll(now = Date.now()): boolean {
    for (const id of this.since.keys()) if (!this.isStuck(id, now)) return true;
    return false;
  }

  /** Milliseconds until the next addon counts as stuck, or undefined if none is waiting. */
  nextDeadline(now = Date.now()): number | undefined {
    let next: number | undefined;
    for (const { at } of this.since.values()) {
      const left = at + STUCK_AFTER_MS - now;
      if (left > 0 && (next === undefined || left < next)) next = left;
    }
    return next;
  }
}

const trackers = new WeakMap<AddonsAdminApi, TransitionTracker>();

function trackerFor(api: AddonsAdminApi): TransitionTracker {
  let tracker = trackers.get(api);
  if (!tracker) {
    tracker = new TransitionTracker();
    trackers.set(api, tracker);
  }
  return tracker;
}

/**
 * Installed addons. Polls fast while an addon is transitional (up to `STUCK_AFTER_MS`) and slowly
 * otherwise, as long as the page is visible: the reconcile loop reports crashes of addons that
 * already looked `active` later, and the update check sets `update_available` on its own.
 */
export function installedAddonsQuery(api: AddonsAdminApi) {
  const tracker = trackerFor(api);
  return queryOptions({
    queryKey: addonManagerKeys.installed(),
    queryFn: async ({ signal }) => {
      const addons = await api.manager.list({ signal });
      tracker.observe(addons);
      return addons;
    },
    refetchInterval: () => (tracker.wantsFastPoll() ? INSTALLED_POLL_MS : INSTALLED_IDLE_POLL_MS),
    // An unreachable service is shown inline with a retry button, not retried in the background.
    retry: false,
    // A failed poll keeps the table and shows a banner instead; a toast per poll would pile up.
    meta: { silent: true },
  });
}

/**
 * Ids of addons that have been transitional for longer than `STUCK_AFTER_MS`.
 * Re-renders when the next one crosses the line, as nothing else would: a stuck addon's list does
 * not change.
 */
export function useStuckAddonIds(
  api: AddonsAdminApi,
  addons: readonly InstalledAddon[] | undefined,
): ReadonlySet<string> {
  const tracker = trackerFor(api);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const left = tracker.nextDeadline(now);
    if (left === undefined) return;
    const timer = setTimeout(() => setNow(Date.now()), left + 5);
    return () => clearTimeout(timer);
  }, [tracker, addons, now]);

  // Stable between renders: the table rebuilds its columns when this changes.
  return useMemo(
    () =>
      new Set(
        (addons ?? []).filter((addon) => tracker.isStuck(addon._id, now)).map((addon) => addon._id),
      ),
    [tracker, addons, now],
  );
}

/** The merged catalog of every source. */
export function marketplaceAddonsQuery(api: AddonsAdminApi) {
  return queryOptions({
    queryKey: addonManagerKeys.marketplace(),
    queryFn: ({ signal }) => api.marketplace.list({ signal }),
    retry: false,
  });
}

/** The catalog's sources with their sync state. */
export function marketplaceSourcesQuery(api: AddonsAdminApi) {
  return queryOptions({
    queryKey: addonManagerKeys.sources(),
    queryFn: ({ signal }) => api.marketplace.sources.list({ signal }),
    retry: false,
  });
}
