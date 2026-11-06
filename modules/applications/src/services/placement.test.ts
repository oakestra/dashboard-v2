import type { Cluster, Service } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import {
  MEMORY_SLIDER_STEPS,
  describeNotEvaluated,
  describeRowResult,
  describeWhatIf,
  directTarget,
  evaluatePlacement,
  explainPlacement,
  initialLimits,
  limitCeilings,
  limitsCanHelp,
  memoryToPosition,
  placementFailureStatus,
  positionToMemory,
} from './placement';

function cluster(name: string, vcpus: number, memory: number, extra: Partial<Cluster> = {}) {
  return {
    _id: name,
    cluster_name: name,
    active: true,
    vcpus,
    memory_in_mb: memory,
    virtualization: ['runc', 'docker'],
    csi_drivers: [],
    last_modified_timestamp: new Date(0),
    ...extra,
  } as unknown as Cluster;
}

function service(extra: Partial<Service> = {}): Service {
  return {
    _id: 's',
    microservice_name: 'svc',
    virtualization: 'docker',
    memory: 100,
    vcpus: 1,
    status: 'NoActiveClusterWithCapacity',
    constraints: [],
    volumes: [],
    instance_list: [],
    ...extra,
  } as unknown as Service;
}

// The shape of the placement demo in @oakestra/mocks.
const fleet = [
  cluster('edge-wien', 8, 2_621),
  cluster('edge-munich', 16, 17_695, { active: false }),
  cluster('test-cluster', 42, 39_760),
  cluster('edge-hamburg', 16, 12_780),
  cluster('plant-leipzig', 32, 81_265),
];

const names = (rows: ReturnType<typeof evaluatePlacement>) =>
  rows.map((row) => row.cluster.cluster_name);
const row = (rows: ReturnType<typeof evaluatePlacement>, name: string) =>
  rows.find((candidate) => candidate.cluster.cluster_name === name)!;

describe('evaluatePlacement', () => {
  it('blocks every cluster on memory and vCPU for trainer, closest first, silent last', () => {
    const rows = evaluatePlacement(service({ memory: 500_000, vcpus: 64 }), fleet);
    expect(names(rows)).toEqual([
      'test-cluster',
      'plant-leipzig',
      'edge-hamburg',
      'edge-wien',
      'edge-munich',
    ]);
    expect(rows.map((r) => r.state)).toEqual([
      'blocked',
      'blocked',
      'blocked',
      'blocked',
      'silent',
    ]);
    expect(describeRowResult(rows[0]!)).toBe('Blocked by memory and vCPU');
    expect(describeRowResult(rows[4]!)).toBe('Silent, not considered');
  });

  it('blocks on memory only for bigmem and ranks fewer blockers first', () => {
    const rows = evaluatePlacement(service({ memory: 200_000, vcpus: 2 }), fleet);
    expect(describeRowResult(row(rows, 'plant-leipzig'))).toBe('Blocked by memory');
    expect(names(rows)[0]).toBe('plant-leipzig');

    const mixed = evaluatePlacement(service({ memory: 30_000, vcpus: 40 }), fleet);
    expect(mixed.map((r) => r.state).slice(0, 2)).toEqual(['passes', 'blocked']);
    expect(names(mixed)[0]).toBe('test-cluster');
  });

  it('lets offers equal to the request pass, like the scheduler', () => {
    const rows = evaluatePlacement(service({ memory: 39_760, vcpus: 42 }), [
      cluster('test-cluster', 42, 39_760),
    ]);
    expect(rows[0]?.state).toBe('passes');
    expect(describeRowResult(rows[0]!)).toBe('Passes cluster checks');
  });

  it('compares the runtime as an exact string and maps container to docker', () => {
    const unikernels = cluster('uni', 8, 8_000, { virtualization: ['unikernel'] });
    expect(evaluatePlacement(service(), [unikernels])[0]?.state).toBe('blocked');
    expect(describeRowResult(evaluatePlacement(service(), [unikernels])[0]!)).toBe(
      'Blocked by runtime',
    );
    const stored = service({ virtualization: 'container' });
    expect(evaluatePlacement(stored, [cluster('a', 8, 8_000)])[0]?.state).toBe('passes');
    const runcOnly = cluster('b', 8, 8_000, { virtualization: ['runc'] });
    expect(evaluatePlacement(service(), [runcOnly])[0]?.state).toBe('blocked');
  });

  it('treats a service without a runtime as blocked everywhere', () => {
    const rows = evaluatePlacement(service({ virtualization: undefined }), fleet);
    expect(rows.every((r) => r.state !== 'passes')).toBe(true);
  });

  it('requires every CSI driver of the volumes', () => {
    const volumes = [{ volume_id: 'v', csi_driver: 'nfs.csi.k8s.io', mount_path: '/data' }];
    const rows = evaluatePlacement(service({ volumes }), [
      cluster('with', 8, 8_000, { csi_drivers: ['nfs.csi.k8s.io'] }),
      cluster('without', 8, 8_000),
    ]);
    expect(row(rows, 'with').state).toBe('passes');
    expect(row(rows, 'without')).toMatchObject({
      state: 'blocked',
      missingCsiDrivers: ['nfs.csi.k8s.io'],
    });
  });

  it('keeps the order of the real request when limits change the checks', () => {
    const trainer = service({ memory: 500_000, vcpus: 64 });
    const rows = evaluatePlacement(trainer, fleet, { memory: 2_000, vcpus: 8 });
    expect(names(rows)).toEqual(names(evaluatePlacement(trainer, fleet)));
    expect(rows.filter((r) => r.state === 'passes')).toHaveLength(4);
  });

  it('never checks a cluster that never reported, and says so', () => {
    const fresh = cluster('fresh', 8, 8_000, {
      active: false,
      last_modified_timestamp: undefined,
    });
    const [only] = evaluatePlacement(service(), [fresh]);
    expect(only).toMatchObject({ state: 'silent', report: 'never-reported' });
    expect(describeRowResult(only!)).toBe('Never reported, not considered');
  });
});

