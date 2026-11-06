import type { CommandContext, CommandResult } from '@oakestra/dashboard-sdk';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@oakestra/ui';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authModule } from '../../features/auth';
import { addonSource } from '../../core/addons/ui-addons';
import type { CoreModule } from '../../core/modules';
import { notify } from '../../core/notify/notify';
import { renderApp } from '../../test/render';
import { linkedAddons } from '../modules';

function DialogPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <h1>Other page</h1>
      <input aria-label="Page input" />
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Some dialog</DialogTitle>
          <DialogDescription>In the way</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}

const run = vi.fn<(ctx: CommandContext) => void | Promise<void>>();
const search = vi.fn<(query: string) => Promise<readonly CommandResult[]>>();

const demoModule: CoreModule = {
  id: 'demo',
  label: 'Demo',
  routes: [
    { path: 'other', element: <DialogPage /> },
    { path: 'target', element: <h1>Target page</h1> },
    { path: 'target/sub', element: <h1>Sub page</h1> },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'target',
        label: 'Target',
        path: '/target',
        group: 'main',
        children: [
          { id: 'overview', label: 'Overview', path: '/target' },
          { id: 'sub', label: 'Sub page', path: '/target/sub' },
          { id: 'secret', label: 'Secret page', path: '/target/secret', roles: ['Admin'] },
        ],
      },
      { id: 'admin', label: 'Admin area', path: '/admin-area', roles: ['Admin'] },
    ],
    'command.actions': [
      { id: 'run', label: 'Run the thing', keywords: ['execute'], run },
      { id: 'open', label: 'Open the target', path: '/target' },
      { id: 'adminonly', label: 'Admin thing', roles: ['Admin'], run },
    ],
    'command.sources': [
      { id: 'things', label: 'Things', search: (query) => search(query) },
      {
        id: 'broken',
        label: 'Broken source',
        search: (query) =>
          query === 'broken' ? Promise.reject(new Error('no')) : Promise.resolve([]),
      },
    ],
  },
};

function renderPalette(options: Parameters<typeof renderApp>[0] = {}) {
  search.mockResolvedValue([]);
  return renderApp({
    modules: [demoModule],
    route: '/other',
    user: { username: 'Admin' },
    ...options,
  });
}

const openPalette = async () => {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  return screen.findByRole('dialog', { name: 'Find or run anything' });
};
const paletteInput = () => screen.findByRole('combobox', { name: 'Find or run anything' });
const queryDialog = () => screen.queryByRole('dialog', { name: 'Find or run anything' });
const option = (name: string | RegExp) => screen.findByRole('option', { name });

afterEach(() => {
  run.mockReset();
  search.mockReset();
  vi.restoreAllMocks();
});

