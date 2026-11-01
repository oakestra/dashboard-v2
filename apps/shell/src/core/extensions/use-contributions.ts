import { useCurrentUser, type ExtensionPointId } from '@oakestra/dashboard-sdk';
import { useMemo } from 'react';
import { useStore } from 'zustand';

import { selectContributions, type ResolvedContribution } from './registry';
import { useContributionRegistry } from './registry-context';

export function useContributions<P extends ExtensionPointId>(
  point: P,
  context?: object,
): ResolvedContribution<P>[] {
  const registry = useContributionRegistry();
  // Subscribing to the whole `sources` map keeps the selector referentially stable; the derived
  // list is memoized below instead of being rebuilt on every store read.
  const sources = useStore(registry, (state) => state.sources);
  const user = useCurrentUser();
  return useMemo(
    () => selectContributions(sources, point, user, context),
    [sources, point, user, context],
  );
}
