import type { MockApplication, MockCluster, MockData, MockInstance, MockService } from './store.ts';

/**
 * Extra data for demos of the fleet board, the topology graphs and the placement explanation. It is a `customize`
 * function for `createMockStore` instead of a change to `backend.json`, because unit tests count
 * the seed's clusters and instances. All ids are fixed (the store resets on every page reload and
 * ids end up in URLs) and every timestamp is relative to the moment the store is (re)built.
 */

const CLUSTER_IDS = {
  test: '6a6d268f0908db5abba33b10',
  munich: '6a6d268f0908db5abba33b99',
  leipzig: '6c00000000000000000c0001',
  hamburg: '6c00000000000000000c0002',
  wien: '6c00000000000000000c0003',
} as const;

const SERVICE_IDS = {
  frontend: '6ae75bea77578493c2f80308',
  cache: '6ae75bea77578493c2f80309',
  api: '6ae75bea77578493c2f8030a',
  ingest: '6ae75bea77578493c2f8030c',
  process: '6ae75bea77578493c2f8030d',
  warehouse: '6ae75bea77578493c2f8030f',
  trainer: '6ae75bea77578493c2f80312',
  bigmem: '6c00000000000000000d0001',
  wideload: '6c00000000000000000d0002',
  munichgw: '6c00000000000000000d0003',
} as const;

const MLBATCH_APP_ID = '6ae75bea77578493c2f80311';

const SECOND = 1000;
const DAY = 86_400 * SECOND;
const HISTORY_POINTS = 12;
const HISTORY_STEP = 15 * SECOND;

const MIB = 1024 * 1024;

function workerId(index: number): string {
  return `6c00000000000000000b${index.toString(16).padStart(4, '0')}`;
}

/** Cluster history: epoch seconds, oldest first, the last point at `endMs`. */
function clusterHistory(endMs: number, around: number, spread: number) {
  return Array.from({ length: HISTORY_POINTS }, (_, i) => ({
    timestamp: (endMs - (HISTORY_POINTS - 1 - i) * HISTORY_STEP) / 1000,
    // Deterministic wobble so the demo looks the same on every reload.
    value: Math.max(0, Math.min(100, around + Math.sin(i * 1.7) * spread)),
  }));
}

/** Instance history: ISO timestamps, values as numeric strings like the real backend sends. */
function instanceHistory(endMs: number, around: number, spread: number, scale = 1) {
  return Array.from({ length: HISTORY_POINTS }, (_, i) => ({
    timestamp: new Date(endMs - (HISTORY_POINTS - 1 - i) * HISTORY_STEP).toISOString(),
    value: (Math.max(0, around + Math.sin(i * 1.3) * spread) * scale).toFixed(6),
  }));
}

interface ClusterSpec {
  id: string;
  name: string;
  location: string;
  cores: number;
  /** Total memory in MB; `memory_in_mb` reports what is left of it. */
  memoryMb: number;
  nodes: number;
  cpuPercent: number;
  memoryPercent: number;
  port: string;
  /** Epoch ms of the last report. */
  reportedAt: number;
}

function cluster(spec: ClusterSpec, active: boolean): MockCluster {
  return {
    _id: spec.id,
    active,
    active_nodes: spec.nodes,
    aggregated_cpu_percent: spec.cpuPercent,
    candidate_location: spec.location,
    candidate_name: spec.name,
    cluster_location: spec.location,
    cluster_name: spec.name,
    cpu_history: clusterHistory(spec.reportedAt, spec.cpuPercent, 3),
    cpu_percent: spec.cpuPercent,
    csi_drivers: [],
    gpu_drivers: null,
    gpu_percent: 0,
    gpu_temp: 0,
    ip: `cluster_manager_${spec.name}`,
    last_modified_timestamp: spec.reportedAt / 1000,
    memory: Math.round(spec.memoryMb * (1 - spec.memoryPercent / 100)),
    memory_history: clusterHistory(spec.reportedAt, spec.memoryPercent, 2),
    memory_in_mb: Math.round(spec.memoryMb * (1 - spec.memoryPercent / 100)),
    memory_percent: spec.memoryPercent,
    port: spec.port,
    supported_addons: [],
    total_cpu_cores: spec.cores,
    total_gpu_cores: 0,
    vcpus: spec.cores,
    vgpus: 0,
    virtualization: Array.from({ length: spec.nodes }, () => ['runc', 'docker']).flat(),
    vram: 0,
    vram_percent: 0,
  };
}

interface InstanceSpec {
  cluster: keyof typeof CLUSTER_IDS;
  worker: number;
  status: string;
  detail?: string;
  /** CPU in percent of one core. */
  cpu: number;
  /** Memory in MiB; the backend reports bytes. */
  memoryMib: number;
}

const LOCATIONS: Record<keyof typeof CLUSTER_IDS, string> = {
  test: '52.5200,13.4050,100',
  munich: '48.1351,11.5820,50',
  leipzig: '51.3397,12.3731,60',
  hamburg: '53.5511,9.9937,50',
  wien: '48.2082,16.3738,40',
};

