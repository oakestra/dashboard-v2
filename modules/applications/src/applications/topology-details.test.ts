import type { Cluster, Service } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import {
  clusterAttention,
  placementAttention,
  placementUsageLine,
  resolveTopologyNode,
  summarizeSelection,
  topologyProblems,
  type TopologySelection,
} from './topology-details';

const cluster = (
  id: string,
  name: string,
  active = true,
  last_modified_timestamp: Date | undefined = new Date(),
) => ({ _id: id, cluster_name: name, active, last_modified_timestamp }) as Cluster;

type InstanceOf = Service['instance_list'][number];

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

const instance = (extra: Partial<InstanceOf>): InstanceOf => ({ ...running('c1'), ...extra });

const MB = 1024 * 1024;

describe('placementUsageLine', () => {
  it('sums the measured instances, memory as bytes', () => {
    const measured = [
      instance({ cpu_percent: 10, memory_percent: 100 * MB }),
      instance({ instance_number: 1, cpu_percent: 5, memory_percent: 50 * MB }),
    ];
    expect(placementUsageLine(measured.slice(0, 1), true)).toBe('CPU 10%, memory 100 MB');
    expect(placementUsageLine(measured, true)).toBe('CPU 15%, memory 150 MB over 2 instances');
  });

  it('leaves out failed and unmeasured instances and says so', () => {
    const mixed = [
      instance({ cpu_percent: 10, memory_percent: 100 * MB }),
      instance({ instance_number: 1 }),
      instance({ instance_number: 2, status: 'FAILED', cpu_percent: 80, memory_percent: MB }),
    ];
    expect(placementUsageLine(mixed, true)).toBe(
      'CPU 10%, memory 100 MB (1 of 3 instances measured)',
    );
  });

  it('shows nothing for a silent cluster or without metrics', () => {
    expect(placementUsageLine([instance({ cpu_percent: 10 })], false)).toBeUndefined();
    expect(placementUsageLine([instance({})], true)).toBeUndefined();
  });
});

describe('placementAttention', () => {
  it('names the one failed instance and its reason', () => {
    expect(
      placementAttention([
        instance({}),
        instance({ instance_number: 1, status: 'DEAD', status_detail: 'OOM killed' }),
      ]),
    ).toEqual({
      tone: 'destructive',
      headline: 'Instance 1: Crashed',
      reason: 'OOM killed',
      instanceNumber: 1,
    });
  });

  it('counts several and takes the reason of the worst', () => {
    expect(
      placementAttention([
        instance({ status: 'NO_WORKER_CAPACITY', status_detail: 'no memory' }),
        instance({ instance_number: 1, status: 'FAILED', status_detail: 'image pull failed' }),
        instance({ instance_number: 2 }),
      ]),
    ).toEqual({
      tone: 'destructive',
      headline: '2 of 3 instances need attention',
      reason: 'image pull failed',
      instanceNumber: 1,
    });
  });

  it('has nothing to say about healthy or starting instances', () => {
    expect(placementAttention([instance({}), instance({ status: 'NODE_SCHEDULED' })])).toBe(
      undefined,
    );
  });
});

describe('clusterAttention', () => {
  const selectionOn = (target: Cluster, members: Service[]) =>
    resolveTopologyNode(`cluster:${target._id}`, members, [target]) as Extract<
      TopologySelection,
      { kind: 'cluster' }
    >;
  const members = [
    service('a', 'api', { instance_list: [running('c1')] }),
    service('b', 'db', { instance_list: [instance({ status: 'FAILED' })] }),
  ];

  it('counts the application services that are unhealthy there', () => {
    expect(clusterAttention(selectionOn(cluster('c1', 'leipzig'), members))).toEqual({
      tone: 'destructive',
      headline: '1 of 2 services unhealthy',
    });
    expect(clusterAttention(selectionOn(cluster('c1', 'leipzig'), members.slice(0, 1)))).toBe(
      undefined,
    );
  });

  it('marks the count as last known on a silent cluster', () => {
    expect(clusterAttention(selectionOn(cluster('c1', 'leipzig', false), members))?.headline).toBe(
      '1 of 2 services unhealthy at the last report',
    );
  });
});

