import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderApp } from '../../../test/render';
import { FAQ_ITEMS } from '../content';
import { helpModule } from '../index';

describe('<HelpPage>', () => {
  it('renders the FAQ and contact links for any logged-in user', async () => {
    const { user } = renderApp({
      modules: [helpModule],
      route: '/help',
      user: { username: 'alice' },
    });

    const first = FAQ_ITEMS[0]!;
    const trigger = await screen.findByRole('button', { name: first.question });
    await user.click(trigger);
    expect(await screen.findByText(first.answer)).toBeVisible();
    expect(screen.getByRole('link', { name: /Documentation/ })).toHaveAttribute(
      'href',
      'https://www.oakestra.io/docs/',
    );
    expect(screen.getByRole('link', { name: /GitHub/ })).toHaveAttribute('target', '_blank');
  });

  it('describes what the app really does: Admin-only user management, no service editing', () => {
    const answer = (id: string) => FAQ_ITEMS.find((item) => item.id === id)!.answer;
    expect(answer('roles')).toMatch(/Admins manage everything, including the Users/);
    expect(answer('roles')).not.toMatch(/Organization Admins manage the users/);
    expect(answer('deploy')).toMatch(/Duplicate/);
    expect(answer('instance-status')).toMatch(/cannot be edited/);
  });
});
