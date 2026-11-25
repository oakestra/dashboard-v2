import type { AddonsBackendState } from './addons-backend.ts';
import { installedId, marketplaceId, type MockMarketplaceAddon } from './fixtures/addons.ts';

/**
 * Addon seed of the public demo (`pnpm build:demo`): a `customize` function for
 * `createAddonsBackend`, which must run with `uiBlockSupport`. It adds the preinstalled `carbon`
 * showcase addon, gives `flops` a UI so installing it from the marketplace makes its pages appear,
 * and drops the definitions that only exist to exercise failure paths in tests. The names must
 * match the ids of `addons/demo-carbon` and `addons/demo-flops`, whose builds the demo serves.
 */
export function withShowcaseAddons(state: AddonsBackendState): void {
  const testOnly = new Set([
    'flaky-addon',
    'broken-addon',
    'install-error-addon',
    'rejected-addon',
  ]);
  state.marketplace = state.marketplace.filter((definition) => !testOnly.has(definition.name));

  const flops = state.marketplace.find((definition) => definition.name === 'flops');
  if (flops) {
    flops.description =
      'Federated learning on Oakestra: train models across clusters without moving the data.';
    flops.services.unshift(uiService('flops-ui', 'ghcr.io/oakestra/dashboard-addon-flops:0.1.0'));
    flops.ui = { service: 'flops-ui', sdk: '^0.1.0' };
  }

  const carbon: MockMarketplaceAddon = {
    _id: marketplaceId(20),
    name: 'carbon',
    description: 'Energy use and CO2 emissions per cluster, estimated from the reported load.',
    services: [
      uiService('carbon-ui', 'ghcr.io/oakestra/dashboard-addon-carbon:0.1.0'),
      {
        ...uiService('carbon-collector', 'ghcr.io/oakestra/carbon-collector:0.1.0'),
        environment: { GRID_INTENSITY_API_KEY: 'fake-grid-key', SAMPLE_INTERVAL: '60s' },
      },
    ],
    volumes: [],
    networks: [],
    status: 'approved',
    ui: { service: 'carbon-ui', sdk: '^0.1.0' },
  };
  state.marketplace.push(carbon);
  state.installed.push({
    _id: installedId(20),
    marketplace_id: carbon._id,
    name: carbon.name,
    description: carbon.description,
    services: structuredClone(carbon.services),
    volumes: [],
    networks: [],
    status: 'active',
  });
}

function uiService(name: string, image: string): MockMarketplaceAddon['services'][number] {
  return {
    service_name: name,
    image,
    networks: [],
    volumes: [],
    ports: {},
    environment: {},
    labels: {},
  };
}
