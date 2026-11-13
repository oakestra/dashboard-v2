import { createMockServer } from '@oakestra/mocks/node';

/** apiUrl of every test config. Requests elsewhere fail the test (onUnhandledFrame: 'error'). */
export const TEST_API_URL = 'http://api.test/api';

/**
 * One MSW server for the whole test run, started in setup.ts. `mockStore` is the in-memory
 * backend; it is reset after every test. Override single endpoints with
 * `mockServer.use(http.get(`${TEST_API_URL}/...`, () => ...))`.
 */
export const TEST_ADDONS_MANAGER_URL = 'http://api.test/addons-api';
export const TEST_MARKETPLACE_URL = 'http://api.test/marketplace-api';

/**
 * `mockAddons` is the in-memory addons-manager and marketplace (see @oakestra/mocks).
 * Installs settle after 20ms in tests; reset after every test like the store.
 */
export const {
  server: mockServer,
  store: mockStore,
  addons: mockAddons,
} = createMockServer({
  baseUrl: TEST_API_URL,
  addons: {
    managerUrl: TEST_ADDONS_MANAGER_URL,
    marketplaceUrl: TEST_MARKETPLACE_URL,
    installDelayMs: 20,
    // Long: nothing in the unit tests waits for a crash to be noticed.
    monitorDelayMs: 60_000,
  },
});