describe('direct constraint', () => {
  const pinned = (name: string, extra: Partial<Service> = {}) =>
    service({
      status: 'TargetClusterNotActive',
      constraints: [{ type: 'direct', cluster: name }],
      ...extra,
    });

  it('uses the last direct constraint and ignores an empty cluster', () => {
    const two = [
      { type: 'direct', cluster: 'a' },
      { type: 'direct', cluster: 'b', node: 'n1' },
    ];
    expect(directTarget(service({ constraints: two }))).toBe('b');
    expect(directTarget(service({ constraints: [{ type: 'direct', cluster: '' }] }))).toBe(
      undefined,
    );
  });

  it('explains a silent target instead of capacity (munichgw)', () => {
    const munichgw = pinned('edge-munich', { memory: 128 });
    const rows = evaluatePlacement(munichgw, fleet);

    expect(rows.at(-1)).toMatchObject({ state: 'silent', isTarget: true });
    expect(describeRowResult(row(rows, 'test-cluster'))).toBe('Blocked by direct constraint');
    const { title, detail } = explainPlacement(munichgw, rows);
    expect(title).toBe('Target cluster edge-munich is not reporting');
    expect(`${title} ${detail}`).not.toMatch(/no cluster can/i);
    expect(limitsCanHelp(rows)).toBe(false);
  });

  it('says when the target does not exist', () => {
    const rows = evaluatePlacement(pinned('gone', { status: 'TargetClusterNotFound' }), fleet);
    expect(explainPlacement(pinned('gone'), rows).title).toBe('Target cluster gone does not exist');
  });

  it('names the blockers of a reporting target and keeps the sliders useful', () => {
    const big = pinned('edge-wien', { memory: 8_000, status: 'NoActiveClusterWithCapacity' });
    const rows = evaluatePlacement(big, fleet);
    expect(names(rows)[0]).toBe('edge-wien');
    expect(explainPlacement(big, rows).title).toBe('Target cluster edge-wien is blocked by memory');
    expect(limitsCanHelp(rows)).toBe(true);
  });

  it('tells a target that passes by now from one with no worker', () => {
    const stale = pinned('test-cluster');
    expect(explainPlacement(stale, evaluatePlacement(stale, fleet)).title).toBe(
      'Target cluster test-cluster passes cluster checks now',
    );
    const worker = pinned('test-cluster', { status: 'NO_WORKER_CAPACITY' });
    expect(explainPlacement(worker, evaluatePlacement(worker, fleet)).title).toBe(
      'test-cluster passes cluster checks, but no single worker has room',
    );
  });
});

describe('explainPlacement', () => {
  it('counts the blockers when every active cluster is blocked', () => {
    const trainer = service({ memory: 500_000, vcpus: 40 });
    const { title, detail } = explainPlacement(trainer, evaluatePlacement(trainer, fleet));
    expect(title).toBe('Every active cluster is blocked');
    expect(detail).toBe('Blocked by memory on 4 clusters and vCPU on 3 clusters.');
  });

  it('explains totals against workers when nothing rules a cluster out (wideload)', () => {
    const wideload = service({
      memory: 4_000,
      vcpus: 40,
      status: 'NO_WORKER_CAPACITY',
    });
    const rows = evaluatePlacement(wideload, fleet);
    const { title, detail } = explainPlacement(wideload, rows);
    expect(title).toBe('Cluster totals pass, but no single worker has room');
    expect(detail).toContain('1 of 4 active clusters passes');
    expect(detail).toContain('summed across workers');
  });

  it('does not blame capacity when a cluster passes by now', () => {
    const small = service();
    expect(explainPlacement(small, evaluatePlacement(small, fleet)).title).toBe(
      '4 of 4 active clusters pass cluster checks now',
    );
  });

  it('covers a TargetCluster status without a target: there were no candidates at all', () => {
    const none = service({ status: 'TargetClusterNotActive' });
    const rows = evaluatePlacement(none, [cluster('a', 8, 8_000, { active: false })]);
    expect(explainPlacement(none, rows).title).toBe('No cluster is reporting');
    expect(explainPlacement(none, []).title).toBe('No cluster is reporting');
  });

  it('never promises a run', () => {
    const wideload = service({ memory: 4_000, vcpus: 40, status: 'NO_WORKER_CAPACITY' });
    const rows = evaluatePlacement(wideload, fleet);
    const text = [
      ...Object.values(explainPlacement(wideload, rows)),
      describeWhatIf(rows, { memory: 4_000, vcpus: 40 }),
      ...rows.map(describeRowResult),
    ].join(' ');
    expect(text).not.toMatch(/\bfits?\b|will run/i);
  });
});

