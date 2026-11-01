import { http, HttpResponse } from '@oakestra/mocks';
import type { SlaV2 } from '@oakestra/api';
import type { Contributions } from '@oakestra/dashboard-sdk';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { mockServer, mockStore, TEST_API_URL } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { applicationsModule } from '../../applications';

const frontend = () => mockStore.data.services.find((s) => s.microservice_name === 'frontend')!;
const base = () => `/applications/${frontend().applicationID}/services/${frontend()._id}`;

function renderService(route = base(), extra: Contributions = {}) {
  return renderApp({
    modules: [applicationsModule, { id: 'ext', label: 'Ext', routes: [], contributions: extra }],
    route,
  });
}

describe('<ServiceDetailPage>', () => {
  it('shows the service header, overview and breadcrumbs', async () => {
    renderService();

    expect(await screen.findByRole('heading', { name: /frontend/ })).toBeVisible();
    expect(screen.getAllByTestId('status-badge')[0]).toHaveTextContent('RUNNING');
    expect(screen.getByText('Requirements')).toBeVisible();
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

    await user.click(screen.getByRole('button', { name: 'Undeploy instance 1' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Undeploy' }));

    await waitFor(() =>
      expect(frontend().instance_list.map((i) => i.instance_number)).toEqual([0, 2]),
    );
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Open instance 1' })).not.toBeInTheDocument(),
    );
  });

  it('shows the raw service on the SLA tab', async () => {
    const { user } = renderService();
    await user.click(await screen.findByRole('tab', { name: 'SLA' }));
    expect(await screen.findByText(/"microservice_name": "frontend"/)).toBeVisible();
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

    await user.click(await screen.findByRole('button', { name: /Export SLA/ }));

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
    await user.click(await screen.findByRole('button', { name: /Delete/ }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe(base());
  });

  it('deletes the service and returns to the application', async () => {
    const applicationId = frontend().applicationID;
    const { user, router } = renderService();
    await user.click(await screen.findByRole('button', { name: /Delete/ }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/applications/${applicationId}`),
    );
    expect(mockStore.data.services.some((s) => s.microservice_name === 'frontend')).toBe(false);
  });
});

describe('<InstanceDetailPage>', () => {
  it('renders status, placement, metrics, map and logs', async () => {
    renderService(`${base()}/instances/0`);

    expect(await screen.findByRole('heading', { name: /frontend #0/ })).toBeVisible();
    expect(screen.getByTestId('status-badge')).toHaveTextContent('RUNNING');
    expect((await screen.findAllByText('test-cluster'))[0]).toBeVisible();
    expect(screen.getByRole('img', { name: /CPU usage/ })).toBeVisible();
    expect(screen.getByRole('img', { name: /Memory usage/ })).toBeVisible();
    expect(await screen.findByLabelText('Cluster location')).toBeInTheDocument();
    expect(screen.getByTestId('instance-logs')).toHaveTextContent('start worker process');
    expect(screen.getByRole('button', { name: 'Copy logs' })).toBeVisible();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('frontendInstance 0');
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

  it('says so when the instance does not exist', async () => {
    renderService(`${base()}/instances/42`);
    expect(await screen.findByText('Instance not found')).toBeVisible();
  });
});
