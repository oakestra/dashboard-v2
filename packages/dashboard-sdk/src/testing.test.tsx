import { useQuery } from '@tanstack/react-query';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { Link, useLocation, useMatches, useParams } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import {
  addonQueryKey,
  useAddonBasePath,
  useCurrentUser,
  useNotify,
  useOakestraApi,
} from './hooks';
import {
  createCommandContext,
  createMockApi,
  createNotifyRecorder,
  createTestHost,
  renderInHost,
} from './testing';

function Probe() {
  const user = useCurrentUser();
  const basePath = useAddonBasePath();
  const { pathname } = useLocation();
  return (
    <p>
      {user?.username ?? 'anonymous'} {user?.roles.join(',')} {basePath} {pathname}
    </p>
  );
}

// Vitest globals are off, so Testing Library does not unmount between tests on its own.
afterEach(cleanup);

describe('renderInHost', () => {
  it('provides user, addon and router context', () => {
    renderInHost(<Probe />, {
      user: { username: 'alice', roles: ['Application_Provider'] },
      addon: { addonId: 'example' },
      route: '/addons/example/details/1',
    });
    expect(
      screen.getByText('alice Application_Provider /addons/example /addons/example/details/1'),
    ).toBeTruthy();
  });

  it('renders logged out for a null user and starts at the base path by default', () => {
    const { user } = renderInHost(<Probe />, { user: null, addon: { addonId: 'x' } });
    expect(user).toBeNull();
    expect(screen.getByText('anonymous /addons/x /addons/x')).toBeTruthy();
  });

  it('serves mocked endpoints through TanStack Query', async () => {
    function Clusters() {
      const api = useOakestraApi();
      const { data } = useQuery({
        queryKey: addonQueryKey('example', 'clusters'),
        queryFn: () => api.clusters.list(),
      });
      return <p>{data ? `${data.length} clusters` : 'loading'}</p>;
    }
    renderInHost(<Clusters />, { api: { clusters: { list: () => Promise.resolve([]) } } });
    await waitFor(() => expect(screen.getByText('0 clusters')).toBeTruthy());
  });

  it('records notifications', () => {
    function Button() {
      const notify = useNotify();
      return <button onClick={() => notify.success('Saved', { id: 'a' })}>save</button>;
    }
    const { notify, getByText } = renderInHost(<Button />);
    getByText('save').click();
    expect(notify.calls).toEqual([{ level: 'success', message: 'Saved', options: { id: 'a' } }]);
    notify.clear();
    expect(notify.calls).toEqual([]);
  });

  it('lets links navigate inside the memory router', () => {
    renderInHost(
      <>
        <Link to="/addons/test-addon/next">next</Link>
        <Probe />
      </>,
    );
    screen.getByText('next').click();
    return waitFor(() => expect(screen.getByText(/\/addons\/test-addon\/next$/)).toBeTruthy());
  });
});

describe('TestHostProvider routing', () => {
  it('fills useParams from the path pattern', () => {
    function Params() {
      return <p>item {useParams().itemId}</p>;
    }
    renderInHost(<Params />, {
      addon: { addonId: 'example' },
      route: '/addons/example/details/42',
      path: '/addons/example/details/:itemId',
    });
    expect(screen.getByText('item 42')).toBeTruthy();
  });

  it('has no params without a path', () => {
    function Params() {
      return <p>params {JSON.stringify(useParams())}</p>;
    }
    renderInHost(<Params />, { route: '/addons/example/details/42' });
    expect(screen.getByText('params {"*":"addons/example/details/42"}')).toBeTruthy();
  });

  it('supports data router hooks', () => {
    function Matches() {
      return <p>matches {useMatches().length}</p>;
    }
    renderInHost(<Matches />);
    expect(screen.getByText('matches 1')).toBeTruthy();
  });

  it('shows new children on rerender without resetting the route', async () => {
    const { rerender } = renderInHost(
      <>
        <Link to="/addons/test-addon/next">next</Link>
        <Probe />
      </>,
    );
    screen.getByText('next').click();
    await waitFor(() => expect(screen.getByText(/\/addons\/test-addon\/next$/)).toBeTruthy());
    rerender(<p>replaced</p>);
    expect(screen.getByText('replaced')).toBeTruthy();
  });
});

