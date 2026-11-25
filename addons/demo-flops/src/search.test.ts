import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { searchProjects } from './search';

function context() {
  return {
    queryClient: new QueryClient(),
    addon: {
      addonId: 'flops',
      basePath: '/addons/flops',
      path: (...segments: string[]) => `/addons/flops/${segments.join('/')}`,
    },
  } as never;
}

describe('searchProjects', () => {
  it('matches every word against the project name', async () => {
    const results = await searchProjects('keyboard word', context(), new AbortController().signal);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'keyboard-nwp',
      path: '/addons/flops/projects/keyboard-nwp',
    });
  });

  it('returns nothing for an unknown query', async () => {
    expect(await searchProjects('zzz', context(), new AbortController().signal)).toEqual([]);
  });
});
