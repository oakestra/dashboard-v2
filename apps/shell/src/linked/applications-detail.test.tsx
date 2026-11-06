import { http, HttpResponse } from '@oakestra/mocks';
import type { Contributions } from '@oakestra/dashboard-sdk';
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { linkedAddons } from '../app/modules';
import { addonSource } from '../core/addons/ui-addons';
import type { CoreModule } from '../core/modules';
import { mockServer, mockStore, TEST_API_URL } from '../test/msw';
import { renderApp } from '../test/render';

const alicesApp = () => mockStore.data.applications.find((app) => app.userId === 'alice')!;

function renderDetail(extra: CoreModule[] = []) {
  return renderApp({
    modules: extra,
    linked: linkedAddons,
    route: `/applications/${alicesApp()._id}`,
    user: { username: 'alice' },
  });
}

describe('application detail page (linked addon)', () => {
  it('shows the application and its services', async () => {
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'analytics' })).toBeVisible();
    expect(await screen.findByRole('link', { name: 'warehouse' })).toBeVisible();
    // No contributed tabs, so no lone "Services" tab.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'dashboard' })).toBeVisible();
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
    await screen.findByRole('link', { name: 'warehouse' });

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
    await screen.findByRole('link', { name: 'warehouse' });

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
    const row = screen.getByRole('link', { name: 'warehouse' }).closest('li')!;
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
      expect(screen.queryByRole('link', { name: 'warehouse' })).not.toBeInTheDocument(),
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
    expect(screen.getByRole('link', { name: 'warehouse' })).toBeVisible();
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

  it('deletes the application and leaves without refetching it', async () => {
    const applicationId = alicesApp()._id;
    // Requests for the deleted application after the DELETE went out. The open page must not
    // refetch it on its way out, which would only produce 404s.
    const refetches: string[] = [];
    let deleted = false;
    mockServer.events.on('request:start', ({ request }) => {
      const { pathname } = new URL(request.url);
      if (request.method === 'DELETE') deleted = true;
      else if (deleted && pathname.includes(applicationId)) refetches.push(pathname);
    });
    // Coming from the list, as users do: the list (and each row's services) are cached and
    // render again right after the delete, before the list refetch has dropped the application.
    const { user, router } = renderApp({
      linked: linkedAddons,
      route: '/applications',
      user: { username: 'alice' },
    });
    expect(await screen.findByRole('link', { name: 'analytics' })).toBeVisible();
    await router.navigate(`/applications/${applicationId}`);
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Applications' })).toBeVisible();
    // Only once the refetched list is shown are all row queries that could fire done.
    await waitFor(() => expect(screen.queryByRole('link', { name: 'analytics' })).toBeNull());
    expect(mockStore.data.applications.some((app) => app._id === applicationId)).toBe(false);
    expect(refetches).toEqual([]);
    mockServer.events.removeAllListeners();
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

  it('marks a remote tab and leaves it when its addon disappears while selected', async () => {
    const tabs = (label: string, text: string): Contributions => ({
      'application.detail.tabs': [{ id: 'tab', label, component: () => <p>{text}</p> }],
    });
    const source = (name: string, version: string) =>
      addonSource({ name, version, basePath: `/addons/${name}`, origin: 'manager' });
    const { services, user } = renderDetail();
    await screen.findByRole('heading', { name: alicesApp().application_name });
    // Two addons, so the tab list outlives the one that goes away.
    act(() => {
      const registry = services.contributions.getState();
      registry.register(source('flops', '1.2.0'), tabs('Rounds', 'rounds panel'));
      registry.register(source('other', '2.0.0'), tabs('Other', 'other panel'));
    });

    const rounds = await screen.findByRole('tab', { name: /Rounds/ });
    expect(rounds).toHaveTextContent('Roundsflopsv1.2.0');
    await user.click(rounds);
    expect(await screen.findByText('rounds panel')).toBeVisible();

    act(() => services.contributions.getState().unregister('addon:flops'));

    expect(screen.getByRole('tab', { name: 'Services' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Services' })).toBeVisible();
  });

  it('shows a not-found page for an unknown application', async () => {
    renderApp({ linked: linkedAddons, route: '/applications/nope', user: { username: 'alice' } });

    expect(await screen.findByText('Application not found')).toBeVisible();
    expect(screen.getByRole('link', { name: 'All applications' })).toHaveAttribute(
      'href',
      '/applications',
    );
  });

  it('renames the breadcrumb together with the heading', async () => {
    const { user } = renderDetail();
    await screen.findByRole('heading', { name: 'analytics' });

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'metrics');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'metrics' })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Applicationsmetrics'),
    );
  });
});
