import { oakestraAddon } from '@oakestra/dashboard-sdk/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // `name` is the addon name in /ui-addons and the definition id (ADDON_ID); `prefix` the one of
    // prefix(ex) in src/addon.css.
    oakestraAddon({ name: 'example', prefix: 'ex', port: 5174 }),
  ],
});
