import { oakestraAddon } from '@oakestra/dashboard-sdk/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // `name` is the addon name in /ui-addons, the marketplace definition and the container name
    // (addonui-<name>); `prefix` must equal the one in prefix(...) in src/addon.css.
    oakestraAddon({ name: '__NAME__', prefix: '__PREFIX__', port: __PORT__ }),
  ],
});
