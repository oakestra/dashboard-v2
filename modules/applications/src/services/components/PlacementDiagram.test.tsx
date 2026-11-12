import type { Cluster } from '@oakestra/api';
import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PlacementRow } from '../placement';
import { buildPlacementGraph, PlacementDiagram } from './PlacementDiagram';

const cluster = (id: string, name: string) => ({ _id: id, cluster_name: name }) as Cluster;
const service = { microservice_name: 'bigmem' };

const rows: PlacementRow[] = [
  {
    cluster: cluster('c1', 'alpha'),
    isTarget: false,
    state: 'passes',
    blockers: [],
    vcpus: 8,
    memory: 9000,
    runtimes: ['docker'],
    missingCsiDrivers: [],
  },
  {
    cluster: cluster('c2', 'beta'),
    isTarget: false,
    state: 'blocked',
    blockers: ['memory', 'vcpus'],
    vcpus: 2,
    memory: 100,
    runtimes: ['docker'],
    missingCsiDrivers: [],
  },
  { cluster: cluster('c3', 'gamma'), isTarget: false, state: 'silent', report: 'silent' },
];

describe('buildPlacementGraph', () => {
  it('draws one edge per cluster, toned by its verdict and labelled with the first blocker', () => {
    const { nodes, edges } = buildPlacementGraph(service, rows);
    expect(nodes.map((n) => [n.label, n.column])).toEqual([
      ['bigmem', 0],
      ['alpha', 1],
      ['beta', 1],
      ['gamma', 1],
    ]);
    expect(edges.map((e) => [e.tone, e.variant, e.label])).toEqual([
      ['success', undefined, undefined],
      ['warning', undefined, 'memory'],
      ['neutral', 'dashed', undefined],
    ]);
    expect(nodes[3]?.stale).toBe(true);
  });

  it('follows the rows when limits change', () => {
    const relaxed: PlacementRow[] = [
      { ...rows[1]!, state: 'passes', blockers: [] } as PlacementRow,
    ];
    expect(buildPlacementGraph(service, relaxed).edges[0]?.tone).toBe('success');
  });
});

describe('PlacementDiagram', () => {
  it('renders the service and its clusters', async () => {
    renderInHost(<PlacementDiagram service={service} rows={rows} />);
    const graph = await screen.findByRole('group', { name: /could host bigmem/ });
    for (const label of ['bigmem', 'alpha', 'beta', 'gamma'])
      expect(graph).toHaveTextContent(label);
  });
});
