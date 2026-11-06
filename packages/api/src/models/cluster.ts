import { z } from 'zod';

import { historySchema, list, optionalNumber, optionalString, timestamp } from './common.ts';

/**
 * Addons, CSI and GPU drivers arrive as strings or `{name}` objects, depending on the cluster
 * version. Anything else is shown as its JSON rather than hidden, and a list that is not a list at
 * all counts as empty: a capability list is never worth failing the whole cluster over.
 */
const labelList = list(
  z
    .union([z.string(), z.looseObject({ name: z.string() }).transform(({ name }) => name)])
    .catch(({ value }) => JSON.stringify(value) ?? String(value)),
).catch([]);

export const clusterSchema = z.looseObject({
  _id: z.string(),
  cluster_name: z.string(),
  /** `"lat,lng,radius"`, see parseClusterLocation(). */
  cluster_location: optionalString,
  active: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
  active_nodes: optionalNumber,
  aggregated_cpu_percent: optionalNumber,
  cpu_percent: optionalNumber,
  memory_percent: optionalNumber,
  memory_in_mb: optionalNumber,
  total_cpu_cores: optionalNumber,
  total_gpu_cores: optionalNumber,
  gpu_percent: optionalNumber,
  gpu_temp: optionalNumber,
  /** In MB. */
  vram: optionalNumber,
  vram_percent: optionalNumber,
  vcpus: optionalNumber,
  ip: optionalString,
  port: optionalString.catch(undefined),
  // /clusters/active repeats the list once per node ("runc","docker","runc","docker",...).
  virtualization: list(z.string()).transform((items) => [...new Set(items)]),
  csi_drivers: labelList,
  gpu_drivers: labelList,
  supported_addons: labelList,
  /** Aggregated CPU usage in percent over time. */
  cpu_history: historySchema,
  /** Aggregated memory usage in percent over time. */
  memory_history: historySchema,
  last_modified_timestamp: timestamp.optional().catch(undefined),
});

export type Cluster = z.infer<typeof clusterSchema>;

export interface ClusterLocation {
  latitude: number;
  longitude: number;
  /** Radius around the point, in the unit the cluster operator configured (usually km). */
  radius?: number;
}

/**
 * Parses `cluster_location` (`"52.5200,13.4050,100"`). Returns null for anything that is not a
 * valid coordinate, which includes the empty string clusters report before pairing completes.
 */
export function parseClusterLocation(value: string | null | undefined): ClusterLocation | null {
  if (!value) return null;
  const parts = value.split(',').map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => part === '')) return null;
  const [latitude, longitude, radius] = parts.map(Number);
  if (latitude === undefined || longitude === undefined) return null;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) return null;
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
  if (radius !== undefined && (!Number.isFinite(radius) || radius < 0)) return null;
  return radius === undefined ? { latitude, longitude } : { latitude, longitude, radius };
}

export type ClusterReportState = 'reporting' | 'silent' | 'never-reported';

/**
 * Whether a cluster is sending reports. `active` is computed by the backend on every read (last
 * report newer than its freshness threshold), so no clock is needed here and the browser's time
 * zone or skew cannot disagree with the server. A cluster that registered but never reported has
 * no `last_modified_timestamp` at all (registration inserts the document without one), which is
 * why a missing timestamp is told apart from a stale one: a silent cluster still has last-known
 * values worth showing, a never-reported one has none.
 */
export function clusterReportState(
  cluster: Pick<Cluster, 'active' | 'last_modified_timestamp'>,
): ClusterReportState {
  if (cluster.active) return 'reporting';
  return cluster.last_modified_timestamp === undefined ? 'never-reported' : 'silent';
}
