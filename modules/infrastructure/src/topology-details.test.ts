import type { Cluster } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import {
  clusterHoverLines,
  describeFailures,
  failedOnCluster,
  restHoverLines,
  rootHoverLines,
  summarizeProblems,
  summarizeRoot,
  workerHoverLines,
} from './topology-details';
import type { WorkerEntry } from './topology';

const cluster = (overrides: Partial<Cluster>) =>
  ({
    _id: 'c',
    cluster_name: 'c',
    active: true,
    virtualization: [],
    last_modified_timestamp: new Date(),
    ...overrides,
  }) as Cluster;

const instance = (
  name: string,
  tone: 'success' | 'destructive',
  fields: Record<string, unknown> = {},
) => ({
  service: { _id: name, microservice_name: name },
  instance: { instance_number: 0, status: tone === 'success' ? 'RUNNING' : 'FAILED', ...fields },
  tone,
});

const entry = (...instances: ReturnType<typeof instance>[]) =>
  ({
    services: new Set(instances.map((i) => i.service.microservice_name)),
    instances,
    tone: 'success',
    pulse: false,
  }) as unknown as WorkerEntry;

describe('rootHoverLines', () => {
  it('counts reporting clusters and their workers', () => {
    const summary = summarizeRoot([
      cluster({ _id: 'a', active_nodes: 2 }),
      cluster({ _id: 'b', active: false }),
    ]);
    expect(rootHoverLines(summary)).toEqual(['1 of 2 reporting', '2 workers on those clusters']);
  });
});

describe('clusterHoverLines', () => {
  it('shows the load of a reporting cluster', () => {
    expect(clusterHoverLines(cluster({ memory_percent: 40, cpu: 10 }))).toEqual([
      expect.stringMatching(/^CPU .*, memory 40% in use$/),
    ]);
  });

  it('dates a silent cluster and calls its figures last known', () => {
    const lines = clusterHoverLines(cluster({ active: false, memory_percent: 40 }));
    expect(lines[0]).toMatch(/^Silent, last report /);
    expect(lines[1]).toMatch(/^Last known: .*memory 40% in use$/);
  });

  it('has no figures for a cluster that never reported', () => {
    expect(
      clusterHoverLines(cluster({ active: false, last_modified_timestamp: undefined })),
    ).toEqual(['Registered, but has not sent a report yet']);
  });
});

describe('workerHoverLines', () => {
  it('counts instances per service and sums measured usage', () => {
    const lines = workerHoverLines(
      entry(
        instance('api', 'success', { cpu_percent: 10, memory_percent: 1024 }),
        instance('api', 'success', { cpu_percent: 5, memory_percent: 1024 }),
        instance('cache', 'success'),
      ),
      false,
    );
    expect(lines).toEqual(['2 api, 1 cache instances', 'Using CPU 15%, memory 2 KB']);
  });

  it('leads with the problem and ignores leftover numbers of a failed instance', () => {
    const lines = workerHoverLines(
      entry(instance('api', 'destructive', { cpu_percent: 50, status_detail: 'out of memory' })),
      false,
    );
    expect(lines[0]).toMatch(/^api: .*\./);
    expect(lines.some((line) => line.startsWith('Using'))).toBe(false);
  });

  it('hides sums and says last known when the cluster is silent', () => {
    const lines = workerHoverLines(entry(instance('api', 'success', { cpu_percent: 10 })), true);
    expect(lines).toEqual(['1 api instance', 'Cluster stopped reporting, last known state']);
  });
});

describe('failedOnCluster', () => {
  it('counts failed instances and the workers they sit on', () => {
    const workers = new Map([
      ['w1', entry(instance('a', 'destructive'), instance('b', 'destructive'))],
      ['w2', entry(instance('a', 'success'))],
      ['w3', entry(instance('a', 'destructive'))],
    ]);
    const failed = failedOnCluster(workers);
    expect(failed).toEqual({ workers: 2, instances: 3 });
    expect(describeFailures(failed)).toBe('3 instances on 2 workers failed.');
    expect(describeFailures({ workers: 0, instances: 0 })).toBeUndefined();
  });
});

