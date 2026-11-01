import type { CoreModule } from '../core/modules';
import { addonManagerModule } from '../features/addon-manager';
import { applicationsModule } from '../features/applications';
import { authModule } from '../features/auth';
import { helpModule } from '../features/help';
import { infrastructureModule } from '../features/infrastructure';
import { organizationsModule } from '../features/organizations';
import { overviewModule } from '../features/overview';
import { profileModule } from '../features/profile';
import { settingsModule } from '../features/settings';
import { usersModule } from '../features/users';

/**
 * Every built-in feature. Order matters only for nav items without an explicit `order`. The
 * services and SLA features have no module: their pages are routes nested under
 * `applications/:appId` by the applications module.
 */
export const coreModules: readonly CoreModule[] = [
  authModule,
  overviewModule,
  applicationsModule,
  infrastructureModule,
  usersModule,
  organizationsModule,
  addonManagerModule,
  profileModule,
  settingsModule,
  helpModule,
];
