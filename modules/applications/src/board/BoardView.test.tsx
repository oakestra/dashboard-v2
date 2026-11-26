import { renderInHost, type RenderInHostOptions } from '@oakestra/dashboard-sdk/testing';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ApplicationsPage } from '../applications/pages/ApplicationsPage';

const addon = { addonId: 'applications', basePath: '/applications' };
const alice = { username: 'alice', roles: ['Application_Provider'] };

const shop = {
  _id: 'a1',
  application_name: 'shop',
  application_namespace: 'shop',
  application_desc: '',
  microservices: ['s1', 's2'],
};
const services = [
  {
    _id: 's1',
    microservice_name: 'web',
    status: 'RUNNING',
    applicationID: 'a1',
    instance_list: [{ instance_number: 0, status: 'RUNNING', cluster_id: 'c1' }],
  },
  {
    _id: 's2',
    microservice_name: 'worker',
    status: 'NoActiveClusterWithCapacity',
    applicationID: 'a1',
    instance_list: [],
  },
];
const clusters = [
  {
    _id: 'c1',
    cluster_name: 'edge',
    active: true,
    active_nodes: 2,
    virtualization: [],
    last_modified_timestamp: new Date(),
  },
];

const api = {
  users: { get: () => Promise.resolve({ _id: 'u1', name: 'alice' } as never) },
  applications: { listForUser: () => Promise.resolve([shop] as never) },
  services: { listForApplication: () => Promise.resolve(services as never) },
  clusters: { list: () => Promise.resolve(clusters as never) },
};

function Location() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{pathname + search}</output>;
}

function renderPage(options: Partial<RenderInHostOptions> = {}) {
  return renderInHost(
    <>
      <ApplicationsPage />
      <Location />
    </>,
    { api, addon, user: alice, route: '/applications?view=clusters', ...options },
  );
}

const board = () => screen.findByRole('list', { name: 'Applications by cluster' });

