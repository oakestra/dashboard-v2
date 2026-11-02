import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CoreModule } from '../../core/modules';
import { renderApp } from '../../test/render';

const modules: CoreModule[] = [
  { id: 'demo', label: 'Demo', routes: [{ index: true, element: <h1>Home</h1> }] },
];

describe('<UserMenu> theme picker', () => {
  it('switches the theme from the segmented picker and keeps the menu open', async () => {
    const { user } = renderApp({ modules, route: '/' });

    await user.click(await screen.findByTestId('user-menu'));
    const picker = await screen.findByRole('group', { name: 'Theme' });
    const dark = screen.getByRole('menuitemradio', { name: 'Dark' });
    expect(picker).toContainElement(dark);

    await user.click(dark);

    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    // Still open, so the user sees the result next to the control they used.
    expect(screen.getByRole('menu')).toBeVisible();
  });

  it('is reachable with the keyboard like the other menu items', async () => {
    const { user } = renderApp({ modules, route: '/' });

    await user.click(await screen.findByTestId('user-menu'));
    await screen.findByRole('menu');
    // Profile, then the three theme segments in order.
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(document.documentElement).toHaveClass('dark');
  });
});
