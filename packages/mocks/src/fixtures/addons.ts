/**
 * Seed data of the mock addons-manager and marketplace-manager, in the backends' wire format.
 *
 * Marketplace definitions (the `GET /marketplace/addons` list shows approved ones only):
 *
 * | name              | status              | ui block           | installed in the seed | install ends |
 * | ----------------- | ------------------- | ------------------ | --------------------- | ------------ |
 * | example           | approved            | example-ui, ^0.1.0 | active                | active       |
 * | analytics         | approved            | none               | partially_active      | active       |
 * | legacy-exporter   | approved            | none               | failed (with logs)    | active       |
 * | flops             | approved            | none               | no                    | active       |
 * | flaky-addon       | approved            | none               | no                    | partially_active |
 * | broken-addon      | approved            | none               | no                    | failed       |
 * | install-error-addon | approved          | none               | no                    | failed at once, no logs |
 * | community-tool    | under_review        | none               | no (get by id only)   | active       |
 * | rejected-addon    | verification_failed | none               | no (get by id only)   | active       |
 *
 * Environment values are fake secrets on purpose: the UI must show keys only.
 */

export interface MockMarketplaceAddon {
  _id: string;
  name: string;
  description: string;
  services: MockAddonService[];
  volumes: {
    name: string;
    driver?: string;
    driver_opts?: Record<string, string>;
    labels?: Record<string, string>;
  }[];
  networks: { name: string; driver?: string; enable_ipv6?: boolean }[];
  status: 'under_review' | 'approved' | 'verification_failed';
  ui?: { service: string; sdk: string };
}

export interface MockAddonService {
  service_name: string;
  image: string;
  command?: string;
  networks: string[];
  volumes: string[];
  ports: Record<string, string>;
  environment: Record<string, string>;
  labels: Record<string, string>;
}

export interface MockInstalledAddon {
  _id: string;
  marketplace_id: string;
  name: string;
  description: string;
  services: MockAddonService[];
  volumes: MockMarketplaceAddon['volumes'];
  networks: MockMarketplaceAddon['networks'];
  status: 'installing' | 'disabling' | 'disabled' | 'failed' | 'active' | 'partially_active';
  /** `{}` when the install itself failed. */
  status_details?: { failed_services?: string[] };
  logs?: string;
}

/**
 * What a fresh install of an addon ends in. Anything not listed ends `active`. `partially_active`
 * and `failed` are reached through `active`, when the monitor notices the crash later;
 * `install_failed` goes straight to `failed`, with empty status_details and no logs.
 */
export type MockInstallOutcome = 'active' | 'partially_active' | 'failed' | 'install_failed';

export const INSTALL_OUTCOMES: Readonly<Record<string, MockInstallOutcome>> = {
  'flaky-addon': 'partially_active',
  'broken-addon': 'failed',
  'install-error-addon': 'install_failed',
};

/** Log text the monitor leaves on a failed install. */
export const FAILED_INSTALL_LOGS =
  'Pulling image registry.example/broken/worker:1.0.0\n' +
  'Error: manifest for registry.example/broken/worker:1.0.0 not found\n' +
  'Service broken-worker failed to start, giving up after 3 attempts';

function service(
  name: string,
  image: string,
  extra: Partial<MockAddonService> = {},
): MockAddonService {
  return {
    service_name: name,
    image,
    networks: [],
    volumes: [],
    ports: {},
    environment: {},
    labels: {},
    ...extra,
  };
}

const id = (prefix: string, n: number) => `${prefix}${String(n).padStart(23, '0')}`;
export const marketplaceId = (n: number) => id('6', n);
export const installedId = (n: number) => id('7', n);

