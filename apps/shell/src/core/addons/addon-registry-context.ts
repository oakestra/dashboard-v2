import { createContext, useContext } from 'react';

import type { AddonRegistry } from './addon-registry';

export const AddonRegistryContext = createContext<AddonRegistry | null>(null);

export function useAddonRegistry(): AddonRegistry {
  const registry = useContext(AddonRegistryContext);
  if (!registry) throw new Error('AddonRegistryContext is missing');
  return registry;
}
