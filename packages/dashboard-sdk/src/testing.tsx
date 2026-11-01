/**
 * Test helpers for addon UIs: `@oakestra/dashboard-sdk/testing`.
 *
 * Test-only entry. It is not in `sharedDeps` and must never be imported by addon runtime code
 * (lint enforces that): it pulls in `@testing-library/react`, which is an optional peer
 * dependency. It deliberately imports the contexts from `./context` like the root entry does, so
 * the hooks under test see the very providers rendered here.
 */
import type { OakestraEndpoints } from '@oakestra/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import {
  AddonContext,
  HostContext,
  type AddonContextValue,
  type HostContextValue,
} from './context';
import type { CurrentUser, Notify, NotifyOptions, OakestraApi } from './types';
import { SDK_VERSION } from './version';

/** Endpoint groups of the API facade, each with only the functions a test needs. */
export type MockApiImplementation = {
  [Group in keyof OakestraEndpoints]?: Partial<OakestraEndpoints[Group]>;
} & {
  baseUrl?: string;
  fetch?: OakestraApi['fetch'];
};

export type NotifyLevel = 'success' | 'info' | 'warning' | 'error';

export interface NotifyCall {
  readonly level: NotifyLevel;
  readonly message: string;
  readonly options?: NotifyOptions;
}

/** A `Notify` that records its calls, so tests can assert on toasts with any test runner. */
export interface NotifyRecorder extends Notify {
  readonly calls: readonly NotifyCall[];
  clear(): void;
}

export function createNotifyRecorder(): NotifyRecorder {
  const calls: NotifyCall[] = [];
  const record =
    (level: NotifyLevel) =>
    (message: string, options?: NotifyOptions): void => {
      calls.push(options === undefined ? { level, message } : { level, message, options });
    };
  return {
    success: record('success'),
    info: record('info'),
    warning: record('warning'),
    error: record('error'),
    calls,
    clear: () => {
      calls.length = 0;
    },
  };
}

// `then` would make a proxy look like a promise to `await` and to React's `use`; `toJSON` is
// probed by JSON.stringify, which would otherwise throw on `JSON.stringify(api.applications)`.
function isInspection(prop: string | symbol): prop is symbol | 'then' | 'toJSON' {
  return typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON';
}

/** `api.applications.list` becomes `{ applications: { list: async () => ... } }`. */
function hint(path: string): string {
  const parts = path.split('.').slice(1);
  const method = parts.pop() ?? '';
  const inner = `${method}: async () => ...`;
  return `{ ${parts.reduceRight((acc, group) => `${group}: { ${acc} }`, inner)} }`;
}

function missing(path: string): () => never {
  return () => {
    throw new Error(
      `${path}() was called, but this test did not mock it. ` +
        `Pass it to the test host, e.g. api: ${hint(path)}.`,
    );
  };
}

/**
 * Builds an `OakestraApi` from the endpoints a test provides. Calling an endpoint that was not
 * provided throws an error naming it, instead of returning `undefined` and failing somewhere
 * far from the cause.
 */
export function createMockApi(implementation: MockApiImplementation = {}): OakestraApi {
  const {
    baseUrl = 'http://localhost/api',
    fetch = missing('api.fetch'),
    ...groups
  } = implementation;
  const groupProxies = new Map<string, object>();

  const groupProxy = (group: string): object => {
    let proxy = groupProxies.get(group);
    if (!proxy) {
      const provided = (groups as Record<string, object | undefined>)[group] ?? {};
      proxy = new Proxy(provided, {
        get: (target, method, receiver) => {
          if (isInspection(method)) return undefined;
          return Reflect.has(target, method)
            ? (Reflect.get(target, method, receiver) as unknown)
            : missing(`api.${group}.${method}`);
        },
      });
      groupProxies.set(group, proxy);
    }
    return proxy;
  };

  return new Proxy({ baseUrl, fetch } as unknown as OakestraApi, {
    get: (target, prop, receiver) => {
      if (isInspection(prop)) return undefined;
      if (prop === 'baseUrl' || prop === 'fetch') return Reflect.get(target, prop, receiver);
      return groupProxy(prop);
    },
  });
}

