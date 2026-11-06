import {
  clusterReportState,
  describeStatus,
  instanceProblem,
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

/** `all`: an Admin looking at every application. `own`: the current user's applications. */
export type FleetScope = 'all' | 'own';

export interface FleetEntry {
  application: Application;
  services: readonly Service[];
  /** The services of this application could not be loaded, so `services` says nothing. */
  servicesUnavailable?: boolean;
}

export interface BuildFleetInput {
  entries: readonly FleetEntry[];
  clusters: readonly Cluster[];
  scope: FleetScope;
  username: string | null;
}

/** One instance as the board sees it. */
export interface FleetInstance {
  /** Instances have no id of their own: the service id plus `instance_number` identifies them. */
  key: string;
  instance: Instance;
  service: Service;
  applicationName: string;
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

export interface ServiceException {
  tone: 'destructive' | 'warning';
  /** Finishes the sentence "<application> / <service> ...". */
  summary: string;
  detail: string;
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
  instances: readonly FleetInstance[];
  /** Placed instances by cluster id. */
  placements: ReadonlyMap<string, readonly FleetInstance[]>;
  unplaced: readonly UnplacedEntry[];
  severity: Severity;
  exception: ServiceException | null;
}

export interface ApplicationRow {
  application: Application;
  severity: Severity;
  /** Username of the owner when known. */
  owner: string | undefined;
  /**
   * Detail endpoints answer 404 for anyone but the owner, also for an Admin, so a row of someone
   * else's application may not link to its pages.
   */
  owned: boolean;
  /** Narrowed by `filterRows`, so `serviceCount` is what the application really has. */
  services: readonly ServiceRow[];
  serviceCount: number;
  servicesUnavailable: boolean;
}

/** A cluster and what the board puts on its card. */
export interface ClusterLane {
  cluster: Cluster;
  id: string;
  name: string;
  state: ClusterReportState;
  instances: readonly FleetInstance[];
}

export interface FleetException {
  key: string;
  tone: 'destructive' | 'warning' | 'stale';
  title: string;
  detail: string;
  selection: string;
  /** When the state began, as far as the backend tells: only clusters have a timestamp. */
  since?: Date;
}

export interface FleetSummary {
  scope: FleetScope;
  applications: number;
  services: number;
  /** Instances known to run right now, so never those on a silent cluster. */
  running: number;
  /** Services and clusters those running instances belong to. */
  runningServices: number;
  runningClusters: number;
  lastKnown: number;
  reportingClusters: number;
  silentClusters: number;
  exceptions: number;
}

export interface FleetModel {
  lanes: readonly ClusterLane[];
  rows: readonly ApplicationRow[];
  exceptions: readonly FleetException[];
  summary: FleetSummary;
}

const REPORT_ORDER: Record<ClusterReportState, number> = {
  reporting: 0,
  silent: 1,
  'never-reported': 2,
};

const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' });

function isOffline(state: ClusterReportState | undefined): boolean {
  return state === 'silent' || state === 'never-reported';
}

function clusterLanes(clusters: readonly Cluster[]): Omit<ClusterLane, 'instances'>[] {
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
 * The scheduler leaves this text behind on services it has long given up on, where it would
 * contradict the failure right next to it.
 */
const SCHEDULER_PLACEHOLDER = 'Waiting for scheduling decision';

function schedulerDetail({ status_detail }: Service): string | undefined {
  return status_detail && status_detail !== SCHEDULER_PLACEHOLDER ? status_detail : undefined;
}

/**
 * Whether a person has to act on the service. Built on the shared `serviceAttention`, so this list
 * and the overview's cannot drift. The two differences: a service nobody deployed is shown quietly
 * in Unplaced rather than as an exception, and an instance on an unregistered cluster counts too,
 * since only this view knows the cluster list.
 */
function serviceException(
  service: Service,
  unplaced: readonly UnplacedEntry[],
): ServiceException | null {
  const attention = serviceAttention(service);
  if (attention?.kind === 'service') {
    const own = describeStatus(service.status, service.status_detail);
    if (isPlacementFailure(service.status)) {
      return {
        tone: attention.tone,
        summary: "can't be placed",
        detail: schedulerDetail(service) ?? own.hint,
      };
    }
    // The service's own detail tends to be the scheduler's; why it failed is on the instance.
    const crashed = service.instance_list.map(instanceProblem).find(Boolean);
    return {
      tone: attention.tone,
      summary: 'failed',
      detail: crashed ?? schedulerDetail(service) ?? own.hint,
    };
  }
  if (attention?.kind === 'instances') {
    const total = plural(service.instance_list.length, 'instance');
    return {
      tone: attention.tone === 'destructive' ? 'destructive' : 'warning',
      summary: `has ${attention.failing} of ${total} failing`,
      detail: attention.detail ?? describeStatus(attention.status).label,
    };
  }
  const lost = unplaced.find((entry) => entry.tone === 'warning');
  return lost ? { tone: 'warning', summary: 'is on an unknown cluster', detail: lost.hint } : null;
}

function severityOf(exception: ServiceException | null, instances: readonly FleetInstance[]) {
  if (exception?.tone === 'destructive') return SEVERITY.failed;
  if (exception) return SEVERITY.degraded;
  return instances.some((entry) => entry.stale) ? SEVERITY.lastKnown : SEVERITY.normal;
}

function groupByCluster(instances: readonly FleetInstance[]): Map<string, FleetInstance[]> {
  const placements = new Map<string, FleetInstance[]>();
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
  const instances = service.instance_list.map((instance): FleetInstance => {
    const placed = isPlaced(instance, clusters);
    const clusterId = placed ? instance.cluster_id : undefined;
    return {
      key: instanceKey(service._id, instance.instance_number),
      instance,
      service,
      applicationName: application.application_name,
      status: describeStatus(instance.status, instance.status_detail),
      clusterId,
      stale: clusterId !== undefined && isOffline(clusters.get(clusterId)),
    };
  });
  const unplaced = unplacedEntries(service, clusters);
  const exception = serviceException(service, unplaced);
  return {
    service,
    application,
    instances,
    exception,
    unplaced,
    placements: groupByCluster(instances),
    severity: severityOf(exception, instances),
  };
}

function byUrgency<T extends { severity: Severity }>(name: (row: T) => string) {
  return (a: T, b: T) => a.severity - b.severity || byName(name(a), name(b));
}

/** Known to be running: on a reporting cluster with a healthy status, so never a last-known one. */
function runningInstances(rows: readonly ServiceRow[]): FleetInstance[] {
  return rows.flatMap((row) =>
    row.instances.filter(
      (entry) => entry.clusterId !== undefined && !entry.stale && entry.status.tone === 'success',
    ),
  );
}

function applicationRow(
  { application, services, servicesUnavailable = false }: FleetEntry,
  clusters: ReadonlyMap<string, ClusterReportState>,
  scope: FleetScope,
  username: string | null,
): ApplicationRow {
  const rows = services
    .map((service) => serviceRow(application, service, clusters))
    .sort(byUrgency((row) => row.service.microservice_name));
  return {
    application,
    owner: application.userId,
    // The per-user endpoint only returns the caller's applications, whatever `userId` says.
    owned: scope === 'own' || application.userId === username,
    services: rows,
    serviceCount: rows.length,
    servicesUnavailable,
    severity: rows.reduce<Severity>(
      (worst, row) => (row.severity < worst ? row.severity : worst),
      SEVERITY.normal,
    ),
  };
}

function fleetExceptions(
  rows: readonly ApplicationRow[],
  lanes: readonly ClusterLane[],
  scope: FleetScope,
): FleetException[] {
  const services = rows.flatMap((row) =>
    row.services.flatMap(({ application, service, exception }): FleetException[] =>
      exception
        ? [
            {
              key: service._id,
              tone: exception.tone,
              title: `${application.application_name} / ${service.microservice_name} ${exception.summary}`,
              detail: exception.detail,
              selection: serviceSelection(service._id),
            },
          ]
        : [],
    ),
  );
  const silent = lanes
    .filter((lane) => lane.state === 'silent')
    .map((lane): FleetException => ({
      key: lane.id,
      tone: 'stale',
      title: `${lane.name} is silent`,
      detail:
        lane.instances.length > 0
          ? `${plural(lane.instances.length, 'instance')} last seen there.`
          : scope === 'all'
            ? 'Nothing was running there.'
            : 'Nothing of yours was running there.',
      selection: clusterSelection(lane.id),
      since: lane.cluster.last_modified_timestamp,
    }));
  const rank = { destructive: 0, warning: 1, stale: 2 };
  // Array.sort is stable: within a severity the rows' order, worst application first, is kept.
  return [...services, ...silent].sort((a, b) => rank[a.tone] - rank[b.tone]);
}

function summarize(
  rows: readonly ApplicationRow[],
  lanes: readonly ClusterLane[],
  scope: FleetScope,
  exceptions: number,
): FleetSummary {
  const serviceRows = rows.flatMap((row) => row.services);
  const running = runningInstances(serviceRows);
  return {
    scope,
    applications: rows.length,
    services: serviceRows.length,
    running: running.length,
    runningServices: new Set(running.map((entry) => entry.service._id)).size,
    runningClusters: new Set(running.map((entry) => entry.clusterId)).size,
    lastKnown: serviceRows.flatMap((row) => row.instances).filter((entry) => entry.stale).length,
    reportingClusters: lanes.filter((lane) => lane.state === 'reporting').length,
    silentClusters: lanes.filter((lane) => isOffline(lane.state)).length,
    exceptions,
  };
}

/**
 * The whole view as data: clusters in display order (reporting, then silent, then those that never
 * reported), rows worst first, the exceptions and the totals of the summary sentence.
 */
export function buildFleet({ entries, clusters, scope, username }: BuildFleetInput): FleetModel {
  const sorted = clusterLanes(clusters);
  const states = new Map(sorted.map((lane) => [lane.id, lane.state]));
  const rows = entries
    .map((entry) => applicationRow(entry, states, scope, username))
    .sort(byUrgency((row) => row.application.application_name));
  const lanes = sorted.map((lane): ClusterLane => ({
    ...lane,
    instances: rows.flatMap((row) =>
      row.services.flatMap((service) => service.placements.get(lane.id) ?? []),
    ),
  }));
  const exceptions = fleetExceptions(rows, lanes, scope);
  return {
    lanes,
    rows,
    exceptions,
    summary: summarize(rows, lanes, scope, exceptions.length),
  };
}

/** The one sentence on top of the page. It says its scope, because an Admin sees everyone's. */
export function summarySentence(summary: FleetSummary): string {
  const { scope, applications, running, runningServices, runningClusters, exceptions } = summary;
  const subject = scope === 'all' ? 'All applications' : 'Your applications';
  const look =
    exceptions === 0
      ? 'nothing needs a look'
      : `${plural(exceptions, 'thing')} ${exceptions === 1 ? 'needs' : 'need'} a look`;
  if (applications === 0) {
    const none = scope === 'all' ? 'There are no applications yet' : 'You have no applications yet';
    return exceptions === 0 ? `${none}.` : `${none}, and ${look}.`;
  }
  if (running === 0) return `${subject} have nothing running, and ${look}.`;
  const what = `${plural(running, 'instance')} of ${plural(runningServices, 'service')}`;
  return `${subject} run ${what} on ${plural(runningClusters, 'cluster')}, and ${look}.`;
}

export interface FleetFilter {
  query: string;
  onlyExceptions: boolean;
}

function matches(needle: string, ...values: readonly (string | undefined)[]): boolean {
  return values.some((value) => value?.toLowerCase().includes(needle));
}

function isException(row: { severity: Severity }): boolean {
  return row.severity < SEVERITY.normal;
}

/**
 * Narrows rows to what the toolbar asks for. A hit on the application keeps all its services; a hit
 * on a service keeps that service only.
 */
export function filterRows(
  rows: readonly ApplicationRow[],
  { query, onlyExceptions }: FleetFilter,
): ApplicationRow[] {
  const needle = query.trim().toLowerCase();
  return rows.flatMap((row) => {
    const { application_name, application_namespace } = row.application;
    const appHit = matches(needle, application_name, application_namespace, row.owner);
    const services = row.services.filter(
      (service) =>
        (appHit ||
          matches(
            needle,
            service.service.microservice_name,
            service.service.microservice_namespace,
          )) &&
        (!onlyExceptions || isException(service)),
    );
    if (onlyExceptions ? services.length === 0 : !appHit && services.length === 0) return [];
    return [{ ...row, services }];
  });
}

export const LENSES = ['health', 'cpu', 'memory'] as const;
export type Lens = (typeof LENSES)[number];

export function parseLens(value: string): Lens {
  return LENSES.find((lens) => lens === value) ?? 'health';
}

/** Same rule as the service page: without any history a 0 means "not measured", not "idle". */
function hasMetrics(instance: Instance): boolean {
  return (
    (instance.cpu_history?.length ?? 0) > 0 ||
    (instance.cpu_percent ?? 0) > 0 ||
    (instance.memory_percent ?? 0) > 0
  );
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

function cpuReading(measured: readonly FleetInstance[]): InstanceReading {
  const value = Math.max(...measured.map((entry) => entry.instance.cpu_percent ?? 0));
  const label = percentLabel(value);
  return { value, label, count: measured.length, detail: `${label} CPU` };
}

/**
 * `memory_percent` holds bytes despite its name. Only the limit of the service makes it a ratio; an
 * aggregate over services with and without one compares what can be compared.
 */
function memoryReading(measured: readonly FleetInstance[]): InstanceReading {
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
  instances: readonly FleetInstance[],
  lens: Exclude<Lens, 'health'>,
): InstanceReading | null {
  const measured = instances.filter(
    (entry) => !entry.stale && !isAbnormalTone(entry.status.tone) && hasMetrics(entry.instance),
  );
  if (measured.length === 0) return null;
  return lens === 'cpu' ? cpuReading(measured) : memoryReading(measured);
}

const TONE_ORDER: Record<StatusTone, number> = {
  destructive: 0,
  warning: 1,
  info: 2,
  success: 3,
  neutral: 4,
};

/** Worst first, so with more instances than room the ones that matter stay visible. */
export function sortInstances(instances: readonly FleetInstance[]): FleetInstance[] {
  return [...instances].sort(
    (a, b) =>
      TONE_ORDER[a.status.tone] - TONE_ORDER[b.status.tone] || Number(a.stale) - Number(b.stale),
  );
}

export function sortUnplaced(entries: readonly UnplacedEntry[]): UnplacedEntry[] {
  return [...entries].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

/** The status words of a row, for its accessible name: "2 Running, 1 Failed". */
export function describeInstances(instances: readonly FleetInstance[]): string {
  const counts = new Map<string, number>();
  for (const { status, stale } of sortInstances(instances)) {
    const label = stale ? `last known ${status.label}` : status.label;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => `${count} ${label}`).join(', ');
}

export function instanceKey(serviceId: string, instanceNumber: number): string {
  return `${serviceId}:${instanceNumber}`;
}

export const serviceSelection = (serviceId: string) => `service:${serviceId}`;
export const instanceSelection = (serviceId: string, instanceNumber: number) =>
  `service:${instanceKey(serviceId, instanceNumber)}`;
export const clusterSelection = (clusterId: string) => `cluster:${clusterId}`;

/** What a row of a cluster card selects: its one instance, or the service if there are several. */
export function placementSelection(serviceId: string, instances: readonly FleetInstance[]): string {
  const [only, ...others] = instances;
  return only && others.length === 0
    ? instanceSelection(serviceId, only.instance.instance_number)
    : serviceSelection(serviceId);
}

/**
 * Whether the inspector shows what a row stands for. The inspector can be on the service or walk to
 * one of its instances, so comparing with `placementSelection` alone would lose the highlight.
 */
export function isRowSelected(
  selection: string,
  serviceId: string,
  instances: readonly FleetInstance[],
): boolean {
  return (
    selection === serviceSelection(serviceId) ||
    instances.some(
      ({ service, instance }) =>
        selection === instanceSelection(service._id, instance.instance_number),
    )
  );
}

/** One application on a card of the board. */
export interface BoardGroup {
  application: ApplicationRow;
  services: readonly ServiceRow[];
}

function groupsOf(
  rows: readonly ApplicationRow[],
  keep: (service: ServiceRow) => boolean,
): BoardGroup[] {
  return rows.map((application) => ({
    application,
    services: application.services.filter(keep),
  }));
}

/** What sits on one cluster. Takes filtered rows, so a card narrows along with the filter. */
export function clusterGroups(rows: readonly ApplicationRow[], clusterId: string): BoardGroup[] {
  return groupsOf(rows, (service) => service.placements.has(clusterId)).filter(
    (group) => group.services.length > 0,
  );
}

/**
 * What the Unplaced card lists. An application with nothing to place stays in, empty: no cluster
 * would show it, and it would be gone from the board.
 */
export function unplacedGroups(rows: readonly ApplicationRow[]): BoardGroup[] {
  return groupsOf(rows, (service) => service.unplaced.length > 0).filter(
    (group) => group.services.length > 0 || group.application.serviceCount === 0,
  );
}

export type InspectorTarget =
  | { kind: 'service'; application: ApplicationRow; row: ServiceRow }
  | { kind: 'instance'; application: ApplicationRow; row: ServiceRow; entry: FleetInstance }
  | { kind: 'cluster'; lane: ClusterLane };

/**
 * Resolves the `select` search param. An instance that is gone falls back to its service, so
 * undeploying one does not slam the inspector shut. Anything unknown closes it.
 */
export function resolveSelection(fleet: FleetModel, selection: string): InspectorTarget | null {
  const [kind, id, instanceNumber] = selection.split(':');
  if (kind === 'cluster') {
    const lane = fleet.lanes.find((candidate) => candidate.id === id);
    return lane ? { kind: 'cluster', lane } : null;
  }
  if (kind !== 'service') return null;
  for (const application of fleet.rows) {
    const row = application.services.find((candidate) => candidate.service._id === id);
    if (!row) continue;
    const entry = row.instances.find(
      (candidate) => String(candidate.instance.instance_number) === instanceNumber,
    );
    return entry
      ? { kind: 'instance', application, row, entry }
      : { kind: 'service', application, row };
  }
  return null;
}

/** What a service asks for, as in "1 vCPU, 64 MB". */
export function serviceRequests({ vcpus, memory, vgpus }: Service): string {
  return [
    vcpus ? `${vcpus} vCPU` : '',
    memory ? formatMegabytes(memory, 0) : '',
    vgpus ? `${vgpus} vGPU` : '',
  ]
    .filter(Boolean)
    .join(', ');
}
