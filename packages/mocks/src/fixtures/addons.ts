/**
 * Seed data of the mock addons-manager and marketplace, in the backends' storage shape (the
 * backend serializes it like the Go services do).
 *
 * Sources: `official` and the tap `acme` synced, the tap `lab` failing (last good snapshot is
 * empty), and `local`.
 *
 * | qualified name          | permissions                              | installed in the seed        | install ends            |
 * | ----------------------- | ---------------------------------------- | ---------------------------- | ----------------------- |
 * | example                 | host_ports 9100, ui block ^0.1.0         | active                       | active                  |
 * | analytics (1.2.0)       | host_ports 8080, 9090                    | 1.1.0 partially_active, update grows the ports | active |
 * | legacy-exporter         | host_paths /var/log:ro                   | failed, grant signature invalid (with logs) | active |
 * | flops                   | core_network                             | no                           | active                  |
 * | flaky-addon             | none                                     | no                           | partially_active        |
 * | broken-addon            | none                                     | no                           | failed                  |
 * | install-error-addon     | none                                     | no                           | failed at once, no logs |
 * | acme/node-exporter      | host_network, host_root, /proc, /sys     | no                           | active                  |
 * | local/docker-inspector  | docker_socket                            | no                           | active                  |
 *
 * Display fields: `example`, `analytics`, `flops` and `acme/node-exporter` have a display name,
 * category and tags; `example` and `acme/node-exporter` have an icon (the exporter's host does
 * not resolve, so its card shows the placeholder); `flops` carries metadata the UI ignores.
 * Categories: monitoring (analytics, acme/node-exporter), ai (flops), developer tools (example).
 *
 * Environment values are fake secrets on purpose: the UI must show keys only.
 */

export type MockSourceKind = 'official' | 'tap' | 'local';

export interface MockSourceRef {
  kind: MockSourceKind;
  name: string;
}

