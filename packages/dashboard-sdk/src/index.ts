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
  type WidgetSize,
} from './extension-points';
export {
  defineAddon,
  type AddonCrumbProps,
  type AddonDefinition,
  type AddonRoute,
} from './define-addon';
export {
  AddonContext,
  HostContext,
  SlotRendererContext,
  type AddonContextValue,
  type HostContextValue,
  type HostLinks,
} from './context';
export { Slot, type SlotProps, type SlotSource } from './slot';
export { hasAnyRole, ROLE_OPTIONS, roleLabel, type RoleOption } from './permissions';
// A runtime re-export, unlike the type-only uses of @oakestra/api elsewhere in the SDK. Addons
// still never bundle it: they get the SDK, and with it this function, from the shell's singleton.
export { describeError } from '@oakestra/api';
export {
  addonQueryKey,
  useAddonBasePath,
  useAddonContext,
  useAddonPath,
  useCurrentUser,
  useFeatureEnabled,
  useHostContext,
  useHostLinks,
  useNotify,
  useOakestraApi,
  usePermissions,
  type Permissions,
} from './hooks';
export {
  applicationsQuery,
  CLUSTER_REFETCH_MS,
  clustersQuery,
  organizationsQuery,
  platformQueryKeys,
  profileQuery,
  servicesByApplicationQuery,
  usersQuery,
} from './platform-queries';
export { seedFromLists } from './seed-from-lists';
export { useSearchParam } from './use-search-param';
