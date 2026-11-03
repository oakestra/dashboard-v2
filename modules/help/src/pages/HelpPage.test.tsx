import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FAQ_ITEMS } from '../content';
import { HelpPage } from './HelpPage';

const addon = { addonId: 'help', basePath: '/help' };

describe('<HelpPage>', () => {
  it('renders the FAQ and contact links', async () => {
    const user = userEvent.setup();
    renderInHost(<HelpPage />, { addon });

    const first = FAQ_ITEMS[0]!;
    await user.click(screen.getByRole('button', { name: first.question }));
    expect(await screen.findByText(first.answer)).toBeVisible();
    expect(screen.getByRole('link', { name: /Documentation/ })).toHaveAttribute(
      'href',
      'https://www.oakestra.io/docs/',
    );
    expect(screen.getByRole('link', { name: /GitHub/ })).toHaveAttribute('target', '_blank');
  });

  it('opens the FAQ entry named in the URL hash', () => {
    renderInHost(<HelpPage />, { addon, route: '/help#faq-instance-status' });

    const item = FAQ_ITEMS.find((candidate) => candidate.id === 'instance-status')!;
    expect(screen.getByText(item.answer)).toBeVisible();
    expect(document.getElementById('faq-instance-status')).not.toBeNull();
  });

  it('describes what the app really does: Admin-only user management, no service editing', () => {
    const answer = (id: string) => FAQ_ITEMS.find((item) => item.id === id)!.answer;
    expect(answer('roles')).toMatch(/Admins manage everything, including the Users/);
    expect(answer('roles')).not.toMatch(/Organization Admins manage the users/);
    expect(answer('deploy')).toMatch(/Duplicate/);
    expect(answer('instance-status')).toMatch(/cannot be edited/);
  });
});
