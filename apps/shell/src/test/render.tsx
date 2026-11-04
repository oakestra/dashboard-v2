import { createMockSession, type MockSessionOptions } from '@oakestra/mocks';
import { render, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';

import { selectLinkedAddons, selectModules } from '../app/modules';
import { Providers } from '../app/providers';
import { SessionWatcher } from '../app/SessionWatcher';
import { createAppRoutes } from '../app/router';
import { createAppServices, type AppServices } from '../app/services';
import type { LinkedAddon } from '../core/addons/linked-addons';
import { appConfigSchema, type AppConfig } from '../core/config/config';
import { DEFAULT_PRESET, presetSchema, type Preset, type PresetInput } from '../core/config/preset';
import type { CoreModule } from '../core/modules';
import { createRouterContext } from '../core/router/app-context';
import { mockStore, TEST_ADDONS_MANAGER_URL, TEST_API_URL, TEST_MARKETPLACE_URL } from './msw';

export interface RenderAppOptions {
  /** Feature modules to mount, e.g. `[profileModule]`. The routes run through the real guards. */
  modules?: readonly CoreModule[];
  /**
   * Linked addon packages to mount, e.g. `linkedAddons` from app/modules or
   * `[{ definition: help, mount: '/help' }]`. Registered at startup like in production.
   */
  linked?: readonly LinkedAddon[];
  /** Initial URL. */
  route?: string;
  /**
   * Who is logged in: a fixture user of @oakestra/mocks (`Admin`, `alice`, `bob`, `carol`,
   * `dave`), optionally with `roles` overriding the token's roles. `null` renders logged out.
   * Defaults to `{ username: 'Admin' }`.
   */
  user?: MockSessionOptions | null;
  config?: Partial<AppConfig>;
  /**
   * Deployment preset (`preset.json` contents). `modules` narrows the mounted modules like in
   * production and drives useModuleEnabled; `home` and mounted `addons` shape the route tree.
   */
  preset?: PresetInput;
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
  const preset = options.preset ? presetSchema.parse(options.preset) : DEFAULT_PRESET;
  // Selection only, without applyPreset's checks: tests mount a few modules, against which most
  // presets would name unknown ones.
  return renderShell(
    selectModules(options.modules ?? [], preset),
    selectLinkedAddons(options.linked ?? [], preset),
    preset,
    options,
  );
}

function renderShell(
  modules: readonly CoreModule[],
  linked: readonly LinkedAddon[],
  preset: Preset,
  options: Omit<RenderAppOptions, 'modules' | 'linked'>,
): RenderAppResult {
  const config = createTestConfig(options.config);
  const services = createAppServices(modules, config, {
    storage: window.localStorage,
    preset,
    linked,
  });
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

  const router = createMemoryRouter(createAppRoutes(modules, preset, linked), {
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
  options: Omit<RenderAppOptions, 'modules' | 'linked'> & { path?: string } = {},
): RenderAppResult {
  const route: RouteObject = { path: options.path ?? '*', element: ui };
  const preset = options.preset ? presetSchema.parse(options.preset) : DEFAULT_PRESET;
  // Not run through selectModules: the preset only tells the component which modules exist.
  return renderShell([{ id: 'test', label: 'Test', routes: [route] }], [], preset, {
    ...options,
    route: options.route ?? '/',
  });
}
