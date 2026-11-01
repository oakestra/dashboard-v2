import { HostContext } from '@oakestra/dashboard-sdk';
import { Toaster, TooltipProvider } from '@oakestra/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { useStore } from 'zustand';

import { AddonsAdminApiContext } from '../core/addons/addons-admin';
import { AddonRegistryContext } from '../core/addons/addon-registry-context';
import { AuthSessionContext } from '../core/auth/auth-context';
import type { AppConfig } from '../core/config/config';
import { ConfigContext } from '../core/config/config-context';
import { ContributionRegistryContext } from '../core/extensions/registry-context';
import { createHostContextValue } from '../core/host/host-context';
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
  const host = useMemo(() => createHostContextValue(user, services.api), [user, services.api]);

  return (
    <ConfigContext.Provider value={config}>
      <ThemeContext.Provider value={services.theme}>
        <AuthSessionContext.Provider value={services.auth}>
          <QueryClientProvider client={services.queryClient}>
            <ContributionRegistryContext.Provider value={services.contributions}>
              <AddonRegistryContext.Provider value={services.addons}>
                <AddonsAdminApiContext.Provider value={services.addonsAdmin}>
                  <HostContext.Provider value={host}>
                    <TooltipProvider delayDuration={0}>
                      {children}
                      <Toaster position="bottom-right" theme={resolvedTheme} />
                    </TooltipProvider>
                  </HostContext.Provider>
                </AddonsAdminApiContext.Provider>
              </AddonRegistryContext.Provider>
            </ContributionRegistryContext.Provider>
          </QueryClientProvider>
        </AuthSessionContext.Provider>
      </ThemeContext.Provider>
    </ConfigContext.Provider>
  );
}
