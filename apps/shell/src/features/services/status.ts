import type { Instance, Service } from '@oakestra/api';
import type { StatusTone } from '@oakestra/ui';
import { useRef } from 'react';

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

export type { StatusTone };

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
  if (upper.startsWith('NO')) {
    return make('warning', 'No capacity', "No active cluster can fit this service's requirements");
  }
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
    else if (tone === 'destructive' || tone === 'warning') summary.failed += 1;
    else summary.other += 1;
    if (TONE_RANK[tone] > TONE_RANK[summary.tone]) summary.tone = tone;
  }
  return summary;
}

const POLL_MS = 3_000;
const POLL_LIMIT_MS = 5 * 60_000;

/**
 * `refetchInterval` for service queries: polls while an instance is in a transitional state and
 * gives up after five minutes of that, so a stuck scheduler does not poll forever. `idleInterval`
 * is the cadence when nothing is transitional (false = stop, as for lists; the instance page keeps
 * refreshing its metrics and logs).
 */
export function usePollWhileTransitional(idleInterval: number | false = false) {
  const since = useRef<number | null>(null);
  return (query: { state: { data: Service | Service[] | undefined } }): number | false => {
    const data = query.state.data;
    const services = data === undefined ? [] : Array.isArray(data) ? data : [data];
    if (!hasTransitionalInstance(services)) {
      since.current = null;
      return idleInterval;
    }
    since.current ??= Date.now();
    return Date.now() - since.current > POLL_LIMIT_MS ? idleInterval : POLL_MS;
  };
}

/** The backend says `docker`, the creation form says "Container". */
export function formatVirtualization(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower === 'docker' || lower === 'container') return 'Container';
  if (lower === 'unikernel') return 'Unikernel';
  if (lower === 'vm') return 'VM';
  return value;
}
