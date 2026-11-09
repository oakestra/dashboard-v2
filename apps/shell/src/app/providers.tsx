import { HostContext, SlotRendererContext } from '@oakestra/dashboard-sdk';
import { Toaster, TooltipProvider } from '@oakestra/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { useStore } from 'zustand';

import { AddonsAdminApiContext } from '../core/addons/addons-admin';
import { AddonRegistryContext } from '../core/addons/addon-registry-context';
import { AuthSessionContext } from '../core/auth/auth-context';
import type { AppConfig } from '../core/config/config';
import { ConfigContext } from '../core/config/config-context';
import { PresetContext } from '../core/config/preset-context';
import { Slot } from '../core/extensions/Slot';
import { ContributionRegistryContext } from '../core/extensions/registry-context';
import { createHostContextValue, hostLinksFromConfig } from '../core/host/host-context';
import { isModuleEnabled } from '../core/modules';
import { ThemeContext } from '../core/theme/theme-context';
import type { AppServices } from './services';

interface ProvidersProps {
  config: AppConfig;
  services: AppServices;
  children: ReactNode;
}

export function Providers({ config, services, children }: ProvidersProps) {
  const user = useStore(services.auth.store, (state) => state.user);
  const resolvedTheme = useStore(services.theme, (state) => state.resolved);
  const links = useMemo(() => hostLinksFromConfig(config), [config]);
  const host = useMemo(
    () =>
      createHostContextValue({
        user,
        api: services.api,
        addonBackendFetch: services.addonBackendFetch,
        isFeatureEnabled: (id) => isModuleEnabled(services.preset, id),
        links,
      }),
    [user, services.api, services.addonBackendFetch, services.preset, links],
  );

  return (
    <ConfigContext.Provider value={config}>
      <PresetContext.Provider value={services.preset}>
        <ThemeContext.Provider value={services.theme}>
          <AuthSessionContext.Provider value={services.auth}>
            <QueryClientProvider client={services.queryClient}>
              <ContributionRegistryContext.Provider value={services.contributions}>
                <AddonRegistryContext.Provider value={services.addons}>
                  <AddonsAdminApiContext.Provider value={services.addonsAdmin}>
                    <HostContext.Provider value={host}>
                      <SlotRendererContext.Provider value={Slot}>
                        <TooltipProvider delayDuration={0}>
                          {children}
                          <Toaster position="bottom-right" theme={resolvedTheme} />
                        </TooltipProvider>
                      </SlotRendererContext.Provider>
                    </HostContext.Provider>
                  </AddonsAdminApiContext.Provider>
                </AddonRegistryContext.Provider>
              </ContributionRegistryContext.Provider>
            </QueryClientProvider>
          </AuthSessionContext.Provider>
        </ThemeContext.Provider>
      </PresetContext.Provider>
    </ConfigContext.Provider>
  );
}