describe('summarizeSelection', () => {
  const linked = [
    service('s1', 'api', {
      instance_list: [
        instance({ cpu_percent: 12, memory_percent: 64 * MB }),
        instance({ instance_number: 1, cpu_percent: 8, memory_percent: 64 * MB }),
      ],
      connectivity: [{ target_microservice_id: 's3' }],
    }),
    service('s2', 'frontend', {
      instance_list: [running('c1')],
      connectivity: [{ target_microservice_id: 's1' }],
    }),
    service('s3', 'cache', {
      instance_list: [instance({ status: 'DEAD', status_detail: 'exit code 137' })],
    }),
    service('s4', 'db', { status: 'NO_ACTIVE_CLUSTER_WITH_CAPACITY', status_detail: 'no gpu' }),
  ];

  it('adds load and neighbours to a healthy placement, not what the node shows', () => {
    const placement = summarizeSelection(resolveTopologyNode('placement:s1:c1', linked, clusters)!);
    expect(placement).toMatchObject({ title: 'api', statusLabel: 'Running', tone: 'success' });
    expect(placement.lines).toEqual([
      'CPU 20%, memory 128 MB over 2 instances',
      'Calls cache',
      'Called by frontend',
    ]);
  });

  it('puts the reason first for an abnormal placement', () => {
    const placement = summarizeSelection(resolveTopologyNode('placement:s3:c1', linked, clusters)!);
    expect(placement.statusLabel).toBe('Crashed');
    expect(placement.lines).toEqual(['exit code 137', 'Called by api']);
  });

  it('says a silent cluster only has the last known state', () => {
    const silent = [cluster('c1', 'leipzig', false, new Date(Date.now() - 3 * 3600_000))];
    const placement = summarizeSelection(resolveTopologyNode('placement:s1:c1', linked, silent)!);
    expect(placement.stale).toBe(true);
    expect(placement.lines).toEqual([
      'Last known state. Last report 3 hours ago',
      'Calls cache',
      'Called by frontend',
    ]);

    const group = summarizeSelection(resolveTopologyNode('cluster:c1', linked, silent)!);
    expect(group.lines).toEqual([
      '1 of 3 services unhealthy at the last report',
      'Last report 3 hours ago',
    ]);
    const never = [{ ...cluster('c1', 'leipzig', false), last_modified_timestamp: undefined }];
    expect(summarizeSelection(resolveTopologyNode('cluster:c1', linked, never)!).lines).toContain(
      'No report yet',
    );
  });

  it('gives a reporting cluster its load and unhealthy count', () => {
    const loaded = [{ ...cluster('c1', 'leipzig'), cpu_percent: 40, memory_percent: 55 }];
    const group = summarizeSelection(resolveTopologyNode('cluster:c1', linked, loaded)!);
    expect(group.lines).toEqual(['1 of 3 services unhealthy', 'CPU 40%, memory 55%']);
  });

  it('explains a service that runs nowhere and the not running group', () => {
    const unplaced = summarizeSelection(
      resolveTopologyNode('placement:s4:none', linked, clusters)!,
    );
    expect(unplaced.lines).toEqual(['no gpu']);

    const idle = summarizeSelection(resolveTopologyNode('unplaced', linked, clusters)!);
    expect(idle).toMatchObject({ statusLabel: 'Needs attention' });
    expect(idle.lines).toEqual(['1 service failed or could not be placed']);
  });

  it('shortens long neighbour lists', () => {
    const many = [
      service('hub', 'hub', {
        instance_list: [running('c1')],
        connectivity: ['a', 'b', 'c', 'd'].map((id) => ({ target_microservice_id: id })),
      }),
      ...['a', 'b', 'c', 'd'].map((id) => service(id, `svc-${id}`)),
    ];
    const hub = summarizeSelection(resolveTopologyNode('placement:hub:c1', many, clusters)!);
    expect(hub.lines).toEqual(['Calls svc-a, svc-b and 2 more']);
  });
});

