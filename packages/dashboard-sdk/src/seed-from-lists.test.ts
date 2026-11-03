import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { seedFromLists } from './seed-from-lists';

interface Item {
  id: string;
  name: string;
}

const byId = (id: string) => (item: Item) => item.id === id;

describe('seedFromLists', () => {
  it('returns the item from the freshest list that holds it', () => {
    const client = new QueryClient();
    client.setQueryData(['items', 'list', 'a'], [{ id: '1', name: 'old' }], { updatedAt: 100 });
    client.setQueryData(['items', 'list', 'b'], [{ id: '1', name: 'new' }], { updatedAt: 200 });
    client.setQueryData(['items', 'list', 'c'], [{ id: '2', name: 'other' }], { updatedAt: 300 });

    expect(seedFromLists(client, ['items', 'list'], byId('1'))).toEqual({
      initialData: { id: '1', name: 'new' },
      initialDataUpdatedAt: 200,
    });
  });

  it('returns undefined when no cached list has the item', () => {
    const client = new QueryClient();
    client.setQueryData(['items', 'list', 'a'], [{ id: '1', name: 'one' }]);

    expect(seedFromLists(client, ['items', 'list'], byId('2'))).toBeUndefined();
    expect(seedFromLists(client, ['other'], byId('1'))).toBeUndefined();
  });

  it('lets ensureQueryData resolve from the list without fetching', async () => {
    const client = new QueryClient();
    client.setQueryData(['items', 'list', 'a'], [{ id: '1', name: 'one' }]);
    let fetches = 0;

    const item = await client.ensureQueryData({
      queryKey: ['items', 'detail', '1'],
      queryFn: () => {
        fetches += 1;
        return { id: '1', name: 'fetched' };
      },
      ...seedFromLists(client, ['items', 'list'], byId('1')),
    });

    expect(item).toEqual({ id: '1', name: 'one' });
    expect(fetches).toBe(0);
  });
});
