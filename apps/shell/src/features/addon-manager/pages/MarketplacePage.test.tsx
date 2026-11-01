import { http, HttpResponse } from '@oakestra/mocks';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { uiAddonsQueryKey } from '../../../core/addons/ui-addons';
import { mockAddons, mockServer, TEST_MARKETPLACE_URL } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { addonManagerModule } from '../index';

vi.mock('../api/polling', () => ({
  INSTALLED_POLL_MS: 40,
  INSTALLED_IDLE_POLL_MS: 60_000,
  STUCK_AFTER_MS: 60_000,
}));

function renderMarketplace(options: Partial<Parameters<typeof renderApp>[0]> = {}) {
  return renderApp({
    modules: [addonManagerModule],
    route: '/addon-manager/marketplace',
    ...options,
  });
}

const card = (name: string) => screen.findByTestId(`marketplace-card-${name}`);

describe('<MarketplacePage>', () => {
  it('lists approved addons with their images, UI badge and installed state', async () => {
    renderMarketplace();

    const example = await card('example');
    expect(within(example).getByText('Dashboard UI')).toBeVisible();
    expect(
      within(example).getByText('ghcr.io/oakestra/dashboard-addon-example:0.1.0'),
    ).toBeVisible();
    await waitFor(() => expect(within(example).getByText('Active')).toBeVisible());
    expect(within(example).getByRole('button', { name: 'Install example' })).toBeDisabled();

    const flops = await card('flops');
    expect(within(flops).queryByText('Dashboard UI')).not.toBeInTheDocument();
    expect(within(flops).getByRole('button', { name: 'Install flops' })).toBeEnabled();
    // Only approved definitions are listed.
    expect(screen.queryByTestId('marketplace-card-community-tool')).not.toBeInTheDocument();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('HomeAddonsMarketplace');
  });

  it('filters by name, description and image', async () => {
    const { user } = renderMarketplace();
    await card('flops');

    await user.type(screen.getByRole('searchbox', { name: 'Search the marketplace' }), 'federated');

    expect(screen.getByTestId('marketplace-card-flops')).toBeVisible();
    expect(screen.queryByTestId('marketplace-card-example')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(await screen.findByText('No addons match your search')).toBeVisible();
  });

  it('installs an addon, follows it to the installed tab and refreshes the addon UIs when active', async () => {
    const { user, services, router } = renderMarketplace();
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');

    await user.click(await screen.findByRole('button', { name: 'Install flops' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/addon-manager/installed'));
    expect(mockAddons.state.installed.filter((a) => a.name === 'flops')).toHaveLength(1);
    // Looked up again on every try: the row is rebuilt while the status changes.
    await waitFor(() => {
      const row = screen.getByText('flops', { selector: 'td span' }).closest('tr')!;
      expect(within(row).getByText('Active')).toBeVisible();
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: uiAddonsQueryKey });
  });

  it('cannot install an addon twice', async () => {
    const { user } = renderMarketplace();
    const button = await screen.findByRole('button', { name: 'Install example' });
    await waitFor(() => expect(button).toBeDisabled());

    await user.click(button);

    expect(mockAddons.state.installed.filter((a) => a.name === 'example')).toHaveLength(1);
  });

  it('toasts the backend refusal when an install races another admin', async () => {
    const { user } = renderMarketplace();
    const flops = mockAddons.state.marketplace.find((a) => a.name === 'flops')!;
    const button = await screen.findByRole('button', { name: 'Install flops' });
    // Another admin installs it after this page loaded its lists.
    const response = mockAddons.manager.install({ marketplace_id: flops._id });
    expect(response.status).toBe(201);

    await user.click(button);

    expect(await screen.findByText('Could not install the addon')).toBeVisible();
    expect(mockAddons.state.installed.filter((a) => a.name === 'flops')).toHaveLength(1);
  });

  it('shows the details of a definition with environment names only', async () => {
    const { user } = renderMarketplace();
    await user.click(await screen.findByRole('button', { name: 'Details of example' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('EXAMPLE_API_TOKEN')).toBeVisible();
    expect(within(dialog).getByText('example-data')).toBeVisible();
    expect(
      within(dialog).getByText('oakestra-net', { selector: '[data-slot=badge]' }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent('sk-fake-example-token');
  });

  it('shows field errors for an invalid definition and does not send it', async () => {
    const { user } = renderMarketplace();
    await user.click(await screen.findByRole('button', { name: 'Register addon' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('under review');
    expect(dialog).toHaveTextContent('does not accept it yet');

    const input = within(dialog).getByLabelText('Definition (JSON)');
    await user.click(input);
    await user.paste('{ nope');
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }));
    expect(await within(dialog).findByTestId('register-errors')).toHaveTextContent(
      'This is not valid JSON',
    );

    await user.clear(input);
    await user.click(input);
    await user.paste(
      JSON.stringify({
        name: '',
        services: [{ service_name: 'a', image: '' }],
        ui: { service: 'zzz', sdk: 'not a range' },
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }));
    const errors = await within(dialog).findByTestId('register-errors');
    expect(errors).toHaveTextContent('name: Name is required');
    expect(errors).toHaveTextContent('services[0].image: Image is required');
    expect(errors).toHaveTextContent('ui.sdk: Not a valid semver range');
    expect(errors).toHaveTextContent(
      'ui.service: The UI service must be one of the addon services',
    );
    expect(mockAddons.state.marketplace.some((a) => a.name === '')).toBe(false);
  });

  it('never echoes pasted text in the JSON error', async () => {
    const { user } = renderMarketplace();
    await user.click(await screen.findByRole('button', { name: 'Register addon' }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Definition (JSON)');
    await user.click(input);
    // Typed into a snippet that V8 would quote back in its error message.
    await user.paste('{\n  "env": "sk-live-SECRET-1234",\n  oops');
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }));

    const errors = await within(dialog).findByTestId('register-errors');
    expect(errors).toHaveTextContent(/^This is not valid JSON( \(line 3, column \d+\))?\.$/);
    expect(errors).not.toHaveTextContent('SECRET');
    expect(errors).not.toHaveTextContent('oops');
  });

  it('registers a definition, which then waits for review', async () => {
    mockAddons.setDelays({ reviewDelayMs: 60_000 });
    const { user } = renderMarketplace();
    await user.click(await screen.findByRole('button', { name: 'Register addon' }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByLabelText('Definition (JSON)'));
    await user.paste(
      JSON.stringify({
        name: 'my-addon',
        services: [{ service_name: 'main', image: 'ghcr.io/me/x:1' }],
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockAddons.state.marketplace.find((a) => a.name === 'my-addon')?.status).toBe(
      'under_review',
    );
    expect(await screen.findByText('Submitted my-addon for review')).toBeVisible();
  });

  it('imports a definition from a file', async () => {
    const { user } = renderMarketplace();
    await user.click(await screen.findByRole('button', { name: 'Register addon' }));
    const dialog = await screen.findByRole('dialog');

    const file = new File([JSON.stringify({ name: 'from-file', services: [] })], 'addon.json', {
      type: 'application/json',
    });
    await user.upload(within(dialog).getByLabelText('Import a definition file'), file);

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Definition (JSON)')).toHaveValue(
        '{"name":"from-file","services":[]}',
      ),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }));
    expect(await within(dialog).findByTestId('register-errors')).toHaveTextContent(
      'At least one service is required',
    );
  });

  it('shows the marketplace refusal inside the dialog', async () => {
    mockServer.use(
      http.post(`${TEST_MARKETPLACE_URL}/`, () =>
        HttpResponse.json({ message: 'Name already taken' }, { status: 400 }),
      ),
    );
    const { user } = renderMarketplace();
    await user.click(await screen.findByRole('button', { name: 'Register addon' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Definition (JSON)'));
    await user.paste(JSON.stringify({ name: 'x', services: [{ service_name: 'a', image: 'b' }] }));
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }));

    expect(await within(dialog).findByTestId('register-error')).toHaveTextContent(
      'Name already taken',
    );
    expect(dialog).toBeVisible();
  });

  it('explains the real marketplace 422 for an unknown field', async () => {
    mockServer.use(
      http.post(`${TEST_MARKETPLACE_URL}/`, () =>
        HttpResponse.json(
          {
            code: 422,
            status: 'Unprocessable Entity',
            errors: {
              json: { ui: ['Unknown field.'], services: { '0': { restart: ['Unknown field.'] } } },
            },
          },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderMarketplace();
    await user.click(await screen.findByRole('button', { name: 'Register addon' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Definition (JSON)'));
    await user.paste(
      JSON.stringify({
        name: 'x',
        services: [{ service_name: 'a', image: 'b' }],
        ui: { service: 'a', sdk: '^0.1.0' },
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }));

    const alert = await within(dialog).findByTestId('register-error');
    expect(alert).toHaveTextContent('ui: Unknown field. services[0].restart: Unknown field.');
  });

  it('deletes a definition after a warning that it is installed', async () => {
    const { user } = renderMarketplace();
    await user.click(
      await screen.findByRole('button', { name: 'Delete example from the marketplace' }),
    );
    // The warning needs the installed list.
    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(dialog).toHaveTextContent('It keeps running'));
    await user.click(within(dialog).getByRole('button', { name: 'Delete definition' }));

    await waitFor(() =>
      expect(screen.queryByTestId('marketplace-card-example')).not.toBeInTheDocument(),
    );
    expect(mockAddons.state.marketplace.some((a) => a.name === 'example')).toBe(false);
  });

  it('shows an inline error with a retry when the marketplace is unreachable', async () => {
    mockServer.use(
      http.get(`${TEST_MARKETPLACE_URL}/`, () => new HttpResponse(null, { status: 502 })),
    );
    const { user } = renderMarketplace();

    const alert = await screen.findByTestId('marketplace-error');
    expect(alert).toHaveTextContent('The addons service is not reachable');

    mockServer.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await card('example')).toBeVisible();
  });

  it('refuses the page to non-admins', async () => {
    renderMarketplace({ user: { username: 'bob' } });

    expect(await screen.findByText('Access denied')).toBeVisible();
    expect(screen.queryByTestId('marketplace-card-example')).not.toBeInTheDocument();
  });
});
