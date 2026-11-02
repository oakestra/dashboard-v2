import { createMockSession, type MockSessionOptions } from '@oakestra/mocks';
import { render, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';

import { Providers } from '../app/providers';
import { SessionWatcher } from '../app/SessionWatcher';
import { createAppRoutes } from '../app/router';
import { createAppServices, type AppServices } from '../app/services';
import { appConfigSchema, type AppConfig } from '../core/config/config';
import type { CoreModule } from '../core/modules';
import { createRouterContext } from '../core/router/app-context';
import { mockStore, TEST_ADDONS_MANAGER_URL, TEST_API_URL, TEST_MARKETPLACE_URL } from './msw';

export interface RenderAppOptions {
  /** Feature modules to mount, e.g. `[profileModule]`. The routes run through the real guards. */
  modules: readonly CoreModule[];
  /** Initial URL. */
  route?: string;
  /**
   * Who is logged in: a fixture user of @oakestra/mocks (`Admin`, `alice`, `bob`, `carol`,
   * `dave`), optionally with `roles` overriding the token's roles. `null` renders logged out.
   * Defaults to `{ username: 'Admin' }`.
   */
  user?: MockSessionOptions | null;
  config?: Partial<AppConfig>;
}

export interface RenderAppResult extends RenderResult {
  services: AppServices;
  router: ReturnType<typeof createMemoryRouter>;
  user: UserEvent;
}

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return appConfigSchema.parse({
    apiUrl: TEST_API_URL,
    addonsManagerUrl: TEST_ADDONS_MANAGER_URL,
    marketplaceUrl: TEST_MARKETPLACE_URL,
    ...overrides,
  });
}

/**
 * Renders the shell's real route tree (layouts, guards, error pages) for the given modules, with
 * the MSW mock backend behind the API. Use it for page-level tests:
 *
 *   const { user } = renderApp({ modules: [profileModule], route: '/profile' });
 *   await user.click(await screen.findByRole('button', { name: 'Save' }));
 */
export function renderApp(options: RenderAppOptions): RenderAppResult {
  const config = createTestConfig(options.config);
  const services = createAppServices(options.modules, config, { storage: window.localStorage });
  // Tests should fail on the first error instead of waiting for a retry.
  services.queryClient.setDefaultOptions({
    ...services.queryClient.getDefaultOptions(),
    queries: { ...services.queryClient.getDefaultOptions().queries, retry: false },
  });

  const sessionOptions = options.user === undefined ? {} : options.user;
  if (sessionOptions) {
    const session = createMockSession(mockStore, sessionOptions);
    services.auth.login(
      { token: session.accessToken, refresh_token: session.refreshToken },
      sessionOptions.organizationName,
    );
  }

  const router = createMemoryRouter(createAppRoutes(options.modules), {
    initialEntries: [options.route ?? '/'],
    getContext: createRouterContext({
      auth: services.auth,
      api: services.api,
      addonsAdmin: services.addonsAdmin,
      queryClient: services.queryClient,
    }),
  });

  const user = userEvent.setup();
  const result = render(
    <Providers config={config} services={services}>
      <SessionWatcher router={router} />
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...result, services, router, user };
}

/**
 * Renders a single component with all providers and a logged-in user, for component tests that
 * do not need the route tree. `path` lets the component read route params.
 */
export function renderWithProviders(
  ui: ReactNode,
  options: Omit<RenderAppOptions, 'modules'> & { path?: string } = {},
): RenderAppResult {
  const route: RouteObject = { path: options.path ?? '*', element: ui };
  return renderApp({
    ...options,
    route: options.route ?? '/',
    modules: [{ id: 'test', label: 'Test', routes: [route] }],
  });
}
