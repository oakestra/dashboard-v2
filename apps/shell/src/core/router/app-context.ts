import type { OakestraApi } from '@oakestra/dashboard-sdk';
import type { QueryClient } from '@tanstack/react-query';
import { createContext, RouterContextProvider } from 'react-router';

import type { AddonsAdminApi } from '../addons/addons-admin';
import type { AuthSession } from '../auth/session';

/** What route loaders get from the shell, since they run outside React and its contexts. */
export interface AppRouterContext {
  auth: AuthSession;
  api: OakestraApi;
  /** Addon management APIs, for loaders of the addons admin pages. */
  addonsAdmin: AddonsAdminApi;
  queryClient: QueryClient;
}

export const appRouterContext = createContext<AppRouterContext>();

export function createRouterContext(value: AppRouterContext): () => RouterContextProvider {
  return () => new RouterContextProvider(new Map([[appRouterContext, value]]));
}
