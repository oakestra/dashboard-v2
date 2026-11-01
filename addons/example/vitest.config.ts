import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // The Tailwind entry is built by the Vite plugin in vite.config.ts; tests do not need styles.
    css: false,
  },
});
