import {
  clusterReportState,
  clusterStateLabel,
  compareTones,
  describeStatus,
  hasMetrics,
  isAbnormalTone,
  isPlacementFailure,
  isTransitionalStatus,
  serviceAttention,
  type Application,
  type Cluster,
  type ClusterReportState,
  type Instance,
  type Service,
  type StatusDescription,
  type StatusTone,
} from '@oakestra/api';
import { formatBytes, formatMegabytes, formatPercent, plural, BYTES_PER_MB } from '@oakestra/ui';

export interface BoardEntry {
  application: Application;
  services: readonly Service[];
  /** The services of this application could not be loaded, so `services` says nothing. */
  servicesUnavailable?: boolean;
}

export interface BuildBoardInput {
  entries: readonly BoardEntry[];
  clusters: readonly Cluster[];
}

/** One instance as the board sees it. */
export interface BoardInstance {
  /** Instances have no id of their own: the service id plus `instance_number` identifies them. */
  key: string;
  instance: Instance;
  service: Service;
  status: StatusDescription;
  /** The cluster it sits on, undefined when it is in Unplaced. */
  clusterId: string | undefined;
  /** On a silent or never-reported cluster: the status is the last one heard, not a fact. */
  stale: boolean;
}

/** Why a service, or one of its instances, has no place on a cluster. */
export interface UnplacedEntry {
  key: string;
  service: Service;
  tone: StatusTone;
  label: string;
  hint: string;
  pulse: boolean;
}

export interface AttentionNote {
  tone: 'destructive' | 'warning';
  /** Finishes the sentence "<service> ...". */
  summary: string;
}

/**
 * How urgently a row wants a look, smallest first. `lastKnown` rows are fine as far as anyone can
 * tell, but part of them sits on a cluster that went quiet.
 */
const SEVERITY = { failed: 0, degraded: 1, lastKnown: 2, normal: 3 } as const;
export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];

export interface ServiceRow {
  service: Service;
  application: Application;
  /** Every instance, placed or not. */
  instances: readonly BoardInstance[];
  /** Placed instances by cluster id. */
  placements: ReadonlyMap<string, readonly BoardInstance[]>;
  unplaced: readonly UnplacedEntry[];
  severity: Severity;
  attention: AttentionNote | null;
}

export interface ApplicationRow {
  application: Application;
  severity: Severity;
  /** Narrowed by `filterRows`, so `serviceCount` is what the application really has. */
  services: readonly ServiceRow[];
  serviceCount: number;
  servicesUnavailable: boolean;
}

/** A cluster as the board puts it on a card. */
export interface ClusterLane {
  cluster: Cluster;
  id: string;
  name: string;
  state: ClusterReportState;
}

export interface BoardSummary {
  applications: number;
  /** Instances known to run right now, so never those on a silent cluster. */
  running: number;
  /** Services and clusters those running instances belong to. */
  runningServices: number;
  runningClusters: number;
  /** Services that need attention. */
  attention: number;
}

export interface BoardModel {
  /** Clusters with at least one of the viewer's instances, which get a card. */
  lanes: readonly ClusterLane[];
  /** The other clusters, summed up in a line below the board. */
  idleLanes: readonly ClusterLane[];
  rows: readonly ApplicationRow[];
  summary: BoardSummary;
}

const REPORT_ORDER: Record<ClusterReportState, number> = {
  reporting: 0,
  silent: 1,
  'never-reported': 2,
};

// One collator: `localeCompare` with options builds a new one per comparison.
const byName = new Intl.Collator('en', { sensitivity: 'base' }).compare;

function isOffline(state: ClusterReportState | undefined): boolean {
  return state === 'silent' || state === 'never-reported';
}

function clusterLanes(clusters: readonly Cluster[]): ClusterLane[] {
  return clusters
    .map((cluster) => ({
      cluster,
      id: cluster._id,
      name: cluster.cluster_name,
      state: clusterReportState(cluster),
    }))
    .sort((a, b) => REPORT_ORDER[a.state] - REPORT_ORDER[b.state] || byName(a.name, b.name));
}