describe('<CommandPalette>', () => {
  it('opens from the button in the header', async () => {
    const { user } = renderPalette();
    await user.click(await screen.findByRole('button', { name: 'Find or run anything' }));
    expect(await paletteInput()).toHaveFocus();
  });

  it('opens with Ctrl+K and with Cmd+K, also from an input, and toggles', async () => {
    renderPalette();
    const input = await screen.findByRole('textbox', { name: 'Page input' });
    input.focus();

    const notPrevented = fireEvent.keyDown(input, { key: 'k', metaKey: true });
    expect(notPrevented).toBe(false);
    await screen.findByRole('dialog', { name: 'Find or run anything' });

    fireEvent.keyDown(await paletteInput(), { key: 'k', ctrlKey: true });
    await waitFor(() => expect(queryDialog()).not.toBeInTheDocument());
  });

  it('leaves other key combinations alone', async () => {
    renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    expect(fireEvent.keyDown(window, { key: 'k' })).toBe(true);
    expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(queryDialog()).not.toBeInTheDocument();
  });

  it('does not open over another dialog', async () => {
    const { user } = renderPalette();
    await user.click(await screen.findByRole('button', { name: 'Open dialog' }));
    await screen.findByRole('dialog', { name: 'Some dialog' });

    expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true })).toBe(false);

    // Long enough for the lazy dialog to appear, had it been asked for.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(queryDialog()).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Some dialog' })).toBeVisible();
  });

  it('starts empty every time it opens', async () => {
    const { user } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    await openPalette();
    await user.type(await paletteInput(), 'target');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(queryDialog()).not.toBeInTheDocument());

    await openPalette();
    expect(await paletteInput()).toHaveValue('');
  });

  it('lists the pages the user may open, once per destination', async () => {
    renderPalette({ user: { username: 'alice' } });
    await screen.findByRole('heading', { name: 'Other page' });
    const dialog = await openPalette();

    expect(await option('Target')).toBeVisible();
    expect(await option(/^Sub page/)).toBeVisible();
    // Same path as its parent.
    expect(within(dialog).queryByRole('option', { name: 'Overview' })).toBeNull();
    // Roles of top-level items, sub-items and actions.
    expect(within(dialog).queryByRole('option', { name: 'Admin area' })).toBeNull();
    expect(within(dialog).queryByRole('option', { name: /Secret page/ })).toBeNull();
    expect(within(dialog).queryByRole('option', { name: 'Admin thing' })).toBeNull();
  });

  it('shows what a role allows', async () => {
    renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    await openPalette();
    expect(await option('Admin area')).toBeVisible();
    expect(await option('Admin thing')).toBeVisible();
  });

  it('leaves out what the preset hides and renames what it renames', async () => {
    renderPalette({
      preset: {
        nav: {
          items: {
            'core:demo:admin': { hidden: true },
            'core:demo:target': { label: 'Renamed' },
          },
        },
      },
    });
    await screen.findByRole('heading', { name: 'Other page' });
    const dialog = await openPalette();
    expect(await option('Renamed')).toBeVisible();
    expect(within(dialog).queryByRole('option', { name: 'Admin area' })).toBeNull();
  });

  it('has nothing from a module the preset leaves out', async () => {
    renderApp({
      linked: linkedAddons,
      preset: { modules: ['applications'] },
      user: { username: 'Admin' },
      route: '/applications',
    });
    await screen.findByRole('heading', { name: 'Applications' });
    const dialog = await openPalette();
    expect(await option('New application')).toBeVisible();
    expect(within(dialog).queryByRole('option', { name: 'Show fleet exceptions' })).toBeNull();
    expect(within(dialog).queryByRole('option', { name: 'Fleet' })).toBeNull();
  });

  it('narrows the list as the user types and says when there is nothing', async () => {
    const { user } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    const dialog = await openPalette();
    await user.type(await paletteInput(), 'execute');

    expect(await option('Run the thing')).toBeVisible();
    expect(within(dialog).queryByRole('option', { name: 'Target' })).toBeNull();

    await user.clear(await paletteInput());
    await user.type(await paletteInput(), 'zzzz');
    expect(await screen.findByText('Nothing found for "zzzz"')).toBeVisible();
    expect(within(dialog).queryAllByRole('option')).toHaveLength(0);
  });

  it('navigates to a page with Enter and closes', async () => {
    const { user, router } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    await openPalette();
    await user.type(await paletteInput(), 'sub page');
    await option(/^Sub page/);
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Sub page' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/target/sub');
    expect(queryDialog()).not.toBeInTheDocument();
  });

  it('runs an action with its context after closing', async () => {
    const { user } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    run.mockImplementation((ctx) => {
      expect(queryDialog()).not.toBeInTheDocument();
      expect(ctx.addon).toBeUndefined();
      expect(ctx.user.username).toBe('Admin');
      ctx.navigate('/target');
    });
    await openPalette();
    await user.click(await option('Run the thing'));

    await waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(await screen.findByRole('heading', { name: 'Target page' })).toBeVisible();
  });

  it('reports an action that fails', async () => {
    const error = vi.spyOn(notify, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    run.mockRejectedValue(new Error('It broke'));
    await openPalette();
    await user.click(await option('Run the thing'));

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith('Run the thing failed', { description: 'It broke' }),
    );
    expect(screen.getByRole('heading', { name: 'Other page' })).toBeVisible();
  });

  it('opens configured links in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { user } = renderPalette({ config: { grafanaUrl: 'https://grafana.example/' } });
    await screen.findByRole('heading', { name: 'Other page' });
    await openPalette();
    await user.click(await option('Grafana'));
    expect(open).toHaveBeenCalledWith('https://grafana.example/', '_blank', 'noopener,noreferrer');
  });

  it('searches the sources once typing pauses, not below the minimum length', async () => {
    const { user } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    search.mockResolvedValue([{ id: '1', label: 'Thing one', path: '/target', tone: 'warning' }]);
    await openPalette();
    expect(search).not.toHaveBeenCalled();

    await user.type(await paletteInput(), 't');
    await act(() => new Promise((resolve) => setTimeout(resolve, 250)));
    expect(search).not.toHaveBeenCalled();

    await user.type(await paletteInput(), 'hin');
    const row = await option('Thing one');
    expect(search).toHaveBeenCalledWith('thin');
    expect(search).not.toHaveBeenCalledWith('th');
    expect(within(row).queryByText('Thing one')).toBeVisible();
    expect(row.querySelector('[data-slot="status-dot"]')).toHaveAttribute('data-tone', 'warning');
  });

  it('keeps the selection on the first row when results arrive', async () => {
    const { user } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    search.mockResolvedValue([{ id: '1', label: 'Target thing', path: '/target/sub' }]);
    await openPalette();
    await user.type(await paletteInput(), 'target');
    await option('Target thing');
    expect(await option('Target')).toHaveAttribute('aria-selected', 'true');
  });

  it('selects the first result when only a source found something', async () => {
    const { user } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    search.mockResolvedValue([{ id: '1', label: 'Hidden gem', path: '/target/sub' }]);
    await openPalette();
    await user.type(await paletteInput(), 'gem');
    await waitFor(async () =>
      expect(await option('Hidden gem')).toHaveAttribute('aria-selected', 'true'),
    );
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'Sub page' })).toBeVisible();
  });

  it('does not let a result of the previous query take Enter', async () => {
    const { user, router } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    search.mockImplementation((query) =>
      query === 'gem'
        ? Promise.resolve([{ id: '1', label: 'Hidden gem', path: '/target/sub' }])
        : new Promise(() => {}),
    );
    await openPalette();
    await user.type(await paletteInput(), 'gem');
    await waitFor(async () =>
      expect(await option('Hidden gem')).toHaveAttribute('aria-selected', 'true'),
    );

    await user.type(await paletteInput(), 's{Enter}');

    expect(await option('Hidden gem')).toHaveAttribute('aria-disabled', 'true');
    expect(router.state.location.pathname).toBe('/other');
    expect(queryDialog()).toBeInTheDocument();
  });

  it('names a source that failed and keeps the others', async () => {
    const { user } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    search.mockResolvedValue([{ id: '1', label: 'Fine result', path: '/target' }]);
    await openPalette();
    await user.type(await paletteInput(), 'broken');

    expect(await screen.findByText('Broken source could not be searched')).toBeVisible();
    expect(await option('Fine result')).toBeVisible();
  });

  it('shows how a runtime addon differs from what the deployment ships', async () => {
    const { user, services } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    const source = addonSource(
      { name: 'flops', version: '3.0.0', basePath: '/addons/flops', origin: 'manager' },
      'FLOps',
    );
    const addonRun = vi.fn<(ctx: CommandContext) => void>();
    act(() => {
      services.contributions.getState().register(source, {
        'command.actions': [{ id: 'train', label: 'Start a training round', run: addonRun }],
        'command.sources': [
          {
            id: 'runs',
            label: 'Training runs',
            search: (_query, ctx) =>
              Promise.resolve([
                { id: 'r', label: 'Run 7', path: ctx.addon?.path('runs', 7) ?? '' },
              ]),
          },
        ],
      });
    });

    const dialog = await openPalette();
    expect(within(dialog).getByRole('option', { name: /Start a training/ })).toBeVisible();

    await user.type(await paletteInput(), 'train');
    const action = await option(/Start a training round/);
    expect(within(action).getByText('FLOps')).toBeVisible();
    expect(screen.getByText('From addons')).toBeVisible();

    const result = await option(/Run 7/);
    expect(within(result).getByText('FLOps')).toBeVisible();

    await user.click(action);
    await waitFor(() => expect(addonRun).toHaveBeenCalledOnce());
    expect(addonRun.mock.calls[0]?.[0].addon?.path('x')).toBe('/addons/flops/x');
  });

  it('survives an addon icon that throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { services } = renderPalette();
    await screen.findByRole('heading', { name: 'Other page' });
    const Broken = () => {
      throw new Error('icon');
    };
    act(() => {
      services.contributions.getState().register(
        { kind: 'core', id: 'bad', label: 'Bad' },
        {
          'command.actions': [{ id: 'bad', label: 'Bad icon', path: '/target', icon: Broken }],
        },
      );
    });
    await openPalette();
    expect(await option('Bad icon')).toBeVisible();
  });

  it('does not exist without a session', async () => {
    renderApp({ modules: [authModule, demoModule], route: '/other', user: null });
    await screen.findAllByRole('button', { name: /log in|sign in/i });
    expect(screen.queryByRole('button', { name: 'Find or run anything' })).toBeNull();
  });
});
