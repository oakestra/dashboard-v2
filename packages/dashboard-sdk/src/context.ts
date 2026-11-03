import { createContext, type ComponentType } from 'react';

import type { RenderablePointId } from './extension-points';
import type { SlotProps } from './slot';
import type { CurrentUser, Notify, OakestraApi } from './types';

/** Links to services next to the dashboard, as the deployment configures them. */
export interface HostLinks {
  /** Grafana of the deployment, for monitoring. Absent when the deployment has none. */
  readonly grafanaUrl?: string;
}

/** What the shell provides to every addon. Addons read it through the hooks, not directly. */
export interface HostContextValue {
  /** SDK version the shell was built with. May be newer than the one an addon was built with. */
  readonly sdkVersion: string;
  readonly user: CurrentUser | null;
  readonly api: OakestraApi;
  readonly notify: Notify;
  /**
   * Whether the deployment enables the feature `id`: a built-in module, a linked or preset addon.
   * Read it through useFeatureEnabled().
   */
  readonly isFeatureEnabled: (id: string) => boolean;
  /**
   * Read it through useHostLinks(). Optional because shells built before it existed do not set
   * it; the hook then answers with no links.
   */
  readonly links?: HostLinks;
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

/**
 * The shell's slot renderer. The SDK cannot import shell code, so the shell hands its own `Slot`
 * in here and the exported `Slot` delegates to it.
 */
export const SlotRendererContext = createContext<ComponentType<
  SlotProps<RenderablePointId>
> | null>(null);
SlotRendererContext.displayName = 'OakestraSlotRendererContext';
