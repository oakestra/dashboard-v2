import { SDK_VERSION } from '@oakestra/dashboard-sdk';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';

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
import { fetchUiAddons, uiAddonsQueryKey } from './ui-addons';

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
    queryFn: ({ signal }) => fetchUiAddons(config.uiAddonsUrl, signal),
    enabled: authenticated && discovery,
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
    void loader.sync(resolveAddons(data, overrides, { preset: presetAddons }));
  }, [data, dataUpdatedAt, loader, overrides, presetAddons, addons]);

  useEffect(() => {
    if (!authenticated) return;
    // Without discovery there is no addons manager to wait for, and none to blame for a missing
    // addon, which is why pages tell it apart from an outage.
    if (!discovery) addons.setState({ availability: 'disabled' });
    else if (isError) addons.setState({ availability: 'unavailable' });
    // Preset addons and overrides do not need the addons manager, so they load as soon as there is
    // a session, also while /ui-addons is pending, down or switched off (overrides without a
    // manager are the usual local dev setup). Once a list was received, the effect above owns the
    // sync and an outage keeps the last known state (see AddonsAvailability). Every failed poll
    // syncs again, which retries failed loads like a successful poll does.
    if (data || localAddons.length === 0) return;
    void loader.sync(localAddons);
  }, [authenticated, discovery, isError, errorUpdatedAt, data, loader, localAddons, addons]);

  // Without discovery nothing polls, so a preset addon whose server was down at load time (or a
  // dev override) would stay failed until a page reload. Retry on the poll interval, but only while
  // something is failed, so a healthy deployment makes no requests at all. A failed linked addon
  // does not count: its definition is compiled in and invalid, so no sync could ever fix it.
  const hasFailedLocal = useStore(addons, (state) =>
    Object.values(state.entries).some(
      (entry) => entry.state === 'failed' && (entry.origin === 'preset' || entry.origin === 'dev'),
    ),
  );
  useEffect(() => {
    if (!authenticated || discovery || !hasFailedLocal) return;
    const timer = setInterval(() => {
      void loader.sync(localAddons);
    }, config.addonsPollIntervalMs);
    return () => clearInterval(timer);
  }, [authenticated, discovery, hasFailedLocal, loader, localAddons, config.addonsPollIntervalMs]);
}
