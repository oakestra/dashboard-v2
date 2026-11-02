import { SDK_VERSION } from '@oakestra/dashboard-sdk';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useAuthState } from '../auth/auth-context';
import { useAppConfig } from '../config/config-context';
import { useContributionRegistry } from '../extensions/registry-context';
import { notifyReloadRequired } from '../notify/notify';
import { useAddonRegistry } from './addon-registry-context';
import { getDevOverrides, resolveAddons } from './dev-override';
import { federationRuntime } from './federation-runtime';
import { createAddonLoader } from './loader';
import { fetchUiAddons, uiAddonsQueryKey } from './ui-addons';

/** Polls /ui-addons and keeps the addon and contribution registries in sync with it. */
export function useAddonSync(): void {
  const config = useAppConfig();
  const addons = useAddonRegistry();
  const contributions = useContributionRegistry();

  const loader = useMemo(
    () =>
      createAddonLoader({
        sdkVersion: SDK_VERSION,
        runtime: federationRuntime,
        addons,
        contributions,
        onUpgradeAvailable: (current, next) =>
          notifyReloadRequired(
            `addon-upgrade-${next.name}`,
            `A new version of ${next.name} is available`,
            `Reload the page to switch from ${current.version} to ${next.version}.`,
          ),
      }),
    [addons, contributions],
  );

  // Read once per page load: overrides only change through the URL, which reloads the page anyway.
  const overrides = useMemo(() => getDevOverrides(), []);

  // Addon UIs only render behind requireAuth, so the login and password reset pages neither poll
  // nor run addon code next to the password field.
  const authenticated = useAuthState((state) => state.status === 'authenticated');

  const query = useQuery({
    queryKey: uiAddonsQueryKey,
    queryFn: ({ signal }) => fetchUiAddons(config.uiAddonsUrl, signal),
    enabled: authenticated,
    refetchInterval: config.addonsPollIntervalMs,
    retry: false,
    // Unavailability is an expected state (addons engine not installed), not an error to toast.
    meta: { silent: true },
  });

  // Depends on dataUpdatedAt rather than data alone: structural sharing keeps `data` identical
  // when the list did not change, but failed addons still need a retry on every poll.
  const { data, dataUpdatedAt, isError, errorUpdatedAt } = query;

  useEffect(() => {
    if (!data) return;
    addons.setState({ availability: 'available' });
    void loader.sync(resolveAddons(data, overrides));
  }, [data, dataUpdatedAt, loader, overrides, addons]);

  useEffect(() => {
    if (!isError) return;
    addons.setState({ availability: 'unavailable' });
    // Overrides keep working without an addons manager, which is the usual local dev setup. Once
    // a list was received, an outage keeps the last known state instead (see AddonsAvailability).
    if (!data && Object.keys(overrides).length > 0) {
      void loader.sync(resolveAddons([], overrides));
    }
  }, [isError, errorUpdatedAt, data, loader, overrides, addons]);
}
