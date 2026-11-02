import type { AddonRegistry } from '../addons/addon-registry';

/**
 * Values the e2e suite compares between shell and addons to prove they share one instance of each
 * singleton. Functions and objects are compared by identity, so wrapper objects created by the
 * federation runtime around module namespaces do not cause false negatives.
 */
export interface SingletonProbe {
  useState: unknown;
  queryClient: unknown;
  useHostContext: unknown;
  user: unknown;
}

export interface OakDebug {
  host: SingletonProbe;
  /** Filled in by addons (only the example addon does this) when the hook exists. */
  addons: Record<string, SingletonProbe>;
  addonStates(): Record<string, string>;
}

declare global {
  interface Window {
    __OAK_DEBUG__?: OakDebug;
  }
}

/**
 * Only installed in builds made with VITE_OAK_DEBUG=true (the e2e image). `getUser` is read on
 * every access because the user only exists after login.
 */
export function installDebugHook(
  probe: Omit<SingletonProbe, 'user'> & { getUser: () => unknown },
  addons: AddonRegistry,
): void {
  if (import.meta.env.VITE_OAK_DEBUG !== 'true') return;
  const { getUser, ...stable } = probe;
  window.__OAK_DEBUG__ = {
    host: {
      ...stable,
      get user() {
        return getUser();
      },
    },
    addons: {},
    addonStates: () =>
      Object.fromEntries(
        Object.values(addons.getState().entries).map((entry) => [entry.name, entry.state]),
      ),
  };
}
