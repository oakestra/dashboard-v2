import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Finds an item in the cached lists under `listKey` and returns it as `initialData` for its
 * detail query, dated like the freshest list that holds it. Spread into the detail's query options,
 * a page reached from a list renders at once instead of waiting for a round trip; the query still
 * refetches once that data is stale.
 * Only valid where list and detail endpoints return the same parsed model.
 *
 * Both are functions so the search only runs while the query has no data: it walks the whole query
 * cache, and query options get rebuilt on every render.
 */
export function seedFromLists<T>(
  queryClient: QueryClient,
  listKey: QueryKey,
  match: (item: T) => boolean,
): { initialData: () => T | undefined; initialDataUpdatedAt: () => number | undefined } {
  return {
    initialData: () => findSeed(queryClient, listKey, match)?.item,
    initialDataUpdatedAt: () => findSeed(queryClient, listKey, match)?.updatedAt,
  };
}

function findSeed<T>(
  queryClient: QueryClient,
  listKey: QueryKey,
  match: (item: T) => boolean,
): { item: T; updatedAt: number } | undefined {
  let seed: { item: T; updatedAt: number } | undefined;
  for (const query of queryClient.getQueryCache().findAll({ queryKey: listKey })) {
    const { data, dataUpdatedAt } = query.state;
    if (!Array.isArray(data) || (seed && seed.updatedAt >= dataUpdatedAt)) continue;
    const item = (data as T[]).find(match);
    if (item !== undefined) seed = { item, updatedAt: dataUpdatedAt };
  }
  return seed;
}
