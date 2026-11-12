import type { AddonUi } from '@oakestra/api';
import { SDK_VERSION } from '@oakestra/dashboard-sdk';

import { checkSdkCompatibility } from '../../core/addons/sdk-compat';

/**
 * Why this dashboard could not load the addon's UI, or null when it can (or there is no UI). The
 * backend only stores the range, so blocking an install of an incompatible UI is up to the
 * dashboard; the loader checks the same thing again for UIs that are already installed.
 */
export function uiIncompatibility(ui: AddonUi | undefined): string | null {
  if (!ui) return null;
  const result = checkSdkCompatibility(SDK_VERSION, ui.sdk);
  return result.compatible ? null : result.reason;
}
