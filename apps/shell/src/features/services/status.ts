import type { Instance, Service } from '@oakestra/api';
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

export type StatusTone = 'success' | 'pending' | 'danger' | 'neutral';

export function statusTone(status: string | undefined): StatusTone {
  if (!status) return 'neutral';
  const upper = status.toUpperCase();
  if (upper === 'RUNNING' || upper === 'COMPLETED') return 'success';
  if (isTransitionalStatus(upper)) return 'pending';
  if (upper === 'FAILED' || upper === 'DEAD' || upper.startsWith('NO') || upper.includes('ERROR')) {
    return 'danger';
  }
  return 'neutral';
}

/** Summary of a service's instances, e.g. "2 running, 1 pending". */
export function instanceCounts(instances: readonly Instance[]) {
  let running = 0;
  let pending = 0;
  let failed = 0;
  for (const instance of instances) {
    const tone = statusTone(instance.status);
    if (tone === 'success') running += 1;
    else if (tone === 'pending') pending += 1;
    else if (tone === 'danger') failed += 1;
  }
  return { total: instances.length, running, pending, failed };
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
