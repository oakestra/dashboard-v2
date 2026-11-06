import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useSearchParam } from './use-search-param';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/?other=1']}>{children}</MemoryRouter>
);

describe('useSearchParam', () => {
  it('keeps its setter across URL changes, and the setter sees the current URL', () => {
    const { result } = renderHook(
      () => ({ q: useSearchParam('q'), other: useSearchParam('other') }),
      { wrapper },
    );
    const setter = result.current.q[1];

    act(() => setter('shop'));
    expect(result.current.q[0]).toBe('shop');
    expect(result.current.q[1]).toBe(setter);

    act(() => result.current.other[1]('2'));
    act(() => setter('web'));
    expect(result.current.q[0]).toBe('web');
    expect(result.current.other[0]).toBe('2');
  });
});
