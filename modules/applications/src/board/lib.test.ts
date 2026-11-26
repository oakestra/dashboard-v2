import type { Application, Cluster, Instance, Service } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import {
  buildBoard,
  clusterGroups,
  describeIdleClusters,
  filterRows,
  idleClusterNote,
  instanceReading,
  parseLens,
  summarySentence,
  unplacedGroups,
  type ApplicationRow,
  type BoardEntry,
} from './lib';

const MIB = 1024 * 1024;

const reporting = (id: string, overrides: Partial<Cluster> = {}) =>
  ({
    _id: id,
    cluster_name: id,
    active: true,
    virtualization: [],
    last_modified_timestamp: new Date('2026-01-01'),
    ...overrides,
  }) as Cluster;

const silent = (id: string) => reporting(id, { active: false });

const neverReported = (id: string) =>
  reporting(id, { active: false, last_modified_timestamp: undefined });

const instance = (overrides: Partial<Instance> = {}): Instance =>
  ({ instance_number: 0, status: 'RUNNING', cluster_id: 'a', ...overrides }) as Instance;

const service = (id: string, overrides: Partial<Service> = {}): Service =>
  ({
    _id: id,
    microservice_name: id,
    microservice_namespace: 'ns',
    status: 'RUNNING',
    instance_list: [instance()],
    ...overrides,
  }) as Service;

const entry = (name: string, services: Service[]): BoardEntry => ({
  application: {
    _id: name,
    application_name: name,
    application_namespace: 'ns',
  } as Application,
  services,
});

const boardOf = (entries: BoardEntry[], clusters: Cluster[] = [reporting('a')]) =>
  buildBoard({ entries, clusters });

/** The only service of the only application. */
const rowOf = (subject: Service, clusters?: Cluster[]) =>
  boardOf([entry('app', [subject])], clusters).rows[0]!.services[0]!;

describe('buildBoard lanes', () => {
  const onEach = (...ids: string[]) =>
    entry(
      'app',
      ids.map((id, index) =>
        service(`s-${id}`, {
          instance_list: [instance({ cluster_id: id, instance_number: index })],
        }),
      ),
    );

  it('orders reporting clusters by name, then silent, then never-reported', () => {
    const { lanes } = boardOf(
      [onEach('n', 'm', 'z', 'b')],
      [neverReported('n'), silent('m'), reporting('z'), reporting('b')],
    );

    expect(lanes.map((lane) => lane.id)).toEqual(['b', 'z', 'm', 'n']);
    expect(lanes.map((lane) => lane.state)).toEqual([
      'reporting',
      'reporting',
      'silent',
      'never-reported',
    ]);
  });

  it('gives a card only to clusters with an instance of the viewer, silent ones included', () => {
    const { lanes, idleLanes } = boardOf(
      [onEach('b', 'm')],
      [reporting('a'), reporting('b'), silent('m'), silent('off'), neverReported('n')],
    );

    expect(lanes.map((lane) => lane.id)).toEqual(['b', 'm']);
    expect(idleLanes.map((lane) => lane.id)).toEqual(['a', 'off', 'n']);
  });

  it('does not count an instance the cluster turned down as running there', () => {
    const refused = service('s', {
      instance_list: [instance({ cluster_id: 'a', status: 'NO_WORKER_CAPACITY' })],
    });
    const { lanes, idleLanes } = boardOf([entry('app', [refused])], [reporting('a')]);

    expect(lanes).toEqual([]);
    expect(idleLanes.map((lane) => lane.id)).toEqual(['a']);
  });

  it('leaves every cluster idle for someone without applications, and none without clusters', () => {
    expect(boardOf([], [reporting('a'), silent('b')]).idleLanes).toHaveLength(2);
    expect(boardOf([], []).idleLanes).toEqual([]);
  });
});

