import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Unit tests of this package against the SDK's test host. Page tests with the real shell (router,
// layout, MSW backend) live in apps/shell/src/linked/, see "Module packages" in AGENTS.md.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    restoreMocks: true,
  },
});
