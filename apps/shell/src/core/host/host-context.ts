import type { CurrentUser, HostContextValue, OakestraApi } from '@oakestra/dashboard-sdk';
import { SDK_VERSION } from '@oakestra/dashboard-sdk';

import { notify } from '../notify/notify';

export function createHostContextValue(
  user: CurrentUser | null,
  api: OakestraApi,
): HostContextValue {
  return { sdkVersion: SDK_VERSION, user, api, notify };
}
