import {
  hasTransitionalInstance,
  type Service,
  type StatusTone as ApiStatusTone,
} from '@oakestra/api';
import type { StatusTone } from '@oakestra/ui';
import { useRef } from 'react';

// The pure helpers live in @oakestra/api so other packages can share them; this file keeps the
// import path the module already uses.
export {
  describeStatus,
  hasTransitionalInstance,
  instanceHost,
  instanceProblem,
  isAbnormalTone,
  isPlacementFailure,
  isTransitionalStatus,
  isUndeployed,
  serviceAttention,
  summarizeStatuses,
  type ServiceAttention,
  type StatusDescription,
  type StatusSummary,
} from '@oakestra/api';
export type { StatusTone };

// The api package cannot import @oakestra/ui, so its tone union is a copy. Fails to compile when
// either side gains or loses a tone.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _tonesMatch: Equal<ApiStatusTone, StatusTone> = true;
void _tonesMatch;

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
