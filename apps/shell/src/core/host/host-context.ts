import type {
  CurrentUser,
  HostContextValue,
  HostLinks,
  OakestraApi,
} from '@oakestra/dashboard-sdk';
import { SDK_VERSION } from '@oakestra/dashboard-sdk';

import type { AppConfig } from '../config/config';
import { notify } from '../notify/notify';

/** The parts of the runtime config packages may link to, for useHostLinks(). */
export function hostLinksFromConfig(config: Pick<AppConfig, 'grafanaUrl'>): HostLinks {
  return config.grafanaUrl ? { grafanaUrl: config.grafanaUrl } : {};
}

export function createHostContextValue(
  user: CurrentUser | null,
  api: OakestraApi,
  isFeatureEnabled: (id: string) => boolean,
  links: HostLinks,
): HostContextValue {
  return { sdkVersion: SDK_VERSION, user, api, notify, isFeatureEnabled, links };
}
