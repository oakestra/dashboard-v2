import type { EnsureQueryDataOptions, QueryKey } from '@tanstack/react-query';

import type { CommandContext } from './extension-points';

// The palette asks on every pause in typing, and its answer should not wait for the network. Older
// entries still answer at once and get refreshed behind the scenes.
const FRESH_ENOUGH_MS = 30_000;

/** How a command source reads a query: from the cache when it can, and never with a toast. */
export function readCached<T, K extends QueryKey>(
  { queryClient }: Pick<CommandContext, 'queryClient'>,
  options: EnsureQueryDataOptions<T, Error, T, K>,
): Promise<T> {
  return queryClient.ensureQueryData({
    ...options,
    revalidateIfStale: true,
    staleTime: FRESH_ENOUGH_MS,
    // A failed refresh in the background is no reason for a toast.
    meta: { silent: true },
  });
}

/** The words of a palette query, lowercased. */
export function searchTokens(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Whether every token occurs in one of the fields, in any order. */
export function matchesTokens(
  tokens: readonly string[],
  ...fields: readonly (string | undefined)[]
): boolean {
  const text = fields.join(' ').toLowerCase();
  return tokens.every((token) => text.includes(token));
}
