import { useAddonBasePath, type AddonRoute, type CurrentUser } from '@oakestra/dashboard-sdk';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { AuthSessionContext } from '../auth/auth-context';
import type { AuthSession } from '../auth/session';

import { createAddonRegistry, deleteEntries, setEntry, type AddonRegistry } from './addon-registry';
import { AddonRegistryContext } from './addon-registry-context';
import { AddonRouteHost } from './AddonRouteHost';

const base = { name: 'flops', version: '1.0.0', sdk: '^0.1.0', entry: 'http://x/mf-manifest.json' };

function Index() {
  return <p>flops home at {useAddonBasePath()}</p>;
}

function renderAt(path: string, registry: AddonRegistry, user: CurrentUser | null = null) {
  const router = createMemoryRouter(
    [
      {
        path: '/addons/:addonId/*',
        element: <AddonRouteHost forbidden={<p data-testid="forbidden">Access denied</p>} />,
      },
    ],
    { initialEntries: [path] },
  );
  // The host only reads the user from the session store.
  const session = { store: createStore(() => ({ user })) } as unknown as AuthSession;
  return render(
    <AuthSessionContext.Provider value={session}>
      <AddonRegistryContext.Provider value={registry}>
        <RouterProvider router={router} />
      </AddonRegistryContext.Provider>
    </AuthSessionContext.Provider>,
  );
}

const alice: CurrentUser = {
  username: 'alice',
  roles: ['Application_Provider'],
  organization: null,
};
const admin: CurrentUser = { username: 'Admin', roles: ['Admin'], organization: null };

function loaded(registry: AddonRegistry, routes: AddonRoute[], label?: string) {
  setEntry(registry, {
    ...base,
    state: 'loaded',
    definition: { id: 'flops', ...(label ? { label } : {}), routes },
  });
}

function Admin() {
  return <p>admin page</p>;
}

function Layout() {
  return (
    <section>
      <p>layout</p>
      <Outlet />
    </section>
  );
}

describe('<AddonRouteHost>', () => {
  it('waits for the first /ui-addons response before declaring an addon unknown', () => {
    const registry = createAddonRegistry();
    renderAt('/addons/flops', registry);
    expect(screen.getByTestId('addon-loading')).toBeInTheDocument();

    act(() => registry.setState({ availability: 'available' }));
    expect(screen.getByTestId('addon-not-found')).toHaveTextContent('No dashboard UI for "flops"');
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute('href', '/');
    // Not signed in as an admin here, so no link into the admin-only addon manager.
    expect(screen.queryByRole('link', { name: 'Manage addons' })).toBeNull();
  });

  it('renders the addon routes with its base path', async () => {
    const registry = createAddonRegistry();
    setEntry(registry, {
      ...base,
      state: 'loaded',
      definition: { id: 'flops', routes: [{ index: true, Component: Index }] },
    });
    renderAt('/addons/flops', registry);
    expect(await screen.findByText('flops home at /addons/flops')).toBeInTheDocument();
  });

  it('shows a not-found page for unknown addon subpaths', async () => {
    const registry = createAddonRegistry();
    setEntry(registry, { ...base, state: 'loaded', definition: { id: 'flops', routes: [] } });
    renderAt('/addons/flops/nope', registry);
    expect(await screen.findByTestId('addon-page-not-found')).toBeInTheDocument();
  });

  it('switches to "disabled" when the addon is removed while its page is open', async () => {
    const registry = createAddonRegistry();
    setEntry(registry, {
      ...base,
      state: 'loaded',
      definition: { id: 'flops', routes: [{ index: true, Component: Index }] },
    });
    renderAt('/addons/flops', registry);
    await screen.findByText(/flops home/);

    act(() => deleteEntries(registry, ['flops']));
    expect(screen.getByTestId('addon-disabled')).toBeInTheDocument();
  });

  it('shows why an addon failed or is incompatible', () => {
    const registry = createAddonRegistry();
    setEntry(registry, { ...base, state: 'failed', error: 'manifest 502' });
    const { unmount } = renderAt('/addons/flops', registry);
    expect(screen.getByTestId('addon-failed')).toHaveTextContent('manifest 502');
    unmount();

    setEntry(registry, { ...base, state: 'incompatible', error: 'needs SDK ^2.0.0' });
    renderAt('/addons/flops', registry);
    expect(screen.getByTestId('addon-incompatible')).toHaveTextContent('needs SDK ^2.0.0');
  });

  describe('roles', () => {
    const routes: AddonRoute[] = [
      { index: true, Component: Index },
      { path: 'settings', roles: ['Admin'], Component: Admin },
      {
        path: 'admin',
        roles: ['Admin'],
        children: [{ path: 'jobs', Component: Admin }],
      },
      {
        path: 'tools',
        Component: Layout,
        children: [{ path: 'secret', roles: ['Admin', 'Organization_Admin'], Component: Admin }],
      },
      { path: 'public', roles: [], Component: Admin },
    ];

    it('shows the forbidden page to users without one of the roles', async () => {
      const registry = createAddonRegistry();
      loaded(registry, routes);
      renderAt('/addons/flops/settings', registry, alice);
      expect(await screen.findByTestId('forbidden')).toBeInTheDocument();
      expect(screen.queryByText('admin page')).toBeNull();
    });

    it('denies anonymous users and lets users with a role in', async () => {
      const registry = createAddonRegistry();
      loaded(registry, routes);
      const { unmount } = renderAt('/addons/flops/settings', registry, null);
      expect(await screen.findByTestId('forbidden')).toBeInTheDocument();
      unmount();

      renderAt('/addons/flops/settings', registry, admin);
      expect(await screen.findByText('admin page')).toBeInTheDocument();
      expect(screen.queryByTestId('forbidden')).toBeNull();
    });

    it("guards child routes with the parent's roles", async () => {
      const registry = createAddonRegistry();
      loaded(registry, routes);
      renderAt('/addons/flops/admin/jobs', registry, alice);
      expect(await screen.findByTestId('forbidden')).toBeInTheDocument();
      expect(screen.queryByText('admin page')).toBeNull();
    });

    it('denies a child route inside the layout of an open parent', async () => {
      const registry = createAddonRegistry();
      loaded(registry, routes);
      renderAt('/addons/flops/tools/secret', registry, alice);
      expect(await screen.findByTestId('forbidden')).toBeInTheDocument();
      expect(screen.getByText('layout')).toBeInTheDocument();
    });

    it('treats an empty role list as public', async () => {
      const registry = createAddonRegistry();
      loaded(registry, routes);
      renderAt('/addons/flops/public', registry, null);
      expect(await screen.findByText('admin page')).toBeInTheDocument();
    });
  });

  it('names the addon by its label once it is loaded', async () => {
    const registry = createAddonRegistry();
    loaded(registry, [], 'FLOps');
    renderAt('/addons/flops/nope', registry);
    expect(await screen.findByTestId('addon-page-not-found')).toHaveTextContent(
      'FLOps has no page at this address.',
    );
  });
});
