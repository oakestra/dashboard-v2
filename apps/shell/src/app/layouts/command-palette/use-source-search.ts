import { keepPreviousData, useQueries } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  sourceKey,
  type ContributionSource,
  type ResolvedContribution,
} from '../../../core/extensions/registry';
import { commandContextFor, type CommandHost } from './context';
import { resultEntries, type PaletteEntry } from './entries';
import { searchSource } from './results';

const DEBOUNCE_MS = 150;
const DEFAULT_MIN_QUERY_LENGTH = 2;

// Long enough that deleting a character shows the earlier results at once, short enough that the
// cache does not fill up with one entry per source and prefix.
const SEARCH_GC_MS = 30_000;

export function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

export interface SourceSearch {
  key: string;
  label: string;
  source: ContributionSource;
  entries: readonly PaletteEntry[];
  /** `entries` belong to an earlier query. They stay on screen but must not be selectable. */
  stale: boolean;
  searching: boolean;
  failed: boolean;
}

/**
 * Runs every source for `settled` (the debounced query) while `typed` is what the input says now.
 * One `useQueries` over the list rather than a hook per source: addons load at any time, and the
 * number of hooks must not change.
 */
export function useSourceSearch(
  sources: readonly ResolvedContribution<'command.sources'>[],
  typed: string,
  settled: string,
  host: CommandHost,
): SourceSearch[] {
  const keyOf = ({ item, source }: ResolvedContribution<'command.sources'>) =>
    `${sourceKey(source)}:${item.id}`;
  const isSearchable = ({ item }: ResolvedContribution<'command.sources'>, query: string) =>
    query.length >= (item.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH);

  const queries = useQueries({
    queries: sources.map((contribution) => ({
      queryKey: ['command-search', keyOf(contribution), settled],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        searchSource(
          contribution.item,
          settled,
          commandContextFor(host, contribution.source),
          signal,
        ),
      enabled: isSearchable(contribution, settled),
      retry: false,
      gcTime: SEARCH_GC_MS,
      // Results are a snapshot for this one query, not something to keep fresh behind the palette.
      refetchOnWindowFocus: false,
      // Rows stay in place between keystrokes instead of the list collapsing and growing again.
      placeholderData: keepPreviousData,
      // Failures are shown in the palette. Without this, a failed refetch would also toast.
      meta: { silent: true },
    })),
  });

  return sources.map((contribution, index) => {
    const { item, source } = contribution;
    // Same length as `sources`, by construction.
    const query = queries[index] as (typeof queries)[number];
    const key = keyOf(contribution);
    const searchable = isSearchable(contribution, typed);
    const outdated = typed !== settled || query.isPlaceholderData;
    const failed = searchable && !outdated && query.isError;
    return {
      key,
      label: item.label,
      source,
      entries: searchable && !failed ? resultEntries(query.data ?? [], source, item.id) : [],
      stale: outdated,
      searching: searchable && (outdated || query.isFetching),
      failed,
    };
  });
}
