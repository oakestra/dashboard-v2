import { http, HttpResponse } from '@oakestra/mocks';
import type { Contributions } from '@oakestra/dashboard-sdk';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CoreModule } from '../../../core/modules';
import { mockServer, mockStore, TEST_API_URL } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { applicationsModule } from '../index';

const alicesApp = () => mockStore.data.applications.find((app) => app.userId === 'alice')!;

function renderDetail(extra: CoreModule[] = []) {
  return renderApp({
    modules: [applicationsModule, ...extra],
    route: `/applications/${alicesApp()._id}`,
    user: { username: 'alice' },
  });
}

describe('<ApplicationDetailPage>', () => {
  it('shows the application and its services', async () => {
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'analytics' })).toBeVisible();
    expect(await screen.findByRole('cell', { name: /^warehouse/ })).toBeVisible();
    // No contributed tabs, so no lone "Services" tab.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /^dashboard/ })).toBeVisible();
    expect(screen.getByRole('link', { name: /New service/ })).toHaveAttribute(
      'href',
      `/applications/${alicesApp()._id}/services/new`,
    );
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Applicationsanalytics');
  });

  it('points at undeployed services and deploys them from the banner', async () => {
    const { user } = renderDetail();

    expect(await screen.findByText('2 services are not deployed yet.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Deploy them' }));

    await waitFor(() =>
      expect(screen.queryByText('2 services are not deployed yet.')).not.toBeInTheDocument(),
    );
  });

  it('deploys one instance of every undeployed service with "Deploy all"', async () => {
    const { user } = renderDetail();
    await screen.findByRole('cell', { name: /^warehouse/ });

    await user.click(screen.getByRole('button', { name: /Deploy all/ }));

    await waitFor(() => {
      const services = mockStore.data.services.filter((s) => s.applicationID === alicesApp()._id);
      expect(services.map((s) => s.instance_list.length)).toEqual([1, 1]);
    });
    // Nothing left to deploy afterwards.
    await waitFor(() => expect(screen.getByRole('button', { name: /Deploy all/ })).toBeDisabled());
  });

  it('does not deploy services again that are still waiting for the scheduler', async () => {
    // Like the real backend: the service turns REQUESTED at once, the instance shows up later.
    const requested: string[] = [];
    mockServer.use(
      http.post(`${TEST_API_URL}/service/:serviceId/instance`, ({ params }) => {
        const service = mockStore.data.services.find((s) => s._id === params.serviceId)!;
        service.status = 'REQUESTED';
        requested.push(service._id);
        return HttpResponse.json('ok');
      }),
    );
    const { user } = renderDetail();
    await screen.findByRole('cell', { name: /^warehouse/ });

    await user.click(screen.getByRole('button', { name: /Deploy all/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Deploy all/ })).toBeDisabled());
    await user.click(screen.getByRole('button', { name: /Deploy all/ }));

    expect(requested).toHaveLength(2);
    expect(new Set(requested).size).toBe(2);
  });

  it('deploys a single instance from the row actions', async () => {
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: 'Actions for warehouse' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Deploy instance' }));

    await waitFor(() =>
      expect(
        mockStore.data.services.find((s) => s.microservice_name === 'warehouse')?.instance_list,
      ).toHaveLength(1),
    );
    const row = screen.getByRole('cell', { name: /^warehouse/ }).closest('tr')!;
    expect(await within(row).findByText('1/1')).toBeVisible();
  });

  it('links to the duplicate flow and deletes a service after confirmation', async () => {
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: 'Actions for warehouse' }));
    const duplicate = await screen.findByRole('menuitem', { name: 'Duplicate' });
    const serviceId = mockStore.data.services.find((s) => s.microservice_name === 'warehouse')!._id;
    expect(duplicate).toHaveAttribute(
      'href',
      `/applications/${alicesApp()._id}/services/${serviceId}/duplicate`,
    );

    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('cell', { name: /^warehouse/ })).not.toBeInTheDocument(),
    );
    expect(mockStore.data.services.some((s) => s.microservice_name === 'warehouse')).toBe(false);
  });

  it('closes the delete dialog when the backend refuses', async () => {
    mockServer.use(
      http.delete(`${TEST_API_URL}/service/:serviceId`, () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    );
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: 'Actions for warehouse' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('cell', { name: /^warehouse/ })).toBeVisible();
  });

  it('closes the application delete dialog when the backend refuses', async () => {
    mockServer.use(
      http.delete(`${TEST_API_URL}/application/:id`, () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    );
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'analytics' })).toBeVisible();
  });

  it('renders tabs contributed to application.detail.tabs with the application id', async () => {
    const contributions: Contributions = {
      'application.detail.tabs': [
        {
          id: 'monitoring',
          label: 'Monitoring',
          component: ({ applicationId }) => <p>Metrics for {applicationId}</p>,
        },
      ],
    };
    const { user } = renderDetail([{ id: 'ext', label: 'Ext', routes: [], contributions }]);

    await user.click(await screen.findByRole('tab', { name: 'Monitoring' }));

    expect(await screen.findByText(`Metrics for ${alicesApp()._id}`)).toBeVisible();
  });
});
