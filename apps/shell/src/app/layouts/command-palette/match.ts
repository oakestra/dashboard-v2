import { searchTokens } from '@oakestra/dashboard-sdk';

export interface Matchable {
  label: string;
  keywords?: readonly string[] | undefined;
  description?: string | undefined;
}

type MatchKind = 'exact' | 'prefix' | 'word' | 'substring';

// Lower is better. Hits at the start of a word beat hits inside one in every field but the
// description, which is prose: "edit" somewhere in a sentence says little about the entry.
const LABEL_RANK: Record<MatchKind, number> = { exact: 0, prefix: 1, word: 2, substring: 6 };
const KEYWORD_RANK: Record<MatchKind, number> = { exact: 3, prefix: 4, word: 5, substring: 7 };
const DESCRIPTION_RANK: Record<MatchKind, number> = { exact: 8, prefix: 8, word: 8, substring: 9 };

function matchKind(text: string, token: string): MatchKind | undefined {
  if (text === token) return 'exact';
  if (text.startsWith(token)) return 'prefix';
  let index = text.indexOf(token);
  if (index < 0) return undefined;
  for (; index >= 0; index = text.indexOf(token, index + 1)) {
    if (!/[\p{L}\p{N}]/u.test(text.charAt(index - 1))) return 'word';
  }
  return 'substring';
}

function rankToken(token: string, item: Matchable): number | undefined {
  const ranks: number[] = [];
  const consider = (text: string, rank: Record<MatchKind, number>) => {
    const kind = matchKind(text.toLowerCase(), token);
    if (kind) ranks.push(rank[kind]);
  };
  consider(item.label, LABEL_RANK);
  for (const keyword of item.keywords ?? []) consider(keyword, KEYWORD_RANK);
  if (item.description !== undefined) consider(item.description, DESCRIPTION_RANK);
  return ranks.length > 0 ? Math.min(...ranks) : undefined;
}

/**
 * How well `item` fits `query`, lower is better, undefined for no match. Every word of the query
 * has to be found somewhere, in any order: "new app" finds "New application".
 */
export function matchRank(query: string, item: Matchable): number | undefined {
  let total = 0;
  for (const token of searchTokens(query)) {
    const rank = rankToken(token, item);
    if (rank === undefined) return undefined;
    total += rank;
  }
  return total;
}

/** The items that fit, best first. Equal ranks keep their order. An empty query keeps them all. */
export function filterAndRank<T extends Matchable>(items: readonly T[], query: string): T[] {
  return items
    .flatMap((item) => {
      const rank = matchRank(query, item);
      return rank === undefined ? [] : [{ item, rank }];
    })
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item);
}
