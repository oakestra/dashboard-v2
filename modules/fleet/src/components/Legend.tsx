import { PointerGauge, staleSurfaceClassName, cn } from '@oakestra/ui';

import type { Lens } from '../lib';
import { Mark } from './Mark';

function Entry({ children }: { children: React.ReactNode }) {
  return <li className="flex items-center gap-1.5">{children}</li>;
}

/** The glyphs carry meaning on shape alone in the rows, so they need a key next to the board. */
export function Legend({ lens }: { lens: Lens }) {
  return (
    <ul
      aria-label="Legend"
      className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
    >
      {lens === 'health' ? (
        <>
          <Entry>
            <Mark tone="success" /> Running
          </Entry>
          <Entry>
            <Mark tone="info" /> Being scheduled
          </Entry>
          <Entry>
            <Mark tone="warning" /> Needs action
          </Entry>
          <Entry>
            <Mark tone="destructive" /> Failed
          </Entry>
          <Entry>
            <Mark tone="neutral" /> Not deployed
          </Entry>
          <Entry>
            <Mark tone="neutral" stale /> Last known
          </Entry>
        </>
      ) : (
        <>
          <Entry>
            <PointerGauge
              aria-hidden
              size="sm"
              label="Example"
              value={40}
              valueLabel=""
              className="w-12"
            />
            Shaded band is normal
          </Entry>
          <Entry>
            <span className="tabular-nums">×3</span> Highest of 3 instances
          </Entry>
        </>
      )}
      <Entry>
        <span aria-hidden className={cn('size-3 rounded-[2px] border', staleSurfaceClassName)} />
        Cluster silent, nothing confirmed
      </Entry>
    </ul>
  );
}
