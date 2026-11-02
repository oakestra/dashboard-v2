export { SDK_VERSION } from './version';
export type { CurrentUser, KnownRole, Notify, NotifyOptions, OakestraApi, Role } from './types';
export {
  EXTENSION_POINT_IDS,
  type ApplicationContext,
  type ClusterContext,
  type ContributionBase,
  type Contributions,
  type EmptyContext,
  type ExtensionPointId,
  type ExtensionPoints,
  type IconProps,
  type NavGroup,
  type NavItem,
  type NavSubItem,
  type RenderablePointId,
  type ServiceContext,
  type SlotContext,
  type Tab,
  type Widget,
} from './extension-points';
export { defineAddon, type AddonDefinition, type AddonRoute } from './define-addon';
export {
  AddonContext,
  HostContext,
  type AddonContextValue,
  type HostContextValue,
} from './context';
export { hasAnyRole } from './permissions';
// A runtime re-export, unlike the type-only uses of @oakestra/api elsewhere in the SDK. Addons
// still never bundle it: they get the SDK, and with it this function, from the shell's singleton.
export { describeError } from '@oakestra/api';
export {
  addonQueryKey,
  useAddonBasePath,
  useAddonContext,
  useAddonPath,
  useCurrentUser,
  useHostContext,
  useNotify,
  useOakestraApi,
  usePermissions,
  type Permissions,
} from './hooks';
