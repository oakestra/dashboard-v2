import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OakestraLogo } from './OakestraLogo';

function sources() {
  return screen
    .getAllByRole('img', { name: 'Oakestra', hidden: true })
    .map((img) => img.getAttribute('src'));
}

describe('<OakestraLogo>', () => {
  it('renders the wordmark in both theme variants by default', () => {
    render(<OakestraLogo />);
    expect(sources()).toEqual([
      '/brand/oakestra-wordmark.png',
      '/brand/oakestra-wordmark-dark.png',
    ]);
  });

  it('renders the round mark when asked for it', () => {
    render(<OakestraLogo variant="mark" className="size-6" />);
    expect(sources()).toEqual(['/brand/oakestra-mark.png', '/brand/oakestra-mark-dark.png']);
    // The size class has to win over the default auto width, or the mark would be stretched.
    for (const img of screen.getAllByRole('img', { hidden: true })) {
      expect(img).toHaveClass('size-6');
      expect(img).not.toHaveClass('w-auto');
    }
  });

  it('renders only the light-on-dark artwork on a dark teal surface, whatever the theme', () => {
    render(<OakestraLogo surface="inverse" />);
    expect(sources()).toEqual(['/brand/oakestra-wordmark-dark.png']);
  });
});