function instance(base: MockInstance, spec: InstanceSpec, now: number): MockInstance {
  return {
    ...base,
    cluster_id: CLUSTER_IDS[spec.cluster],
    cluster_location: LOCATIONS[spec.cluster],
    worker_id: workerId(spec.worker),
    status: spec.status,
    status_detail: spec.detail ?? base.status_detail,
    cpu_percent: spec.cpu.toFixed(6),
    memory_percent: (spec.memoryMib * MIB).toFixed(6),
    cpu_history: instanceHistory(now, spec.cpu, spec.cpu * 0.2),
    memory_history: instanceHistory(now, spec.memoryMib, spec.memoryMib * 0.05, MIB),
    last_modified_timestamp: now / 1000,
  };
}

function findService(data: MockData, id: string): MockService {
  const service = data.services.find((candidate) => candidate._id === id);
  if (!service) throw new Error(`withPlacementDemo: service ${id} is missing from the seed`);
  return service;
}

function place(data: MockData, id: string, specs: InstanceSpec[], now: number): void {
  const service = findService(data, id);
  const bases = service.instance_list;
  service.instance_list = specs.map((spec, index) => {
    const base = bases[index] ?? { instance_number: index, status: spec.status };
    return instance(base, spec, now);
  });
  service.next_instance_progressive_number = service.instance_list.length;
}

function newService(
  app: MockApplication,
  fields: Partial<MockService> & Pick<MockService, '_id' | 'microservice_name'>,
): MockService {
  const name = fields.microservice_name;
  return {
    added_files: [],
    app_name: app.application_name,
    app_ns: app.application_namespace,
    applicationID: app.applicationID,
    bandwidth_in: 0,
    bandwidth_out: 0,
    cmd: [],
    code: 'docker.io/library/alpine:latest',
    image: 'docker.io/library/alpine:latest',
    instance_list: [],
    job_name: `${app.application_name}.${app.application_namespace}.${name}.${app.application_namespace}`,
    memory: 100,
    microserviceID: fields._id,
    microservice_namespace: app.application_namespace,
    next_instance_progressive_number: 0,
    port: '',
    service_name: name,
    service_ns: app.application_namespace,
    state: '',
    storage: 0,
    vcpus: 1,
    vgpus: 0,
    virtualization: 'docker',
    vtpus: 0,
    ...fields,
  };
}

/**
 * Four reporting clusters at different loads, the silent `edge-munich` with its last report, and
 * instances spread over all of them, so the fleet board has content. Three services fail to be
 * placed, each for one cause the explanation can name (the seed's `trainer` fails memory and CPU
 * at once).
 *
 * Users: Admin owns webshop, iotpipe and mlbatch, alice owns analytics (Admin's all-applications
 * view therefore shows a foreign owner). Log in as `Admin` or `alice` to see the difference.
 */
