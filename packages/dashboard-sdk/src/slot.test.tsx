import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Slot } from './slot';
import { renderInHost } from './testing';

function Tab({ applicationId }: { applicationId: string }) {
  return <p>tab for {applicationId}</p>;
}

describe('Slot', () => {
  afterEach(cleanup);

  it('renders empty outside a host', () => {
    render(<Slot point="home.widgets" empty={<p>nothing</p>} />);
    expect(screen.getByText('nothing')).toBeTruthy();
  });

  it('renders empty when nothing is contributed', () => {
    renderInHost(<Slot point="home.widgets" empty={<p>nothing</p>} />);
    expect(screen.getByText('nothing')).toBeTruthy();
  });

  it('renders contributions in order, passes context and filters by role', async () => {
    renderInHost(
      <Slot
        point="application.detail.tabs"
        context={{ applicationId: 'a1' }}
        render={(item, content, source) => (
          <section aria-label={`${item.label} by ${source.kind}`}>{content}</section>
        )}
      />,
      {
        user: { username: 'alice', roles: ['Application_Provider'] },
        contributions: {
          'application.detail.tabs': [
            { id: 'late', label: 'Late', order: 2, component: Tab },
            { id: 'early', label: 'Early', order: 1, component: Tab },
            { id: 'admin', label: 'Admin', roles: ['Admin'], component: Tab },
            { id: 'hidden', label: 'Hidden', visible: () => false, component: Tab },
          ],
        },
      },
    );
    const sections = await screen.findAllByRole('region');
    expect(sections.map((s) => s.getAttribute('aria-label'))).toEqual([
      'Early by addon',
      'Late by addon',
    ]);
    expect(screen.getAllByText('tab for a1')).toHaveLength(2);
  });

  it('wraps the contributions once and leaves the empty state unwrapped', () => {
    const slot = (
      <Slot
        point="application.detail.tabs"
        context={{ applicationId: 'a1' }}
        empty={<p>no tabs</p>}
        wrap={(children) => <div data-testid="wrapper">{children}</div>}
      />
    );
    const { unmount } = renderInHost(slot);
    expect(screen.getByText('no tabs')).toBeTruthy();
    expect(screen.queryByTestId('wrapper')).toBeNull();
    unmount();

    renderInHost(slot, {
      contributions: {
        'application.detail.tabs': [
          { id: 'one', label: 'One', component: Tab },
          { id: 'two', label: 'Two', component: Tab },
        ],
      },
    });
    expect(screen.getAllByTestId('wrapper')).toHaveLength(1);
    expect(screen.getByTestId('wrapper').textContent).toBe('tab for a1tab for a1');
  });
});
