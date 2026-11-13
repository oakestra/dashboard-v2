import { http, HttpResponse } from '@oakestra/mocks';
import type { JsonBodyType } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { setEntry } from '../../../core/addons/addon-registry';
import { uiAddonsQueryKey } from '../../../core/addons/ui-addons';
import { mockAddons, mockServer, TEST_ADDONS_MANAGER_URL } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { addonManagerModule } from '../index';

// Tests should not wait seconds for each poll or for the "stuck" timeout.
vi.mock('../api/polling', () => ({
  INSTALLED_POLL_MS: 30,
  INSTALLED_IDLE_POLL_MS: 100,
  STUCK_AFTER_MS: 500,
}));

const base = { sdk: '^0.1.0', entry: 'http://x/mf-manifest.json', origin: 'manager' as const };

function renderInstalled(options: Partial<Parameters<typeof renderApp>[0]> = {}) {
  return renderApp({
    modules: [addonManagerModule],
    route: '/addon-manager/installed',
    ...options,
  });
}

const rowOf = (name: string) => screen.findByTestId(`installed-addon-${name}`);

/** Waits until the row of `name` shows `status`. */
const waitForStatus = (name: string, status: string) =>
  waitFor(() => {
    expect(within(screen.getByTestId(`installed-addon-${name}`)).getByText(status)).toBeVisible();
  });

