import { useAddonBasePath } from '@oakestra/dashboard-sdk';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createAddonRegistry, deleteEntries, setEntry, type AddonRegistry } from './addon-registry';
import { AddonRegistryContext } from './addon-registry-context';
import { AddonRouteHost } from './AddonRouteHost';

const base = { name: 'flops', version: '1.0.0', sdk: '^0.1.0', entry: 'http://x/mf-manifest.json' };

function Index() {
  return <p>flops home at {useAddonBasePath()}</p>;
}

function renderAt(path: string, registry: AddonRegistry) {
  const router = createMemoryRouter([{ path: '/addons/:addonId/*', Component: AddonRouteHost }], {
    initialEntries: [path],
  });
  return render(
    <AddonRegistryContext.Provider value={registry}>
      <RouterProvider router={router} />
    </AddonRegistryContext.Provider>,
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
});
