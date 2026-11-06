import {
  buildAddonPath,
  type CommandContext,
  type CurrentUser,
  type HostContextValue,
} from '@oakestra/dashboard-sdk';
import type { QueryClient } from '@tanstack/react-query';

import type { ContributionSource } from '../../../core/extensions/registry';

const ORIGIN = 'http://dashboard.invalid';

/**
 * Whether `path` is a page of this dashboard. Parsed instead of looking for a leading slash,
 * because `//host`, `/\host` and paths with a tab in them are other origins to the URL parser.
 */
export function isAppPath(path: string): boolean {
  if (!path.startsWith('/')) return false;
  try {
    return new URL(path, ORIGIN).origin === ORIGIN;
  } catch {
    return false;
  }
}

export interface CommandHost {
  host: Pick<HostContextValue, 'api' | 'notify' | 'isFeatureEnabled'>;
  user: CurrentUser;
  queryClient: QueryClient;
  navigate: (path: string) => void;
}

/** The context of one contribution. The palette itself sits outside every addon's tree. */
export function commandContextFor(
  { host, user, queryClient, navigate }: CommandHost,
  source: ContributionSource,
): CommandContext {
  const context: CommandContext = {
    api: host.api,
    notify: host.notify,
    isFeatureEnabled: host.isFeatureEnabled,
    user,
    queryClient,
    navigate: (path) => {
      if (!isAppPath(path)) throw new Error(`navigate() needs an absolute path, got "${path}"`);
      navigate(path);
    },
  };
  if (source.kind !== 'addon') return context;
  const { addonId, basePath } = source.addon;
  return {
    ...context,
    addon: {
      addonId,
      basePath,
      path: (...segments) => buildAddonPath(basePath, ...segments),
    },
  };
}