/**
 * An instance sits on a cluster only when that cluster exists and took it. A placement
 * failure names the cluster that turned the instance down, which does not make it run there.
 */
function isPlaced(instance: Instance, clusters: ReadonlyMap<string, ClusterReportState>): boolean {
  return (
    instance.cluster_id !== undefined &&
    clusters.has(instance.cluster_id) &&
    !isPlacementFailure(instance.status)
  );
}

function unplacedInstance(service: Service, instance: Instance): UnplacedEntry {
  const key = instanceKey(service._id, instance.instance_number);
  const status = describeStatus(instance.status, instance.status_detail);
  if (isAbnormalTone(status.tone)) {
    return { key, service, ...status, tone: status.tone };
  }
  if (status.tone === 'info') {
    return { key, service, tone: 'info', label: 'Being scheduled', hint: '', pulse: true };
  }
  return {
    key,
    service,
    tone: 'warning',
    label: 'Unknown cluster',
    hint: instance.cluster_id
      ? `Reports cluster ${instance.cluster_id}, which is not registered`
      : 'Reports no cluster',
    pulse: false,
  };
}

/**
 * What the Unplaced card shows for a service. A placement failure is listed even next to running
 * instances (another instance did not fit). A new instance request adds to `instance_list` only
 * once it is scheduled, so REQUESTED without instances is work in progress, not a problem, and an
 * empty list with no such status simply was never deployed.
 */
function unplacedEntries(
  service: Service,
  clusters: ReadonlyMap<string, ClusterReportState>,
): UnplacedEntry[] {
  const entries = service.instance_list
    .filter((instance) => !isPlaced(instance, clusters))
    .map((instance) => unplacedInstance(service, instance));

  const own = describeStatus(service.status, service.status_detail);
  const base = { key: service._id, service, hint: own.hint, pulse: own.pulse };
  if (isPlacementFailure(service.status)) {
    const explained = service.instance_list.some((i) => isPlacementFailure(i.status));
    if (!explained) entries.push({ ...base, tone: own.tone, label: own.label });
  } else if (service.instance_list.length === 0) {
    if (isAbnormalTone(own.tone)) entries.push({ ...base, tone: own.tone, label: own.label });
    else if (isTransitionalStatus(service.status)) {
      const label = own.tone === 'info' ? 'Being scheduled' : own.label;
      entries.push({ ...base, tone: own.tone, label });
    } else {
      entries.push({ ...base, tone: 'neutral', label: 'Not deployed', hint: '', pulse: false });
    }
  }
  return entries;
}

/**
 * Whether a person has to act on the service. Built on the shared `serviceAttention`, so the board
 * and the overview's list cannot drift. The two differences: a service nobody deployed is shown
 * quietly in Unplaced rather than as something that needs attention, and an instance on an
 * unregistered cluster counts too, since only the board knows the cluster list.
 */
function attentionOf(service: Service, unplaced: readonly UnplacedEntry[]): AttentionNote | null {
  const attention = serviceAttention(service);
  if (attention?.kind === 'service') {
    const summary = isPlacementFailure(service.status) ? "can't be placed" : 'failed';
    return { tone: attention.tone, summary };
  }
  if (attention?.kind === 'instances') {
    const total = plural(service.instance_list.length, 'instance');
    return {
      tone: attention.tone === 'destructive' ? 'destructive' : 'warning',
      summary: `has ${attention.failing} of ${total} failing`,
    };
  }
  const lost = unplaced.some((entry) => entry.tone === 'warning');
  return lost ? { tone: 'warning', summary: 'is on an unknown cluster' } : null;
}

function severityOf(attention: AttentionNote | null, instances: readonly BoardInstance[]) {
  if (attention?.tone === 'destructive') return SEVERITY.failed;
  if (attention) return SEVERITY.degraded;
  return instances.some((entry) => entry.stale) ? SEVERITY.lastKnown : SEVERITY.normal;
}