describe('<InstalledPage>', () => {
  it('lists the installed addons with status badges and the dashboard UI column', async () => {
    const { services } = renderInstalled();
    act(() => {
      setEntry(services.addons, {
        ...base,
        name: 'example',
        basePath: '/addons/example',
        version: '0.1.0',
        state: 'loaded',
        definition: { id: 'example' },
      });
    });

    const example = await rowOf('example');
    expect(within(example).getByText('Active')).toBeVisible();
    expect(within(example).getByText('Loaded')).toBeVisible();
    expect(within(example).getByText('2 services')).toBeVisible();
    const analytics = await rowOf('analytics');
    expect(within(analytics).getByText('Partially active')).toBeVisible();
    expect(within(analytics).getByText('None')).toBeVisible();
    expect(within(analytics).getByText(/services failing/)).toBeVisible();
    expect(within(analytics).getByText('v1.1.0')).toBeVisible();
    const legacy = await rowOf('legacy-exporter');
    expect(within(legacy).getByText('Failed')).toBeVisible();
    // The engine's reason is shown in the row instead of the failing services count.
    expect(within(legacy).getByText(/grant signature invalid/)).toBeVisible();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('HomeAddonsInstalled');
  });

  it('shows why a dashboard UI failed or is incompatible', async () => {
    const { services, user } = renderInstalled();
    act(() => {
      setEntry(services.addons, {
        ...base,
        name: 'example',
        basePath: '/addons/example',
        version: '0.1.0',
        state: 'failed',
        error: 'manifest 502',
      });
      setEntry(services.addons, {
        ...base,
        name: 'analytics',
        basePath: '/addons/analytics',
        version: '1.0.0',
        sdk: '^9.0.0',
        state: 'incompatible',
        error: 'Needs SDK ^9.0.0, this dashboard has 0.1.0',
      });
    });

    const example = await rowOf('example');
    await user.hover(within(example).getByRole('button', { name: 'Failed' }));
    expect((await screen.findAllByText('manifest 502')).length).toBeGreaterThan(0);
    expect(within(await rowOf('analytics')).getByText('Incompatible')).toBeVisible();
  });

  it('shows the details of an addon without any environment value', async () => {
    const { user } = renderInstalled();
    await user.click(await screen.findByRole('button', { name: 'Example Addon (example)' }));

    const sheet = await screen.findByTestId('addon-detail');
    expect(within(sheet).getByRole('heading', { name: /Example Addon/ })).toBeVisible();
    expect(within(sheet).getByTestId('qualified-name')).toHaveTextContent('example');
    const worker = within(within(sheet).getByTestId('service-example-worker'));
    expect(worker.getByText(/^ghcr.io\/oakestra\/example-worker@sha256:/)).toBeVisible();
    expect(worker.getByText('9100:9100')).toBeVisible();
    expect(worker.getByText('EXAMPLE_API_TOKEN')).toBeVisible();
    expect(worker.getByText('LOG_LEVEL')).toBeVisible();
    // The fixtures hold fake secrets, which must never reach the DOM.
    expect(document.body).not.toHaveTextContent('sk-fake-example-token');
    expect(sheet).not.toHaveTextContent('info');
    expect(within(sheet).getByText('example-data:/var/lib/example')).toBeVisible();
    expect(within(sheet).getByTestId('permission-host_ports:9100')).toBeVisible();
    expect(within(sheet).getByText('example', { selector: 'code' })).toBeVisible();
  });

  it('shows the display name, the qualified name and the catalog icon', async () => {
    renderInstalled();

    const example = await rowOf('example');
    expect(within(example).getByRole('button', { name: 'Example Addon (example)' })).toBeVisible();
    expect(within(example).getByTestId('qualified-name')).toHaveTextContent('example');
    const icon = example.querySelector('img');
    expect(icon).toHaveAttribute('src', 'https://github.com/oakestra.png?size=96');
    expect(icon).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(icon).toHaveAttribute('loading', 'lazy');

    // No display name: the qualified name is the title and is not repeated.
    const legacy = await rowOf('legacy-exporter');
    expect(within(legacy).getByRole('button', { name: 'legacy-exporter' })).toBeVisible();
    expect(within(legacy).queryByTestId('qualified-name')).not.toBeInTheDocument();
    expect(within(legacy).getByTestId('addon-icon-placeholder')).toBeInTheDocument();
  });

  it('refreshes the list and explains when an update is refused as busy', async () => {
    const { user } = renderInstalled();
    const update = await screen.findByRole('button', { name: 'Update analytics to 1.2.0' });
    mockServer.use(
      http.post(`${TEST_ADDONS_MANAGER_URL}/:id/update`, () =>
        HttpResponse.json(
          { code: 'busy', message: "Addon is updating and can't be updated right now." },
          { status: 409 },
        ),
      ),
    );
    mockAddons.forceStatus(idOf('analytics'), 'updating');
    await user.click(update);

    expect(await screen.findByText('Could not update the addon')).toBeVisible();
    expect(screen.getByText(/still installing, updating or shutting down/)).toBeVisible();
    expect(screen.queryByTestId('consent-dialog')).not.toBeInTheDocument();
    await waitForStatus('analytics', 'Updating');
  });

  it('asks to retry shortly while the addons service cannot check sign-ins yet', async () => {
    mockServer.use(
      http.get(`${TEST_ADDONS_MANAGER_URL}/`, () =>
        HttpResponse.json(
          { code: 'auth_unavailable', message: 'token verification is not ready' },
          { status: 503 },
        ),
      ),
    );
    renderInstalled();

    expect(await screen.findByTestId('installed-error')).toHaveTextContent('Retry shortly');
  });

  it('shows the failed services and the logs of a failed addon', async () => {
    const { user } = renderInstalled();
    await user.click(await screen.findByRole('button', { name: 'legacy-exporter' }));

    const sheet = await screen.findByTestId('addon-detail');
    expect(
      within(sheet.querySelector('[data-testid="failed-services"]')!).getByText('legacy-exporter'),
    ).toBeVisible();
    expect(within(sheet).getByTestId('addon-logs')).toHaveTextContent('exited with code 137');
    expect(within(sheet).getByRole('button', { name: 'Copy logs' })).toBeVisible();
    expect(within(sheet).getByTestId('status-message')).toHaveTextContent(
      'grant signature invalid; re-approve the addon',
    );
  });

  it('approves a failed addon again after the permissions were accepted', async () => {
    const { user } = renderInstalled();
    await user.click(await screen.findByRole('button', { name: 'Approve legacy-exporter again' }));

    const dialog = await screen.findByTestId('consent-dialog');
    expect(dialog).toHaveTextContent('Approve legacy-exporter again');
    expect(within(dialog).getByTestId('permission-host_paths:/var/log:ro')).toHaveTextContent(
      'read-only',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Accept and approve' }));

    await waitFor(() => expect(screen.queryByTestId('consent-dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Approved legacy-exporter, deploying it again')).toBeVisible();
    await waitForStatus('legacy-exporter', 'Active');
  });

  it('updates an addon after the new version was accepted, flagging grown permissions', async () => {
    const { user } = renderInstalled();
    await user.click(await screen.findByRole('button', { name: 'Update analytics to 1.2.0' }));

    const dialog = await screen.findByTestId('consent-dialog');
    expect(dialog).toHaveTextContent('Update Platform Analytics to 1.2.0?');
    expect(within(dialog).getByTestId('consent-subject')).toHaveTextContent(
      'Platform Analyticsanalytics',
    );
    expect(within(dialog).getByTestId('consent-version')).toHaveTextContent('1.1.0 to 1.2.0');
    expect(within(dialog).getByTestId('permissions-grow')).toBeVisible();
    expect(within(dialog).getByTestId('permission-host_ports:9090')).toHaveTextContent('New');
    expect(within(dialog).getByTestId('permission-host_ports:8080')).not.toHaveTextContent('New');
    expect(within(dialog).getByTestId('service-analytics-collector')).toHaveTextContent(
      'analytics-collector:1.2.0@sha256:',
    );
    // Environment names only, never values.
    expect(within(dialog).getByText('DB_PASSWORD')).toBeVisible();
    expect(document.body).not.toHaveTextContent('fake-password');
    await user.click(within(dialog).getByRole('button', { name: 'Accept and update' }));

    expect(await screen.findByText('Updating Platform Analytics to 1.2.0')).toBeVisible();
    await waitForStatus('analytics', 'Active');
    expect(screen.queryByRole('button', { name: /Update analytics/ })).not.toBeInTheDocument();
    expect(mockAddons.state.installed.find((a) => a.qualified_name === 'analytics')?.version).toBe(
      '1.2.0',
    );
  });

  it('asks before an update even when the permissions stay the same', async () => {
    const catalog = mockAddons.state.catalog.find((d) => d.name === 'analytics')!;
    catalog.permissions.host_ports = [8080];
    catalog.services[0]!.ports = {};
    const { user } = renderInstalled();
    await user.click(await screen.findByRole('button', { name: 'Update analytics to 1.2.0' }));

    const dialog = await screen.findByTestId('consent-dialog');
    expect(within(dialog).queryByTestId('permissions-grow')).toBeNull();
    expect(byName('analytics').version).toBe('1.1.0');
  });

  it('requires ticking off dangerous permissions before accepting them', async () => {
    const legacy = mockAddons.state.catalog.find((d) => d.name === 'legacy-exporter')!;
    legacy.permissions.docker_socket = true;
    const { user } = renderInstalled();
    await user.click(await screen.findByRole('button', { name: 'Approve legacy-exporter again' }));

    const dialog = await screen.findByTestId('consent-dialog');
    expect(within(dialog).getByTestId('permission-docker_socket')).toHaveTextContent('Dangerous');
    const accept = within(dialog).getByRole('button', { name: 'Accept and approve' });
    expect(accept).toBeDisabled();
    await user.click(within(dialog).getByLabelText(/I understand/));
    expect(accept).toBeEnabled();
  });

  it('disables an addon, then removes it, and refreshes the addon UIs', async () => {
    const { user, services } = renderInstalled();
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');

    await user.click(await screen.findByRole('button', { name: 'Disable example' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('containers of this addon are stopped');
    await user.click(within(dialog).getByRole('button', { name: 'Disable addon' }));

    await waitForStatus('example', 'Disabled');
    expect(mockAddons.state.installed.find((a) => a.qualified_name === 'example')?.status).toBe(
      'disabled',
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: uiAddonsQueryKey });
    // Disabled addons offer removal, not another disable.
    expect(screen.queryByRole('button', { name: 'Disable example' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove example' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove addon' }),
    );

    await waitFor(() => expect(screen.queryByText('example', { selector: 'td span' })).toBeNull());
    expect(mockAddons.state.installed.map((a) => a.qualified_name)).toEqual([
      'analytics',
      'legacy-exporter',
    ]);
  });

  const byName = (name: string) =>
    mockAddons.state.installed.find((a) => a.qualified_name === name)!;
  const idOf = (name: string) => byName(name)._id;
  /** The list as the backend serializes it right now. */
  const listBody = (): JsonBodyType => JSON.parse(mockAddons.manager.list().text!) as JsonBodyType;

  it('blocks actions while an addon is changing and notices when it settled', async () => {
    byName('analytics').status = 'installing';
    const { services } = renderInstalled();
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');

    expect(await screen.findByRole('button', { name: 'Disable analytics' })).toBeDisabled();
    // The install finishes on the backend; the next poll picks it up.
    mockAddons.forceStatus(idOf('analytics'), 'active');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Disable analytics' })).toBeEnabled(),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: uiAddonsQueryKey });
  });

  it('keeps polling after an addon became active, to notice a crash the monitor finds later', async () => {
    renderInstalled();
    const row = await rowOf('example');
    expect(within(row).getByText('Active')).toBeVisible();

    // What addons-monitor does 30-90s after a detached `docker run` succeeded.
    const example = byName('example');
    example.status = 'failed';
    example.status_details = { failed_services: ['example-worker'] };
    example.logs = 'Container example-worker exited with code 1';

    await waitForStatus('example', 'Failed');
  });

  it('polls fast only while an addon is changing, and slowly once it is stuck', async () => {
    byName('analytics').status = 'installing';
    let lists = 0;
    mockServer.use(
      http.get(`${TEST_ADDONS_MANAGER_URL}/`, () => {
        lists += 1;
        return HttpResponse.json(listBody());
      }),
    );
    renderInstalled();
    await rowOf('analytics');

    await new Promise((resolve) => setTimeout(resolve, 300));
    // 30ms interval while the install is fresh.
    expect(lists).toBeGreaterThan(5);

    // Past the 500ms timeout the fast poll gives up: only the 100ms idle poll remains.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const atTimeout = lists;
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(lists - atTimeout).toBeLessThanOrEqual(5);
    expect(lists - atTimeout).toBeGreaterThanOrEqual(2);
  });

  it('offers "Disable anyway" for an install that never finishes, with a warning', async () => {
    byName('analytics').status = 'installing';
    const remove = vi.spyOn(mockAddons.manager, 'remove');
    const { user } = renderInstalled();

    expect(await screen.findByRole('button', { name: 'Disable analytics' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Disable analytics anyway' })).toBeNull();

    const anyway = await screen.findByRole('button', { name: 'Disable analytics anyway' });
    await user.click(anyway);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('may still be working on it');
    expect(remove).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Disable anyway' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(idOf('analytics')));
    await waitForStatus('analytics', 'Disabled');
  });

  it('does not delete an addon that was disabled since the list was loaded', async () => {
    const stale = listBody();
    mockServer.use(http.get(`${TEST_ADDONS_MANAGER_URL}/`, () => HttpResponse.json(stale)));
    const remove = vi.spyOn(mockAddons.manager, 'remove');
    const { user } = renderInstalled();

    const disable = await screen.findByRole('button', { name: 'Disable example' });
    mockAddons.forceStatus(idOf('example'), 'disabled');
    await user.click(disable);
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Disable addon' }),
    );

    expect(await screen.findByText('Example Addon was already disabled')).toBeVisible();
    expect(remove).not.toHaveBeenCalled();
    expect(mockAddons.state.installed.some((a) => a.qualified_name === 'example')).toBe(true);
  });

  it('says so when the addon to disable no longer exists', async () => {
    const stale = listBody();
    mockServer.use(http.get(`${TEST_ADDONS_MANAGER_URL}/`, () => HttpResponse.json(stale)));
    const { user } = renderInstalled();

    const disable = await screen.findByRole('button', { name: 'Disable example' });
    mockAddons.state.installed = mockAddons.state.installed.filter(
      (a) => a.qualified_name !== 'example',
    );
    await user.click(disable);
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Disable addon' }),
    );

    expect(await screen.findByText('Example Addon no longer exists')).toBeVisible();
  });

  it('treats a 404 on remove as already removed', async () => {
    mockAddons.forceStatus(idOf('example'), 'disabled');
    const stale = listBody();
    mockServer.use(http.get(`${TEST_ADDONS_MANAGER_URL}/`, () => HttpResponse.json(stale)));
    const { user } = renderInstalled();

    const remove = await screen.findByRole('button', { name: 'Remove example' });
    mockAddons.state.installed = mockAddons.state.installed.filter(
      (a) => a.qualified_name !== 'example',
    );
    await user.click(remove);
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove addon' }),
    );

    expect(await screen.findByText('Example Addon was already removed')).toBeVisible();
  });

  it('keeps the table and shows a banner when a background poll fails, without a toast', async () => {
    const { user } = renderInstalled();
    expect(await rowOf('example')).toBeVisible();

    mockServer.use(
      http.get(`${TEST_ADDONS_MANAGER_URL}/`, () => new HttpResponse(null, { status: 502 })),
    );
    const banner = await screen.findByTestId('installed-error');
    expect(banner).toHaveTextContent('Could not refresh the installed addons');
    expect(banner).toHaveTextContent('may be out of date');
    expect(await rowOf('example')).toBeVisible();
    expect(screen.queryByText('Could not refresh the data on this page')).not.toBeInTheDocument();

    mockServer.resetHandlers();
    await user.click(within(banner).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByTestId('installed-error')).not.toBeInTheDocument());
  });

  it('shows addon UIs without an installed addon in their own section', async () => {
    const { services } = renderInstalled();
    act(() => {
      setEntry(services.addons, {
        ...base,
        name: 'local-dev',
        basePath: '/addons/local-dev',
        version: '0.0.1',
        state: 'loaded',
        definition: { id: 'local-dev', label: 'Local dev' },
      });
    });

    const row = await screen.findByTestId('unmatched-ui-local-dev');
    expect(row).toHaveTextContent('0.0.1');
    // The UI's own label, with the addon name it was registered under.
    expect(row).toHaveTextContent('Local devlocal-dev');
    expect(screen.queryByTestId('unmatched-ui-example')).not.toBeInTheDocument();
  });

  it('labels preset addons as part of the deployment and lists their nav item keys', async () => {
    const { services } = renderInstalled();
    act(() => {
      setEntry(services.addons, {
        ...base,
        name: 'acme-billing',
        origin: 'preset',
        basePath: '/billing',
        version: '2.0.0',
        state: 'loaded',
        definition: {
          id: 'acme-billing',
          label: 'Billing',
          contributions: {
            'nav.items': [{ id: 'billing', label: 'Billing', path: '/', order: 1 }],
          },
        },
      });
    });

    const card = await screen.findByTestId('preset-uis');
    expect(card).toHaveTextContent('Part of this deployment');
    expect(within(card).getByTestId('unmatched-ui-acme-billing')).toHaveTextContent(
      'addon:acme-billing:billing',
    );
    expect(within(card).queryByRole('button', { name: /disable|remove/i })).toBeNull();
    expect(screen.queryByTestId('unmatched-uis')).not.toBeInTheDocument();
  });

  it('shows the nav item keys of an installed addon in its detail sheet', async () => {
    const { user, services } = renderInstalled();
    await rowOf('example');
    act(() => {
      setEntry(services.addons, {
        ...base,
        name: 'example',
        basePath: '/addons/example',
        version: '1.0.0',
        state: 'loaded',
        definition: {
          id: 'example',
          contributions: { 'nav.items': [{ id: 'home', label: 'Example', path: '/' }] },
        },
      });
    });
    await user.click(await screen.findByRole('button', { name: 'Example Addon (example)' }));

    expect(
      await within(await screen.findByTestId('addon-detail')).findByTestId('nav-item-keys'),
    ).toHaveTextContent('addon:example:home');
  });

  it('points to the marketplace when nothing is installed', async () => {
    mockAddons.state.installed = [];
    renderInstalled();

    expect(await screen.findByText('No addons installed')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open the marketplace' })).toHaveAttribute(
      'href',
      '/addon-manager/marketplace',
    );
  });

  it('shows an inline error with a retry when the addons service is unreachable', async () => {
    mockServer.use(
      http.get(`${TEST_ADDONS_MANAGER_URL}/`, () => new HttpResponse(null, { status: 502 })),
    );
    const { user } = renderInstalled();

    const alert = await screen.findByTestId('installed-error');
    expect(alert).toHaveTextContent('The addons service is not reachable');
    expect(screen.queryByRole('list', { name: 'Installed addons' })).not.toBeInTheDocument();

    mockServer.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await rowOf('example')).toBeVisible();
  });

  it('refuses the page to non-admins', async () => {
    renderInstalled({ user: { username: 'alice' } });

    expect(await screen.findByText('Access denied')).toBeVisible();
    expect(screen.queryByTestId('nav-addon-manager-addon-manager')).not.toBeInTheDocument();
  });

  it('redirects /addon-manager to the installed tab', async () => {
    const { router } = renderInstalled({ route: '/addon-manager' });

    expect(await rowOf('example')).toBeVisible();
    expect(router.state.location.pathname).toBe('/addon-manager/installed');
  });
});
