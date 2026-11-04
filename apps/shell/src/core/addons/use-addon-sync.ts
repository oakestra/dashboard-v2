import { SDK_VERSION } from '@oakestra/dashboard-sdk';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useAuthState } from '../auth/auth-context';
import { useAppConfig } from '../config/config-context';
import { usePreset } from '../config/preset-context';
import { useContributionRegistry } from '../extensions/registry-context';
import { notifyReloadRequired } from '../notify/notify';
import { useAddonRegistry } from './addon-registry-context';
import { getDevOverrides, resolveAddons } from './dev-override';
import { federationRuntime } from './federation-runtime';
import { createAddonLoader } from './loader';
import { resolvePresetAddons } from './preset-addons';
import { fetchUiAddons, uiAddonsQueryKey, type UiAddon } from './ui-addons';

/**
 * Polls /ui-addons and keeps the addon and contribution registries in sync with it, the preset's
 * addons and the dev overrides.
 */
export function useAddonSync(): void {
  const config = useAppConfig();
  const preset = usePreset();
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
  const presetAddons = useMemo(() => resolvePresetAddons(preset), [preset]);
  const discovery = preset.addonDiscovery;
  // Preset addons and dev overrides, which load without the addons manager.
  const localAddons = useMemo(
    () => resolveAddons([], overrides, { preset: presetAddons }),
    [overrides, presetAddons],
  );

  // Addon UIs only render behind requireAuth, so the login and password reset pages neither poll
  // nor run addon code next to the password field.
  const authenticated = useAuthState((state) => state.status === 'authenticated');

  const query = useQuery({
    queryKey: uiAddonsQueryKey,
    // With discovery off this never touches the network. It still runs so that a preset addon
    // whose server was down at load time gets retried on the poll interval.
    queryFn: ({ signal }) =>
      discovery ? fetchUiAddons(config.uiAddonsUrl, signal) : Promise.resolve<UiAddon[]>([]),
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
    // With discovery off a missing addon isn't an outage, and pages word the two differently.
    addons.setState({ availability: discovery ? 'available' : 'disabled' });
    void loader.sync(resolveAddons(data, overrides, { preset: presetAddons }));
  }, [data, dataUpdatedAt, discovery, loader, overrides, presetAddons, addons]);

  useEffect(() => {
    if (!authenticated) return;
    if (isError) addons.setState({ availability: 'unavailable' });
    // Preset addons and overrides do not need the addons manager, so they load as soon as there is
    // a session, also while /ui-addons is pending or down (overrides without a manager are the
    // usual local dev setup). Once a list was received, the effect above owns the sync and an
    // outage keeps the last known state (see AddonsAvailability). Every failed poll syncs again,
    // which retries failed loads like a successful poll does. With discovery off the query
    // resolves right away, so the effect above handles it.
    if (!discovery || data || localAddons.length === 0) return;
    void loader.sync(localAddons);
  }, [authenticated, discovery, isError, errorUpdatedAt, data, loader, localAddons, addons]);
}
