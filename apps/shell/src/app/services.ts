import type { OakestraApi } from '@oakestra/dashboard-sdk';
import type { QueryClient } from '@tanstack/react-query';

import { createAddonRegistry, type AddonRegistry } from '../core/addons/addon-registry';
import { registerLinkedAddons, type LinkedAddon } from '../core/addons/linked-addons';
import { createApiServices } from '../core/api/create-api';
import type { Fetch } from '../core/api/authorized-fetch';
import type { AddonsAdminApi } from '../core/addons/addons-admin';
import type { AuthSession } from '../core/auth/session';
import type { AppConfig } from '../core/config/config';
import { DEFAULT_PRESET, type Preset } from '../core/config/preset';
import { createContributionRegistry, type ContributionRegistry } from '../core/extensions/registry';
import type { CoreModule } from '../core/modules';
import { notify } from '../core/notify/notify';
import { createQueryClient } from '../core/query/query-client';
import { createThemeStore, type ThemeStore } from '../core/theme/theme';

/** Long-lived singletons of one shell instance. Created once in bootstrap, injectable in tests. */
export interface AppServices {
  queryClient: QueryClient;
  contributions: ContributionRegistry;
  addons: AddonRegistry;
  auth: AuthSession;
  api: OakestraApi;
  addonBackendFetch: Fetch;
  addonsAdmin: AddonsAdminApi;
  theme: ThemeStore;
  /** The deployment preset, already checked by applyPreset. */
  preset: Preset;
}

export interface AppServicesOptions {
  storage?: Storage;
  /** Replaces the global fetch for API calls. */
  send?: Fetch;
  /** Defaults to no preset. `modules` must already be the selection it makes (applyPreset). */
  preset?: Preset;
  /** The linked addons the preset enables (applyPreset), registered before the first render. */
  linked?: readonly LinkedAddon[];
}

export function createAppServices(
  modules: readonly CoreModule[],
  config: AppConfig,
  options: AppServicesOptions = {},
): AppServices {
  const storage = options.storage ?? window.localStorage;
  const contributions = createContributionRegistry();
  for (const module of modules) {
    if (!module.contributions) continue;
    const source = { kind: 'core', id: module.id, label: module.label } as const;
    contributions.getState().register(source, module.contributions);
  }
  const addons = createAddonRegistry();
  registerLinkedAddons(options.linked ?? [], { addons, contributions });
  const { api, addonBackendFetch, auth, addonsAdmin } = createApiServices({
    apiUrl: config.apiUrl,
    addonsManagerUrl: config.addonsManagerUrl,
    marketplaceUrl: config.marketplaceUrl,
    storage,
    send: options.send,
  });
  return {
    queryClient: createQueryClient(notify),
    contributions,
    addons,
    auth,
    api,
    addonBackendFetch,
    addonsAdmin,
    preset: options.preset ?? DEFAULT_PRESET,
    theme: createThemeStore({
      storage,
      matchMedia: (query) => window.matchMedia(query),
      root: document.documentElement,
    }),
  };
}
