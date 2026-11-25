import type { OakestraApi } from '@oakestra/dashboard-sdk';

// @oakestra/api is not a dependency of addons, so the type comes through the SDK's client.
export type Cluster = Awaited<ReturnType<OakestraApi['clusters']['list']>>[number];

// Everything here is invented for the demo. It is deterministic: the same cluster always gets the
// same numbers (seeded from its id), and only the 24 h window moves with the clock.

export const HOURS = 24;
const DEFAULT_VCPUS = 4;
// Per vCPU, idle and fully loaded, plus a fixed share for networking and cooling per cluster.
const IDLE_W_PER_VCPU = 6;
const BUSY_W_PER_VCPU = 24;
const OVERHEAD_KW = 0.15;

export interface HistoryPoint {
  timestamp: Date;
  powerKw: number;
  intensity: number;
}

export interface ClusterEstimate {
  clusterId: string;
  name: string;
  powerKw: number;
  /** Grid carbon intensity right now, gCO2/kWh. */
  intensity: number;
  /** CO2 emitted over the last 24 h, in kg. */
  co2KgDay: number;
  history: HistoryPoint[];
}

export type ClusterFootprint = { clusterId: string; name: string } & (
  | { kind: 'estimate'; estimate: ClusterEstimate }
  | { kind: 'silent' | 'never-reported'; reason: string }
);

/** FNV-1a, mapped to [0, 1). */
function seeded(text: string): number {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 2 ** 32;
}

/** Rough regional grid mix: the further north, the more wind, the further east, the more coal. */
function baseIntensity(cluster: Cluster): number {
  const [lat = 50, lng = 10] = (cluster.cluster_location ?? '').split(',').map(Number);
  const north = Number.isFinite(lat) ? (lat - 48) * 12 : 0;
  const east = Number.isFinite(lng) ? (lng - 10) * 9 : 0;
  const jitter = (seeded(cluster._id) - 0.5) * 120;
  return Math.round(Math.min(520, Math.max(60, 300 - north + east + jitter)));
}

/** Evening peak, midday solar dip. */
function intensityAt(base: number, hour: number): number {
  return Math.round(base * (1 + 0.22 * Math.cos(((hour - 19) / 24) * 2 * Math.PI)));
}

/** Load follows working hours a little. */
function loadAt(cpu: number, hour: number, seed: string): number {
  const wave = 1 + 0.18 * Math.sin(((hour - 9) / 24) * 2 * Math.PI);
  const noise = 0.94 + seeded(`${seed}:${hour}`) * 0.12;
  return Math.min(100, Math.max(0, cpu * wave * noise));
}

function powerKw(vcpus: number, cpuPercent: number): number {
  const watts =
    vcpus * (IDLE_W_PER_VCPU + ((BUSY_W_PER_VCPU - IDLE_W_PER_VCPU) * cpuPercent) / 100);
  return watts / 1000 + OVERHEAD_KW;
}

export function footprintOf(cluster: Cluster, now: Date): ClusterFootprint {
  const name = cluster.cluster_name;
  if (!cluster.active) {
    // Same distinction the shell makes: a missing timestamp means it never reported.
    if (cluster.last_modified_timestamp === undefined) {
      return {
        kind: 'never-reported',
        clusterId: cluster._id,
        name,
        reason: 'This cluster has not reported any usage yet, so there is nothing to estimate.',
      };
    }
    return {
      kind: 'silent',
      clusterId: cluster._id,
      name,
      reason: 'This cluster stopped reporting. No live estimate is shown for last-known values.',
    };
  }

  const vcpus = cluster.vcpus ?? DEFAULT_VCPUS;
  const cpu = cluster.cpu_percent ?? cluster.aggregated_cpu_percent ?? 0;
  const base = baseIntensity(cluster);
  const currentHour = now.getHours();

  const history: HistoryPoint[] = [];
  for (let back = HOURS - 1; back >= 0; back -= 1) {
    const timestamp = new Date(now);
    timestamp.setMinutes(0, 0, 0);
    timestamp.setHours(timestamp.getHours() - back);
    const hour = timestamp.getHours();
    history.push({
      timestamp,
      powerKw: powerKw(
        vcpus,
        hour === currentHour && back === 0 ? cpu : loadAt(cpu, hour, cluster._id),
      ),
      intensity: intensityAt(base, hour),
    });
  }

  const co2KgDay = history.reduce(
    (sum, point) => sum + (point.powerKw * point.intensity) / 1000,
    0,
  );
  return {
    kind: 'estimate',
    clusterId: cluster._id,
    name,
    estimate: {
      clusterId: cluster._id,
      name,
      powerKw: powerKw(vcpus, cpu),
      intensity: intensityAt(base, currentHour),
      co2KgDay,
      history,
    },
  };
}

export interface FleetSummary {
  powerKw: number;
  co2KgDay: number;
  /** Power-weighted, gCO2/kWh. Null when no cluster is reporting. */
  intensity: number | null;
  greenest: ClusterEstimate | null;
  history: { timestamp: Date; value: number }[];
  reporting: number;
}

export function summarize(footprints: readonly ClusterFootprint[]): FleetSummary {
  const estimates = footprints.flatMap((f) => (f.kind === 'estimate' ? [f.estimate] : []));
  const powerKwTotal = estimates.reduce((sum, e) => sum + e.powerKw, 0);
  const weighted = estimates.reduce((sum, e) => sum + e.powerKw * e.intensity, 0);
  const greenest = estimates.reduce<ClusterEstimate | null>(
    (best, e) => (best === null || e.intensity < best.intensity ? e : best),
    null,
  );
  const first = estimates[0];
  const history = (first?.history ?? []).map((point, index) => ({
    timestamp: point.timestamp,
    value: estimates.reduce((sum, e) => sum + (e.history[index]?.powerKw ?? 0), 0),
  }));
  return {
    powerKw: powerKwTotal,
    co2KgDay: estimates.reduce((sum, e) => sum + e.co2KgDay, 0),
    intensity: powerKwTotal > 0 ? weighted / powerKwTotal : null,
    greenest,
    history,
    reporting: estimates.length,
  };
}

export const formatKw = (value: number) => `${value.toFixed(value < 10 ? 2 : 1)} kW`;
export const formatKg = (value: number) => `${value.toFixed(value < 10 ? 1 : 0)} kg`;
export const formatIntensity = (value: number) => `${Math.round(value)} g/kWh`;
