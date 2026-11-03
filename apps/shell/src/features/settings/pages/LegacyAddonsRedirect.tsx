import { Navigate } from 'react-router';

import { useModuleEnabled } from '../../../core/modules';

export function LegacyAddonsRedirect() {
  const addonManagerEnabled = useModuleEnabled('addon-manager');
  return <Navigate to={addonManagerEnabled ? '/addon-manager/installed' : '/settings'} replace />;
}