describe('createMockApi', () => {
  it('throws a clear error naming an unmocked endpoint', () => {
    const api = createMockApi({ clusters: { list: () => Promise.resolve([]) } });
    expect(() => api.applications.get('1')).toThrow(/api\.applications\.get\(\) was called/);
    expect(() => api.clusters.listActive()).toThrow(/api\.clusters\.listActive\(\)/);
    expect(() => void api.fetch('/x')).toThrow(/api\.fetch\(\)/);
  });

  it('suggests valid object syntax for the missing endpoint', () => {
    const api = createMockApi();
    expect(() => api.applications.list()).toThrow(
      'e.g. api: { applications: { list: async () => ... } }.',
    );
    expect(() => void api.fetch('/x')).toThrow('e.g. api: { fetch: async () => ... }.');
  });

  it('can be serialized without treating toJSON as a missing endpoint', () => {
    const api = createMockApi({ clusters: { list: () => Promise.resolve([]) } });
    expect(JSON.stringify(api.applications)).toBe('{}');
    expect(JSON.stringify(api)).toBe('{"baseUrl":"http://localhost/api"}');
  });

  it('passes mocked endpoints through and exposes baseUrl', async () => {
    const api = createMockApi({
      baseUrl: 'http://api',
      clusters: { list: () => Promise.resolve([]) },
    });
    await expect(api.clusters.list()).resolves.toEqual([]);
    expect(api.baseUrl).toBe('http://api');
  });

  it('does not look like a promise', () => {
    const api = createMockApi();
    expect((api as unknown as { then?: unknown }).then).toBeUndefined();
  });
});

describe('createTestHost', () => {
  it('assembles context values without rendering', () => {
    const testHost = createTestHost({ user: { username: 'bob' }, addon: { addonId: 'a' } });
    expect(testHost.host.user).toEqual({ username: 'bob', roles: [], organization: null });
    expect(testHost.addon.basePath).toBe('/addons/a');
    expect(testHost.host.notify).toBe(testHost.notify);
  });

  it('enables every feature unless the test lists them', () => {
    expect(createTestHost().host.isFeatureEnabled('help')).toBe(true);
    const narrowed = createTestHost({ features: ['applications'] });
    expect(narrowed.host.isFeatureEnabled('applications')).toBe(true);
    expect(narrowed.host.isFeatureEnabled('help')).toBe(false);
  });

  it('provides no host links unless the test sets them', () => {
    expect(createTestHost().host.links).toEqual({});
    const grafanaUrl = 'https://grafana.example';
    expect(createTestHost({ links: { grafanaUrl } }).host.links).toEqual({ grafanaUrl });
  });
});

describe('createNotifyRecorder', () => {
  it('records every level in order', () => {
    const notify = createNotifyRecorder();
    notify.info('a');
    notify.error('b');
    expect(notify.calls.map((call) => call.level)).toEqual(['info', 'error']);
  });
});

describe('createCommandContext', () => {
  it('records what a command does', () => {
    const ctx = createCommandContext({ addon: { addonId: 'flops', basePath: '/flops' } });
    ctx.navigate(ctx.addon?.path('jobs', 'a b') ?? '');
    ctx.notify.success('Done');
    expect(ctx.navigations).toEqual(['/flops/jobs/a%20b']);
    expect(ctx.notify.calls).toEqual([{ level: 'success', message: 'Done' }]);
  });

  it('rejects relative paths like the shell', () => {
    expect(() => createCommandContext().navigate('jobs')).toThrow(/absolute/);
  });

  it('answers features, user and api like the test host', async () => {
    const ctx = createCommandContext({
      user: { username: 'alice', roles: ['Admin'] },
      features: ['fleet'],
      api: { clusters: { list: () => Promise.resolve([]) } },
    });
    expect(ctx.user.roles).toEqual(['Admin']);
    expect(ctx.isFeatureEnabled('fleet')).toBe(true);
    expect(ctx.isFeatureEnabled('help')).toBe(false);
    await expect(ctx.api.clusters.list()).resolves.toEqual([]);
  });
});