function groupByCluster(instances: readonly BoardInstance[]): Map<string, BoardInstance[]> {
  const placements = new Map<string, BoardInstance[]>();
  for (const entry of instances) {
    if (entry.clusterId === undefined) continue;
    const onCluster = placements.get(entry.clusterId);
    if (onCluster) onCluster.push(entry);
    else placements.set(entry.clusterId, [entry]);
  }
  return placements;
}

function serviceRow(
  application: Application,
  service: Service,
  clusters: ReadonlyMap<string, ClusterReportState>,
): ServiceRow {
  const instances = service.instance_list.map((instance): BoardInstance => {
    const placed = isPlaced(instance, clusters);
    const clusterId = placed ? instance.cluster_id : undefined;
    return {
      key: instanceKey(service._id, instance.instance_number),
      instance,
      service,
      status: describeStatus(instance.status, instance.status_detail),
      clusterId,
      stale: clusterId !== undefined && isOffline(clusters.get(clusterId)),
    };
  });
  const unplaced = unplacedEntries(service, clusters);
  const attention = attentionOf(service, unplaced);
  return {
    service,
    application,
    instances,
    attention,
    unplaced,
    placements: groupByCluster(instances),
    severity: severityOf(attention, instances),
  };
}

function byUrgency<T extends { severity: Severity }>(name: (row: T) => string) {
  return (a: T, b: T) => a.severity - b.severity || byName(name(a), name(b));
}

/** Known to be running: on a reporting cluster with a healthy status, so never a last-known one. */
function runningInstances(rows: readonly ServiceRow[]): BoardInstance[] {
  return rows.flatMap((row) =>
    row.instances.filter(
      (entry) => entry.clusterId !== undefined && !entry.stale && entry.status.tone === 'success',
    ),
  );
}

function applicationRow(
  { application, services, servicesUnavailable = false }: BoardEntry,
  clusters: ReadonlyMap<string, ClusterReportState>,
): ApplicationRow {
  const rows = services
    .map((service) => serviceRow(application, service, clusters))
    .sort(byUrgency((row) => row.service.microservice_name));
  return {
    application,
    services: rows,
    serviceCount: rows.length,
    servicesUnavailable,
    severity: rows.reduce<Severity>(
      (worst, row) => (row.severity < worst ? row.severity : worst),
      SEVERITY.normal,
    ),
  };
}

function summarize(rows: readonly ApplicationRow[]): BoardSummary {
  const serviceRows = rows.flatMap((row) => row.services);
  const running = runningInstances(serviceRows);
  return {
    applications: rows.length,
    running: running.length,
    runningServices: new Set(running.map((entry) => entry.service._id)).size,
    runningClusters: new Set(running.map((entry) => entry.clusterId)).size,
    attention: serviceRows.filter((row) => row.attention).length,
  };
}

/**
 * The whole board as data: clusters in display order (reporting, then silent, then those that
 * never reported), rows worst first and the totals of the summary sentence. A cluster gets a card
 * only where an instance of the viewer sits, silent and never-reported ones included: that is where
 * the last-known state of their services is. Judged on the unfiltered rows, so the filter never
 * changes which clusters are idle.
 */
export function buildBoard({ entries, clusters }: BuildBoardInput): BoardModel {
  const all = clusterLanes(clusters);
  const states = new Map(all.map((lane) => [lane.id, lane.state]));
  const rows = entries
    .map((entry) => applicationRow(entry, states))
    .sort(byUrgency((row) => row.application.application_name));
  const occupied = new Set(
    rows.flatMap((row) => row.services.flatMap((service) => [...service.placements.keys()])),
  );
  return {
    lanes: all.filter((lane) => occupied.has(lane.id)),
    idleLanes: all.filter((lane) => !occupied.has(lane.id)),
    rows,
    summary: summarize(rows),
  };
}

/** Past this many names the line says "and N more". */
const IDLE_NAMES_SHOWN = 5;

