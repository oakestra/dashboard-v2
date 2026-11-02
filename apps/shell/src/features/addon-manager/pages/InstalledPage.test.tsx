import { http, HttpResponse } from '@oakestra/mocks';
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

const base = { sdk: '^0.1.0', entry: 'http://x/mf-manifest.json' };

function renderInstalled(options: Partial<Parameters<typeof renderApp>[0]> = {}) {
  return renderApp({
    modules: [addonManagerModule],
    route: '/addon-manager/installed',
    ...options,
  });
}

const rowOf = async (name: string) => {
  const cell = await screen.findByText(name, { selector: 'td span' });
  return cell.closest('tr')!;
};

/**
 * Waits until the row of `name` shows `status`. The row is looked up on every retry: a status
 * change re-renders the table, and a cell found before that is detached, so its closest('tr') is
 * null.
 */
const waitForStatus = (name: string, status: string) =>
  waitFor(() => {
    const row = screen.getByText(name, { selector: 'td span' }).closest('tr');
    expect(within(row!).getByText(status)).toBeVisible();
  });

describe('<InstalledPage>', () => {
  it('lists the installed addons with status badges and the dashboard UI column', async () => {
    const { services } = renderInstalled();
    act(() => {
      setEntry(services.addons, {
        ...base,
        name: 'example',
        version: '0.1.0',
        state: 'loaded',
        definition: { id: 'example' },
      });
    });

    const example = await rowOf('example');
    expect(within(example).getByText('Active')).toBeVisible();
    expect(within(example).getByText('Loaded')).toBeVisible();
    expect(within(example).getByText('2')).toBeVisible();
    const analytics = await rowOf('analytics');
    expect(within(analytics).getByText('Partially active')).toBeVisible();
    expect(within(analytics).getByText('None')).toBeVisible();
    expect(within(analytics).getByText(/services failing/)).toBeVisible();
    expect(within(await rowOf('legacy-exporter')).getByText('Failed')).toBeVisible();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('HomeAddonsInstalled');
  });

  it('shows why a dashboard UI failed or is incompatible', async () => {
    const { services, user } = renderInstalled();
    act(() => {
      setEntry(services.addons, {
        ...base,
        name: 'example',
        version: '0.1.0',
        state: 'failed',
        error: 'manifest 502',
      });
      setEntry(services.addons, {
        ...base,
        name: 'analytics',
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
    await user.click(await rowOf('example'));

    const sheet = await screen.findByTestId('addon-detail');
    const worker = within(within(sheet).getByTestId('service-example-worker'));
    expect(worker.getByText('ghcr.io/oakestra/example-worker:0.1.0')).toBeVisible();
    expect(worker.getByText('9100:9100')).toBeVisible();
    expect(worker.getByText('EXAMPLE_API_TOKEN')).toBeVisible();
    expect(worker.getByText('LOG_LEVEL')).toBeVisible();
    // The fixtures hold fake secrets, which must never reach the DOM.
    expect(document.body).not.toHaveTextContent('sk-fake-example-token');
    expect(sheet).not.toHaveTextContent('info');
    expect(within(sheet).getByText('example-data:/var/lib/example')).toBeVisible();
  });

  it('shows the failed services and the logs of a failed addon', async () => {
    const { user } = renderInstalled();
    await user.click(await rowOf('legacy-exporter'));

    const sheet = await screen.findByTestId('addon-detail');
    expect(
      within(sheet.querySelector('[data-testid="failed-services"]')!).getByText('legacy-exporter'),
    ).toBeVisible();
    expect(within(sheet).getByTestId('addon-logs')).toHaveTextContent('exited with code 137');
    expect(within(sheet).getByRole('button', { name: 'Copy logs' })).toBeVisible();
  });

  it('disables an addon, then removes it, and refreshes the addon UIs', async () => {
    const { user, services } = renderInstalled();
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');

    await user.click(await screen.findByRole('button', { name: 'Disable example' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('containers of this addon are stopped');
    await user.click(within(dialog).getByRole('button', { name: 'Disable addon' }));

    await waitForStatus('example', 'Disabled');
    expect(mockAddons.state.installed.find((a) => a.name === 'example')?.status).toBe('disabled');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: uiAddonsQueryKey });
    // Disabled addons offer removal, not another disable.
    expect(screen.queryByRole('button', { name: 'Disable example' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove example' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove addon' }),
    );

    await waitFor(() => expect(screen.queryByText('example', { selector: 'td span' })).toBeNull());
    expect(mockAddons.state.installed.map((a) => a.name)).toEqual(['analytics', 'legacy-exporter']);
  });

  const idOf = (name: string) => mockAddons.state.installed.find((a) => a.name === name)!._id;
  const textJson = (body: unknown) =>
    HttpResponse.text(JSON.stringify(body), { headers: { 'Content-Type': 'text/html' } });

  it('blocks actions while an addon is changing and notices when it settled', async () => {
    mockAddons.state.installed.find((a) => a.name === 'analytics')!.status = 'installing';
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
    const example = mockAddons.state.installed.find((a) => a.name === 'example')!;
    example.status = 'failed';
    example.status_details = { failed_services: ['example-worker'] };
    example.logs = 'Container example-worker exited with code 1';

    await waitForStatus('example', 'Failed');
  });

  it('polls fast only while an addon is changing, and slowly once it is stuck', async () => {
    mockAddons.state.installed.find((a) => a.name === 'analytics')!.status = 'installing';
    let lists = 0;
    mockServer.use(
      http.get(`${TEST_ADDONS_MANAGER_URL}/`, () => {
        lists += 1;
        return textJson(mockAddons.state.installed);
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
    mockAddons.state.installed.find((a) => a.name === 'analytics')!.status = 'installing';
    const remove = vi.spyOn(mockAddons.manager, 'remove');
    const { user } = renderInstalled();

    expect(await screen.findByRole('button', { name: 'Disable analytics' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Disable analytics anyway' })).toBeNull();

    const anyway = await screen.findByRole('button', { name: 'Disable analytics anyway' });
    await user.click(anyway);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('may still be working on the installation');
    expect(remove).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Disable anyway' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(idOf('analytics')));
    await waitForStatus('analytics', 'Disabled');
  });

  it('does not delete an addon that was disabled since the list was loaded', async () => {
    const stale = structuredClone(mockAddons.state.installed);
    mockServer.use(http.get(`${TEST_ADDONS_MANAGER_URL}/`, () => textJson(stale)));
    const remove = vi.spyOn(mockAddons.manager, 'remove');
    const { user } = renderInstalled();

    const disable = await screen.findByRole('button', { name: 'Disable example' });
    mockAddons.forceStatus(idOf('example'), 'disabled');
    await user.click(disable);
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Disable addon' }),
    );

    expect(await screen.findByText('example was already disabled')).toBeVisible();
    expect(remove).not.toHaveBeenCalled();
    expect(mockAddons.state.installed.some((a) => a.name === 'example')).toBe(true);
  });

  it('says so when the addon to disable no longer exists', async () => {
    const stale = structuredClone(mockAddons.state.installed);
    mockServer.use(http.get(`${TEST_ADDONS_MANAGER_URL}/`, () => textJson(stale)));
    const { user } = renderInstalled();

    const disable = await screen.findByRole('button', { name: 'Disable example' });
    mockAddons.state.installed = mockAddons.state.installed.filter((a) => a.name !== 'example');
    await user.click(disable);
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Disable addon' }),
    );

    expect(await screen.findByText('example no longer exists')).toBeVisible();
  });

  it('treats a 404 on remove as already removed', async () => {
    mockAddons.forceStatus(idOf('example'), 'disabled');
    const stale = structuredClone(mockAddons.state.installed);
    mockServer.use(http.get(`${TEST_ADDONS_MANAGER_URL}/`, () => textJson(stale)));
    const { user } = renderInstalled();

    const remove = await screen.findByRole('button', { name: 'Remove example' });
    mockAddons.state.installed = mockAddons.state.installed.filter((a) => a.name !== 'example');
    await user.click(remove);
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove addon' }),
    );

    expect(await screen.findByText('example was already removed')).toBeVisible();
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
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

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
