import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against the production images from docker-compose.dev.yml, which must already be up:
 *
 *   docker compose -f docker-compose.dev.yml up --build -d
 *   pnpm e2e
 */
export default defineConfig({
  testDir: './tests',
  // All tests share one mock addons manager, so they must not run concurrently.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
