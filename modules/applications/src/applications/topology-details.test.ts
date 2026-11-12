import type { Cluster, Service } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import { resolveTopologyNode, summarizeSelection } from './topology-details';

const cluster = (id: string, name: string, active = true) =>
  ({ _id: id, cluster_name: name, active, last_modified_timestamp: new Date() }) as Cluster;

const service = (id: string, name: string, extra: Partial<Service> = {}) =>
  ({
    _id: id,
    microservice_name: name,
    instance_list: [],
    connectivity: [],
    ...extra,
  }) as unknown as Service;

const running = (cluster_id: string, worker_id = 'w1') =>
  ({
    instance_number: 0,
    status: 'RUNNING',
    cluster_id,
    worker_id,
  }) as Service['instance_list'][number];

const services = [
  service('s1', 'api', { instance_list: [running('c1'), running('c1')] }),
  service('s2', 'db', { status: 'NO_ACCEPTABLE_CLUSTER' }),
];
const clusters = [cluster('c1', 'leipzig')];

describe('resolveTopologyNode', () => {
  it('finds what a node id stands for and drops stale ids', () => {
    expect(resolveTopologyNode('placement:s1:c1', services, clusters)?.kind).toBe('placement');
    expect(resolveTopologyNode('placement:s2:none', services, clusters)?.kind).toBe(
      'unplaced-service',
    );
    expect(resolveTopologyNode('cluster:c1', services, clusters)?.kind).toBe('cluster');
    expect(resolveTopologyNode('unplaced', services, clusters)?.kind).toBe('unplaced');

    expect(resolveTopologyNode('placement:s1:c9', services, clusters)).toBeUndefined();
    expect(resolveTopologyNode('placement:s1:none', services, clusters)).toBeUndefined();
    expect(resolveTopologyNode('placement:gone:c1', services, clusters)).toBeUndefined();
    expect(resolveTopologyNode('cluster:c9', services, clusters)).toBeUndefined();
  });
});

describe('summarizeSelection', () => {
  it('words a placement, a cluster and the not running group', () => {
    const placement = summarizeSelection(
      resolveTopologyNode('placement:s1:c1', services, clusters)!,
    );
    expect(placement).toMatchObject({ title: 'api', statusLabel: 'Running', tone: 'success' });
    expect(placement.lines).toEqual(['2/2 running on leipzig']);

    const group = summarizeSelection(resolveTopologyNode('cluster:c1', services, clusters)!);
    expect(group.lines).toEqual(['1 service here']);

    const idle = summarizeSelection(resolveTopologyNode('unplaced', services, clusters)!);
    expect(idle.lines).toEqual(['1 service not running']);
  });
});
