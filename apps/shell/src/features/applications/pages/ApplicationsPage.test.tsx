import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockStore } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { applicationsModule } from '../index';

function renderApplications(route = '/applications', username = 'alice') {
  return renderApp({
    modules: [applicationsModule],
    route,
    user: { username },
  });
}

describe('<ApplicationsPage>', () => {
  it("lists only the signed-in user's applications with their service counts", async () => {
    renderApplications();

    const row = (await screen.findByRole('cell', { name: /^analytics/ })).closest('tr')!;
    expect(within(row).getByText('2 services')).toBeVisible();
    expect(await within(row).findByText('Not deployed')).toBeVisible();
    expect(screen.queryByRole('cell', { name: /^webshop/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Applications');
  });

  it('syncs the search box with ?q=', async () => {
    const { user, router } = renderApplications('/applications?q=zzz', 'Admin');

    expect(await screen.findByRole('searchbox', { name: 'Search Applications' })).toHaveValue(
      'zzz',
    );
    expect(await screen.findByText('No results')).toBeVisible();

    await user.clear(screen.getByRole('searchbox', { name: 'Search Applications' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search Applications' }), 'web');
    await waitFor(() => expect(router.state.location.search).toBe('?q=web'));
    expect(screen.getByRole('cell', { name: /^webshop/ })).toBeVisible();
    expect(screen.queryByRole('cell', { name: /^iotpipe/ })).not.toBeInTheDocument();
  });

  it('creates an application and shows it', async () => {
    const { user, router } = renderApplications();
    await user.click(await screen.findByRole('button', { name: 'New application' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Name'), 'telemetry');
    await user.clear(within(dialog).getByLabelText('Namespace'));
    await user.type(within(dialog).getByLabelText('Namespace'), 'prod');
    await user.type(within(dialog).getByLabelText('Description'), 'Sensor data');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    // The new application opens right away instead of leaving the user to find its row.
    expect(await screen.findByRole('heading', { name: 'telemetry' })).toBeVisible();
    const created = mockStore.data.applications.find((app) => app.application_name === 'telemetry');
    expect(router.state.location.pathname).toBe(`/applications/${created!._id}`);
    expect(created).toMatchObject({
      application_namespace: 'prod',
      application_desc: 'Sensor data',
      userId: 'alice',
    });
  });

  it('validates the name and namespace before sending', async () => {
    const { user } = renderApplications();
    await user.click(await screen.findByRole('button', { name: 'New application' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Name'), 'not valid!');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(await within(dialog).findByText('Use 1 to 32 letters or digits')).toBeVisible();
    expect(mockStore.data.applications).toHaveLength(4);
  });

  it('shows the backend reason when creating fails', async () => {
    const { user } = renderApplications();
    await user.click(await screen.findByRole('button', { name: 'New application' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Name'), 'analytics');
    await user.clear(within(dialog).getByLabelText('Namespace'));
    await user.type(
      within(dialog).getByLabelText('Namespace'),
      mockStore.data.applications.find((a) => a.userId === 'alice')!.application_namespace,
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(await within(dialog).findByTestId('application-form-error')).toBeVisible();
  });

  it('edits an application', async () => {
    const { user } = renderApplications();
    await user.click(await screen.findByRole('button', { name: 'Actions for analytics' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');

    const description = within(dialog).getByLabelText('Description');
    await user.clear(description);
    await user.type(description, 'Updated text');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      mockStore.data.applications.find((app) => app.application_name === 'analytics')
        ?.application_desc,
    ).toBe('Updated text');
  });

  it('warns that services are deleted along with the application', async () => {
    const { user } = renderApplications();
    await user.click(await screen.findByRole('button', { name: 'Actions for analytics' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('also deletes its 2 services');

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(screen.queryByRole('cell', { name: /^analytics/ })).not.toBeInTheDocument(),
    );
    expect(mockStore.data.applications.some((app) => app.application_name === 'analytics')).toBe(
      false,
    );
  });

  it('opens the detail page on row click', async () => {
    const { user, router } = renderApplications();
    await user.click(await screen.findByRole('cell', { name: /^analytics/ }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/applications\/\w+$/));
    expect(await screen.findByRole('heading', { name: /^analytics/ })).toBeVisible();
  });
});
