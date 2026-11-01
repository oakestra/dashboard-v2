import {
  HostContext,
  useAddonBasePath,
  type HostContextValue,
  type OakestraApi,
} from '@oakestra/dashboard-sdk';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createContributionRegistry, type ContributionRegistry } from './registry';
import { ContributionRegistryContext } from './registry-context';
import { Slot } from './Slot';

const host: HostContextValue = {
  sdkVersion: '0.1.0',
  user: { username: 'a', roles: ['Admin'], organization: null },
  // Slots never call the API.
  api: {} as OakestraApi,
  notify: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() },
};

function wrapper(registry: ContributionRegistry) {
  return ({ children }: { children: ReactNode }) => (
    <HostContext.Provider value={host}>
      <ContributionRegistryContext.Provider value={registry}>
        {children}
      </ContributionRegistryContext.Provider>
    </HostContext.Provider>
  );
}

const addonSource = {
  kind: 'addon' as const,
  id: 'flops',
  label: 'addon "flops"',
  addon: { addonId: 'flops', version: '1.0.0', basePath: '/addons/flops' },
};

describe('<Slot>', () => {
  it('isolates a throwing contribution and keeps rendering the others', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const registry = createContributionRegistry();
    registry.getState().register(addonSource, {
      'home.widgets': [
        {
          id: 'boom',
          title: 'Broken widget',
          order: 1,
          component: () => {
            throw new Error('kaputt');
          },
        },
        { id: 'ok', title: 'Fine widget', order: 2, component: () => <p>still here</p> },
      ],
    });

    render(<Slot point="home.widgets" />, { wrapper: wrapper(registry) });

    const error = screen.getByTestId('contribution-error');
    expect(error).toHaveTextContent('Broken widget from addon "flops" failed to render.');
    expect(error).toHaveTextContent('kaputt');
    expect(error).toHaveAttribute('data-source', 'addon:flops');
    expect(screen.getByText('still here')).toBeInTheDocument();
  });

  it('passes the context as props and provides the addon context', () => {
    const registry = createContributionRegistry();
    function ClusterWidget({ clusterId }: { clusterId: string }) {
      return (
        <p>
          {clusterId} at {useAddonBasePath()}
        </p>
      );
    }
    registry.getState().register(addonSource, {
      'cluster.widgets': [{ id: 'w', title: 'W', component: ClusterWidget }],
    });

    render(<Slot point="cluster.widgets" context={{ clusterId: 'c-1' }} />, {
      wrapper: wrapper(registry),
    });
    expect(screen.getByText('c-1 at /addons/flops')).toBeInTheDocument();
  });

  it('renders the empty state and custom wrappers', () => {
    const registry = createContributionRegistry();
    const { rerender } = render(<Slot point="home.widgets" empty={<p>nothing</p>} />, {
      wrapper: wrapper(registry),
    });
    expect(screen.getByText('nothing')).toBeInTheDocument();

    registry.getState().register(
      { kind: 'core', id: 'c', label: 'c' },
      {
        'home.widgets': [{ id: 'x', title: 'Title X', component: () => <span>body</span> }],
      },
    );
    rerender(
      <Slot
        point="home.widgets"
        render={(widget, content) => <section aria-label={widget.title}>{content}</section>}
      />,
    );
    expect(screen.getByRole('region', { name: 'Title X' })).toHaveTextContent('body');
  });
});
