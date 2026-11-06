import fleet from '@oakestra/module-fleet';
import { http, HttpResponse } from '@oakestra/mocks';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { linkedAddons } from '../app/modules';
import { mockServer, mockStore, TEST_API_URL } from '../test/msw';
import { renderApp, type RenderAppOptions } from '../test/render';

const ADMIN = { username: 'Admin' };
const ALICE = { username: 'alice' };

function renderFleet(options: Partial<RenderAppOptions> = {}) {
  return renderApp({ linked: linkedAddons, route: '/fleet', user: ADMIN, ...options });
}

const board = () => screen.findByRole('list', { name: 'Fleet board' });

const card = (name: string) => screen.getByRole('group', { name });

function findService(name: string) {
  const service = mockStore.data.services.find((item) => item.microservice_name === name);
  if (!service) throw new Error(`no service ${name} in the seed`);
  return service;
}

describe('fleet (linked addon)', () => {
  it('is linked at /fleet, in the sidebar between Overview and Applications', async () => {
    expect(linkedAddons).toContainEqual({ definition: fleet, mount: '/fleet' });

    renderFleet();

    const link = await screen.findByTestId('nav-fleet-fleet');
    expect(link).toHaveAttribute('href', '/fleet');
    expect(await screen.findByRole('heading', { name: 'Fleet' })).toBeVisible();
    expect(screen.getByTestId('page-content')).toHaveAttribute('data-width', 'full');
  });

  it('shows an Admin every application, names foreign owners and says its scope', async () => {
    renderFleet();
    const cards = await board();

    expect(screen.getByTestId('fleet-summary')).toHaveTextContent(/^All applications run /);
    expect(within(cards).getByRole('heading', { name: /^analytics/ })).toHaveTextContent('alice');
    expect(within(cards).getByRole('heading', { name: 'webshop' })).toBeVisible();
  });

  it('shows everyone else their own applications', async () => {
    renderFleet({ user: ALICE });
    const cards = await board();

    expect(screen.getByTestId('fleet-summary')).toHaveTextContent(/^Your applications /);
    expect(within(cards).getByRole('heading', { name: 'analytics' })).toBeVisible();
    expect(within(cards).queryByRole('heading', { name: 'webshop' })).not.toBeInTheDocument();
  });

  it('has a card per cluster behind the Unplaced one, the silent cluster last', async () => {
    renderFleet();
    const cards = await board();

    const names = within(cards)
      .getAllByRole('group')
      .map((item) => item.getAttribute('aria-label'));
    expect(names[0]).toBe('Unplaced');
    expect(names[1]).toBe('test-cluster');
    expect(names[2]).toBe('edge-munich');
    expect(within(card('test-cluster')).getByText(/^\d+ active nodes?$/)).toBeVisible();
    expect(within(card('test-cluster')).getByText('Active')).toBeVisible();
  });

  it('marks a silent cluster and says when it was last seen', async () => {
    renderFleet();
    await board();

    const silent = mockStore.data.clusters.find((cluster) => !cluster.active)!;
    const header = within(card(silent.cluster_name)).getByRole('button', {
      name: /^Inspect cluster/,
    });
    expect(header).toHaveTextContent('Silent');
    expect(header).toHaveTextContent(/Last seen /);
  });

  it('lists the services of a cluster by application, and unplaced ones apart', async () => {
    renderFleet();
    await board();

    const cluster = within(card('test-cluster'));
    expect(cluster.getByRole('heading', { name: 'webshop' })).toBeVisible();
    expect(cluster.getByRole('button', { name: /^frontend on test-cluster: / })).toBeVisible();

    const unplaced = within(card('Unplaced'));
    expect(unplaced.getByRole('heading', { name: 'mlbatch' })).toBeVisible();
    expect(unplaced.getByRole('button', { name: /^trainer unplaced: / })).toBeVisible();
  });

  it('selects with real toggle buttons, and a second press closes the inspector', async () => {
    const { user, router } = renderFleet();
    await board();

    const row = within(card('test-cluster')).getByRole('button', { name: /^frontend on / });
    expect(row).toHaveAttribute('aria-pressed', 'false');

    row.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.search).toMatch(/^\?select=service/));
    // The router state is ahead of the render, so the DOM needs its own wait.
    await waitFor(() => expect(row).toHaveAttribute('aria-pressed', 'true'));

    await user.click(row);
    await waitFor(() => expect(router.state.location.search).toBe(''));
    await waitFor(() => expect(row).toHaveAttribute('aria-pressed', 'false'));
  });

  it('selects a cluster from its header', async () => {
    const { user } = renderFleet();
    await board();

    const header = within(card('test-cluster')).getByRole('button', { name: /^Inspect cluster/ });
    await user.click(header);

    expect(await screen.findByRole('dialog', { name: 'test-cluster' })).toBeVisible();
    expect(header).toHaveAttribute('aria-pressed', 'true');
  });

  it('never counts an instance on a silent cluster as running', async () => {
    const running = mockStore.data.services
      .flatMap((service) => service.instance_list)
      .filter((instance) => instance.status === 'RUNNING').length;
    const frontend = findService('frontend');
    const silentCluster = mockStore.data.clusters.find((cluster) => !cluster.active)!;
    frontend.instance_list[0]!.cluster_id = silentCluster._id;

    renderFleet();
    const cards = await board();

    expect(screen.getByTestId('fleet-summary')).toHaveTextContent(`run ${running - 1} instances`);
    expect(
      within(cards).getByRole('button', { name: /^frontend on edge-munich: 1 last known Running/ }),
    ).toBeVisible();
  });

  it('lists exceptions, and each opens the inspector', async () => {
    const { user } = renderFleet();

    const list = await screen.findByRole('region', { name: 'Needs attention' });
    await user.click(
      within(list).getByRole('button', { name: /mlbatch \/ trainer can't be placed/ }),
    );

    const inspector = await screen.findByRole('dialog', { name: 'trainer' });
    expect(within(inspector).getByText("This service can't be placed")).toBeVisible();
    expect(
      within(inspector).getByRole('link', { name: 'See what each cluster is missing' }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/applications\/[^/]+\/services\/[^/]+$/));
  });

  it('links to no page of an application the user does not own', async () => {
    const warehouse = findService('warehouse');
    renderFleet({ route: `/fleet?select=service:${warehouse._id}` });

    const inspector = await screen.findByRole('dialog', { name: 'warehouse' });
    expect(within(inspector).getByText('Owner')).toBeVisible();
    expect(within(inspector).getByText('alice')).toBeVisible();
    expect(within(inspector).getByText(/Only the owner can open its pages/)).toBeVisible();
    expect(within(inspector).queryByRole('link')).not.toBeInTheDocument();
  });

  it('links to the pages of an owned application', async () => {
    const frontend = findService('frontend');
    const app = `/applications/${frontend.applicationID}`;
    renderFleet({ route: `/fleet?select=service:${frontend._id}:0` });

    const inspector = await screen.findByRole('dialog', { name: 'Instance 0' });
    expect(within(inspector).getByRole('link', { name: 'Open instance' })).toHaveAttribute(
      'href',
      `${app}/services/${frontend._id}/instances/0`,
    );
  });

  it('links to a cluster only for roles that may open it', async () => {
    const [cluster] = mockStore.data.clusters;
    const route = `/fleet?select=cluster:${cluster!._id}`;
    const first = renderFleet({ route });
    const inspector = await screen.findByRole('dialog', { name: 'test-cluster' });
    expect(within(inspector).getByRole('link', { name: 'Open cluster' })).toHaveAttribute(
      'href',
      `/infrastructure/clusters/${cluster!._id}`,
    );
    first.unmount();

    renderFleet({ route, user: ALICE });
    const denied = await screen.findByRole('dialog', { name: 'test-cluster' });
    expect(within(denied).queryByRole('link')).not.toBeInTheDocument();
  });

  it('leaves no link to a module a preset switched off', async () => {
    const frontend = findService('frontend');
    renderFleet({
      route: `/fleet?select=service:${frontend._id}`,
      preset: { modules: ['fleet'] },
    });

    const inspector = await screen.findByRole('dialog', { name: 'frontend' });
    expect(within(inspector).queryByRole('link')).not.toBeInTheDocument();
  });

  it('never shows environment values', async () => {
    const frontend = findService('frontend');
    frontend.environment = ['API_TOKEN=hunter2'];
    renderFleet({ route: `/fleet?select=service:${frontend._id}` });

    await screen.findByRole('dialog', { name: 'frontend' });
    expect(document.body).not.toHaveTextContent('hunter2');
  });

  it('switches the lens through the URL and shows no data for unmeasured instances', async () => {
    const ingest = findService('ingest');
    ingest.instance_list = ingest.instance_list.map((instance) => ({
      ...instance,
      cpu_percent: '0',
      cpu_history: [],
      memory_percent: '0',
    }));
    const { user, router } = renderFleet();
    const cards = await board();

    await user.click(screen.getByRole('radio', { name: 'CPU' }));

    await waitFor(() => expect(router.state.location.search).toBe('?lens=cpu'));
    // 0 without any history is not the same as idle.
    expect(
      await within(cards).findByRole('button', { name: /^ingest on test-cluster:.*no data/ }),
    ).toHaveTextContent('No data');
  });

  it('filters by name and to exceptions, dropping the clusters without a hit', async () => {
    const { user } = renderFleet();
    const cards = await board();

    await user.type(screen.getByRole('searchbox'), 'ingest');
    await waitFor(() =>
      expect(within(cards).queryByRole('heading', { name: 'webshop' })).not.toBeInTheDocument(),
    );
    expect(within(cards).getByRole('button', { name: /^ingest on / })).toBeVisible();
    expect(within(cards).queryByRole('group', { name: 'Unplaced' })).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.click(screen.getByRole('switch', { name: 'Only exceptions' }));
    await waitFor(() =>
      expect(within(cards).queryByRole('heading', { name: /^analytics/ })).not.toBeInTheDocument(),
    );
    expect(within(cards).getByRole('heading', { name: 'mlbatch' })).toBeVisible();
  });

  it('says when nothing matches and offers the way back', async () => {
    const { user } = renderFleet();
    await board();

    await user.type(screen.getByRole('searchbox'), 'no such thing');
    expect(await screen.findByText('Nothing matches')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Fleet board' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await board()).toBeVisible();
  });

  it('keeps an application on the board that has no services to show', async () => {
    mockStore.data.services = mockStore.data.services.filter(
      (service) => service.app_name !== 'analytics',
    );
    renderFleet();
    await board();

    const unplaced = within(card('Unplaced'));
    expect(unplaced.getByRole('heading', { name: /^analytics/ })).toBeVisible();
    expect(unplaced.getByText('No services')).toBeVisible();
  });

  it('explains itself to someone without applications and shows the clusters anyway', async () => {
    renderFleet({ user: { username: 'bob' } });
    const cards = await board();

    expect(within(cards).getByRole('group', { name: 'test-cluster' })).toBeVisible();
    expect(screen.getByText('You have no applications')).toBeVisible();
    // bob is an Infrastructure_Provider, nothing here is his job.
    expect(screen.queryByRole('link', { name: 'New application' })).not.toBeInTheDocument();
  });

  it('offers a new application to those who deploy', async () => {
    mockStore.data.applications = mockStore.data.applications.filter(
      (application) => application.userId !== 'alice',
    );
    renderFleet({ user: ALICE });

    expect(await screen.findByRole('link', { name: 'New application' })).toHaveAttribute(
      'href',
      '/applications',
    );
  });

  it('copes with no clusters: everything is unplaced', async () => {
    mockStore.data.clusters = [];
    renderFleet();
    const cards = await board();

    expect(screen.getByText(/No clusters are registered/)).toBeVisible();
    expect(
      within(cards)
        .getAllByRole('group')
        .map((item) => item.ariaLabel),
    ).toEqual(['Unplaced']);
    expect(screen.getByTestId('fleet-summary')).toHaveTextContent(/have nothing running/);
  });

  it('shows one error when there is nothing to show', async () => {
    mockServer.use(
      http.get(`${TEST_API_URL}/services/`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    renderFleet();

    expect(await screen.findByText('Could not load the fleet')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Fleet board' })).not.toBeInTheDocument();
  });

  it('keeps the last services of an application whose refresh fails, and retries it', async () => {
    const { services, user } = renderFleet({ user: ALICE });
    const cards = await board();

    let down = true;
    mockServer.use(
      http.get(`${TEST_API_URL}/services/:appId`, () =>
        down ? HttpResponse.json({ message: 'boom' }, { status: 500 }) : undefined,
      ),
    );
    await services.queryClient.refetchQueries();

    expect(await screen.findByText(/Could not refresh/)).toBeVisible();
    expect(within(cards).getByRole('heading', { name: 'analytics' })).toBeVisible();
    expect(screen.queryByText('Services could not be loaded')).not.toBeInTheDocument();
    expect(document.querySelector('[data-sonner-toast]')).toBeNull();

    down = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.queryByText(/Could not refresh/)).not.toBeInTheDocument());
  });

  it('says so when the services of an application never loaded', async () => {
    mockServer.use(
      http.get(`${TEST_API_URL}/services/:appId`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    renderFleet({ user: ALICE });

    expect((await screen.findAllByText('Services could not be loaded'))[0]).toBeVisible();
    expect(screen.getByText(/Could not refresh/)).toBeVisible();
  });

  it('keeps the data and shows one banner when a refresh fails', async () => {
    const { services } = renderFleet();
    await board();

    mockServer.use(
      http.get(`${TEST_API_URL}/services/`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
      http.get(`${TEST_API_URL}/applications/`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    await services.queryClient.refetchQueries();

    expect(await screen.findByText(/Could not refresh/)).toBeVisible();
    expect(screen.getByRole('list', { name: 'Fleet board' })).toBeVisible();
    expect(screen.queryByText('Could not load the fleet')).not.toBeInTheDocument();
    // The toaster is mounted by the shell, one failed round must not reach it.
    expect(document.querySelector('[data-sonner-toast]')).toBeNull();
  });
});
