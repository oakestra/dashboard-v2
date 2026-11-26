import { http, HttpResponse } from '@oakestra/mocks';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { linkedAddons } from '../app/modules';
import { mockServer, mockStore, TEST_API_URL } from '../test/msw';
import { renderApp, type RenderAppOptions } from '../test/render';

const ADMIN = { username: 'Admin' };
const ALICE = { username: 'alice' };

const BOARD_ROUTE = '/applications?view=clusters';

function renderBoard(options: Partial<RenderAppOptions> = {}) {
  return renderApp({ linked: linkedAddons, route: BOARD_ROUTE, user: ADMIN, ...options });
}

// The board is lazy, so the first query of a test has to wait for its chunk.
const board = () => screen.findByRole('list', { name: 'Applications by cluster' });

const card = (name: string) => screen.getByRole('group', { name });

function findService(name: string) {
  const service = mockStore.data.services.find((item) => item.microservice_name === name);
  if (!service) throw new Error(`no service ${name} in the seed`);
  return service;
}

function searchOf(router: { state: { location: { search: string } } }) {
  return Object.fromEntries(new URLSearchParams(router.state.location.search));
}

// The seed has no instance of the viewer on its silent cluster; this puts one there.
function runOnSilentCluster(serviceName: string) {
  const silentCluster = mockStore.data.clusters.find((cluster) => !cluster.active)!;
  findService(serviceName).instance_list[0]!.cluster_id = silentCluster._id;
  return silentCluster;
}

const idleLine = () => screen.getByTestId('board-idle-clusters');

const failing = (path: string) =>
  http.get(`${TEST_API_URL}${path}`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }));

