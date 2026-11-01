import { Badge } from '@oakestra/ui';
import type { Instance } from '@oakestra/api';

import { instanceCounts } from '../status';

/** Compact "2 running, 1 pending" badges; "None" for a service without instances. */
export function InstanceSummary({ instances }: { instances: readonly Instance[] }) {
  const { total, running, pending, failed } = instanceCounts(instances);
  if (total === 0) return <span className="text-muted-foreground">None</span>;
  const other = total - running - pending - failed;
  return (
    <span className="flex flex-wrap gap-1" data-testid="instance-summary">
      {running > 0 ? <Badge>{running} running</Badge> : null}
      {pending > 0 ? <Badge variant="secondary">{pending} pending</Badge> : null}
      {failed > 0 ? <Badge variant="destructive">{failed} failed</Badge> : null}
      {other > 0 ? <Badge variant="outline">{other} other</Badge> : null}
    </span>
  );
}
