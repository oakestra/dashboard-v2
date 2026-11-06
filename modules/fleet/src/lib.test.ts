import type { Application, Cluster, Instance, Service } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import {
  buildFleet,
  instanceReading,
  clusterGroups,
  clusterSelection,
  filterRows,
  instanceSelection,
  isRowSelected,
  parseLens,
  placementSelection,
  resolveSelection,
  serviceSelection,
  summarySentence,
  unplacedGroups,
  type BuildFleetInput,
  type ApplicationRow,
  type FleetEntry,
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

const entry = (name: string, services: Service[], userId = 'me'): FleetEntry => ({
  application: {
    _id: name,
    application_name: name,
    application_namespace: 'ns',
    userId,
  } as Application,
  services,
});

const fleetOf = (
  entries: FleetEntry[],
  clusters: Cluster[] = [reporting('a')],
  overrides: Partial<BuildFleetInput> = {},
) => buildFleet({ entries, clusters, scope: 'own', username: 'me', ...overrides });

/** The Unplaced entries of the only service. */
const unplacedOf = (subject: Service, clusters?: Cluster[]) =>
  fleetOf([entry('app', [subject])], clusters).rows[0]!.services[0]!.unplaced;

describe('buildFleet lanes', () => {
  it('orders reporting clusters by name, then silent, then never-reported', () => {
    const { lanes } = fleetOf(
      [],
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
});

describe('buildFleet rows', () => {
  it('puts applications with exceptions first, worst first, the rest by name', () => {
    const { rows } = fleetOf(
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

  it('collects the instances of a cluster from all services', () => {
    const { lanes } = fleetOf([
      entry('app', [
        service('s1'),
        service('s2', {
          instance_list: [instance({ instance_number: 3 }), instance({ instance_number: 4 })],
        }),
      ]),
    ]);

    expect(lanes[0]!.instances).toHaveLength(3);
    expect(lanes[0]!.instances.map((item) => item.key)).toContain('s2:4');
  });

  it('marks applications of other users, except that per-user lists are always your own', () => {
    const foreign = entry('app', [service('s1')], 'alice');

    expect(fleetOf([foreign], undefined, { scope: 'all' }).rows[0]!.owned).toBe(false);
    expect(fleetOf([entry('app', [])], undefined, { scope: 'all' }).rows[0]!.owned).toBe(true);
    expect(fleetOf([foreign]).rows[0]!.owned).toBe(true);
  });
});

describe('buildFleet Unplaced', () => {
  it.each([
    ['empty', ''],
    ['missing', undefined],
    ['unknown', 'not-a-cluster'],
  ])('catches an instance with a %s cluster id', (_, cluster_id) => {
    const subject = service('s', { instance_list: [instance({ cluster_id })] });
    const row = fleetOf([entry('app', [subject])]).rows[0]!.services[0]!;

    expect(row.unplaced).toHaveLength(1);
    expect(row.unplaced[0]).toMatchObject({ tone: 'warning', label: 'Unknown cluster' });
    expect(row.placements.size).toBe(0);
  });

  it('does not treat an instance the scheduler is still placing as lost', () => {
    const subject = service('s', {
      instance_list: [instance({ status: 'SCHEDULED', cluster_id: '' })],
    });
    const { rows, exceptions } = fleetOf([entry('app', [subject])]);

    expect(rows[0]!.services[0]!.unplaced[0]).toMatchObject({
      tone: 'info',
      label: 'Being scheduled',
    });
    expect(exceptions).toEqual([]);
  });

  it('catches a placement failure, also next to running instances', () => {
    const subject = service('s', { status: 'NO_WORKER_CAPACITY' });

    expect(unplacedOf(subject)).toEqual([
      expect.objectContaining({ tone: 'warning', label: 'No capacity' }),
    ]);
  });

  it('does not show a turned-down instance as running on the cluster that refused it', () => {
    const subject = service('s', {
      status: 'NO_WORKER_CAPACITY',
      instance_list: [instance({ status: 'NO_WORKER_CAPACITY' })],
    });
    const row = fleetOf([entry('app', [subject])]).rows[0]!.services[0]!;

    expect(row.placements.size).toBe(0);
    // Service and instance say the same thing, once is enough.
    expect(row.unplaced).toHaveLength(1);
  });

  it('catches a failed service without instances', () => {
    const subject = service('s', { status: 'FAILED', instance_list: [] });

    expect(unplacedOf(subject)).toEqual([
      expect.objectContaining({ tone: 'destructive', label: 'Failed' }),
    ]);
  });

  it('shows REQUESTED without an instance as being scheduled, not as an exception', () => {
    const subject = service('s', { status: 'REQUESTED', instance_list: [] });
    const { rows, exceptions } = fleetOf([entry('app', [subject])]);

    expect(rows[0]!.services[0]!.unplaced).toEqual([
      expect.objectContaining({ tone: 'info', label: 'Being scheduled', pulse: true }),
    ]);
    expect(exceptions).toEqual([]);
  });

  it('shows an undeployed service quietly', () => {
    const subject = service('s', { status: undefined, instance_list: [] });
    const { rows, exceptions } = fleetOf([entry('app', [subject])]);

    expect(rows[0]!.services[0]!.unplaced).toEqual([
      expect.objectContaining({ tone: 'neutral', label: 'Not deployed' }),
    ]);
    expect(exceptions).toEqual([]);
    expect(rows[0]!.severity).toBe(3);
  });

  it('leaves a healthy service out', () => {
    expect(unplacedOf(service('s'))).toEqual([]);
  });
});

describe('buildFleet silent clusters', () => {
  const clusters = [reporting('a'), silent('off'), neverReported('new')];
  const onCluster = (cluster_id: string, instance_number: number) =>
    instance({ cluster_id, instance_number });

  it('renders instances there as last known and never counts them as running', () => {
    const { rows, summary } = fleetOf(
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
    const { summary } = fleetOf([
      entry('app', [service('s', { instance_list: [instance({ status: 'STARTING' })] })]),
    ]);

    expect(summary.running).toBe(0);
  });
});

describe('buildFleet exceptions', () => {
  it('lists failures, then placement problems, then silent clusters', () => {
    const { exceptions } = fleetOf(
      [
        entry('app', [
          service('stuck', { status: 'NoActiveClusterWithCapacity', instance_list: [] }),
          service('dead', {
            status: 'FAILED',
            instance_list: [
              instance({ status: 'FAILED', status_detail: 'Exited with return code 137' }),
            ],
          }),
        ]),
      ],
      [reporting('a'), silent('off'), neverReported('new')],
    );

    expect(exceptions.map((item) => [item.tone, item.title])).toEqual([
      ['destructive', 'app / dead failed'],
      ['warning', "app / stuck can't be placed"],
      ['stale', 'off is silent'],
    ]);
    expect(exceptions[0]!.detail).toBe('Exited with return code 137');
    expect(exceptions[1]!.selection).toBe(serviceSelection('stuck'));
    expect(exceptions[2]!.selection).toBe(clusterSelection('off'));
  });

  it('flags a failed service whose instances still run', () => {
    const { exceptions, rows } = fleetOf([entry('app', [service('s', { status: 'FAILED' })])]);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]!.tone).toBe('destructive');
    expect(rows[0]!.services[0]!.unplaced).toEqual([]);
  });

  it('flags failing instances of a healthy service', () => {
    const { exceptions } = fleetOf([
      entry('app', [
        service('s', {
          instance_list: [
            instance({ instance_number: 0 }),
            instance({ instance_number: 1, status: 'DEAD' }),
          ],
        }),
      ]),
    ]);

    expect(exceptions[0]!.title).toBe('app / s has 1 of 2 instances failing');
  });

  it('flags an instance on an unregistered cluster, the shared attention rules cannot know that', () => {
    const { exceptions } = fleetOf([
      entry('app', [service('s', { instance_list: [instance({ cluster_id: 'gone' })] })]),
    ]);

    expect(exceptions[0]!.title).toBe('app / s is on an unknown cluster');
  });

  it("does not repeat the scheduler's stale waiting text next to its verdict", () => {
    const { exceptions } = fleetOf([
      entry('app', [
        service('s', {
          status: 'NoActiveClusterWithCapacity',
          status_detail: 'Waiting for scheduling decision',
          instance_list: [],
        }),
      ]),
    ]);

    expect(exceptions[0]!.detail).toBe("No active cluster can fit this service's requirements");
  });
});

describe('summarySentence', () => {
  const sentence = (...args: Parameters<typeof fleetOf>) =>
    summarySentence(fleetOf(...args).summary);

  it('states its scope', () => {
    const entries = [entry('app', [service('s')])];

    expect(sentence(entries)).toBe(
      'Your applications run 1 instance of 1 service on 1 cluster, and nothing needs a look.',
    );
    expect(sentence(entries, undefined, { scope: 'all' })).toMatch(/^All applications run/);
  });

  it('counts what needs a look', () => {
    expect(
      sentence([entry('app', [service('s')])], [reporting('a'), silent('b'), silent('c')]),
    ).toMatch(/and 2 things need a look\.$/);
  });

  it('covers an empty and an idle fleet', () => {
    expect(sentence([])).toBe('You have no applications yet.');
    expect(sentence([], undefined, { scope: 'all' })).toBe('There are no applications yet.');
    expect(sentence([entry('app', [service('s', { instance_list: [] })])])).toBe(
      'Your applications have nothing running, and nothing needs a look.',
    );
  });
});

describe('filterRows', () => {
  const { rows } = fleetOf([
    entry('shop', [service('frontend'), service('cache', { status: 'FAILED' })]),
    entry('calm', [service('worker')], 'alice'),
  ]);
  const names = (filtered: ReturnType<typeof filterRows>) =>
    filtered.map((row) => [
      row.application.application_name,
      row.services.map((item) => item.service.microservice_name),
    ]);

  it('keeps all services of a matching application', () => {
    expect(names(filterRows(rows, { query: 'SHOP', onlyExceptions: false }))).toEqual([
      ['shop', ['cache', 'frontend']],
    ]);
  });

  it('keeps only the matching service otherwise, and also finds owners', () => {
    expect(names(filterRows(rows, { query: 'front', onlyExceptions: false }))).toEqual([
      ['shop', ['frontend']],
    ]);
    expect(names(filterRows(rows, { query: 'alice', onlyExceptions: false }))).toEqual([
      ['calm', ['worker']],
    ]);
  });

  it('narrows to exceptions', () => {
    expect(names(filterRows(rows, { query: '', onlyExceptions: true }))).toEqual([
      ['shop', ['cache']],
    ]);
  });

  it('keeps an application without services unless exceptions are asked for', () => {
    const empty = fleetOf([entry('new', [])]).rows;

    expect(filterRows(empty, { query: '', onlyExceptions: false })).toHaveLength(1);
    expect(filterRows(empty, { query: '', onlyExceptions: true })).toEqual([]);
  });
});

describe('instanceReading', () => {
  const placed = (subject: Service, clusters?: Cluster[]) =>
    fleetOf([entry('app', [subject])], clusters).rows[0]!.services[0]!.placements.get('a')!;
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

describe('selection', () => {
  const fleet = fleetOf([
    entry('app', [
      service('s1', {
        instance_list: [instance({ instance_number: 2 }), instance({ instance_number: 5 })],
      }),
      service('s2'),
    ]),
  ]);

  it('resolves services, instances and clusters', () => {
    expect(resolveSelection(fleet, serviceSelection('s1'))).toMatchObject({ kind: 'service' });
    expect(resolveSelection(fleet, instanceSelection('s1', 5))).toMatchObject({
      kind: 'instance',
      entry: { key: 's1:5' },
    });
    expect(resolveSelection(fleet, clusterSelection('a'))).toMatchObject({ kind: 'cluster' });
  });

  it('falls back to the service when the instance is gone', () => {
    expect(resolveSelection(fleet, instanceSelection('s1', 9))).toMatchObject({ kind: 'service' });
  });

  it('resolves anything unknown to nothing', () => {
    expect(resolveSelection(fleet, 'service:nope')).toBeNull();
    expect(resolveSelection(fleet, 'cluster:nope')).toBeNull();
    expect(resolveSelection(fleet, 'garbage')).toBeNull();
  });

  it('sends a row to its instance, or to the service when there are several', () => {
    const [s1, s2] = fleet.rows[0]!.services;

    expect(placementSelection('s2', s2!.placements.get('a')!)).toBe(instanceSelection('s2', 0));
    expect(placementSelection('s1', s1!.placements.get('a')!)).toBe(serviceSelection('s1'));
  });

  it('keeps a row selected for its service and for each of its instances', () => {
    const instances = fleet.rows[0]!.services[0]!.placements.get('a')!;

    expect(isRowSelected(serviceSelection('s1'), 's1', instances)).toBe(true);
    expect(isRowSelected(instanceSelection('s1', 5), 's1', instances)).toBe(true);
    expect(isRowSelected(instanceSelection('s1', 9), 's1', instances)).toBe(false);
    expect(isRowSelected(serviceSelection('s2'), 's1', instances)).toBe(false);
  });
});

describe('board groups', () => {
  const placedOn = (clusterId: string, instance_number = 0) =>
    instance({ cluster_id: clusterId, instance_number });
  const { rows } = fleetOf(
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
    const filtered = filterRows(rows, { query: 'db', onlyExceptions: false });

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
