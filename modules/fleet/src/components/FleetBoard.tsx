import { clusterCpuPercent, clusterStateLabel } from '@oakestra/api';
import {
  Card,
  cn,
  formatPercent,
  formatRelativeTime,
  plural,
  PointerGauge,
  staleSurfaceClassName,
} from '@oakestra/ui';
import { memo, useMemo, type ReactNode } from 'react';

import {
  availableMemoryLabel,
  clusterGroups,
  clusterSelection,
  selectionOnCard,
  unplacedGroups,
  type ApplicationRow,
  type ClusterLane,
  type FleetModel,
  type Lens,
} from '../lib';
import { PlacedRow, rowButtonClassName, UnplacedRow } from './ServiceRows';
import { Mark } from './Mark';

function clusterSubline({ state, cluster }: ClusterLane): string {
  if (state === 'never-reported') return 'Registered, no report yet';
  if (state === 'silent') return `Last seen ${formatRelativeTime(cluster.last_modified_timestamp)}`;
  return plural(cluster.active_nodes ?? 0, 'active node');
}

function ClusterLoad({ lane, lens }: { lane: ClusterLane; lens: Lens }) {
  if (lane.state !== 'reporting') return null;
  if (lens === 'cpu') {
    const cpu = clusterCpuPercent(lane.cluster) ?? null;
    return (
      <PointerGauge
        size="sm"
        className="mt-2 w-full"
        label={`${lane.name} CPU`}
        value={cpu}
        valueLabel={cpu === null ? undefined : formatPercent(cpu, 0)}
      />
    );
  }
  if (lens === 'memory') {
    return (
      <span className="text-muted-foreground mt-2 block text-xs">
        {availableMemoryLabel(lane.cluster) ?? 'No data'}
      </span>
    );
  }
  return null;
}

function Group({ group, children }: { group: ApplicationRow; children: ReactNode }) {
  const name = group.application.application_name;
  return (
    <div>
      <h3 className="text-muted-foreground flex items-baseline gap-2 px-3 py-1 text-xs font-medium">
        <span className="truncate">{name}</span>
        {group.owned ? null : <span className="font-normal">{group.owner}</span>}
      </h3>
      {children}
    </div>
  );
}

const cardBodyClassName = 'flex-1 space-y-2 border-t p-2';

interface CardProps {
  lens: Lens;
  selection: string;
  onSelect: (selection: string) => void;
}

const ClusterCard = memo(function ClusterCard({
  lane,
  groups,
  lens,
  selection,
  onSelect,
}: CardProps & { lane: ClusterLane; groups: readonly ApplicationRow[] }) {
  const target = clusterSelection(lane.id);
  const selected = selection === target;
  const reporting = lane.state === 'reporting';
  const state = clusterStateLabel(lane.state);
  const sub = clusterSubline(lane);
  return (
    <Card
      role="group"
      aria-label={lane.name}
      className={cn(
        'h-full gap-0 overflow-hidden py-0',
        !reporting && staleSurfaceClassName,
        selected && 'ring-primary ring-2',
      )}
    >
      <h2>
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`Inspect cluster ${lane.name}, ${state}, ${sub}`}
          onClick={() => onSelect(selected ? '' : target)}
          className={cn(rowButtonClassName, 'block px-5 py-3.5 text-left')}
        >
          <span className="flex items-center justify-between gap-3">
            <span className="truncate font-semibold">{lane.name}</span>
            <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
              <Mark tone={reporting ? 'success' : 'neutral'} stale={!reporting} />
              {state}
            </span>
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs font-normal">{sub}</span>
          <ClusterLoad lane={lane} lens={lens} />
        </button>
      </h2>
      <div className={cardBodyClassName}>
        {groups.length === 0 ? (
          <p className="text-muted-foreground px-3 py-1 text-sm">Nothing you can see runs here.</p>
        ) : (
          groups.map((group) => (
            <Group key={group.application._id} group={group}>
              <ul>
                {group.services.map((row) => (
                  <li key={row.service._id}>
                    <PlacedRow
                      row={row}
                      lane={lane}
                      lens={lens}
                      selection={selection}
                      onSelect={onSelect}
                    />
                  </li>
                ))}
              </ul>
            </Group>
          ))
        )}
      </div>
    </Card>
  );
});

const UnplacedCard = memo(function UnplacedCard({
  groups,
  selection,
  onSelect,
}: Omit<CardProps, 'lens'> & { groups: readonly ApplicationRow[] }) {
  const count = groups.reduce((total, group) => total + group.services.length, 0);
  return (
    <Card role="group" aria-label="Unplaced" className="h-full gap-0 overflow-hidden py-0">
      <div className="px-5 py-3.5">
        <h2 className="font-semibold">Unplaced</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {count === 0 ? 'Nothing to place' : `${plural(count, 'service')} not on a cluster`}
        </p>
      </div>
      <div className={cardBodyClassName}>
        {groups.map((group) => (
          <Group key={group.application._id} group={group}>
            {group.services.length === 0 ? (
              <p className="text-muted-foreground px-3 py-1 text-sm">
                {group.servicesUnavailable ? 'Services could not be loaded' : 'No services'}
              </p>
            ) : (
              <ul>
                {group.services.map((row) => (
                  <li key={row.service._id}>
                    <UnplacedRow row={row} selection={selection} onSelect={onSelect} />
                  </li>
                ))}
              </ul>
            )}
          </Group>
        ))}
      </div>
    </Card>
  );
});

interface FleetBoardProps {
  fleet: FleetModel;
  /** The filtered rows, what the cards show. */
  rows: readonly ApplicationRow[];
  lens: Lens;
  selection: string;
  /** Leaves out the clusters without a match, so the hits are not scattered between empty cards. */
  filtering: boolean;
  onSelect: (selection: string) => void;
}

/**
 * One card per cluster, in the order of `fleet.lanes`, and the services without a cluster in front
 * of them. The columns follow the board's own width rather than the viewport, because the open
 * inspector takes a third of the page away from it.
 */
export const FleetBoard = memo(function FleetBoard({
  fleet,
  rows,
  lens,
  selection,
  filtering,
  onSelect,
}: FleetBoardProps) {
  // Kept across selection changes: the cards are memoized on these groups.
  const unplaced = useMemo(() => unplacedGroups(rows), [rows]);
  const cards = useMemo(
    () =>
      fleet.lanes
        .map((lane) => ({ lane, groups: clusterGroups(rows, lane.id) }))
        .filter(({ groups }) => !filtering || groups.length > 0),
    [fleet.lanes, rows, filtering],
  );
  return (
    <div className="@container">
      <ul aria-label="Fleet board" className="grid gap-4 @xl:grid-cols-2 @5xl:grid-cols-3">
        {unplaced.length > 0 ? (
          <li className="min-w-0">
            <UnplacedCard
              groups={unplaced}
              selection={selectionOnCard(selection, unplaced)}
              onSelect={onSelect}
            />
          </li>
        ) : null}
        {cards.map(({ lane, groups }) => (
          <li key={lane.id} className="min-w-0">
            <ClusterCard
              lane={lane}
              groups={groups}
              lens={lens}
              selection={selectionOnCard(selection, groups, lane.id)}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </div>
  );
});
