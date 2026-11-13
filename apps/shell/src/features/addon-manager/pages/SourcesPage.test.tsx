import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockAddons } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { addonManagerModule } from '../index';

function renderSources(options: Partial<Parameters<typeof renderApp>[0]> = {}) {
  return renderApp({
    modules: [addonManagerModule],
    route: '/addon-manager/sources',
    ...options,
  });
}

const row = (name: string) => screen.findByTestId(`source-${name}`);

describe('<SourcesPage>', () => {
  it('lists the sources with their kind, sync state and errors', async () => {
    const { user } = renderSources();

    const official = await row('official');
    expect(official).toHaveTextContent('community-marketplace');
    expect(official).toHaveTextContent('Synced');
    // Configured by the environment: neither deletable nor flagged as relaxed.
    expect(official).not.toHaveTextContent('http allowed');
    await user.click(within(official).getByRole('button', { name: 'More actions for official' }));
    expect(await screen.findByRole('menuitem', { name: 'Show its addons' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Delete tap' })).toBeNull();
    await user.keyboard('{Escape}');

    const acme = await row('acme');
    expect(acme).toHaveTextContent('Tap');
    expect(acme).toHaveTextContent('Token');
    expect(acme).not.toHaveTextContent('fake-acme-token');
    expect(within(acme).getByRole('button', { name: 'Sync acme' })).toBeVisible();

    // The failure is the sync button's state, its reason the button's hint.
    expect(within(await row('lab')).getByText('Sync failed')).toBeVisible();
    expect(await screen.findByTestId('source-sync-lab-hint')).toHaveTextContent('404 Not Found');
    const local = await row('local');
    expect(within(local).queryByRole('button', { name: 'Sync local' })).toBeNull();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('HomeAddonsSources');
    // The tab flags a source that cannot be synced.
    expect(screen.getByText('A source could not be synced')).toBeInTheDocument();
  });

  it('adds a tap, without echoing its token', async () => {
    const { user } = renderSources();
    await user.click(await screen.findByRole('button', { name: 'Add tap' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Name'), 'Bad Name');
    await user.type(within(dialog).getByLabelText('Index URL'), 'https://new.example/index.json');
    await user.click(within(dialog).getByRole('button', { name: 'Add tap' }));
    expect(await within(dialog).findByText(/Lowercase letters/)).toBeVisible();

    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'new');
    await user.type(within(dialog).getByLabelText('Token (optional)'), 'secret-token');
    await user.click(within(dialog).getByRole('button', { name: 'Add tap' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await row('new')).toHaveTextContent('Token');
    expect(document.body).not.toHaveTextContent('secret-token');
    expect(mockAddons.state.sources.find((s) => s.name === 'new')?.token).toBe('secret-token');
  });

  it('shows the marketplace refusal of a tap in the dialog', async () => {
    const { user } = renderSources();
    await user.click(await screen.findByRole('button', { name: 'Add tap' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'plain');
    await user.type(within(dialog).getByLabelText('Index URL'), 'http://plain.example/index.json');
    await user.click(within(dialog).getByRole('button', { name: 'Add tap' }));

    expect(await within(dialog).findByTestId('add-tap-error')).toHaveTextContent('allow_insecure');
  });

  it('syncs a source and reports a failing fetch', async () => {
    const { user } = renderSources();
    await user.click(within(await row('acme')).getByRole('button', { name: 'Sync acme' }));
    expect(await screen.findByText('Synced acme')).toBeVisible();

    mockAddons.state.sources.find((s) => s.name === 'acme')!.url = 'https://unreachable.example/';
    await user.click(within(await row('acme')).getByRole('button', { name: 'Sync acme' }));
    expect(await screen.findByText('Could not sync the source')).toBeVisible();
    expect(await screen.findByTestId('source-sync-acme-hint')).toHaveTextContent('unreachable');
  });

  it('deletes a tap after a confirmation', async () => {
    const { user } = renderSources();
    await user.click(
      within(await row('acme')).getByRole('button', { name: 'More actions for acme' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete tap' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('This removes 1 addon from the marketplace');
    await user.click(within(dialog).getByRole('button', { name: 'Delete tap' }));

    await waitFor(() => expect(screen.queryByTestId('source-acme')).not.toBeInTheDocument());
    expect(mockAddons.state.catalog.some((d) => d.source.name === 'acme')).toBe(false);
  });

  it('links a source to its addons in the marketplace', async () => {
    const { user, router } = renderSources();
    await user.click(await screen.findByRole('link', { name: 'Addons of acme' }));

    expect(await screen.findByTestId('marketplace-card-acme/node-exporter')).toBeVisible();
    expect(router.state.location.search).toBe('?source=acme');
    expect(screen.queryByTestId('marketplace-card-flops')).not.toBeInTheDocument();
  });
});
