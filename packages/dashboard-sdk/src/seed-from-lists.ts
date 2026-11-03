import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Finds an item in the cached lists under `listKey` and returns it as `initialData` for its
 * detail query, dated like the freshest list that holds it. Spread into the detail's query options,
 * a page reached from a list renders at once instead of waiting for a round trip; the query still
 * refetches once that data is stale.
 * Only valid where list and detail endpoints return the same parsed model.
 */
export function seedFromLists<T>(
  queryClient: QueryClient,
  listKey: QueryKey,
  match: (item: T) => boolean,
): { initialData: T; initialDataUpdatedAt: number } | undefined {
  let seed: { initialData: T; initialDataUpdatedAt: number } | undefined;
  for (const query of queryClient.getQueryCache().findAll({ queryKey: listKey })) {
    const { data, dataUpdatedAt } = query.state;
    if (!Array.isArray(data) || (seed && seed.initialDataUpdatedAt >= dataUpdatedAt)) continue;
    const item = (data as T[]).find(match);
    if (item !== undefined) seed = { initialData: item, initialDataUpdatedAt: dataUpdatedAt };
  }
  return seed;
}