export interface IdleClusters {
  /** The clusters the line names, in board order. */
  named: readonly ClusterLane[];
  /** How many more there are than named. */
  more: number;
  /** "3 more clusters run nothing of yours", without the names. */
  lead: string;
}

/**
 * The line below the board for clusters without a card, or null when there are none. One name over
 * the limit would read "and 1 more", which saves nothing, so the list is cut only from two on.
 */
export function describeIdleClusters(idle: readonly ClusterLane[]): IdleClusters | null {
  if (idle.length === 0) return null;
  const cut = idle.length - IDLE_NAMES_SHOWN >= 2;
  const verb = idle.length === 1 ? 'runs' : 'run';
  const noun = idle.length === 1 ? 'cluster' : 'clusters';
  return {
    named: cut ? idle.slice(0, IDLE_NAMES_SHOWN) : idle,
    more: cut ? idle.length - IDLE_NAMES_SHOWN : 0,
    lead: `${idle.length} more ${noun} ${verb} nothing of yours`,
  };
}

/** Marks a cluster in that line when its state is not normal: "silent", "never reported". */
export function idleClusterNote(lane: ClusterLane): string | null {
  return lane.state === 'reporting' ? null : clusterStateLabel(lane.state).toLowerCase();
}

/** The one sentence on top of the board. */
export function summarySentence(summary: BoardSummary): string {
  const { applications, running, runningServices, runningClusters, attention } = summary;
  const look =
    attention === 0
      ? 'nothing needs attention'
      : `${plural(attention, 'service')} ${attention === 1 ? 'needs' : 'need'} attention`;
  if (applications === 0) return 'You have no applications yet.';
  if (running === 0) return `Your applications have nothing running, and ${look}.`;
  const what = `${plural(running, 'instance')} of ${plural(runningServices, 'service')}`;
  return `Your applications run ${what} on ${plural(runningClusters, 'cluster')}, and ${look}.`;
}

export interface BoardFilter {
  query: string;
  onlyAttention: boolean;
}

function matches(needle: string, ...values: readonly (string | undefined)[]): boolean {
  return values.some((value) => value?.toLowerCase().includes(needle));
}

function needsAttention(row: { severity: Severity }): boolean {
  return row.severity < SEVERITY.normal;
}

/**
 * Narrows rows to what the toolbar asks for. A hit on the application keeps all its services; a hit
 * on a service keeps that service only.
 */
export function filterRows(
  rows: readonly ApplicationRow[],
  { query, onlyAttention }: BoardFilter,
): ApplicationRow[] {
  const needle = query.trim().toLowerCase();
  return rows.flatMap((row) => {
    const { application_name, application_namespace } = row.application;
    const appHit = matches(needle, application_name, application_namespace);
    const services = row.services.filter(
      (service) =>
        (appHit ||
          matches(
            needle,
            service.service.microservice_name,
            service.service.microservice_namespace,
          )) &&
        (!onlyAttention || needsAttention(service)),
    );
    if (onlyAttention ? services.length === 0 : !appHit && services.length === 0) return [];
    return [{ ...row, services }];
  });
}

export const LENSES = ['health', 'cpu', 'memory'] as const;
export type Lens = (typeof LENSES)[number];

export function parseLens(value: string): Lens {
  return LENSES.find((lens) => lens === value) ?? 'health';
}

/** What a row shows under the CPU or memory lens. Several instances show the highest one. */
export interface InstanceReading {
  /** Position on the 0 to 100 track, may exceed it. Null: there is no scale, only `label`. */
  value: number | null;
  label: string;
  /** Instances behind the reading. */
  count: number;
  /** The value spelled out, for labels. */
  detail: string;
}

function percentLabel(value: number): string {
  return formatPercent(value, value < 10 ? 1 : 0);
}

function cpuReading(measured: readonly BoardInstance[]): InstanceReading {
  const value = Math.max(...measured.map((entry) => entry.instance.cpu_percent ?? 0));
  const label = percentLabel(value);
  return { value, label, count: measured.length, detail: `${label} CPU` };
}

