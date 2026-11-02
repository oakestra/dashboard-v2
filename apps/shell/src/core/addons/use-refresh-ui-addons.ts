import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { refreshUiAddons } from './addons-admin';

/** Hook form of `refreshUiAddons` for components and mutation hooks. */
export function useRefreshUiAddons(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(() => refreshUiAddons(queryClient), [queryClient]);
}
