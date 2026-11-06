import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isChunkLoadError } from './chunk-load-error';
import { ContributionBoundary } from './ContributionBoundary';
import type { ContributionSource } from './registry';

const source: ContributionSource = { kind: 'core', id: 'demo', label: 'module "demo"' };

describe('<ContributionBoundary>', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the error message behind a disclosure', () => {
    function Broken(): never {
      throw new Error('kaputt');
    }
    render(
      <ContributionBoundary source={source} label="Widget">
        <Broken />
      </ContributionBoundary>,
    );

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Widget from module "demo" failed to render.');
    expect(screen.getByText('Error details').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('kaputt')).toBeInTheDocument();
  });

  it('renders the contribution again on Reload and recovers once it stops throwing', async () => {
    const user = userEvent.setup();
    let broken = true;
    function Flaky() {
      if (broken) throw new Error('kaputt');
      return <p>recovered</p>;
    }
    render(
      <ContributionBoundary source={source} label="Widget">
        <Flaky />
      </ContributionBoundary>,
    );

    await user.click(screen.getByRole('button', { name: 'Reload Widget' }));
    expect(screen.getByTestId('contribution-error')).toBeInTheDocument();

    broken = false;
    await user.click(screen.getByRole('button', { name: 'Reload Widget' }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
    expect(screen.queryByTestId('contribution-error')).not.toBeInTheDocument();
  });

  it('clears the error when the reset key changes', () => {
    let broken = true;
    function Flaky() {
      if (broken) throw new Error('kaputt');
      return <p>recovered</p>;
    }
    const boundary = (resetKey: string) => (
      <ContributionBoundary source={source} label="Page" resetKey={resetKey}>
        <Flaky />
      </ContributionBoundary>
    );
    const { rerender } = render(boundary('/a'));
    expect(screen.getByTestId('contribution-error')).toBeInTheDocument();

    rerender(boundary('/a'));
    expect(screen.getByTestId('contribution-error')).toBeInTheDocument();

    broken = false;
    rerender(boundary('/b'));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('offers a full page reload when the code itself could not be fetched', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    const user = userEvent.setup();
    const Missing = lazy(() =>
      Promise.reject<{ default: () => null }>(
        new TypeError('Failed to fetch dynamically imported module: http://x/assets/page.js'),
      ),
    );
    await act(async () => {
      render(
        <ContributionBoundary source={source} label="Page">
          <Missing />
        </ContributionBoundary>,
      );
      await Promise.resolve();
    });

    expect(await screen.findByTestId('contribution-error')).toHaveTextContent(
      'Page from module "demo" failed to render.',
    );
    expect(screen.queryByRole('button', { name: 'Reload Page' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: http://x/a.js',
    'error loading dynamically imported module: http://x/a.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/a.css',
    'Loading chunk 12 failed.',
    'Loading CSS chunk 12 failed.',
    'Failed to get manifest. #RUNTIME-003',
    'Failed to load script resources. #RUNTIME-008',
  ])('recognizes "%s"', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('recognizes the error name and a wrapped cause', () => {
    const chunkError = Object.assign(new Error('nope'), { name: 'ChunkLoadError' });
    expect(isChunkLoadError(chunkError)).toBe(true);
    expect(isChunkLoadError(new Error('load failed', { cause: chunkError }))).toBe(true);
  });

  it('leaves ordinary errors alone', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Loading chunk 1 failed')).toBe(false);
  });
});