describe('topologyProblems', () => {
  const at = (cluster_id: string, instance_number: number, status = 'RUNNING') =>
    instance({ cluster_id, instance_number, status });

  it('says nothing about a healthy application, undeployed or still scheduling services', () => {
    expect(
      topologyProblems(
        [
          service('s1', 'api', { instance_list: [running('c1')] }),
          service('s2', 'db'),
          service('s3', 'cache', { status: 'REQUESTED' }),
        ],
        clusters,
      ),
    ).toEqual([]);
  });

  it('counts failed and degraded instances and selects the first placement in graph order', () => {
    const problems = topologyProblems(
      [
        service('s2', 'web', {
          instance_list: [at('c2', 0, 'FAILED'), at('c1', 1, 'DEAD'), at('c1', 2)],
        }),
        service('s1', 'api', {
          instance_list: [
            at('c1', 0, 'FAILED'),
            instance({ instance_number: 1, status: 'NO_QUALIFIED_WORKER_FOUND' }),
          ],
        }),
      ],
      [cluster('c1', 'leipzig'), cluster('c2', 'berlin')],
    );
    expect(problems).toEqual([
      { id: 'failed', tone: 'destructive', text: '3 failed instances', nodeId: 'placement:s1:c1' },
      { id: 'degraded', tone: 'warning', text: '1 degraded instance', nodeId: 'placement:s1:c1' },
    ]);
  });

  it('lists services that run nowhere and selects the worst', () => {
    const problems = topologyProblems(
      [
        service('s1', 'api', { status: 'NO_ACTIVE_CLUSTER_WITH_CAPACITY' }),
        service('s2', 'batch', { status: 'FAILED' }),
        service('s3', 'db'),
      ],
      clusters,
    );
    expect(problems).toEqual([
      {
        id: 'unplaced',
        tone: 'destructive',
        text: '2 services not placed',
        nodeId: 'placement:s2:none',
      },
    ]);
    expect(
      topologyProblems(
        [service('s1', 'api', { status: 'NO_ACTIVE_CLUSTER_WITH_CAPACITY' })],
        clusters,
      ),
    ).toEqual([
      {
        id: 'unplaced',
        tone: 'warning',
        text: '1 service not placed',
        nodeId: 'placement:s1:none',
      },
    ]);
  });

  it('names one placement on a silent cluster and counts several, without calling them failed', () => {
    const quiet = [cluster('c1', 'leipzig'), cluster('c2', 'edge-munich', false)];
    expect(
      topologyProblems(
        [service('s1', 'frontend', { instance_list: [at('c2', 0, 'FAILED')] })],
        quiet,
      ),
    ).toEqual([
      {
        id: 'silent',
        tone: 'neutral',
        text: 'frontend on edge-munich: last known state',
        nodeId: 'placement:s1:c2',
      },
    ]);

    const quieter = [...quiet, cluster('c3', 'edge-nuremberg', false)];
    expect(
      topologyProblems(
        [service('s1', 'frontend', { instance_list: [at('c2', 0), at('c3', 1)] })],
        quieter,
      )[0]?.text,
    ).toBe('frontend on 2 clusters that stopped reporting');
    const several = topologyProblems(
      [
        service('s1', 'frontend', { instance_list: [at('c2', 0), at('c3', 1)] }),
        service('s2', 'api', { instance_list: [at('c1', 0, 'DEAD'), at('c3', 1)] }),
      ],
      quieter,
    );
    expect(several).toEqual([
      { id: 'failed', tone: 'destructive', text: '1 failed instance', nodeId: 'placement:s2:c1' },
      {
        id: 'silent',
        tone: 'neutral',
        text: '2 services on clusters that stopped reporting',
        nodeId: 'placement:s2:c3',
      },
    ]);
  });
});
