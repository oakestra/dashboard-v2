import { federation } from '@module-federation/vite';
import { sharedDeps } from '@oakestra/dashboard-sdk/federation';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { msw } from 'msw/vite';
import { defineConfig, type ProxyOptions } from 'vite';

import { isolated } from './dev-proxy.ts';

const addonsManagerUrl = process.env.ADDONS_MANAGER_URL ?? 'http://localhost:11101';
const marketplaceUrl = process.env.MARKETPLACE_URL ?? 'http://localhost:11102';

/**
 * Mirrors the nginx `/addon-assets/<name>/` proxy for local runs, e.g.
 * `ADDON_ASSETS=example=http://localhost:5174 pnpm dev`. Usually the dev override is simpler, this
 * is for checking production addon builds (`vite preview`) without Docker.
 */
function addonAssetProxies(spec = process.env.ADDON_ASSETS ?? ''): Record<string, ProxyOptions> {
  const proxies: Record<string, ProxyOptions> = {};
  for (const pair of spec.split(',').filter(Boolean)) {
    const [name, target] = pair.split('=');
    if (!name || !target) continue;
    proxies[`/addon-assets/${name}/`] = {
      target,
      changeOrigin: true,
      rewrite: (path) => path.slice(`/addon-assets/${name}`.length),
    };
  }
  return proxies;
}

const proxy: Record<string, ProxyOptions> = {
  // Same path as behind nginx, so the shell code does not care where it runs.
  '/ui-addons': isolated({
    target: addonsManagerUrl,
    changeOrigin: true,
    rewrite: () => '/api/v1/ui-addons',
  }),

  // Addon management API. The prefix is rewritten to the backends' paths, as nginx does.
  '/addons-api': isolated({
    target: addonsManagerUrl,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/addons-api/, '/api/v1/addons'),
  }),

  '/marketplace-api': isolated({
    target: marketplaceUrl,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/marketplace-api/, '/api/v1/marketplace/addons'),
  }),

  ...addonAssetProxies(),
};

export default defineConfig(({ mode }) => ({
  // The federation runtime relies on top-level await.
  build: { target: 'esnext' },
  plugins: [
    // `pnpm dev:mock` (mode "mock") serves MSW's worker script. Only added in that mode: in a
    // build the plugin would emit the worker into dist/.
    mode === 'mock' ? msw({ mode: 'worker-only' }) : null,
    react(),
    tailwindcss(),
    federation({
      name: 'oakestra_shell',
      // Addons are registered at runtime from /ui-addons, never at build time.
      remotes: {},
      shared: { ...sharedDeps },
      dts: false,
    }),
  ],
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, strictPort: true, proxy },
}));
