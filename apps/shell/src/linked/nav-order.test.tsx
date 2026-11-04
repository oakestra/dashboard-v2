import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { coreModules, linkedAddons } from '../app/modules';
import { renderApp } from '../test/render';

// Core modules and linked packages register in separate passes, so equal orders would sort by
// registration instead of by intent. The Management items therefore need distinct orders.
describe('sidebar order with the real modules and packages', () => {
  it('lists Management as Users, Infrastructure, Organizations, Addons', async () => {
    renderApp({ modules: coreModules, linked: linkedAddons, route: '/help' });

    const expected = [
      'nav-users-users',
      'nav-infrastructure-infrastructure',
      'nav-organizations-organizations',
      'nav-addon-manager-addon-manager',
    ];
    await screen.findByTestId('nav-users-users');
    const management = screen.getByText('Management').closest('[data-slot="sidebar-group"]')!;
    // Only the top-level items: the addon manager's sub-items have longer test ids.
    const ids = within(management as HTMLElement)
      .getAllByRole('link')
      .map((link) => link.getAttribute('data-testid'))
      .filter((id) => id !== null && expected.includes(id));

    expect(ids).toEqual(expected);
  });
});