export function marketplaceFixtures(): MockMarketplaceAddon[] {
  return [
    {
      _id: marketplaceId(1),
      name: 'example',
      description: 'Reference addon with a dashboard UI: a page, a widget and a nav entry.',
      services: [
        service('example-ui', 'ghcr.io/oakestra/dashboard-addon-example:0.1.0', {
          networks: ['oakestra-net'],
        }),
        service('example-worker', 'ghcr.io/oakestra/example-worker:0.1.0', {
          networks: ['oakestra-net'],
          volumes: ['example-data:/var/lib/example'],
          ports: { '9100': '9100' },
          environment: { EXAMPLE_API_TOKEN: 'sk-fake-example-token', LOG_LEVEL: 'info' },
          labels: { 'oakestra.addon': 'example' },
        }),
      ],
      volumes: [{ name: 'example-data', driver: 'local' }],
      networks: [{ name: 'oakestra-net', driver: 'bridge', enable_ipv6: false }],
      status: 'approved',
      ui: { service: 'example-ui', sdk: '^0.1.0' },
    },
    {
      _id: marketplaceId(2),
      name: 'analytics',
      description: 'Collects and aggregates platform metrics.',
      services: [
        service('analytics-collector', 'ghcr.io/oakestra/analytics-collector:1.2.0', {
          environment: { DB_PASSWORD: 'fake-password' },
        }),
        service('analytics-api', 'ghcr.io/oakestra/analytics-api:1.2.0', {
          ports: { '8080': '8080' },
        }),
      ],
      volumes: [],
      networks: [],
      status: 'approved',
    },
    {
      _id: marketplaceId(3),
      name: 'legacy-exporter',
      description: 'Exports data to a legacy monitoring system.',
      services: [service('legacy-exporter', 'registry.example/legacy/exporter:0.9.0')],
      volumes: [],
      networks: [],
      status: 'approved',
    },
    {
      _id: marketplaceId(4),
      name: 'flops',
      description: 'Federated learning on Oakestra.',
      services: [
        service('flops-manager', 'ghcr.io/oakestra/flops-manager:1.0.0'),
        service('flops-learner', 'ghcr.io/oakestra/flops-learner:1.0.0'),
      ],
      volumes: [],
      networks: [],
      status: 'approved',
    },
    {
      _id: marketplaceId(5),
      name: 'flaky-addon',
      description: 'Starts, but one of its services keeps crashing.',
      services: [
        service('flaky-main', 'ghcr.io/example/flaky-main:1.0.0'),
        service('flaky-sidecar', 'ghcr.io/example/flaky-sidecar:1.0.0'),
      ],
      volumes: [],
      networks: [],
      status: 'approved',
    },
    {
      _id: marketplaceId(6),
      name: 'broken-addon',
      description: 'Cannot be installed: its image does not exist.',
      services: [service('broken-worker', 'registry.example/broken/worker:1.0.0')],
      volumes: [],
      networks: [],
      status: 'approved',
    },
    {
      _id: marketplaceId(9),
      name: 'install-error-addon',
      description: 'Fails while it is installed: docker cannot start it at all.',
      services: [service('install-error', 'registry.example/install/error:1.0.0')],
      volumes: [],
      networks: [],
      status: 'approved',
    },
    {
      _id: marketplaceId(7),
      name: 'community-tool',
      description: 'Submitted by the community, waiting for review.',
      services: [service('community-tool', 'docker.io/community/tool:latest')],
      volumes: [],
      networks: [],
      status: 'under_review',
    },
    {
      _id: marketplaceId(8),
      name: 'rejected-addon',
      description: 'Its image could not be pulled during verification.',
      services: [service('rejected', 'docker.io/nobody/does-not-exist:1')],
      volumes: [],
      networks: [],
      status: 'verification_failed',
    },
  ];
}

export function installedFixtures(
  marketplace: readonly MockMarketplaceAddon[],
): MockInstalledAddon[] {
  const from = (
    n: number,
    marketplaceNumber: number,
    status: MockInstalledAddon['status'],
    extra: Partial<MockInstalledAddon> = {},
  ): MockInstalledAddon => {
    const definition = marketplace.find((addon) => addon._id === marketplaceId(marketplaceNumber))!;
    return {
      _id: installedId(n),
      marketplace_id: definition._id,
      name: definition.name,
      description: definition.description,
      services: structuredClone(definition.services),
      volumes: structuredClone(definition.volumes),
      networks: structuredClone(definition.networks),
      status,
      ...extra,
    };
  };
  return [
    from(1, 1, 'active'),
    from(2, 2, 'partially_active', {
      status_details: { failed_services: ['analytics-collector'] },
    }),
    from(3, 3, 'failed', {
      status_details: { failed_services: ['legacy-exporter'] },
      logs: 'Container legacy-exporter exited with code 137 (out of memory)\nRestart policy exhausted',
    }),
  ];
}
