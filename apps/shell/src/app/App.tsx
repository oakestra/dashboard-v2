import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';

import { useAddonSync } from '../core/addons/use-addon-sync';
import type { AppConfig } from '../core/config/config';
import { watchThemeInOtherTabs } from '../core/theme/theme';
import { coreModules } from './modules';
import { Providers } from './providers';
import { createAppRouter } from './router';
import type { AppServices } from './services';
import { SessionWatcher } from './SessionWatcher';

function AddonRuntime() {
  useAddonSync();
  return null;
}

export function App({ config, services }: { config: AppConfig; services: AppServices }) {
  const [router] = useState(() =>
    createAppRouter(coreModules, {
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
