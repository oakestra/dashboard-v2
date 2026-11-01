import { useContext, useMemo } from 'react';

import {
  AddonContext,
  HostContext,
  type AddonContextValue,
  type HostContextValue,
} from './context';
import { hasAnyRole } from './permissions';
import type { CurrentUser, Notify, OakestraApi, Role } from './types';

export function useHostContext(): HostContextValue {
  const value = useContext(HostContext);
  if (!value) {
    // Most likely cause in practice: the addon bundled its own copy of the SDK instead of using the
    // shell's shared instance, so it sees a different (empty) context object.
    throw new Error(
      'useHostContext() was called outside the Oakestra dashboard shell. If this runs inside the ' +
        'shell, check that @oakestra/dashboard-sdk is shared as a singleton in the federation config.',
    );
  }
  return value;
}

export function useOakestraApi(): OakestraApi {
  return useHostContext().api;
}

export function useCurrentUser(): CurrentUser | null {
  return useHostContext().user;
}

export function useNotify(): Notify {
  return useHostContext().notify;
}

export interface Permissions {
  readonly roles: readonly Role[];
  hasRole(role: Role): boolean;
  hasAnyRole(roles: readonly Role[]): boolean;
}

export function usePermissions(): Permissions {
  const user = useCurrentUser();
  return useMemo(
    () => ({
      roles: user?.roles ?? [],
      hasRole: (role: Role) => hasAnyRole(user, [role]),
      hasAnyRole: (roles: readonly Role[]) => hasAnyRole(user, roles),
    }),
    [user],
  );
}

export function useAddonContext(): AddonContextValue {
  const value = useContext(AddonContext);
  if (!value) {
    throw new Error('useAddonContext() can only be used inside UI contributed by an addon.');
  }
  return value;
}

export function useAddonBasePath(): string {
  return useAddonContext().basePath;
}

/**
 * Prefixes query keys with the addon id so addons cannot collide with each other or with the
 * shell in the shared QueryClient.
 */
export function addonQueryKey<const T extends readonly unknown[]>(
  addonId: string,
  ...parts: T
): readonly ['addon', string, ...T] {
  return ['addon', addonId, ...parts];
}
