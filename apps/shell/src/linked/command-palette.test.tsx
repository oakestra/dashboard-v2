import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { linkedAddons } from '../app/modules';
import { renderApp, type RenderAppOptions } from '../test/render';

function renderPalette(options: Partial<RenderAppOptions> = {}) {
  return renderApp({ linked: linkedAddons, route: '/help', ...options });
}

async function openPalette() {
  await screen.findByRole('button', { name: 'Find or run anything' });
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  return screen.findByRole('dialog', { name: 'Find or run anything' });
}

const paletteInput = () => screen.findByRole('combobox', { name: 'Find or run anything' });

describe('the packages in the command palette', () => {
  it('finds a service that cannot be placed and opens it', async () => {
    const { user, router } = renderPalette();
    await openPalette();
    await user.type(await paletteInput(), 'trainer');

    const row = await screen.findByRole('option', { name: /mlbatch \/ trainer/ });
    expect(within(row).getByText("Service, can't be placed")).toBeVisible();
    await user.click(row);

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/applications\/\w+\/services\/\w+$/),
    );
  });

  it('finds clusters for those who may open them', async () => {
    const { user, router } = renderPalette({ user: { username: 'bob' } });
    await openPalette();
    await user.type(await paletteInput(), 'edge');

    await user.click(await screen.findByRole('option', { name: /edge-munich/ }));
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/infrastructure\/clusters\/\w+$/),
    );
  });

  it('does not search clusters for anyone else', async () => {
    const { user } = renderPalette({ user: { username: 'alice' } });
    const dialog = await openPalette();
    await user.type(await paletteInput(), 'edge');

    await screen.findByText('Nothing found for "edge"');
    expect(within(dialog).queryByRole('option', { name: /edge-munich/ })).toBeNull();
  });

  it('opens the form for a new application', async () => {
    const { user } = renderPalette();
    await openPalette();
    await user.click(await screen.findByRole('option', { name: 'New application' }));

    expect(await screen.findByRole('dialog', { name: 'New application' })).toBeVisible();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers a new application only to those who get the button elsewhere', async () => {
    renderPalette({ user: { username: 'bob' } });
    const dialog = await openPalette();
    await screen.findByRole('option', { name: /Applications by cluster/ });
    expect(within(dialog).queryByRole('option', { name: 'New application' })).toBeNull();
  });

  it('opens the applications by cluster', async () => {
    const { user, router } = renderPalette();
    await openPalette();
    await user.click(await screen.findByRole('option', { name: /Applications by cluster/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
    expect(router.state.location.search).toBe('?view=clusters');
    expect(await screen.findByRole('radio', { name: 'By cluster' })).toBeChecked();
    expect(await screen.findByRole('list', { name: 'Applications by cluster' })).toBeVisible();
  });

  it('goes to the pages of a package', async () => {
    const { user, router } = renderPalette({ user: { username: 'bob' } });
    await openPalette();
    await user.click(await screen.findByRole('option', { name: 'Infrastructure' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/infrastructure'));
  });
});
