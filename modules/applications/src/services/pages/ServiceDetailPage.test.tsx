import type { Service } from '@oakestra/api';
import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceDetailPage } from './ServiceDetailPage';

const unplaced = {
  _id: 's1',
  microservice_name: 'frontend',
  status: 'NO_ACTIVE_CLUSTER_WITH_CAPACITY',
  instance_list: [],
  constraints: [],
  cmd: [],
  environment: [],
  args: [],
} as unknown as Service;

const placed = { ...unplaced, status: 'RUNNING' } as Service;

function renderPage(route: string, service: Service) {
  const get = vi.fn(() => Promise.resolve(service));
  const view = renderInHost(<ServiceDetailPage />, {
    api: { services: { get }, clusters: { list: () => Promise.resolve([]) } },
    route,
    path: '/apps/:appId/services/:serviceId',
    addon: { basePath: '/apps' },
  });
  return { ...view, get };
}

describe('ServiceDetailPage placement link', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    // jsdom does not implement it, so there is nothing to restore but the absence.
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  it('opens the placement section and scrolls to it once, not again after a refetch', async () => {
    const { queryClient, get } = renderPage('/apps/a1/services/s1#placement', unplaced);

    const panel = await screen.findByTestId('placement-panel');
    expect(panel).toHaveAttribute('id', 'placement');
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(panel);

    await queryClient.invalidateQueries();
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(1));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('does not scroll without the hash', async () => {
    renderPage('/apps/a1/services/s1', unplaced);

    await screen.findByTestId('placement-panel');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('does nothing for a service without a placement problem', async () => {
    renderPage('/apps/a1/services/s1#placement', placed);

    await screen.findByRole('heading', { name: /frontend/ });
    expect(screen.queryByTestId('placement-panel')).not.toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('leaves a tab the user picks afterwards alone', async () => {
    renderPage('/apps/a1/services/s1#placement', unplaced);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('tab', { name: /json/i }));

    expect(screen.getByRole('tab', { name: /json/i })).toHaveAttribute('data-state', 'active');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