export interface MockPermissions {
  host_paths: string[];
  host_ports: number[];
  docker_socket: boolean;
  host_root: boolean;
  host_network: boolean;
  core_network: boolean;
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

/** A catalog definition. The source decides the qualified name and the id. */
export interface MockDefinition {
  name: string;
  source: MockSourceRef;
  version: string;
  description: string;
  homepage?: string;
  maintainers?: string[];
  /** Display fields: the engine stores and serves them but never acts on them. */
  display_name?: string;
  category?: string;
  tags?: string[];
  icon?: string;
  metadata?: Record<string, string>;
  services: MockAddonService[];
  volumes: {
    name: string;
    driver?: string;
    driver_opts?: Record<string, string>;
    labels?: Record<string, string>;
  }[];
  networks: { name: string; driver?: string; enable_ipv6?: boolean }[];
  permissions: MockPermissions;
  ui?: { service: string; sdk: string };
}

export interface MockSource {
  name: string;
  kind: MockSourceKind;
  url: string;
  /** Never serialized, only `has_token`. */
  token?: string;
  allow_insecure: boolean;
  allow_private: boolean;
  created_at: string;
  last_attempt_at: string | null;
  last_synced_at: string | null;
  last_error: string;
  serial: number;
  generated_at: string | null;
}

export type MockAddonStatus =
  'installing' | 'updating' | 'disabling' | 'disabled' | 'failed' | 'active' | 'partially_active';

/** An installed addon as the addons-manager stores it: a pinned definition plus the grant. */
export interface MockInstalledAddon {
  _id: string;
  addon_id: string;
  qualified_name: string;
  source: MockSourceRef;
  version: string;
  definition: MockDefinition;
  granted: MockPermissions;
  status: MockAddonStatus;
  status_details: { failed_services?: string[]; message?: string };
  logs?: string;
  created_at: string;
  updated_at: string;
}

/**
 * What a fresh install of an addon ends in, by bare name. Anything not listed ends `active`.
 * `partially_active` and `failed` are reached through `active`, when the reconcile loop notices
 * the crash later; `install_failed` goes straight to `failed`, without logs.
 */
export type MockInstallOutcome = 'active' | 'partially_active' | 'failed' | 'install_failed';

export const INSTALL_OUTCOMES: Readonly<Record<string, MockInstallOutcome>> = {
  'flaky-addon': 'partially_active',
  'broken-addon': 'failed',
  'install-error-addon': 'install_failed',
};

/** Log text the reconcile loop leaves on a failed install. */
export const FAILED_INSTALL_LOGS =
  'Pulling image registry.example/broken/worker@sha256:0bad\n' +
  'Error: manifest unknown\n' +
  'Service broken-worker failed to start, giving up after 3 attempts';

/** Seed timestamps are fixed, so snapshots and tests do not depend on the clock. */
export const SEED_TIME = '2026-11-01T10:00:00Z';

const digest = (n: number) => `sha256:${String(n).padStart(64, '0')}`;

export function noPermissions(): MockPermissions {
  return {
    host_paths: [],
    host_ports: [],
    docker_socket: false,
    host_root: false,
    host_network: false,
    core_network: false,
  };
}

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

const OFFICIAL: MockSourceRef = { kind: 'official', name: 'official' };
const LOCAL: MockSourceRef = { kind: 'local', name: 'local' };

function definition(
  name: string,
  rest: Omit<MockDefinition, 'name' | 'source' | 'volumes' | 'networks' | 'permissions'> &
    Partial<Pick<MockDefinition, 'source' | 'volumes' | 'networks' | 'permissions'>>,
): MockDefinition {
  return {
    name,
    source: OFFICIAL,
    volumes: [],
    networks: [],
    ...rest,
    permissions: { ...noPermissions(), ...rest.permissions },
  };
}

export function sourceFixtures(): MockSource[] {
  const synced = {
    allow_insecure: false,
    allow_private: false,
    created_at: SEED_TIME,
    last_attempt_at: SEED_TIME,
    last_synced_at: SEED_TIME,
    last_error: '',
    generated_at: SEED_TIME,
  };
  return [
    {
      ...synced,
      name: 'official',
      kind: 'official',
      url: 'https://raw.githubusercontent.com/oakestra/community-marketplace/main/index.json',
      // The environment-configured URL is trusted with both.
      allow_insecure: true,
      allow_private: true,
      serial: 42,
    },
    {
      ...synced,
      name: 'acme',
      kind: 'tap',
      url: 'https://addons.acme.example/index.json',
      token: 'fake-acme-token',
      serial: 7,
    },
    {
      ...synced,
      name: 'lab',
      kind: 'tap',
      url: 'https://lab.example/index.json',
      last_synced_at: null,
      generated_at: null,
      last_error: 'fetching https://lab.example/index.json: 404 Not Found',
      serial: 0,
    },
    {
      ...synced,
      name: 'local',
      kind: 'local',
      url: '',
      allow_insecure: false,
      serial: 1,
    },
  ];
}

export function catalogFixtures(): MockDefinition[] {
  return [
    definition('example', {
      version: '0.1.0',
      description: 'Reference addon with a dashboard UI: a page, a widget and a nav entry.',
      homepage: 'https://github.com/oakestra/dashboard-v2',
      maintainers: ['Oakestra'],
      display_name: 'Example Addon',
      category: 'developer tools',
      tags: ['example', 'ui'],
      icon: 'https://github.com/oakestra.png?size=96',
      services: [
        service('example-ui', `ghcr.io/oakestra/dashboard-addon-example:0.1.0@${digest(1)}`, {
          networks: ['oakestra-net'],
        }),
        service('example-worker', `ghcr.io/oakestra/example-worker@${digest(2)}`, {
          networks: ['oakestra-net'],
          volumes: ['example-data:/var/lib/example'],
          ports: { '9100': '9100' },
          environment: { EXAMPLE_API_TOKEN: 'sk-fake-example-token', LOG_LEVEL: 'info' },
          labels: { 'example.role': 'worker' },
        }),
      ],
      volumes: [{ name: 'example-data', driver: 'local' }],
      networks: [{ name: 'oakestra-net', driver: 'bridge', enable_ipv6: false }],
      permissions: { ...noPermissions(), host_ports: [9100] },
      ui: { service: 'example-ui', sdk: '^0.1.0' },
    }),
    definition('analytics', {
      version: '1.2.0',
      description: 'Collects and aggregates platform metrics.',
      display_name: 'Platform Analytics',
      category: 'monitoring',
      tags: ['dashboards', 'metrics'],
      services: [
        service('analytics-collector', `ghcr.io/oakestra/analytics-collector:1.2.0@${digest(3)}`, {
          environment: { DB_PASSWORD: 'fake-password' },
          ports: { '9090': '9090' },
        }),
        service('analytics-api', `ghcr.io/oakestra/analytics-api:1.2.0@${digest(4)}`, {
          ports: { '8080': '8080' },
        }),
      ],
      permissions: { ...noPermissions(), host_ports: [8080, 9090] },
    }),
    definition('legacy-exporter', {
      version: '0.9.0',
      description: 'Exports data to a legacy monitoring system.',
      services: [
        service('legacy-exporter', `registry.example/legacy/exporter@${digest(5)}`, {
          volumes: ['/var/log:/host/log:ro'],
        }),
      ],
      permissions: { ...noPermissions(), host_paths: ['/var/log:ro'] },
    }),
    definition('flops', {
      version: '1.0.0',
      description: 'Federated learning on Oakestra.',
      display_name: 'FLOps',
      category: 'ai',
      tags: ['federated-learning', 'ml'],
      metadata: { 'oakestra.io/catalog-id': 'flops-001' },
      services: [
        service('flops-manager', `ghcr.io/oakestra/flops-manager@${digest(6)}`, {
          networks: ['oakestra'],
        }),
        service('flops-learner', `ghcr.io/oakestra/flops-learner@${digest(7)}`),
      ],
      permissions: { ...noPermissions(), core_network: true },
    }),
    definition('flaky-addon', {
      version: '1.0.0',
      description: 'Starts, but one of its services keeps crashing.',
      services: [
        service('flaky-main', `ghcr.io/example/flaky-main@${digest(8)}`),
        service('flaky-sidecar', `ghcr.io/example/flaky-sidecar@${digest(9)}`),
      ],
    }),
    definition('broken-addon', {
      version: '1.0.0',
      description: 'Cannot be installed: its image does not exist.',
      services: [service('broken-worker', `registry.example/broken/worker@${digest(10)}`)],
    }),
    definition('install-error-addon', {
      version: '1.0.0',
      description: 'Fails while it is installed: docker cannot start it at all.',
      services: [service('install-error', `registry.example/install/error@${digest(11)}`)],
    }),
    definition('node-exporter', {
      source: { kind: 'tap', name: 'acme' },
      version: '1.8.2',
      description: 'Prometheus host metrics, from a third-party tap.',
      display_name: 'Node Exporter',
      category: 'monitoring',
      tags: ['metrics', 'prometheus'],
      icon: 'https://icons.acme.invalid/node-exporter.png',
      services: [
        service('node-exporter', `quay.io/prometheus/node-exporter:v1.8.2@${digest(12)}`, {
          networks: ['host'],
          volumes: ['/proc:/host/proc:ro', '/sys:/host/sys:ro'],
        }),
      ],
      permissions: {
        ...noPermissions(),
        host_paths: ['/proc:ro', '/sys:ro'],
        host_root: true,
        host_network: true,
      },
    }),
    definition('docker-inspector', {
      source: LOCAL,
      version: '0.2.0',
      description: 'Lists the containers on the root host. Registered locally.',
      services: [
        service('inspector', `ghcr.io/example/docker-inspector:0.2.0@${digest(13)}`, {
          volumes: ['/var/run/docker.sock:/var/run/docker.sock'],
        }),
      ],
      permissions: {
        ...noPermissions(),
        host_paths: ['/var/run/docker.sock'],
        docker_socket: true,
      },
    }),
  ];
}

export const installedId = (n: number) => `7${String(n).padStart(23, '0')}`;

export function installedFixtures(catalog: readonly MockDefinition[]): MockInstalledAddon[] {
  const from = (
    n: number,
    name: string,
    status: MockAddonStatus,
    extra: Partial<MockInstalledAddon> = {},
  ): MockInstalledAddon => {
    const def = structuredClone(catalog.find((item) => item.name === name)!);
    return {
      _id: installedId(n),
      addon_id: def.name,
      qualified_name: def.name,
      source: def.source,
      version: def.version,
      definition: def,
      granted: structuredClone(def.permissions),
      status,
      status_details: {},
      created_at: SEED_TIME,
      updated_at: SEED_TIME,
      ...extra,
    };
  };

  // The installed analytics is the previous version, which did not publish 9090 yet.
  const analytics = from(2, 'analytics', 'partially_active', {
    status_details: { failed_services: ['analytics-collector'] },
  });
  analytics.version = analytics.definition.version = '1.1.0';
  analytics.definition.permissions.host_ports = [8080];
  analytics.granted.host_ports = [8080];
  analytics.definition.services[0]!.ports = {};

  return [
    from(1, 'example', 'active'),
    analytics,
    from(3, 'legacy-exporter', 'failed', {
      status_details: {
        failed_services: ['legacy-exporter'],
        message: 'grant signature invalid; re-approve the addon',
      },
      logs: 'Container legacy-exporter exited with code 137 (out of memory)\nRestart policy exhausted',
    }),
  ];
}
