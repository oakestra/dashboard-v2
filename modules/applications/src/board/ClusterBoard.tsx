import { clusterCpuPercent, clusterStateLabel } from '@oakestra/api';
import { useAddonPath, useFeatureEnabled, usePermissions } from '@oakestra/dashboard-sdk';
import {
  Card,
  cn,
  formatPercent,
  formatRelativeTime,
  plural,
  PointerGauge,
  staleSurfaceClassName,
} from '@oakestra/ui';
import { CircleDashedIcon } from 'lucide-react';
import { Fragment, memo, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';

import { INFRASTRUCTURE_ROLES } from '../services/infrastructure-roles';
import {
  availableMemoryLabel,
  clusterGroups,
  describeIdleClusters,
  idleClusterNote,
  unplacedGroups,
  type ApplicationRow,
  type BoardModel,
  type ClusterLane,
  type Lens,
} from './lib';
import { Mark } from './Mark';
import { PlacedRow, UnplacedRow } from './ServiceRows';

const linkClassName =
  'hover:underline focus-visible:ring-ring rounded-sm outline-none focus-visible:ring-2';

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
  const addonPath = useAddonPath();
  return (
    <div>
      <h3 className="text-muted-foreground px-3 py-1 text-xs font-medium">
        <Link to={addonPath(group.application._id)} className={cn('block truncate', linkClassName)}>
          {group.application.application_name}
        </Link>
      </h3>
      {children}
    </div>
  );
}

const cardBodyClassName = 'flex-1 space-y-2 border-t p-2';

const ClusterCard = memo(function ClusterCard({
  lane,
  groups,
  lens,
  linkToCluster,
}: {
  lane: ClusterLane;
  groups: readonly ApplicationRow[];
  lens: Lens;
  linkToCluster: boolean;
}) {
  const reporting = lane.state === 'reporting';
  return (
    <Card
      role="group"
      aria-label={lane.name}
      className={cn('h-full gap-0 overflow-hidden py-0', !reporting && staleSurfaceClassName)}
    >
      <div className="px-5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate font-semibold">
            <ClusterName lane={lane} link={linkToCluster} />
          </h2>
          <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
            <Mark tone={reporting ? 'success' : 'neutral'} stale={!reporting} />
            {clusterStateLabel(lane.state)}
          </span>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">{clusterSubline(lane)}</p>
        <ClusterLoad lane={lane} lens={lens} />
      </div>
      <div className={cardBodyClassName}>
        {groups.map((group) => (
          <Group key={group.application._id} group={group}>
            <ul>
              {group.services.map((row) => (
                <li key={row.service._id}>
                  <PlacedRow row={row} lane={lane} lens={lens} />
                </li>
              ))}
            </ul>
          </Group>
        ))}
      </div>
    </Card>
  );
});

const UnplacedCard = memo(function UnplacedCard({ groups }: { groups: readonly ApplicationRow[] }) {
  const count = groups.reduce((total, group) => total + group.services.length, 0);
  return (
    // Not a place: a recessed, dashed band across the board instead of one more raised card, with
    // its services side by side, so it never reads as a cluster. Not hatched, because the
    // hatch already means a silent cluster.
    <Card
      role="group"
      aria-label="Unplaced"
      className="bg-muted/40 gap-0 overflow-hidden border-dashed py-0 shadow-none"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-5 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <CircleDashedIcon aria-hidden className="text-muted-foreground size-4" />
          Unplaced
        </h2>
        <p className="text-muted-foreground text-xs">
          {count === 0 ? 'Nothing to place' : `${plural(count, 'service')} not on a cluster`}
        </p>
      </div>
      <div className="space-y-2 border-t border-dashed p-2">
        {groups.map((group) => (
          <Group key={group.application._id} group={group}>
            {group.services.length === 0 ? (
              <p className="text-muted-foreground px-3 py-1 text-sm">
                {group.servicesUnavailable ? 'Services could not be loaded' : 'No services'}
              </p>
            ) : (
              // The same columns as the cards below, so the band fills its width instead of
              // stacking a few rows at the left edge.
              <ul className="grid gap-x-4 @xl:grid-cols-2 @5xl:grid-cols-3">
                {group.services.map((row) => (
                  <li key={row.service._id}>
                    <UnplacedRow row={row} />
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

function ClusterName({ lane, link }: { lane: ClusterLane; link: boolean }) {
  if (!link) return lane.name;
  return (
    <Link to={`/infrastructure/clusters/${encodeURIComponent(lane.id)}`} className={linkClassName}>
      {lane.name}
    </Link>
  );
}

/** The clusters without a card of their own, so a long cluster list does not bury the board. */
function IdleClusters({ lanes, link }: { lanes: readonly ClusterLane[]; link: boolean }) {
  const idle = describeIdleClusters(lanes);
  if (!idle) return null;
  return (
    <p className="text-muted-foreground text-sm" data-testid="board-idle-clusters">
      {idle.lead}:{' '}
      {idle.named.map((lane, index) => {
        const note = idleClusterNote(lane);
        return (
          <Fragment key={lane.id}>
            {index > 0 ? ', ' : null}
            <ClusterName lane={lane} link={link} />
            {note ? ` (${note})` : null}
          </Fragment>
        );
      })}
      {idle.more > 0 ? ` and ${idle.more} more` : null}
    </p>
  );
}

interface ClusterBoardProps {
  board: BoardModel;
  /** The filtered rows, what the cards show. */
  rows: readonly ApplicationRow[];
  lens: Lens;
  /**
   * Leaves out the clusters without a match, so the hits are not scattered between empty cards,
   * and the line of idle clusters, which says nothing about a filtered view.
   */
  filtering: boolean;
}

/**
 * One card per cluster that runs something of the viewer's, in the order of `board.lanes`, the
 * services without a cluster in a band above them and a line for the idle clusters below. The
 * columns follow the board's own width rather than the viewport, so the board fits wherever it is
 * placed.
 */
export const ClusterBoard = memo(function ClusterBoard({
  board,
  rows,
  lens,
  filtering,
}: ClusterBoardProps) {
  const infrastructureEnabled = useFeatureEnabled('infrastructure');
  const permissions = usePermissions();
  const linkToCluster = infrastructureEnabled && permissions.hasAnyRole(INFRASTRUCTURE_ROLES);
  const unplaced = useMemo(() => unplacedGroups(rows), [rows]);
  const cards = useMemo(
    () =>
      board.lanes
        .map((lane) => ({ lane, groups: clusterGroups(rows, lane.id) }))
        .filter(({ groups }) => !filtering || groups.length > 0),
    [board.lanes, rows, filtering],
  );
  return (
    <div className="@container space-y-4">
      <ul
        aria-label="Applications by cluster"
        data-tour="cluster-board"
        className="grid gap-4 @xl:grid-cols-2 @5xl:grid-cols-3"
      >
        {unplaced.length > 0 ? (
          <li className="col-span-full min-w-0">
            <UnplacedCard groups={unplaced} />
          </li>
        ) : null}
        {cards.map(({ lane, groups }) => (
          <li key={lane.id} className="min-w-0">
            <ClusterCard lane={lane} groups={groups} lens={lens} linkToCluster={linkToCluster} />
          </li>
        ))}
      </ul>
      {filtering ? null : <IdleClusters lanes={board.idleLanes} link={linkToCluster} />}
    </div>
  );
});
