import { federation } from '@module-federation/vite';
import { sharedDeps, withoutFallback } from '@oakestra/dashboard-sdk/federation';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const port = 5174;

export default defineConfig(({ command }) => ({
  // Relative asset URLs: in production the addon is served below /addon-assets/example/, in
  // development straight from this dev server.
  base: command === 'build' ? './' : '/',
  build: { target: 'esnext' },
  plugins: [
    react(),
    tailwindcss(),
    federation({
      // Must equal the addon name in /ui-addons and the `id` in the addon definition.
      name: 'example',
      filename: 'remoteEntry.js',
      exposes: { './addon': './src/index.tsx' },
      // The addon only ever runs inside the shell, so it never ships its own React, SDK, etc.
      shared: { ...withoutFallback(sharedDeps) },
      manifest: true,
      publicPath: 'auto',
      dts: false,
    }),
  ],
  server: {
    port,
    strictPort: true,
    origin: `http://localhost:${port}`,
    cors: true,
  },
  preview: { port, strictPort: true, cors: true },
}));