describe('applications by cluster', () => {
  it('switches between the list and the board through the URL, keeping the search', async () => {
    const user = userEvent.setup();
    renderPage({ route: '/applications?q=sh' });

    expect(await screen.findByRole('radio', { name: 'List' })).toBeChecked();
    expect(screen.queryByRole('list', { name: 'Applications by cluster' })).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'By cluster' }));
    expect(await board()).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/applications?q=sh&view=clusters');
    expect(screen.getByRole('searchbox', { name: /applications and services/ })).toHaveValue('sh');

    await user.click(screen.getByRole('radio', { name: 'List' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/applications\?q=sh$/);
    expect(screen.queryByRole('list', { name: 'Applications by cluster' })).toBeNull();
  });

  it('links the rows to their services and the application names to the application', async () => {
    renderPage();

    const cluster = within(await board()).getByRole('group', { name: 'edge' });
    expect(within(cluster).getByRole('link', { name: 'web on edge: 1 Running' })).toHaveAttribute(
      'href',
      '/applications/a1/services/s1',
    );
    expect(within(cluster).getByRole('link', { name: 'shop' })).toHaveAttribute(
      'href',
      '/applications/a1',
    );

    const unplaced = screen.getByRole('group', { name: 'Unplaced' });
    // The hash lands on the placement explanation of the service page.
    expect(
      within(unplaced).getByRole('link', { name: /^worker unplaced: No capacity/ }),
    ).toHaveAttribute('href', '/applications/a1/services/s2#placement');
    expect(screen.getByTestId('board-summary')).toHaveTextContent(
      'Your applications run 1 instance of 1 service on 1 cluster, and 1 service needs attention.',
    );
  });

  it('links the cluster to its page only for those who may open it', async () => {
    const { unmount } = renderPage({
      user: { username: 'bob', roles: ['Infrastructure_Provider'] },
    });
    const cluster = within(await board()).getByRole('group', { name: 'edge' });
    expect(within(cluster).getByRole('link', { name: 'edge' })).toHaveAttribute(
      'href',
      '/infrastructure/clusters/c1',
    );
    unmount();

    renderPage();
    const plain = within(await board()).getByRole('group', { name: 'edge' });
    expect(within(plain).getByRole('heading', { name: 'edge' })).toBeVisible();
    expect(within(plain).queryByRole('link', { name: 'edge' })).toBeNull();
  });

  it('does not link the cluster when the infrastructure module is off', async () => {
    renderPage({ user: { username: 'Admin', roles: ['Admin'] }, features: ['applications'] });

    const cluster = within(await board()).getByRole('group', { name: 'edge' });
    expect(within(cluster).queryByRole('link', { name: 'edge' })).toBeNull();
  });

  describe('clusters without services of the viewer', () => {
    const idle = (id: string, name: string, overrides: object = {}) => ({
      ...clusters[0]!,
      _id: id,
      cluster_name: name,
      ...overrides,
    });
    const withClusters = (...extra: object[]) => ({
      ...api,
      clusters: { list: () => Promise.resolve([...clusters, ...extra] as never) },
    });
    const line = () => screen.findByTestId('board-idle-clusters');

    it('sums them up in one line instead of giving them a card', async () => {
      renderPage({ api: withClusters(idle('c2', 'edge-a'), idle('c3', 'edge-b')) });

      const cards = await board();
      expect(
        within(cards)
          .getAllByRole('group')
          .map((item) => item.getAttribute('aria-label')),
      ).toEqual(['Unplaced', 'edge']);
      expect(await line()).toHaveTextContent(
        '2 more clusters run nothing of yours: edge-a, edge-b',
      );
      expect(screen.queryByText('Nothing of yours runs here.')).toBeNull();
    });

    it('uses the singular for one cluster', async () => {
      renderPage({ api: withClusters(idle('c2', 'edge-a')) });

      expect(await line()).toHaveTextContent(/^1 more cluster runs nothing of yours: edge-a$/);
    });

    it('cuts a long list', async () => {
      const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((name, index) =>
        idle(`x${index}`, `edge-${name}`),
      );
      renderPage({ api: withClusters(...names) });

      const text = await line();
      expect(text).toHaveTextContent(
        '8 more clusters run nothing of yours: edge-a, edge-b, edge-c, edge-d, edge-e and 3 more',
      );
      expect(within(text).queryByText('edge-h')).toBeNull();
    });

    it('marks clusters that are not reporting in words', async () => {
      renderPage({
        api: withClusters(
          idle('c2', 'edge-off', { active: false }),
          idle('n', 'edge-new', { active: false, last_modified_timestamp: undefined }),
        ),
      });

      expect(await line()).toHaveTextContent(
        '2 more clusters run nothing of yours: edge-off (silent), edge-new (never reported)',
      );
    });

    it('links the names only for those who may open a cluster', async () => {
      const extra = withClusters(idle('c2', 'edge-a'));
      const { unmount } = renderPage({
        api: extra,
        user: { username: 'bob', roles: ['Infrastructure_Provider'] },
      });
      expect(within(await line()).getByRole('link', { name: 'edge-a' })).toHaveAttribute(
        'href',
        '/infrastructure/clusters/c2',
      );
      unmount();

      renderPage({ api: extra });
      expect(within(await line()).queryByRole('link')).toBeNull();
    });

    it('does not link the names when the infrastructure module is off', async () => {
      renderPage({
        api: withClusters(idle('c2', 'edge-a')),
        user: { username: 'Admin', roles: ['Admin'] },
        features: ['applications'],
      });

      expect(within(await line()).queryByRole('link')).toBeNull();
    });

    it('hides the line while a filter is active', async () => {
      const user = userEvent.setup();
      renderPage({ api: withClusters(idle('c2', 'edge-a')) });
      await line();

      await user.type(screen.getByRole('searchbox'), 'web');
      await waitFor(() => expect(screen.queryByTestId('board-idle-clusters')).toBeNull());

      await user.clear(screen.getByRole('searchbox'));
      expect(await line()).toBeVisible();

      await user.click(screen.getByRole('switch', { name: 'Needs attention only' }));
      await waitFor(() => expect(screen.queryByTestId('board-idle-clusters')).toBeNull());
      expect(screen.getByTestId('location')).toHaveTextContent('only=attention');
    });

    it('keeps the card of a silent cluster that holds an instance of the viewer', async () => {
      const silent = idle('c2', 'edge-off', { active: false });
      const onSilent = [
        {
          ...services[0]!,
          instance_list: [{ instance_number: 0, status: 'RUNNING', cluster_id: 'c2' }],
        },
        services[1],
      ];
      renderPage({
        api: {
          ...withClusters(silent),
          services: { listForApplication: () => Promise.resolve(onSilent as never) },
        },
      });

      const cards = await board();
      expect(within(cards).getByRole('group', { name: 'edge-off' })).toBeVisible();
      expect(within(cards).queryByRole('group', { name: 'edge' })).toBeNull();
      expect(await line()).toHaveTextContent(/^1 more cluster runs nothing of yours: edge$/);
    });

    it('has no line without clusters, and keeps saying so', async () => {
      renderPage({ api: { ...api, clusters: { list: () => Promise.resolve([] as never) } } });

      await board();
      expect(screen.getByText(/No clusters are registered/)).toBeVisible();
      expect(screen.queryByTestId('board-idle-clusters')).toBeNull();
    });

    it('shows the line and no cards to someone without applications', async () => {
      renderPage({
        api: {
          ...withClusters(idle('c2', 'edge-a')),
          applications: { listForUser: () => Promise.resolve([] as never) },
        },
      });

      await board();
      expect(await line()).toHaveTextContent('2 more clusters run nothing of yours: edge, edge-a');
      expect(screen.queryAllByRole('group')).toEqual([]);
      expect(screen.getByTestId('board-summary')).toHaveTextContent(
        /^You have no applications yet\.$/,
      );
    });
  });
});