describe('applications board, the "By cluster" view (linked addon)', () => {
  it('switches between the list and the board through the URL and keeps the search', async () => {
    const { user, router } = renderBoard({ route: '/applications?q=web' });

    await screen.findByRole('link', { name: 'webshop' });
    expect(screen.getByRole('heading', { level: 1, name: 'Applications' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'By cluster' }));
    await board();
    expect(searchOf(router)).toEqual({ q: 'web', view: 'clusters' });
    expect(screen.getByRole('searchbox')).toHaveValue('web');
    expect(screen.getByRole('radio', { name: 'By cluster' })).toBeChecked();
    expect(screen.queryByRole('heading', { name: 'iotpipe' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'List' }));
    await waitFor(() => expect(searchOf(router)).toEqual({ q: 'web' }));
    // The board links to webshop too, so wait for the board to go away first.
    await waitFor(() =>
      expect(
        screen.queryByRole('list', { name: 'Applications by cluster' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: 'webshop' })).toBeVisible();
  });

  it('has no Fleet entry in the sidebar', async () => {
    renderBoard();
    await board();

    expect(screen.queryByTestId('nav-fleet-fleet')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Fleet' })).not.toBeInTheDocument();
  });

  it('shows the user only their own applications and says what runs', async () => {
    renderBoard();
    const cards = await board();

    expect(screen.getByTestId('board-summary')).toHaveTextContent(/^Your applications run /);
    expect(screen.getByTestId('board-updated')).toHaveTextContent(/^Updated /);
    // Admin owns webshop, iotpipe and mlbatch. analytics is alice's, and an Admin does not see it.
    expect(within(cards).getByRole('heading', { name: 'webshop' })).toBeVisible();
    expect(within(cards).getByRole('heading', { name: 'iotpipe' })).toBeVisible();
    expect(within(cards).queryByRole('heading', { name: 'analytics' })).not.toBeInTheDocument();
  });

  it('shows everyone else their own applications too', async () => {
    renderBoard({ user: ALICE });
    const cards = await board();

    expect(await within(cards).findByRole('heading', { name: 'analytics' })).toBeVisible();
    expect(within(cards).queryByRole('heading', { name: 'webshop' })).not.toBeInTheDocument();
  });

  it('has a card per cluster with services of the viewer behind the Unplaced one, the silent cluster last', async () => {
    runOnSilentCluster('frontend');
    renderBoard();
    const cards = await board();

    const names = within(cards)
      .getAllByRole('group')
      .map((item) => item.getAttribute('aria-label'));
    expect(names).toEqual(['Unplaced', 'test-cluster', 'edge-munich']);
    expect(within(card('test-cluster')).getByText(/^\d+ active nodes?$/)).toBeVisible();
    expect(within(card('test-cluster')).getByText('Active')).toBeVisible();
  });

  it('marks a silent cluster and says when it was last seen', async () => {
    runOnSilentCluster('frontend');
    renderBoard();
    await board();

    const silent = within(card('edge-munich'));
    expect(silent.getByText('Silent')).toBeVisible();
    expect(silent.getByText(/^Last seen /)).toBeVisible();
    expect(within(card('test-cluster')).queryByText(/Last seen/)).not.toBeInTheDocument();
  });

  it('lists the services of a cluster by application, and unplaced ones apart', async () => {
    renderBoard();
    await board();

    const cluster = within(card('test-cluster'));
    expect(cluster.getByRole('heading', { name: 'webshop' })).toBeVisible();
    expect(cluster.getByRole('link', { name: /^frontend on test-cluster: / })).toBeVisible();

    const unplaced = within(card('Unplaced'));
    expect(unplaced.getByRole('heading', { name: 'mlbatch' })).toBeVisible();
    expect(unplaced.getByRole('link', { name: /^trainer unplaced: / })).toBeVisible();
  });

  it('never counts an instance on a silent cluster as running', async () => {
    const running = mockStore.data.services
      .flatMap((service) => service.instance_list)
      .filter((instance) => instance.status === 'RUNNING').length;
    const silentCluster = mockStore.data.clusters.find((cluster) => !cluster.active)!;
    findService('frontend').instance_list[0]!.cluster_id = silentCluster._id;

    renderBoard();
    const cards = await board();

    expect(screen.getByTestId('board-summary')).toHaveTextContent(`run ${running - 1} instances`);
    expect(
      within(cards).getByRole('link', { name: /^frontend on edge-munich: 1 last known Running/ }),
    ).toBeVisible();
  });

  it('links the rows, the application headings and, for those who may open it, the cluster', async () => {
    const frontend = findService('frontend');
    const trainer = findService('trainer');
    renderBoard();
    await board();

    const cluster = within(card('test-cluster'));
    expect(cluster.getByRole('link', { name: /^frontend on test-cluster: / })).toHaveAttribute(
      'href',
      `/applications/${frontend.applicationID}/services/${frontend._id}`,
    );
    expect(cluster.getByRole('link', { name: 'webshop' })).toHaveAttribute(
      'href',
      `/applications/${frontend.applicationID}`,
    );
    const clusterId = mockStore.data.clusters.find(
      (item) => item.cluster_name === 'test-cluster',
    )!._id;
    expect(cluster.getByRole('link', { name: 'test-cluster' })).toHaveAttribute(
      'href',
      `/infrastructure/clusters/${clusterId}`,
    );

    const unplaced = within(card('Unplaced'));
    expect(unplaced.getByRole('link', { name: /^trainer unplaced: / })).toHaveAttribute(
      'href',
      `/applications/${trainer.applicationID}/services/${trainer._id}#placement`,
    );
    expect(unplaced.getByRole('link', { name: 'mlbatch' })).toHaveAttribute(
      'href',
      `/applications/${trainer.applicationID}`,
    );
  });

  it('opens a service from its row', async () => {
    const frontend = findService('frontend');
    const { user, router } = renderBoard();
    await board();

    await user.click(
      within(card('test-cluster')).getByRole('link', { name: /^frontend on test-cluster: / }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/applications/${frontend.applicationID}/services/${frontend._id}`,
      ),
    );
  });

  it('shows the cluster as plain text to a role that may not open it', async () => {
    renderBoard({ user: ALICE });
    await board();

    expect(idleLine()).toHaveTextContent('test-cluster');
    expect(within(idleLine()).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the cluster as plain text when a preset drops the infrastructure module', async () => {
    renderBoard({ preset: { modules: ['applications'], home: '/applications' } });
    await board();

    expect(
      within(card('test-cluster')).getByRole('heading', { name: 'test-cluster' }),
    ).toBeVisible();
    expect(screen.queryByRole('link', { name: 'test-cluster' })).not.toBeInTheDocument();
    expect(within(idleLine()).queryByRole('link')).not.toBeInTheDocument();
  });

  it('sums up the clusters without services of the viewer in a line, linked for those who may open them', async () => {
    const silentCluster = mockStore.data.clusters.find((cluster) => !cluster.active)!;
    renderBoard();
    const cards = await board();

    // Admin's services all sit on test-cluster or nowhere, so the silent cluster has no card.
    expect(within(cards).queryByRole('group', { name: 'edge-munich' })).not.toBeInTheDocument();
    expect(idleLine()).toHaveTextContent(
      /^\d+ more clusters? runs? nothing of yours: .*edge-munich \(silent\)/,
    );
    expect(within(idleLine()).getByRole('link', { name: 'edge-munich' })).toHaveAttribute(
      'href',
      `/infrastructure/clusters/${silentCluster._id}`,
    );
  });

  it('keeps the card of a silent cluster that holds an instance of the viewer', async () => {
    runOnSilentCluster('frontend');
    renderBoard();
    const cards = await board();

    expect(within(cards).getByRole('group', { name: 'edge-munich' })).toBeVisible();
    // Both seeded clusters now hold something, so nothing is left for the line.
    expect(screen.queryByTestId('board-idle-clusters')).not.toBeInTheDocument();
  });

  it('switches the lens through the URL and shows no data for unmeasured instances', async () => {
    const ingest = findService('ingest');
    ingest.instance_list = ingest.instance_list.map((instance) => ({
      ...instance,
      cpu_percent: '0',
      cpu_history: [],
      memory_percent: '0',
    }));
    const { user, router } = renderBoard();
    const cards = await board();

    await user.click(screen.getByRole('radio', { name: 'CPU' }));

    await waitFor(() => expect(searchOf(router)).toEqual({ view: 'clusters', lens: 'cpu' }));
    // 0 without any history is not the same as idle.
    expect(
      await within(cards).findByRole('link', { name: /^ingest on test-cluster:.*no data/ }),
    ).toHaveTextContent('No data');
  });

  it('opens on the lens named in the URL', async () => {
    renderBoard({ route: `${BOARD_ROUTE}&lens=memory` });
    await board();

    expect(screen.getByRole('radio', { name: 'Memory' })).toBeChecked();
  });

  it('filters by name and to services that need attention, dropping the clusters without a hit', async () => {
    const { user, router } = renderBoard();
    const cards = await board();

    await user.type(screen.getByRole('searchbox'), 'ingest');
    await waitFor(() =>
      expect(within(cards).queryByRole('heading', { name: 'webshop' })).not.toBeInTheDocument(),
    );
    expect(searchOf(router)).toEqual({ view: 'clusters', q: 'ingest' });
    expect(within(cards).getByRole('link', { name: /^ingest on / })).toBeVisible();
    expect(within(cards).queryByRole('group', { name: 'Unplaced' })).not.toBeInTheDocument();
    expect(within(cards).queryByRole('group', { name: 'edge-munich' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('board-idle-clusters')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.click(screen.getByRole('switch', { name: 'Needs attention only' }));
    // Clearing the search shows the idle line again for a moment.
    await waitFor(() =>
      expect(screen.queryByTestId('board-idle-clusters')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(within(cards).queryByRole('heading', { name: 'iotpipe' })).not.toBeInTheDocument(),
    );
    expect(searchOf(router)).toMatchObject({ only: 'attention' });
    expect(within(cards).getByRole('heading', { name: 'mlbatch' })).toBeVisible();
    expect(within(cards).queryByRole('heading', { name: 'webshop' })).not.toBeInTheDocument();
  });

  it('says when nothing matches and offers the way back', async () => {
    const { user } = renderBoard();
    await board();

    await user.type(screen.getByRole('searchbox'), 'no such thing');
    expect(await screen.findByText('Nothing matches')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Applications by cluster' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await board()).toBeVisible();
  });

  it('keeps an application on the board that has no services to show', async () => {
    mockStore.data.services = mockStore.data.services.filter(
      (service) => service.app_name !== 'analytics',
    );
    renderBoard({ user: ALICE });
    await board();

    const unplaced = await screen.findByRole('group', { name: 'Unplaced' });
    expect(within(unplaced).getByRole('heading', { name: 'analytics' })).toBeVisible();
    expect(within(unplaced).getByText('No services')).toBeVisible();
  });

  it('explains itself to someone without applications and lists the clusters in a line', async () => {
    const { user } = renderBoard({ user: { username: 'bob' } });
    const cards = await board();

    expect(within(cards).queryAllByRole('group')).toEqual([]);
    expect(screen.getByText('No applications yet')).toBeVisible();
    expect(idleLine()).toHaveTextContent(/nothing of yours: .*test-cluster/);
    expect(screen.getByTestId('board-summary')).toHaveTextContent(
      /^You have no applications yet\.$/,
    );
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();

    // The header button and the empty state's one both open the create dialog.
    const [, fromEmptyState] = screen.getAllByRole('button', { name: 'New application' });
    await user.click(fromEmptyState!);
    expect(await screen.findByRole('dialog')).toBeVisible();
  });

  it('copes with no clusters: everything is unplaced', async () => {
    mockStore.data.clusters = [];
    renderBoard();
    const cards = await board();

    expect(screen.getByText(/No clusters are registered/)).toBeVisible();
    expect(
      within(cards)
        .getAllByRole('group')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual(['Unplaced']);
    expect(screen.queryByTestId('board-idle-clusters')).not.toBeInTheDocument();
    expect(screen.getByTestId('board-summary')).toHaveTextContent(/have nothing running/);
  });

  it('shows one error when there is nothing to show', async () => {
    mockServer.use(failing('/clusters/'));
    renderBoard();

    expect(await screen.findByText('Could not load your applications')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Applications by cluster' })).not.toBeInTheDocument();
  });

  it('keeps the data and shows one banner when a refresh fails', async () => {
    const { services } = renderBoard();
    await board();

    mockServer.use(failing('/clusters/'), failing('/applications/:userId'));
    await services.queryClient.refetchQueries();

    expect(await screen.findByText(/Could not refresh/)).toBeVisible();
    expect(screen.getAllByText(/Could not refresh/)).toHaveLength(1);
    expect(screen.getByRole('list', { name: 'Applications by cluster' })).toBeVisible();
    expect(screen.queryByText('Could not load your applications')).not.toBeInTheDocument();
    // The toaster is mounted by the shell, one failed round must not reach it.
    expect(document.querySelector('[data-sonner-toast]')).toBeNull();
  });

  it('keeps the last services of an application whose refresh fails, and retries it', async () => {
    const { services, user } = renderBoard({ user: ALICE });
    const cards = await board();
    expect(await within(cards).findByText('analytics')).toBeVisible();

    let down = true;
    mockServer.use(
      http.get(`${TEST_API_URL}/services/:appId`, () =>
        down ? HttpResponse.json({ message: 'boom' }, { status: 500 }) : undefined,
      ),
    );
    await services.queryClient.refetchQueries();

    expect(await screen.findByText(/Could not refresh/)).toBeVisible();
    expect(within(cards).getByRole('link', { name: 'analytics' })).toBeVisible();
    expect(within(cards).getByRole('link', { name: /^warehouse unplaced: / })).toBeVisible();
    expect(screen.queryByText('Services could not be loaded')).not.toBeInTheDocument();
    expect(document.querySelector('[data-sonner-toast]')).toBeNull();

    down = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.queryByText(/Could not refresh/)).not.toBeInTheDocument());
  });

  it('says so when the services of an application never loaded', async () => {
    mockServer.use(failing('/services/:appId'));
    renderBoard({ user: ALICE });

    expect((await screen.findAllByText('Services could not be loaded'))[0]).toBeVisible();
    expect(screen.getByText(/Could not refresh/)).toBeVisible();
  });
});
