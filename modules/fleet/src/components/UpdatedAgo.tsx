import { formatRelativeTime } from '@oakestra/ui';
import { useEffect, useState } from 'react';

/** Its own component so the once-a-second tick does not rerender the board. */
export function UpdatedAgo({ updatedAt }: { updatedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!Number.isFinite(updatedAt)) return null;
  return (
    <span className="text-muted-foreground text-xs tabular-nums" data-testid="fleet-updated">
      Updated {formatRelativeTime(updatedAt, now)}
    </span>
  );
}
