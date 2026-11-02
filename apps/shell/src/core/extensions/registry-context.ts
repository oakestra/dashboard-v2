import { createContext, useContext } from 'react';

import type { ContributionRegistry } from './registry';

export const ContributionRegistryContext = createContext<ContributionRegistry | null>(null);

export function useContributionRegistry(): ContributionRegistry {
  const registry = useContext(ContributionRegistryContext);
  if (!registry) throw new Error('ContributionRegistryContext is missing');
  return registry;
}