/**
 * `memory_percent` holds bytes despite its name. Only the limit of the service makes it a ratio; an
 * aggregate over services with and without one compares what can be compared.
 */
function memoryReading(measured: readonly BoardInstance[]): InstanceReading {
  const usage = measured.map(({ instance, service }) => {
    const bytes = instance.memory_percent ?? 0;
    const limit = service.memory && service.memory > 0 ? service.memory : undefined;
    return { bytes, limit, ratio: limit ? (bytes / (limit * BYTES_PER_MB)) * 100 : undefined };
  });
  const limited = usage.filter((entry) => entry.ratio !== undefined);
  const count = measured.length;
  if (limited.length === 0) {
    const label = formatBytes(Math.max(...usage.map((entry) => entry.bytes)));
    return { value: null, label, count, detail: `${label} memory` };
  }
  const top = limited.reduce((a, b) => ((b.ratio ?? 0) > (a.ratio ?? 0) ? b : a));
  const ratio = top.ratio ?? 0;
  return {
    value: ratio,
    label: percentLabel(ratio),
    count,
    detail: `${formatBytes(top.bytes)} of ${formatMegabytes(top.limit, 0)} memory`,
  };
}

/**
 * Null means "No data": nothing measured, or only instances whose numbers mean nothing. A silent
 * cluster's are too old to trust and a failed instance's are leftovers, which would read as idle.
 */
export function instanceReading(
  instances: readonly BoardInstance[],
  lens: Exclude<Lens, 'health'>,
): InstanceReading | null {
  const measured = instances.filter(
    (entry) => !entry.stale && !isAbnormalTone(entry.status.tone) && hasMetrics(entry.instance),
  );
  if (measured.length === 0) return null;
  return lens === 'cpu' ? cpuReading(measured) : memoryReading(measured);
}

/** Worst first, so with more instances than room the ones that matter stay visible. */
export function sortInstances(instances: readonly BoardInstance[]): BoardInstance[] {
  return [...instances].sort(
    (a, b) => compareTones(a.status.tone, b.status.tone) || Number(a.stale) - Number(b.stale),
  );
}

export function sortUnplaced(entries: readonly UnplacedEntry[]): UnplacedEntry[] {
  return [...entries].sort((a, b) => compareTones(a.tone, b.tone));
}

/** The status words of a row, for its accessible name: "2 Running, 1 Failed". */
export function describeInstances(instances: readonly BoardInstance[]): string {
  const counts = new Map<string, number>();
  for (const { status, stale } of sortInstances(instances)) {
    const label = stale ? `last known ${status.label}` : status.label;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => `${count} ${label}`).join(', ');
}

function instanceKey(serviceId: string, instanceNumber: number): string {
  return `${serviceId}:${instanceNumber}`;
}

/** Each application with only the services a card lists, narrowed like in `filterRows`. */
function narrowServices(
  rows: readonly ApplicationRow[],
  keep: (service: ServiceRow) => boolean,
): ApplicationRow[] {
  return rows.map((row) => ({ ...row, services: row.services.filter(keep) }));
}

/** What sits on one cluster. Takes filtered rows, so a card narrows along with the filter. */
export function clusterGroups(
  rows: readonly ApplicationRow[],
  clusterId: string,
): ApplicationRow[] {
  return narrowServices(rows, (service) => service.placements.has(clusterId)).filter(
    (row) => row.services.length > 0,
  );
}

/**
 * What the Unplaced card lists. An application with nothing to place stays in, empty: no cluster
 * would show it, and it would be gone from the board.
 */
export function unplacedGroups(rows: readonly ApplicationRow[]): ApplicationRow[] {
  return narrowServices(rows, (service) => service.unplaced.length > 0).filter(
    (row) => row.services.length > 0 || row.serviceCount === 0,
  );
}

/** `memory_in_mb` is what is still free, not the installed total. */
export function availableMemoryLabel({ memory_in_mb: available }: Cluster): string | undefined {
  return available === undefined ? undefined : `${formatMegabytes(available, 0)} available`;
}
