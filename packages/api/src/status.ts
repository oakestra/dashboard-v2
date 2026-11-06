import type { Instance, Service } from './models/service.ts';

/**
 * Same five meanings as `StatusTone` in `@oakestra/ui`. `@oakestra/api` may not import the UI
 * package, so the union is repeated here and the applications module checks at compile time that
 * the two stay equal.
 */
export type StatusTone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral';

/**
 * Statuses a scheduler is still working on. Anything else (RUNNING, FAILED, COMPLETED,
 * NoActiveClusterWithCapacity, ...) is final until the user acts, so unknown values are not
 * polled: a status we never heard of must not keep a tab hammering the API forever.
 */
const TRANSITIONAL = new Set([
  'REQUESTED',
  'SCHEDULED',
  'CLUSTER_SCHEDULED',
  'NODE_SCHEDULED',
  'INSTANTIATION',
  'CREATED',
  'CREATING',
  'DEPLOYING',
  'STARTING',
  'UNDEPLOY_REQUESTED',
  'TERMINATING',
]);

export function isTransitionalStatus(status: string | undefined): boolean {
  return status !== undefined && TRANSITIONAL.has(status.toUpperCase());
}

export function hasTransitionalInstance(services: readonly Service[]): boolean {
  return services.some(
    (service) =>
      service.instance_list.some((instance) => isTransitionalStatus(instance.status)) ||
      isTransitionalStatus(service.status),
  );
}

export interface StatusDescription {
  tone: StatusTone;
  label: string;
  /** Tooltip or sub-line; empty when the label says it all. */
  hint: string;
  /** The state is changing right now, so the badge pulses. */
  pulse: boolean;
}

const SCHEDULING = new Set(['SCHEDULED', 'CLUSTER_SCHEDULED', 'NODE_SCHEDULED']);
const STARTING = new Set(['INSTANTIATION', 'CREATED', 'CREATING', 'DEPLOYING', 'STARTING']);
const STOPPING = new Set(['UNDEPLOY_REQUESTED', 'TERMINATING']);

/**
 * The scheduler's negative results (`NegativeSchedulingStatus` in oakestra_utils), keyed without
 * case and underscores: the service shows `NoActiveClusterWithCapacity` and `TargetCluster*`
 * in camel case but `NO_WORKER_CAPACITY` in screaming snake case, and older fixtures mix both.
 * An explicit list instead of a `NO` prefix, which would also match `NODE_SCHEDULED`.
 */
const PLACEMENT_FAILURES: Record<string, { label: string; hint: string }> = {
  TARGETCLUSTERNOTFOUND: {
    label: 'Target cluster not found',
    hint: 'The cluster named in the service constraints does not exist',
  },
  TARGETCLUSTERNOTACTIVE: {
    label: 'Target cluster not active',
    hint: 'The cluster named in the service constraints is not reporting',
  },
  TARGETCLUSTERNOCAPACITY: {
    label: 'Target cluster full',
    hint: 'The cluster named in the service constraints cannot fit this service',
  },
  NOACTIVECLUSTERWITHCAPACITY: {
    label: 'No capacity',
    hint: "No active cluster can fit this service's requirements",
  },
  NOWORKERCAPACITY: {
    label: 'No capacity',
    hint: 'The chosen cluster has no worker with enough free resources',
  },
  NOQUALIFIEDWORKERFOUND: {
    label: 'No suitable worker',
    hint: 'No worker in the chosen cluster meets the service requirements',
  },
  NONODEFOUND: {
    label: 'No node found',
    hint: 'The chosen cluster has no node to run this service',
  },
};

function placementFailure(status: string): { label: string; hint: string } | undefined {
  return PLACEMENT_FAILURES[status.toUpperCase().replaceAll('_', '')];
}

/** The scheduler could not place the service anywhere (as opposed to a deploy that crashed). */
export function isPlacementFailure(status: string | undefined): boolean {
  return status !== undefined && placementFailure(status) !== undefined;
}

/**
 * The one place backend service and instance states become tone, label and hint. `detail` is the
 * backend's `status_detail`, used as the hint of failures.
 */
