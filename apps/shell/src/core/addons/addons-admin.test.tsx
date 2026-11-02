import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderApp } from '../../test/render';
import { useAddonsAdminApi, refreshUiAddons } from './addons-admin';
import { uiAddonsQueryKey } from './ui-addons';
import { useRefreshUiAddons } from './use-refresh-ui-addons';

function Probe() {
  const { manager } = useAddonsAdminApi();
  return (
    <button
      onClick={() => {
        void manager.list().then((list) => {
          document.title = list.map((addon) => addon.name).join(',');
        });
      }}
    >
      load
    </button>
  );
}

describe('useAddonsAdminApi', () => {
  it('reaches the addons-manager with the bearer token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { user } = renderApp({
      modules: [{ id: 'probe', label: 'Probe', routes: [{ path: 'probe', element: <Probe /> }] }],
      route: '/probe',
    });
    await user.click(await screen.findByRole('button', { name: 'load' }));
    await waitFor(() => expect(document.title).toBe('example,analytics,legacy-exporter'));

    const request = fetchSpy.mock.calls
      .map(([input]) => input)
      .find(
        (input): input is Request => input instanceof Request && input.url.includes('/addons-api/'),
      );
    expect(request?.headers.get('Authorization')).toMatch(/^Bearer /);
  });

  it('throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAddonsAdminApi())).toThrow(/AddonsAdminApiContext/);
  });
});

describe('refreshUiAddons', () => {
  it('refetches the observed /ui-addons query at once', async () => {
    const queryClient = new QueryClient();
    const queryFn = vi.fn(() => Promise.resolve([]));
    const observer = queryClient
      .getQueryCache()
      .build(queryClient, { queryKey: uiAddonsQueryKey, queryFn });
    const unsubscribe = renderHook(() => observer.state).unmount;
    await observer.fetch();
    expect(queryFn).toHaveBeenCalledTimes(1);

    await refreshUiAddons(queryClient);
    expect(queryClient.getQueryState(uiAddonsQueryKey)?.isInvalidated).toBe(true);
    unsubscribe();
  });

  it('is available as a hook', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRefreshUiAddons(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    void result.current();
    expect(spy).toHaveBeenCalledWith({ queryKey: uiAddonsQueryKey });
  });
});