export interface TestHostOptions {
  /** `null` renders logged out. Defaults to a user without roles. */
  user?: (Partial<CurrentUser> & { username: string }) | null;
  /** Endpoints to mock. Everything else throws when called. */
  api?: MockApiImplementation;
  addon?: Partial<AddonContextValue>;
  /** Initial URL of the memory router. Defaults to the addon's base path. */
  route?: string;
  /**
   * Route pattern the children are rendered under, e.g. `/addons/example/details/:itemId`, so
   * `useParams()` returns the params of `route`. Defaults to `*`, which matches any URL but yields
   * no named params.
   */
  path?: string;
}

export interface TestHost {
  readonly host: HostContextValue;
  readonly addon: AddonContextValue;
  readonly user: CurrentUser | null;
  readonly api: OakestraApi;
  readonly notify: NotifyRecorder;
  readonly route: string;
  readonly path: string;
}

/** The context values `TestHostProvider` provides, for tests that assemble their own providers. */
export function createTestHost(options: TestHostOptions = {}): TestHost {
  const user: CurrentUser | null =
    options.user === null
      ? null
      : { roles: [], organization: null, ...(options.user ?? { username: 'test-user' }) };
  const addonId = options.addon?.addonId ?? 'test-addon';
  const addon: AddonContextValue = {
    addonId,
    version: '0.0.0',
    basePath: `/addons/${addonId}`,
    ...options.addon,
  };
  const api = createMockApi(options.api);
  const notify = createNotifyRecorder();
  return {
    host: { sdkVersion: SDK_VERSION, user, api, notify },
    addon,
    user,
    api,
    notify,
    route: options.route ?? addon.basePath,
    path: options.path ?? '*',
  };
}

export interface TestHostProviderProps {
  testHost: TestHost;
  /** Defaults to a fresh client with retries off, so a failing query surfaces at once. */
  queryClient?: QueryClient;
  children: ReactNode;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// The router is created once, so the current children travel through context: the route element
// reads them from here and a rerender with new children still reaches the page.
const TestChildrenContext = createContext<ReactNode>(null);

function TestChildren() {
  return <>{useContext(TestChildrenContext)}</>;
}

export function TestHostProvider({ testHost, queryClient, children }: TestHostProviderProps) {
  // Created lazily and kept for the provider's lifetime; a new client per render would drop the cache.
  const [fallbackClient] = useState(createTestQueryClient);
  // A data router (like the shell's) so useMatches, useNavigation, useBlocker and useFetcher work.
  // Route and path are read on the first render only; a new router per render would reset the URL.
  const [router] = useState(() =>
    createMemoryRouter([{ path: testHost.path, element: <TestChildren /> }], {
      initialEntries: [testHost.route],
    }),
  );
  return (
    <QueryClientProvider client={queryClient ?? fallbackClient}>
      <HostContext.Provider value={testHost.host}>
        <AddonContext.Provider value={testHost.addon}>
          <TestChildrenContext.Provider value={children}>
            <RouterProvider router={router} />
          </TestChildrenContext.Provider>
        </AddonContext.Provider>
      </HostContext.Provider>
    </QueryClientProvider>
  );
}

export interface RenderInHostOptions extends TestHostOptions {
  queryClient?: QueryClient;
  renderOptions?: Omit<RenderOptions, 'wrapper'>;
}

export type RenderInHostResult = RenderResult &
  Pick<TestHost, 'user' | 'api' | 'notify' | 'host' | 'addon'> & { queryClient: QueryClient };

/** Renders `ui` inside everything the shell provides to an addon contribution. */
export function renderInHost(
  ui: ReactElement,
  options: RenderInHostOptions = {},
): RenderInHostResult {
  const { queryClient = createTestQueryClient(), renderOptions, ...hostOptions } = options;
  const testHost = createTestHost(hostOptions);
  const result = render(ui, {
    ...renderOptions,
    wrapper: ({ children }) => (
      <TestHostProvider testHost={testHost} queryClient={queryClient}>
        {children}
      </TestHostProvider>
    ),
  });
  return {
    ...result,
    queryClient,
    host: testHost.host,
    addon: testHost.addon,
    user: testHost.user,
    api: testHost.api,
    notify: testHost.notify,
  };
}
