import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SectionCard } from './section-card';

describe('SectionCard', () => {
  it('is a region named by its heading, with the action in the header', () => {
    render(
      <SectionCard title="Recent applications" action={<button type="button">View all</button>}>
        content
      </SectionCard>,
    );
    const region = screen.getByRole('region', { name: 'Recent applications' });
    expect(screen.getByRole('heading', { level: 2, name: 'Recent applications' })).toBeVisible();
    expect(region).toContainElement(screen.getByRole('button', { name: 'View all' }));
    expect(region).toHaveTextContent('content');
  });

  it('takes another heading level', () => {
    render(
      <SectionCard title="Ports" headingLevel={3}>
        x
      </SectionCard>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Ports' })).toBeInTheDocument();
  });
});
