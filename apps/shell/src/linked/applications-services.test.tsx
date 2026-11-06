import { http, HttpResponse, withPlacementDemo } from '@oakestra/mocks';
import type { SlaV2 } from '@oakestra/api';
import type { Contributions } from '@oakestra/dashboard-sdk';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { linkedAddons } from '../app/modules';
import { addonSource } from '../core/addons/ui-addons';
import { mockServer, mockStore, TEST_API_URL } from '../test/msw';
import { renderApp } from '../test/render';

const frontend = () => mockStore.data.services.find((s) => s.microservice_name === 'frontend')!;
const base = () => `/applications/${frontend().applicationID}/services/${frontend()._id}`;

async function chooseFromMenu(user: UserEvent, item: RegExp) {
  await user.click(await screen.findByRole('button', { name: 'More actions' }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

function renderService(route = base(), extra: Contributions = {}) {
  return renderApp({
    modules: [{ id: 'ext', label: 'Ext', routes: [], contributions: extra }],
    linked: linkedAddons,
    route,
  });
}

describe('service detail page (linked addon)', () => {
  it('shows the service header, overview and breadcrumbs', async () => {
    renderService();

    expect(await screen.findByRole('heading', { name: /frontend/ })).toBeVisible();
    expect(screen.getAllByTestId('status-badge')[0]).toHaveTextContent('Running');
    expect(screen.getByText('Requirements')).toBeVisible();
    expect(screen.getAllByTestId('status-badge')[0]).toHaveAttribute('data-status', 'RUNNING');
    expect(screen.getByRole('link', { name: /Duplicate/ })).toHaveAttribute(
      'href',
      `${base()}/duplicate`,
    );
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Applicationswebshopfrontend');
    // The backend cannot update services yet, so there is no edit action.
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it('lists instances, deploys a new one and undeploys after confirmation', async () => {
    const { user } = renderService();
    await user.click(await screen.findByRole('tab', { name: /Instances/ }));
    expect(await screen.findByRole('link', { name: 'Open instance 0' })).toHaveAttribute(
      'href',
      `${base()}/instances/0`,
    );
    expect(screen.getByRole('link', { name: 'Open instance 1' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: /Deploy instance/ }));
    await waitFor(() => expect(frontend().instance_list).toHaveLength(3));
    expect(await screen.findByRole('link', { name: 'Open instance 2' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Actions for instance 1' }));
    await user.click(await screen.findByRole('menuitem', { name: /Undeploy/ }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Undeploy' }));

    await waitFor(() =>
      expect(frontend().instance_list.map((i) => i.instance_number)).toEqual([0, 2]),
    );
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Open instance 1' })).not.toBeInTheDocument(),
    );
  });

  it('shows the SLA on the JSON tab with environment values masked', async () => {
    mockStore.data.services.find((s) => s.microservice_name === 'frontend')!.environment = [
      'API_TOKEN=hunter2',
    ];
    const { user } = renderService();
    await user.click(await screen.findByRole('tab', { name: 'JSON' }));
    expect(await screen.findByText(/"microservice_name": "frontend"/)).toBeVisible();
    expect(document.body).toHaveTextContent('API_TOKEN=********');
    expect(document.body).not.toHaveTextContent('hunter2');
  });

  it('shows environment keys but never their values on the overview', async () => {
    frontend().environment = ['API_TOKEN=hunter2'];
    renderService();
    expect(await screen.findByTestId('environment-keys')).toHaveTextContent('API_TOKEN');
    expect(document.body).not.toHaveTextContent('hunter2');
  });

  it('does not invite a second deploy while the scheduler works', async () => {
    frontend().instance_list = [];
    frontend().status = 'REQUESTED';
    const { user } = renderService();
    await user.click(await screen.findByRole('tab', { name: /Instances/ }));
    expect(await screen.findByText('Waiting for the scheduler')).toBeVisible();
    expect(screen.getByRole('button', { name: /Deploy instance/ })).toBeDisabled();
  });

  it('exports the SLA as a download', async () => {
    const created: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:test';
    });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = renderService();

    await chooseFromMenu(user, /Download SLA/);

    expect(click).toHaveBeenCalled();
    const sla = JSON.parse(await created[0]!.text()) as SlaV2;
    expect(sla.sla_version).toBe('v2.0');
    expect(sla.applications[0]!.microservices[0]).toMatchObject({ microservice_name: 'frontend' });
    expect(sla.applications[0]!.microservices[0]).not.toHaveProperty('instance_list');
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('renders tabs contributed to service.detail.tabs with both ids', async () => {
    const { user } = renderService(base(), {
      'service.detail.tabs': [
        {
          id: 'traces',
          label: 'Traces',
          component: ({ applicationId, serviceId }) => (
            <p>
              {applicationId}/{serviceId}
            </p>
          ),
        },
      ],
    });

    await user.click(await screen.findByRole('tab', { name: 'Traces' }));

    expect(await screen.findByText(`${frontend().applicationID}/${frontend()._id}`)).toBeVisible();
  });

  it('closes the delete dialog when the backend refuses', async () => {
    mockServer.use(
      http.delete(`${TEST_API_URL}/service/:serviceId`, () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    );
    const { user, router } = renderService();
    await chooseFromMenu(user, /Delete/);
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe(base());
  });

  it('deletes the service and returns to the application', async () => {
    const applicationId = frontend().applicationID;
    const serviceId = frontend()._id;
    // The open service page must not refetch the deleted service on its way out (404s).
    const refetches: string[] = [];
    let deleted = false;
    mockServer.events.on('request:start', ({ request }) => {
      const { pathname } = new URL(request.url);
      if (request.method === 'DELETE') deleted = true;
      else if (deleted && pathname.includes(serviceId)) refetches.push(pathname);
    });
    const { user, router } = renderService();
    await chooseFromMenu(user, /Delete/);
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/applications/${applicationId}`),
    );
    expect(mockStore.data.services.some((s) => s.microservice_name === 'frontend')).toBe(false);
    expect(refetches).toEqual([]);
    mockServer.events.removeAllListeners();
  });
});

describe('placement explanation', () => {
  const service = (name: string) =>
    mockStore.data.services.find((s) => s.microservice_name === name)!;
  const routeOf = (name: string) =>
    `/applications/${service(name).applicationID}/services/${service(name)._id}`;

  it('stays away from a service that was placed', async () => {
    renderService();
    expect(await screen.findByRole('heading', { name: /frontend/ })).toBeVisible();
    expect(screen.queryByTestId('placement-panel')).not.toBeInTheDocument();
  });

  it('shows why trainer is blocked, on the overview only', async () => {
    const { user } = renderService(routeOf('trainer'));

    const panel = await screen.findByTestId('placement-panel');
    expect(await within(panel).findByText('Every active cluster is blocked')).toBeVisible();
    expect(within(panel).getByTestId('placement-row-test-cluster')).toHaveTextContent(
      'Blocked by memory and vCPU',
    );
    expect(within(panel).getByTestId('placement-row-edge-munich')).toHaveTextContent(
      'Silent, not considered',
    );
    expect(panel).not.toHaveTextContent('No cluster can fit');

    await user.click(screen.getByRole('tab', { name: /Instances/ }));
    expect(screen.queryByTestId('placement-panel')).not.toBeInTheDocument();
    expect(await screen.findByText('No capacity', { selector: 'h3, div' })).toBeVisible();
  });

  it('keeps the duplicate and retry actions', async () => {
    const { user } = renderService(routeOf('trainer'));

    const panel = await screen.findByTestId('placement-panel');
    expect(
      within(panel).getByRole('link', { name: 'Duplicate with lower requirements' }),
    ).toHaveAttribute('href', `${routeOf('trainer')}/duplicate`);

    await user.click(within(panel).getByRole('button', { name: 'Retry placement' }));
    await waitFor(() => expect(service('trainer').status).not.toBe('NoActiveClusterWithCapacity'));
  });

  it('disables the copy until a cluster passes, then links it with the limits', async () => {
    const { user, router } = renderService(routeOf('trainer'));

    const panel = await screen.findByTestId('placement-panel');
    const blocked = await within(panel).findByRole('button', { name: 'Copy with these limits' });
    expect(blocked).toBeDisabled();
    expect(blocked).toHaveAccessibleDescription(/No active cluster passes at these limits/);

    within(panel).getByRole('slider', { name: 'vCPU limit' }).focus();
    await user.keyboard('{Home}');
    within(panel)
      .getByRole('slider', { name: /^Memory limit/ })
      .focus();
    await user.keyboard('{Home}');

    expect(within(panel).getByRole('status')).toHaveTextContent(
      /At 1 vCPU and 1 MB, 1 of 1 active cluster passes cluster checks: test-cluster/,
    );
    expect(within(panel).getByTestId('placement-row-test-cluster')).toHaveTextContent(
      'Passes cluster checks',
    );

    const copy = within(panel).getByRole('link', { name: 'Copy with these limits' });
    expect(copy).toHaveAttribute('href', `${routeOf('trainer')}/duplicate?memory=1&vcpus=1`);

    await user.click(copy);
    expect(await screen.findByRole('heading', { name: 'Duplicate trainer' })).toBeVisible();
    expect(router.state.location.search).toBe('?memory=1&vcpus=1');
    expect(await screen.findByLabelText(/^Memory/)).toHaveValue('1');
    expect(screen.getByLabelText(/^vCPUs?/)).toHaveValue('1');
  });

  it('ignores limits in the link that are not whole numbers of at least 1', async () => {
    renderService(`${routeOf('trainer')}/duplicate?memory=0&vcpus=1.5`);

    expect(await screen.findByLabelText(/^Memory/)).toHaveValue('500000');
    expect(screen.getByLabelText(/^vCPUs?/)).toHaveValue('64');
  });

  it('explains totals against workers, also next to an instance (wideload)', async () => {
    withPlacementDemo(mockStore.data);
    renderService(routeOf('wideload'));

    const panel = await screen.findByTestId('placement-panel');
    expect(
      await within(panel).findByText('Cluster totals pass, but no single worker has room'),
    ).toBeVisible();
    expect(within(panel).getByTestId('placement-row-test-cluster')).toHaveAttribute(
      'data-placement',
      'passes',
    );
    expect(within(panel).getByRole('link', { name: 'Copy with these limits' })).toBeVisible();
  });

  it('explains a pin to a silent cluster and offers no sliders (munichgw)', async () => {
    withPlacementDemo(mockStore.data);
    renderService(routeOf('munichgw'));

    const panel = await screen.findByTestId('placement-panel');
    expect(
      await within(panel).findByText('Target cluster edge-munich is not reporting'),
    ).toBeVisible();
    expect(panel).not.toHaveTextContent('No cluster can fit');
    expect(within(panel).queryByRole('slider')).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Copy with these limits' })).toBeDisabled();
    expect(
      within(panel).getByRole('link', { name: 'Duplicate with another target' }),
    ).toBeVisible();
  });

  it('says what the checks did not look at', async () => {
    Object.assign(service('trainer'), { vgpus: 1, constraints: [{ type: 'latency' }] });
    renderService(routeOf('trainer'));

    expect(
      await screen.findByText('Not evaluated by these checks: vGPU and latency constraint.'),
    ).toBeVisible();
  });

  it('keeps the explanation and actions when the clusters cannot be loaded', async () => {
    mockServer.use(
      http.get(`${TEST_API_URL}/clusters/`, () => HttpResponse.json({}, { status: 500 })),
    );
    renderService(routeOf('trainer'));

    const panel = await screen.findByTestId('placement-panel');
    expect(await within(panel).findByText('Could not load the clusters')).toBeVisible();
    expect(within(panel).getByText('No capacity')).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Retry placement' })).toBeVisible();
  });
});

describe('instance detail page (linked addon)', () => {
  it('renders status, placement, metrics, map and logs', async () => {
    renderService(`${base()}/instances/0`);

    expect(await screen.findByRole('heading', { name: /frontend #0/ })).toBeVisible();
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Running');
    expect((await screen.findAllByText('test-cluster'))[0]).toBeVisible();
    expect(screen.getByRole('img', { name: /CPU usage/ })).toBeVisible();
    expect(screen.getByRole('img', { name: /Memory usage/ })).toBeVisible();
    expect(await screen.findByLabelText('Cluster location')).toBeInTheDocument();
    expect(screen.getByTestId('instance-logs')).toHaveTextContent('start worker process');
    expect(screen.getByRole('button', { name: 'Copy logs' })).toBeVisible();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('frontendInstance 0');
  });

  it('links the cluster only while the infrastructure module is enabled', async () => {
    renderService(`${base()}/instances/0`);
    const link = await screen.findByRole('link', { name: 'test-cluster' });
    expect(link.getAttribute('href')).toMatch(/^\/infrastructure\/clusters\//);
  });

  it('shows the cluster as plain text when a preset drops the infrastructure module', async () => {
    renderApp({
      linked: linkedAddons,
      route: `${base()}/instances/0`,
      preset: { modules: ['applications'], home: '/applications' },
    });

    expect((await screen.findAllByText('test-cluster'))[0]).toBeVisible();
    expect(screen.queryByRole('link', { name: 'test-cluster' })).not.toBeInTheDocument();
  });

  it('undeploys the instance after confirmation and returns to the service', async () => {
    const { user, router } = renderService(`${base()}/instances/1`);
    await user.click(await screen.findByRole('button', { name: 'Undeploy' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Undeploy instance 1?');
    await user.click(within(dialog).getByRole('button', { name: 'Undeploy' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(base()));
    expect(frontend().instance_list.map((i) => i.instance_number)).toEqual([0]);
  });

  it('closes the undeploy dialog when the backend refuses', async () => {
    mockServer.use(
      http.delete(`${TEST_API_URL}/service/:serviceId/instance/:n`, () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    );
    const { user, router } = renderService(`${base()}/instances/1`);
    await user.click(await screen.findByRole('button', { name: 'Undeploy' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Undeploy' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe(`${base()}/instances/1`);
    expect(frontend().instance_list).toHaveLength(2);
  });

  it('shows a not-found page for an unknown service, also below it', async () => {
    const appId = frontend().applicationID;
    const { unmount } = renderService(`/applications/${appId}/services/nope`);
    expect(await screen.findByText('Service not found')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to the application' })).toHaveAttribute(
      'href',
      `/applications/${appId}`,
    );
    unmount();

    renderService(`/applications/${appId}/services/nope/instances/0`);
    expect(await screen.findByText('Service not found')).toBeVisible();
  });

  it('says so when the instance does not exist', async () => {
    renderService(`${base()}/instances/42`);
    expect(await screen.findByText('Instance not found')).toBeVisible();
  });

  describe('tabs of remote addons', () => {
    const flops = addonSource(
      { name: 'flops', version: '1.2.0', basePath: '/addons/flops', origin: 'manager' },
      'Flops',
    );
    const tab = (component: () => ReactNode) => ({
      'service.detail.tabs': [{ id: 'tab', label: 'Rounds', component }],
    });

    it('marks the trigger with the source', async () => {
      const { services } = renderService();
      await screen.findByRole('tab', { name: 'Overview' });
      act(() =>
        services.contributions.getState().register(
          flops,
          tab(() => <p>rounds</p>),
        ),
      );

      expect(await screen.findByRole('tab', { name: /Rounds/ })).toHaveTextContent(
        'RoundsFlopsv1.2.0',
      );
    });

    it('falls back to the first tab when the selected one disappears', async () => {
      const { services, user } = renderService();
      await screen.findByRole('tab', { name: 'Overview' });
      act(() =>
        services.contributions.getState().register(
          flops,
          tab(() => <p>rounds</p>),
        ),
      );
      await user.click(await screen.findByRole('tab', { name: /Rounds/ }));
      expect(await screen.findByText('rounds')).toBeVisible();

      act(() => services.contributions.getState().unregister('addon:flops'));

      expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByText('Requirements')).toBeVisible();
    });

    it('contains a crash to the panel, and the other tabs keep working', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { services, user } = renderService();
      await screen.findByRole('tab', { name: 'Overview' });
      act(() =>
        services.contributions.getState().register(
          flops,
          tab(() => {
            throw new Error('kaputt');
          }),
        ),
      );
      await user.click(await screen.findByRole('tab', { name: /Rounds/ }));

      const error = await screen.findByTestId('contribution-error');
      expect(error).toHaveTextContent('Rounds from addon "flops" failed to render.');
      expect(error).toHaveAttribute('data-source', 'addon:flops');

      await user.click(screen.getByRole('tab', { name: 'Overview' }));
      expect(screen.getByText('Requirements')).toBeVisible();
    });
  });
});
