import './styles.css';

import { useHostContext } from '@oakestra/dashboard-sdk';
import { setMapWorkerUrl } from '@oakestra/ui';
// Imported here rather than in @oakestra/ui: Vite's dev pre-bundler handles shared packages and
// cannot load `?url` imports, while the shell's own source goes through the normal asset pipeline.
// Registering it before the first render also covers maps that addons show.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { ConfigErrorPage } from './app/errors/ConfigErrorPage';
import { coreModules, linkedAddons } from './app/modules';
import { applyPreset } from './app/preset';
import { createAppServices } from './app/services';
import { loadConfig } from './core/config/config';
import { loadPreset } from './core/config/preset';
import { installDebugHook } from './core/debug/debug';

setMapWorkerUrl(maplibreWorkerUrl);

const root = createRoot(document.getElementById('root')!);

try {
  const config = await loadConfig();
  const { modules, linked, preset } = applyPreset(
    coreModules,
    linkedAddons,
    await loadPreset(config.presetUrl),
  );
  // `pnpm dev:mock`: the system-manager is replaced by MSW in the browser. Both conditions are
  // constants at build time, so production bundles contain neither MSW nor the fixtures.
  if (import.meta.env.DEV && import.meta.env.MODE === 'mock') {
    const { startMockApi } = await import('./mock-api');
    await startMockApi(config);
  }
  const services = createAppServices(modules, config, { preset, linked });
  // Installed before the first render, so addons can report to it from their first effect.
  installDebugHook(
    {
      useState,
      queryClient: services.queryClient,
      useHostContext,
      getUser: () => services.auth.store.getState().user,
    },
    services.addons,
  );
  root.render(
    <StrictMode>
      <App config={config} modules={modules} linked={linked} services={services} />
    </StrictMode>,
  );
} catch (error) {
  root.render(<ConfigErrorPage message={error instanceof Error ? error.message : String(error)} />);
}