export function withPlacementDemo(data: MockData): void {
  const now = Date.now();

  const [testCluster, munich] = ['test', 'munich'].map((key) =>
    data.clusters.find((candidate) => candidate._id === CLUSTER_IDS[key as 'test' | 'munich']),
  );
  if (!testCluster || !munich) throw new Error('withPlacementDemo: seed clusters are missing');

  // The seed's timestamps are from when the fixture was recorded. Shift the histories so the last
  // point is "now" and the cluster does not look silent.
  for (const key of ['cpu_history', 'memory_history'] as const) {
    const history = testCluster[key] as { timestamp: number; value: number }[];
    const last = history.at(-1)?.timestamp ?? now / 1000;
    const offset = now / 1000 - last;
    testCluster[key] = history.map((point) => ({ ...point, timestamp: point.timestamp + offset }));
  }
  testCluster.last_modified_timestamp = now / 1000;

  // A cluster that stopped reporting keeps its last values, which is what the UI labels as
  // last-known. active_nodes stays non-zero for the same reason.
  Object.assign(
    munich,
    cluster(
      {
        id: CLUSTER_IDS.munich,
        name: 'edge-munich',
        location: LOCATIONS.munich,
        cores: 16,
        memoryMb: 32_768,
        nodes: 2,
        cpuPercent: 31,
        memoryPercent: 46,
        port: '10100',
        reportedAt: now - 4 * DAY,
      },
      false,
    ),
  );

  data.clusters.push(
    cluster(
      {
        id: CLUSTER_IDS.leipzig,
        name: 'plant-leipzig',
        location: LOCATIONS.leipzig,
        cores: 32,
        memoryMb: 131_072,
        nodes: 4,
        cpuPercent: 24,
        memoryPercent: 38,
        port: '10100',
        reportedAt: now,
      },
      true,
    ),
    cluster(
      {
        id: CLUSTER_IDS.hamburg,
        name: 'edge-hamburg',
        location: LOCATIONS.hamburg,
        cores: 16,
        memoryMb: 32_768,
        nodes: 2,
        cpuPercent: 52,
        memoryPercent: 61,
        port: '10100',
        reportedAt: now,
      },
      true,
    ),
    cluster(
      {
        id: CLUSTER_IDS.wien,
        name: 'edge-wien',
        location: LOCATIONS.wien,
        cores: 8,
        memoryMb: 16_384,
        nodes: 1,
        cpuPercent: 88,
        memoryPercent: 84,
        port: '10100',
        reportedAt: now,
      },
      true,
    ),
  );

  // Memory stays near each service's limit: the Fleet memory lens reads it as a share of that limit.
  place(
    data,
    SERVICE_IDS.frontend,
    [
      { cluster: 'leipzig', worker: 1, status: 'RUNNING', cpu: 14.2, memoryMib: 38 },
      { cluster: 'munich', worker: 2, status: 'RUNNING', cpu: 6.8, memoryMib: 31 },
    ],
    now,
  );
  place(
    data,
    SERVICE_IDS.cache,
    [{ cluster: 'test', worker: 3, status: 'RUNNING', cpu: 9.5, memoryMib: 22 }],
    now,
  );
  place(
    data,
    SERVICE_IDS.api,
    [{ cluster: 'test', worker: 4, status: 'RUNNING', cpu: 27.4, memoryMib: 41 }],
    now,
  );
  place(
    data,
    SERVICE_IDS.ingest,
    [
      { cluster: 'leipzig', worker: 5, status: 'RUNNING', cpu: 41.3, memoryMib: 19 },
      { cluster: 'hamburg', worker: 6, status: 'RUNNING', cpu: 36.9, memoryMib: 16 },
      { cluster: 'wien', worker: 7, status: 'RUNNING', cpu: 72.1, memoryMib: 29 },
    ],
    now,
  );
  place(
    data,
    SERVICE_IDS.process,
    [
      {
        cluster: 'wien',
        worker: 8,
        status: 'FAILED',
        detail: 'Container task exited with return code 137',
        cpu: 0,
        memoryMib: 0,
      },
    ],
    now,
  );
  const process = findService(data, SERVICE_IDS.process);
  process.status = 'FAILED';
  process.status_detail = 'Container task exited with return code 137';

  // alice's application stays hers: she needs one running service, the rest is Admin's.
  place(
    data,
    SERVICE_IDS.warehouse,
    [{ cluster: 'hamburg', worker: 9, status: 'RUNNING', cpu: 18.6, memoryMib: 210 }],
    now,
  );
  findService(data, SERVICE_IDS.warehouse).status = 'RUNNING';

  // Gives the topology graphs dependency edges to draw. Targets are service `_id`s, which is what
  // the SLA form's connectivity picker writes.
  const links: [from: keyof typeof SERVICE_IDS, to: keyof typeof SERVICE_IDS][] = [
    ['frontend', 'api'],
    ['api', 'cache'],
    ['ingest', 'process'],
  ];
  for (const [from, to] of links) {
    findService(data, SERVICE_IDS[from]).connectivity = [
      { target_microservice_id: SERVICE_IDS[to] },
    ];
  }

  const mlbatch = data.applications.find((app) => app.applicationID === MLBATCH_APP_ID);
  if (!mlbatch) throw new Error('withPlacementDemo: mlbatch is missing from the seed');

  const placementFailures = [
    // Memory only: 2 cores fit anywhere, 200 GB fit in no cluster.
    newService(mlbatch, {
      _id: SERVICE_IDS.bigmem,
      microservice_name: 'bigmem',
      memory: 200_000,
      vcpus: 2,
      status: 'NoActiveClusterWithCapacity',
      status_detail: 'No active cluster has enough memory',
    }),
    // Cluster totals (42 cores on test-cluster) fit, but no single worker has 40 free cores.
    newService(mlbatch, {
      _id: SERVICE_IDS.wideload,
      microservice_name: 'wideload',
      memory: 4_000,
      vcpus: 40,
      status: 'NO_WORKER_CAPACITY',
      status_detail: 'The cluster has capacity in total, but no worker can host the service',
      instance_list: [
        {
          instance_number: 0,
          status: 'NO_WORKER_CAPACITY',
          status_detail: 'No worker with 40 free cores',
          cluster_id: CLUSTER_IDS.test,
          cluster_location: LOCATIONS.test,
          last_modified_timestamp: now / 1000,
        },
      ],
      next_instance_progressive_number: 1,
    }),
    // Pinned to a cluster that has stopped reporting.
    newService(mlbatch, {
      _id: SERVICE_IDS.munichgw,
      microservice_name: 'munichgw',
      memory: 128,
      vcpus: 1,
      constraints: [{ type: 'direct', cluster: 'edge-munich' }],
      status: 'TargetClusterNotActive',
      status_detail: 'Target cluster edge-munich is not active',
    }),
  ];
  data.services.push(...placementFailures);
  mlbatch.microservices.push(...placementFailures.map((service) => service._id));
}
