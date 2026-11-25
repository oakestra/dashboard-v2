import { describe, expect, it } from 'vitest';

import { footprintOf, summarize, type Cluster } from './estimate';

const reporting = {
  _id: 'c-1',
  cluster_name: 'berlin',
  cluster_location: '52.5,13.4,50',
  active: true,
  vcpus: 16,
  cpu_percent: 40,
  last_modified_timestamp: new Date(),
} as unknown as Cluster;

describe('footprintOf', () => {
  const now = new Date('2026-01-01T12:30:00');

  it('is deterministic', () => {
    expect(footprintOf(reporting, now)).toEqual(footprintOf(reporting, now));
  });

  it('gives a silent cluster no estimate', () => {
    const silent = { ...reporting, active: false } as Cluster;
    expect(footprintOf(silent, now).kind).toBe('silent');
    const never = { ...silent, last_modified_timestamp: undefined } as Cluster;
    expect(footprintOf(never, now).kind).toBe('never-reported');
  });

  it('leaves silent clusters out of the fleet totals', () => {
    const silent = footprintOf({ ...reporting, _id: 'c-2', active: false }, now);
    const fleet = summarize([footprintOf(reporting, now), silent]);
    expect(fleet.reporting).toBe(1);
    expect(fleet.history).toHaveLength(24);
  });
});
