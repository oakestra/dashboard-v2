import type { Service } from '@oakestra/api';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  hasTransitionalInstance,
  isTransitionalStatus,
  statusTone,
  usePollWhileTransitional,
} from './status';

function service(status: string | undefined, instances: string[] = []): Service {
  return {
    status,
    instance_list: instances.map((instance, index) => ({
      instance_number: index,
      status: instance,
    })),
  } as unknown as Service;
}

describe('transitional statuses', () => {
  it.each(['REQUESTED', 'CLUSTER_SCHEDULED', 'NODE_SCHEDULED', 'INSTANTIATION', 'creating'])(
    '%s is transitional',
    (status) => {
      expect(isTransitionalStatus(status)).toBe(true);
      expect(statusTone(status)).toBe('pending');
    },
  );

  it.each(['RUNNING', 'FAILED', 'NoActiveClusterWithCapacity', 'SOMETHING_NEW', undefined])(
    '%s is final',
    (status) => {
      expect(isTransitionalStatus(status)).toBe(false);
    },
  );

  it('looks at the service status as well as its instances', () => {
    expect(hasTransitionalInstance([service('RUNNING', ['RUNNING'])])).toBe(false);
    expect(hasTransitionalInstance([service('RUNNING', ['RUNNING', 'INSTANTIATION'])])).toBe(true);
    // Right after a deploy request the backend has no instance yet, only the service status.
    expect(hasTransitionalInstance([service('REQUESTED')])).toBe(true);
    expect(hasTransitionalInstance([])).toBe(false);
  });
});

describe('usePollWhileTransitional', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const query = (data: Service | Service[] | undefined) => ({ state: { data } });

  it('polls every 3 seconds while something is transitional and stops once it settles', () => {
    const { result } = renderHook(() => usePollWhileTransitional());

    expect(result.current(query([service('RUNNING', ['STARTING'])]))).toBe(3_000);
    expect(result.current(query([service('RUNNING', ['RUNNING'])]))).toBe(false);
  });

  it('accepts a single service and no data', () => {
    const { result } = renderHook(() => usePollWhileTransitional());

    expect(result.current(query(service('REQUESTED')))).toBe(3_000);
    expect(result.current(query(undefined))).toBe(false);
  });

  it('keeps the idle interval while nothing is transitional', () => {
    const { result } = renderHook(() => usePollWhileTransitional(10_000));

    expect(result.current(query([service('RUNNING', ['RUNNING'])]))).toBe(10_000);
  });

  it('gives up after five minutes and starts over once the service settled in between', () => {
    const { result } = renderHook(() => usePollWhileTransitional());
    const stuck = query([service('REQUESTED')]);

    expect(result.current(stuck)).toBe(3_000);
    vi.advanceTimersByTime(5 * 60_000);
    expect(result.current(stuck)).toBe(3_000);
    vi.advanceTimersByTime(1_000);
    expect(result.current(stuck)).toBe(false);

    // A settled response resets the clock, so the next transition polls again.
    expect(result.current(query([service('RUNNING', ['RUNNING'])]))).toBe(false);
    expect(result.current(stuck)).toBe(3_000);
  });
});
