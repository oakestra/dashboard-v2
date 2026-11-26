import { isAbnormalTone } from '@oakestra/api';
import { useAddonPath } from '@oakestra/dashboard-sdk';
import { cn, Item, PointerGauge } from '@oakestra/ui';
import { Link } from 'react-router';

import {
  describeInstances,
  instanceReading,
  sortInstances,
  sortUnplaced,
  type BoardInstance,
  type ClusterLane,
  type Lens,
  type ServiceRow,
} from './lib';
import { Mark } from './Mark';

/** Enough marks to count at a glance; beyond that a number reads faster than a row of dots. */
const MAX_MARKS = 4;

const boardRowClassName =
  'hover:bg-accent/50 focus-visible:ring-ring min-h-8 w-full flex-nowrap gap-3 px-3 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset';

function HealthMarks({ instances }: { instances: readonly BoardInstance[] }) {
  const sorted = sortInstances(instances);
  const extra = sorted.length - MAX_MARKS;
  return (
    <>
      {sorted.slice(0, MAX_MARKS).map(({ key, status, stale }) => (
        <Mark key={key} tone={status.tone} stale={stale} pulse={status.pulse} />
      ))}
      {extra > 0 ? (
        <span className="text-muted-foreground text-xs tabular-nums">+{extra}</span>
      ) : null}
    </>
  );
}

function Reading({
  instances,
  lens,
}: {
  instances: readonly BoardInstance[];
  lens: 'cpu' | 'memory';
}) {
  const reading = instanceReading(instances, lens);
  // A failed instance has no number, which must not make the row look calmer than the health lens.
  const worst = sortInstances(instances)[0];
  return (
    <>
      {worst && isAbnormalTone(worst.status.tone) ? <Mark tone={worst.status.tone} /> : null}
      {reading === null ? (
        <span className="text-muted-foreground text-xs">No data</span>
      ) : reading.value === null ? (
        <span className="text-xs tabular-nums">{reading.label}</span>
      ) : (
        <PointerGauge
          aria-hidden
          size="sm"
          className="min-w-0 flex-1"
          label={lens}
          value={reading.value}
          valueLabel={reading.label}
        />
      )}
      {reading && reading.count > 1 ? (
        <span className="text-muted-foreground text-xs tabular-nums">×{reading.count}</span>
      ) : null}
    </>
  );
}

function readingLabel(instances: readonly BoardInstance[], lens: Lens): string {
  const status = describeInstances(instances);
  if (lens === 'health') return status;
  const reading = instanceReading(instances, lens);
  if (!reading) return `${status}, no data`;
  const prefix = reading.count > 1 ? `highest of ${reading.count}: ` : '';
  return `${status}, ${prefix}${reading.detail}`;
}

function useServicePath({ application, service }: ServiceRow): string {
  return useAddonPath()(application._id, 'services', service._id);
}

/** One service on one cluster, linking to the service. */
export function PlacedRow({ row, lane, lens }: { row: ServiceRow; lane: ClusterLane; lens: Lens }) {
  const href = useServicePath(row);
  const { service, attention } = row;
  const name = service.microservice_name;
  const instances = row.placements.get(lane.id) ?? [];
  // A failed service can still have running instances: no mark of theirs would show that it failed.
  const failedInPlace = attention && row.unplaced.length === 0 ? attention : null;
  const marked = instances.some((entry) => isAbnormalTone(entry.status.tone));
  const offline = lane.state !== 'reporting';
  return (
    <Item asChild size="sm" className={boardRowClassName}>
      <Link
        to={href}
        aria-label={`${name} on ${lane.name}: ${readingLabel(instances, lens)}${failedInPlace ? `, ${failedInPlace.summary}` : ''}`}
      >
        <span className="truncate">{name}</span>
        {failedInPlace && !marked ? <Mark tone={failedInPlace.tone} /> : null}
        <span
          className={cn(
            'ml-auto flex shrink-0 items-center justify-end gap-1.5',
            lens !== 'health' && 'w-32',
          )}
        >
          {lens === 'health' ? (
            <HealthMarks instances={instances} />
          ) : offline ? (
            <span className="text-muted-foreground text-xs">No data</span>
          ) : (
            <Reading instances={instances} lens={lens} />
          )}
        </span>
      </Link>
    </Item>
  );
}

/**
 * One service without a place, with the worst reason for it. It links to the service too, whose
 * page explains the placement.
 */
export function UnplacedRow({ row }: { row: ServiceRow }) {
  const href = useServicePath(row);
  const { service, unplaced } = row;
  const name = service.microservice_name;
  const [worst] = sortUnplaced(unplaced);
  if (!worst) return null;
  const others = unplaced.length - 1;
  return (
    <Item asChild size="sm" className={boardRowClassName}>
      <Link
        to={`${href}#placement`}
        aria-label={`${name} unplaced: ${worst.label}${others > 0 ? `, and ${others} more` : ''}`}
      >
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className="flex max-w-3/5 min-w-0 items-center gap-1.5">
          <Mark tone={worst.tone} pulse={worst.pulse} />
          <span
            className={cn(
              'truncate text-xs',
              worst.tone === 'destructive' && 'text-destructive font-medium',
              worst.tone === 'warning' && 'text-warning font-medium',
              worst.tone !== 'destructive' && worst.tone !== 'warning' && 'text-muted-foreground',
            )}
          >
            {worst.label}
          </span>
          {others > 0 ? (
            <span className="text-muted-foreground text-xs tabular-nums">+{others}</span>
          ) : null}
        </span>
      </Link>
    </Item>
  );
}
