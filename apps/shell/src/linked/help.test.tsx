import help from '@oakestra/module-help';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { linkedAddons } from '../app/modules';
import { renderApp } from '../test/render';

// The help package in the real shell: router, layout, nav and breadcrumbs. Its page itself is
// tested in modules/help.
describe('help (linked addon)', () => {
  it('is linked at /help', () => {
    expect(linkedAddons).toContainEqual({ definition: help, mount: '/help' });
  });

  it('renders at its mount with its footer nav item and crumb', async () => {
    renderApp({ linked: linkedAddons, route: '/help', user: { username: 'alice' } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Help' })).toBeVisible();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent(/^HomeHelp$/);
    const nav = screen.getByTestId('nav-help-help');
    expect(nav).toHaveAttribute('href', '/help');
    expect(within(nav).getByText('Help')).toBeVisible();
  });

  it('redirects the generic addon URL to the mount', async () => {
    const { router } = renderApp({ linked: linkedAddons, route: '/addons/help#faq-roles' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Help' })).toBeVisible();
    expect(router.state.location).toMatchObject({ pathname: '/help', hash: '#faq-roles' });
  });

  it('can be renamed and moved by the preset under its addon key', async () => {
    renderApp({
      linked: linkedAddons,
      route: '/help',
      preset: { nav: { items: { 'addon:help:help': { label: 'Support' } } } },
    });

    expect(await screen.findByTestId('nav-help-help')).toHaveTextContent('Support');
    // The first crumb links where the renamed item does, so it follows the new name.
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent(/^HomeSupport$/);
  });
});
