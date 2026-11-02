import { createContext } from 'react';

import type { CurrentUser, Notify, OakestraApi } from './types';

/** What the shell provides to every addon. Addons read it through the hooks, not directly. */
export interface HostContextValue {
  /** SDK version the shell was built with. May be newer than the one an addon was built with. */
  readonly sdkVersion: string;
  readonly user: CurrentUser | null;
  readonly api: OakestraApi;
  readonly notify: Notify;
}

/** Identifies the addon a piece of UI belongs to. Set by the shell around every addon contribution. */
export interface AddonContextValue {
  readonly addonId: string;
  readonly version: string;
  /** Absolute path the addon's routes are mounted at, e.g. `/addons/example`. */
  readonly basePath: string;
}

// These contexts only work if shell and addons share one instance of this module. That is what the
// `@oakestra/dashboard-sdk` singleton entry in `sharedDeps` guarantees.
export const HostContext = createContext<HostContextValue | null>(null);
HostContext.displayName = 'OakestraHostContext';

export const AddonContext = createContext<AddonContextValue | null>(null);
AddonContext.displayName = 'OakestraAddonContext';