describe('restHoverLines', () => {
  it('explains why the workers are not listed', () => {
    expect(restHoverLines(2)).toEqual({
      title: '2 more workers',
      lines: ['No instance you can see runs on them, so they are not listed.'],
    });
    expect(restHoverLines(1).title).toBe('1 more worker');
  });
});

describe('summarizeProblems', () => {
  const now = new Date('2026-01-10T12:00:00Z');
  const silent = (id: string, name: string) =>
    cluster({
      _id: id,
      cluster_name: name,
      active: false,
      last_modified_timestamp: new Date('2026-01-06T12:00:00Z'),
    });
  const never = (id: string, name: string) =>
    cluster({
      _id: id,
      cluster_name: name,
      active: false,
      last_modified_timestamp: undefined,
    });

  it('is empty when everything is fine', () => {
    const workers = new Map([['a', new Map([['w1', entry(instance('api', 'success'))]])]]);
    expect(summarizeProblems([cluster({ _id: 'a' })], workers, now)).toEqual([]);
  });

  it('names a failed instance and selects its worker', () => {
    const workers = new Map([
      [
        'a',
        new Map([
          ['w1', entry(instance('api', 'success'))],
          ['w2', entry(instance('api', 'destructive'))],
        ]),
      ],
    ]);
    expect(
      summarizeProblems([cluster({ _id: 'a', cluster_name: 'edge-wien' })], workers, now),
    ).toEqual([
      {
        id: 'failed',
        text: '1 failed instance on edge-wien',
        tone: 'destructive',
        nodeId: 'worker:a:w2',
      },
    ]);
  });

  it('counts failures across clusters and selects the first by name', () => {
    const workers = new Map([
      [
        'a',
        new Map([['w1', entry(instance('api', 'destructive'), instance('db', 'destructive'))]]),
      ],
      ['b', new Map([['w9', entry(instance('api', 'destructive'))]])],
    ]);
    const [item] = summarizeProblems(
      [cluster({ _id: 'a', cluster_name: 'zeta' }), cluster({ _id: 'b', cluster_name: 'alpha' })],
      workers,
      now,
    );
    expect(item).toMatchObject({ text: '3 failed instances on 2 clusters', nodeId: 'worker:b:w9' });
  });

  it('does not count failures last known on a silent cluster', () => {
    const workers = new Map([['s', new Map([['w1', entry(instance('api', 'destructive'))]])]]);
    expect(summarizeProblems([silent('s', 'edge-munich')], workers, now).map((i) => i.id)).toEqual([
      'silent',
    ]);
  });

  it('dates a single silent cluster and counts several', () => {
    expect(summarizeProblems([silent('s', 'edge-munich')], new Map(), now)).toEqual([
      {
        id: 'silent',
        text: 'edge-munich silent, last report 4 days ago',
        tone: 'neutral',
        stale: true,
        nodeId: 'cluster:s',
      },
    ]);
    const [item] = summarizeProblems([silent('t', 'b'), silent('s', 'a')], new Map(), now);
    expect(item).toMatchObject({ text: '2 clusters silent', nodeId: 'cluster:s' });
  });

  it('reports clusters that never reported, after the other problems', () => {
    const items = summarizeProblems([never('n', 'x'), silent('s', 'y')], new Map(), now);
    expect(items.map((item) => item.text)).toEqual([
      expect.stringMatching(/^y silent, last report/),
      '1 cluster has not reported yet',
    ]);
    expect(items[1]).toMatchObject({ tone: 'neutral', stale: true, nodeId: 'cluster:n' });
    expect(summarizeProblems([never('n', 'x'), never('m', 'w')], new Map(), now)[0]?.text).toBe(
      '2 clusters have not reported yet',
    );
  });
});
