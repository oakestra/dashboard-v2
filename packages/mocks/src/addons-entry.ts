// Entry for plain Node consumers (tools/mock-addons-manager): the addon mocks without MSW.
export {
  createAddonsBackend,
  type AddonsBackend,
  type AddonsBackendOptions,
  type AddonsBackendState,
  type BackendResponse,
  type UiAddonEntry,
} from './addons-backend.ts';
export {
  FAILED_INSTALL_LOGS,
  INSTALL_OUTCOMES,
  installedFixtures,
  marketplaceFixtures,
  type MockAddonService,
  type MockInstalledAddon,
  type MockInstallOutcome,
  type MockMarketplaceAddon,
} from './fixtures/addons.ts';
