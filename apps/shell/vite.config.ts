import { federation } from '@module-federation/vite';
import { sharedDeps } from '@oakestra/dashboard-sdk/federation';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { msw } from 'msw/vite';
import { defineConfig, type Connect, type Plugin, type ProxyOptions } from 'vite';

import { isolated } from './dev-proxy.ts';

const addonsManagerUrl = process.env.ADDONS_MANAGER_URL ?? 'http://localhost:11101';
const marketplaceUrl = process.env.MARKETPLACE_URL ?? 'http://localhost:11102';

const addonAssets = (process.env.ADDON_ASSETS ?? '').split(',').flatMap((pair) => {
  const [name, target] = pair.split('=');
  return name && target ? [{ name, target }] : [];
});

/**
 * Mirrors the nginx `/addon-assets/<name>/` proxy for local runs, e.g.
 * `ADDON_ASSETS=example=http://localhost:5174 pnpm dev`. Usually the dev override is simpler, this
 * is for checking production addon builds (`vite preview`) without Docker.
 */
function addonAssetProxies(): Record<string, ProxyOptions> {
  const proxies: Record<string, ProxyOptions> = {};
  for (const { name, target } of addonAssets) {
    const prefix = `/addon-assets/${name}`;
    const options: ProxyOptions = {
      target,
      changeOrigin: true,
      rewrite: (path) => path.slice(prefix.length),
    };
    // The addon's backend gets the same sandbox headers as in nginx. Vite tries the keys in
    // insertion order, so this one has to come first.
    proxies[`${prefix}/api/`] = isolated(options);
    proxies[`${prefix}/`] = options;
  }
  return proxies;
}

/**
 * Answers 404 for `/addon-assets/<name>/...` when no proxy is configured for that name. Without
 * it the SPA fallback answers with index.html and status 200, so a missing addon backend looks
 * like a backend that returned HTML. Plugin middlewares added without a returned function run
 * before Vite's internal ones (proxy, SPA fallback), and listed names fall through to the proxy.
 */
function addonAssetsNotFound(known: string[]): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const name = /^\/addon-assets\/([^/?#]+)/.exec(req.url ?? '')?.[1];
    if (name === undefined || known.includes(name)) {
      next();
      return;
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(
      `No proxy for addon ${name} in this dev server; start it with ADDON_ASSETS=${name}=<url>\n`,
    );
  };
  return {
    name: 'oakestra:addon-assets-not-found',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
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
    addonAssetsNotFound(addonAssets.map((entry) => entry.name)),
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
