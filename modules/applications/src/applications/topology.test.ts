import type { Cluster, Service } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import { buildApplicationTopology, parseTopologyNodeId, UNPLACED_GROUP_ID } from './topology';

const cluster = (id: string, name: string, extra: Partial<Cluster> = {}) =>
  ({
    _id: id,
    cluster_name: name,
    active: true,
    last_modified_timestamp: new Date(),
    ...extra,
  }) as Cluster;

const service = (id: string, name: string, extra: Partial<Service> = {}) =>
  ({
    _id: id,
    microservice_name: name,
    microservice_namespace: 'ns',
    instance_list: [],
    connectivity: [],
    ...extra,
  }) as unknown as Service;

const instance = (status: string, cluster_id?: string) =>
  ({ instance_number: 0, status, cluster_id }) as Service['instance_list'][number];

const calls = (...ids: string[]) =>
  ids.map((target_microservice_id) => ({ target_microservice_id }));
const pairs = (edges: { source: string; target: string }[]) =>
  edges.map((e) => `${e.source}>${e.target}`);

describe('buildApplicationTopology', () => {
  it('frames services by cluster, sorted by name, with a node per placement', () => {
    const { nodes } = buildApplicationTopology(
      [
        service('s2', 'web', {
          instance_list: [instance('RUNNING', 'c2'), instance('RUNNING', 'c2')],
        }),
        service('s1', 'api', {
          instance_list: [instance('RUNNING', 'c1'), instance('FAILED', 'c1')],
        }),
      ],
      [cluster('c2', 'zeta'), cluster('c1', 'alpha'), cluster('c3', 'idle')],
    );

    expect(nodes.map((n) => [n.id, n.kind ?? 'item', n.group])).toEqual([
      ['cluster:c1', 'group', undefined],
      ['placement:s1:c1', 'item', 'cluster:c1'],
      ['cluster:c2', 'group', undefined],
      ['placement:s2:c2', 'item', 'cluster:c2'],
    ]);
    expect(nodes[0]).toMatchObject({ label: 'alpha', description: '1 service' });
    expect(nodes.find((n) => n.id === 'placement:s1:c1')).toMatchObject({
      description: '1/2 running',
      tone: 'destructive',
    });
    expect(nodes.find((n) => n.id === 'placement:s2:c2')?.description).toBe('2/2 running');
    expect(nodes.some((n) => n.column !== undefined)).toBe(false);
  });

  it('shows a service in every cluster that runs it', () => {
    const { nodes } = buildApplicationTopology(
      [
        service('s1', 'web', {
          instance_list: [instance('RUNNING', 'c1'), instance('RUNNING', 'c2')],
        }),
      ],
      [cluster('c1', 'a'), cluster('c2', 'b')],
    );
    expect(nodes.filter((n) => n.kind !== 'group').map((n) => [n.id, n.group])).toEqual([
      ['placement:s1:c1', 'cluster:c1'],
      ['placement:s1:c2', 'cluster:c2'],
    ]);
  });

  it('collects services without an instance in a last "Not running" frame with their reason', () => {
    const { nodes } = buildApplicationTopology(
      [
        service('s1', 'a', { status: 'NO_WORKER_CAPACITY', status_detail: 'No cluster has 64 GB' }),
        service('s3', 'c'),
        service('s4', 'd', { instance_list: [instance('RUNNING', 'c1')] }),
      ],
      [cluster('c1', 'edge')],
    );
    expect(nodes.at(-3)).toMatchObject({
      id: UNPLACED_GROUP_ID,
      label: 'Not running',
      description: '2 services',
      tone: 'warning',
    });
    expect(nodes.find((n) => n.id === 'cluster:c1')).toBe(nodes[0]);
    const a = nodes.find((n) => n.id === 'placement:s1:none');
    expect(a).toMatchObject({ group: UNPLACED_GROUP_ID, tone: 'warning' });
    expect(a?.description).toBeTruthy();
    expect(nodes.find((n) => n.id === 'placement:s3:none')?.description).toBe('Not deployed');
  });

  it('keeps the Not running frame neutral when nothing in it is abnormal', () => {
    const { nodes } = buildApplicationTopology([service('s1', 'a')], []);
    expect(nodes.find((n) => n.id === UNPLACED_GROUP_ID)?.tone).toBe('neutral');
  });

  it('draws connectivity as arrows across clusters and inside one, matching _id and microserviceID', () => {
    const { edges } = buildApplicationTopology(
      [
        service('s1', 'a', {
          connectivity: calls('s2', 's2', 'other-app', 's1'),
          instance_list: [instance('RUNNING', 'c1')],
        }),
        service('s2', 'b', {
          connectivity: calls('legacy'),
          instance_list: [instance('RUNNING', 'c1')],
        }),
        service('s3', 'c', {
          microserviceID: 'legacy',
          instance_list: [instance('RUNNING', 'c2')],
        }),
      ],
      [cluster('c1', 'x'), cluster('c2', 'y')],
    );
    expect(pairs(edges)).toEqual([
      'placement:s1:c1>placement:s2:c1',
      'placement:s2:c1>placement:s3:c2',
    ]);
    expect(edges.every((e) => e.arrow && e.variant === undefined && e.tone === undefined)).toBe(
      true,
    );
    expect(edges.every((e) => e.animated)).toBe(true);
  });

  it('falls back to the :none node when an end is not placed, and does not animate', () => {
    const { edges } = buildApplicationTopology(
      [
        service('s1', 'a', { connectivity: calls('s2') }),
        service('s2', 'b', { instance_list: [instance('RUNNING', 'c1')] }),
      ],
      [cluster('c1', 'x')],
    );
    expect(pairs(edges)).toEqual(['placement:s1:none>placement:s2:c1']);
    expect(edges[0]?.animated).toBe(false);
  });

  it('connects every placement of caller and target while the fan-out is small', () => {
    const two = (id: string, name: string, extra: Partial<Service> = {}) =>
      service(id, name, {
        instance_list: [instance('RUNNING', 'c1'), instance('RUNNING', 'c2')],
        ...extra,
      });
    const { edges } = buildApplicationTopology(
      [two('s1', 'a', { connectivity: calls('s2') }), two('s2', 'b')],
      [cluster('c1', 'x'), cluster('c2', 'y')],
    );
    expect(edges).toHaveLength(4);
  });

  it('narrows to the same cluster, else the first placement, when the fan-out is large', () => {
    const ids = ['c1', 'c2', 'c3', 'c4', 'c5'];
    const callerIds = ids.slice(0, 4);
    const { edges } = buildApplicationTopology(
      [
        service('s1', 'a', {
          connectivity: calls('s2'),
          instance_list: callerIds.map((id) => instance('RUNNING', id)),
        }),
        service('s2', 'b', {
          instance_list: ['c2', 'c3', 'c4', 'c5', 'c6'].map((id) => instance('RUNNING', id)),
        }),
      ],
      ids.map((id) => cluster(id, id)),
    );
    expect(pairs(edges)).toEqual([
      'placement:s1:c1>placement:s2:c2',
      'placement:s1:c2>placement:s2:c2',
      'placement:s1:c3>placement:s2:c3',
      'placement:s1:c4>placement:s2:c4',
    ]);
  });

  it('marks silent and never-reported clusters stale and neutral, and names unknown ones', () => {
    const { nodes } = buildApplicationTopology(
      [
        service('s1', 'a', {
          instance_list: [
            instance('RUNNING', 'c1'),
            instance('RUNNING', 'c2'),
            instance('RUNNING', 'gone-cluster-id'),
          ],
        }),
      ],
      [
        cluster('c1', 'silent', { active: false }),
        cluster('c2', 'never', { active: false, last_modified_timestamp: undefined }),
      ],
    );
    for (const id of ['cluster:c1', 'cluster:c2']) {
      expect(nodes.find((n) => n.id === id)).toMatchObject({
        stale: true,
        tone: 'neutral',
        description: 'Not reporting',
      });
    }
    const gone = nodes.find((n) => n.id === 'cluster:gone-cluster-id');
    expect(gone?.label).toBe('Cluster gone-clu');
    expect(gone?.stale).toBeUndefined();
  });

  it('pulses while instances are changing and leaves links to the inspector', () => {
    const { nodes } = buildApplicationTopology(
      [service('s1', 'a', { instance_list: [instance('CLUSTER_SCHEDULED', 'c1')] })],
      [cluster('c1', 'x')],
    );
    expect(nodes.find((n) => n.id === 'placement:s1:c1')?.pulse).toBe(true);
    expect(nodes.some((n) => n.href !== undefined)).toBe(false);
  });

  it('keeps an instance the cluster found no worker for out of that cluster', () => {
    const { nodes } = buildApplicationTopology(
      [
        service('s1', 'wideload', {
          status: 'NO_WORKER_CAPACITY',
          instance_list: [instance('NO_WORKER_CAPACITY', 'c1')],
        }),
      ],
      [cluster('c1', 'edge')],
    );
    expect(nodes.some((n) => n.id === 'cluster:c1')).toBe(false);
    expect(nodes.find((n) => n.id === 'placement:s1:none')?.group).toBe('unplaced');
  });
});

describe('parseTopologyNodeId', () => {
  it('reads back the ids the builder makes', () => {
    expect(parseTopologyNodeId('cluster:c1')).toEqual({ kind: 'cluster', clusterId: 'c1' });
    expect(parseTopologyNodeId('placement:s1:c1')).toEqual({
      kind: 'placement',
      serviceId: 's1',
      clusterId: 'c1',
    });
    expect(parseTopologyNodeId('placement:s1:none')).toEqual({
      kind: 'placement',
      serviceId: 's1',
      clusterId: null,
    });
    expect(parseTopologyNodeId(UNPLACED_GROUP_ID)).toEqual({ kind: 'unplaced' });
  });

  it('rejects anything else', () => {
    for (const id of ['', 'cluster:', 'placement:s1', 'placement:a:b:c', 'service:s1']) {
      expect(parseTopologyNodeId(id)).toBeUndefined();
    }
  });
});