export function describeStatus(status: string | undefined, detail?: string): StatusDescription {
  if (!status) return { tone: 'neutral', label: 'Not deployed', hint: '', pulse: false };
  const upper = status.toUpperCase();
  const make = (tone: StatusTone, label: string, hint = '', pulse = false): StatusDescription => ({
    tone,
    label,
    hint,
    pulse,
  });

  if (upper === 'RUNNING') return make('success', 'Running');
  if (upper === 'COMPLETED') return make('success', 'Completed', 'Finished (one-shot service)');
  if (upper === 'REQUESTED') return make('info', 'Requested', 'Waiting for the scheduler', true);
  if (SCHEDULING.has(upper)) return make('info', 'Scheduling', '', true);
  if (STARTING.has(upper)) return make('info', 'Starting', '', true);
  if (STOPPING.has(upper)) return make('neutral', 'Stopping', '', true);
  if (upper === 'DEAD') return make('destructive', 'Crashed', detail ?? '');
  if (upper === 'FAILED' || upper.includes('ERROR')) {
    return make('destructive', 'Failed', detail ?? '');
  }
  const placement = placementFailure(status);
  if (placement) return make('warning', placement.label, placement.hint);
  return make('neutral', status);
}

/**
 * A service with nothing running and nothing on the way. Right after a deploy request the service
 * is REQUESTED with an empty `instance_list` (the instance appears only once it is scheduled), so
 * an empty list alone does not mean undeployed.
 */
export function isUndeployed(service: Service): boolean {
  return service.instance_list.length === 0 && !isTransitionalStatus(service.status);
}

/** `ip:port`, or just the IP when the instance exposes no port. */
export function instanceHost(instance: Instance): string | undefined {
  const { host_ip, host_port } = instance;
  if (!host_ip) return undefined;
  return host_port ? `${host_ip}:${host_port}` : host_ip;
}

/**
 * The scheduler message worth showing for an instance. A running instance keeps its last
 * scheduler message, which next to a green badge would contradict it.
 */
export function instanceProblem(instance: Instance): string | undefined {
  const { status, status_detail } = instance;
  return status_detail && describeStatus(status).tone !== 'success' ? status_detail : undefined;
}

/** Tones that mean something is wrong, as opposed to working, waiting or idle. */
export function isAbnormalTone(tone: StatusTone): tone is 'destructive' | 'warning' {
  return tone === 'destructive' || tone === 'warning';
}

export type ServiceAttention =
  /** The service itself failed or could not be placed. */
  | {
      kind: 'service';
      tone: 'destructive' | 'warning';
      status: string | undefined;
      detail: string | undefined;
    }
  /** The service looks fine but some of its instances failed. */
  | {
      kind: 'instances';
      tone: StatusTone;
      status: string | undefined;
      detail: string | undefined;
      failing: number;
    }
  /** Nothing running and nothing on the way. */
  | { kind: 'undeployed'; tone: 'neutral'; status: undefined; detail: undefined };

/**
 * Whether a service needs a person, and why. The scheduler giving up or a failed service comes
 * first, then failed instances (reported by the first one), then a service nobody deployed. A
 * service that is merely being scheduled needs nothing, it resolves on its own.
 */
export function serviceAttention(service: Service): ServiceAttention | null {
  const own = describeStatus(service.status, service.status_detail);
  if (isAbnormalTone(own.tone)) {
    return {
      kind: 'service',
      tone: own.tone,
      status: service.status,
      detail: service.status_detail,
    };
  }
  const failing = service.instance_list.filter((instance) =>
    isAbnormalTone(describeStatus(instance.status).tone),
  );
  const worst = failing[0];
  if (worst) {
    return {
      kind: 'instances',
      tone: describeStatus(worst.status, worst.status_detail).tone,
      status: worst.status,
      detail: worst.status_detail,
      failing: failing.length,
    };
  }
  if (isUndeployed(service)) {
    return { kind: 'undeployed', tone: 'neutral', status: undefined, detail: undefined };
  }
  return null;
}

const TONE_RANK: Record<StatusTone, number> = {
  destructive: 4,
  warning: 3,
  info: 2,
  success: 1,
  neutral: 0,
};

export interface StatusSummary {
  /** The worst tone present (destructive > warning > info > success > neutral); neutral when empty. */
  tone: StatusTone;
  total: number;
  running: number;
  pending: number;
  failed: number;
  other: number;
}

/** Folds several service (or instance) statuses into one, e.g. for an application. */
export function summarizeStatuses(statuses: readonly (string | undefined)[]): StatusSummary {
  const summary: StatusSummary = {
    tone: 'neutral',
    total: statuses.length,
    running: 0,
    pending: 0,
    failed: 0,
    other: 0,
  };
  for (const status of statuses) {
    const { tone, pulse } = describeStatus(status);
    if (tone === 'success') summary.running += 1;
    else if (tone === 'info' || pulse) summary.pending += 1;
    else if (isAbnormalTone(tone)) summary.failed += 1;
    else summary.other += 1;
    if (TONE_RANK[tone] > TONE_RANK[summary.tone]) summary.tone = tone;
  }
  return summary;
}
