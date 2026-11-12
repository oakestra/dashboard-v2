import type { Cluster, Service } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import {
  buildInfrastructureTopology,
  parseInfraNodeId,
  shortWorker,
  workerNodeId,
} from './topology';

const cluster = (overrides: Partial<Cluster>) =>
  ({
    _id: 'c',
    cluster_name: 'c',
    active: true,
    virtualization: [],
    last_modified_timestamp: new Date(),
    ...overrides,
  }) as Cluster;

const service = (name: string, instances: Record<string, unknown>[]) =>
  ({ _id: name, microservice_name: name, instance_list: instances }) as unknown as Service;

const clusters = [
  cluster({ _id: 'b', cluster_name: 'edge-b', active_nodes: 3 }),
  cluster({ _id: 'a', cluster_name: 'edge-a', active_nodes: 1 }),
  cluster({ _id: 's', cluster_name: 'silent', active: false }),
  cluster({ _id: 'n', cluster_name: 'never', active: false, last_modified_timestamp: undefined }),
];

describe('buildInfrastructureTopology', () => {
  it('draws the root and every cluster, ordered by name, with the idle ones too', () => {
    const { nodes } = buildInfrastructureTopology(clusters, []);

    expect(nodes[0]).toMatchObject({
      id: 'root',
      kind: 'primary',
      label: 'Root orchestrator',
      description: '4 clusters',
      column: 0,
    });
    const groups = nodes.filter((node) => node.kind === 'group');
    expect(groups.map((node) => node.label)).toEqual(['edge-a', 'edge-b', 'never', 'silent']);
    expect(groups.every((node) => node.column === 1)).toBe(true);
    expect(groups[0]).toMatchObject({
      description: '1 worker',
      tone: 'success',
    });
    expect(groups[0]?.stale).toBe(false);
    expect(groups[2]).toMatchObject({ tone: 'neutral', stale: true });
    expect(groups[3]).toMatchObject({ tone: 'neutral', stale: true });
  });

  it('links the root to each cluster, dashed unless the cluster reports', () => {
    const { edges } = buildInfrastructureTopology(clusters, []);

    const byTarget = Object.fromEntries(edges.map((edge) => [edge.target, edge]));
    expect(edges).toHaveLength(4);
    expect(byTarget['cluster:a']).toMatchObject({
      source: 'root',
      variant: 'solid',
      animated: true,
    });
    expect(byTarget['cluster:s']).toMatchObject({ variant: 'dashed', animated: false });
    expect(byTarget['cluster:n']).toMatchObject({ variant: 'dashed', animated: false });
    expect(edges.some((edge) => edge.arrow)).toBe(false);
  });

  it('groups instances into workers with the services running there', () => {
    const { nodes } = buildInfrastructureTopology(clusters, [
      service('frontend', [
        {
          instance_number: 0,
          cluster_id: 'a',
          worker_id: '65a1b2c3d4e5f60718293a4b',
          status: 'RUNNING',
        },
        {
          instance_number: 1,
          cluster_id: 'a',
          worker_id: '65a1b2c3d4e5f60718293a4b',
          status: 'FAILED',
        },
      ]),
      service('ingest', [
        {
          instance_number: 0,
          cluster_id: 'a',
          worker_id: '65a1b2c3d4e5f60718293a4b',
          status: 'RUNNING',
        },
        { instance_number: 0, cluster_id: 'b', worker_id: 'w1', status: 'RUNNING' },
      ]),
    ]);

    const workers = nodes.filter((node) => node.group);
    expect(workers).toHaveLength(2);
    expect(workers[0]).toMatchObject({
      group: 'cluster:a',
      label: '293a4b',
      description: 'frontend, ingest',
      tone: 'destructive',
    });
    expect(workers[1]).toMatchObject({ group: 'cluster:b', label: 'w1', tone: 'success' });
    expect(nodes.find((node) => node.id === 'cluster:a')?.description).toBe('1 worker');
  });

  it('collects instances without a worker and ignores unknown clusters', () => {
    const { nodes } = buildInfrastructureTopology(clusters, [
      service('cache', [
        { instance_number: 0, cluster_id: 'b', status: 'REQUESTED' },
        { instance_number: 1, cluster_id: 'gone', worker_id: 'w9', status: 'RUNNING' },
      ]),
    ]);

    const workers = nodes.filter((node) => node.group);
    expect(workers).toHaveLength(1);
    expect(workers[0]).toMatchObject({ label: 'Unknown worker', group: 'cluster:b', pulse: true });
  });

  it('leaves out instances a cluster could not give a worker', () => {
    const { nodes } = buildInfrastructureTopology(clusters, [
      service('wideload', [{ instance_number: 0, cluster_id: 'b', status: 'NO_WORKER_CAPACITY' }]),
    ]);
    expect(nodes.filter((node) => node.group)).toHaveLength(0);
  });

  it('marks the workers of a silent cluster as last known', () => {
    const { nodes } = buildInfrastructureTopology(clusters, [
      service('cache', [
        { instance_number: 0, cluster_id: 's', worker_id: 'w1', status: 'RUNNING' },
      ]),
    ]);

    expect(nodes.find((node) => node.group === 'cluster:s')?.stale).toBe(true);
    expect(nodes.find((node) => node.id === 'cluster:s')?.description).toBe('Silent');
  });
});

describe('shortWorker', () => {
  it('keeps short ids whole and shortens long ones to the tail', () => {
    expect(shortWorker('worker-1')).toBe('worker-1');
    expect(shortWorker('65a1b2c3d4e5f60718293a4b')).toBe('293a4b');
  });
});

describe('parseInfraNodeId', () => {
  it('reads the ids the builder produces', () => {
    expect(parseInfraNodeId('root')).toEqual({ kind: 'root' });
    expect(parseInfraNodeId('cluster:abc')).toEqual({ kind: 'cluster', clusterId: 'abc' });
    expect(parseInfraNodeId(workerNodeId('abc', 'w1'))).toEqual({
      kind: 'worker',
      clusterId: 'abc',
      workerId: 'w1',
    });
  });

  it('keeps colons inside a worker id', () => {
    expect(parseInfraNodeId('worker:abc:host:1')).toEqual({
      kind: 'worker',
      clusterId: 'abc',
      workerId: 'host:1',
    });
  });

  it('rejects anything else', () => {
    for (const id of ['', 'cluster:', 'worker:abc', 'worker::w', 'worker:abc:', 'other']) {
      expect(parseInfraNodeId(id)).toBeNull();
    }
  });
});

describe('workers', () => {
  it('draws no links so a click can select', () => {
    const { nodes } = buildInfrastructureTopology(clusters, [
      service('web', [{ cluster_id: 'a', worker_id: 'w1', status: 'RUNNING', instance_number: 0 }]),
    ]);
    expect(nodes.some((node) => node.href)).toBe(false);
    expect(nodes.some((node) => node.id === 'worker:a:w1')).toBe(true);
  });
});
