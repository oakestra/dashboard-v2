import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';

import type { LinkedAddon } from '../core/addons/linked-addons';
import { useAddonSync } from '../core/addons/use-addon-sync';
import type { AppConfig } from '../core/config/config';
import { watchThemeInOtherTabs } from '../core/theme/theme';
import type { CoreModule } from '../core/modules';
import { Providers } from './providers';
import { createAppRouter } from './router';
import type { AppServices } from './services';
import { SessionWatcher } from './SessionWatcher';

function AddonRuntime() {
  useAddonSync();
  return null;
}

interface AppProps {
  config: AppConfig;
  /** The modules the preset enables (applyPreset). */
  modules: readonly CoreModule[];
  /** The linked addons the preset enables (applyPreset), already registered in `services`. */
  linked: readonly LinkedAddon[];
  services: AppServices;
}

export function App({ config, modules, linked, services }: AppProps) {
  const [router] = useState(() =>
    createAppRouter(modules, services.preset, linked, {
      auth: services.auth,
      api: services.api,
      addonsAdmin: services.addonsAdmin,
      queryClient: services.queryClient,
    }),
  );

  useEffect(
    () => watchThemeInOtherTabs(services.theme, window.localStorage, window),
    [services.theme],
  );

  return (
    <Providers config={config} services={services}>
      <AddonRuntime />
      <SessionWatcher router={router} />
      {/* RouterProvider from the package root, not react-router/dom: the /dom entry bundles its
          own copies of the router contexts, which addons (sharing only "react-router") would not see. */}
      <RouterProvider router={router} />
    </Providers>
  );
}
