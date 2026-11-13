import { http, HttpResponse } from '@oakestra/mocks';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
const installedNamed = (name: string) =>
  mockAddons.state.installed.filter((a) => a.qualified_name === name);

describe('<MarketplacePage>', () => {
  it('lists the catalog of every source with version, permissions and installed state', async () => {
    renderMarketplace();

    const example = await card('example');
    expect(within(example).getByText('Dashboard UI')).toBeVisible();
    expect(within(example).getByText('v0.1.0')).toBeVisible();
    expect(within(example).getByText('1 host port')).toBeVisible();
    await waitFor(() => expect(within(example).getByText('Active')).toBeVisible());
    // Installed addons offer Manage instead of a disabled Install button.
    expect(within(example).queryByRole('button', { name: 'Install example' })).toBeNull();
    expect(within(example).getByRole('link', { name: 'Manage example' })).toHaveAttribute(
      'href',
      expect.stringContaining('/addon-manager/installed?addon='),
    );

    const tap = await card('acme/node-exporter');
    expect(within(tap).getByText('acme', { selector: '[data-slot=source-tag]' })).toBeVisible();
    expect(within(tap).getByText('Host network')).toBeVisible();
    expect(within(tap).getByText('System host paths')).toBeVisible();
    await waitFor(() =>
      expect(within(tap).getByRole('button', { name: 'Install acme/node-exporter' })).toBeEnabled(),
    );
    // Only local registrations can be deleted here.
    expect(within(tap).queryByRole('button', { name: /More actions/ })).toBeNull();
    expect(
      within(await card('local/docker-inspector')).getByRole('button', {
        name: 'More actions for local/docker-inspector',
      }),
    ).toBeVisible();

    const analytics = await card('analytics');
    await waitFor(() => expect(within(analytics).getByText('Update available')).toBeVisible());
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('HomeAddonsMarketplace');
  });

  it('shows the display name next to the qualified name, the icon and the category and tags', async () => {
    renderMarketplace();

    const example = await card('example');
    expect(within(example).getByRole('button', { name: 'Details of example' })).toHaveTextContent(
      'Example Addon',
    );
    expect(within(example).getByTestId('qualified-name')).toHaveTextContent('example');
    const icon = example.querySelector('img')!;
    expect(icon).toHaveAttribute('src', 'https://github.com/oakestra.png?size=96');
    expect(icon).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(icon).toHaveAttribute('loading', 'lazy');
    expect(icon).toHaveAttribute('alt', '');
    expect(
      within(example).getByRole('button', { name: 'Filter by category developer tools' }),
    ).toBeVisible();
    expect(within(example).getByRole('button', { name: 'Filter by tag ui' })).toHaveTextContent(
      '#ui',
    );

    // An icon that does not load falls back to the placeholder.
    const tap = await card('acme/node-exporter');
    expect(within(tap).queryByTestId('addon-icon-placeholder')).toBeNull();
    fireEvent.error(tap.querySelector('img')!);
    expect(within(tap).getByTestId('addon-icon-placeholder')).toBeInTheDocument();
    expect(tap.querySelector('img')).toBeNull();

    // Without display fields the qualified name is the title and nothing else is added.
    const broken = await card('broken-addon');
    expect(within(broken).queryByTestId('qualified-name')).toBeNull();
    expect(within(broken).queryByRole('button', { name: /Filter by/ })).toBeNull();
    expect(within(broken).getByTestId('addon-icon-placeholder')).toBeInTheDocument();
  });

  it('never loads an icon that is not https', async () => {
    mockAddons.state.catalog.find((d) => d.name === 'flops')!.icon = 'http://plain.example/i.png';
    renderMarketplace();

    const flops = await card('flops');
    expect(flops.querySelector('img')).toBeNull();
    expect(within(flops).getByTestId('addon-icon-placeholder')).toBeInTheDocument();
  });

  it('filters by category with the counts of the selected source', async () => {
    const { user, router } = renderMarketplace();
    await card('flops');

    const categories = screen.getByRole('combobox', { name: 'Filter by category' });
    await user.click(categories);
    expect(await screen.findByRole('option', { name: 'monitoring (2)' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'ai (1)' })).toBeVisible();
    await user.click(screen.getByRole('option', { name: 'monitoring (2)' }));
    expect(router.state.location.search).toContain('category=monitoring');
    expect(screen.getByTestId('marketplace-card-analytics')).toBeVisible();
    expect(screen.getByTestId('marketplace-card-acme/node-exporter')).toBeVisible();
    expect(screen.queryByTestId('marketplace-card-flops')).not.toBeInTheDocument();

    // Combined with the source filter, and the counts follow the source.
    await user.click(screen.getByRole('combobox', { name: 'Filter by source' }));
    await user.click(await screen.findByRole('option', { name: 'acme (1)' }));
    expect(screen.getByTestId('marketplace-card-acme/node-exporter')).toBeVisible();
    expect(screen.queryByTestId('marketplace-card-analytics')).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Filter by category' }));
    expect(await screen.findByRole('option', { name: 'monitoring (1)' })).toBeVisible();
    expect(screen.queryByRole('option', { name: /^ai/ })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'All categories' }));
    expect(router.state.location.search).not.toContain('category=');
  });

  it('filters by a tag from a card and clears the filters', async () => {
    const { user, router } = renderMarketplace();
    const tap = await card('acme/node-exporter');

    await user.click(within(tap).getByRole('button', { name: 'Filter by tag metrics' }));
    expect(router.state.location.search).toContain('tag=metrics');
    expect(screen.getByTestId('marketplace-card-analytics')).toBeVisible();
    expect(screen.queryByTestId('marketplace-card-example')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('marketplace-card-analytics')).getByRole('button', {
        name: 'Filter by tag metrics',
      }),
    ).toHaveAttribute('aria-pressed', 'true');

    // A tag no addon of the source has: the empty state clears every filter at once.
    await user.click(screen.getByRole('combobox', { name: 'Filter by source' }));
    await user.click(await screen.findByRole('option', { name: 'local (1)' }));
    expect(await screen.findByText('No addons match these filters')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await card('example')).toBeVisible();
    expect(router.state.location.search).not.toMatch(/tag=|source=/);

    // The chip in the toolbar removes the tag filter alone.
    await user.click(within(await card('flops')).getByRole('button', { name: 'Filter by tag ml' }));
    await user.click(screen.getByRole('button', { name: 'Remove the tag filter ml' }));
    expect(await card('example')).toBeVisible();
  });

  it('normalizes category and tag from a link like the marketplace does', async () => {
    renderMarketplace({
      route: '/addon-manager/marketplace?category=%20Monitoring&tag=PROMETHEUS',
    });

    expect(await card('acme/node-exporter')).toBeVisible();
    expect(screen.queryByTestId('marketplace-card-analytics')).not.toBeInTheDocument();
  });

  it('searches display names and tags', async () => {
    const { user } = renderMarketplace();
    await card('flops');

    await user.type(screen.getByRole('searchbox', { name: 'Search Marketplace' }), 'prometheus');
    expect(screen.getByTestId('marketplace-card-acme/node-exporter')).toBeVisible();
    expect(screen.queryByTestId('marketplace-card-analytics')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'Platform Analytics');
    expect(screen.getByTestId('marketplace-card-analytics')).toBeVisible();
    expect(screen.queryByTestId('marketplace-card-flops')).not.toBeInTheDocument();
  });

  it('counts the categories from the catalog, without GET /categories', async () => {
    mockServer.use(
      http.get(`${TEST_MARKETPLACE_URL}/categories`, () =>
        HttpResponse.json({ code: 'not_found', message: 'not found' }, { status: 404 }),
      ),
    );
    const { user } = renderMarketplace();
    await card('flops');

    await user.click(screen.getByRole('combobox', { name: 'Filter by category' }));
    expect(await screen.findByRole('option', { name: 'monitoring (2)' })).toBeVisible();
    expect(screen.queryByText(/Could not/)).toBeNull();
  });

  it('offers Install again for an addon whose only record is disabled', async () => {
    for (const addon of installedNamed('example')) addon.status = 'disabled';
    const { user } = renderMarketplace();

    const example = await card('example');
    await waitFor(() => expect(within(example).getByText('Disabled')).toBeVisible());
    expect(within(example).queryByRole('link', { name: 'Manage example' })).toBeNull();
    await waitFor(() =>
      expect(within(example).getByRole('button', { name: 'Install example' })).toBeEnabled(),
    );

    // The details dialog agrees with the card.
    await user.click(within(example).getByRole('button', { name: 'Details of example' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('link', { name: /Manage/ })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Install' })).toBeEnabled();
  });

  it('filters by source and by search text', async () => {
    const { user, router } = renderMarketplace();
    await card('flops');

    await user.click(screen.getByRole('combobox', { name: 'Filter by source' }));
    await user.click(await screen.findByRole('option', { name: 'acme (1)' }));
    expect(router.state.location.search).toContain('source=acme');
    expect(screen.getByTestId('marketplace-card-acme/node-exporter')).toBeVisible();
    expect(screen.queryByTestId('marketplace-card-flops')).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Filter by source' }));
    await user.click(await screen.findByRole('option', { name: 'All sources' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search Marketplace' }), 'federated');
    expect(screen.getByTestId('marketplace-card-flops')).toBeVisible();
    expect(screen.queryByTestId('marketplace-card-example')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(await screen.findByText('No addons match your search')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await card('flops')).toBeVisible();
  });

  it('shows the definition before installing and installs with its hash', async () => {
    const { user, services, router } = renderMarketplace();
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');
    const install = vi.spyOn(mockAddons.manager, 'install');

    const button = await screen.findByRole('button', { name: 'Install flops' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    const dialog = await screen.findByTestId('consent-dialog');
    expect(dialog).toHaveTextContent('Install FLOps 1.0.0?');
    // The display name is the catalog's to pick, so the qualified name is shown with it.
    expect(within(dialog).getByTestId('consent-subject')).toHaveTextContent('FLOpsflops');
    expect(within(dialog).getByTestId('permission-core_network')).toHaveTextContent('Dangerous');
    // The admin sees the images that will run, pinned by digest.
    expect(within(dialog).getByTestId('service-flops-manager')).toHaveTextContent('@sha256:');
    // The first call only fetched the definition; nothing is installed yet.
    expect(install).toHaveBeenCalledTimes(1);
    expect(installedNamed('flops')).toHaveLength(0);
    await user.click(within(dialog).getByLabelText(/I understand/));
    await user.click(within(dialog).getByRole('button', { name: 'Accept and install' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/addon-manager/installed'));
    expect(install).toHaveBeenCalledTimes(2);
    expect(installedNamed('flops')).toHaveLength(1);
    await waitFor(() => {
      expect(within(screen.getByTestId('installed-addon-flops')).getByText('Active')).toBeVisible();
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: uiAddonsQueryKey });
  });

  it('shows the dialog again when the definition changed before it was accepted', async () => {
    const { user } = renderMarketplace();
    const button = await screen.findByRole('button', { name: 'Install flaky-addon' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    const dialog = await screen.findByTestId('consent-dialog');
    expect(within(dialog).queryByTestId('permission-host_ports:7000')).toBeNull();

    // The catalog changes while the admin reads the dialog.
    mockAddons.state.catalog.find((d) => d.name === 'flaky-addon')!.permissions.host_ports = [7000];
    await user.click(within(dialog).getByRole('button', { name: 'Accept and install' }));

    expect(await within(dialog).findByTestId('definition-changed')).toBeVisible();
    expect(within(dialog).getByTestId('permission-host_ports:7000')).toBeVisible();
    expect(installedNamed('flaky-addon')).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Accept and install' }));
    await waitFor(() => expect(installedNamed('flaky-addon')).toHaveLength(1));
  });

  it('cannot install an addon twice', async () => {
    const { user } = renderMarketplace();
    await screen.findByRole('link', { name: 'Manage example' });
    expect(screen.queryByRole('button', { name: 'Install example' })).toBeNull();
    // A stale card could still be clicked on in the details dialog; the backend refuses it too.
    await user.click(await screen.findByRole('button', { name: 'Details of example' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'Install' })).toBeNull();
    expect(within(dialog).getByRole('link', { name: 'Manage' })).toBeVisible();
    expect(installedNamed('example')).toHaveLength(1);
  });

  it('toasts the backend refusal when an install races another admin', async () => {
    const { user } = renderMarketplace();
    const button = await screen.findByRole('button', { name: 'Install broken-addon' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    const dialog = await screen.findByTestId('consent-dialog');
    // Another admin installs it after this page loaded its lists.
    const item = mockAddons.state.catalog.find((d) => d.name === 'broken-addon')!;
    const response = mockAddons.manager.install({
      name: 'broken-addon',
      accept_definition: mockAddons.definitionHash(item),
    });
    expect(response.status).toBe(201);

    await user.click(within(dialog).getByRole('button', { name: 'Accept and install' }));

    expect(await screen.findByText('Could not install the addon')).toBeVisible();
    expect(screen.getByText('Addon "broken-addon" is already installed.')).toBeVisible();
    expect(installedNamed('broken-addon')).toHaveLength(1);
    // already_installed means the page's installed list was stale, so it is fetched again.
    expect(
      await within(await card('broken-addon')).findByRole('link', {
        name: 'Manage broken-addon',
      }),
    ).toBeVisible();
  });

  it('blocks installing a UI built for another SDK', async () => {
    mockAddons.state.catalog.find((d) => d.name === 'flops')!.ui = {
      service: 'flops-manager',
      sdk: '^99.0.0',
    };
    const { user } = renderMarketplace();

    const flops = await card('flops');
    expect(within(flops).getByText('UI incompatible')).toBeVisible();
    expect(within(flops).getByRole('button', { name: 'Install flops' })).toBeDisabled();
    await user.click(within(flops).getByRole('button', { name: 'Details of flops' }));
    expect(await screen.findByTestId('ui-incompatible')).toHaveTextContent('^99.0.0');
  });

  it('shows the details of a definition with permissions and environment names only', async () => {
    const { user } = renderMarketplace();
    await user.click(await screen.findByRole('button', { name: 'Details of example' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('EXAMPLE_API_TOKEN')).toBeVisible();
    expect(within(dialog).getByText('example-data')).toBeVisible();
    expect(within(dialog).getByTestId('permission-host_ports:9100')).toBeVisible();
    expect(within(dialog).getByRole('link', { name: /github.com/ })).toHaveAttribute(
      'href',
      'https://github.com/oakestra/dashboard-v2',
    );
    expect(document.body).not.toHaveTextContent('sk-fake-example-token');
  });

  it('shows field errors for an invalid definition and does not send it', async () => {
    const { user } = renderMarketplace();
    await user.click(await screen.findByRole('button', { name: 'Register addon' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('local/<name>');

    const input = within(dialog).getByLabelText('Definition (JSON)');
    await user.click(input);
    await user.paste('{ nope');
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(await within(dialog).findByTestId('register-errors')).toHaveTextContent(
      'This is not valid JSON',
    );

    await user.clear(input);
    await user.click(input);
    await user.paste(
      JSON.stringify({
        name: '',
        version: 'v1',
        services: [{ service_name: 'a', image: '' }],
        ui: { service: 'zzz', sdk: 'not a range' },
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    const errors = await within(dialog).findByTestId('register-errors');
    expect(errors).toHaveTextContent('name: Name is required');
    expect(errors).toHaveTextContent('version: Not a semantic version');
    expect(errors).toHaveTextContent('services[0].image: Image is required');
    expect(errors).toHaveTextContent('ui.sdk: Not a valid semver range');
    expect(errors).toHaveTextContent(
      'ui.service: The UI service must be one of the addon services',
    );
    expect(mockAddons.state.catalog.some((a) => a.name === '')).toBe(false);
  });

  it('never echoes pasted text in the JSON error', async () => {
    const { user } = renderMarketplace();
    await user.click(await screen.findByRole('button', { name: 'Register addon' }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Definition (JSON)');
    await user.click(input);
    // Typed into a snippet that V8 would quote back in its error message.
    await user.paste('{\n  "env": "sk-live-SECRET-1234",\n  oops');
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));

    const errors = await within(dialog).findByTestId('register-errors');
    expect(errors).toHaveTextContent(/^This is not valid JSON( \(line 3, column \d+\))?\.$/);
    expect(errors).not.toHaveTextContent('SECRET');
    expect(errors).not.toHaveTextContent('oops');
  });

  async function register(user: ReturnType<typeof renderMarketplace>['user'], definition: object) {
    await user.click(await screen.findByRole('button', { name: 'Register addon' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Definition (JSON)'));
    await user.paste(JSON.stringify(definition));
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    return dialog;
  }

  it('registers a definition in the local source and lists it at once', async () => {
    const { user } = renderMarketplace();
    await card('example');

    await register(user, {
      name: 'my-addon',
      version: '1.0.0',
      services: [{ service_name: 'main', image: 'ghcr.io/me/x:1', ports: { '80': '8080' } }],
      permissions: { host_ports: [8080] },
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Registered local/my-addon 1.0.0')).toBeVisible();
    expect(await card('local/my-addon')).toBeVisible();
  });

  it('shows the marketplace refusal inside the dialog', async () => {
    const { user } = renderMarketplace();
    await card('example');
    // Undeclared core network use: only the marketplace checks permissions against services.
    const dialog = await register(user, {
      name: 'x',
      version: '1.0.0',
      services: [{ service_name: 'a', image: 'b', networks: ['oakestra'] }],
    });

    expect(await within(dialog).findByTestId('register-error')).toHaveTextContent(
      'permissions.core_network: is used but not declared',
    );
    expect(dialog).toBeVisible();
  });

  it('explains a strict decoding error for an unknown field', async () => {
    mockServer.use(
      http.post(`${TEST_MARKETPLACE_URL}/addons`, () =>
        HttpResponse.json(
          {
            code: 'validation_failed',
            message: 'invalid request body: json: unknown field "privileged"',
          },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderMarketplace();
    const dialog = await register(user, {
      name: 'x',
      version: '1.0.0',
      services: [{ service_name: 'a', image: 'b', privileged: true }],
    });

    expect(await within(dialog).findByTestId('register-error')).toHaveTextContent(
      'unknown field "privileged"',
    );
  });

  it('imports a definition from a file', async () => {
    const { user } = renderMarketplace();
    await user.click(await screen.findByRole('button', { name: 'Register addon' }));
    const dialog = await screen.findByRole('dialog');

    const text = JSON.stringify({ name: 'from-file', version: '1.0.0', services: [] });
    const file = new File([text], 'addon.json', { type: 'application/json' });
    await user.upload(within(dialog).getByLabelText('Import a definition file'), file);

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Definition (JSON)')).toHaveValue(text),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(await within(dialog).findByTestId('register-errors')).toHaveTextContent(
      'At least one service is required',
    );
  });

  it('deletes a local registration', async () => {
    const { user } = renderMarketplace();
    await user.click(
      await screen.findByRole('button', { name: 'More actions for local/docker-inspector' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete from marketplace' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('can no longer be installed');
    await user.click(within(dialog).getByRole('button', { name: 'Delete definition' }));

    await waitFor(() =>
      expect(
        screen.queryByTestId('marketplace-card-local/docker-inspector'),
      ).not.toBeInTheDocument(),
    );
    expect(mockAddons.state.catalog.some((a) => a.name === 'docker-inspector')).toBe(false);
  });

  it('shows an inline error with a retry when the marketplace is unreachable', async () => {
    mockServer.use(
      http.get(`${TEST_MARKETPLACE_URL}/addons`, () => new HttpResponse(null, { status: 502 })),
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