describe('placementFailureStatus', () => {
  it('prefers the service status and falls back to a failed instance', () => {
    expect(placementFailureStatus(service())).toBe('NoActiveClusterWithCapacity');
    const instance_list = [
      { instance_number: 0, status: 'RUNNING' },
      { instance_number: 1, status: 'NO_WORKER_CAPACITY' },
    ] as Service['instance_list'];
    expect(placementFailureStatus(service({ status: 'RUNNING', instance_list }))).toBe(
      'NO_WORKER_CAPACITY',
    );
    expect(placementFailureStatus(service({ status: 'RUNNING' }))).toBeUndefined();
  });
});

describe('what-if', () => {
  const trainer = service({ memory: 500_000, vcpus: 64 });

  it('reports the clusters that pass at the given limits', () => {
    const limits = { memory: 20_000, vcpus: 20 };
    const rows = evaluatePlacement(trainer, fleet, limits);
    expect(describeWhatIf(rows, limits)).toBe(
      'At 20 vCPU and 19.5 GB, 2 of 4 active clusters pass cluster checks: test-cluster and plant-leipzig. The scheduler still has to find one worker with that much free.',
    );
  });

  it('names the closest cluster when none passes', () => {
    const limits = { memory: 500_000, vcpus: 64 };
    expect(describeWhatIf(evaluatePlacement(trainer, fleet, limits), limits)).toContain(
      'no active cluster passes. Closest: test-cluster, blocked by memory and vCPU.',
    );
  });

  it('stops the sliders at the request or the largest offer, ignoring silent clusters', () => {
    expect(limitCeilings(trainer, evaluatePlacement(trainer, fleet))).toEqual({
      memory: 500_000,
      vcpus: 64,
    });
    const small = service();
    const silentGiant = cluster('giant', 512, 9_000_000, { active: false });
    expect(limitCeilings(small, evaluatePlacement(small, [...fleet, silentGiant]))).toEqual({
      memory: 81_265,
      vcpus: 42,
    });
  });

  it('starts from whole limits of at least 1', () => {
    expect(initialLimits(service({ memory: undefined, vcpus: 0.5 }))).toEqual({
      memory: 1,
      vcpus: 1,
    });
  });

  it('round-trips memory through the log scale with whole, rounded values', () => {
    const max = 500_000;
    expect(positionToMemory(0, max)).toBe(1);
    expect(positionToMemory(MEMORY_SLIDER_STEPS, max)).toBe(max);
    expect(memoryToPosition(max, max)).toBe(MEMORY_SLIDER_STEPS);
    for (const position of [500, 650, 777, 999]) {
      const memory = positionToMemory(position, max);
      expect(Number.isInteger(memory)).toBe(true);
      // Three significant digits are finer than a step up here; below, whole MBs are coarser.
      expect(Math.abs(memoryToPosition(memory, max) - position)).toBeLessThanOrEqual(1);
    }
    // Half the track is still a value a small cluster can meet, which a linear scale would not be.
    expect(positionToMemory(500, max)).toBeLessThan(1_000);
  });

  it('survives a ceiling of 1', () => {
    expect(memoryToPosition(1, 1)).toBe(0);
    expect(positionToMemory(0, 1)).toBe(1);
  });
});

describe('describeNotEvaluated', () => {
  it('stays quiet for a plain service', () => {
    expect(describeNotEvaluated(service())).toBeUndefined();
    expect(
      describeNotEvaluated(service({ constraints: [{ type: 'direct', cluster: 'a' }] })),
    ).toBeUndefined();
  });

  it('lists what the scheduler did not read', () => {
    const text = describeNotEvaluated(
      service({
        vgpus: 1,
        storage: 10,
        bandwidth_in: 5,
        constraints: [
          { type: 'latency' },
          { type: 'geo' },
          { type: 'clusters' },
          { type: 'direct', cluster: 'a', node: 'n1' },
        ],
      }),
    );
    expect(text).toBe(
      'Not evaluated by these checks: vGPU, storage, bandwidth, latency constraint, geo constraint, clusters constraint, and target node.',
    );
  });
});
