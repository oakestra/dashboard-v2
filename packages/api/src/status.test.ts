import { describe, expect, it } from 'vitest';

import type { Service } from './models/service.ts';
import { describeStatus, isPlacementFailure, serviceAttention } from './status.ts';

function service(status: string | undefined, instances: string[] = []): Service {
  return {
    status,
    instance_list: instances.map((instance, index) => ({
      instance_number: index,
      status: instance,
    })),
  } as unknown as Service;
}

describe('isPlacementFailure', () => {
  it.each([
    'NoActiveClusterWithCapacity',
    'NO_WORKER_CAPACITY',
    'NoWorkerCapacity',
    'NO_QUALIFIED_WORKER_FOUND',
    'NO_NODE_FOUND',
    'TargetClusterNotFound',
    'TargetClusterNotActive',
    'TargetClusterNoCapacity',
  ])('%s is a placement failure', (status) => {
    expect(isPlacementFailure(status)).toBe(true);
    expect(describeStatus(status).tone).toBe('warning');
  });

  it.each(['NODE_SCHEDULED', 'NOTHING', 'RUNNING', 'FAILED', undefined])('%s is not', (status) => {
    expect(isPlacementFailure(status)).toBe(false);
  });

  it('words target cluster reasons separately', () => {
    expect(describeStatus('TargetClusterNotActive').label).toBe('Target cluster not active');
    expect(describeStatus('TargetClusterNotFound').label).not.toBe(
      describeStatus('TargetClusterNotActive').label,
    );
  });
});

describe('serviceAttention', () => {
  it('reports a placement failure of the service itself', () => {
    expect(serviceAttention(service('NO_WORKER_CAPACITY'))).toMatchObject({
      kind: 'service',
      tone: 'warning',
    });
  });

  it('reports failing instances of a healthy service', () => {
    expect(serviceAttention(service('RUNNING', ['RUNNING', 'FAILED', 'DEAD']))).toMatchObject({
      kind: 'instances',
      tone: 'destructive',
      failing: 2,
      status: 'FAILED',
    });
  });

  it('flags undeployed services but not ones being scheduled or running', () => {
    expect(serviceAttention(service(undefined))?.kind).toBe('undeployed');
    expect(serviceAttention(service('REQUESTED'))).toBeNull();
    expect(serviceAttention(service('RUNNING', ['RUNNING']))).toBeNull();
  });
});