describe('describeIdleClusters', () => {
  const lanes = (...names: string[]) =>
    boardOf(
      [],
      names.map((name) => reporting(name)),
    ).idleLanes;
  const names = (idle: ReturnType<typeof describeIdleClusters>) =>
    idle?.named.map((lane) => lane.id);

  it('has nothing to say without idle clusters', () => {
    expect(describeIdleClusters([])).toBeNull();
  });

  it('uses the singular for one cluster', () => {
    expect(describeIdleClusters(lanes('a'))?.lead).toBe('1 more cluster runs nothing of yours');
  });

  it('names every cluster up to a few more than the limit', () => {
    const idle = describeIdleClusters(lanes('a', 'b', 'c'));
    expect(idle?.lead).toBe('3 more clusters run nothing of yours');
    expect(names(idle)).toEqual(['a', 'b', 'c']);
    expect(idle?.more).toBe(0);
    expect(describeIdleClusters(lanes('a', 'b', 'c', 'd', 'e', 'f'))?.more).toBe(0);
  });

  it('cuts a long list and counts the rest', () => {
    const idle = describeIdleClusters(lanes('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'));
    expect(names(idle)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(idle?.more).toBe(3);
  });

  it('marks clusters that are not reporting in words', () => {
    const [a, off, never] = boardOf(
      [],
      [reporting('a'), silent('off'), neverReported('n')],
    ).idleLanes;
    expect([a, off, never].map((lane) => idleClusterNote(lane!))).toEqual([
      null,
      'silent',
      'never reported',
    ]);
  });
});

describe('buildBoard rows', () => {
  it('puts applications that need attention first, worst first, the rest by name', () => {
    const { rows } = boardOf(
      [
        entry('calm', [service('s1')]),
        entry('another', [service('s2')]),
        entry('stuck', [
          service('s3', { status: 'NoActiveClusterWithCapacity', instance_list: [] }),
        ]),
        entry('dead', [service('s4', { status: 'FAILED', instance_list: [] })]),
        entry('quiet', [service('s5', { instance_list: [instance({ cluster_id: 'gone' })] })]),
        entry('lost', [service('s6', { instance_list: [instance({ cluster_id: 'off' })] })]),
      ],
      [reporting('a'), silent('off')],
    );

    expect(rows.map((row) => row.application.application_name)).toEqual([
      'dead',
      'quiet',
      'stuck',
      'lost',
      'another',
      'calm',
    ]);
  });
});

describe('buildBoard Unplaced', () => {
  it.each([
    ['empty', ''],
    ['missing', undefined],
    ['unknown', 'not-a-cluster'],
  ])('catches an instance with a %s cluster id', (_, cluster_id) => {
    const row = rowOf(service('s', { instance_list: [instance({ cluster_id })] }));

    expect(row.unplaced).toHaveLength(1);
    expect(row.unplaced[0]).toMatchObject({ tone: 'warning', label: 'Unknown cluster' });
    expect(row.placements.size).toBe(0);
    expect(row.attention).toEqual({ tone: 'warning', summary: 'is on an unknown cluster' });
  });

  it('does not treat an instance the scheduler is still placing as lost', () => {
    const row = rowOf(
      service('s', { instance_list: [instance({ status: 'SCHEDULED', cluster_id: '' })] }),
    );

    expect(row.unplaced[0]).toMatchObject({ tone: 'info', label: 'Being scheduled' });
    expect(row.attention).toBeNull();
  });

  it('catches a placement failure, also next to running instances', () => {
    const row = rowOf(service('s', { status: 'NO_WORKER_CAPACITY' }));

    expect(row.unplaced).toEqual([
      expect.objectContaining({ tone: 'warning', label: 'No capacity' }),
    ]);
    expect(row.attention).toEqual({ tone: 'warning', summary: "can't be placed" });
  });

  it('does not show a turned-down instance as running on the cluster that refused it', () => {
    const row = rowOf(
      service('s', {
        status: 'NO_WORKER_CAPACITY',
        instance_list: [instance({ status: 'NO_WORKER_CAPACITY' })],
      }),
    );

    expect(row.placements.size).toBe(0);
    // Service and instance say the same thing, once is enough.
    expect(row.unplaced).toHaveLength(1);
  });

  it('catches a failed service without instances', () => {
    expect(rowOf(service('s', { status: 'FAILED', instance_list: [] })).unplaced).toEqual([
      expect.objectContaining({ tone: 'destructive', label: 'Failed' }),
    ]);
  });

  it('shows REQUESTED without an instance as being scheduled, not as something that needs attention', () => {
    const row = rowOf(service('s', { status: 'REQUESTED', instance_list: [] }));

    expect(row.unplaced).toEqual([
      expect.objectContaining({ tone: 'info', label: 'Being scheduled', pulse: true }),
    ]);
    expect(row.attention).toBeNull();
  });

  it('shows an undeployed service quietly', () => {
    const { rows, summary } = boardOf([
      entry('app', [service('s', { status: undefined, instance_list: [] })]),
    ]);

    expect(rows[0]!.services[0]!.unplaced).toEqual([
      expect.objectContaining({ tone: 'neutral', label: 'Not deployed' }),
    ]);
    expect(summary.attention).toBe(0);
    expect(rows[0]!.severity).toBe(3);
  });

  it('leaves a healthy service out', () => {
    expect(rowOf(service('s')).unplaced).toEqual([]);
  });
});

describe('buildBoard silent clusters', () => {
  const clusters = [reporting('a'), silent('off'), neverReported('new')];
  const onCluster = (cluster_id: string, instance_number: number) =>
    instance({ cluster_id, instance_number });

  it('renders instances there as last known and never counts them as running', () => {
    const { rows, summary } = boardOf(
      [
        entry('app', [
          service('s', {
            instance_list: [onCluster('a', 0), onCluster('off', 1), onCluster('new', 2)],
          }),
        ]),
      ],
      clusters,
    );

    expect(rows[0]!.services[0]!.placements.get('off')![0]!.stale).toBe(true);
    expect(rows[0]!.services[0]!.placements.get('new')![0]!.stale).toBe(true);
    expect(rows[0]!.services[0]!.placements.get('a')![0]!.stale).toBe(false);
    expect(summary).toMatchObject({ running: 1, runningClusters: 1 });
  });

  it('counts what is still on the way as not running', () => {
    const { summary } = boardOf([
      entry('app', [service('s', { instance_list: [instance({ status: 'STARTING' })] })]),
    ]);

    expect(summary.running).toBe(0);
  });
});

describe('buildBoard attention', () => {
  it('flags a failed service whose instances still run', () => {
    const row = rowOf(service('s', { status: 'FAILED' }));

    expect(row.attention).toEqual({ tone: 'destructive', summary: 'failed' });
    expect(row.unplaced).toEqual([]);
  });

  it('flags failing instances of a healthy service', () => {
    const row = rowOf(
      service('s', {
        instance_list: [
          instance({ instance_number: 0 }),
          instance({ instance_number: 1, status: 'DEAD' }),
        ],
      }),
    );

    expect(row.attention?.summary).toBe('has 1 of 2 instances failing');
  });

  it('counts failing services only, whatever state the clusters are in', () => {
    const { summary } = boardOf(
      [
        entry('app', [
          service('stuck', { status: 'NoActiveClusterWithCapacity', instance_list: [] }),
          service('dead', { status: 'FAILED', instance_list: [instance({ status: 'FAILED' })] }),
          service('fine'),
        ]),
      ],
      [reporting('a'), silent('off'), neverReported('new')],
    );

    expect(summary.attention).toBe(2);
  });
});

describe('summarySentence', () => {
  const sentence = (...args: Parameters<typeof boardOf>) =>
    summarySentence(boardOf(...args).summary);

  it('counts what runs where', () => {
    expect(sentence([entry('app', [service('s')])])).toBe(
      'Your applications run 1 instance of 1 service on 1 cluster, and nothing needs attention.',
    );
  });

  it('counts the services that need attention', () => {
    const failed = (id: string) => service(id, { status: 'FAILED' });
    expect(sentence([entry('app', [service('s'), failed('f')])])).toMatch(
      /and 1 service needs attention\.$/,
    );
    expect(sentence([entry('app', [failed('f'), failed('g')])])).toMatch(
      /and 2 services need attention\.$/,
    );
  });

  it('does not count a silent cluster', () => {
    expect(sentence([entry('app', [service('s')])], [reporting('a'), silent('b')])).toMatch(
      /and nothing needs attention\.$/,
    );
  });

  it('covers no applications and idle ones', () => {
    expect(sentence([])).toBe('You have no applications yet.');
    expect(sentence([], [silent('a')])).toBe('You have no applications yet.');
    expect(sentence([entry('app', [service('s', { instance_list: [] })])])).toBe(
      'Your applications have nothing running, and nothing needs attention.',
    );
  });
});

describe('filterRows', () => {
  const { rows } = boardOf([
    entry('shop', [service('frontend'), service('cache', { status: 'FAILED' })]),
    entry('calm', [service('worker')]),
  ]);
  const names = (filtered: ReturnType<typeof filterRows>) =>
    filtered.map((row) => [
      row.application.application_name,
      row.services.map((item) => item.service.microservice_name),
    ]);

  it('keeps all services of a matching application', () => {
    expect(names(filterRows(rows, { query: 'SHOP', onlyAttention: false }))).toEqual([
      ['shop', ['cache', 'frontend']],
    ]);
  });

  it('keeps only the matching service otherwise', () => {
    expect(names(filterRows(rows, { query: 'front', onlyAttention: false }))).toEqual([
      ['shop', ['frontend']],
    ]);
  });

  it('narrows to attention', () => {
    expect(names(filterRows(rows, { query: '', onlyAttention: true }))).toEqual([
      ['shop', ['cache']],
    ]);
  });

  it('keeps an application without services unless only attention is asked for', () => {
    const empty = boardOf([entry('new', [])]).rows;

    expect(filterRows(empty, { query: '', onlyAttention: false })).toHaveLength(1);
    expect(filterRows(empty, { query: '', onlyAttention: true })).toEqual([]);
  });
});

describe('instanceReading', () => {
  const placed = (subject: Service, clusters?: Cluster[]) =>
    rowOf(subject, clusters).placements.get('a')!;
  const measured = (cpu_percent: number, instance_number = 0, memory_percent = 0) =>
    instance({
      instance_number,
      cpu_percent,
      memory_percent,
      cpu_history: [{ timestamp: new Date(), value: cpu_percent }],
    });

  it('has no data for zeroes without history', () => {
    const subject = service('s', {
      instance_list: [instance({ cpu_percent: 0, memory_percent: 0 })],
    });

    expect(instanceReading(placed(subject), 'cpu')).toBeNull();
    expect(instanceReading(placed(subject), 'memory')).toBeNull();
  });

  it('believes a zero that has history', () => {
    const subject = service('s', { instance_list: [measured(0)] });

    expect(instanceReading(placed(subject), 'cpu')).toMatchObject({ value: 0, label: '0%' });
  });

  it('shows the highest of several and how many, keeping values above 100', () => {
    const subject = service('s', { instance_list: [measured(30, 0), measured(142.4, 1)] });

    expect(instanceReading(placed(subject), 'cpu')).toMatchObject({
      value: 142.4,
      label: '142%',
      count: 2,
    });
  });

  it('relates memory bytes to the limit of the service', () => {
    const subject = service('s', {
      memory: 100,
      instance_list: [measured(1, 0, 25 * MIB), measured(1, 1, 50 * MIB)],
    });

    expect(instanceReading(placed(subject), 'memory')).toMatchObject({
      value: 50,
      label: '50%',
      detail: '50 MB of 100 MB memory',
    });
  });

  it('shows plain bytes without a limit', () => {
    const subject = service('s', { memory: 0, instance_list: [measured(1, 0, 25 * MIB)] });

    expect(instanceReading(placed(subject), 'memory')).toMatchObject({
      value: null,
      label: '25 MB',
    });
  });

  it('has no data for failed instances, their numbers are leftovers', () => {
    const subject = service('s', {
      instance_list: [{ ...measured(40), status: 'FAILED' }],
    });

    expect(instanceReading(placed(subject), 'cpu')).toBeNull();
  });

  it('has no data on a silent cluster', () => {
    const subject = service('s', { instance_list: [measured(40)] });

    expect(instanceReading(placed(subject, [silent('a')]), 'cpu')).toBeNull();
  });
});

describe('board groups', () => {
  const placedOn = (clusterId: string, instance_number = 0) =>
    instance({ cluster_id: clusterId, instance_number });
  const { rows } = boardOf(
    [
      entry('shop', [
        service('web', { instance_list: [placedOn('a'), placedOn('b', 1)] }),
        service('db', { instance_list: [placedOn('b')] }),
      ]),
      entry('batch', [service('train', { status: 'NO_WORKER_CAPACITY', instance_list: [] })]),
      entry('empty', []),
    ],
    [reporting('a'), reporting('b')],
  );
  const names = (group: ApplicationRow) =>
    group.services.map((row) => row.service.microservice_name);

  it('groups what sits on a cluster by application, a service on each cluster it runs on', () => {
    const onA = clusterGroups(rows, 'a');
    const onB = clusterGroups(rows, 'b');

    expect(onA.map((group) => group.application.application_name)).toEqual(['shop']);
    expect(names(onA[0]!)).toEqual(['web']);
    expect(names(onB[0]!).sort()).toEqual(['db', 'web']);
    expect(clusterGroups(rows, 'nope')).toEqual([]);
  });

  it('lists unplaced services, and applications that would otherwise be nowhere', () => {
    const groups = unplacedGroups(rows);

    expect(groups.map((group) => group.application.application_name).sort()).toEqual([
      'batch',
      'empty',
    ]);
    expect(names(groups.find((group) => group.services.length > 0)!)).toEqual(['train']);
  });

  it('follows the filter', () => {
    const filtered = filterRows(rows, { query: 'db', onlyAttention: false });

    expect(clusterGroups(filtered, 'a')).toEqual([]);
    expect(names(clusterGroups(filtered, 'b')[0]!)).toEqual(['db']);
    expect(unplacedGroups(filtered)).toEqual([]);
  });
});

describe('parseLens', () => {
  it('falls back to health for anything hand-written into the URL', () => {
    expect(parseLens('cpu')).toBe('cpu');
    expect(parseLens('power')).toBe('health');
  });
});
